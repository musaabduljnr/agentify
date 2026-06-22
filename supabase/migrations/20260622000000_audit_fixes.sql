-- =========================================================================
-- Audit & Security Fixes Migration (Phase 1)
-- =========================================================================

-- 1. Subscriptions Unique Constraint Cleanup & Creation
WITH ranked_subscriptions AS (
  SELECT id, business_id,
         ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY updated_at DESC) as rn
  FROM public.subscriptions
),
duplicates_to_delete AS (
  SELECT id FROM ranked_subscriptions WHERE rn > 1
)
DELETE FROM public.subscriptions WHERE id IN (SELECT id FROM duplicates_to_delete);

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS unique_business_id_subscription;
ALTER TABLE public.subscriptions ADD CONSTRAINT unique_business_id_subscription UNIQUE (business_id);


-- 2. Widget Configs Unique Constraint Cleanup & Creation
WITH ranked_widget_configs AS (
  SELECT id, business_id,
         ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY updated_at DESC) as rn
  FROM public.widget_configs
),
widget_duplicates_to_delete AS (
  SELECT id FROM ranked_widget_configs WHERE rn > 1
)
DELETE FROM public.widget_configs WHERE id IN (SELECT id FROM widget_duplicates_to_delete);

ALTER TABLE public.widget_configs DROP CONSTRAINT IF EXISTS unique_business_id_widget_config;
ALTER TABLE public.widget_configs ADD CONSTRAINT unique_business_id_widget_config UNIQUE (business_id);


-- 3. Assistants Unique Active Assistant Constraint & Cleanup
WITH ranked_active_assistants AS (
  SELECT id, business_id,
         ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY updated_at DESC) as rn
  FROM public.assistants
  WHERE is_active = true
)
UPDATE public.assistants
SET is_active = false
WHERE id IN (
  SELECT id FROM ranked_active_assistants WHERE rn > 1
);

DROP INDEX IF EXISTS public.unique_active_assistant_per_business;
CREATE UNIQUE INDEX unique_active_assistant_per_business 
ON public.assistants (business_id) 
WHERE (is_active = true);


-- 4. Atomically Increment Subscription Usage RPC
CREATE OR REPLACE FUNCTION public.increment_subscription_usage(p_business_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.subscriptions
  SET current_usage = GREATEST(0, COALESCE(current_usage, 0) + p_amount),
      updated_at = NOW()
  WHERE business_id = p_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Atomic Demo Generator Counters RPCs
CREATE OR REPLACE FUNCTION public.increment_demo_conversation_count(p_demo_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.demo_businesses
  SET conversation_count = COALESCE(conversation_count, 0) + 1,
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = p_demo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_demo_message_count(p_demo_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.demo_businesses
  SET total_message_count = COALESCE(total_message_count, 0) + 1,
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = p_demo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_demo_lead_count(p_demo_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.demo_businesses
  SET lead_count = COALESCE(lead_count, 0) + 1,
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = p_demo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_demo_visitor_stats(
  p_demo_id UUID,
  p_visitor_inc INTEGER,
  p_page_view_inc INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.demo_businesses
  SET unique_visitor_count = COALESCE(unique_visitor_count, 0) + p_visitor_inc,
      page_view_count = COALESCE(page_view_count, 0) + p_page_view_inc,
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = p_demo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_demo_conversation_msg_count(
  p_conv_id UUID,
  p_last_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.demo_conversations
  SET last_message = p_last_message,
      message_count = COALESCE(message_count, 0) + 1,
      updated_at = NOW()
  WHERE id = p_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Set Active Assistant Transactional RPC
CREATE OR REPLACE FUNCTION public.set_active_assistant(p_business_id UUID, p_assistant_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Deactivate all other assistants for this business
  UPDATE public.assistants
  SET is_active = false
  WHERE business_id = p_business_id AND id <> p_assistant_id;

  -- Activate the target assistant
  UPDATE public.assistants
  SET is_active = true
  WHERE id = p_assistant_id AND business_id = p_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Row-Level Security (RLS) Tightening
-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Profiles viewable by owner or admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Demo Businesses
DROP POLICY IF EXISTS "Anyone can view active demo businesses" ON public.demo_businesses;
CREATE POLICY "Owner or admin can view demo businesses" ON public.demo_businesses
  FOR SELECT USING (
    created_by = auth.uid() OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );


-- 8. Sanitized Demo View for Public Access
DROP VIEW IF EXISTS public.sanitized_demo_businesses;
CREATE VIEW public.sanitized_demo_businesses AS
SELECT 
  id, 
  business_name, 
  website_url, 
  industry, 
  status, 
  demo_slug, 
  demo_url, 
  expires_at, 
  placeholder_business_id,
  created_at
FROM public.demo_businesses
WHERE status = 'active';

GRANT SELECT ON public.sanitized_demo_businesses TO anon, authenticated;


-- 9. conversations.source check constraint
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.conversations'::regclass
    and conname = 'conversations_source_check'
  ) then
    alter table public.conversations drop constraint conversations_source_check;
  end if;

  alter table public.conversations
  add constraint conversations_source_check
  check (source in ('dashboard_test', 'widget', 'hosted_chat', 'playground'));
end $$;


-- 10. Performance Composite Indexes
create index if not exists usage_logs_business_type_created_idx
on public.usage_logs(business_id, type, created_at);

create index if not exists messages_business_role_created_idx
on public.messages(business_id, role, created_at DESC);

create index if not exists leads_business_created_idx
on public.leads(business_id, created_at DESC);
