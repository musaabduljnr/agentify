-- ============================================================
-- AI INTERACTION LOGS SCHEMA
-- ============================================================

create table if not exists public.ai_interaction_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  provider text,
  model text,
  fallback_used boolean default false,
  prompt_tokens_estimate integer,
  response_tokens_estimate integer,
  latency_ms integer,
  status text not null default 'success'
    check (status in ('success', 'failed', 'fallback_success')),
  error_message text,
  feature_source text check (feature_source in ('demo_generation', 'assistant_prompt_generation', 'welcome_message_generation', 'suggested_questions_generation', 'website_summary_generation', 'embeddings_generation', 'hosted_chat', 'playground', 'admin_test')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.ai_interaction_logs enable row level security;

-- Drop policy if exists and create new
drop policy if exists "Users can view own business AI logs" on public.ai_interaction_logs;
create policy "Users can view own business AI logs"
on public.ai_interaction_logs
for select
using (
  exists (
    select 1 from public.businesses
    where businesses.id = ai_interaction_logs.business_id
    and businesses.owner_id = auth.uid()
  )
);
