-- ============================================================
-- PLATFORM SETTINGS + EDITABLE BILLING PLANS
-- Run this in Supabase SQL editor before using editable admin plans.
-- ============================================================

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists public.billing_plan_overrides (
  plan_id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

alter table public.platform_settings enable row level security;
alter table public.billing_plan_overrides enable row level security;

drop policy if exists "Admins can manage platform settings" on public.platform_settings;
create policy "Admins can manage platform settings"
on public.platform_settings
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can manage billing plan overrides" on public.billing_plan_overrides;
create policy "Admins can manage billing plan overrides"
on public.billing_plan_overrides
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

insert into public.platform_settings (key, value)
values (
  'billing',
  jsonb_build_object(
    'currency', 'NGN',
    'currency_symbol', '₦',
    'default_payment_provider', 'paystack'
  )
)
on conflict (key) do nothing;

create index if not exists idx_platform_settings_updated_at on public.platform_settings(updated_at);
create index if not exists idx_billing_plan_overrides_updated_at on public.billing_plan_overrides(updated_at);
