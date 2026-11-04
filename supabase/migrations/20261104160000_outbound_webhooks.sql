ALTER TABLE public.webhooks
  ADD COLUMN IF NOT EXISTS max_attempts SMALLINT NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.webhooks'::regclass
      AND conname = 'webhooks_max_attempts_check'
  ) THEN
    ALTER TABLE public.webhooks
      ADD CONSTRAINT webhooks_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 5);
  END IF;
END;
$$;

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS event_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS max_attempts SMALLINT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS manual_retry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_of UUID REFERENCES public.webhook_deliveries(id) ON DELETE SET NULL;

UPDATE public.webhook_deliveries
SET event_id = gen_random_uuid()
WHERE event_id IS NULL;

ALTER TABLE public.webhook_deliveries
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN attempt_count SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.webhook_secrets (
  webhook_id UUID PRIMARY KEY REFERENCES public.webhooks(id) ON DELETE CASCADE,
  secret TEXT NOT NULL CHECK (length(secret) >= 32),
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.webhook_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.webhook_secrets TO service_role;

INSERT INTO public.webhook_secrets (webhook_id, secret)
SELECT id, secret
FROM public.webhooks
WHERE secret IS NOT NULL AND length(secret) >= 32
ON CONFLICT (webhook_id) DO NOTHING;
UPDATE public.webhooks SET secret = NULL WHERE secret IS NOT NULL;

REVOKE SELECT, INSERT, UPDATE ON public.webhooks FROM anon, authenticated;
GRANT SELECT (id, business_id, name, target_url, events, is_active, max_attempts, created_at, updated_at)
  ON public.webhooks TO authenticated;
GRANT UPDATE (name, target_url, events, is_active, max_attempts, updated_at)
  ON public.webhooks TO authenticated;

DROP FUNCTION IF EXISTS public.create_webhook_registration(UUID, TEXT, TEXT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.create_webhook_registration(
  p_business_id UUID,
  p_name TEXT,
  p_target_url TEXT,
  p_events TEXT[],
  p_secret TEXT,
  p_max_attempts SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_webhook public.webhooks%ROWTYPE;
BEGIN
  IF p_secret IS NULL OR length(p_secret) < 32
     OR p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 5
     OR p_events IS NULL OR cardinality(p_events) = 0
     OR EXISTS (
       SELECT 1 FROM unnest(p_events) AS supported(event_name)
       WHERE supported.event_name <> 'lead.created'
     ) THEN
    RAISE EXCEPTION 'Invalid webhook registration';
  END IF;

  INSERT INTO public.webhooks (business_id, name, target_url, events, is_active, max_attempts)
  VALUES (p_business_id, p_name, p_target_url, p_events, true, p_max_attempts)
  RETURNING * INTO v_webhook;

  INSERT INTO public.webhook_secrets (webhook_id, secret)
  VALUES (v_webhook.id, p_secret);

  RETURN jsonb_build_object(
    'id', v_webhook.id,
    'name', v_webhook.name,
    'target_url', v_webhook.target_url,
    'events', v_webhook.events,
    'is_active', v_webhook.is_active,
    'max_attempts', v_webhook.max_attempts,
    'created_at', v_webhook.created_at
  );
END;
$$;

ALTER TABLE public.webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;
ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending', 'success', 'failed', 'retrying'));

CREATE UNIQUE INDEX IF NOT EXISTS webhook_deliveries_event_endpoint_unique
  ON public.webhook_deliveries (webhook_id, event_id)
  WHERE webhook_id IS NOT NULL AND manual_retry = false AND is_test = false;
CREATE UNIQUE INDEX IF NOT EXISTS webhook_deliveries_single_manual_retry_idx
  ON public.webhook_deliveries (retry_of)
  WHERE retry_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON public.webhook_deliveries (next_retry_at, created_at)
  WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS webhook_deliveries_business_created_idx
  ON public.webhook_deliveries (business_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enqueue_lead_webhook_deliveries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created_at TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'schema_version', 1,
    'event_id', NEW.id,
    'type', 'lead.created',
    'created_at', v_created_at,
    'data', jsonb_strip_nulls(jsonb_build_object(
      'lead_id', NEW.id,
      'business_id', NEW.business_id,
      'conversation_id', NEW.conversation_id,
      'name', NEW.name,
      'email', NEW.email,
      'phone', NEW.phone,
      'source', NEW.source,
      'interest', NEW.interest
    ))
  );

  INSERT INTO public.webhook_deliveries (
    business_id, webhook_id, event_id, event_type, target_url,
    status, attempt_count, max_attempts, next_retry_at, payload
  )
  SELECT w.business_id, w.id, NEW.id, 'lead.created', w.target_url,
         'pending', 0, w.max_attempts, NOW(), v_payload
  FROM public.webhooks AS w
  WHERE w.business_id = NEW.business_id
    AND w.is_active
    AND w.events @> ARRAY['lead.created']::TEXT[]
  ON CONFLICT (webhook_id, event_id)
    WHERE webhook_id IS NOT NULL AND manual_retry = false AND is_test = false
    DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_enqueue_outbound_webhooks ON public.leads;
CREATE TRIGGER leads_enqueue_outbound_webhooks
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_lead_webhook_deliveries();

CREATE OR REPLACE FUNCTION public.fail_pending_webhook_deliveries_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.webhook_deliveries
  SET status = 'failed',
      next_retry_at = NULL,
      claimed_at = NULL,
      error_message = 'Endpoint was deleted before delivery.'
  WHERE webhook_id = OLD.id
    AND status IN ('pending', 'retrying');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_fail_pending_deliveries ON public.webhooks;
CREATE TRIGGER webhooks_fail_pending_deliveries
  BEFORE DELETE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.fail_pending_webhook_deliveries_on_delete();

CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.webhook_deliveries
  SET status = 'failed',
      next_retry_at = NULL,
      error_message = 'Delivery lease expired after the final attempt.'
  WHERE status = 'retrying'
    AND next_retry_at <= NOW()
    AND attempt_count >= max_attempts;

  RETURN QUERY
  WITH candidates AS (
    SELECT d.id
    FROM public.webhook_deliveries AS d
    JOIN public.webhooks AS w
      ON w.id = d.webhook_id
     AND w.business_id = d.business_id
     AND w.is_active
    WHERE d.status IN ('pending', 'retrying')
      AND COALESCE(d.next_retry_at, NOW()) <= NOW()
      AND d.attempt_count < d.max_attempts
    ORDER BY COALESCE(d.next_retry_at, d.created_at), d.created_at
    FOR UPDATE OF d SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50)
  )
  UPDATE public.webhook_deliveries AS d
  SET status = 'retrying',
      attempt_count = d.attempt_count + 1,
      last_attempted_at = NOW(),
      claimed_at = NOW(),
      next_retry_at = NOW() + INTERVAL '2 minutes'
  FROM candidates
  WHERE d.id = candidates.id
  RETURNING d.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_webhook_delivery_stats(
  p_business_id UUID,
  p_since TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = p_business_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'success', COUNT(*) FILTER (WHERE status = 'success'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'pending', COUNT(*) FILTER (WHERE status IN ('pending', 'retrying')),
    'resolved', COUNT(*) FILTER (WHERE status IN ('success', 'failed')),
    'avg_duration_ms', ROUND(AVG(duration_ms) FILTER (WHERE status IN ('success', 'failed'))),
    'last_24h', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')
  )
  INTO v_result
  FROM public.webhook_deliveries
  WHERE business_id = p_business_id
    AND created_at >= p_since
    AND created_at <= NOW();

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_lead_webhook_deliveries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_pending_webhook_deliveries_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.create_webhook_registration(UUID, TEXT, TEXT, TEXT[], TEXT, SMALLINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_webhook_registration(UUID, TEXT, TEXT, TEXT[], TEXT, SMALLINT) TO service_role;
REVOKE ALL ON FUNCTION public.get_webhook_delivery_stats(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_webhook_delivery_stats(UUID, TIMESTAMPTZ) TO authenticated;
