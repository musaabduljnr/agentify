-- Lead Capture Table
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  name text,
  email text,
  phone text,
  company text,
  interest text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'converted', 'closed')),
  source text not null default 'widget',
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.leads enable row level security;

-- RLS Policies
create policy "Users can view own business leads"
on public.leads
for select
using (
  exists (
    select 1 from public.businesses
    where businesses.id = leads.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can insert own business leads"
on public.leads
for insert
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = leads.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can update own business leads"
on public.leads
for update
using (
  exists (
    select 1 from public.businesses
    where businesses.id = leads.business_id
    and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = leads.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can delete own business leads"
on public.leads
for delete
using (
  exists (
    select 1 from public.businesses
    where businesses.id = leads.business_id
    and businesses.owner_id = auth.uid()
  )
);

-- Updated At Trigger
drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
before update on public.leads
for each row
execute function public.handle_updated_at();
