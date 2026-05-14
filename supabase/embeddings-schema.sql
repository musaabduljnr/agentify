-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Knowledge Chunks table for storing vector embeddings
create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  content text not null,
  embedding vector(768),
  chunk_index integer not null,
  token_estimate integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.knowledge_chunks enable row level security;

-- RLS Policies
create policy "Users can view own business chunks"
on public.knowledge_chunks
for select
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = knowledge_chunks.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can insert own business chunks"
on public.knowledge_chunks
for insert
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = knowledge_chunks.business_id
    and businesses.owner_id = auth.uid()
  )
);

create policy "Users can delete own business chunks"
on public.knowledge_chunks
for delete
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = knowledge_chunks.business_id
    and businesses.owner_id = auth.uid()
  )
);

-- Vector Search RPC Function
create or replace function public.match_knowledge_chunks(
  query_embedding vector(768),
  match_business_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language sql
stable
as $$
  select
    knowledge_chunks.id,
    knowledge_chunks.source_id,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity,
    knowledge_chunks.metadata
  from public.knowledge_chunks
  where knowledge_chunks.business_id = match_business_id
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- HNSW Index for efficient vector search
create index if not exists knowledge_chunks_embedding_idx
on public.knowledge_chunks
using hnsw (embedding vector_cosine_ops);
