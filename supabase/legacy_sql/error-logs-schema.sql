-- ============================================================
-- Error Logs Table
-- Purpose: Persist server-side errors for observability.
--          Never expose contents to end users.
-- ============================================================

create table if not exists public.error_logs (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        references public.businesses(id) on delete set null,
  user_id     uuid        references auth.users(id)        on delete set null,
  source      text        not null,   -- e.g. 'widget-chat', 'paystack-webhook'
  message     text        not null,
  stack       text,                   -- stack trace (never sent to client)
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- Indexes for admin queries
create index if not exists error_logs_business_id_idx  on public.error_logs (business_id) where business_id is not null;
create index if not exists error_logs_source_idx       on public.error_logs (source);
create index if not exists error_logs_created_at_idx   on public.error_logs (created_at desc);

-- RLS: Only service role and admins can access
alter table public.error_logs enable row level security;

create policy "Admins can read error logs"
  on public.error_logs
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
