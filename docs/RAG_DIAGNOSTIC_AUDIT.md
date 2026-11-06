# RAG Diagnostic Audit — Agentify

**Type:** Read-only diagnostic
**Baseline commit:** `e772b37` (`fix(ai): ground answers in knowledge and harden indexing`), 2026-11-05
**Audit date:** 2026-11-06
**Code changes made:** None. Prompt, model, retrieval threshold, embedding model, database schema, crawler logic, and production indexes were not modified.
**Working tree at audit start:** clean.

> This audit describes the implementation that is currently deployed from `e772b37`. That commit already contains the earlier reliability overhaul, so this is a **current-state baseline**, not a pre-overhaul baseline.

---

## 1. Scope and environment

| Item | Observation |
| --- | --- |
| Application | Next.js App Router, TypeScript, Supabase Postgres + pgvector |
| Chat model default | `gemini-2.5-flash`, simple-FAQ routing to `gemini-2.5-flash-lite` (`lib/ai/engine/chat.ts:52-56`) |
| Chat fallback | `openrouter` / `openai/gpt-oss-20b:free` (`lib/ai/engine/config.ts:19-22`) |
| Embedding model | `gemini-embedding-001`, `outputDimensionality: 768` (`lib/ai/engine/config.ts:16-23`, `lib/ai/providers/gemini.ts:257-287`) |
| Vector store | `knowledge_chunks.embedding vector(768)`, HNSW cosine index (`supabase/legacy_sql/embeddings-schema.sql:5-15,85-88`) |
| Local environment file | Only `.env.example` exists; **no `.env.local`** |
| Live credentials available to this audit | None for Supabase or Gemini |
| Runtime used for deterministic checks | Node v26.5.0, `tsx 4.23.15`, Vitest 4.1.9 |

### Baseline caveat

A true "before any fixes" baseline would require checking out a pre-overhaul commit and pointing it at a live database. That was not done because:

1. The task forbids modifying the existing implementation.
2. No Supabase or Gemini credentials are present.
3. The task forbids creating production test businesses.

All live retrieval and generation scores are therefore recorded as **BLOCKED**, not as passing or failing.

---

## 2. Complete RAG lifecycle trace

### 2.1 Ingestion path (knowledge → vectors)

| Step | Component | Input | Output / write | Failure behavior |
| --- | --- | --- | --- | --- |
| I1 | `processWebsiteSource` (`lib/actions/knowledge.ts:421-525`) | `sourceId`, owner session | `knowledge_sources.content`, status `trained`, crawl metadata | Sets `status: failed`, stores `error_message`, creates notification |
| I1 | `crawlWebsiteSource` (`lib/actions/knowledge.ts:527-692`) | `sourceId`, `maxPages`, `depth`, `autoEmbed` | Multi-page combined text with `=== Page ===` / `URL:` markers | If zero pages scraped, keeps previous content and marks `crawl_status: failed`; otherwise `partial` or `completed` |
| I2 | `crawlWebsite` (`lib/scraper/crawl-website.ts:32-175`) | start URL | `CrawlResult` (pages, failures, combined text) | Per-page failures are collected in `failedPages`; crawl continues |
| I2 | URL safety + robots + sitemap | URL | canonical URL, allowed paths, sitemap URLs | Throws for private/invalid URLs or robots-disallowed start URL (`crawl-website.ts:50-56`) |
| I3 | `scrapePage` (`lib/scraper/scrape-url.ts`) | page URL | title, description, text, links | Deterministic extraction first; optional AI extraction only after validation |
| I4 | `chunkSourceText` (`lib/embeddings/chunker.ts:167-192`) | source content | `SourceChunk[]` with `content`, SHA-256 hash, page URL/title, section heading | Returns `[]` for empty content |
| I5 | `generateEmbeddingsForSourceInternal` (`lib/embeddings/generate-source.ts:168-334`) | source row | Reused/new 768-d vectors, `knowledge_chunks` rows | Inserts replacement rows first, deletes stale rows only after all inserts succeed; rolls back partial inserts and keeps old index on error |
| I6 | `generateEmbedding(s)` (`lib/ai/engine/embeddings.ts:46-197`) | text(s) | `number[768]` | Rejects empty, non-finite, or wrong-dimension vectors; retries twice; logs failures |
| I7 | Quota accounting (`lib/actions/knowledge.ts:786-860`) | source ID | Reservation for new chunks only; `complete` or `release` | Returns quota-denial message without deleting old index |

**Chunking parameters:** 1200 characters maximum, 150-character overlap, hard split for oversized sentences, minimum 10-character fragment (`lib/embeddings/chunker.ts:7-66`).

**Re-index safety:** existing vectors are reused by content hash and 768-dimension validation (`generate-source.ts:80-96`); stale deletion happens after inserts (`generate-source.ts:281-283`).

**Ingestion failure points**

- A website source can remain `status: trained` while indexing failed; it then returns `embedded: false` plus a warning (`lib/actions/knowledge.ts:62-84`). Such a source is stored but not searchable.
- `crawlWebsiteSource` with `autoEmbed !== true` intentionally leaves the source unindexed and returns a warning (`knowledge.ts:661-667`).
- A total crawl failure preserves old content but reports failure; it does not silently mark the crawl successful (`knowledge.ts:590-621`).
- Empty or noisy content produces zero chunks and marks `embedding_status: failed` (`generate-source.ts:180-198`).

### 2.2 Retrieval and answer path (question → answer)

| Step | Component | Input | Output / write | Failure behavior |
| --- | --- | --- | --- | --- |
| R1 | Public widget intake (`app/api/widget/chat/route.ts:55-117`) | `businessId`, message, source, visitor ID | Calls `runBusinessChat`; returns `conversationId`, `reply`, `limitReached` only | 400 invalid, 403 disabled/domain, 404 no config, 429 rate limit, 500 generic error |
| R1 | Dashboard playground (`lib/actions/chat.ts:146-180`) | message, conversation ID | `runBusinessChat` + `retrievedChunks` | Requires complete setup; owner session; rate limit |
| R1 | Demo intake (`app/api/demo/chat/route.ts`) | demo ID, visitor ID, message | Reply and reply counts | Demo must be `active`, unexpired, under 9 AI replies; client cannot choose the knowledge business |
| R2 | Business + assistant load (`lib/actions/chat/run-business-chat.ts:94-107`) | `businessId` | `businesses` row, active `assistants` row | Throws "Business not found" / "Assistant not found" |
| R3 | Conversation resolution (`lib/actions/chat/conversation-management.ts:3-97`) | conversation ID, business ID, visitor ID, source | `conversations` row; demo tables/RPCs | Reuse requires `id` **and** `business_id` match; otherwise "Conversation not found." |
| R3 | Manual takeover check (`run-business-chat.ts:126-140`) | conversation | No AI reply | Returns `isManualTakeover: true` |
| R4 | Save user turn (`lib/actions/chat/message-persistence.ts:5-23`) | user text | `messages` row, role `user` | Throws on insert failure |
| R5 | Load history (`lib/ai/memory/message-history.ts:9-36`) | conversation ID | Last 8 messages, chronological, assistant→`model`, system filtered | Returns `[]` on read error (logs only) |
| R5 | Remove current turn (`run-business-chat.ts:23-29,163-164`) | history, current text | Prior-turn history | No-op if last message differs |
| R6 | Query expansion (`lib/ai/rag/retrieve-context.ts:63-85`) | question, history | Expanded query (≤500 chars) | `continue` reuses prior user turn; short/referential questions inherit prior turn |
| R7 | Intent classification (`lib/ai/intent/classify-query.ts:80-97`) | expanded query | One of 13 intents | Falls back to `general` |
| R8 | Query embedding (`retrieve-context.ts:118`) | expanded query | `number[768]` | Throws; caught by R8 wrapper |
| R9 | Vector RPC (`retrieve-context.ts:122-126`, SQL `embeddings-schema.sql:58-83`) | embedding, `businessId`, `match_count = 5 × 2` | Top-10 chunks with cosine similarity | RPC error is logged, recorded in diagnostics, and converted to empty context (`retrieve-context.ts:128-132`) |
| R10 | Threshold filter (`retrieve-context.ts:138`) | top-10 chunks | Chunks with `similarity >= 0.55` | Empty result is a valid "no knowledge" outcome |
| R11 | Dedupe + rerank (`retrieve-context.ts:141-163`, `lib/ai/rag/chunk-scoring.ts`) | filtered chunks | Ordered chunks with intent boosts | Exact duplicate content removed |
| R12 | Dynamic slice (`retrieve-context.ts:167-172`) | ordered chunks | 2 chunks if top similarity ≥ 0.70 and query is not compound; otherwise 5 | Truncation is silent except in diagnostics |
| R13 | Context formatting (`lib/ai/rag/build-context.ts:4-26`) | final chunks | `Verified excerpts...` block, or `No specific knowledge found for this query.` | No omission after this point |
| R14 | Prompt assembly (`lib/ai/prompts/business-system-prompt.ts:31-100`) | business, assistant, context, metadata | System instruction with profile, knowledge block, 10 grounding rules | Knowledge availability branch tells the model to use the fallback when no chunks exist |
| R14 | Summary injection (`lib/actions/chat/ai-response.ts:53-62`) | conversation summary | Non-authoritative `# SECONDARY CONVERSATION MEMORY` block prepended | Summary explicitly loses to knowledge/profile |
| R15 | Model call (`lib/ai/engine/chat.ts:12-234`) | system prompt, user text, history | Text, provider, model, latency, fallback flag | Primary gets 2 retries / 15 s; on failure, OpenRouter fallback gets 2 retries / 15 s; both failing throws |
| R16 | Quality gate (`lib/ai/evaluation/quality-checks.ts:18-123`) | model text, business profile, context | Pass-through or fallback message + reason | Catches prompt/technical leakage, >2500 chars, emails, phones, currency amounts |
| R17 | Persistence (`lib/actions/chat/message-persistence.ts:25-72`) | reply, chunks, diagnostics | Assistant `messages` row with `retrieved_chunks` and `metadata` | Throws on insert failure |
| R18 | Response | API/action result | Widget: reply only. Playground: full result incl. chunks | Usage quota completed only after persistence |

### 2.3 External services and data stores

- **Supabase Postgres**: businesses, assistants, conversations, messages, knowledge_sources, knowledge_chunks, demo tables, quotas, logs.
- **pgvector**: cosine distance (`<=>`) with HNSW index.
- **Google Gemini**: chat, optional HTML→Markdown extraction, embeddings.
- **OpenRouter / Groq / Vertex**: fallback or optional providers.
- **Arbitrary public websites**: crawl targets, constrained by robots.txt, public-URL checks, timeouts, and page limits.

---

## 3. Phase 2 — actual chunks and actual context

### 3.1 What can be inspected safely today

| Surface | Access control | What it reveals | Evidence |
| --- | --- | --- | --- |
| Dashboard playground → "Retrieved knowledge" | Authenticated owner of the business (`sendDashboardTestMessage` → `requireCompleteBusinessSetup`) | Chunk text, similarity %, source title | `lib/actions/chat.ts:146-175`, `components/dashboard/playground/retrieved-context-panel.tsx`, `chat-playground.tsx` |
| Dashboard knowledge → "Test Knowledge Search" | Authenticated owner; explicit `business.id !== businessId` check and AI entitlement | Chunk text, similarity, source title | `lib/actions/knowledge.ts:862-885`, `components/dashboard/knowledge/test-knowledge-search.tsx` |
| Database | Admin/ops only | `messages.retrieved_chunks`, `messages.metadata.retrieval` | `message-persistence.ts:54-65` |
| Admin AI logs | `requireAdmin()` server guard | Provider, model, latency, status, token estimates; **no prompts or chunks** | `app/admin/layout.tsx:18`, `lib/admin/require-admin.ts:20-44`, `lib/ai/logs/ai-logs.ts:42-70` |
| Public widget / hosted chat | Public per widget config | Reply only; no chunks, no diagnostics | `app/api/widget/chat/route.ts:113-117` |

**Conclusion:** there is no public debug endpoint and no admin-wide retrieval inspector. Owner-scoped chunk inspection exists and is safe for that tenant. There is no safe way for an operator to inspect **another tenant's** retrieval without impersonating the owner or using the service-role database directly.

### 3.2 Live production retrieval demonstration

**Status: BLOCKED.**

Reasons:

- No `.env.local`; `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` are absent.
- The task forbids creating production test businesses and re-indexing production knowledge.
- No existing diagnostic endpoint returns chunks for an arbitrary `(businessId, query)` pair.
- The only chunk-returning surfaces require an owner session for that business.

Therefore no production chunk, similarity score, or production prompt is reported in this audit. Nothing below should be read as a production retrieval result.

### 3.3 Deterministic synthetic demonstration (executed)

The production chunker and the production context formatter were executed against the isolated NovaTech corpus described in `RAG_RETRIEVAL_BENCHMARK.md`. This demonstrates exactly what would be stored and what would be inserted into the prompt, but it does **not** measure similarity or retrieval quality.

**Chunks produced (6):**

| # | Page | Section | Characters |
| --- | --- | --- | --- |
| 0 | Home | NovaTech Solutions | 533 |
| 1 | Services | Website design | 573 |
| 2 | Pricing | Pricing | 377 |
| 3 | How we work | Project process | 337 |
| 4 | Policies | Refund policy | 309 |
| 5 | Contact | Contact | 254 |

**Formatted context (actual output, first excerpt):**

```text
Verified excerpts from the business knowledge base:

[Knowledge 1] Source: NovaTech Solutions [type: website] (Section: NovaTech Solutions) (Page: https://novatech.example/)
# NovaTech Solutions
NovaTech Solutions is a digital studio that designs websites, builds mobile applications, and automates business workflows for growing companies.

# What we do
We deliver three core services: website design, mobile application development, and business process automation.

# How we work
Every project runs for a minimum of 14 working days. The timeline starts after the deposit is received and the project brief is approved.

# Getting started
Contact us at hello@novatech.example or call during business hours.

[Knowledge 2] Source: NovaTech Solutions [type: website] (Section: Website design) (Page: https://novatech.example/services)
# Website design
Our website design service covers UX planning, responsive page design, and a launch-ready marketing website. The price is NGN 250,000 (₦250,000).
...
```

**Empty retrieval output (actual output):**

```text
No specific knowledge found for this query.
```

**Where this text goes in the model prompt:** `buildBusinessSystemPrompt` inserts `contextText` verbatim under `# KNOWLEDGE BASE CONTEXT` (`lib/ai/prompts/business-system-prompt.ts:79-83`, called from `ai-response.ts:40-49`). The knowledge-availability branch changes based on whether the string starts with `No specific knowledge found` (`business-system-prompt.ts:48-57`).

**What this proves:** chunking and formatting preserve the synthetic facts and labels. It does **not** prove that production embeddings rank the right chunk first.

---

## 4. Security boundaries and findings

### 4.1 Channel-by-channel exposure

| Channel | Authentication / authorization | Data returned | Chunks? | Retrieval diagnostics? |
| --- | --- | --- | --- | --- |
| Widget `/api/widget/chat` | Public; widget enabled + allowed domain + rate limit | `conversationId`, `reply`, `limitReached` | No | No |
| Hosted chat (same route) | Public; hosted-chat flag | Same | No | No |
| Demo `/api/demo/chat` | Public; demo status/expiry/reply budget | Reply and counts | No | No |
| Widget history `/api/widget/chat/history` | Visitor ID match, owner, or admin | Messages including `metadata` | No (`retrieved_chunks` not selected) | **Yes — see S1** |
| Playground server action | Owner session + setup + rate limit | Full result incl. `retrievedChunks` | Yes, owner-only | Yes, owner-only |
| Knowledge search | Owner session + ownership check + entitlement | Chunk text, similarity, source title | Yes, owner-only | Partial |
| Admin AI logs | `requireAdmin()` | Log metadata only | No | Operational metadata |
| Public debug endpoint | — | — | — | None exists |

### 4.2 Findings

#### S1 — Widget history returns retrieval diagnostics in `metadata` (medium)

`saveAssistantMessage` stores `metadata.retrieval` (`message-persistence.ts:54-65`). The widget history route selects `metadata` for every message and returns it to an authorized visitor (`app/api/widget/chat/history/route.ts:86-98`). A hosted-chat visitor therefore receives internal fields such as:

- original and expanded retrieval query,
- classified intent,
- candidate count, above-threshold count, final count,
- top similarity, dynamic limit,
- provider/model, quality reason, fallback flag, retrieval error.

No chunk text or API key is returned, but this is a diagnostic payload exposed to an end customer, contrary to the task's security rule. The smallest safe fix is to return an allowlisted `metadata` subset for public history, or to stop persisting diagnostics on visitor-facing messages and store them in an admin-only table. **Not implemented; requires approval.**

#### S2 — Widget conversation reuse is not bound to `visitorId` (medium)

When a `conversationId` is supplied, `resolveOrCreateConversation` verifies only `id` + `business_id` (`conversation-management.ts:66-75`). It does not compare the supplied `visitorId` with `conversations.visitor_id`. Anyone who obtains a conversation UUID can append turns to that conversation. The model then receives that conversation's history (`message-history.ts:9-36`), so prior visitor content can be elicited through prompt injection. This is **not cross-business** knowledge leakage — `business_id` is still enforced — but it is a conversation-integrity and privacy risk.

The history endpoint does enforce a visitor/owner/admin check (`history/route.ts:46-83`), so the two read/write paths do not apply the same binding rule.

#### S3 — Service-role client bypasses RLS by design (residual risk)

All chat reads/writes use `createServiceClient()` (`run-business-chat.ts:50`, `conversation-management.ts:20`, `message-persistence.ts:14,46`). RLS policies on `messages`, `conversations`, and `knowledge_chunks` therefore do not constrain the chat runtime. Tenant isolation depends entirely on server-derived `businessId`:

- widget: the client supplies `businessId`, but it is used only as the RPC tenant filter; the RPC filters `where business_id = match_business_id` (`embeddings-schema.sql:79-82`), so Business A cannot retrieve Business B chunks;
- dashboard: `businessId` comes from the authenticated business (`sendDashboardTestMessage`);
- demo: `businessId` comes from `demo_businesses.placeholder_business_id` (`app/api/demo/chat/route.ts`), never from the client.

No cross-tenant read path was found in static analysis, but the live isolation test is blocked.

#### S4 — RAG schema is not reproducible from tracked migrations (high operational risk)

The following objects exist only in `supabase/legacy_sql/`:

- `knowledge_sources` (`knowledge-schema.sql`)
- `knowledge_chunks` and `match_knowledge_chunks` (`embeddings-schema.sql`)
- `messages` and `conversations` (`chat-schema.sql`)
- `ai_engine_settings` (`ai-settings-schema.sql`)
- `ai_interaction_logs` (`ai-logs-schema.sql`)

`supabase/README.md:6-8` states that `legacy_sql` is "archived for reference; do not run directly on new setups." None of the 15 tracked migrations creates these objects or the vector RPC. A fresh staging/local database therefore cannot reproduce the RAG pipeline from the repository alone. This blocks safe benchmarking and makes production schema drift undetectable from code.

#### S5 — Admin and key handling (positive)

- Admin layout calls `requireAdmin()` server-side and redirects non-admins (`app/admin/layout.tsx:18`, `require-admin.ts:20-44`).
- AI logs contain no prompt or chunk content and strip `apiKey`, `secret`, and `password` (`ai-logs.ts:42-70`).
- Provider keys are read server-side via `getSecretWithEnvFallback` and never returned by any route (`lib/ai/providers/gemini.ts:61-66`).

---

## 5. Failure-scenario mapping (A–F)

| Scenario | Where it would occur | Observable evidence | Status |
| --- | --- | --- | --- |
| **A. Content exists but is not retrieved** | Query embedding mismatch, empty index, RPC failure, or all similarities < 0.55 | `diagnostics.candidates = 0` or `aboveThreshold = 0`; logs `[RAG] No chunks passed...` | Static only; live BLOCKED |
| **B. Retrieved but filtered out** | 0.55 threshold, exact-content dedupe, dynamic slice of 2 | `candidates > aboveThreshold > finalCount` in diagnostics | Static only; live BLOCKED |
| **C. Retrieved but omitted from model context** | Only the dynamic slice can omit; after `formatContext`, all final chunks are included | `finalCount` vs. number of facts needed by a multi-part question | Static only; live BLOCKED |
| **D. Model ignores the knowledge** | Generation behavior, weak instruction-following, fallback-model differences | Would require paired `retrieved_chunks` and final answer review | **NOT EXECUTED** |
| **E. Answer corrupted after generation** | Quality gate replaces the model output | `messages.metadata.quality_passed = false` and `quality_reason` | **MEASURED at component level — see below** |
| **F. Content was never crawled or indexed** | Crawl failure, zero usable chunks, `autoEmbed` off, indexing failure, schema drift | `knowledge_sources.status`, `crawl_status`, `metadata.embedding_status`, `chunk_count` | Static; synthetic corpus passed chunking; production BLOCKED |

### Measured scenario E: the price verifier is asymmetric

The price check in `quality-checks.ts:102-120` uses this pattern:

```text
(?:[$€£₦]\s?amount) OR (amount\s?(usd|ngn|eur|gbp|...))
```

It matches a currency **symbol before** an amount (`₦400,000`) and a currency **word after** an amount (`400,000 NGN`). It does **not** match a currency **code before** an amount (`NGN 400,000`), and it ignores bare numbers.

Actual executed results against the synthetic NovaTech context:

| Model answer | Result | Reason |
| --- | --- | --- |
| `Website design costs NGN 250,000.` | Pass | Exact context price; `NGN` prefix is not detected, but the value is present anyway |
| `The combined total is ₦400,000.` | **Replaced with fallback** | `unverified_price` — computed total is not verbatim in context |
| `The combined total is NGN 400,000.` | **Pass** | Regex blind spot: code-before-amount is not matched at all |
| `The combined total is 400,000.` | **Pass** | Bare numbers are intentionally ignored |
| `The deposit is ₦125,000.` | **Replaced with fallback** | `unverified_price` — computed deposit is not verbatim in context |
| `Email us at sales@novatech.example.` | **Replaced with fallback** | `hallucinated_email` (correct behavior) |

**Impact:** a correct, grounded, arithmetically derived price can be destroyed by the post-processor when written with `₦`, while the same unverified number passes when written with `NGN` or bare. This is both a false-positive and a false-negative defect. It directly affects benchmark questions P01, P02, and P05.

---

## 6. Diagnostic tooling assessment

### What exists

1. Owner playground with retrieved chunks and similarity.
2. Owner knowledge search with chunks and similarity.
3. Persisted per-message diagnostics (`messages.retrieved_chunks`, `messages.metadata.retrieval`).
4. Admin AI interaction logs (provider/model/status/latency; no prompt content).

### What is missing for this benchmark

1. A read-only, admin-only inspector that takes `(businessId, query)` and returns candidates, similarities, threshold decisions, final chunks, formatted context, and the assembled system prompt.
2. A way to capture the raw model answer **before** quality checks alongside the final answer.
3. A reproducible staging seed for synthetic businesses and chunks.
4. A benchmark runner that records Recall@k/MRR and answer grades without creating production data.

### Smallest safe additions (proposed — NOT implemented)

1. **Admin retrieval inspector (small):** a server-only page or `POST /api/admin/rag-inspect` guarded by `requireAdmin()`, accepting `businessId` + query, calling `retrieveBusinessContext`, and returning diagnostics + formatted context. Read-only; no message writes; no new tables; rate-limited. This is the minimum needed to demonstrate actual production chunks safely.
2. **Raw-vs-final capture (small):** return `rawModelText` only to the admin inspector response, never persist it to `messages`, never include it in widget history.
3. **Staging seed + benchmark runner (medium):** a versioned baseline migration for the RAG tables and a seed script for the synthetic businesses. This is larger because the schema baseline is currently missing from tracked migrations.

No addition was implemented because the task requires approval before building diagnostic tooling.

---

## 7. Blocked / not executed

| Item | Status | Reason |
| --- | --- | --- |
| Live retrieval inspection | BLOCKED | No credentials; no admin inspector |
| Test A retrieval metrics | BLOCKED | Requires embeddings + pgvector data |
| Test B answer metrics | BLOCKED | Requires model calls + seeded businesses |
| Cross-business live isolation test | BLOCKED | Cannot create two test businesses |
| Production chunk/context capture | BLOCKED | No safe endpoint |
| Production re-index verification | NOT EXECUTED | Forbidden by task rules |
| Model-ignores-knowledge measurement | NOT EXECUTED | Requires generation |

---

## 8. Reproduction commands used

```bash
# Baseline
git rev-parse --short HEAD

# Full test suite (default forks pool times out under Node 26.5.0)
npx vitest run --pool=threads

# AI reliability suite
npx vitest run tests/ai-engine-reliability.test.ts --pool=threads

# Deterministic synthetic checks (scripts live outside the repository)
npx tsx --conditions=react-server <temp>/novatech-precheck.mjs
npx tsx --conditions=react-server <temp>/novatech-expand.mjs
npx tsx --conditions=react-server <temp>/novatech-context.mjs
```

The synthetic scripts imported the production modules directly:

- `lib/embeddings/chunker.ts`
- `lib/ai/rag/build-context.ts`
- `lib/ai/rag/retrieve-context.ts` (query expansion only)
- `lib/ai/intent/classify-query.ts`
- `lib/ai/rag/chunk-scoring.ts`
- `lib/ai/evaluation/quality-checks.ts`

No repository file was created or modified by these checks.

---

## 9. Constraint compliance

| Rule | Compliance |
| --- | --- |
| Read-only diagnostic | Yes |
| No application code changes | Yes |
| No prompt changes | Yes |
| No threshold changes | Yes |
| No embedding-model changes | Yes |
| No production re-index | Yes |
| No schema changes | Yes |
| No production test businesses | Yes |
| No subscription/limit changes | Yes |
| No new AI providers | Yes |
| No private customer information exposed | Yes |
| No claimed tests without execution | Yes — blocked items are labelled |
| No invented retrieval results or scores | Yes |
| Unavailable configuration documented | Yes |
