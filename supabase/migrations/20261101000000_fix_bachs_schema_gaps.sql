-- =========================================================================
-- Fix Bachs Schema Gaps (Idempotent)
-- Date: 2026-11-01
-- Description:
--   Ensures all Bachs billing columns and constraints are present,
--   regardless of prior migration state. Safe to re-run.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. payment_transactions — ensure bachs columns and constraints exist
-- -------------------------------------------------------------------------

ALTER TABLE public.payment_transactions 
  DROP CONSTRAINT IF EXISTS payment_transactions_provider_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_provider_check
  CHECK (provider IN ('bachs', 'paystack', 'flutterwave', 'manual'));

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS charge_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS checkout_url TEXT;

ALTER TABLE public.payment_transactions
  ALTER COLUMN currency SET DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_checkout_id
  ON public.payment_transactions(checkout_id)
  WHERE checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_charge_id
  ON public.payment_transactions(charge_id)
  WHERE charge_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. subscriptions — ensure bachs columns and constraints exist
-- -------------------------------------------------------------------------

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_payment_provider_check;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS bachs_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS bachs_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS bachs_product_id TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'bachs',
  ADD COLUMN IF NOT EXISTS billing_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_payment_provider_check
  CHECK (payment_provider IN ('bachs', 'manual', 'paystack', 'flutterwave'));

UPDATE public.subscriptions
SET 
  payment_provider = 'bachs',
  provider = 'bachs',
  billing_currency = 'USD'
WHERE payment_provider IS NULL OR payment_provider NOT IN ('bachs', 'manual', 'paystack', 'flutterwave');

CREATE INDEX IF NOT EXISTS idx_subscriptions_bachs_customer_id
  ON public.subscriptions(bachs_customer_id)
  WHERE bachs_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_bachs_subscription_id
  ON public.subscriptions(bachs_subscription_id)
  WHERE bachs_subscription_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 3. webhook_events — ensure status column and constraints exist
-- -------------------------------------------------------------------------

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_details TEXT;

ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_status_check;

ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_status_check
  CHECK (status IN ('pending', 'processed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status ON public.webhook_events(provider, status);

-- -------------------------------------------------------------------------
-- 4. Update platform_settings to USD and Bachs
-- -------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'billing',
  '{"currency": "USD", "currency_symbol": "$", "default_payment_provider": "bachs"}'::jsonb,
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(public.platform_settings.value, '{}'::jsonb),
      '{currency}', '"USD"'
    ),
    '{currency_symbol}', '"$"'
  ),
  '{default_payment_provider}', '"bachs"'
),
updated_at = now();
