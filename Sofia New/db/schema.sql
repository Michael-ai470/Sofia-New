-- Sofia Database Schema
-- Run this once against a fresh Postgres database to initialise all tables.
-- psql -U <user> -d <dbname> -f schema.sql

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()


-- ============================================================
-- USERS
-- Stores account credentials and subscription tier.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT        NOT NULL UNIQUE,
    password_hash  TEXT        NOT NULL,
    tier           TEXT        NOT NULL DEFAULT 'free'
                               CHECK (tier IN ('free', 'starter', 'pro', 'business')),
    unlimited      BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);


-- ============================================================
-- CREDIT BALANCES
-- One row per user. Balance is the live credit count.
-- Always updated inside a transaction with FOR UPDATE to prevent
-- double-spend (see database.py: deduct_credits).
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_balances (
    user_id    UUID        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    balance    INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SUBSCRIPTION TIERS  (reference / lookup table)
-- Defines how many credits each tier starts with on sign-up,
-- and any monthly top-up logic that billing can reference.
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
    tier_name        TEXT    PRIMARY KEY,
    display_name     TEXT    NOT NULL,
    signup_credits   INTEGER NOT NULL DEFAULT 0,
    monthly_credits  INTEGER NOT NULL DEFAULT 0,
    unlimited        BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed the tiers (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO subscription_tiers (tier_name, display_name, signup_credits, monthly_credits, unlimited)
VALUES
    ('free',     'Free',     5,   0,   FALSE),
    ('starter',  'Starter',  50,  50,  FALSE),
    ('pro',      'Pro',      200, 200, FALSE),
    ('business', 'Business', 0,   0,   TRUE)
ON CONFLICT (tier_name) DO NOTHING;


-- ============================================================
-- CREDIT TRANSACTIONS  (audit trail)
-- Every deduction, refund, or top-up is recorded here.
-- Useful for debugging double-spend issues and customer support.
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount      INTEGER     NOT NULL,   -- negative = debit, positive = credit
    reason      TEXT        NOT NULL,   -- e.g. 'rewrite-cv', 'paystack-topup', 'refund'
    balance_after INTEGER   NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_user_id ON credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_txn_created  ON credit_transactions (created_at DESC);


-- ============================================================
-- PAYMENT ORDERS  (Paystack / Flutterwave)
-- Tracks every payment attempt. Status updated by webhook.
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_orders (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider         TEXT        NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
    provider_ref     TEXT        UNIQUE,          -- Paystack reference / Flutterwave tx_ref
    amount_kobo      INTEGER     NOT NULL,        -- smallest currency unit (kobo for NGN)
    credits_to_grant INTEGER     NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'success', 'failed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id     ON payment_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider_ref ON payment_orders (provider_ref);


-- ============================================================
-- updated_at trigger (shared by all tables that use it)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to credit_balances
DROP TRIGGER IF EXISTS trg_balances_updated_at ON credit_balances;
CREATE TRIGGER trg_balances_updated_at
    BEFORE UPDATE ON credit_balances
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to payment_orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON payment_orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON payment_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
