-- ============================================================
-- UPGRADE KNOWLEDGE SOURCES FOR CRAWLING SUPPORT
-- ============================================================

alter table public.knowledge_sources
add column if not exists crawl_mode text default 'single'
  check (crawl_mode in ('single', 'crawl')),
add column if not exists crawl_status text default 'not_started'
  check (crawl_status in ('not_started', 'discovering', 'crawling', 'completed', 'failed', 'partial')),
add column if not exists crawl_depth integer default 1,
add column if not exists max_pages integer default 10,
add column if not exists pages_found integer default 0,
add column if not exists pages_scraped integer default 0,
add column if not exists pages_failed integer default 0,
add column if not exists crawl_started_at timestamp with time zone,
add column if not exists crawl_completed_at timestamp with time zone,
add column if not exists crawled_pages jsonb default '[]'::jsonb,
add column if not exists failed_pages jsonb default '[]'::jsonb;
