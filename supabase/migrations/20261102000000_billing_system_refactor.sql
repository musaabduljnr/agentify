-- =========================================================================
-- Agentify Production Billing System Refactor
-- Migration: 20261102000000_billing_system_refactor.sql
-- Description:
--   Authoritative Bachs USD subscription architecture.
--   Enforces USD currency, single source of truth in Supabase,
--   standardized statuses, idempotent transaction indexing, and secure RLS.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Subscriptions Table Schema & Constraints
-- -------------------------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS bachs_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS bachs_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS bachs_product_id TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'bachs',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'bachs',
  ADD COLUMN IF NOT EXISTS billing_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(10, 2) DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure default payment_provider is bachs
ALTER TABLE public.subscriptions
  ALTER COLUMN payment_provider SET DEFAULT 'bachs',
  ALTER COLUMN provider SET DEFAULT 'bachs',
  ALTER COLUMN billing_currency SET DEFAULT 'USD';

-- Clean up any residual non-bachs providers for active/pending subscriptions
UPDATE public.subscriptions
SET
  payment_provider = 'bachs',
  provider = 'bachs',
  billing_currency = 'USD'
WHERE payment_provider IS NULL OR payment_provider NOT IN ('bachs', 'manual');

-- Performance Indexes for Webhook & Client Reconciliation
CREATE INDEX IF NOT EXISTS idx_subscriptions_bachs_customer_id
  ON public.subscriptions(bachs_customer_id)
  WHERE bachs_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_bachs_subscription_id
  ON public.subscriptions(bachs_subscription_id)
  WHERE bachs_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_status
  ON public.subscriptions(business_id, status);

-- -------------------------------------------------------------------------
-- 2. Payment Transactions Table Schema & Constraints
-- -------------------------------------------------------------------------

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS charge_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_response JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.payment_transactions
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN provider SET DEFAULT 'bachs';

-- Index checkout_id and reference for sub-millisecond webhook and self-healing lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_checkout_id
  ON public.payment_transactions(checkout_id)
  WHERE checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference
  ON public.payment_transactions(reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_biz_status
  ON public.payment_transactions(business_id, status, created_at DESC);

-- -------------------------------------------------------------------------
-- 3. Webhook Events Table Schema & Constraints
-- -------------------------------------------------------------------------

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_details TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event
  ON public.webhook_events(provider, event_id);

-- -------------------------------------------------------------------------
-- 4. Authoritative Platform Settings (USD & Bachs Only)
-- -------------------------------------------------------------------------

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'billing',
  '{
    "currency": "USD",
    "currency_symbol": "$",
    "default_payment_provider": "bachs",
    "tax_rate": 0,
    "invoice_prefix": "AGT"
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = now();

-- -------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- -------------------------------------------------------------------------

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Subscriptions: Business owners can view their own subscription
DROP POLICY IF EXISTS "Users can view own business subscription" ON public.subscriptions;
CREATE POLICY "Users can view own business subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Payment Transactions: Business owners can view their transaction history
DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );
