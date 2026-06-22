-- =========================================================================
-- Phase 3: Growth Features Migration
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Subscription: ensure cancel_at_period_end column exists
-- -------------------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;


-- -------------------------------------------------------------------------
-- 2. Conversation Archival columns
-- -------------------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

CREATE INDEX IF NOT EXISTS conversations_archived_business_idx
  ON public.conversations (business_id, archived_at)
  WHERE archived_at IS NULL;

-- RPC: archive old conversations for a business
CREATE OR REPLACE FUNCTION public.archive_old_conversations(
  p_business_id UUID,
  p_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.conversations
  SET
    archived_at = NOW(),
    archive_reason = 'auto_retention',
    updated_at = NOW()
  WHERE
    business_id = p_business_id
    AND archived_at IS NULL
    AND created_at < NOW() - (p_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: unarchive a single conversation
CREATE OR REPLACE FUNCTION public.unarchive_conversation(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.conversations
  SET archived_at = NULL, archive_reason = NULL, updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------
-- 3. Team Members
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email         TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'member'
                            CHECK (role IN ('owner', 'admin', 'member')),
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active', 'removed')),
  invited_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at     TIMESTAMPTZ,
  invite_token  TEXT        UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS team_members_business_idx
  ON public.team_members (business_id, status);

CREATE INDEX IF NOT EXISTS team_members_user_idx
  ON public.team_members (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS team_members_token_idx
  ON public.team_members (invite_token)
  WHERE invite_token IS NOT NULL;

-- Unique: one active/pending row per email per business
CREATE UNIQUE INDEX IF NOT EXISTS team_members_email_business_unique
  ON public.team_members (business_id, email)
  WHERE status <> 'removed';

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policy: business owners and admins can see all members
DROP POLICY IF EXISTS "Team members visible to business members" ON public.team_members;
CREATE POLICY "Team members visible to business members" ON public.team_members
  FOR SELECT USING (
    -- Own row
    user_id = auth.uid()
    OR
    -- Member of the same business
    business_id IN (
      SELECT business_id FROM public.team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    -- Business owner
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: only owners/admins can insert (invite)
DROP POLICY IF EXISTS "Owners and admins can invite team members" ON public.team_members;
CREATE POLICY "Owners and admins can invite team members" ON public.team_members
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- Policy: owners/admins can update (role change, remove)
DROP POLICY IF EXISTS "Owners and admins can update team members" ON public.team_members;
CREATE POLICY "Owners and admins can update team members" ON public.team_members
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- RPC: accept invite by token (links auth.user to member row)
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_member public.team_members;
BEGIN
  SELECT * INTO v_member
  FROM public.team_members
  WHERE invite_token = p_token AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invite token.');
  END IF;

  UPDATE public.team_members
  SET
    user_id = auth.uid(),
    status = 'active',
    joined_at = NOW(),
    invite_token = NULL,
    updated_at = NOW()
  WHERE id = v_member.id;

  RETURN jsonb_build_object('success', true, 'business_id', v_member.business_id, 'role', v_member.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------
-- 4. Webhook Registrations
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhooks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  target_url    TEXT        NOT NULL,
  secret        TEXT,
  events        TEXT[]      NOT NULL DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhooks_business_idx
  ON public.webhooks (business_id, is_active);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business owner manages webhooks" ON public.webhooks;
CREATE POLICY "Business owner manages webhooks" ON public.webhooks
  FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );


-- -------------------------------------------------------------------------
-- 5. Webhook Deliveries
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  webhook_id       UUID        REFERENCES public.webhooks(id) ON DELETE SET NULL,
  event_type       TEXT        NOT NULL,
  target_url       TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempt_count    INTEGER     NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  next_retry_at    TIMESTAMPTZ,
  response_code    INTEGER,
  response_body    TEXT,
  payload          JSONB,
  error_message    TEXT,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_business_status_idx
  ON public.webhook_deliveries (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_id_idx
  ON public.webhook_deliveries (webhook_id, created_at DESC)
  WHERE webhook_id IS NOT NULL;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business owner views webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Business owner views webhook deliveries" ON public.webhook_deliveries
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );


-- -------------------------------------------------------------------------
-- 6. Daily Stats Materialized View (for analytics optimisation)
-- -------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS public.business_daily_stats AS
SELECT
  business_id,
  DATE_TRUNC('day', created_at) AS stat_date,
  COUNT(*)                       AS conversation_count,
  COUNT(*) FILTER (WHERE source = 'widget')        AS widget_count,
  COUNT(*) FILTER (WHERE source = 'hosted_chat')   AS hosted_chat_count,
  COUNT(*) FILTER (WHERE source = 'dashboard_test') AS playground_count
FROM public.conversations
GROUP BY business_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS business_daily_stats_unique_idx
  ON public.business_daily_stats (business_id, stat_date);

-- Refresh function (call manually or via pg_cron)
CREATE OR REPLACE FUNCTION public.refresh_business_daily_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.business_daily_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------
-- 7. Grant permissions
-- -------------------------------------------------------------------------
GRANT SELECT ON public.business_daily_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_business_daily_stats TO service_role;
