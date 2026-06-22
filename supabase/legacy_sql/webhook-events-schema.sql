-- ============================================================
-- Webhook Events Table
-- Purpose: Idempotency guard for incoming provider webhooks.
--          Prevents the same event from being processed twice.
-- ============================================================

create table if not exists public.webhook_events (
  id           uuid        primary key default gen_random_uuid(),
  provider     text        not null,           -- e.g. 'paystack', 'stripe'
  event_id     text,                           -- provider-assigned event ID
  event_type   text        not null,           -- e.g. 'charge.success'
  reference    text,                           -- payment reference if applicable
  processed    boolean     not null default false,
  payload      jsonb       not null default '{}',
  created_at   timestamptz not null default now()
);

-- Unique index to prevent duplicate processing of the same event
create unique index if not exists webhook_events_provider_event_id_idx
  on public.webhook_events (provider, event_id)
  where event_id is not null;

-- Index for reference lookups
create index if not exists webhook_events_reference_idx
  on public.webhook_events (reference)
  where reference is not null;

-- Index for time-based queries
create index if not exists webhook_events_created_at_idx
  on public.webhook_events (created_at desc);

-- RLS: Only service role can read/write. No public access.
alter table public.webhook_events enable row level security;

-- Admins can inspect webhook events for debugging
create policy "Admins can view webhook events"
  on public.webhook_events
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
