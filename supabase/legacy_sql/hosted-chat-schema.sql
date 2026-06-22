alter table public.widget_configs
add column if not exists hosted_chat_enabled boolean default true,
add column if not exists hosted_chat_slug text unique,
add column if not exists hosted_chat_title text,
add column if not exists hosted_chat_description text;

update public.widget_configs wc
set hosted_chat_slug = b.slug
from public.businesses b
where wc.business_id = b.id
and wc.hosted_chat_slug is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.conversations'::regclass
    and conname = 'conversations_source_check'
  ) then
    alter table public.conversations drop constraint conversations_source_check;
  end if;

  alter table public.conversations
  add constraint conversations_source_check
  check (source in ('dashboard_test', 'widget', 'hosted_chat'));
end $$;
