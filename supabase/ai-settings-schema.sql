-- ============================================================
-- AI ENGINE SETTINGS SCHEMA
-- Step 12: Dynamic AI Provider & Model Switching
-- ============================================================

create table if not exists public.ai_engine_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gemini'
    check (provider in ('gemini', 'openrouter', 'vertex', 'groq')),
  chat_model text not null default 'gemini-1.5-flash',
  embedding_provider text not null default 'gemini'
    check (embedding_provider in ('gemini', 'vertex')),
  embedding_model text not null default 'text-embedding-004',
  fallback_provider text default 'openrouter'
    check (fallback_provider in ('gemini', 'openrouter', 'vertex', 'groq')),
  fallback_chat_model text default 'openai/gpt-oss-20b:free',
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.ai_engine_settings enable row level security;

-- Admins can view settings
drop policy if exists "Admins can view AI engine settings" on public.ai_engine_settings;
create policy "Admins can view AI engine settings"
on public.ai_engine_settings
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Admins can update settings
drop policy if exists "Admins can update AI engine settings" on public.ai_engine_settings;
create policy "Admins can update AI engine settings"
on public.ai_engine_settings
for update
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

-- Auto-update trigger for updated_at
drop trigger if exists ai_engine_settings_updated_at on public.ai_engine_settings;
create trigger ai_engine_settings_updated_at
before update on public.ai_engine_settings
for each row
execute function public.handle_updated_at();

-- Seed initial settings row if table is empty
insert into public.ai_engine_settings (
  provider,
  chat_model,
  embedding_provider,
  embedding_model,
  fallback_provider,
  fallback_chat_model,
  is_active
)
select
  'gemini',
  'gemini-1.5-flash',
  'gemini',
  'gemini-embedding-2',
  'openrouter',
  'openai/gpt-oss-20b:free',
  true
where not exists (
  select 1 from public.ai_engine_settings
);
