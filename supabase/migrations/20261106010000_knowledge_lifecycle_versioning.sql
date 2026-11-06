-- Knowledge lifecycle versioning.
--
-- Stale-knowledge root cause: retrieval trusted every row in knowledge_chunks.
-- Chunks survived source replacement, failed re-indexing, and late indexing
-- jobs, so the assistant could answer with deleted or outdated content.
--
-- This migration makes the current, successfully indexed version of a source
-- the only retrievable version and lets conversations detect that knowledge
-- changed. It does not alter embeddings, similarity thresholds, retrieval
-- limits, or the crawler.

ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS content_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS indexed_version integer,
  ADD COLUMN IF NOT EXISTS index_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS index_run_id uuid,
  ADD COLUMN IF NOT EXISTS index_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz,
  ADD COLUMN IF NOT EXISTS index_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_sources_index_status_check'
      AND conrelid = 'public.knowledge_sources'::regclass
  ) THEN
    ALTER TABLE public.knowledge_sources
      ADD CONSTRAINT knowledge_sources_index_status_check
      CHECK (index_status IN ('pending', 'indexing', 'ready', 'failed'));
  END IF;
END;
$$;

ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS knowledge_version bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS knowledge_sources_business_index_status_idx
  ON public.knowledge_sources (business_id, index_status);

CREATE INDEX IF NOT EXISTS knowledge_chunks_source_version_idx
  ON public.knowledge_chunks (source_id, source_version);

-- Backfill from the state the application already recorded. A source is only
-- marked ready when its current content has embedded chunks; anything that
-- previously failed indexing stays ineligible until it is indexed again.
DO $$
BEGIN
  UPDATE public.knowledge_sources ks
  SET index_status = CASE
    -- A failed attempt wins even when older metadata still says embedded. The
    -- old metadata describes a previous success, not the latest attempt.
    WHEN ks.metadata->>'embedding_status' = 'failed' THEN 'failed'
    WHEN COALESCE(ks.metadata->>'embedded', 'false') IN ('true', '1')
      OR ks.metadata->>'embedding_status' = 'completed'
    THEN CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.knowledge_chunks kc
        WHERE kc.source_id = ks.id
          AND kc.business_id = ks.business_id
          AND kc.embedding IS NOT NULL
      ) THEN 'ready'
      ELSE 'pending'
    END
    ELSE 'pending'
  END;

  UPDATE public.knowledge_sources
  SET indexed_version = content_version,
      indexed_at = updated_at,
      index_error = NULL
  WHERE index_status = 'ready'
    AND indexed_version IS NULL;
END;
$$;

-- Changing extracted content, its source URL, or its document makes every
-- existing chunk ineligible immediately. The version bump is the guard that
-- prevents a late indexing run from finalising against newer content.
CREATE OR REPLACE FUNCTION public.knowledge_sources_track_content_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.source_url IS DISTINCT FROM OLD.source_url
     OR NEW.file_url IS DISTINCT FROM OLD.file_url
  THEN
    NEW.content_version := COALESCE(OLD.content_version, 1) + 1;
    NEW.index_status := 'pending';
    NEW.index_run_id := NULL;
    NEW.index_started_at := NULL;
    NEW.index_error := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_sources_track_content_version ON public.knowledge_sources;
CREATE TRIGGER knowledge_sources_track_content_version
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.knowledge_sources_track_content_version();

-- Conversations use this counter to detect that previously retrieved facts
-- may no longer be current. Metadata-only progress updates do not bump it.
CREATE OR REPLACE FUNCTION public.knowledge_sources_bump_business_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_business uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_business := OLD.business_id;
  ELSE
    target_business := NEW.business_id;
  END IF;

  IF TG_OP <> 'UPDATE'
     OR NEW.business_id IS DISTINCT FROM OLD.business_id
     OR NEW.content_version IS DISTINCT FROM OLD.content_version
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.index_status IS DISTINCT FROM OLD.index_status
     OR NEW.indexed_version IS DISTINCT FROM OLD.indexed_version
  THEN
    UPDATE public.businesses
    SET knowledge_version = COALESCE(knowledge_version, 0) + 1
    WHERE id = target_business;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_sources_bump_business_version ON public.knowledge_sources;
CREATE TRIGGER knowledge_sources_bump_business_version
  AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.knowledge_sources_bump_business_version();

-- Retrieval now joins the parent source and accepts only the source's current,
-- successfully indexed version. A deleted source cannot match because its
-- chunks cascade away and the join requires the parent row.
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
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
    kc.id,
    kc.source_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    COALESCE(kc.metadata, '{}'::jsonb) || jsonb_build_object(
      'source_version', kc.source_version,
      'indexed_version', ks.indexed_version,
      'content_version', ks.content_version,
      'index_status', ks.index_status,
      'source_status', ks.status
    ) as metadata
  from public.knowledge_chunks kc
  join public.knowledge_sources ks on ks.id = kc.source_id
  where kc.business_id = match_business_id
    and ks.business_id = match_business_id
    and kc.embedding is not null
    and ks.index_status = 'ready'
    and ks.indexed_version is not null
    and ks.indexed_version = ks.content_version
    and kc.source_version = ks.indexed_version
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

-- Owner diagnostics: one row per source, including counts of chunks that are
-- no longer part of the retrievable index.
CREATE OR REPLACE FUNCTION public.get_knowledge_consistency(p_business_id uuid)
RETURNS TABLE (
  source_id uuid,
  title text,
  source_status text,
  content_version integer,
  indexed_version integer,
  index_status text,
  indexed_at timestamptz,
  index_error text,
  chunk_count bigint,
  embedded_chunk_count bigint,
  current_version_chunk_count bigint,
  stale_chunk_count bigint,
  is_retrievable boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  select
    ks.id as source_id,
    ks.title,
    ks.status::text as source_status,
    ks.content_version,
    ks.indexed_version,
    ks.index_status,
    ks.indexed_at,
    ks.index_error,
    COUNT(kc.id) as chunk_count,
    COUNT(kc.id) FILTER (WHERE kc.embedding IS NOT NULL) as embedded_chunk_count,
    COUNT(kc.id) FILTER (
      WHERE kc.embedding IS NOT NULL
        AND kc.source_version = ks.indexed_version
        AND ks.indexed_version = ks.content_version
        AND ks.index_status = 'ready'
    ) as current_version_chunk_count,
    COUNT(kc.id) FILTER (
      WHERE kc.source_version IS DISTINCT FROM ks.indexed_version
        OR kc.embedding IS NULL
    ) as stale_chunk_count,
    (
      ks.index_status = 'ready'
      AND ks.indexed_version IS NOT NULL
      AND ks.indexed_version = ks.content_version
      AND COUNT(kc.id) FILTER (
        WHERE kc.embedding IS NOT NULL
          AND kc.source_version = ks.indexed_version
      ) > 0
    ) as is_retrievable
  from public.knowledge_sources ks
  left join public.knowledge_chunks kc
    on kc.source_id = ks.id
   and kc.business_id = ks.business_id
  where ks.business_id = p_business_id
  group by ks.id
  order by ks.created_at desc;
$$;

CREATE OR REPLACE FUNCTION public.count_orphaned_knowledge_chunks(p_business_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  select COUNT(*)
  from public.knowledge_chunks kc
  left join public.knowledge_sources ks on ks.id = kc.source_id
  where kc.business_id = p_business_id
    and (ks.id IS NULL OR ks.business_id <> kc.business_id);
$$;

-- Set a non-zero starting version for businesses that already have knowledge.
-- Pre-migration conversations have no stored version; this makes them treat
-- their earlier assistant answers as possibly outdated on the next turn,
-- instead of replaying them after the backfill.
UPDATE public.businesses b
SET knowledge_version = COALESCE(b.knowledge_version, 0) + 1
WHERE EXISTS (
  SELECT 1 FROM public.knowledge_sources ks WHERE ks.business_id = b.id
);

REVOKE ALL ON FUNCTION public.get_knowledge_consistency(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_orphaned_knowledge_chunks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_knowledge_consistency(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_orphaned_knowledge_chunks(uuid) TO authenticated, service_role;
