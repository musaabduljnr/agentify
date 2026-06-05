-- ============================================================
-- ADD MANUAL TAKEOVER SUPPORT TO CONVERSATIONS
-- ============================================================

-- Add is_manual_takeover column to conversations table
alter table public.conversations
add column if not exists is_manual_takeover boolean default false;
