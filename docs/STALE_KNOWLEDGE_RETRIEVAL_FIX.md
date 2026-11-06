# Agentify — Stale Knowledge Retrieval Fix

**Baseline:** `d61d484` — `fix(ai): harden price gate, widget history, and visitor ownership`
**Scope:** deleted, failed, superseded, or replaced knowledge must never reach the assistant
**Date:** 2026-11-06
**Mode:** targeted lifecycle correction; no engine, provider, crawler, threshold, billing, or API rewrite

---

## 1. Summary

The assistant could answer with knowledge the owner had deleted or replaced. The primary cause was not the model and not the similarity threshold: **retrieval selected rows from `knowledge_chunks` without checking the lifecycle of the parent source**. Any chunk that still existed in the table was eligible, regardless of whether its source had been deleted, had failed re-indexing, belonged to an older content version, or came from a different indexing run. A secondary cause is conversation memory: earlier assistant answers (for example "₦100,000, 7 days") were replayed into later turns after the knowledge base changed.

The fix makes three layers agree:

1. **Database:** sources carry a content version and an index status; chunks carry the source version they were built from; retrieval joins the source and accepts only its current, successfully indexed version.
2. **Indexing:** runs claim a version with a run id, can be superseded, and cannot publish or delete another run's content.
3. **Conversation:** after the business knowledge version changes, earlier assistant answers and business facts in the conversation summary are no longer treated as current.

No prompt was changed to hide a data problem. Prompt text was only extended to state the consequence of a change that the database and conversation layer already detect.

The similarity threshold (`0.55`), retrieval limits (2/5), embedding provider/model (`768` dimensions), pgvector/HNSW layout, crawler, quality gate, billing, and public APIs are unchanged.

---

## 2. System map (what was audited)

| Stage | Location | Storage / mechanism |
| --- | --- | --- |
| Source creation | `lib/actions/knowledge.ts`, `lib/actions/instant-generator.ts`, `lib/actions/demo-generator.ts` | `knowledge_sources` |
| Website extraction | `lib/scraper/crawl-website.ts`, `lib/actions/knowledge.ts` | `knowledge_sources.content`, `crawled_pages`, `failed_pages` |
| Manual/document content | `lib/actions/knowledge.ts` | `knowledge_sources.content`, Supabase Storage `business-documents` |
| Chunking | `lib/embeddings/chunker.ts` | In-memory, then `knowledge_chunks.content` |
| Embedding | `lib/embeddings/generate-source.ts`, `lib/ai/engine/embeddings.ts` | `knowledge_chunks.embedding vector(768)` |
| Index orchestration | Inline server action (`indexSourceContent`), manual "Embed Content", instant/demo generators | No separate queue or cron for embeddings |
| Retrieval | `lib/ai/rag/retrieve-context.ts` → RPC `match_knowledge_chunks` | pgvector cosine + HNSW |
| Selection | threshold → dedupe → intent rerank → dynamic limit | `lib/ai/rag/select-chunks.ts` |
| Context | `lib/ai/rag/build-context.ts` | Formatted excerpts only |
| Conversation memory | `lib/actions/chat/run-business-chat.ts`, `lib/ai/memory/conversation-summary.ts` | `conversations.metadata.summary` |
| Source deletion | `lib/actions/knowledge.ts` | `knowledge_sources` delete (FK cascade to chunks) |
| Owner diagnostics | `app/dashboard/knowledge/page.tsx` | `get_knowledge_consistency` RPC |

**Caches:** there is no application-level retrieval cache and no cross-conversation answer cache. The only caches are Next.js path revalidation (`revalidatePath`) for dashboard rendering and the conversation summary, which is memory rather than retrieval. The summary is now version-aware (section 5.6).

**Association:** knowledge is scoped to a business, not to an individual assistant. Every assistant in one business uses the same knowledge base; this is existing behaviour and was not changed. Business separation is enforced on both the chunk and source side of the retrieval join.

---

## 3. Root causes

### RC-1 (primary) — retrieval did not validate source lifecycle

Before the fix, `match_knowledge_chunks` was:

```sql
select id, source_id, content, 1 - (embedding <=> query_embedding) as similarity, metadata
from public.knowledge_chunks
where business_id = match_business_id
order by embedding <=> query_embedding
limit match_count;
```

There was no join to `knowledge_sources`, no `index_status` check, no version check, and no existence check. A chunk row was retrievable by definition. That makes every one of the following a leak path:

- chunks left behind by a **failed rebuild of changed content** (the old index is intentionally kept while the replacement is built; on failure it stayed eligible forever);
- chunks left behind by a **zero-chunk failure** (`records.length === 0` returned before cleanup);
- **orphaned rows** from legacy data, a partially applied delete, manual database work, or any path where the foreign-key cascade did not run;
- chunks from a **superseded/duplicate indexing run**, because runs had no version or identity;
- a second source that still existed while a "replacement" source was added. Two active sources are both legitimate knowledge from the database's point of view, so both were returned and the older, more specifically worded chunk often had the higher similarity.

The last two cases explain why the assistant could still say ₦100,000 / 7 days after the owner believed the old source was gone.

### RC-2 — deletion was not an explicit lifecycle transition

`deleteKnowledgeSource` previously issued a single `delete` through the RLS client and returned only a generic error. It relied entirely on `on delete cascade` to remove chunks, did not deactivate the source first, did not clean up the stored document, and the table UI ignored the action result. If deletion failed or left orphan chunks, the assistant kept answering from them and the owner saw no error.

### RC-3 — indexing runs were unversioned and unfenced

A run read the source, generated vectors, inserted rows, deleted "everything not inserted by me", and updated metadata. Two runs could overlap; a late run could delete rows written by a newer run and could publish old content as the current index. A content edit during a run did not invalidate that run.

### RC-4 — conversation history replayed obsolete facts

`run-business-chat` passed the last eight turns, including assistant answers, back to the model, and the rolling summary included business facts stated by the assistant. Even with correct retrieval, an existing conversation could repeat the old price from its own history. The prompt had a general "current context wins" rule but no signal that the knowledge base had actually changed.

### RC-5 — no visibility

There was no owner-visible way to see which sources were retrievable, how many chunks were current, whether an index had failed, or whether orphan chunks existed. The problem could therefore persist silently.

### What was ruled out

- **No retrieval cache:** no Redis/DB/application cache is used for chunks; `revalidatePath` only re-renders the dashboard.
- **Embedding provider:** unchanged; dimensions and batch flow are unchanged.
- **Vector architecture:** pgvector + HNSW unchanged; no threshold or limit tuning.
- **Crawler:** unchanged.
- **Billing/subscription limits:** unchanged.
- **Hallucination/quality checks:** unchanged (no rule was weakened).

---

## 4. Reproduction

### 4.1 Environment limitation (important)

This workspace has **no `.env.local`, no model/embedding API key, and no local or production database**. A live end-to-end reproduction against the production Supabase project was therefore **not executed**, and no production data was read, written, re-indexed, or cleaned up. The reproduction below is a deterministic fixture that reconstructs the pre-fix retrieval contract from the old SQL and selection code. The actual prompt-context output was executed and captured; the pre-fix candidate set is a reconstruction, not a captured production response.

### 4.2 Fixture

Business: NovaTech Studio. One assistant. All chunks share the title "Basic Website Package".

| Chunk | Source state | Content | Similarity |
| --- | --- | --- | --- |
| `chunk-old-100k` | old source, `index_status = pending` (deleted/replaced) | ₦100,000, delivery 7 days | 0.93 |
| `chunk-failed-200k` | source `index_status = failed` | ₦200,000, delivery 10 days | 0.91 |
| `chunk-superseded-v1` | same source, chunk `source_version = 1`, source indexed at 2 | ₦100,000, delivery 7 days | 0.90 |
| `chunk-current-350k` | same source, chunk `source_version = 2`, source `ready` at 2 | ₦350,000, delivery 21 working days | 0.88 |

Before the fix, all four exceed the `0.55` threshold, are distinct after deduplication, and fit within the dynamic limit; the old chunk ranks first. The old SQL performs no eligibility check, so the reconstructed model context would have contained all four, with ₦100,000 first.

### 4.3 Captured context after the fix

From `tests/stale-knowledge-retrieval.test.ts` (executed):

```text
Verified excerpts from the business knowledge base:

[Knowledge 1] Source: Basic Website Package [type: manual]
Basic Website Package costs ₦350,000. Delivery takes 21 working days after we receive the requirements and content. It includes a five-page website, mobile-responsive design, and two rounds of revisions.
```

Assertions on that string: contains `₦350,000` and `21 working days`; does **not** contain `₦100,000`, `₦200,000`, or `7 days after payment`.

- **New conversation:** cost query and delivery query both select the replacement chunk.
- **Existing conversation:** the model call receives the knowledge-updated instruction plus the same replacement context; the mocked provider returns ₦350,000 / 21 working days, and the prompt does not contain ₦100,000. Assistant messages are tagged with the knowledge version that produced them, so an older answer is also excluded from later turns rather than only the turn where the change is detected.
- **Two businesses:** chunks from business B are never returned for business A by the RPC filters, and the application-level filter is covered for multiple active sources.
- **Indexing lifecycle:** a late run cannot finalise against a newer `content_version`, cannot delete chunks with a newer `source_version`, and a failed rebuild of unchanged content leaves the prior ready index in place.
- **Deletion:** the source is deactivated before any delete; chunks are removed explicitly; fetch/update/delete failures are returned to the UI; storage is removed only when no other source references the file.

---

## 5. Fix

### 5.1 Lifecycle fields (migration `20261106010000_knowledge_lifecycle_versioning.sql`)

| Object | Change |
| --- | --- |
| `knowledge_sources` | `content_version` (default 1), `indexed_version`, `index_status` (`pending`, `indexing`, `ready`, `failed`), `index_run_id`, `index_started_at`, `indexed_at`, `index_error` |
| `knowledge_chunks` | `source_version` (default 1) |
| `businesses` | `knowledge_version bigint` (monotonic change counter for conversations) |
| Triggers | content/URL/file change bumps `content_version`, clears run state, sets `pending`; insert/delete/version/status changes bump the business counter |
| RPC | `match_knowledge_chunks` now joins the source and filters eligibility |
| Diagnostics | `get_knowledge_consistency`, `count_orphaned_knowledge_chunks` (`SECURITY INVOKER`, granted to `authenticated`/`service_role` only) |

The business counter deliberately ignores metadata-only progress updates, so chunk-count/embedding metadata writes do not invalidate conversations.

### 5.2 Retrieval

`match_knowledge_chunks` now requires all of:

```sql
kc.business_id = match_business_id
and ks.business_id = match_business_id          -- no cross-business association
and kc.embedding is not null
and ks.index_status = 'ready'
and ks.indexed_version is not null
and ks.indexed_version = ks.content_version     -- current content
and kc.source_version = ks.indexed_version      -- chunk built from it
```

plus an inner join to `knowledge_sources`, so a deleted source cannot match even if a chunk row survives. Returned metadata is merged with lifecycle fields so the application can apply a second filter.

`lib/ai/rag/retrieve-context.ts` applies `filterCurrentKnowledgeChunks` before any threshold/rerank work, and records `staleExcluded` in diagnostics. `lib/knowledge/lifecycle.ts` is the single eligibility definition:

```ts
index_status === "ready"
&& indexed_version === content_version
&& source_version === indexed_version
```

Legacy rows with no lifecycle metadata are passed through, because the RPC remains authoritative; this keeps pre-migration data working while the migration backfill runs. The owner-only knowledge search (`searchKnowledge`, used by the Playground test panel) applies the same filter.

### 5.3 Indexing state machine

`lib/embeddings/generate-source.ts` now:

1. Reads `content_version` and whether the existing index is current (`isReindexingCurrentContent`).
2. **Claims** the run atomically: updates `index_run_id`/`index_started_at` only if the source still has the same `content_version` and no fresh run is active (15-minute stale-run cutoff).
3. For changed content, sets `indexing` immediately; for an unchanged re-index, keeps the previous index `ready` and available during the rebuild.
4. Inserts new rows with `source_version = content_version`.
5. Re-reads the source and verifies the run still owns it; a superseded run deletes only the rows it inserted and exits.
6. Finalises with a conditional update on both `content_version` and `index_run_id`.
7. Deletes older rows **only after** finalisation and **only** for `source_version <= target`. Cleanup failure is logged and surfaced by diagnostics, never served.
8. On error, deletes its own inserted rows and restores `ready` only when it was rebuilding unchanged content; otherwise the source stays `failed`, so changed-but-unindexed content is never served.

A late run therefore cannot publish old content, mark it ready, or delete newer chunks.

`lib/actions/instant-generator.ts` writes the same lifecycle fields (`source_version = 1`, `index_status = ready`, `indexed_version = 1`) when it creates a source during onboarding.

### 5.4 Deletion

`deleteKnowledgeSource`:

1. Loads the source through the service client and verifies the current owner's `business_id`.
2. Sets `index_status = pending` and clears run state **before** deleting anything; retrieval excludes it immediately even if later steps fail.
3. Deletes the source's chunks explicitly.
4. Deletes the source row (cascade is a fallback, not the primary mechanism).
5. Removes the document from `business-documents` only when no other source references the same file.
6. Revalidates the dashboard and returns errors to the table, which now displays them.

A pending indexing job cannot recreate the source: its finalise update matches zero rows (source gone) and its inserted rows are removed.

### 5.5 Replacement

- Editing content in place bumps `content_version` via trigger, excludes the old version immediately, and the editor triggers a fresh index. Old chunks become ineligible at once and are deleted after the new index is complete.
- Deleting the old source and adding a new one is handled by the deletion flow above (immediate exclusion) and normal indexing of the new source.
- A failed replacement leaves the source `failed` (ineligible) rather than showing old prices as current.

### 5.6 Conversation freshness

- `businesses.knowledge_version` changes when a source is added/deleted, its content version changes, or its index becomes ready/failed.
- `run-business-chat` compares it with `conversations.metadata.knowledge_version` (recorded after each successful turn).
- When they differ: assistant turns are dropped from history (visitor questions are kept for follow-up retrieval), the summary is treated as stale, and `knowledgeUpdated` adds an explicit instruction that earlier answers may be outdated and the current context is the only truth.
- Each assistant message also stores the knowledge version that produced it. History loading keeps an assistant turn only while its stored version equals the business's current version, so an old answer cannot reappear on later turns after the detection turn has passed. Visitor turns are always kept; untagged answers are excluded once the business has versioned knowledge.
- Summaries are tagged with `summary_knowledge_version`; a summary from an older knowledge version is ignored and regenerated without business facts. Its prompt now explicitly excludes prices/policies/hours/availability.
- The shared system prompt adds one grounding rule: never repeat a detail from conversation history when it is missing from, or different in, current context.
- Pre-migration conversations have no stored version; they are treated as stale only after the business counter actually moves, so ordinary old conversations do not lose context for no reason.

### 5.7 Owner diagnostics

`app/dashboard/knowledge/page.tsx` renders `KnowledgeConsistencyPanel` from `getKnowledgeConsistencyReport()`:

- per source: index status, content/indexed versions, retrievable true/false, current/total chunks, stale count, last indexed time, last error;
- totals: retrievable, pending, failed, current chunks, orphaned chunks;
- owner-only: derived from `getCurrentBusiness()` on the authenticated server action; the panel is rendered only on the owner dashboard. No retrieval internals are added to widget, hosted-chat, demo, or visitor responses.

No new dashboard was built; this is one panel inside the existing Knowledge page. It reports orphan/stale rows but **does not delete them automatically**.

---

## 6. Files changed

| File | Change |
| --- | --- |
| `supabase/migrations/20261106010000_knowledge_lifecycle_versioning.sql` | New fields, triggers, filtered RPC, diagnostics RPCs, indexes, backfill |
| `lib/knowledge/lifecycle.ts` | Pure eligibility, run-ownership, cleanup, and conversation-version helpers |
| `lib/ai/rag/types.ts` | Shared `RetrievedChunk` type (breaks import cycle) |
| `lib/ai/rag/select-chunks.ts` | Extracted selection pipeline (threshold/dedupe/rerank/limit) unchanged |
| `lib/ai/rag/retrieve-context.ts` | Lifecycle filter before selection; `staleExcluded` diagnostic |
| `lib/ai/rag/build-context.ts`, `chunk-scoring.ts`, `rerank-context.ts` | Import shared type only |
| `lib/embeddings/generate-source.ts` | Versioned claim, fenced finalise, version-limited cleanup, failure recovery |
| `lib/actions/knowledge.ts` | Immediate deactivation + explicit chunk/storage cleanup, error propagation, consistency report, Playground filter |
| `lib/actions/instant-generator.ts` | Lifecycle state on generated sources |
| `lib/actions/chat/run-business-chat.ts` | Knowledge-version comparison, history/summary invalidation, version recording |
| `lib/actions/chat/conversation-management.ts` | `recordConversationKnowledgeVersion` |
| `lib/actions/chat/message-persistence.ts` | Tags assistant messages with the knowledge version that produced them |
| `lib/ai/memory/message-history.ts` | Filters assistant turns to the current knowledge version |
| `lib/actions/chat/ai-response.ts` | Knowledge-updated prompt block |
| `lib/ai/memory/conversation-summary.ts` | Version-tagged summaries, no business facts in summary |
| `lib/ai/prompts/business-system-prompt.ts` | One grounding rule; voice policy untouched |
| `lib/types.ts` | Lifecycle fields on `KnowledgeSource` |
| `components/dashboard/knowledge/knowledge-consistency-panel.tsx` | New owner diagnostic panel |
| `components/dashboard/knowledge/knowledge-source-table.tsx` | Visible deletion errors |
| `app/dashboard/knowledge/page.tsx` | Loads and renders the panel |
| `tests/stale-knowledge-retrieval.test.ts` | 17 regression tests |

No API route, request/response shape, embedding provider, crawler, quality-gate rule, or billing path was changed.

---

## 7. Tests and actual results

Command: `npx vitest run --pool=threads`

| Suite | Coverage | Result |
| --- | --- | --- |
| `tests/stale-knowledge-retrieval.test.ts` | Reproduction, deletion eligibility, replacement/versioning, late run, failed re-index, multiple sources, conversation freshness (including per-message version tagging), prompt injection, SQL filter assertions | **19/19 passed** |
| Full suite | All existing tests + the above | **24 files passed, 1 skipped (25); 209 tests passed, 9 skipped (218)** |

Targeted single-file run (executed after the final history-tagging change): **1 file passed, 19 tests passed**; the model-context log is quoted verbatim in section 4.3. The 9 skipped tests are the opt-in live Gemini tests in `tests/business-identity-live.test.ts` (they require `RUN_LIVE_AI_TESTS` and a real API key; they are not counted as executed).

Additional checks:

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | **Passed (exit 0)** |
| ESLint | `npx eslint` | **0 errors, 633 warnings** (all pre-existing `no-explicit-any` / unused-parameter patterns; the new RAG test adds none) |
| Production build | `next build` with placeholder Supabase, URL, and Upstash values | **Passed (exit 0)**; no live database or model calls were made |

The required regression scenarios map as follows:

| Required scenario | Test |
| --- | --- |
| Delete an indexed source | Deletion flow + eligibility filter (`index_status = pending` is excluded); explicit chunk cleanup is inspected statically and by lifecycle helpers |
| Replace old with new | Old/superseded versions excluded; replacement chunk only |
| New conversation after replacement | Cost and delivery selection tests |
| Existing conversation | History keeps visitor turns only; knowledge-updated prompt; mocked answer is ₦350,000 |
| Late old indexing job | `isIndexRunCurrent` + version-limited cleanup tests; SQL guard assertions |
| Cached old results | No retrieval cache exists; conversation summary versioning covered |
| Failed indexing | Failed-status chunks excluded; unchanged-content failure retains prior ready index |
| Two businesses, different prices | Business filter on both sides of RPC + multi-source eligibility test |
| Multiple assistants | Knowledge is business-scoped; no assistant-level knowledge table exists (documented, unchanged) |
| Delete one of several sources | Multi-source test keeps active sources and drops the deleted-status source |

---

## 8. Migration, data impact, rollback, risks

### 8.1 What the migration does

- Adds columns with defaults; no table rewrite beyond the new columns.
- Backfills `index_status`:
  - `failed` first when metadata says failed, even if older metadata still says embedded (the old flag describes a previous success, not the latest attempt);
  - otherwise `ready` when metadata says embedded/completed **and** at least one embedded chunk exists;
  - otherwise `pending`.
- Sets `indexed_version = content_version` and `indexed_at = updated_at` for backfilled ready sources; clears `index_error` for them.
- Creates two indexes (`business_id, index_status`; `source_id, source_version`), a BEFORE UPDATE trigger, an AFTER INSERT/UPDATE/DELETE trigger, and replaces the retrieval RPC.
- Creates two `SECURITY INVOKER` diagnostic functions and revokes public execute.
- Seeds `businesses.knowledge_version = 1` for businesses that already have sources, so pre-migration conversations detect that knowledge exists and may have changed.

### 8.2 Data impact

- No rows are deleted. Old chunks remain in the table but are ineligible and are counted as `stale_chunk_count`; cleanup is left to a separate, reviewed operation.
- The backfill updates every source row whose status changes. The business counter is then seeded once for businesses with sources (the AFTER trigger would not otherwise fire for updates made before it is created). Consequence: pre-migration conversations without a stored version are considered stale on their next turn **once** and lose prior assistant turns (visitor questions are kept). This is intentional and conservative; businesses with no sources stay at version 0 and keep their history.
- Sources that were working but lack `embedded: true`/`embedding_status: completed` in metadata backfill as `pending` and become temporarily non-retrievable until re-indexed. The consistency panel makes this visible (pending count). This is deliberate: the migration does not guess eligibility.
- The RPC's join and version conditions may return fewer rows immediately after deployment. If the panel shows pending/failed sources, the owner must click "Embed Content" / re-crawl or reprocess until the source is `ready`.

### 8.3 Required deployment order

1. Take a database backup/snapshot and record current row counts for `knowledge_sources`, `knowledge_chunks`, `businesses`, `conversations`.
2. Apply `20261106010000_knowledge_lifecycle_versioning.sql` **before** deploying the new application code (the code reads the new columns).
3. Verify: call `get_knowledge_consistency('<business-id>')` for a known business and confirm expected statuses/versions.
4. Deploy the application.
5. Open the owner Knowledge page; re-index any `pending`/`failed` sources that should be live.
6. Spot-check one business with a deleted/replaced source using the widget and the Playground test search; confirm the replacement answer and absence of the old value.
7. Monitor for `index_error` and stale/orphan counts; investigate rather than bulk-deleting.

Recommended (not executed): `ANALYZE public.knowledge_sources; ANALYZE public.knowledge_chunks;` after the backfill. For large tables, apply during low traffic because the backfill updates rows and index creation is not `CONCURRENTLY` inside the migration transaction.

### 8.4 Rollback

Safest rollback (recommended): redeploy the previous application code and leave the additive schema and filtered RPC in place. Old code ignores the new columns and benefits from safer retrieval; no data is lost.

Full schema rollback (only if required):

```sql
-- Restore the pre-fix retrieval function (legacy behaviour)
create or replace function public.match_knowledge_chunks(
  query_embedding vector(768),
  match_business_id uuid,
  match_count int default 5
)
returns table (id uuid, source_id uuid, content text, similarity float, metadata jsonb)
language sql
stable
as $$
  select id, source_id, content,
         1 - (embedding <=> query_embedding) as similarity,
         metadata
  from public.knowledge_chunks
  where business_id = match_business_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

drop trigger if exists knowledge_sources_track_content_version on public.knowledge_sources;
drop trigger if exists knowledge_sources_bump_business_version on public.knowledge_sources;
drop function if exists public.knowledge_sources_track_content_version();
drop function if exists public.knowledge_sources_bump_business_version();
drop function if exists public.get_knowledge_consistency(uuid);
drop function if exists public.count_orphaned_knowledge_chunks(uuid);
drop index if exists public.knowledge_sources_business_index_status_idx;
drop index if exists public.knowledge_chunks_source_version_idx;

-- Destructive: removes recorded versions; only after code rollback.
alter table public.knowledge_chunks drop column if exists source_version;
alter table public.knowledge_sources
  drop column if exists content_version,
  drop column if exists indexed_version,
  drop column if exists index_status,
  drop column if exists index_run_id,
  drop column if exists index_started_at,
  drop column if exists indexed_at,
  drop column if exists index_error;
alter table public.businesses drop column if exists knowledge_version;
```

Rolling back the trigger also re-enables the original stale-content risk; do not roll back the trigger while keeping conversations running on the new code.

### 8.5 Risks

| Risk | Mitigation |
| --- | --- |
| Backfill marks a genuinely live source `pending` | Panel shows it; re-index. Conservative by design to avoid serving failed content |
| One-time loss of assistant context in pre-migration conversations | Visitor questions retained; new answers use current context |
| Backfill lock/time on a large table | Low-traffic window; snapshot first; counts recorded |
| Diagnostic RPC unrestricted to other businesses | `SECURITY INVOKER` + grants; caller passes its own business id; page uses authenticated owner context |
| Old chunks consume storage | Counted as stale; no automatic destructive cleanup (explicit constraint) |
| Two distinct active sources with conflicting facts | Both are legitimate active knowledge; owner must delete/update the obsolete source. The panel shows both as retrievable; the system does not guess which is "newer" across separate sources |
| Inline indexing still runs inside a request | Unchanged; run fencing prevents corruption, but long crawls remain subject to existing request limits |

---

## 9. Remaining limitations

- **No production reproduction was executed** (no credentials/database in this workspace). The reproduction is fixture-based against the pre-fix SQL/selection contract, with the post-fix context captured from a real test execution.
- **No browser/E2E verification** of the new diagnostics panel was performed; it is type-checked and the production build is reported below, but it was not opened in a running app.
- **Legacy/orphan rows are not cleaned up automatically.** They are ineligible and visible in diagnostics; a separate migration/cleanup must be reviewed and executed deliberately.
- **Assistant-level knowledge isolation does not exist** because knowledge is business-scoped. Multiple assistants in one business share the base by design; no new per-assistant table was introduced.
- **Separate-source conflicts** (two active sources with different prices) are not auto-resolved. Deletion/update must remove the obsolete source; the panel exposes stale chunks but cannot know which independent source the owner considers canonical.
- **Conversation version recording is best-effort.** If the conversation metadata update fails, history is still filtered by each assistant message's own version tag, so an old answer does not return. The only degradation is that the summary-versus-current version check and the "knowledge updated" note may be skipped on the next turn; current retrieval and the system-prompt rule remain authoritative.
- **Crawl failure keeps the previous ready index** (last-known-good), because unchanged content never bumps `content_version`. If the crawl succeeded but returned different content and indexing then fails, the source stays ineligible until re-indexed.
- **15-minute stale-run cutoff** assumes runs are not legitimately active longer than that without updating `index_started_at`; long crawls embed after extraction and normally finish within it. A second manual run inside 15 minutes is rejected with a clear error.
- **No production cleanup, re-indexing, or data deletion was performed.**

---

## 10. Acceptance checklist

| Acceptance criterion | Status |
| --- | --- |
| Deleted sources immediately excluded | Yes — deactivation first, RPC inner join + status filter, FK cleanup |
| Replacements not superseded by stale indexing jobs | Yes — content version claim, run id fence, version-limited cleanup |
| Only current active version used | Yes — `indexed_version = content_version = chunk.source_version` |
| Cached old results cannot reintroduce deleted info | No retrieval cache exists; summary is version-tagged and discarded when stale |
| Existing conversations do not present obsolete info as current | Yes — assistant turns dropped, stale summary ignored, explicit prompt note |
| Business isolation intact | Yes — both chunk and source business filters; tested |
| Old vs new consistently returns ₦350,000 / 21 working days | Yes — fixture context/selection/answer tests |
| Actual source diagnosed before prompt changes | Yes — root cause is retrieval lifecycle + conversation memory; threshold/model untouched |
| No destructive production cleanup | Yes — none executed; diagnostics only |
