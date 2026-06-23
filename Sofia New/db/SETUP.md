# Sofia — Database Setup Guide

This guide walks from zero to a running Postgres database with all tables created
and the connection verified. Estimated time: 15–20 minutes.

---

## 1. Install Postgres (if not already installed)

**Ubuntu / Debian (including WSL):**
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:** Download the installer from https://www.postgresql.org/download/windows/

---

## 2. Create the database and user

```bash
# Open a Postgres shell as the superuser
sudo -u postgres psql

# Inside psql, run:
CREATE USER sofia WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE sofia_db OWNER sofia;
\q
```

> For production, use a password manager to generate a 32+ character random password.

---

## 3. Verify the connection

```bash
psql postgresql://sofia:your_strong_password_here@localhost:5432/sofia_db -c "SELECT 1;"
```

You should see `?column? → 1`. If you get a connection error, check that Postgres is
running (`sudo systemctl status postgresql`) and that the password matches.

---

## 4. Set up your .env file

```bash
# From the sofia/ project root
cp .env.example .env
```

Open `.env` and set:
```
DATABASE_URL=postgresql://sofia:your_strong_password_here@localhost:5432/sofia_db
```

---

## 5. Install Python dependencies

```bash
pip install psycopg2-binary PyJWT bcrypt python-dotenv
```

(These are in addition to the existing Sofia requirements.)

---

## 6. Run the schema migration

The migration is safe to run multiple times — all DDL uses `IF NOT EXISTS` and
`ON CONFLICT DO NOTHING`. Run it once now to create all tables:

```bash
# From the sofia/ project root
python -c "
from dotenv import load_dotenv
load_dotenv()
from db.database import init_db
init_db()
print('Schema applied successfully.')
"
```

Expected output:
```
Database connection pool initialised.
Database schema initialised (schema.sql applied).
Schema applied successfully.
```

---

## 7. Verify the tables exist

```bash
psql postgresql://sofia:your_password@localhost:5432/sofia_db -c "\dt"
```

You should see five tables:
```
 credit_balances
 credit_transactions
 payment_orders
 subscription_tiers
 users
```

Check that the tier seeds landed:
```bash
psql postgresql://sofia:your_password@localhost:5432/sofia_db \
  -c "SELECT tier_name, signup_credits, unlimited FROM subscription_tiers;"
```

Expected:
```
 tier_name | signup_credits | unlimited
-----------+----------------+-----------
 free      |              5 | f
 starter   |             50 | f
 pro       |            200 | f
 business  |              0 | t
```

---

## 8. Run the test suite

```bash
# Uses your DATABASE_URL from .env (tests run against sofia_db, not a separate test db)
pip install pytest --break-system-packages
python -m pytest db/test_database.py -v
```

All 17 tests should pass. If any fail, check:
- `DATABASE_URL` is correct in `.env`
- Postgres is running
- The schema migration ran (step 6)

---

## 9. Wire the DB into app.py (next task: Auth)

At the top of `app.py`, after the existing imports, add:

```python
from dotenv import load_dotenv
load_dotenv()

from db import (
    init_db, get_user_by_id, get_user_by_email,
    create_user, deduct_credits, refund_credits,
    add_credits, record_payment, confirm_payment,
    CreditError as DbCreditError,
)
```

And in your startup block (just before `app.run`), call:

```python
init_db()   # safe on every boot — applies schema if not already applied
```

Once auth is built, replace the `lookup_user` stub with `get_user_by_id`.
Once billing is built, replace `charge_credits` with `deduct_credits`.

---

## Table reference

| Table | Purpose |
|---|---|
| `users` | Account credentials, tier, active flag |
| `credit_balances` | Live credit count per user (row-locked on spend) |
| `subscription_tiers` | Lookup: signup credits and monthly allowances per tier |
| `credit_transactions` | Immutable audit trail — every debit, credit, refund |
| `payment_orders` | Paystack/Flutterwave payment records and webhook status |

---

## Production notes

- Use a managed Postgres service (AWS RDS, Supabase, Render, Railway) — don't run
  Postgres on the same VM as the app server in production.
- Set `DATABASE_URL` in your secret manager, not in a committed `.env` file.
- Enable SSL: `DATABASE_URL=postgresql://...?sslmode=require`
- The connection pool (`ThreadedConnectionPool`) defaults to min=1 max=10. Adjust
  `maxconn` based on your expected concurrent users.
