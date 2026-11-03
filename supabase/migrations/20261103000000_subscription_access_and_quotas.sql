-- Authoritative subscription access and concurrency-safe quota reservations.
-- This migration is additive and preserves all existing subscription and usage rows.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER,
  ADD COLUMN IF NOT EXISTS team_member_limit INTEGER;

ALTER TABLE public.usage_logs
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS operation_id UUID,
  ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.usage_logs FROM anon, authenticated;

DROP POLICY IF EXISTS "Owners can create pending starter subscription" ON public.subscriptions;
CREATE POLICY "Owners can create pending starter subscription"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    plan = 'starter'
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = subscriptions.business_id
        AND businesses.owner_id = auth.uid()
    )
  );

UPDATE public.subscriptions
SET message_limit = COALESCE(message_limit, CASE
      WHEN plan = 'starter' THEN 200
      WHEN plan = 'growth' THEN 1500
      WHEN plan = 'business' THEN 50000
      WHEN plan = 'enterprise' THEN 999999999
    END),
    knowledge_limit = COALESCE(knowledge_limit, CASE
      WHEN plan = 'starter' THEN 25
      WHEN plan = 'growth' THEN 100
      WHEN plan = 'business' THEN 250
      WHEN plan = 'enterprise' THEN 999999999
    END),
    lead_limit = COALESCE(lead_limit, CASE
      WHEN plan = 'starter' THEN 50
      WHEN plan = 'growth' THEN 999999999
      WHEN plan = 'business' THEN 25000
      WHEN plan = 'enterprise' THEN 999999999
    END),
    widget_limit = COALESCE(widget_limit, CASE
      WHEN plan = 'starter' THEN 1
      WHEN plan = 'growth' THEN 3
      WHEN plan = 'business' THEN 5
      WHEN plan = 'enterprise' THEN 999999999
    END),
    embedding_limit = COALESCE(embedding_limit, CASE
      WHEN plan = 'starter' THEN 5000
      WHEN plan = 'growth' THEN 50000
      WHEN plan = 'business' THEN 250000
      WHEN plan = 'enterprise' THEN 999999999
    END),
    daily_message_limit = COALESCE(
      daily_message_limit,
      CASE
        WHEN metadata->>'daily_message_limit' ~ '^[0-9]+$'
        THEN (metadata->>'daily_message_limit')::INTEGER
      END,
      CASE plan
        WHEN 'starter' THEN 50
        WHEN 'growth' THEN 200
        WHEN 'business' THEN 2500
        ELSE 999999999
      END
    ),
    team_member_limit = COALESCE(
      team_member_limit,
      CASE plan
        WHEN 'starter' THEN 1
        WHEN 'growth' THEN 3
        WHEN 'business' THEN 10
        ELSE 999999999
      END
    );

ALTER TABLE public.usage_logs
  DROP CONSTRAINT IF EXISTS usage_logs_status_check;

ALTER TABLE public.usage_logs
  ADD CONSTRAINT usage_logs_status_check
  CHECK (status IN ('reserved', 'completed'));

ALTER TABLE public.usage_logs
  DROP CONSTRAINT IF EXISTS usage_logs_type_check;

ALTER TABLE public.usage_logs
  ADD CONSTRAINT usage_logs_type_check
  CHECK (type IN ('message', 'embedding', 'lead', 'knowledge_source', 'widget_chat', 'assistant', 'team_member'));

CREATE UNIQUE INDEX IF NOT EXISTS usage_logs_operation_id_idx
  ON public.usage_logs(operation_id)
  WHERE operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS usage_logs_business_type_period_idx
  ON public.usage_logs(business_id, type, created_at);

CREATE OR REPLACE FUNCTION public.reserve_subscription_quota(
  p_business_id UUID,
  p_type TEXT,
  p_amount INTEGER,
  p_operation_id UUID,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_limit INTEGER;
  v_daily_limit INTEGER;
  v_period_start TIMESTAMPTZ;
  v_used BIGINT;
  v_daily_used BIGINT;
  v_lock_type TEXT;
BEGIN
  IF p_business_id IS NULL
     OR p_type IS NULL
     OR p_type NOT IN ('message', 'widget_chat', 'embedding', 'lead', 'knowledge_source', 'assistant', 'team_member')
     OR p_amount IS NULL OR p_amount < 1 OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription quota reservation';
  END IF;

  v_lock_type := CASE
    WHEN p_type IN ('message', 'widget_chat') THEN 'message'
    ELSE p_type
  END;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::TEXT || ':' || v_lock_type, 0));
  DELETE FROM public.usage_logs
  WHERE business_id = p_business_id
    AND status = 'reserved'
    AND reserved_until <= now();

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'no_subscription');
  END IF;
  IF v_subscription.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'inactive_subscription');
  END IF;
  IF v_subscription.plan IS NULL
     OR v_subscription.plan NOT IN ('starter', 'growth', 'enterprise', 'business') THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'unknown_plan');
  END IF;
  IF v_subscription.current_period_end IS NOT NULL
     AND v_subscription.current_period_end <= now() THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'expired_period');
  END IF;

  v_period_start := COALESCE(v_subscription.current_period_start, v_subscription.created_at);
  v_limit := CASE p_type
    WHEN 'message' THEN v_subscription.message_limit
    WHEN 'widget_chat' THEN v_subscription.message_limit
    WHEN 'embedding' THEN v_subscription.embedding_limit
    WHEN 'lead' THEN v_subscription.lead_limit
    WHEN 'knowledge_source' THEN v_subscription.knowledge_limit
    WHEN 'assistant' THEN v_subscription.widget_limit
    WHEN 'team_member' THEN v_subscription.team_member_limit
  END;

  IF p_type = 'assistant' THEN
    SELECT
      (SELECT COUNT(*) FROM public.assistants WHERE business_id = p_business_id)
      + (SELECT COALESCE(SUM(amount), 0) FROM public.usage_logs
         WHERE business_id = p_business_id AND type = 'assistant'
           AND status = 'reserved' AND reserved_until > now())
    INTO v_used;
  ELSIF p_type = 'team_member' THEN
    SELECT
      (SELECT COUNT(*) FROM public.business_members
       WHERE business_id = p_business_id AND status = 'active')
      + (SELECT COUNT(*) FROM public.team_invitations
         WHERE business_id = p_business_id AND status = 'pending' AND expires_at > now())
      + (SELECT COALESCE(SUM(amount), 0) FROM public.usage_logs
         WHERE business_id = p_business_id AND type = 'team_member'
           AND status = 'reserved' AND reserved_until > now())
    INTO v_used;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_used
    FROM public.usage_logs
    WHERE business_id = p_business_id
      AND (
        (p_type IN ('message', 'widget_chat') AND type IN ('message', 'widget_chat'))
        OR (p_type NOT IN ('message', 'widget_chat') AND type = p_type)
      )
      AND created_at >= v_period_start
      AND (status = 'completed' OR (status = 'reserved' AND reserved_until > now()));
  END IF;

  IF v_limit IS NULL OR v_limit < 0 THEN
    IF v_subscription.plan = 'enterprise' AND v_limit IS NULL THEN
      v_limit := 999999999;
    ELSE
      RETURN jsonb_build_object('allowed', FALSE, 'reason', 'invalid_limit');
    END IF;
  END IF;
  IF v_limit < 999999999 AND v_used + p_amount > v_limit THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'monthly_limit', 'used', v_used, 'limit', v_limit);
  END IF;

  IF p_type IN ('message', 'widget_chat') THEN
    v_daily_limit := COALESCE(v_subscription.daily_message_limit, 999999999);
    SELECT COALESCE(SUM(amount), 0) INTO v_daily_used
    FROM public.usage_logs
    WHERE business_id = p_business_id
      AND type IN ('message', 'widget_chat')
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      AND (status = 'completed' OR (status = 'reserved' AND reserved_until > now()));

    IF v_daily_limit < 999999999 AND v_daily_used + p_amount > v_daily_limit THEN
      RETURN jsonb_build_object('allowed', FALSE, 'reason', 'daily_limit', 'used', v_daily_used, 'limit', v_daily_limit);
    END IF;
  END IF;

  INSERT INTO public.usage_logs (
    business_id, subscription_id, type, amount, metadata, status, operation_id, reserved_until
  )
  VALUES (
    p_business_id, v_subscription.id, p_type, p_amount, COALESCE(p_metadata, '{}'::JSONB),
    'reserved', p_operation_id, now() + INTERVAL '1 hour'
  )
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'duplicate_operation');
  END IF;

  RETURN jsonb_build_object('allowed', TRUE, 'operation_id', p_operation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_subscription_quota(p_operation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usage public.usage_logs%ROWTYPE;
BEGIN
  SELECT * INTO v_usage
  FROM public.usage_logs
  WHERE operation_id = p_operation_id
    AND status = 'reserved'
    AND reserved_until > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.usage_logs
  SET status = 'completed', reserved_until = NULL
  WHERE id = v_usage.id;

  IF v_usage.type IN ('message', 'widget_chat') THEN
    UPDATE public.subscriptions
    SET current_usage = COALESCE(current_usage, 0) + v_usage.amount
    WHERE id = v_usage.subscription_id;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_subscription_quota(p_operation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.usage_logs
  WHERE operation_id = p_operation_id
    AND status = 'reserved';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_subscription_quota(UUID, TEXT, INTEGER, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_subscription_quota(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_subscription_quota(UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_subscription_quota(UUID, TEXT, INTEGER, UUID, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_subscription_quota(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_subscription_quota(UUID)
  TO service_role;
