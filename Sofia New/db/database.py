"""
db/database.py — Sofia persistent storage layer.

Provides:
    init_db()          Run the schema migration (safe to call on every startup).
    get_db()           Return a connection from the pool (use as context manager).
    create_user()      Insert a new user + seed their credit balance.
    get_user_by_email()
    get_user_by_id()
    deduct_credits()   Atomic deduction with FOR UPDATE row-lock. Raises CreditError on
                       insufficient funds. Writes audit row to credit_transactions.
    refund_credits()   Adds credits back (used on AI-call failure after charge).
    add_credits()      Top up a user's balance (called after successful payment).
    record_payment()   Insert a payment_orders row.
    confirm_payment()  Mark order as success and call add_credits() in one transaction.

Environment variables (add to .env):
    DATABASE_URL   postgresql://user:password@host:5432/sofia_db
"""

import logging
import os
import pathlib
from contextlib import contextmanager

import psycopg2
import psycopg2.pool
import psycopg2.extras   # RealDictCursor

log = logging.getLogger("sofia.db")

# --------------------------------------------------------------------------- #
#  CONNECTION POOL                                                             #
# --------------------------------------------------------------------------- #
_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        dsn = os.environ.get("DATABASE_URL", "")
        if not dsn:
            raise RuntimeError(
                "DATABASE_URL is not set. Add it to your .env file.\n"
                "Example: DATABASE_URL=postgresql://sofia:password@localhost:5432/sofia_db"
            )
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=dsn,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        log.info("Database connection pool initialised.")
    return _pool


@contextmanager
def get_db():
    """
    Yield a psycopg2 connection from the pool.
    Commits on clean exit, rolls back on exception, always returns conn to pool.

    Usage:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT ...")
    """
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


# --------------------------------------------------------------------------- #
#  MIGRATIONS                                                                  #
# --------------------------------------------------------------------------- #
def init_db():
    """
    Run schema.sql against the connected database.
    Safe to call on every app start — all DDL uses IF NOT EXISTS / ON CONFLICT.
    """
    schema_path = pathlib.Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
    log.info("Database schema initialised (schema.sql applied).")


# --------------------------------------------------------------------------- #
#  USER OPERATIONS                                                             #
# --------------------------------------------------------------------------- #
def create_user(email: str, password_hash: str, tier: str = "free") -> dict:
    """
    Insert a new user and seed their credit balance from the tier definition.
    Returns the full user row as a dict.
    Raises psycopg2.errors.UniqueViolation if the email already exists.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            # Look up signup credits for this tier
            cur.execute(
                "SELECT signup_credits, unlimited FROM subscription_tiers WHERE tier_name = %s",
                (tier,)
            )
            tier_row = cur.fetchone()
            signup_credits = tier_row["signup_credits"] if tier_row else 0
            unlimited      = tier_row["unlimited"]      if tier_row else False

            # Insert user
            cur.execute(
                """
                INSERT INTO users (email, password_hash, tier, unlimited)
                VALUES (%s, %s, %s, %s)
                RETURNING *
                """,
                (email.lower().strip(), password_hash, tier, unlimited)
            )
            user = dict(cur.fetchone())

            # Seed credit balance
            cur.execute(
                """
                INSERT INTO credit_balances (user_id, balance)
                VALUES (%s, %s)
                """,
                (user["id"], signup_credits)
            )

            # Record the signup credit grant in audit log
            if signup_credits > 0:
                cur.execute(
                    """
                    INSERT INTO credit_transactions
                        (user_id, amount, reason, balance_after)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user["id"], signup_credits, "signup-grant", signup_credits)
                )

            log.info("Created user %s (tier=%s, credits=%s)", user["id"], tier, signup_credits)
            return user


def get_user_by_email(email: str) -> dict | None:
    """Return user row + current credit balance, or None if not found."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.*, cb.balance AS credits
                FROM   users u
                JOIN   credit_balances cb ON cb.user_id = u.id
                WHERE  u.email = %s AND u.is_active = TRUE
                """,
                (email.lower().strip(),)
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    """Return user row + current credit balance, or None if not found."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.*, cb.balance AS credits
                FROM   users u
                JOIN   credit_balances cb ON cb.user_id = u.id
                WHERE  u.id = %s AND u.is_active = TRUE
                """,
                (user_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None


# --------------------------------------------------------------------------- #
#  CREDIT OPERATIONS                                                           #
# --------------------------------------------------------------------------- #
class CreditError(Exception):
    """Raised when credit deduction fails (insufficient balance or auth issue)."""
    def __init__(self, message: str, status: int = 402):
        super().__init__(message)
        self.status = status


def deduct_credits(user_id: str, amount: int, reason: str) -> int:
    """
    Atomically deduct `amount` credits from user_id's balance.

    Uses SELECT ... FOR UPDATE to lock the row — prevents double-spend when
    two requests from the same user arrive simultaneously.

    Returns the new balance after deduction.
    Raises CreditError if the balance is insufficient.
    """
    if amount <= 0:
        raise ValueError(f"deduct_credits: amount must be positive, got {amount}")

    with get_db() as conn:
        with conn.cursor() as cur:
            # Lock this user's balance row for the duration of the transaction
            cur.execute(
                "SELECT balance FROM credit_balances WHERE user_id = %s FOR UPDATE",
                (user_id,)
            )
            row = cur.fetchone()
            if row is None:
                raise CreditError("Credit balance record not found.", status=500)

            current = row["balance"]
            if current < amount:
                raise CreditError(
                    f"Insufficient credits. You need {amount} but have {current}.",
                    status=402,
                )

            new_balance = current - amount
            cur.execute(
                "UPDATE credit_balances SET balance = %s WHERE user_id = %s",
                (new_balance, user_id)
            )
            cur.execute(
                """
                INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, -amount, reason, new_balance)
            )

    log.info("Deducted %s credits from user %s (%s). Balance now %s.",
             amount, user_id, reason, new_balance)
    return new_balance


def refund_credits(user_id: str, amount: int, reason: str = "refund") -> int:
    """
    Add `amount` credits back to a user's balance.
    Called when an AI route charges first and then the AI call fails.
    Returns the new balance.
    """
    return add_credits(user_id, amount, reason)


def add_credits(user_id: str, amount: int, reason: str) -> int:
    """
    Add `amount` credits to a user's balance (top-up after payment, refund, or promo).
    Returns the new balance.
    """
    if amount <= 0:
        raise ValueError(f"add_credits: amount must be positive, got {amount}")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE credit_balances
                SET    balance = balance + %s
                WHERE  user_id = %s
                RETURNING balance
                """,
                (amount, user_id)
            )
            row = cur.fetchone()
            if row is None:
                raise RuntimeError(f"No credit_balances row for user {user_id}")

            new_balance = row["balance"]
            cur.execute(
                """
                INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, amount, reason, new_balance)
            )

    log.info("Added %s credits to user %s (%s). Balance now %s.",
             amount, user_id, reason, new_balance)
    return new_balance


# --------------------------------------------------------------------------- #
#  PAYMENT OPERATIONS                                                          #
# --------------------------------------------------------------------------- #
def record_payment(
    user_id: str,
    provider: str,
    provider_ref: str,
    amount_kobo: int,
    credits_to_grant: int,
) -> dict:
    """
    Insert a pending payment_orders row when a user initiates checkout.
    Returns the order row as a dict.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO payment_orders
                    (user_id, provider, provider_ref, amount_kobo, credits_to_grant, status)
                VALUES (%s, %s, %s, %s, %s, 'pending')
                RETURNING *
                """,
                (user_id, provider, provider_ref, amount_kobo, credits_to_grant)
            )
            order = dict(cur.fetchone())
    log.info("Payment order created: %s (%s ref=%s)", order["id"], provider, provider_ref)
    return order


def confirm_payment(provider_ref: str) -> dict:
    """
    Mark a payment_orders row as 'success' and top up the user's credits.
    Everything happens in a single transaction — if the credit update fails,
    the order stays 'pending' so you can retry.
    Returns the completed order row.
    Raises ValueError if the order is not found or already completed.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            # Fetch and lock the order
            cur.execute(
                """
                SELECT * FROM payment_orders
                WHERE provider_ref = %s FOR UPDATE
                """,
                (provider_ref,)
            )
            order = cur.fetchone()
            if order is None:
                raise ValueError(f"Payment order not found: {provider_ref}")
            if order["status"] == "success":
                raise ValueError(f"Payment {provider_ref} already confirmed — ignoring duplicate webhook.")

            user_id         = order["user_id"]
            credits         = order["credits_to_grant"]

            # Top up credits (inside the same transaction)
            cur.execute(
                """
                UPDATE credit_balances
                SET    balance = balance + %s
                WHERE  user_id = %s
                RETURNING balance
                """,
                (credits, user_id)
            )
            new_balance = cur.fetchone()["balance"]

            # Audit trail
            cur.execute(
                """
                INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, credits, f"{order['provider']}-topup", new_balance)
            )

            # Mark order success
            cur.execute(
                """
                UPDATE payment_orders SET status = 'success'
                WHERE provider_ref = %s
                RETURNING *
                """,
                (provider_ref,)
            )
            completed = dict(cur.fetchone())

    log.info("Payment confirmed: %s. Granted %s credits to user %s. Balance now %s.",
             provider_ref, credits, user_id, new_balance)
    return completed
