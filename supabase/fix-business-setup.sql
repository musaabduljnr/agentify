-- 1. Ensure businesses.owner_id is unique (one business per user for MVP)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_owner_id_unique'
  ) then
    alter table public.businesses add constraint businesses_owner_id_unique unique (owner_id);
  end if;
end $$;

-- 2. Add missing columns to widget_configs
alter table public.widget_configs 
add column if not exists is_enabled boolean default true,
add column if not exists allowed_domains text[] default '{}',
add column if not exists collect_leads boolean default true;

-- 3. Ensure RLS policies are comprehensive
-- Businesses
drop policy if exists "Users can view their own business." on public.businesses;
create policy "Users can view their own business." on public.businesses
for select using (auth.uid() = owner_id);

drop policy if exists "Users can create their own business." on public.businesses;
create policy "Users can create their own business." on public.businesses
for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own business." on public.businesses;
create policy "Users can update their own business." on public.businesses
for update using (auth.uid() = owner_id);

-- Assistants
drop policy if exists "Users can view their own business assistants." on public.assistants;
create policy "Users can view their own business assistants." on public.assistants
for select using (
  exists (
    select 1 from public.businesses 
    where businesses.id = assistants.business_id 
    and businesses.owner_id = auth.uid()
  )
);

drop policy if exists "Users can manage their own business assistants." on public.assistants;
create policy "Users can manage their own business assistants." on public.assistants
for all using (
  exists (
    select 1 from public.businesses 
    where businesses.id = assistants.business_id 
    and businesses.owner_id = auth.uid()
  )
);

-- Widget Configs
drop policy if exists "Users can manage their own widget configs." on public.widget_configs;
create policy "Users can manage their own widget configs." on public.widget_configs
for all using (
  exists (
    select 1 from public.businesses 
    where businesses.id = widget_configs.business_id 
    and businesses.owner_id = auth.uid()
  )
);

-- Subscriptions
drop policy if exists "Users can view their own subscriptions." on public.subscriptions;
create policy "Users can view their own subscriptions." on public.subscriptions
for select using (
  exists (
    select 1 from public.businesses 
    where businesses.id = subscriptions.business_id 
    and businesses.owner_id = auth.uid()
  )
);

-- Ensure all tables have updated_at triggers
-- (They were already in business-schema.sql, but good to keep in mind)
