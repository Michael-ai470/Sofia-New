"""
db/database.py — Sofia persistent storage layer (MySQL/MariaDB version).

Replaces the PostgreSQL/psycopg2 version.
Uses mysql-connector-python for cPanel MySQL compatibility.

Environment variables (.env):
    MYSQL_HOST      your cPanel MySQL host (e.g. localhost or ares.mycpanel.net)
    MYSQL_PORT      3306 (default)
    MYSQL_USER      your cPanel MySQL username (e.g. jsfasmac_sofia)
    MYSQL_PASSWORD  your MySQL password
    MYSQL_DATABASE  your database name (e.g. jsfasmac_Sofia)

Or use a single DATABASE_URL:
    DATABASE_URL=mysql://user:password@host:3306/dbname
"""

import logging
import os
import pathlib
import uuid
from contextlib import contextmanager

import mysql.connector
from mysql.connector import pooling, errors
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("sofia.db")

# --------------------------------------------------------------------------- #
#  CONFIG                                                                      #
# --------------------------------------------------------------------------- #
def _parse_config():
    """
    Build MySQL connection config from environment variables.
    Supports both DATABASE_URL and individual MYSQL_* variables.
    """
    db_url = os.environ.get("DATABASE_URL", "")

    if db_url and db_url.startswith("mysql"):
        # Parse mysql://user:password@host:port/dbname
        import re
        m = re.match(r"mysql(?:\+\w+)?://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)", db_url)
        if m:
            return {
                "user":     m.group(1),
                "password": m.group(2),
                "host":     m.group(3),
                "port":     int(m.group(4) or 3306),
                "database": m.group(5).split("?")[0],
            }

    return {
        "host":     os.environ.get("MYSQL_HOST", "localhost"),
        "port":     int(os.environ.get("MYSQL_PORT", "3306")),
        "user":     os.environ.get("MYSQL_USER", ""),
        "password": os.environ.get("MYSQL_PASSWORD", ""),
        "database": os.environ.get("MYSQL_DATABASE", ""),
    }


# --------------------------------------------------------------------------- #
#  CONNECTION POOL                                                             #
# --------------------------------------------------------------------------- #
_pool = None

def _get_pool():
    global _pool
    if _pool is None:
        cfg = _parse_config()
        if not cfg["user"] or not cfg["database"]:
            raise RuntimeError(
                "MySQL is not configured. Add MYSQL_HOST, MYSQL_USER, "
                "MYSQL_PASSWORD, MYSQL_DATABASE to your .env file."
            )
        _pool = pooling.MySQLConnectionPool(
            pool_name="sofia",
            pool_size=5,
            pool_reset_session=True,
            **cfg,
        )
        log.info("MySQL connection pool initialised (host=%s db=%s)", cfg["host"], cfg["database"])
    return _pool


@contextmanager
def get_db():
    """
    Yield a MySQL connection from the pool.
    Commits on clean exit, rolls back on exception.
    """
    pool = _get_pool()
    conn = pool.get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
#  MIGRATIONS                                                                  #
# --------------------------------------------------------------------------- #
def init_db():
    """
    Run schema.sql against the connected MySQL database.
    Safe to call on every startup.
    """
    schema_path = pathlib.Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text()

    # Split on semicolons and run each statement separately
    # (MySQL connector doesn't support multi-statement execution by default)
    statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]

    with get_db() as conn:
        cursor = conn.cursor()
        for stmt in statements:
            if stmt:
                try:
                    cursor.execute(stmt)
                except errors.DatabaseError as e:
                    # Ignore "duplicate index" errors on re-run
                    if "Duplicate key name" in str(e):
                        pass
                    else:
                        raise
        cursor.close()

    log.info("MySQL schema initialised (schema.sql applied).")


# --------------------------------------------------------------------------- #
#  CUSTOM ERRORS                                                               #
# --------------------------------------------------------------------------- #
class CreditError(Exception):
    def __init__(self, message: str, status: int = 402):
        super().__init__(message)
        self.status = status


# --------------------------------------------------------------------------- #
#  USER OPERATIONS                                                             #
# --------------------------------------------------------------------------- #
def create_user(email: str, password_hash: str, tier: str = "free") -> dict:
    """
    Insert a new user and seed their credit balance.
    Returns the user dict.
    Raises mysql.connector.errors.IntegrityError if email already exists.
    """
    user_id = str(uuid.uuid4())

    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)

        # Get signup credits for this tier
        cursor.execute(
            "SELECT signup_credits, unlimited FROM subscription_tiers WHERE tier_name = %s",
            (tier,)
        )
        tier_row = cursor.fetchone()
        signup_credits = tier_row["signup_credits"] if tier_row else 0
        unlimited      = bool(tier_row["unlimited"])  if tier_row else False

        # Insert user
        cursor.execute(
            """
            INSERT INTO users (id, email, password_hash, tier, unlimited)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, email.lower().strip(), password_hash, tier, unlimited)
        )

        # Seed credit balance
        cursor.execute(
            "INSERT INTO credit_balances (user_id, balance) VALUES (%s, %s)",
            (user_id, signup_credits)
        )

        # Audit trail
        if signup_credits > 0:
            txn_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO credit_transactions (id, user_id, amount, reason, balance_after)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (txn_id, user_id, signup_credits, "signup-grant", signup_credits)
            )

        cursor.close()

    log.info("Created user %s (tier=%s, credits=%s)", user_id, tier, signup_credits)
    return {
        "id":        user_id,
        "email":     email.lower().strip(),
        "tier":      tier,
        "unlimited": unlimited,
        "is_active": True,
    }


def get_user_by_email(email: str) -> dict | None:
    """Return user row + current credit balance, or None if not found."""
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT u.*, cb.balance AS credits
            FROM   users u
            JOIN   credit_balances cb ON cb.user_id = u.id
            WHERE  u.email = %s AND u.is_active = 1
            """,
            (email.lower().strip(),)
        )
        row = cursor.fetchone()
        cursor.close()
        if row:
            row["unlimited"] = bool(row["unlimited"])
            row["is_active"] = bool(row["is_active"])
        return row


def get_user_by_id(user_id: str) -> dict | None:
    """Return user row + current credit balance, or None if not found."""
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT u.*, cb.balance AS credits
            FROM   users u
            JOIN   credit_balances cb ON cb.user_id = u.id
            WHERE  u.id = %s AND u.is_active = 1
            """,
            (user_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        if row:
            row["unlimited"] = bool(row["unlimited"])
            row["is_active"] = bool(row["is_active"])
        return row


# --------------------------------------------------------------------------- #
#  CREDIT OPERATIONS                                                           #
# --------------------------------------------------------------------------- #
def deduct_credits(user_id: str, amount: int, reason: str) -> int:
    """
    Atomically deduct `amount` credits from user_id's balance.
    Uses SELECT ... FOR UPDATE to prevent double-spend.
    Returns new balance. Raises CreditError if insufficient.
    """
    if amount <= 0:
        raise ValueError(f"deduct_credits: amount must be positive, got {amount}")

    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)

        # Lock the row
        cursor.execute(
            "SELECT balance FROM credit_balances WHERE user_id = %s FOR UPDATE",
            (user_id,)
        )
        row = cursor.fetchone()
        if row is None:
            raise CreditError("Credit balance record not found.", status=500)

        current = row["balance"]
        if current < amount:
            raise CreditError(
                f"Insufficient credits. You need {amount} but have {current}.",
                status=402,
            )

        new_balance = current - amount
        cursor.execute(
            "UPDATE credit_balances SET balance = %s WHERE user_id = %s",
            (new_balance, user_id)
        )

        txn_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO credit_transactions (id, user_id, amount, reason, balance_after)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (txn_id, user_id, -amount, reason, new_balance)
        )
        cursor.close()

    log.info("Deducted %s credits from user %s (%s). Balance now %s.", amount, user_id, reason, new_balance)
    return new_balance


def refund_credits(user_id: str, amount: int, reason: str = "refund") -> int:
    """Add credits back after a failed AI call."""
    return add_credits(user_id, amount, reason)


def add_credits(user_id: str, amount: int, reason: str) -> int:
    """Add `amount` credits to user's balance. Returns new balance."""
    if amount <= 0:
        raise ValueError(f"add_credits: amount must be positive, got {amount}")

    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "UPDATE credit_balances SET balance = balance + %s WHERE user_id = %s",
            (amount, user_id)
        )
        cursor.execute(
            "SELECT balance FROM credit_balances WHERE user_id = %s",
            (user_id,)
        )
        row = cursor.fetchone()
        if row is None:
            raise RuntimeError(f"No credit_balances row for user {user_id}")

        new_balance = row["balance"]
        txn_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO credit_transactions (id, user_id, amount, reason, balance_after)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (txn_id, user_id, amount, reason, new_balance)
        )
        cursor.close()

    log.info("Added %s credits to user %s (%s). Balance now %s.", amount, user_id, reason, new_balance)
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
    """Insert a pending payment_orders row."""
    order_id = str(uuid.uuid4())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO payment_orders
                (id, user_id, provider, provider_ref, amount_kobo, credits_to_grant, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending')
            """,
            (order_id, user_id, provider, provider_ref, amount_kobo, credits_to_grant)
        )
        cursor.close()

    log.info("Payment order created: %s (%s ref=%s)", order_id, provider, provider_ref)
    return {
        "id": order_id, "user_id": user_id, "provider": provider,
        "provider_ref": provider_ref, "status": "pending",
        "credits_to_grant": credits_to_grant,
    }


def confirm_payment(provider_ref: str) -> dict:
    """
    Mark a payment_orders row as 'success' and top up the user's credits.
    Everything in a single transaction.
    Raises ValueError if order not found or already confirmed.
    """
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)

        # Fetch and lock the order
        cursor.execute(
            "SELECT * FROM payment_orders WHERE provider_ref = %s FOR UPDATE",
            (provider_ref,)
        )
        order = cursor.fetchone()
        if order is None:
            raise ValueError(f"Payment order not found: {provider_ref}")
        if order["status"] == "success":
            raise ValueError(f"Payment {provider_ref} already confirmed.")

        user_id  = order["user_id"]
        credits  = order["credits_to_grant"]

        # Top up credits
        cursor.execute(
            "UPDATE credit_balances SET balance = balance + %s WHERE user_id = %s",
            (credits, user_id)
        )
        cursor.execute(
            "SELECT balance FROM credit_balances WHERE user_id = %s",
            (user_id,)
        )
        new_balance = cursor.fetchone()["balance"]

        # Audit trail
        txn_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO credit_transactions (id, user_id, amount, reason, balance_after)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (txn_id, user_id, credits, f"{order['provider']}-topup", new_balance)
        )

        # Mark order success
        cursor.execute(
            "UPDATE payment_orders SET status = 'success' WHERE provider_ref = %s",
            (provider_ref,)
        )
        cursor.close()

    log.info("Payment confirmed: %s. Granted %s credits to user %s.", provider_ref, credits, user_id)
    order["status"] = "success"
    return order
