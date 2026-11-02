-- Durable, retryable Bachs event processing and atomic billing state updates.

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_status_check;

ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed'));

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider_event_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER,
  ADD COLUMN IF NOT EXISTS team_member_limit INTEGER DEFAULT 1;

CREATE OR REPLACE FUNCTION public.apply_bachs_checkout_payment(
  p_event_id TEXT,
  p_transaction_id UUID,
  p_product_id TEXT,
  p_customer_id TEXT,
  p_subscription_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_event_created_at TIMESTAMPTZ,
  p_charge_id TEXT,
  p_limits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.webhook_events%ROWTYPE;
  v_transaction public.payment_transactions%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_plan TEXT;
  v_subscription_id UUID;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_apply_subscription BOOLEAN := TRUE;
  v_duplicate BOOLEAN := FALSE;
BEGIN
  IF p_event_id IS NOT NULL THEN
    SELECT * INTO v_event
    FROM public.webhook_events
    WHERE provider = 'bachs' AND event_id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bachs webhook event % was not persisted', p_event_id;
    END IF;

    IF v_event.status = 'processed' OR v_event.processed THEN
      RETURN jsonb_build_object('processed', TRUE, 'duplicate', TRUE);
    END IF;

    IF v_event.status <> 'processing' THEN
      RAISE EXCEPTION 'Bachs webhook event % is not claimed for processing', p_event_id;
    END IF;
  END IF;

  SELECT * INTO v_transaction
  FROM public.payment_transactions
  WHERE id = p_transaction_id AND provider = 'bachs'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matching Bachs checkout transaction was not found';
  END IF;

  v_duplicate := v_transaction.status = 'success';
  v_plan := v_transaction.plan;

  IF v_plan NOT IN ('starter', 'growth')
     OR (v_plan = 'starter' AND p_amount <> 2.00)
     OR (v_plan = 'growth' AND p_amount <> 10.00)
     OR p_currency <> 'USD' THEN
    RAISE EXCEPTION 'Bachs payment does not match the configured USD plan';
  END IF;

  IF p_product_id IS NULL
     OR p_product_id = ''
     OR v_transaction.raw_response->>'product_id' IS DISTINCT FROM p_product_id THEN
    RAISE EXCEPTION 'Bachs product does not match the pending checkout';
  END IF;

  IF v_transaction.status NOT IN ('pending', 'abandoned', 'failed', 'success') THEN
    RAISE EXCEPTION 'Bachs checkout transaction has unsupported status %', v_transaction.status;
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE business_id = v_transaction.business_id
  FOR UPDATE;

  IF FOUND THEN
    v_subscription_id := v_subscription.id;
    IF v_subscription.provider_event_created_at IS NOT NULL
       AND p_event_created_at < v_subscription.provider_event_created_at THEN
      v_apply_subscription := FALSE;
    END IF;

    IF v_subscription.status = 'active'
       AND v_subscription.plan = 'growth'
       AND v_plan = 'starter' THEN
      v_apply_subscription := FALSE;
    END IF;
  END IF;

  v_period_start := COALESCE(p_period_start, p_event_created_at, now());
  v_period_end := COALESCE(p_period_end, v_period_start + INTERVAL '1 month');

  IF v_apply_subscription THEN
    INSERT INTO public.subscriptions (
      business_id, plan, status, payment_provider, provider, billing_currency,
      billing_amount, current_period_start, current_period_end, reset_date,
      message_limit, knowledge_limit, lead_limit, widget_limit, embedding_limit,
      daily_message_limit, team_member_limit, bachs_customer_id,
      bachs_subscription_id, provider_customer_id, provider_subscription_id,
      bachs_product_id, canceled_at, cancel_at_period_end,
      provider_event_created_at, updated_at
    )
    VALUES (
      v_transaction.business_id, v_plan, 'active', 'bachs', 'bachs', 'USD',
      p_amount, v_period_start, v_period_end, v_period_end,
      (p_limits->>'message_limit')::INTEGER,
      (p_limits->>'knowledge_limit')::INTEGER,
      (p_limits->>'lead_limit')::INTEGER,
      (p_limits->>'widget_limit')::INTEGER,
      (p_limits->>'embedding_limit')::INTEGER,
      (p_limits->>'daily_message_limit')::INTEGER,
      (p_limits->>'team_member_limit')::INTEGER,
      p_customer_id, p_subscription_id, p_customer_id, p_subscription_id,
      p_product_id, NULL, FALSE, p_event_created_at, now()
    )
    ON CONFLICT (business_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = 'active',
      payment_provider = 'bachs',
      provider = 'bachs',
      billing_currency = 'USD',
      billing_amount = EXCLUDED.billing_amount,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      reset_date = EXCLUDED.reset_date,
      message_limit = EXCLUDED.message_limit,
      knowledge_limit = EXCLUDED.knowledge_limit,
      lead_limit = EXCLUDED.lead_limit,
      widget_limit = EXCLUDED.widget_limit,
      embedding_limit = EXCLUDED.embedding_limit,
      daily_message_limit = EXCLUDED.daily_message_limit,
      team_member_limit = EXCLUDED.team_member_limit,
      bachs_customer_id = COALESCE(EXCLUDED.bachs_customer_id, subscriptions.bachs_customer_id),
      bachs_subscription_id = COALESCE(EXCLUDED.bachs_subscription_id, subscriptions.bachs_subscription_id),
      provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, subscriptions.provider_customer_id),
      provider_subscription_id = COALESCE(EXCLUDED.provider_subscription_id, subscriptions.provider_subscription_id),
      bachs_product_id = EXCLUDED.bachs_product_id,
      canceled_at = NULL,
      cancel_at_period_end = FALSE,
      provider_event_created_at = EXCLUDED.provider_event_created_at,
      updated_at = now()
    WHERE subscriptions.provider_event_created_at IS NULL
       OR EXCLUDED.provider_event_created_at >= subscriptions.provider_event_created_at;

    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE business_id = v_transaction.business_id;
  END IF;

  UPDATE public.payment_transactions
  SET subscription_id = COALESCE(v_subscription_id, subscription_id),
      status = 'success',
      amount = p_amount::INTEGER,
      billing_amount = p_amount,
      currency = 'USD',
      charge_id = COALESCE(p_charge_id, charge_id),
      provider_customer_id = COALESCE(p_customer_id, provider_customer_id),
      provider_subscription_id = COALESCE(p_subscription_id, provider_subscription_id),
      verified_at = p_event_created_at,
      failure_reason = NULL,
      updated_at = now()
  WHERE id = v_transaction.id;

  IF p_event_id IS NOT NULL THEN
    UPDATE public.webhook_events
    SET status = 'processed',
        processed = TRUE,
        processed_at = now(),
        processing_started_at = NULL,
        error_details = NULL
    WHERE id = v_event.id;
  END IF;

  RETURN jsonb_build_object(
    'processed', TRUE,
    'duplicate', v_duplicate,
    'plan', CASE WHEN v_apply_subscription THEN v_plan ELSE v_subscription.plan END,
    'subscription_id', v_subscription_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_bachs_invoice_paid_event(
  p_event_id TEXT,
  p_subscription_id TEXT,
  p_invoice_id TEXT,
  p_charge_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_event_created_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.webhook_events%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_expected_amount NUMERIC;
  v_transaction public.payment_transactions%ROWTYPE;
  v_duplicate BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_event
  FROM public.webhook_events
  WHERE provider = 'bachs' AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bachs webhook event % was not persisted', p_event_id;
  END IF;

  IF v_event.status = 'processed' OR v_event.processed THEN
    RETURN jsonb_build_object('processed', TRUE, 'duplicate', TRUE);
  END IF;

  IF v_event.status <> 'processing' THEN
    RAISE EXCEPTION 'Bachs webhook event % is not claimed for processing', p_event_id;
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE bachs_subscription_id = p_subscription_id
     OR provider_subscription_id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bachs subscription % is not linked to an Agentify subscription', p_subscription_id;
  END IF;

  IF v_subscription.plan NOT IN ('starter', 'growth') OR p_currency <> 'USD' THEN
    RAISE EXCEPTION 'Bachs invoice does not match a supported USD plan';
  END IF;

  v_expected_amount := CASE v_subscription.plan
    WHEN 'starter' THEN 2.00
    WHEN 'growth' THEN 10.00
  END;

  IF p_amount <> v_expected_amount THEN
    RAISE EXCEPTION 'Bachs invoice amount does not match the current plan';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bachs-invoice:' || p_invoice_id, 0));

  IF v_subscription.provider_event_created_at IS NULL
     OR p_event_created_at >= v_subscription.provider_event_created_at THEN
    UPDATE public.subscriptions
    SET status = 'active',
        current_period_start = COALESCE(p_period_start, current_period_start),
        current_period_end = COALESCE(p_period_end, current_period_end),
        reset_date = COALESCE(p_period_end, reset_date),
        billing_currency = 'USD',
        billing_amount = p_amount,
        provider_event_created_at = p_event_created_at,
        updated_at = now()
    WHERE id = v_subscription.id;
  END IF;

  SELECT * INTO v_transaction
  FROM public.payment_transactions
  WHERE provider = 'bachs' AND invoice_id = p_invoice_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_duplicate := v_transaction.status = 'success';
    UPDATE public.payment_transactions
    SET status = 'success',
        amount = p_amount::INTEGER,
        billing_amount = p_amount,
        currency = 'USD',
        charge_id = COALESCE(p_charge_id, charge_id),
        provider_customer_id = COALESCE(v_subscription.bachs_customer_id, provider_customer_id),
        provider_subscription_id = p_subscription_id,
        verified_at = p_event_created_at,
        failure_reason = NULL,
        updated_at = now()
    WHERE id = v_transaction.id;
  ELSE
    INSERT INTO public.payment_transactions (
      business_id, subscription_id, provider, reference, provider_customer_id,
      provider_subscription_id, plan, amount, billing_amount, currency,
      status, invoice_id, charge_id, verified_at
    )
    VALUES (
      v_subscription.business_id, v_subscription.id, 'bachs',
      'bachs-invoice-' || p_invoice_id, v_subscription.bachs_customer_id,
      p_subscription_id, v_subscription.plan, p_amount::INTEGER,
      p_amount, 'USD', 'success', p_invoice_id, p_charge_id, p_event_created_at
    );
  END IF;

  UPDATE public.webhook_events
  SET status = 'processed',
      processed = TRUE,
      processed_at = now(),
      processing_started_at = NULL,
      error_details = NULL
  WHERE id = v_event.id;

  RETURN jsonb_build_object(
    'processed', TRUE,
    'duplicate', v_duplicate,
    'plan', v_subscription.plan
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_bachs_subscription_status_event(
  p_event_id TEXT,
  p_subscription_id TEXT,
  p_provider_status TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN,
  p_canceled_at TIMESTAMPTZ,
  p_event_created_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.webhook_events%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_status TEXT;
  v_subscription_found BOOLEAN;
BEGIN
  SELECT * INTO v_event
  FROM public.webhook_events
  WHERE provider = 'bachs' AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bachs webhook event % was not persisted', p_event_id;
  END IF;

  IF v_event.status = 'processed' OR v_event.processed THEN
    RETURN jsonb_build_object('processed', TRUE, 'duplicate', TRUE);
  END IF;

  IF v_event.status <> 'processing' THEN
    RAISE EXCEPTION 'Bachs webhook event % is not claimed for processing', p_event_id;
  END IF;

  IF p_provider_status NOT IN ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'paused') THEN
    RAISE EXCEPTION 'Unsupported Bachs subscription status %', p_provider_status;
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE bachs_subscription_id = p_subscription_id
     OR provider_subscription_id = p_subscription_id
  FOR UPDATE;

  v_subscription_found := FOUND;
  IF NOT v_subscription_found THEN
    RAISE EXCEPTION 'Bachs subscription % is not linked to an Agentify subscription', p_subscription_id;
  END IF;

  IF v_subscription_found THEN
    IF v_subscription.provider_event_created_at IS NULL
       OR p_event_created_at >= v_subscription.provider_event_created_at THEN
      v_status := CASE p_provider_status
        WHEN 'trialing' THEN
          CASE WHEN v_subscription.status = 'active' THEN 'active' ELSE 'pending_payment' END
        WHEN 'past_due' THEN 'past_due'
        WHEN 'unpaid' THEN 'unpaid'
        WHEN 'paused' THEN 'paused'
        WHEN 'canceled' THEN
          CASE
            WHEN COALESCE(p_cancel_at_period_end, FALSE)
              AND COALESCE(p_period_end, v_subscription.current_period_end) > now()
            THEN 'active'
            ELSE 'cancelled'
          END
        ELSE v_subscription.status
      END;

      UPDATE public.subscriptions
      SET status = v_status,
          current_period_start = COALESCE(p_period_start, current_period_start),
          current_period_end = COALESCE(p_period_end, current_period_end),
          reset_date = COALESCE(p_period_end, reset_date),
          cancel_at_period_end = COALESCE(p_cancel_at_period_end, cancel_at_period_end),
          canceled_at = COALESCE(p_canceled_at, canceled_at),
          provider_event_created_at = p_event_created_at,
          updated_at = now()
      WHERE id = v_subscription.id;
    END IF;
  END IF;

  UPDATE public.webhook_events
  SET status = 'processed',
      processed = TRUE,
      processed_at = now(),
      processing_started_at = NULL,
      error_details = NULL
  WHERE id = v_event.id;

  RETURN jsonb_build_object('processed', TRUE, 'subscription_found', v_subscription_found);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_bachs_checkout_payment(
  TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bachs_checkout_payment(
  TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.apply_bachs_invoice_paid_event(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bachs_invoice_paid_event(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON FUNCTION public.apply_bachs_subscription_status_event(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bachs_subscription_status_event(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;
