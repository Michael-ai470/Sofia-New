"""
auth.py — Authentication for Sofia.

Provides:
    signup()         POST /auth/signup  — create account, return JWT
    login()          POST /auth/login   — verify credentials, return JWT
    lookup_user()    Replace the stub in app.py — decode JWT, fetch user from DB
    get_current_user() — helper for routes that need the caller's identity

Environment variables (in .env):
    JWT_SECRET          Strong random string. Generate:
                        python -c "import secrets; print(secrets.token_hex(32))"
    JWT_EXPIRY_HOURS    How long a token lives (default: 24)
"""

import logging
import os

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from flask import request, jsonify
from dotenv import load_dotenv
from email_validator import validate_email, EmailNotValidError

load_dotenv()

from db import create_user, get_user_by_email, get_user_by_id

log = logging.getLogger("sofia.auth")

# --------------------------------------------------------------------------- #
#  CONFIG                                                                      #
# --------------------------------------------------------------------------- #
JWT_SECRET = os.environ.get("JWT_SECRET", "").strip()
JWT_EXPIRY = int(os.environ.get("JWT_EXPIRY_HOURS", "24"))

if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set.\n"
        "Add it to your .env file. Generate one with:\n"
        "  python -c \"import secrets; print(secrets.token_hex(32))\""
    )


# --------------------------------------------------------------------------- #
#  TOKEN HELPERS                                                               #
# --------------------------------------------------------------------------- #
def _make_token(user_id: str) -> str:
    """Issue a signed JWT for user_id."""
    payload = {
        "sub": str(user_id),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _decode_token(token: str) -> str | None:
    """
    Decode and verify a JWT.
    Returns the user_id string on success, None on any failure
    (expired, tampered, missing, wrong secret).
    """
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        log.debug("Token expired.")
        return None
    except jwt.PyJWTError as e:
        log.debug("Token invalid: %s", e)
        return None


def _extract_token_from_request() -> str:
    """
    Pull the Bearer token from the Authorization header.
    Returns empty string if not present.
    """
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer "):].strip()
    return ""


# --------------------------------------------------------------------------- #
#  PUBLIC INTERFACE                                                            #
# --------------------------------------------------------------------------- #
def lookup_user(token: str) -> dict | None:
    """
    Replace the stub in app.py with this function.

    Decodes the JWT, fetches the full user row (including live credit
    balance) from Postgres, and returns it as a dict.

    Returns None if:
      - token is missing or empty
      - token is expired or tampered
      - user_id in token does not exist in the database
      - user account has been deactivated

    The returned dict shape matches what require_credits() and
    user_is_paid() in app.py expect:
      {
        "id":        UUID,
        "email":     str,
        "tier":      "free" | "starter" | "pro" | "business",
        "credits":   int,
        "unlimited": bool,
        ...
      }
    """
    user_id = _decode_token(token)
    if not user_id:
        return None
    return get_user_by_id(user_id)


def get_current_user() -> dict | None:
    """
    Convenience helper for routes that need the caller's identity.
    Reads the token directly from the current request's Authorization header.

    Usage inside a Flask route:
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required."}), 401
    """
    return lookup_user(_extract_token_from_request())


# --------------------------------------------------------------------------- #
#  ROUTE HANDLERS                                                              #
# --------------------------------------------------------------------------- #
def signup():
    """
    POST /auth/signup
    Body: { "email": "...", "password": "..." }

    Creates a new account (free tier, 5 signup credits).
    Returns a JWT token on success.
    """
    data     = request.get_json(silent=True) or {}
    email    = data.get("email",    "").strip().lower()
    password = data.get("password", "").strip()

    # Basic validation
    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    # Strict email validation
    try:
        valid = validate_email(email, check_deliverability=False)
        email = valid.normalized  # use the normalised form
    except EmailNotValidError as e:
        return jsonify({"error": str(e)}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    # Hash the password — bcrypt handles salting automatically
    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    try:
        user = create_user(email, password_hash, tier="free")
    except Exception:
        # UniqueViolation from Postgres — email already registered
        return jsonify({"error": "An account with that email already exists."}), 409

    token = _make_token(str(user["id"]))
    log.info("New account created: %s", email)

    return jsonify({
        "token":   token,
        "tier":    user["tier"],
        "credits": 5,
        "message": "Account created successfully.",
    }), 201


def login():
    """
    POST /auth/login
    Body: { "email": "...", "password": "..." }

    Verifies credentials and returns a fresh JWT token.
    """
    data     = request.get_json(silent=True) or {}
    email    = data.get("email",    "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = get_user_by_email(email)

    # Use the same error message whether the email or password is wrong —
    # never tell an attacker which one failed.
    if not user:
        return jsonify({"error": "Invalid email or password."}), 401

    password_matches = bcrypt.checkpw(
        password.encode("utf-8"),
        user["password_hash"].encode("utf-8"),
    )
    if not password_matches:
        return jsonify({"error": "Invalid email or password."}), 401

    token = _make_token(str(user["id"]))
    log.info("User logged in: %s", email)

    return jsonify({
        "token":     token,
        "tier":      user["tier"],
        "credits":   user["credits"],
        "unlimited": user["unlimited"],
    }), 200


def get_me():
    """
    GET /auth/me
    Returns the current user's profile and live credit balance.
    Useful for the frontend to refresh credits after a purchase.
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required."}), 401

    return jsonify({
        "id":        str(user["id"]),
        "email":     user["email"],
        "tier":      user["tier"],
        "credits":   user["credits"],
        "unlimited": user["unlimited"],
    }), 200