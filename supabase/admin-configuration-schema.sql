-- ============================================================
-- PLATFORM CONFIGURATIONS & AUDIT LOGS SCHEMA
-- ============================================================

-- Create platform_configurations table
create table if not exists public.platform_configurations (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  key text not null,
  value text,
  encrypted_value text,
  is_secret boolean default false,
  is_active boolean default true,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint platform_configurations_category_key_unique unique (category, key)
);

-- Create admin_audit_logs table
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS on platform_configurations
alter table public.platform_configurations enable row level security;

-- Enable RLS on admin_audit_logs
alter table public.admin_audit_logs enable row level security;

-- Admins can do all actions on platform_configurations
drop policy if exists "Admins can manage platform_configurations" on public.platform_configurations;
create policy "Admins can manage platform_configurations"
on public.platform_configurations
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

-- Admins can do all actions on admin_audit_logs (specifically select and insert)
drop policy if exists "Admins can manage admin_audit_logs" on public.admin_audit_logs;
create policy "Admins can manage admin_audit_logs"
on public.admin_audit_logs
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

-- Trigger for auto updating updated_at column on configurations
drop trigger if exists platform_configurations_updated_at on public.platform_configurations;
create trigger platform_configurations_updated_at
before update on public.platform_configurations
for each row
execute function public.handle_updated_at();

-- Seed initial non-sensitive default configurations if empty
insert into public.platform_configurations (category, key, value, is_secret, description)
values
  ('email', 'default_provider', 'resend', false, 'Default email provider (resend or smtp)'),
  ('email', 'from_email', 'noreply@agentifyhq.com', false, 'Standard sender address for emails'),
  ('email', 'from_name', 'Agentify', false, 'Standard sender display name'),
  ('platform', 'default_payment_provider', 'paystack', false, 'Default checkout provider (paystack or flutterwave)'),
  ('feature_flags', 'enable_emails', 'true', false, 'Global toggle to enable email dispatching'),
  ('feature_flags', 'enable_payments', 'true', false, 'Global toggle to enable payments and checkout'),
  ('feature_flags', 'enable_widget', 'true', false, 'Global toggle to enable external widget chat'),
  ('feature_flags', 'enable_hosted_chat', 'true', false, 'Global toggle to enable hosted chat links'),
  ('feature_flags', 'enable_demo_generator', 'true', false, 'Global toggle for demo generation'),
  ('feature_flags', 'enable_admin_demo_crm', 'true', false, 'Global toggle for the admin demo crm'),
  ('feature_flags', 'enable_analytics', 'true', false, 'Global toggle for system analytics'),
  ('feature_flags', 'enable_maintenance_mode', 'false', false, 'Block normal workspace access and show maintenance screen')
on conflict (category, key) do nothing;
