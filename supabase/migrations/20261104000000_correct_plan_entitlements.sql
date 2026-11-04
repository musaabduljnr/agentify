-- Align paid subscriptions with the published plan limits without changing
-- payment history, usage logs, subscription periods, or reset dates.

UPDATE public.subscriptions
SET message_limit = CASE plan
      WHEN 'starter' THEN 200
      WHEN 'growth' THEN 1500
    END,
    knowledge_limit = CASE plan
      WHEN 'starter' THEN 25
      WHEN 'growth' THEN 100
    END,
    lead_limit = CASE plan
      WHEN 'starter' THEN 50
      WHEN 'growth' THEN 999999999
    END,
    widget_limit = CASE plan
      WHEN 'starter' THEN 1
      WHEN 'growth' THEN 3
    END,
    daily_message_limit = 999999999
WHERE plan IN ('starter', 'growth');

UPDATE public.billing_plan_overrides
SET config = COALESCE(config, '{}'::JSONB) || CASE plan_id
  WHEN 'starter' THEN jsonb_build_object(
    'price_usd', 2,
    'messages', 200,
    'daily_messages', NULL,
    'knowledge_sources', 25,
    'leads', 50,
    'widgets', 1,
    'features', jsonb_build_array(
      '1 AI Assistant',
      '200 AI replies per billing cycle',
      '25 knowledge sources',
      '50 leads captured',
      '1 chat widget',
      'Basic analytics',
      'Email support',
      'Agentify branding'
    )
  )
  WHEN 'growth' THEN jsonb_build_object(
    'price_usd', 10,
    'messages', 1500,
    'daily_messages', NULL,
    'knowledge_sources', 100,
    'leads', NULL,
    'widgets', 3,
    'features', jsonb_build_array(
      'Up to 3 AI Assistants',
      '1,500 AI replies per billing cycle',
      '100 knowledge sources',
      'Unlimited leads captured',
      '3 chat widgets',
      'Advanced analytics',
      'Remove Agentify branding',
      'Custom domain & webhooks',
      'Priority email support'
    )
  )
END
WHERE plan_id IN ('starter', 'growth');

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
  IF v_subscription.current_period_end IS NULL
     OR v_subscription.current_period_end <= now() THEN
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
  ELSIF p_type = 'knowledge_source' THEN
    SELECT
      (SELECT COUNT(*) FROM public.knowledge_sources WHERE business_id = p_business_id)
      + (SELECT COALESCE(SUM(amount), 0) FROM public.usage_logs
         WHERE business_id = p_business_id AND type = 'knowledge_source'
           AND status = 'reserved' AND reserved_until > now())
    INTO v_used;
  ELSIF p_type = 'lead' THEN
    SELECT GREATEST(
      (SELECT COUNT(*) FROM public.leads
       WHERE business_id = p_business_id AND created_at >= v_period_start),
      (SELECT COALESCE(SUM(amount), 0) FROM public.usage_logs
       WHERE business_id = p_business_id AND type = 'lead'
         AND status = 'completed' AND created_at >= v_period_start)
    ) + (SELECT COALESCE(SUM(amount), 0) FROM public.usage_logs
         WHERE business_id = p_business_id AND type = 'lead'
           AND status = 'reserved' AND reserved_until > now()
           AND created_at >= v_period_start)
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

CREATE OR REPLACE FUNCTION public.enforce_authenticated_resource_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business_id UUID := NEW.business_id;
  v_resource TEXT;
  v_subscription public.subscriptions%ROWTYPE;
  v_has_subscription BOOLEAN;
  v_limit INTEGER;
  v_period_start TIMESTAMPTZ;
  v_used BIGINT;
  v_reserved BIGINT;
  v_reservation_id UUID;
  v_role TEXT := auth.role();
BEGIN
  IF v_role IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF v_role <> 'authenticated' THEN
    RAISE EXCEPTION 'Authenticated access is required to manage business resources';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id
       OR (TG_TABLE_NAME = 'leads' AND NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
      RAISE EXCEPTION 'Business ownership and lead capture time cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  v_resource := CASE TG_TABLE_NAME
    WHEN 'assistants' THEN 'assistant'
    WHEN 'knowledge_sources' THEN 'knowledge_source'
    WHEN 'leads' THEN 'lead'
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_business_id::TEXT || ':' || v_resource, 0));
  DELETE FROM public.usage_logs
  WHERE business_id = v_business_id
    AND status = 'reserved'
    AND reserved_until <= now();

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE business_id = v_business_id
  FOR UPDATE;
  v_has_subscription := FOUND;

  IF TG_TABLE_NAME = 'assistants' THEN
    SELECT COUNT(*) INTO v_used FROM public.assistants WHERE business_id = v_business_id;
  ELSIF TG_TABLE_NAME = 'knowledge_sources' THEN
    SELECT COUNT(*) INTO v_used FROM public.knowledge_sources WHERE business_id = v_business_id;
  ELSE
    IF v_has_subscription THEN
      v_period_start := COALESCE(v_subscription.current_period_start, v_subscription.created_at);
      SELECT GREATEST(
        (SELECT COUNT(*) FROM public.leads
         WHERE business_id = v_business_id AND created_at >= v_period_start),
        (SELECT COALESCE(SUM(amount), 0) FROM public.usage_logs
         WHERE business_id = v_business_id AND type = 'lead'
           AND status = 'completed' AND created_at >= v_period_start)
      ) INTO v_used;
    ELSE
      v_used := 0;
    END IF;
    NEW.created_at := now();
  END IF;

  IF NOT v_has_subscription
     OR v_subscription.status IS DISTINCT FROM 'active'
     OR v_subscription.current_period_end IS NULL
     OR v_subscription.current_period_end <= now() THEN
    IF TG_TABLE_NAME = 'assistants'
       AND v_used = 0
       AND (NOT v_has_subscription OR (
         v_subscription.plan = 'starter' AND v_subscription.status = 'pending'
       )) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'An active subscription is required to add this resource';
  END IF;

  v_period_start := COALESCE(v_subscription.current_period_start, v_subscription.created_at);
  v_limit := CASE v_resource
    WHEN 'assistant' THEN v_subscription.widget_limit
    WHEN 'knowledge_source' THEN v_subscription.knowledge_limit
    WHEN 'lead' THEN v_subscription.lead_limit
  END;

  IF v_resource = 'lead' THEN
    SELECT GREATEST(
      (SELECT COUNT(*) FROM public.leads
       WHERE business_id = v_business_id AND created_at >= v_period_start),
      (SELECT COALESCE(SUM(amount), 0) FROM public.usage_logs
       WHERE business_id = v_business_id AND type = 'lead'
         AND status = 'completed' AND created_at >= v_period_start)
    ) INTO v_used;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_reserved
  FROM public.usage_logs
  WHERE business_id = v_business_id
    AND type = v_resource
    AND status = 'reserved'
    AND reserved_until > now()
    AND (v_resource <> 'lead' OR created_at >= v_period_start);

  SELECT id INTO v_reservation_id
  FROM public.usage_logs
  WHERE business_id = v_business_id
    AND type = v_resource
    AND amount = 1
    AND status = 'reserved'
    AND reserved_until > now()
    AND (v_resource <> 'lead' OR created_at >= v_period_start)
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_limit IS NULL OR v_limit < 0 THEN
    IF v_subscription.plan = 'enterprise' AND v_limit IS NULL THEN
      v_limit := 999999999;
    ELSE
      RAISE EXCEPTION 'The subscription resource limit could not be verified';
    END IF;
  END IF;

  IF v_limit < 999999999 THEN
    IF v_reservation_id IS NOT NULL THEN
      IF v_used + v_reserved > v_limit THEN
        RAISE EXCEPTION 'Resource quota exceeded';
      END IF;
    ELSIF v_used + v_reserved >= v_limit THEN
      RAISE EXCEPTION 'Resource quota exceeded';
    END IF;
  END IF;

  IF v_reservation_id IS NOT NULL THEN
    UPDATE public.usage_logs
    SET status = 'completed', reserved_until = NULL
    WHERE id = v_reservation_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assistants_enforce_plan_limit ON public.assistants;
CREATE TRIGGER assistants_enforce_plan_limit
  BEFORE INSERT OR UPDATE OF business_id ON public.assistants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_authenticated_resource_limit();

DROP TRIGGER IF EXISTS knowledge_sources_enforce_plan_limit ON public.knowledge_sources;
CREATE TRIGGER knowledge_sources_enforce_plan_limit
  BEFORE INSERT OR UPDATE OF business_id ON public.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.enforce_authenticated_resource_limit();

DROP TRIGGER IF EXISTS leads_enforce_plan_limit ON public.leads;
CREATE TRIGGER leads_enforce_plan_limit
  BEFORE INSERT OR UPDATE OF business_id, created_at ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_authenticated_resource_limit();

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
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  IF v_usage.status = 'completed' THEN
    RETURN TRUE;
  END IF;
  IF v_usage.status <> 'reserved' OR v_usage.reserved_until <= now() THEN
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

-- A dashboard refresh, cron, or legacy RPC must never grant a new period.
CREATE OR REPLACE FUNCTION public.reset_monthly_usage_if_needed(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT FALSE;
$$;

CREATE OR REPLACE FUNCTION public.apply_pending_downgrade(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_authenticated_resource_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_monthly_usage_if_needed(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_pending_downgrade(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_usage_if_needed(UUID) TO service_role;
