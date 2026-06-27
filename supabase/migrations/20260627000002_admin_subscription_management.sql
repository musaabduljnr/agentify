-- Migration: Admin Subscription Management and Audit Logging

-- 1. Add metadata column to subscriptions if not exists
alter table public.subscriptions
add column if not exists metadata jsonb default '{}'::jsonb;

-- 2. Create admin_audit_logs table if not exists
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- 3. Enable RLS on admin_audit_logs
alter table public.admin_audit_logs enable row level security;

-- 4. Create Policy for admins
drop policy if exists "Admins can view audit logs"
on public.admin_audit_logs;

create policy "Admins can view audit logs"
on public.admin_audit_logs
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 5. Create policy for inserts (to allow admins to write logs)
drop policy if exists "Admins can insert audit logs"
on public.admin_audit_logs;

create policy "Admins can insert audit logs"
on public.admin_audit_logs
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);
