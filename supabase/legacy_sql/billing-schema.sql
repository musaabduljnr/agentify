-- ============================================================
-- BILLING & SUBSCRIPTION SCHEMA UPDATE
-- Step 10: Usage Limits + Subscription Logic
-- ============================================================

-- 1. Extend public.subscriptions with billing and provider columns safely
alter table public.subscriptions
add column if not exists payment_provider text default 'manual'
  check (payment_provider in ('manual', 'paystack', 'flutterwave')),
add column if not exists provider_customer_id text,
add column if not exists provider_subscription_id text,
add column if not exists provider_plan_code text,
add column if not exists provider_reference text,
add column if not exists knowledge_limit integer default 5,
add column if not exists lead_limit integer default 50,
add column if not exists widget_limit integer default 1,
add column if not exists embedding_limit integer default 1000,
add column if not exists reset_date timestamp with time zone,
add column if not exists current_period_start timestamp with time zone,
add column if not exists current_period_end timestamp with time zone,
add column if not exists cancel_at_period_end boolean default false,
add column if not exists metadata jsonb default '{}'::jsonb;

-- 2. Alter column defaults for new registrations
alter table public.subscriptions
alter column plan set default 'free_trial';

alter table public.subscriptions
alter column status set default 'active';

-- 3. Create public.usage_logs table
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  type text not null check (
    type in ('message', 'embedding', 'lead', 'knowledge_source', 'widget_chat')
  ),
  amount integer not null default 1,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- 4. Enable Row Level Security (RLS) and policies
alter table public.usage_logs enable row level security;

drop policy if exists "Users can view own business usage logs" on public.usage_logs;
create policy "Users can view own business usage logs"
on public.usage_logs
for select
using (
  exists (
    select 1 from public.businesses
    where businesses.id = usage_logs.business_id
    and businesses.owner_id = auth.uid()
  )
);

-- 5. Add Performance Indexes (Crucial for page-load speeds)
create index if not exists idx_usage_logs_business_id on public.usage_logs(business_id);
create index if not exists idx_usage_logs_type on public.usage_logs(type);
create index if not exists idx_usage_logs_created_at on public.usage_logs(created_at);
create index if not exists idx_subscriptions_business_id on public.subscriptions(business_id);

-- 6. Setup default reset dates on any pre-existing null subscription records
update public.subscriptions 
set reset_date = now() + interval '30 days',
    current_period_start = now(),
    current_period_end = now() + interval '30 days'
where reset_date is null;
