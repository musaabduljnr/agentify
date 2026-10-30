-- =========================================================================
-- Critical Schema Fixes Migration
-- Date: 2026-10-30
-- Audit IDs: C1 (webhook_events), C2 (payment_transactions), H1 (billing_plan_overrides)
-- Description:
--   Adds tables that exist in legacy_sql/ but were never added to the
--   migrations pipeline. Without these tables, webhook processing and
--   payment checkout crash on every invocation.
--   Uses idempotent CREATE IF NOT EXISTS / DROP IF EXISTS patterns so
--   this migration is safe to run against databases where the tables
--   were already created manually via the Supabase SQL editor.
-- =========================================================================

-- =========================================================================
-- 1. webhook_events — Idempotency guard for incoming provider webhooks
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT        NOT NULL,           -- e.g. 'paystack', 'stripe'
  event_id     TEXT,                           -- provider-assigned event ID
  event_type   TEXT        NOT NULL,           -- e.g. 'charge.success'
  reference    TEXT,                           -- payment reference if applicable
  processed    BOOLEAN     NOT NULL DEFAULT false,
  payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicate processing of the same event
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_id_idx
  ON public.webhook_events (provider, event_id)
  WHERE event_id IS NOT NULL;

-- Index for reference lookups
CREATE INDEX IF NOT EXISTS webhook_events_reference_idx
  ON public.webhook_events (reference)
  WHERE reference IS NOT NULL;

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx
  ON public.webhook_events (created_at DESC);

-- RLS: Only service role can write. Admins can read for debugging.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view webhook events" ON public.webhook_events;
CREATE POLICY "Admins can view webhook events"
  ON public.webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );


-- =========================================================================
-- 2. payment_transactions — Checkout, verification, and payment history
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subscription_id          UUID        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider                 TEXT        NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
  reference                TEXT        UNIQUE NOT NULL,
  provider_transaction_id  TEXT,
  provider_customer_id     TEXT,
  provider_subscription_id TEXT,
  plan                     TEXT        NOT NULL,
  amount                   INTEGER     NOT NULL,
  currency                 TEXT        DEFAULT 'NGN',
  status                   TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'success', 'failed', 'abandoned', 'cancelled')),
  checkout_url             TEXT,
  raw_response             JSONB       DEFAULT '{}'::jsonb,
  verified_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Business owners can view their own payment history
DROP POLICY IF EXISTS "Users can view own business payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own business payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = payment_transactions.business_id
        AND businesses.owner_id = auth.uid()
    )
  );

-- Admins can view all payment transactions
DROP POLICY IF EXISTS "Admins can view all payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins can view all payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_payment_transactions_business_id ON public.payment_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON public.payment_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);


-- =========================================================================
-- 3. platform_settings — Admin-configurable billing and platform settings
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins can manage platform settings"
  ON public.platform_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_at ON public.platform_settings(updated_at);

-- Seed default billing settings if not already present
INSERT INTO public.platform_settings (key, value)
VALUES (
  'billing',
  jsonb_build_object(
    'currency', 'NGN',
    'currency_symbol', '₦',
    'default_payment_provider', 'paystack'
  )
)
ON CONFLICT (key) DO NOTHING;


-- =========================================================================
-- 4. billing_plan_overrides — Admin plan price/limit overrides
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.billing_plan_overrides (
  plan_id    TEXT        PRIMARY KEY,
  config     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.billing_plan_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage billing plan overrides" ON public.billing_plan_overrides;
CREATE POLICY "Admins can manage billing plan overrides"
  ON public.billing_plan_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_billing_plan_overrides_updated_at ON public.billing_plan_overrides(updated_at);


-- =========================================================================
-- 5. Migrate legacy 'trialing' subscriptions to 'pending' (Audit M2)
--    Safe: only transitions trialing → pending. Does not touch active
--    paying customers.
-- =========================================================================
UPDATE public.subscriptions
SET status = 'pending',
    updated_at = NOW()
WHERE status = 'trialing';


-- =========================================================================
-- 6. Atomic usage reset RPC (Audit M8 / Phase 6)
--    Prevents repeated DB writes by using a conditional update that
--    only fires when current_period_end has actually passed and the
--    subscription has not already been reset. Returns true if a reset
--    was actually performed.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reset_monthly_usage_if_needed(p_business_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.subscriptions
  SET current_usage = 0,
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '30 days',
      reset_date = NOW() + INTERVAL '30 days',
      updated_at = NOW()
  WHERE business_id = p_business_id
    AND (
      (current_period_end IS NOT NULL AND current_period_end <= NOW())
      OR (reset_date IS NOT NULL AND reset_date <= NOW())
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 7. Atomic payment activation RPC (Audit M3 / Phase 2B)
--    Atomically transitions a payment_transaction from 'pending' to
--    'success'. Returns the id if the transition happened (first caller
--    wins), or NULL if already processed.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.claim_payment_transaction(
  p_reference TEXT,
  p_verified_at TIMESTAMPTZ,
  p_raw_response JSONB
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE public.payment_transactions
  SET status = 'success',
      verified_at = p_verified_at,
      raw_response = COALESCE(raw_response, '{}'::jsonb) || p_raw_response,
      updated_at = NOW()
  WHERE reference = p_reference
    AND status = 'pending'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 8. Downgrade application RPC (Audit H2 / Phase 2A)
--    Called during subscription period boundary to apply a pending
--    downgrade recorded in metadata.downgrade_to. Idempotent.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.apply_pending_downgrade(p_business_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_sub RECORD;
  v_target_plan TEXT;
BEGIN
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_target_plan := v_sub.metadata->>'downgrade_to';

  IF v_target_plan IS NULL OR v_target_plan = '' THEN
    RETURN NULL;
  END IF;

  -- Only apply if the period has actually ended
  IF v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > NOW() THEN
    RETURN NULL;
  END IF;

  UPDATE public.subscriptions
  SET plan = v_target_plan,
      cancel_at_period_end = false,
      metadata = metadata - 'downgrade_to' - 'downgrade_requested_at',
      current_usage = 0,
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '30 days',
      reset_date = NOW() + INTERVAL '30 days',
      updated_at = NOW()
  WHERE business_id = p_business_id;

  RETURN v_target_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
