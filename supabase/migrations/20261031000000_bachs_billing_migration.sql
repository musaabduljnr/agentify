-- =========================================================================
-- Bachs Billing Migration (USD Only)
-- Date: 2026-10-31
-- Description:
-- 1. Updates subscriptions table with Bachs specific columns (bachs_customer_id,
--    bachs_subscription_id, bachs_product_id, billing_currency, billing_amount).
-- 2. Updates payment_transactions table for Bachs checkout, charge, and invoice IDs.
-- 3. Enhances webhook_events table with status, received_at, processed_at, error_details.
-- 4. Updates platform_settings to USD as default currency and Bachs as default provider.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Update public.subscriptions table
-- -------------------------------------------------------------------------
-- Drop old payment_provider check constraint if exists
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

-- Re-add check constraint supporting bachs and manual
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_payment_provider_check 
  CHECK (payment_provider IN ('bachs', 'manual', 'paystack', 'flutterwave'));

-- Update existing records to Bachs / USD
UPDATE public.subscriptions
SET payment_provider = 'bachs',
    provider = 'bachs',
    billing_currency = 'USD'
WHERE payment_provider IS NULL OR payment_provider != 'bachs';

CREATE INDEX IF NOT EXISTS idx_subscriptions_bachs_customer_id 
  ON public.subscriptions(bachs_customer_id) 
  WHERE bachs_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_bachs_subscription_id 
  ON public.subscriptions(bachs_subscription_id) 
  WHERE bachs_subscription_id IS NOT NULL;


-- -------------------------------------------------------------------------
-- 2. Update public.payment_transactions table
-- -------------------------------------------------------------------------
-- Drop old provider check constraint if exists
ALTER TABLE public.payment_transactions 
  DROP CONSTRAINT IF EXISTS payment_transactions_provider_check;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS charge_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(10, 2);

-- Re-add check constraint supporting bachs
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_provider_check
  CHECK (provider IN ('bachs', 'paystack', 'flutterwave', 'manual'));

ALTER TABLE public.payment_transactions
  ALTER COLUMN currency SET DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_checkout_id 
  ON public.payment_transactions(checkout_id) 
  WHERE checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_charge_id 
  ON public.payment_transactions(charge_id) 
  WHERE charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id 
  ON public.payment_transactions(invoice_id) 
  WHERE invoice_id IS NOT NULL;


-- -------------------------------------------------------------------------
-- 3. Update public.webhook_events table
-- -------------------------------------------------------------------------
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_details TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_events_status 
  ON public.webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status 
  ON public.webhook_events(provider, status);


-- -------------------------------------------------------------------------
-- 4. Update platform_settings for USD & Bachs
-- -------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'billing_platform_settings',
  '{"currency": "USD", "currency_symbol": "$", "default_payment_provider": "bachs"}'::jsonb,
  'Global platform billing settings configured for Bachs USD-only billing'
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(public.platform_settings.value, '{}'::jsonb),
      '{currency}',
      '"USD"'
    ),
    '{currency_symbol}',
    '"$"'
  ),
  '{default_payment_provider}',
  '"bachs"'
),
updated_at = now();
