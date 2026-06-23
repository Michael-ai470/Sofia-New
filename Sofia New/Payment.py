"""
payments.py — Paystack + Monnify payment integration for Sofia credit top-ups.

Routes:
    GET  /credits/packages              — list packages with currency conversion
    POST /credits/initiate              — initiate payment (Paystack or Monnify)
    POST /credits/verify                — verify after redirect, grant credits
    POST /credits/webhook/paystack      — Paystack server-to-server webhook
    POST /credits/webhook/monnify       — Monnify server-to-server webhook

Environment variables (.env):
    PAYSTACK_SECRET_KEY     sk_live_... or sk_test_...
    MONNIFY_API_KEY         your Monnify API key
    MONNIFY_SECRET_KEY      your Monnify secret key
    MONNIFY_CONTRACT_CODE   your Monnify contract code
    MONNIFY_BASE_URL        https://api.monnify.com (live) or
                            https://sandbox.monnify.com (test)
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import uuid

import requests
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()

from db import record_payment, confirm_payment, get_user_by_id
from auth import get_current_user

log = logging.getLogger("sofia.payments")

# --------------------------------------------------------------------------- #
#  CONFIG                                                                      #
# --------------------------------------------------------------------------- #
PAYSTACK_SECRET    = os.environ.get("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE      = "https://api.paystack.co"

MONNIFY_API_KEY     = os.environ.get("MONNIFY_API_KEY", "")
MONNIFY_SECRET_KEY  = os.environ.get("MONNIFY_SECRET_KEY", "")
MONNIFY_CONTRACT    = os.environ.get("MONNIFY_CONTRACT_CODE", "")
MONNIFY_BASE        = os.environ.get("MONNIFY_BASE_URL", "https://sandbox.monnify.com")


# --------------------------------------------------------------------------- #
#  CREDIT PACKAGES                                                             #
# --------------------------------------------------------------------------- #
PACKAGES = [
    {
        "id":          "starter",
        "name":        "Starter",
        "credits":     50,
        "price_ngn":   1500,
        "price_kobo":  150_000,
        "description": "50 credits — great for trying Sofia out",
        "popular":     False,
    },
    {
        "id":          "pro",
        "name":        "Pro",
        "credits":     200,
        "price_ngn":   2000,
        "price_kobo":  200_000,
        "description": "200 credits — for active job seekers",
        "popular":     True,
    },
    {
        "id":          "business_500",
        "name":        "Business 500",
        "credits":     500,
        "price_ngn":   10_000,
        "price_kobo":  1_000_000,
        "description": "500 credits — for power users and teams",
        "popular":     False,
    },
    {
        "id":          "business_1000",
        "name":        "Business 1000",
        "credits":     1000,
        "price_ngn":   15_000,
        "price_kobo":  1_500_000,
        "description": "1000 credits — best value for heavy usage",
        "popular":     False,
    },
]

# --------------------------------------------------------------------------- #
#  CURRENCY CONVERSION                                                         #
# --------------------------------------------------------------------------- #
FX_RATES = {
    "NGN": 1,
    "USD": 0.00065,
    "GBP": 0.00051,
    "EUR": 0.00060,
    "GHS": 0.0091,
    "KES": 0.085,
    "ZAR": 0.012,
    "CAD": 0.00088,
}
CURRENCY_SYMBOLS = {
    "NGN": "₦", "USD": "$", "GBP": "£", "EUR": "€",
    "GHS": "₵", "KES": "KSh", "ZAR": "R", "CAD": "CA$",
}

def _convert_price(ngn_amount: int, currency: str) -> dict:
    currency = currency.upper()
    rate      = FX_RATES.get(currency, 1)
    converted = round(ngn_amount * rate, 2)
    symbol    = CURRENCY_SYMBOLS.get(currency, currency + " ")
    return {
        "currency":  currency,
        "amount":    converted,
        "symbol":    symbol,
        "formatted": f"{symbol}{converted:,.2f}",
    }


# --------------------------------------------------------------------------- #
#  MONNIFY AUTH HELPER                                                         #
# --------------------------------------------------------------------------- #
_monnify_token       = None
_monnify_token_expiry = 0

def _get_monnify_token() -> str:
    """
    Fetch (or return cached) Monnify access token.
    Monnify uses Basic auth (API_KEY:SECRET) to get a bearer token.
    Tokens are valid for 1 hour — we cache and reuse.
    """
    import time
    global _monnify_token, _monnify_token_expiry

    if _monnify_token and time.time() < _monnify_token_expiry - 60:
        return _monnify_token

    credentials = base64.b64encode(
        f"{MONNIFY_API_KEY}:{MONNIFY_SECRET_KEY}".encode()
    ).decode()

    resp = requests.post(
        f"{MONNIFY_BASE}/api/v1/auth/login",
        headers={"Authorization": f"Basic {credentials}"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    if not data.get("requestSuccessful"):
        raise RuntimeError(f"Monnify auth failed: {data.get('responseMessage')}")

    _monnify_token        = data["responseBody"]["accessToken"]
    expires_in            = data["responseBody"].get("expiresIn", 3600)
    _monnify_token_expiry = time.time() + expires_in
    return _monnify_token


# --------------------------------------------------------------------------- #
#  ROUTE: GET /credits/packages                                                #
# --------------------------------------------------------------------------- #
def get_packages():
    """
    GET /credits/packages?currency=NGN
    Returns all packages with prices converted to the requested currency.
    """
    currency = request.args.get("currency", "NGN").upper()
    if currency not in FX_RATES:
        currency = "NGN"

    result = []
    for pkg in PACKAGES:
        p = dict(pkg)
        p["price"] = _convert_price(pkg["price_ngn"], currency)
        result.append(p)

    return jsonify({
        "packages":  result,
        "currency":  currency,
        "providers": ["paystack", "monnify"],
    }), 200


# --------------------------------------------------------------------------- #
#  ROUTE: POST /credits/initiate                                               #
# --------------------------------------------------------------------------- #
def initiate_payment():
    """
    POST /credits/initiate
    Body: {
        "package_id":    "pro",
        "provider":      "paystack" | "monnify",   (default: "paystack")
        "callback_url":  "https://..."
    }
    Auth: Bearer token required.
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required."}), 401

    data         = request.get_json(silent=True) or {}
    package_id   = data.get("package_id", "")
    provider     = data.get("provider", "paystack").lower()
    callback_url = data.get("callback_url", "http://localhost:3000/payment/callback")

    pkg = next((p for p in PACKAGES if p["id"] == package_id), None)
    if not pkg:
        return jsonify({"error": f"Unknown package '{package_id}'."}), 400

    if provider not in ("paystack", "monnify"):
        return jsonify({"error": "provider must be 'paystack' or 'monnify'."}), 400

    if provider == "paystack":
        return _initiate_paystack(user, pkg, callback_url)
    else:
        return _initiate_monnify(user, pkg, callback_url)


def _initiate_paystack(user, pkg, callback_url):
    if not PAYSTACK_SECRET:
        return jsonify({"error": "Paystack is not configured. Add PAYSTACK_SECRET_KEY to .env."}), 503

    payload = {
        "email":        user["email"],
        "amount":       pkg["price_kobo"],
        "currency":     "NGN",
        "callback_url": callback_url,
        "metadata": {
            "user_id":    str(user["id"]),
            "package_id": pkg["id"],
            "credits":    pkg["credits"],
        },
    }

    try:
        resp = requests.post(
            f"{PAYSTACK_BASE}/transaction/initialize",
            json=payload,
            headers={
                "Authorization": f"Bearer {PAYSTACK_SECRET}",
                "Content-Type":  "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        ps_data = resp.json()
    except requests.RequestException as e:
        log.error("Paystack initialize failed: %s", e)
        return jsonify({"error": "Could not reach Paystack. Try again."}), 502

    if not ps_data.get("status"):
        return jsonify({"error": ps_data.get("message", "Paystack error.")}), 400

    reference   = ps_data["data"]["reference"]
    payment_url = ps_data["data"]["authorization_url"]

    record_payment(
        user_id          = str(user["id"]),
        provider         = "paystack",
        provider_ref     = reference,
        amount_kobo      = pkg["price_kobo"],
        credits_to_grant = pkg["credits"],
    )

    log.info("Paystack initiated: user=%s pkg=%s ref=%s", user["id"], pkg["id"], reference)

    return jsonify({
        "provider":    "paystack",
        "payment_url": payment_url,
        "reference":   reference,
        "package":     pkg["name"],
        "credits":     pkg["credits"],
    }), 200


def _initiate_monnify(user, pkg, callback_url):
    if not MONNIFY_API_KEY or not MONNIFY_SECRET_KEY or not MONNIFY_CONTRACT:
        return jsonify({"error": "Monnify is not configured. Add MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE to .env."}), 503

    # Generate a unique reference
    reference = f"sofia-{uuid.uuid4().hex[:16]}"

    # Amount in Naira (Monnify uses full Naira, not kobo)
    amount_ngn = pkg["price_ngn"]

    try:
        token = _get_monnify_token()
        payload = {
            "amount":              amount_ngn,
            "customerName":        user["email"].split("@")[0],
            "customerEmail":       user["email"],
            "paymentReference":    reference,
            "paymentDescription":  f"Sofia {pkg['name']} — {pkg['credits']} credits",
            "currencyCode":        "NGN",
            "contractCode":        MONNIFY_CONTRACT,
            "redirectUrl":         callback_url,
            "paymentMethods":      ["CARD", "ACCOUNT_TRANSFER", "USSD", "PHONE_NUMBER"],
        }

        resp = requests.post(
            f"{MONNIFY_BASE}/api/v1/merchant/transactions/init-transaction",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type":  "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        mn_data = resp.json()
    except requests.RequestException as e:
        log.error("Monnify initialize failed: %s", e)
        return jsonify({"error": "Could not reach Monnify. Try again."}), 502

    if not mn_data.get("requestSuccessful"):
        return jsonify({"error": mn_data.get("responseMessage", "Monnify error.")}), 400

    payment_url = mn_data["responseBody"]["checkoutUrl"]

    record_payment(
        user_id          = str(user["id"]),
        provider         = "monnify",
        provider_ref     = reference,
        amount_kobo      = pkg["price_kobo"],
        credits_to_grant = pkg["credits"],
    )

    log.info("Monnify initiated: user=%s pkg=%s ref=%s", user["id"], pkg["id"], reference)

    return jsonify({
        "provider":    "monnify",
        "payment_url": payment_url,
        "reference":   reference,
        "package":     pkg["name"],
        "credits":     pkg["credits"],
    }), 200


# --------------------------------------------------------------------------- #
#  ROUTE: POST /credits/verify                                                 #
# --------------------------------------------------------------------------- #
def verify_payment():
    """
    POST /credits/verify
    Body: { "reference": "...", "provider": "paystack" | "monnify" }
    Auth: Bearer token required.

    Called by the frontend after the payment gateway redirects back.
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required."}), 401

    data      = request.get_json(silent=True) or {}
    reference = data.get("reference", "").strip()
    provider  = data.get("provider", "paystack").lower()

    if not reference:
        return jsonify({"error": "Payment reference is required."}), 400

    if provider == "paystack":
        return _verify_paystack(reference, user)
    elif provider == "monnify":
        return _verify_monnify(reference, user)
    else:
        return jsonify({"error": "provider must be 'paystack' or 'monnify'."}), 400


def _verify_paystack(reference, user):
    if not PAYSTACK_SECRET:
        return jsonify({"error": "Paystack is not configured."}), 503

    try:
        resp = requests.get(
            f"{PAYSTACK_BASE}/transaction/verify/{reference}",
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET}"},
            timeout=10,
        )
        resp.raise_for_status()
        ps_data = resp.json()
    except requests.RequestException as e:
        log.error("Paystack verify failed: %s", e)
        return jsonify({"error": "Could not verify payment. Try again."}), 502

    if not ps_data.get("status"):
        return jsonify({"error": "Payment verification failed."}), 400

    tx = ps_data["data"]
    if tx["status"] != "success":
        return jsonify({"error": f"Payment not successful (status: {tx['status']})."}), 402

    return _grant_credits(reference, user)


def _verify_monnify(reference, user):
    if not MONNIFY_API_KEY or not MONNIFY_SECRET_KEY:
        return jsonify({"error": "Monnify is not configured."}), 503

    try:
        token = _get_monnify_token()
        # Monnify uses URL-encoded reference for verification
        encoded_ref = requests.utils.quote(reference, safe="")
        resp = requests.get(
            f"{MONNIFY_BASE}/api/v2/merchant/transactions/query?paymentReference={encoded_ref}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        mn_data = resp.json()
    except requests.RequestException as e:
        log.error("Monnify verify failed: %s", e)
        return jsonify({"error": "Could not verify payment. Try again."}), 502

    if not mn_data.get("requestSuccessful"):
        return jsonify({"error": "Monnify verification failed."}), 400

    status = mn_data["responseBody"].get("paymentStatus", "")
    if status != "PAID":
        return jsonify({"error": f"Payment not successful (status: {status})."}), 402

    return _grant_credits(reference, user)


def _grant_credits(reference, user):
    """Shared credit-granting logic used by both providers after successful verification."""
    try:
        confirm_payment(reference)
    except ValueError as e:
        log.info("Duplicate confirmation ignored: %s", e)

    fresh_user = get_user_by_id(str(user["id"]))
    return jsonify({
        "message": "Payment confirmed. Credits added to your account.",
        "credits": fresh_user["credits"],
    }), 200


# --------------------------------------------------------------------------- #
#  ROUTE: POST /credits/webhook/paystack                                       #
# --------------------------------------------------------------------------- #
def paystack_webhook():
    """
    Paystack calls this server-to-server on charge.success events.
    Verified with HMAC-SHA512.
    """
    signature = request.headers.get("x-paystack-signature", "")
    body      = request.get_data()

    expected = hmac.new(
        PAYSTACK_SECRET.encode(), body, hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        log.warning("Paystack webhook: invalid signature.")
        return jsonify({"error": "Invalid signature."}), 400

    event = json.loads(body)
    if event.get("event") != "charge.success":
        return jsonify({"status": "ignored"}), 200

    reference = event["data"]["reference"]
    try:
        confirm_payment(reference)
        log.info("Paystack webhook confirmed: %s", reference)
    except ValueError as e:
        log.info("Paystack webhook duplicate ignored: %s", e)

    return jsonify({"status": "ok"}), 200


# --------------------------------------------------------------------------- #
#  ROUTE: POST /credits/webhook/monnify                                        #
# --------------------------------------------------------------------------- #
def monnify_webhook():
    """
    Monnify calls this server-to-server on successful payment events.
    Verified with HMAC-SHA512 using the Monnify secret key.

    Monnify signs the payload as:
        HMAC-SHA512(secret_key, request_body)
    sent in the header: monnify-signature
    """
    signature = request.headers.get("monnify-signature", "")
    body      = request.get_data()

    if MONNIFY_SECRET_KEY:
        expected = hmac.new(
            MONNIFY_SECRET_KEY.encode(), body, hashlib.sha512
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            log.warning("Monnify webhook: invalid signature.")
            return jsonify({"error": "Invalid signature."}), 400

    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON."}), 400

    # Monnify sends eventType: "SUCCESSFUL_TRANSACTION"
    event_type = event.get("eventType", "")
    if event_type != "SUCCESSFUL_TRANSACTION":
        return jsonify({"status": "ignored"}), 200

    event_data  = event.get("eventData", {})
    reference   = event_data.get("paymentReference", "")
    pay_status  = event_data.get("paymentStatus", "")

    if pay_status != "PAID" or not reference:
        return jsonify({"status": "ignored"}), 200

    try:
        confirm_payment(reference)
        log.info("Monnify webhook confirmed: %s", reference)
    except ValueError as e:
        log.info("Monnify webhook duplicate ignored: %s", e)

    return jsonify({"status": "ok"}), 200