"""
db/test_database.py — Verify the Sofia database layer against a live Postgres instance.

Run:
    DATABASE_URL=postgresql://user:pass@localhost:5432/sofia_test python -m pytest db/test_database.py -v

The test database is wiped and re-created between runs via the `clean_db` fixture,
so never point this at your production database.
"""

import os
import uuid
import pytest
import psycopg2

# Make sure the module can find its schema.sql sibling
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from db.database import (
    init_db, get_db,
    create_user, get_user_by_email, get_user_by_id,
    deduct_credits, refund_credits, add_credits,
    record_payment, confirm_payment,
    CreditError,
)


# --------------------------------------------------------------------------- #
#  FIXTURES                                                                    #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session", autouse=True)
def setup_schema():
    """Run the schema once for the entire test session."""
    init_db()


@pytest.fixture()
def clean_db():
    """Wipe all data between tests (order matters due to FK constraints)."""
    yield
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                TRUNCATE
                    credit_transactions,
                    payment_orders,
                    credit_balances,
                    users
                RESTART IDENTITY CASCADE
            """)


def make_email():
    return f"test_{uuid.uuid4().hex[:8]}@sofia.test"


# --------------------------------------------------------------------------- #
#  SCHEMA / CONNECTION                                                         #
# --------------------------------------------------------------------------- #
def test_connection():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            assert cur.fetchone()["ok"] == 1


def test_tables_exist():
    expected = {"users", "credit_balances", "subscription_tiers",
                "credit_transactions", "payment_orders"}
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
            """)
            found = {r["table_name"] for r in cur.fetchall()}
    assert expected.issubset(found), f"Missing tables: {expected - found}"


def test_tier_seeds_present():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT tier_name FROM subscription_tiers ORDER BY tier_name")
            tiers = [r["tier_name"] for r in cur.fetchall()]
    assert tiers == ["business", "free", "pro", "starter"]


# --------------------------------------------------------------------------- #
#  USER CREATION                                                               #
# --------------------------------------------------------------------------- #
def test_create_user_free(clean_db):
    user = create_user(make_email(), "hashed_pw", tier="free")
    assert user["tier"] == "free"
    assert user["unlimited"] is False

    # Credit balance seeded with 5 (free tier signup_credits)
    fetched = get_user_by_id(str(user["id"]))
    assert fetched["credits"] == 5


def test_create_user_pro(clean_db):
    user = create_user(make_email(), "hashed_pw", tier="pro")
    fetched = get_user_by_id(str(user["id"]))
    assert fetched["credits"] == 200


def test_create_user_business_unlimited(clean_db):
    user = create_user(make_email(), "hashed_pw", tier="business")
    assert user["unlimited"] is True


def test_duplicate_email_raises(clean_db):
    email = make_email()
    create_user(email, "pw1")
    with pytest.raises(psycopg2.errors.UniqueViolation):
        create_user(email, "pw2")


def test_get_user_by_email(clean_db):
    email = make_email()
    created = create_user(email, "pw")
    fetched = get_user_by_email(email)
    assert fetched is not None
    assert str(fetched["id"]) == str(created["id"])


def test_get_nonexistent_user_returns_none(clean_db):
    assert get_user_by_email("nobody@nowhere.test") is None
    assert get_user_by_id(str(uuid.uuid4())) is None


# --------------------------------------------------------------------------- #
#  CREDIT DEDUCTION                                                            #
# --------------------------------------------------------------------------- #
def test_deduct_credits_success(clean_db):
    user = create_user(make_email(), "pw", tier="pro")   # starts with 200
    uid = str(user["id"])
    new_bal = deduct_credits(uid, 2, "rewrite-cv")
    assert new_bal == 198

    fetched = get_user_by_id(uid)
    assert fetched["credits"] == 198


def test_deduct_credits_insufficient(clean_db):
    user = create_user(make_email(), "pw", tier="free")  # starts with 5
    uid = str(user["id"])
    with pytest.raises(CreditError) as exc_info:
        deduct_credits(uid, 10, "rewrite-cv")
    assert exc_info.value.status == 402
    # Balance unchanged
    assert get_user_by_id(uid)["credits"] == 5


def test_deduct_credits_exact_balance(clean_db):
    user = create_user(make_email(), "pw", tier="free")  # starts with 5
    uid = str(user["id"])
    new_bal = deduct_credits(uid, 5, "cover-letter")
    assert new_bal == 0
    assert get_user_by_id(uid)["credits"] == 0


def test_deduct_creates_audit_row(clean_db):
    user = create_user(make_email(), "pw", tier="pro")
    uid = str(user["id"])
    deduct_credits(uid, 5, "generate-plan")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM credit_transactions WHERE user_id = %s AND reason = 'generate-plan'",
                (uid,)
            )
            row = cur.fetchone()
    assert row is not None
    assert row["amount"] == -5
    assert row["balance_after"] == 195


# --------------------------------------------------------------------------- #
#  REFUND                                                                      #
# --------------------------------------------------------------------------- #
def test_refund_after_failed_ai_call(clean_db):
    user = create_user(make_email(), "pw", tier="pro")
    uid = str(user["id"])

    deduct_credits(uid, 2, "rewrite-cv")
    assert get_user_by_id(uid)["credits"] == 198

    refund_credits(uid, 2, "refund-rewrite-cv")
    assert get_user_by_id(uid)["credits"] == 200


# --------------------------------------------------------------------------- #
#  ADD CREDITS (TOP-UP)                                                        #
# --------------------------------------------------------------------------- #
def test_add_credits(clean_db):
    user = create_user(make_email(), "pw", tier="free")   # starts with 5
    uid = str(user["id"])
    new_bal = add_credits(uid, 50, "paystack-topup")
    assert new_bal == 55
    assert get_user_by_id(uid)["credits"] == 55


# --------------------------------------------------------------------------- #
#  PAYMENT ORDERS                                                              #
# --------------------------------------------------------------------------- #
def test_record_and_confirm_payment(clean_db):
    user = create_user(make_email(), "pw", tier="free")   # starts with 5
    uid = str(user["id"])
    ref = f"ps_{uuid.uuid4().hex}"

    order = record_payment(uid, "paystack", ref, amount_kobo=500_00, credits_to_grant=50)
    assert order["status"] == "pending"

    completed = confirm_payment(ref)
    assert completed["status"] == "success"
    assert get_user_by_id(uid)["credits"] == 55   # 5 signup + 50 purchased


def test_confirm_payment_duplicate_webhook_raises(clean_db):
    user = create_user(make_email(), "pw", tier="free")
    uid = str(user["id"])
    ref = f"ps_{uuid.uuid4().hex}"
    record_payment(uid, "paystack", ref, 500_00, 50)
    confirm_payment(ref)

    with pytest.raises(ValueError, match="already confirmed"):
        confirm_payment(ref)

    # Credits granted only once
    assert get_user_by_id(uid)["credits"] == 55


def test_confirm_unknown_payment_raises(clean_db):
    with pytest.raises(ValueError, match="not found"):
        confirm_payment("nonexistent_ref")


# --------------------------------------------------------------------------- #
#  DOUBLE-SPEND GUARD (sequential simulation)                                  #
# --------------------------------------------------------------------------- #
def test_sequential_deductions_cannot_overdraft(clean_db):
    """
    Simulate two rapid requests both trying to spend the last 2 credits.
    The second must fail, not overdraft.
    """
    user = create_user(make_email(), "pw", tier="free")   # starts with 5
    uid = str(user["id"])

    deduct_credits(uid, 4, "first-request")   # balance → 1
    assert get_user_by_id(uid)["credits"] == 1

    with pytest.raises(CreditError):
        deduct_credits(uid, 2, "second-request")  # must fail, only 1 left

    assert get_user_by_id(uid)["credits"] == 1   # unchanged
