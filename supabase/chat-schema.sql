create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  visitor_id text,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  source text not null default 'dashboard_test',
  status text not null default 'open' check (status in ('open', 'closed')),
  lead_captured boolean not null default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  retrieved_chunks jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users can view own business conversations"
on public.conversations
for select
using (
  exists (
    select 1 from public.businesses
    where businesses.id = conversations.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can insert own business conversations"
on public.conversations
for insert
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = conversations.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can update own business conversations"
on public.conversations
for update
using (
  exists (
    select 1 from public.businesses
    where businesses.id = conversations.business_id
    and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = conversations.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can view own business messages"
on public.messages
for select
using (
  exists (
    select 1 from public.businesses
    where businesses.id = messages.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can insert own business messages"
on public.messages
for insert
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = messages.business_id
    and businesses.owner_id = auth.uid()
  )
);

drop trigger if exists conversations_updated_at on public.conversations;

create trigger conversations_updated_at
before update on public.conversations
for each row
execute function public.handle_updated_at();

create index if not exists conversations_business_id_idx
on public.conversations(business_id);

create index if not exists messages_conversation_id_idx
on public.messages(conversation_id);

create index if not exists messages_business_id_idx
on public.messages(business_id);
