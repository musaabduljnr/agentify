CREATE TABLE IF NOT EXISTS public.webhook_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.webhook_deliveries(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  attempt_number SMALLINT NOT NULL CHECK (attempt_number > 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('processing', 'succeeded', 'failed', 'interrupted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  http_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  UNIQUE (delivery_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS webhook_attempts_business_started_idx
  ON public.webhook_delivery_attempts (business_id, started_at DESC);
CREATE INDEX IF NOT EXISTS webhook_attempts_delivery_idx
  ON public.webhook_delivery_attempts (delivery_id, attempt_number DESC);
ALTER TABLE public.webhook_delivery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_delivery_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.webhook_delivery_attempts TO authenticated;
GRANT ALL ON public.webhook_delivery_attempts TO service_role;
DROP POLICY IF EXISTS "Business owner views webhook attempts" ON public.webhook_delivery_attempts;
CREATE POLICY "Business owner views webhook attempts" ON public.webhook_delivery_attempts
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.fail_pending_webhook_deliveries_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.webhook_delivery_attempts AS a
  SET outcome = 'interrupted',
      completed_at = NOW(),
      error_message = 'Endpoint was deleted during delivery.'
  FROM public.webhook_deliveries AS d
  WHERE a.delivery_id = d.id
    AND d.webhook_id = OLD.id
    AND d.status = 'processing'
    AND a.outcome = 'processing';

  UPDATE public.webhook_deliveries
  SET status = 'failed',
      next_retry_at = NULL,
      claimed_at = NULL,
      error_message = 'Endpoint was deleted before delivery.'
  WHERE webhook_id = OLD.id
    AND status IN ('pending', 'processing', 'retrying');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_fail_pending_deliveries ON public.webhooks;
CREATE TRIGGER webhooks_fail_pending_deliveries
  BEFORE DELETE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.fail_pending_webhook_deliveries_on_delete();

DROP FUNCTION IF EXISTS public.claim_webhook_deliveries(INTEGER);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.webhook_deliveries'::regclass
      AND conname = 'webhook_deliveries_status_check'
      AND pg_get_constraintdef(oid) LIKE '%processing%'
  ) THEN
    UPDATE public.webhook_deliveries
    SET status = CASE status
      WHEN 'success' THEN 'delivered'
      WHEN 'retrying' THEN 'pending'
      ELSE status
    END,
    attempt_count = 0,
    last_attempted_at = NULL,
    claimed_at = NULL,
    next_retry_at = CASE WHEN status IN ('pending', 'retrying') THEN NOW() ELSE NULL END;
  END IF;
END;
$$;
ALTER TABLE public.webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;
ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending', 'processing', 'delivered', 'retrying', 'failed', 'exhausted'));

DROP INDEX IF EXISTS public.webhook_deliveries_due_idx;
CREATE INDEX webhook_deliveries_due_idx
  ON public.webhook_deliveries (next_retry_at, created_at)
  WHERE status IN ('pending', 'retrying');

CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  id UUID,
  webhook_id UUID,
  business_id UUID,
  event_id UUID,
  event_type TEXT,
  target_url TEXT,
  payload JSONB,
  attempt_count INTEGER,
  max_attempts SMALLINT,
  attempt_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.webhook_delivery_attempts AS a
  SET outcome = 'interrupted',
      completed_at = NOW(),
      error_message = 'Worker lease expired before the attempt completed.'
  FROM public.webhook_deliveries AS d
  WHERE a.delivery_id = d.id
    AND a.outcome = 'processing'
    AND d.status = 'processing'
    AND d.claimed_at <= NOW() - INTERVAL '2 minutes';

  UPDATE public.webhook_deliveries
  SET status = CASE WHEN attempt_count >= max_attempts THEN 'exhausted' ELSE 'retrying' END,
      next_retry_at = CASE WHEN attempt_count >= max_attempts THEN NULL ELSE NOW() + INTERVAL '1 minute' END,
      claimed_at = NULL,
      error_message = 'Worker lease expired before the attempt completed.'
  WHERE status = 'processing'
    AND claimed_at <= NOW() - INTERVAL '2 minutes';

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
  ),
  claimed AS (
    UPDATE public.webhook_deliveries AS d
    SET status = 'processing',
        attempt_count = d.attempt_count + 1,
        last_attempted_at = NOW(),
        claimed_at = NOW(),
        next_retry_at = NOW() + INTERVAL '2 minutes'
    FROM candidates
    WHERE d.id = candidates.id
    RETURNING d.id, d.webhook_id, d.business_id, d.event_id, d.event_type,
              d.target_url, d.payload, d.attempt_count, d.max_attempts
  ),
  attempts AS (
    INSERT INTO public.webhook_delivery_attempts (
      delivery_id, business_id, attempt_number, outcome, started_at
    )
    SELECT c.id, c.business_id, c.attempt_count, 'processing', NOW()
    FROM claimed AS c
    RETURNING webhook_delivery_attempts.id, webhook_delivery_attempts.delivery_id
  )
  SELECT c.id, c.webhook_id, c.business_id, c.event_id, c.event_type,
         c.target_url, c.payload, c.attempt_count, c.max_attempts, a.id
  FROM claimed AS c
  JOIN attempts AS a ON a.delivery_id = c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_webhook_delivery_attempt(
  p_delivery_id UUID,
  p_attempt_id UUID,
  p_outcome TEXT,
  p_response_code INTEGER,
  p_response_body TEXT,
  p_error_message TEXT,
  p_duration_ms INTEGER,
  p_next_retry_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.webhook_delivery_attempts%ROWTYPE;
  v_delivery public.webhook_deliveries%ROWTYPE;
BEGIN
  IF p_outcome NOT IN ('delivered', 'retrying', 'failed', 'exhausted') THEN
    RAISE EXCEPTION 'Invalid webhook attempt outcome';
  END IF;

  SELECT d.* INTO v_delivery
  FROM public.webhook_deliveries AS d
  JOIN public.webhook_delivery_attempts AS a
    ON a.delivery_id = d.id
   AND a.id = p_attempt_id
   AND a.attempt_number = d.attempt_count
  WHERE d.id = p_delivery_id
    AND d.status = 'processing'
    AND d.claimed_at > NOW() - INTERVAL '2 minutes'
  FOR UPDATE OF d;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.webhook_delivery_attempts
  SET outcome = CASE WHEN p_outcome = 'delivered' THEN 'succeeded' ELSE 'failed' END,
      completed_at = NOW(),
      response_code = p_response_code,
      response_body = LEFT(p_response_body, 2048),
      error_message = p_error_message,
      duration_ms = p_duration_ms
  WHERE id = p_attempt_id
    AND delivery_id = p_delivery_id
    AND outcome = 'processing'
  RETURNING * INTO v_attempt;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.webhook_deliveries
  SET status = p_outcome,
      response_code = p_response_code,
      response_body = LEFT(p_response_body, 2048),
      error_message = p_error_message,
      duration_ms = p_duration_ms,
      next_retry_at = p_next_retry_at,
      claimed_at = NULL
  WHERE id = p_delivery_id AND status = 'processing';

  RETURN FOUND;
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
    'total_attempts', COUNT(*) FILTER (
      WHERE a.http_started_at IS NOT NULL
        AND a.completed_at IS NOT NULL
        AND a.outcome IN ('succeeded', 'failed')
    ),
    'successful_attempts', COUNT(*) FILTER (
      WHERE a.http_started_at IS NOT NULL AND a.completed_at IS NOT NULL AND a.outcome = 'succeeded'
    ),
    'failed_attempts', COUNT(*) FILTER (
      WHERE a.http_started_at IS NOT NULL AND a.completed_at IS NOT NULL AND a.outcome = 'failed'
    ),
    'failed_deliveries', (SELECT COUNT(*) FROM public.webhook_deliveries d
      WHERE d.business_id = p_business_id AND d.created_at >= p_since
        AND d.status = 'failed'),
    'exhausted_deliveries', (SELECT COUNT(*) FROM public.webhook_deliveries d
      WHERE d.business_id = p_business_id AND d.created_at >= p_since
        AND d.status = 'exhausted'),
    'pending_deliveries', (SELECT COUNT(*) FROM public.webhook_deliveries d
      WHERE d.business_id = p_business_id AND d.created_at >= p_since
        AND d.status IN ('pending', 'processing', 'retrying')),
    'avg_duration_ms', ROUND(AVG(a.duration_ms) FILTER (
      WHERE a.http_started_at IS NOT NULL AND a.completed_at IS NOT NULL
        AND a.outcome IN ('succeeded', 'failed')
    )),
    'last_24h_attempts', COUNT(*) FILTER (
      WHERE a.http_started_at IS NOT NULL
        AND a.http_started_at >= NOW() - INTERVAL '24 hours'
        AND a.http_started_at <= NOW()
    )
  )
  INTO v_result
  FROM public.webhook_delivery_attempts AS a
  WHERE a.business_id = p_business_id
    AND a.started_at >= p_since
    AND a.started_at <= NOW();

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.fail_pending_webhook_deliveries_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_webhook_delivery_attempt(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_webhook_delivery_attempt(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, INTEGER, TIMESTAMPTZ)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_webhook_delivery_stats(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_webhook_delivery_stats(UUID, TIMESTAMPTZ) TO authenticated;
