-- Preserve the legacy business-wide email preferences before replacing their
-- single-row schema with per-category, per-channel preferences.
DO $$
BEGIN
  IF to_regclass('public.notification_preferences') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'notification_preferences'
         AND column_name = 'category'
     ) THEN
    IF to_regclass('public.notification_preferences_legacy') IS NOT NULL THEN
      RAISE EXCEPTION 'Both legacy and normalized notification preference tables exist; resolve the legacy table name before migrating.';
    END IF;
    ALTER TABLE public.notification_preferences RENAME TO notification_preferences_legacy;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('leads', 'booking', 'support', 'usage', 'billing', 'knowledge', 'team', 'system')
  ),
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_preferences_user_not_zero CHECK (
    user_id IS NULL OR user_id <> '00000000-0000-0000-0000-000000000000'::UUID
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_scope_category_unique
  ON public.notification_preferences (business_id, user_id, category) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS notification_preferences_business_category_idx
  ON public.notification_preferences (business_id, category);

DO $$
DECLARE
  legacy_row RECORD;
  category_row RECORD;
BEGIN
  IF to_regclass('public.notification_preferences_legacy') IS NULL THEN
    RETURN;
  END IF;

  FOR legacy_row IN
    EXECUTE 'SELECT business_id, email_new_leads, email_booking_requests, email_support_requests, email_usage_warnings, email_payment_updates FROM public.notification_preferences_legacy'
  LOOP
    FOR category_row IN
      SELECT *
      FROM (VALUES
        ('leads', legacy_row.email_new_leads),
        ('booking', legacy_row.email_booking_requests),
        ('support', legacy_row.email_support_requests),
        ('usage', legacy_row.email_usage_warnings),
        ('billing', legacy_row.email_payment_updates),
        ('knowledge', TRUE),
        ('team', TRUE),
        ('system', TRUE)
      ) AS preferences(category, email_enabled)
    LOOP
      INSERT INTO public.notification_preferences (
        business_id, category, in_app_enabled, email_enabled
      )
      VALUES (
        legacy_row.business_id, category_row.category, TRUE,
        COALESCE(category_row.email_enabled, TRUE)
      )
      ON CONFLICT (business_id, user_id, category) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.notification_preferences_legacy') IS NOT NULL THEN
    ALTER TABLE public.notification_preferences_legacy ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.notification_preferences_legacy FROM anon, authenticated;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('leads', 'booking', 'support', 'usage', 'billing', 'knowledge', 'team', 'system')
  ),
  event_key TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '/dashboard',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (
    severity IN ('info', 'success', 'warning', 'critical')
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  CONSTRAINT notifications_event_recipient_unique UNIQUE (business_id, user_id, event_key)
);

CREATE INDEX IF NOT EXISTS notifications_user_feed_idx
  ON public.notifications (user_id, business_id, created_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id, business_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;

INSERT INTO public.notifications (
  business_id, user_id, category, event_key, title, message, href, severity, metadata
)
SELECT
  s.business_id,
  b.owner_id,
  'billing',
  'billing-status:' || s.id::TEXT || ':' || s.status || ':' || COALESCE(s.current_period_end::TEXT, ''),
  'Billing needs attention',
  'Your subscription is ' || REPLACE(s.status, '_', ' ') || '.',
  '/dashboard/billing',
  CASE WHEN s.status IN ('past_due', 'unpaid') THEN 'critical' ELSE 'warning' END,
  jsonb_build_object('subscriptionId', s.id, 'status', s.status)
FROM public.subscriptions s
JOIN public.businesses b ON b.id = s.business_id
WHERE s.status IN ('past_due', 'unpaid', 'cancelled', 'canceled', 'paused', 'expired')
ON CONFLICT (business_id, user_id, event_key) DO NOTHING;

INSERT INTO public.notifications (
  business_id, user_id, category, event_key, title, message, href, severity, metadata
)
SELECT
  ks.business_id,
  b.owner_id,
  'knowledge',
  'knowledge-processing-failed:' || ks.id::TEXT,
  'Knowledge source processing failed',
  COALESCE('“' || ks.title || '” could not be processed. Review it and try again.', 'A knowledge source could not be processed. Review it and try again.'),
  '/dashboard/knowledge',
  'critical',
  jsonb_build_object('sourceId', ks.id)
FROM public.knowledge_sources ks
JOIN public.businesses b ON b.id = ks.business_id
WHERE ks.status = 'failed'
ON CONFLICT (business_id, user_id, event_key) DO NOTHING;

INSERT INTO public.notifications (
  business_id, user_id, category, event_key, title, message, href, severity, metadata
)
SELECT
  l.business_id,
  b.owner_id,
  'leads',
  'migration-snapshot:new-leads:' || to_char(NOW(), 'YYYYMMDD'),
  'New leads captured',
  COUNT(*)::TEXT || ' new lead' || CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END || ' in the last 24 hours.',
  '/dashboard/leads',
  'success',
  jsonb_build_object('count', COUNT(*), 'snapshot', TRUE)
FROM public.leads l
JOIN public.businesses b ON b.id = l.business_id
WHERE l.status = 'new'
  AND l.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY l.business_id, b.owner_id
ON CONFLICT (business_id, user_id, event_key) DO NOTHING;

INSERT INTO public.notifications (
  business_id, user_id, category, event_key, title, message, href, severity, metadata
)
SELECT
  c.business_id,
  b.owner_id,
  'support',
  'migration-snapshot:open-conversations:' || to_char(NOW(), 'YYYYMMDD'),
  'Open conversations',
  COUNT(*)::TEXT || ' active conversation' || CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END || ' updated in the last 24 hours.',
  '/dashboard/conversations',
  'info',
  jsonb_build_object('count', COUNT(*), 'snapshot', TRUE)
FROM public.conversations c
JOIN public.businesses b ON b.id = c.business_id
WHERE c.status = 'open'
  AND c.updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY c.business_id, b.owner_id
ON CONFLICT (business_id, user_id, event_key) DO NOTHING;

INSERT INTO public.notifications (
  business_id, user_id, category, event_key, title, message, href, severity, metadata
)
SELECT
  ks.business_id,
  b.owner_id,
  'knowledge',
  'migration-snapshot:knowledge-not-embedded:' || to_char(NOW(), 'YYYYMMDD'),
  'Knowledge ready to embed',
  COUNT(*)::TEXT || ' trained source' || CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END || ' still need chunks.',
  '/dashboard/knowledge',
  'warning',
  jsonb_build_object('count', COUNT(*), 'snapshot', TRUE)
FROM public.knowledge_sources ks
JOIN public.businesses b ON b.id = ks.business_id
WHERE ks.status = 'trained'
  AND COALESCE(ks.metadata->>'embedded', 'false') <> 'true'
GROUP BY ks.business_id, b.owner_id
ON CONFLICT (business_id, user_id, event_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  recipient TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_deliveries_notification_idx
  ON public.notification_deliveries (notification_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '/dashboard',
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  audience_all_businesses BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (
    status IN ('sending', 'sent', 'partial', 'failed')
  ),
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  error_details JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_announcements_created_idx
  ON public.notification_announcements (created_at DESC);

CREATE OR REPLACE FUNCTION public.can_access_notification_business(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.business_members bm
          WHERE bm.business_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.status = 'active'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_notification_preferences(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.business_members bm
    WHERE bm.business_id = p_business_id
      AND bm.user_id = auth.uid()
      AND bm.status = 'active'
      AND bm.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_notification_business(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_notification_preferences(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_notification_business(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_notification_preferences(UUID) TO authenticated;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;
REVOKE ALL ON public.notification_announcements FROM anon, authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.notification_deliveries TO service_role;
GRANT ALL ON public.notification_announcements TO service_role;

DROP POLICY IF EXISTS "Business members can read notification preferences" ON public.notification_preferences;
CREATE POLICY "Business members can read notification preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (public.can_access_notification_business(business_id));

DROP POLICY IF EXISTS "Business admins can manage notification preferences" ON public.notification_preferences;
CREATE POLICY "Business admins can manage notification preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id IS NULL AND public.can_manage_notification_preferences(business_id))
  WITH CHECK (user_id IS NULL AND public.can_manage_notification_preferences(business_id));

DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage their own notification preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_access_notification_business(business_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_notification_business(business_id)
  );

DROP POLICY IF EXISTS "Users can read their business notifications" ON public.notifications;
CREATE POLICY "Users can read their business notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_access_notification_business(business_id)
  );

DROP POLICY IF EXISTS "Users can update their business notifications" ON public.notifications;
CREATE POLICY "Users can update their business notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_access_notification_business(business_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_notification_business(business_id)
  );

DROP POLICY IF EXISTS "Users can read their notification deliveries" ON public.notification_deliveries;
CREATE POLICY "Users can read their notification deliveries"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.id = notification_id
        AND n.user_id = auth.uid()
        AND public.can_access_notification_business(n.business_id)
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
