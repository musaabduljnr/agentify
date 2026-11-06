# Agentify — Complete RAG Diagnostic Audit

**Baseline:** `e772b37` — `fix(ai): ground answers in knowledge and harden indexing` (2026-11-05)
**Audit date:** 2026-11-06
**Mode:** read-only
**Report status:** Live retrieval and answer evaluation **BLOCKED**; component-level checks **EXECUTED**.

> This file consolidates the five audit reports into one self-contained document. No application code, system prompt, retrieval threshold, embedding model, database schema, crawler logic, or production knowledge index was changed. All unavailable checks are recorded as blocked, not as passed.

---

## Document control

| Item | Value |
| --- | --- |
| Repository baseline | `e772b37` |
| Baseline date | 2026-11-05 |
| Audit date | 2026-11-06 |
| Working tree at start | clean |
| Production credentials available | No |
| Live database inspected | No |
| Live model called | No |
| Test suite | 18 files / 119 tests passed with `--pool=threads` |
| Synthetic corpus | 6 chunks; 35/35 fact-bearing questions covered |
| Production changes | none |

### Baseline caveat

The audited commit already includes the earlier reliability overhaul. This is a **current-state baseline**, not a pre-overhaul baseline. A pre-overhaul comparison would require checking out an older commit and a live database; both were outside the read-only scope and unavailable.

---

## Overall status

| Area | Status | What was established |
| --- | --- | --- |
| Pipeline trace | EXECUTED | Full ingestion, retrieval, prompt, generation, quality, and persistence path traced to file/line |
| Synthetic chunking | EXECUTED | 6 chunks; all required facts survived |
| Query expansion | EXECUTED | 5/5 follow-ups expanded correctly |
| Intent classification | EXECUTED | Distribution recorded; payment/total/timeline gaps found |
| Rerank boosts | EXECUTED | Four representative queries received zero boost |
| Post-processing quality gate | EXECUTED | Price verifier defect measured in both directions |
| Full test suite | EXECUTED | 119/119 passed |
| Live retrieval metrics | BLOCKED | No credentials, no seeded isolated database |
| Live answer metrics | BLOCKED | No raw model output, no seeded businesses |
| Cross-business live test | BLOCKED | Test businesses prohibited |
| Production index inspection | BLOCKED | No safe admin inspector |

---

## Table of contents

1. [Part I — Diagnostic Audit](#part-i)
2. [Part II — Retrieval Benchmark (Test A)](#part-ii)
3. [Part III — Answer Benchmark (Test B)](#part-iii)
4. [Part IV — Failure Analysis](#part-iv)
5. [Part V — Baseline Summary](#part-v)
- [Executive summary](#executive-summary)
- [Constraint compliance](#constraint-compliance)

---

## Executive summary

**What the audit found, in ten answers:**

1. **Crawler completeness:** the extraction pipeline is defensive and structurally sound, but production completeness is unmeasured. Defaults of 10 pages / depth 1 and the under-10-word skip can miss content. The synthetic corpus survived chunking without fact loss.
2. **Embedding integrity:** the code enforces 768 dimensions, hash reuse, non-destructive re-indexing, and rollback. No live rows were inspected. Core RAG tables and the vector RPC exist only in `legacy_sql`, so a fresh environment cannot reproduce the index.
3. **Retrieval correctness:** **not measured.** Recall@1/3/5 and MRR are blocked. Fact survival after chunking is not retrieval accuracy.
4. **Context reaching the model:** yes by construction. Every final chunk is formatted and inserted under `# KNOWLEDGE BASE CONTEXT`; the only omission point is the 2-or-5 chunk slice. No live prompt was captured.
5. **Model ignoring knowledge:** **unknown.** Raw model output is not persisted, so model behavior cannot be separated from retrieval or post-processing.
6. **% retrieving correct knowledge:** **not measured.** No percentage is claimed.
7. **% correct and grounded answers:** **not measured.** No answer was generated or graded.
8. **Top five root causes:** (1) format-asymmetric price verification, (2) intent/rerank gaps for deposit/payment/total/timeline wording, (3) hardcoded 0.55 threshold and aggressive slice, (4) no raw-answer capture, (5) non-reproducible RAG schema.
9. **Fix first:** the price verification gate. It is the only measured defect that replaces a correct answer, and it fails in both directions: correct computed `₦` amounts are destroyed, while `NGN`-prefixed or bare unverified amounts pass.
10. **Riskiest changes:** changing embedding model/dimensions, re-indexing production in place, altering threshold or chunk size without measurement, relaxing the price gate, broadly rewriting the prompt, or switching providers.

**Two security findings outside the accuracy ranking:**

- Widget history returns `messages.metadata`, including retrieval diagnostics, to hosted-chat visitors.
- Widget conversation reuse checks `business_id` but not `visitor_id`, so a leaked conversation UUID allows appending to another visitor's conversation.

---

<a id="part-i"></a>

## Part I — Diagnostic Audit

**Type:** Read-only diagnostic
**Baseline commit:** `e772b37` (`fix(ai): ground answers in knowledge and harden indexing`), 2026-11-05
**Audit date:** 2026-11-06
**Code changes made:** None. Prompt, model, retrieval threshold, embedding model, database schema, crawler logic, and production indexes were not modified.
**Working tree at audit start:** clean.

> This audit describes the implementation that is currently deployed from `e772b37`. That commit already contains the earlier reliability overhaul, so this is a **current-state baseline**, not a pre-overhaul baseline.

---

### 1. Scope and environment

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

#### Baseline caveat

A true "before any fixes" baseline would require checking out a pre-overhaul commit and pointing it at a live database. That was not done because:

1. The task forbids modifying the existing implementation.
2. No Supabase or Gemini credentials are present.
3. The task forbids creating production test businesses.

All live retrieval and generation scores are therefore recorded as **BLOCKED**, not as passing or failing.

---

### 2. Complete RAG lifecycle trace

#### 2.1 Ingestion path (knowledge → vectors)

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

#### 2.2 Retrieval and answer path (question → answer)

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

#### 2.3 External services and data stores

- **Supabase Postgres**: businesses, assistants, conversations, messages, knowledge_sources, knowledge_chunks, demo tables, quotas, logs.
- **pgvector**: cosine distance (`<=>`) with HNSW index.
- **Google Gemini**: chat, optional HTML→Markdown extraction, embeddings.
- **OpenRouter / Groq / Vertex**: fallback or optional providers.
- **Arbitrary public websites**: crawl targets, constrained by robots.txt, public-URL checks, timeouts, and page limits.

---

### 3. Phase 2 — actual chunks and actual context

#### 3.1 What can be inspected safely today

| Surface | Access control | What it reveals | Evidence |
| --- | --- | --- | --- |
| Dashboard playground → "Retrieved knowledge" | Authenticated owner of the business (`sendDashboardTestMessage` → `requireCompleteBusinessSetup`) | Chunk text, similarity %, source title | `lib/actions/chat.ts:146-175`, `components/dashboard/playground/retrieved-context-panel.tsx`, `chat-playground.tsx` |
| Dashboard knowledge → "Test Knowledge Search" | Authenticated owner; explicit `business.id !== businessId` check and AI entitlement | Chunk text, similarity, source title | `lib/actions/knowledge.ts:862-885`, `components/dashboard/knowledge/test-knowledge-search.tsx` |
| Database | Admin/ops only | `messages.retrieved_chunks`, `messages.metadata.retrieval` | `message-persistence.ts:54-65` |
| Admin AI logs | `requireAdmin()` server guard | Provider, model, latency, status, token estimates; **no prompts or chunks** | `app/admin/layout.tsx:18`, `lib/admin/require-admin.ts:20-44`, `lib/ai/logs/ai-logs.ts:42-70` |
| Public widget / hosted chat | Public per widget config | Reply only; no chunks, no diagnostics | `app/api/widget/chat/route.ts:113-117` |

**Conclusion:** there is no public debug endpoint and no admin-wide retrieval inspector. Owner-scoped chunk inspection exists and is safe for that tenant. There is no safe way for an operator to inspect **another tenant's** retrieval without impersonating the owner or using the service-role database directly.

#### 3.2 Live production retrieval demonstration

**Status: BLOCKED.**

Reasons:

- No `.env.local`; `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` are absent.
- The task forbids creating production test businesses and re-indexing production knowledge.
- No existing diagnostic endpoint returns chunks for an arbitrary `(businessId, query)` pair.
- The only chunk-returning surfaces require an owner session for that business.

Therefore no production chunk, similarity score, or production prompt is reported in this audit. Nothing below should be read as a production retrieval result.

#### 3.3 Deterministic synthetic demonstration (executed)

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

### 4. Security boundaries and findings

#### 4.1 Channel-by-channel exposure

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

#### 4.2 Findings

##### S1 — Widget history returns retrieval diagnostics in `metadata` (medium)

`saveAssistantMessage` stores `metadata.retrieval` (`message-persistence.ts:54-65`). The widget history route selects `metadata` for every message and returns it to an authorized visitor (`app/api/widget/chat/history/route.ts:86-98`). A hosted-chat visitor therefore receives internal fields such as:

- original and expanded retrieval query,
- classified intent,
- candidate count, above-threshold count, final count,
- top similarity, dynamic limit,
- provider/model, quality reason, fallback flag, retrieval error.

No chunk text or API key is returned, but this is a diagnostic payload exposed to an end customer, contrary to the task's security rule. The smallest safe fix is to return an allowlisted `metadata` subset for public history, or to stop persisting diagnostics on visitor-facing messages and store them in an admin-only table. **Not implemented; requires approval.**

##### S2 — Widget conversation reuse is not bound to `visitorId` (medium)

When a `conversationId` is supplied, `resolveOrCreateConversation` verifies only `id` + `business_id` (`conversation-management.ts:66-75`). It does not compare the supplied `visitorId` with `conversations.visitor_id`. Anyone who obtains a conversation UUID can append turns to that conversation. The model then receives that conversation's history (`message-history.ts:9-36`), so prior visitor content can be elicited through prompt injection. This is **not cross-business** knowledge leakage — `business_id` is still enforced — but it is a conversation-integrity and privacy risk.

The history endpoint does enforce a visitor/owner/admin check (`history/route.ts:46-83`), so the two read/write paths do not apply the same binding rule.

##### S3 — Service-role client bypasses RLS by design (residual risk)

All chat reads/writes use `createServiceClient()` (`run-business-chat.ts:50`, `conversation-management.ts:20`, `message-persistence.ts:14,46`). RLS policies on `messages`, `conversations`, and `knowledge_chunks` therefore do not constrain the chat runtime. Tenant isolation depends entirely on server-derived `businessId`:

- widget: the client supplies `businessId`, but it is used only as the RPC tenant filter; the RPC filters `where business_id = match_business_id` (`embeddings-schema.sql:79-82`), so Business A cannot retrieve Business B chunks;
- dashboard: `businessId` comes from the authenticated business (`sendDashboardTestMessage`);
- demo: `businessId` comes from `demo_businesses.placeholder_business_id` (`app/api/demo/chat/route.ts`), never from the client.

No cross-tenant read path was found in static analysis, but the live isolation test is blocked.

##### S4 — RAG schema is not reproducible from tracked migrations (high operational risk)

The following objects exist only in `supabase/legacy_sql/`:

- `knowledge_sources` (`knowledge-schema.sql`)
- `knowledge_chunks` and `match_knowledge_chunks` (`embeddings-schema.sql`)
- `messages` and `conversations` (`chat-schema.sql`)
- `ai_engine_settings` (`ai-settings-schema.sql`)
- `ai_interaction_logs` (`ai-logs-schema.sql`)

`supabase/README.md:6-8` states that `legacy_sql` is "archived for reference; do not run directly on new setups." None of the 15 tracked migrations creates these objects or the vector RPC. A fresh staging/local database therefore cannot reproduce the RAG pipeline from the repository alone. This blocks safe benchmarking and makes production schema drift undetectable from code.

##### S5 — Admin and key handling (positive)

- Admin layout calls `requireAdmin()` server-side and redirects non-admins (`app/admin/layout.tsx:18`, `require-admin.ts:20-44`).
- AI logs contain no prompt or chunk content and strip `apiKey`, `secret`, and `password` (`ai-logs.ts:42-70`).
- Provider keys are read server-side via `getSecretWithEnvFallback` and never returned by any route (`lib/ai/providers/gemini.ts:61-66`).

---

### 5. Failure-scenario mapping (A–F)

| Scenario | Where it would occur | Observable evidence | Status |
| --- | --- | --- | --- |
| **A. Content exists but is not retrieved** | Query embedding mismatch, empty index, RPC failure, or all similarities < 0.55 | `diagnostics.candidates = 0` or `aboveThreshold = 0`; logs `[RAG] No chunks passed...` | Static only; live BLOCKED |
| **B. Retrieved but filtered out** | 0.55 threshold, exact-content dedupe, dynamic slice of 2 | `candidates > aboveThreshold > finalCount` in diagnostics | Static only; live BLOCKED |
| **C. Retrieved but omitted from model context** | Only the dynamic slice can omit; after `formatContext`, all final chunks are included | `finalCount` vs. number of facts needed by a multi-part question | Static only; live BLOCKED |
| **D. Model ignores the knowledge** | Generation behavior, weak instruction-following, fallback-model differences | Would require paired `retrieved_chunks` and final answer review | **NOT EXECUTED** |
| **E. Answer corrupted after generation** | Quality gate replaces the model output | `messages.metadata.quality_passed = false` and `quality_reason` | **MEASURED at component level — see below** |
| **F. Content was never crawled or indexed** | Crawl failure, zero usable chunks, `autoEmbed` off, indexing failure, schema drift | `knowledge_sources.status`, `crawl_status`, `metadata.embedding_status`, `chunk_count` | Static; synthetic corpus passed chunking; production BLOCKED |

#### Measured scenario E: the price verifier is asymmetric

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

### 6. Diagnostic tooling assessment

#### What exists

1. Owner playground with retrieved chunks and similarity.
2. Owner knowledge search with chunks and similarity.
3. Persisted per-message diagnostics (`messages.retrieved_chunks`, `messages.metadata.retrieval`).
4. Admin AI interaction logs (provider/model/status/latency; no prompt content).

#### What is missing for this benchmark

1. A read-only, admin-only inspector that takes `(businessId, query)` and returns candidates, similarities, threshold decisions, final chunks, formatted context, and the assembled system prompt.
2. A way to capture the raw model answer **before** quality checks alongside the final answer.
3. A reproducible staging seed for synthetic businesses and chunks.
4. A benchmark runner that records Recall@k/MRR and answer grades without creating production data.

#### Smallest safe additions (proposed — NOT implemented)

1. **Admin retrieval inspector (small):** a server-only page or `POST /api/admin/rag-inspect` guarded by `requireAdmin()`, accepting `businessId` + query, calling `retrieveBusinessContext`, and returning diagnostics + formatted context. Read-only; no message writes; no new tables; rate-limited. This is the minimum needed to demonstrate actual production chunks safely.
2. **Raw-vs-final capture (small):** return `rawModelText` only to the admin inspector response, never persist it to `messages`, never include it in widget history.
3. **Staging seed + benchmark runner (medium):** a versioned baseline migration for the RAG tables and a seed script for the synthetic businesses. This is larger because the schema baseline is currently missing from tracked migrations.

No addition was implemented because the task requires approval before building diagnostic tooling.

---

### 7. Blocked / not executed

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

### 8. Reproduction commands used

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

### 9. Constraint compliance

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

---

<a id="part-ii"></a>

## Part II — Retrieval Benchmark (Test A)

**Status:** **BLOCKED — no retrieval metric was executed.**
**Baseline:** `e772b37`
**Date:** 2026-11-06
**Production changes:** none.

> Do not read the deterministic checks in this document as Recall@k, MRR, or retrieval accuracy. They are pre-retrieval checks on chunking, query expansion, intent classification, and reranking boosts. Actual vector retrieval could not be run.

---

### 1. Why Test A is blocked

| Requirement | Availability |
| --- | --- |
| Supabase URL / service-role key | Missing (no `.env.local`) |
| Gemini embedding key | Missing |
| Seeded isolated business | Not available |
| `knowledge_chunks` and `match_knowledge_chunks` in a reproducible local schema | Not present in tracked migrations |
| Permission to create test businesses | Prohibited by task rules |
| Permission to re-index production | Prohibited by task rules |

The production RAG path is `retrieveBusinessContext` (`lib/ai/rag/retrieve-context.ts:87-199`), which requires a live embedding call and a live `match_knowledge_chunks` RPC. Neither is available in this audit environment.

---

### 2. Synthetic isolated dataset — NovaTech Solutions

NovaTech Solutions is a fictional business created only for this benchmark. `novatech.example` is a reserved example domain. It is unrelated to any real company with a similar name.

#### 2.1 Source corpus (exactly what was chunked)

```text
=== Page: Home ===
URL: https://novatech.example/

# NovaTech Solutions
NovaTech Solutions is a digital studio that designs websites, builds mobile applications, and automates business workflows for growing companies.

# What we do
We deliver three core services: website design, mobile application development, and business process automation.

# How we work
Every project runs for a minimum of 14 working days. The timeline starts after the deposit is received and the project brief is approved.

# Getting started
Contact us at hello@novatech.example or call during business hours.

=== Page: Services ===
URL: https://novatech.example/services

# Website design
Our website design service covers UX planning, responsive page design, and a launch-ready marketing website. The price is NGN 250,000 (₦250,000).

# Mobile applications
We build mobile applications for iOS and Android. Mobile app projects start from NGN 800,000 (₦800,000).

# Business automation
Our automation service connects repetitive workflows such as lead routing, invoicing, and customer follow-up. Automation projects cost NGN 150,000 (₦150,000).

# Custom work
If your project is outside these three services, contact the team for a scoped quote.

=== Page: Pricing ===
URL: https://novatech.example/pricing

# Pricing
Website design: NGN 250,000 (₦250,000).
Mobile applications: from NGN 800,000 (₦800,000).
Business automation: NGN 150,000 (₦150,000).

# Payment terms
A 50% deposit is required before work begins. The remaining 50% is due before final handover.

# Delivery time
Standard delivery takes 14 working days from the date the deposit is received and the brief is approved.

=== Page: How we work ===
URL: https://novatech.example/process

# Project process
Discovery call to confirm scope. Written proposal and acceptance. 50% deposit invoice. Design and build, reviewed in weekly checkpoints. Final handover after the remaining balance is paid.

# Timeline
The standard timeline is 14 working days. Work starts only after the deposit and the approved brief are both in place.

=== Page: Policies ===
URL: https://novatech.example/policies

# Refund policy
Refunds are handled according to the signed project agreement. The agreement defines the refundable portion at each project stage. No refund is automatic; each request is reviewed against the agreement.

# Changes
Scope changes are quoted separately and may extend the 14-working-day timeline.

=== Page: Contact ===
URL: https://novatech.example/contact

# Contact
Email: hello@novatech.example
Business hours: Monday to Friday, 9:00 AM to 5:00 PM. We are closed on Saturdays, Sundays, and public holidays.

# Meetings
Discovery calls are scheduled within business hours, Monday to Friday, 9:00 AM to 5:00 PM.
```

#### 2.2 Actual chunking result

The production `chunkSourceText` produced **6 chunks**, one per page, with these sizes:

| Chunk ID | Page | Section heading | URL | Characters |
| --- | --- | --- | --- | --- |
| `c0` | Home | NovaTech Solutions | `https://novatech.example/` | 533 |
| `c1` | Services | Website design | `https://novatech.example/services` | 573 |
| `c2` | Pricing | Pricing | `https://novatech.example/pricing` | 377 |
| `c3` | How we work | Project process | `https://novatech.example/process` | 337 |
| `c4` | Policies | Refund policy | `https://novatech.example/policies` | 309 |
| `c5` | Contact | Contact | `https://novatech.example/contact` | 254 |

Because each page fits under the 1200-character limit, each page became a single chunk. Gold labels are therefore page-level in this corpus. A production site with longer pages will usually produce multiple chunks per page, so this label granularity does not transfer directly.

---

### 3. 50-question benchmark

#### 3.1 Label rules

- **Gold chunks** are the chunks that contain every required fact for the question.
- A question is a **retrieval hit** if at least one gold chunk appears in the top-k results.
- `missing`, `ambiguous`, and `unrelated` questions have **no gold evidence**. For these, retrieving nothing is acceptable and often desirable. They are excluded from Recall@k/MRR denominators and reported separately as empty-rate and irrelevant-rate.
- Questions P01, P02, and P05 require arithmetic. Their operands must be retrievable; the computed result is not stored verbatim in the knowledge base.

#### 3.2 Questions

| ID | Category | Question | Prior turn | Gold chunks |
| --- | --- | --- | --- | --- |
| E01 | exact | What is the price of website design? | — | c1, c2 |
| E02 | exact | How much does business automation cost? | — | c1, c2 |
| E03 | exact | What is your email address? | — | c0, c5 |
| E04 | exact | What are your business hours? | — | c5 |
| E05 | exact | How many working days does delivery take? | — | c0, c2, c3 |
| E06 | exact | What deposit do you require? | — | c2, c3 |
| E07 | exact | What is the starting price for mobile applications? | — | c1, c2 |
| E08 | exact | What services do you offer? | — | c1, c2 |
| E09 | exact | What is your refund policy? | — | c4 |
| E10 | exact | Are you open on Saturday? | — | c5 |
| S01 | semantic | I need a marketing site for my company. What budget should I plan? | — | c1, c2 |
| S02 | semantic | Can you build an iPhone app, and what does it start from? | — | c1, c2 |
| S03 | semantic | I want to stop doing invoicing by hand. Do you have a service for that? | — | c1, c2 |
| S04 | semantic | How long until my project is live? | — | c0, c2, c3 |
| S05 | semantic | How do I pay you? | — | c2 |
| S06 | semantic | What happens if I change my mind and want my money back? | — | c4 |
| S07 | semantic | How can I reach a human? | — | c0, c5 |
| S08 | semantic | Are you available on weekends? | — | c5 |
| S09 | semantic | Do you handle both web and mobile? | — | c0, c1, c2 |
| S10 | semantic | What time do you close? | — | c5 |
| P01 | pricing | If I order website design and business automation together, what is the total? | — | c1, c2 |
| P02 | pricing | How much is due before work begins on a ₦250,000 website? | — | c2 |
| P03 | pricing | Is ₦800,000 the total cost of a mobile app or the minimum? | — | c1, c2 |
| P04 | pricing | How many working days pass before delivery after the deposit is paid? | — | c0, c2, c3 |
| P05 | pricing | What is the difference between the business automation price and the website design price? | — | c1, c2 |
| M01 | multi-part | What do you charge for websites and apps, and how long does delivery take? | — | c2 |
| M02 | multi-part | What are your hours and your email address? | — | c5 |
| M03 | multi-part | What deposit do you require, and when is the balance due? | — | c2 |
| M04 | multi-part | Which services do you offer and what does each cost? | — | c1, c2 |
| M05 | multi-part | What is your refund policy, and what happens if the scope changes? | — | c4 |
| F01 | follow-up | What about mobile apps? | How much is website design? | c1, c2 |
| F02 | follow-up | Who do I contact about it? | What is your refund policy? | c0, c5 |
| F03 | follow-up | Does the deposit affect that? | How long is delivery? | c0 |
| F04 | follow-up | What do they start from? | Do you build mobile applications? | c1, c2 |
| F05 | follow-up | And on weekends? | What are your business hours? | c5 |
| X01 | missing-info | Do you offer SEO services? | — | none (expect no evidence) |
| X02 | missing-info | Who is your CEO? | — | none |
| X03 | missing-info | Do you offer a money-back guarantee? | — | none |
| X04 | missing-info | Can I pay in installments? | — | none |
| X05 | missing-info | Do you have an office in Lagos? | — | none |
| A01 | ambiguous | How much? | — | none |
| A02 | ambiguous | How long? | — | none |
| A03 | ambiguous | What is your policy? | — | none |
| A04 | ambiguous | Can you do it? | — | none |
| A05 | ambiguous | When can we meet? | — | none |
| U01 | unrelated | What is the weather today? | — | none |
| U02 | unrelated | Write me a Python script. | — | none |
| U03 | unrelated | Who won the 2022 World Cup? | — | none |
| U04 | unrelated | What is the capital of France? | — | none |
| U05 | unrelated | Tell me a joke. | — | none |

Category totals: 10 exact + 10 semantic + 5 pricing + 5 multi-part + 5 follow-up + 5 missing-info + 5 ambiguous + 5 unrelated = **50**.

Labeled questions with gold evidence: **35**.

---

### 4. Metrics and formulas

Let `N = 35` labeled questions. Let `G_q` be the gold chunk set for question `q`, and `R_q(k)` the top-k retrieved chunk IDs.

| Metric | Formula |
| --- | --- |
| Recall@1 | `count(q: G_q ∩ R_q(1) ≠ ∅) / N` |
| Recall@3 | `count(q: G_q ∩ R_q(3) ≠ ∅) / N` |
| Recall@5 | `count(q: G_q ∩ R_q(5) ≠ ∅) / N` |
| MRR | `mean(1 / rank of first gold chunk)`; no gold chunk = 0 |
| Relevant chunk rate | `mean(|G_q ∩ R_q(5)| / |R_q(5)|)` over questions with non-empty results |
| Empty result rate | `count(R_q = ∅) / 50` |
| Irrelevant result rate | `count(G_q ∩ R_q = ∅ AND R_q ≠ ∅) / 35` for labeled questions |

Also report per category: exact, semantic, pricing, multi-part, follow-up.

**Important distinction:** the production retriever returns at most 2 or 5 final chunks (`retrieve-context.ts:167-172`) and applies a 0.55 threshold before that. Test A must record both the raw top-10 candidates and the final post-threshold chunks, otherwise a low Recall@5 could be caused by filtering rather than by the embedding ranking.

---

### 5. Test A procedure (designed, not executed)

1. Provision a local or staging Supabase instance with the complete RAG schema (currently requires a new baseline migration).
2. Seed two isolated businesses:
   - **Business A — NovaTech Solutions** with the corpus above.
   - **Business B — Northwind Digital** with a competing corpus stating website design costs **₦400,000**.
3. Run the normal ingestion path: save source, `chunkSourceText`, embeddings, `knowledge_chunks` insert.
4. For each of the 50 questions, call `retrieveBusinessContext` directly with:
   - `businessId = Business A`,
   - `query = question`,
   - `conversationHistory` containing the prior turn for F01–F05.
5. Record: raw candidates with similarities, above-threshold count, final chunk IDs, final context, and diagnostics.
6. Compute the metrics above.
7. Verify Business B knowledge never appears in Business A results.
8. Tear down the isolated environment.

Do not run this against production, and do not create businesses through the production app.

---

### 6. Pre-retrieval checks that were actually executed

#### 6.1 Fact coverage after chunking — 35/35

For every one of the 35 fact-bearing questions, every required fact string survived chunking and appears in at least one chunk.

| Result | Value |
| --- | --- |
| Labeled questions | 35 |
| Questions with all required facts present in ≥1 chunk | 35 |
| Fact coverage | **35/35 (100%)** |
| Missing-fact questions | 0 |

This is **not** Recall@k. It only proves that chunking did not destroy the evidence before embedding.

#### 6.2 Intent classification after production query expansion

Counts across all 50 questions (`classifyQueryIntent(expandedQuery)`):

| Intent | Count |
| --- | --- |
| pricing | 10 |
| general | 19 |
| service | 5 |
| business_hours | 4 |
| refund | 4 |
| contact | 3 |
| shipping | 3 |
| sales | 1 |
| location | 1 |

`general` means no intent-specific rerank boost is applied. That is not automatically a failure, but it removes the boost designed for pricing, contact, refund, hours, and location questions.

#### 6.3 Follow-up expansion — 5/5 expanded

| ID | Raw question | Expanded query | Intent |
| --- | --- | --- | --- |
| F01 | What about mobile apps? | How much is website design? / Follow-up: What about mobile apps? | pricing |
| F02 | Who do I contact about it? | What is your refund policy? / Follow-up: Who do I contact about it? | refund |
| F03 | Does the deposit affect that? | How long is delivery? / Follow-up: Does the deposit affect that? | shipping |
| F04 | What do they start from? | Do you build mobile applications? / Follow-up: What do they start from? | general |
| F05 | And on weekends? | What are your business hours? / Follow-up: And on weekends? | business_hours |

Production expansion works for the short/referential follow-ups. F04 still classifies as `general`, so it receives no pricing boost even though the expected answer is a price.

#### 6.4 Rerank boost gaps (executed against the 6 synthetic chunks)

| Query | Intent | Chunks receiving a boost |
| --- | --- | --- |
| What deposit do you require? | general | none |
| How do I pay you? | general | none |
| If I order website design and business automation together, what is the total? | sales | none |
| How long until my project is live? | general | none |

These questions are expected to be answered from `c2` / `c1`, but the keyword boosts do not fire. Retrieval for them depends entirely on embedding similarity and the 0.55 threshold.

Relevant code: `lib/ai/intent/classify-query.ts:18-67`; `lib/ai/rag/chunk-scoring.ts:15-150`.

---

### 7. Status summary

| Metric | Status | Value |
| --- | --- | --- |
| Recall@1 | BLOCKED | not executed |
| Recall@3 | BLOCKED | not executed |
| Recall@5 | BLOCKED | not executed |
| MRR | BLOCKED | not executed |
| Relevant chunk rate | BLOCKED | not executed |
| Empty result rate | BLOCKED | not executed |
| Irrelevant result rate | BLOCKED | not executed |
| Cross-business leakage | BLOCKED (static analysis only) | no cross-tenant filter gap found |
| Fact coverage after chunking | EXECUTED | 35/35 |
| Query expansion | EXECUTED | 5/5 expanded |
| Intent classification | EXECUTED | distribution above |
| Rerank boost gaps | EXECUTED | 4 representative gaps |

No retrieval score is claimed.

---

<a id="part-iii"></a>

## Part III — Answer Benchmark (Test B)

**Status:** **BLOCKED — no end-to-end answer was generated or graded.**
**Baseline:** `e772b37`
**Date:** 2026-11-06
**Production changes:** none.

> No answer correctness, groundedness, hallucination, or numerical-accuracy score is claimed. The only executed answer-path check is a component-level test of the post-generation quality gate, reported separately in §5.

---

### 1. Why Test B is blocked

| Requirement | Availability |
| --- | --- |
| Live Gemini chat key | Missing |
| Live Supabase project with seeded knowledge | Missing |
| Seeded NovaTech / Northwind businesses | Not available |
| Admin or staging access to inspect raw model output | Not available |
| Permission to create test businesses or messages | Prohibited |
| Capture of the raw model answer before quality checks | Not persisted anywhere |

The pipeline stores only the **final** reply after `runResponseQualityChecks` (`lib/actions/chat/ai-response.ts:81-85`, `message-persistence.ts:25-72`). Without the raw text, a wrong answer cannot be attributed to the model versus the post-processor.

---

### 2. Answer grading rubric

| Label | Definition |
| --- | --- |
| **Correct** | The reply contains the gold fact and no material omission or contradiction. |
| **Partially correct** | Some required facts are present; at least one is missing or vague. |
| **Grounded** | Every factual claim is traceable to the retrieved context or the verified business profile. |
| **Unsupported** | A claim is not contradicted by context but is not supported by it either. |
| **Hallucination** | A specific claim is contradicted by context, or a specific price/contact/policy is invented. |
| **Correct uncertainty** | For missing-info questions: explicitly says the information is unavailable and offers follow-up, without inventing. |
| **Correct clarification** | For ambiguous questions: asks a clarifying question instead of guessing. |
| **Numerical accuracy** | The amount and currency match the gold value exactly after formatting normalization. |
| **Cross-business leakage** | Any Business B fact (Northwind Digital: ₦400,000) appears in a Business A answer. |
| **Post-processing survival** | A correct raw answer is not replaced by the fallback during quality checks. |

A reply can be grounded but incorrect (wrong retrieval, faithfully quoted), or correct but ungrounded (lucky guess). Both are recorded separately.

---

### 3. Expected behavior by question

#### 3.1 Exact (10)

| ID | Question | Expected answer / behavior | Evidence |
| --- | --- | --- | --- |
| E01 | What is the price of website design? | ₦250,000 (or NGN 250,000). | c1, c2 |
| E02 | How much does business automation cost? | ₦150,000. | c1, c2 |
| E03 | What is your email address? | hello@novatech.example. | c0, c5 |
| E04 | What are your business hours? | Monday–Friday, 9:00 AM–5:00 PM. | c5 |
| E05 | How many working days does delivery take? | 14 working days. | c0, c2, c3 |
| E06 | What deposit do you require? | 50% before work begins. | c2, c3 |
| E07 | What is the starting price for mobile applications? | From ₦800,000. | c1, c2 |
| E08 | What services do you offer? | Website design, mobile applications, business automation. | c1, c2 |
| E09 | What is your refund policy? | Refunds follow the signed project agreement; no refund is automatic. | c4 |
| E10 | Are you open on Saturday? | No; closed Saturdays, Sundays, and public holidays. | c5 |

#### 3.2 Semantic / paraphrase (10)

| ID | Question | Expected answer / behavior | Evidence |
| --- | --- | --- | --- |
| S01 | I need a marketing site for my company. What budget should I plan? | Website design is ₦250,000. | c1, c2 |
| S02 | Can you build an iPhone app, and what does it start from? | Yes; mobile apps start from ₦800,000. | c1, c2 |
| S03 | I want to stop doing invoicing by hand. Do you have a service for that? | Yes; business automation costs ₦150,000. | c1, c2 |
| S04 | How long until my project is live? | Standard delivery is 14 working days from deposit and approved brief; avoid promising a specific go-live date. | c0, c2, c3 |
| S05 | How do I pay you? | 50% deposit before work; remaining 50% before final handover. | c2 |
| S06 | What happens if I change my mind and want my money back? | Refunds are handled per the signed project agreement; no automatic refund. | c4 |
| S07 | How can I reach a human? | hello@novatech.example; Monday–Friday 9–5. | c0, c5 |
| S08 | Are you available on weekends? | No; closed weekends and public holidays. | c5 |
| S09 | Do you handle both web and mobile? | Yes; websites and mobile apps. | c0, c1, c2 |
| S10 | What time do you close? | 5:00 PM. | c5 |

#### 3.3 Pricing / numerical (5)

| ID | Question | Expected answer / behavior | Evidence | Risk |
| --- | --- | --- | --- | --- |
| P01 | If I order website design and business automation together, what is the total? | ₦400,000 (250,000 + 150,000). | c1, c2 | Computed value is not verbatim in context; quality gate may replace it. |
| P02 | How much is due before work begins on a ₦250,000 website? | ₦125,000 (50% of 250,000). | c2 | Same computed-value risk. |
| P03 | Is ₦800,000 the total cost of a mobile app or the minimum? | It is the starting/minimum price; total may vary. | c1, c2 | Low; answer can quote "from ₦800,000" verbatim. |
| P04 | How many working days pass before delivery after the deposit is paid? | 14 working days. | c0, c2, c3 | Low. |
| P05 | What is the difference between the business automation price and the website design price? | ₦100,000 (250,000 − 150,000). | c1, c2 | Same computed-value risk. |

**Measured risk:** see §5. When the computed total is written with `₦`, the quality gate replaces it with the fallback; the same value written with `NGN` or as a bare number passes. This will make P01, P02, and P05 unstable in ways that do not depend on the model.

#### 3.4 Multi-part (5)

| ID | Question | Expected answer / behavior | Evidence |
| --- | --- | --- | --- |
| M01 | What do you charge for websites and apps, and how long does delivery take? | Websites ₦250,000; apps from ₦800,000; delivery 14 working days. | c2 |
| M02 | What are your hours and your email address? | Monday–Friday 9–5; hello@novatech.example. | c5 |
| M03 | What deposit do you require, and when is the balance due? | 50% deposit before work; remaining 50% before final handover. | c2 |
| M04 | Which services do you offer and what does each cost? | Three services with ₦250,000 / from ₦800,000 / ₦150,000. | c1, c2 |
| M05 | What is your refund policy, and what happens if the scope changes? | Refunds per signed agreement; scope changes quoted separately and may extend the 14-working-day timeline. | c4 |

A multi-part answer is **partially correct** if only one half is answered. The dynamic slice is designed to keep 5 chunks for compound questions (`retrieve-context.ts:165-172`), so these questions also test whether the slice and the model's 1000-token output limit are sufficient.

#### 3.5 Follow-up (5)

| ID | Prior turn | Follow-up | Expected answer / behavior | Evidence |
| --- | --- | --- | --- | --- |
| F01 | How much is website design? | What about mobile apps? | Apps start from ₦800,000. | c1, c2 |
| F02 | What is your refund policy? | Who do I contact about it? | hello@novatech.example. | c0, c5 |
| F03 | How long is delivery? | Does the deposit affect that? | Yes; the timeline starts after the deposit and approved brief. | c0 |
| F04 | Do you build mobile applications? | What do they start from? | From ₦800,000. | c1, c2 |
| F05 | What are your business hours? | And on weekends? | Closed Saturdays, Sundays, and public holidays. | c5 |

The retrieval query is expanded before embedding (`retrieve-context.ts:63-85`), so these are not evaluated as standalone questions. F04 still classifies as `general`, and none of the follow-up intents receive a boost except F01/F02/F05 via their expanded prefix.

#### 3.6 Missing information (5)

| ID | Question | Expected behavior | Correctness rule |
| --- | --- | --- | --- |
| X01 | Do you offer SEO services? | Do not claim SEO. SEO is not listed; say it is not in the provided information and offer the team follow-up or a scoped quote for custom work. | Correct uncertainty or grounded custom-work answer |
| X02 | Who is your CEO? | Say the information is not available; offer follow-up. | Correct uncertainty |
| X03 | Do you offer a money-back guarantee? | Do not promise a guarantee; refunds are per the signed agreement. | Grounded uncertainty |
| X04 | Can I pay in installments? | Do not confirm installments; the knowledge only states 50% deposit and remaining 50% before handover. | Correct uncertainty |
| X05 | Do you have an office in Lagos? | No address or location is in the knowledge; say it is not available. | Correct uncertainty |

A confident "yes" or an invented policy is a **hallucination**. This category also tests the no-knowledge branch of the prompt (`business-system-prompt.ts:54-57`).

#### 3.7 Ambiguous (5)

| ID | Question | Expected behavior | Correctness rule |
| --- | --- | --- | --- |
| A01 | How much? | Ask which service: website, mobile app, or automation. | Correct clarification |
| A02 | How long? | Ask what "long" refers to; if delivery, state 14 working days. | Clarification or grounded qualification |
| A03 | What is your policy? | Ask whether they mean refunds or scope changes. | Correct clarification |
| A04 | Can you do it? | Ask what "it" is. | Correct clarification |
| A05 | When can we meet? | Do not confirm a booking; discovery calls are within business hours Mon–Fri 9–5, and the team confirms. | Clarification + escalation rule |

Guessing a price or service for A01 is a failure even if the guessed number exists in the knowledge base.

#### 3.8 Unrelated (5)

| ID | Question | Expected behavior |
| --- | --- | --- |
| U01 | What is the weather today? | Briefly decline; redirect to NovaTech services. No weather answer. |
| U02 | Write me a Python script. | Decline; redirect. |
| U03 | Who won the 2022 World Cup? | Decline; no general knowledge. |
| U04 | What is the capital of France? | Decline; no general knowledge. |
| U05 | Tell me a joke. | Decline or a minimal deflection; do not derail. |

Grounding rule 6 forbids outside knowledge (`business-system-prompt.ts:91`). These questions test whether the model obeys that rule when retrieval returns weak or irrelevant chunks.

---

### 4. Test B procedure (designed, not executed)

For every question:

1. Run retrieval exactly as in Test A and record the final context.
2. Capture the **raw model text before quality checks**.
3. Capture the final text after quality checks, `quality_passed`, and `quality_reason`.
4. Grade the raw text against the rubric.
5. Grade the final text separately.
6. Compare raw vs. final to isolate post-processing effects (scenario E).
7. Repeat with a second isolated business (Business B at ₦400,000) to test cross-business leakage.
8. Record provider, model, fallback flag, and latency.

Minimum capture requirement: raw text and final text must both be available. The current system persists only the final text, so this is a required diagnostic addition.

---

### 5. Component-level checks that were actually executed

These checks called the production `runResponseQualityChecks` directly against the synthetic NovaTech context. They do not involve a model.

| Answer text | Context | Passed? | Reason | Interpretation |
| --- | --- | --- | --- | --- |
| `Website design costs NGN 250,000.` | NovaTech corpus | Yes | — | Correct exact price survives |
| `The combined total is ₦400,000.` | NovaTech corpus | **No** | `unverified_price` | Correct arithmetic is destroyed |
| `The combined total is NGN 400,000.` | NovaTech corpus | Yes | — | Same arithmetic survives due to a regex blind spot |
| `The combined total is 400,000.` | NovaTech corpus | Yes | — | Bare number also survives |
| `The deposit is ₦125,000.` | NovaTech corpus | **No** | `unverified_price` | Correct deposit calculation is destroyed |
| `Email us at sales@novatech.example.` | NovaTech corpus | **No** | `hallucinated_email` | Correct safety behavior |

#### 5.1 Consequence for the answer benchmark

- P01, P02, and P05 have a **format-dependent** outcome that is independent of model quality.
- If the model writes `₦400,000`, the graded final answer is the fallback and will be marked **incorrect** even though the raw answer was correct.
- If the model writes `NGN 400,000` or `400,000`, the same unverified computed value passes the gate, which is a **false negative** for price safety.
- Any Test B score for these questions must report both raw and final answers, or it will misattribute a post-processing defect to the model.

#### 5.2 Safety checks that are working

- Hallucinated email was rejected.
- Exact prices present in context were allowed.
- The existing reliability suite also verifies invented prices and hallucinated contacts (`tests/ai-engine-reliability.test.ts:259-318`), and all 27 tests pass.

---

### 6. Metrics and status

| Metric | Formula | Status | Value |
| --- | --- | --- | --- |
| Correct rate | correct / 50 | BLOCKED | not executed |
| Grounded rate | grounded / 50 | BLOCKED | not executed |
| Unsupported claim rate | unsupported / 50 | BLOCKED | not executed |
| Hallucination rate | hallucination / 50 | BLOCKED | not executed |
| Correct uncertainty rate | correct uncertainty / 5 missing-info | BLOCKED | not executed |
| Correct clarification rate | correct clarification / 5 ambiguous | BLOCKED | not executed |
| Numerical accuracy | exact numeric match / 5 pricing | BLOCKED | not executed |
| Cross-business leakage | leaked answers / 50 | BLOCKED | not executed |
| Post-processing survival | raw-correct but final-fallback / raw-correct | PARTIAL (component only) | demonstrated for ₦-formatted computed totals |

Per-category answer scores are intentionally omitted. Reporting them without generated answers would fabricate results.

---

### 7. What "model ignores knowledge" would look like

Scenario D can only be established by comparing:

1. the exact formatted context (known),
2. the raw model output (currently not captured),
3. the final output (persisted).

If the raw output contradicts or omits a fact that is present in the context, that is scenario D. If the raw output is correct but the final output is the fallback, that is scenario E. The current system cannot distinguish these without the raw-text capture described in `RAG_DIAGNOSTIC_AUDIT.md` §6.

---

### 8. Status summary

| Category | Questions | Live evaluation |
| --- | --- | --- |
| Exact | 10 | BLOCKED |
| Semantic | 10 | BLOCKED |
| Pricing / numerical | 5 | BLOCKED (component defect measured) |
| Multi-part | 5 | BLOCKED |
| Follow-up | 5 | BLOCKED |
| Missing-info | 5 | BLOCKED |
| Ambiguous | 5 | BLOCKED |
| Unrelated | 5 | BLOCKED |

No answer score is claimed.

---

<a id="part-iv"></a>

## Part IV — Failure Analysis

**Baseline:** `e772b37`
**Date:** 2026-11-06
**Method:** static code tracing + deterministic component execution + test-suite execution. No live retrieval or generation.

This document separates **measured** findings from **static** risks and **unmeasured hypotheses**. A finding is not called a root cause unless the evidence supports it.

---

### 1. Scenario A — Content exists but is not retrieved

#### Mechanism

1. Query is expanded (`retrieve-context.ts:63-85`) and embedded (`retrieve-context.ts:118`).
2. Supabase returns the top 10 by cosine distance (`retrieve-context.ts:122-126`).
3. Any chunk below `0.55` is discarded (`retrieve-context.ts:138`).

Failure occurs if the query embedding is semantically distant from the relevant chunk, if the index is empty, or if the RPC fails. RPC failure is converted into an empty result, not an exception (`retrieve-context.ts:128-132,194-198`), so the chat continues with `No specific knowledge found for this query.`

#### Evidence

- Threshold is hardcoded at `0.55`; it is not read from `ai_engine_settings`.
- `match_count` is `5 × 2 = 10`, so only 10 candidates are considered.
- There is no lexical/BM25 hybrid fallback.
- Embedding model must return exactly 768 dimensions or the call throws (`lib/ai/engine/embeddings.ts:22-44`).

#### Questions most exposed

| Question type | Example | Why |
| --- | --- | --- |
| Vocabulary mismatch | S01 “marketing site” vs. “website design” | Embedding must bridge the paraphrase |
| Unboosted payment wording | E06 “deposit”, S05 “How do I pay you?” | Intent is `general`; no pricing boost |
| Unboosted total wording | P01 “order … total” | Intent is `sales`; no chunk contains sales keywords, so boost is zero |
| Unboosted timeline wording | S04 “project is live” | Intent is `general`; no boost |

#### Status

**UNMEASURED.** No live embedding or vector query was possible. Severity if present: high (answer becomes fallback or unsupported). Confidence that the mechanism exists: high; confidence that it affects a specific production question: unknown.

---

### 2. Scenario B — Retrieved but filtered out

#### Mechanism

After the RPC:

1. `similarity >= 0.55` filter (`retrieve-context.ts:138`).
2. Exact-content dedupe after whitespace/case normalization (`retrieve-context.ts:141-151`).
3. Intent boost and sort (`retrieve-context.ts:154-163`).
4. Dynamic slice: 2 chunks if top similarity ≥ 0.70 and the query is not compound; otherwise 5 (`retrieve-context.ts:167-172`).

A chunk can be in the top 10 and still never reach the prompt because it is below 0.55, is an exact duplicate, or ranks below the slice cutoff.

#### Evidence and observations

- The 2-chunk slice is aggressive. It is only widened for queries containing `and|also|plus|as well as|both` or more than one `?` (`retrieve-context.ts:56,169`).
- Multi-part questions in the benchmark contain “and”, so they keep 5 chunks. A single-topic question with evidence split across two pages may still be cut to 2.
- Dedupe uses exact normalized content. Two pages that repeat the same paragraph collapse to one chunk; this is usually correct but can remove the page-level label used by the benchmark.
- Diagnostics expose `candidates`, `aboveThreshold`, `finalCount`, and `dynamicLimit`, so this scenario is fully observable once a live inspector exists.

#### Status

**STATIC ONLY.** No live candidate list was available. Severity: medium. Confidence in the mechanism: high; frequency: unknown.

---

### 3. Scenario C — Retrieved but omitted from the model context

#### Mechanism

After slicing, `formatContext` maps every final chunk into the context string (`build-context.ts:6-26`). There is no further truncation, summarization, or token-budget pruning before the prompt is assembled. Therefore the only way a retrieved chunk is omitted is the dynamic slice (Scenario B), not the formatter.

#### Prompt size

- Maximum final chunks: 5.
- Maximum chunk length: 1200 characters.
- Worst-case context: ~6000 characters (~1500 estimated tokens), plus profile, rules, summary, and up to 8 history messages.
- Chat output limit is 1000 tokens (`ai-response.ts:75`), which limits answer length, not context inclusion.

#### Status

**LOW RISK / STATIC.** Omission after retrieval is architecturally unlikely. The real omission risk is the slice, already covered in B.

---

### 4. Scenario D — Model ignores the knowledge

#### Mechanism

The model receives the formatted context under `# KNOWLEDGE BASE CONTEXT` and 10 grounding rules (`business-system-prompt.ts:82-95`). It can still:

- answer from parametric knowledge,
- paraphrase a price incorrectly,
- omit half of a multi-part answer,
- follow a fallback model with weaker instruction adherence.

#### Contributing factors visible in code

1. **Cheaper model routing:** benchmark questions that match a simple-FAQ pattern (price, hours, contact, booking) or are shorter than 35 characters route from `gemini-2.5-flash` to `gemini-2.5-flash-lite` (`lib/ai/engine/chat.ts:36-56`). Questions matching those patterns are therefore answered by the lite model, not the primary model.
2. **Fallback model:** on primary failure, the request goes to `openai/gpt-oss-20b:free` (`lib/ai/engine/config.ts:19-22`), a different model with different instruction-following behavior.
3. **Output cap:** 1000 output tokens (`ai-response.ts:75`) may truncate multi-part answers, especially M01, M04, and M05.
4. **Summary block:** a conversation summary is prepended as “secondary memory” (`ai-response.ts:53-62`). It is explicitly non-authoritative, but it still consumes attention and context.

#### Status

**NOT EXECUTED.** This cannot be measured without raw model output. No claim is made about whether the model actually ignores knowledge in production.

#### How to measure it

Capture raw model text before `runResponseQualityChecks`, then compare it to the formatted context and the gold answer. This is the single most important missing diagnostic capability.

---

### 5. Scenario E — Answer corrupted after generation (MEASURED)

#### 5.1 Price verifier asymmetry

The price check (`quality-checks.ts:102-120`) matches:

- currency symbol **before** amount: `₦400,000`,
- amount **before** currency word: `400,000 NGN`.

It does **not** match:

- currency code **before** amount: `NGN 400,000`,
- bare amounts: `400,000`.

Executed against the NovaTech context:

| Raw answer | Final result | Reason |
| --- | --- | --- |
| `Website design costs NGN 250,000.` | Pass | Exact context value |
| `The combined total is ₦400,000.` | Fallback | `unverified_price` |
| `The combined total is NGN 400,000.` | Pass | Regex blind spot |
| `The combined total is 400,000.` | Pass | Bare number ignored |
| `The deposit is ₦125,000.` | Fallback | `unverified_price` |
| `Email us at sales@novatech.example.` | Fallback | `hallucinated_email` |

#### Impact

- **False positive:** a correct computed answer is replaced when written with `₦`, which is the natural Nigerian currency format and the format used in the task's own facts.
- **False negative:** the same unverified number passes when written with `NGN` or bare, so the guard is not reliable as a safety control.
- **Benchmark impact:** P01, P02, and P05 will score differently based on answer formatting, not on model or retrieval quality.
- **Severity:** high. This is the only defect in this audit that is both measured and directly answer-corrupting.

#### 5.2 Other post-processors

| Check | Behavior | Risk |
| --- | --- | --- |
| System-prompt leakage | Replaces text containing phrases like “system prompt” | Low; legitimate answers rarely contain these |
| Technical RAG leakage | Replaces text containing “chunk”, “embedding”, “vector search” | Low; could theoretically trigger on an unrelated use of “chunk” |
| Response length | Replaces text > 2500 characters | Low; multi-part answers might approach this |
| Email check | Replaces unverified emails | Working as intended (measured) |
| Phone check | Replaces unverified 7+ digit numbers | Needs live testing for false positives |
| Price check | See above | **Defective** |

---

### 6. Scenario F — Content was never crawled or indexed

#### Crawl-side risks

| Risk | Evidence | Impact |
| --- | --- | --- |
| JavaScript-only pages produce little text | `crawl-website.ts:124-135` skips pages under 10 words after extraction | Real content never indexed |
| Defaults limit coverage | `maxPages = 10`, `depth = 1` (`crawl-website.ts:33-35`); source overrides exist | Deep pages never reached |
| Sitemap-only content | Sitemap URLs are queued at depth 1; sitemap index recurses up to 8 children (`lib/scraper/sitemap.ts`) | Better, but still capped |
| Partial crawl | `crawl_status: partial`, failed pages recorded | Some facts unavailable |
| Total crawl failure | Previous content preserved, status appropriate, notification created (`knowledge.ts:590-621`) | Old knowledge continues to be used |

#### Index-side risks

| Risk | Evidence | Impact |
| --- | --- | --- |
| Source trained but not embedded | `processWebsiteSource` saves content and indexes; on indexing failure returns `embedded: false` + warning (`knowledge.ts:62-84,501-509`) | Stored but unsearchable |
| `autoEmbed` off | `crawlWebsiteSource` leaves `embedding_status: pending` (`knowledge.ts:661-667`) | Unsearchable until manual embed |
| Zero usable chunks | `embedding_status: failed` with explicit error (`generate-source.ts:180-198`) | Unsearchable |
| Embedding provider mismatch | 768-dimension enforcement rejects other models (`embeddings.ts:22-44`) | Index build fails loudly |
| Schema drift | RAG tables/RPC only in `legacy_sql`, which is documented as not for new setups (`supabase/README.md:6-8`) | Fresh environment cannot store or query vectors |

#### Synthetic result

The isolated NovaTech corpus produced 6/6 page chunks and preserved every required fact (35/35 fact-bearing questions). This rules out chunking as a cause **for that corpus and size**, not for longer production pages.

#### Status

**STATIC + SYNTHETIC.** Production crawl/index status is unmeasured. Severity: high when it occurs, because the assistant falls back for all questions on the missing topic. Confidence: mechanism confirmed; production frequency unknown.

---

### 7. Cross-business isolation

#### Static controls

| Control | Evidence | Result |
| --- | --- | --- |
| Vector RPC tenant filter | `where knowledge_chunks.business_id = match_business_id` (`embeddings-schema.sql:79-82`) | No cross-tenant rows returned by the RPC |
| Conversation reuse | `.eq("id", conversationId).eq("business_id", businessId)` (`conversation-management.ts:67-74`) | Cannot attach an A-owned conversation to B |
| Dashboard sender | Business derived from authenticated owner (`lib/actions/chat.ts:154-167`) | Client cannot select another business |
| Demo sender | Business derived from `demo_businesses.placeholder_business_id` (`app/api/demo/chat/route.ts`) | Client IDs ignored |
| Knowledge search | Explicit `business.id !== businessId` rejection (`lib/actions/knowledge.ts:862-866`) | Owner cannot search another tenant |
| RLS | Owner policies on chunks, sources, messages, conversations | Defence in depth for non-service-role paths |

#### Residual risks

1. **Widget conversation rebinding (S2):** reuse checks `business_id` but not `visitor_id` (`conversation-management.ts:66-75`). A leaked conversation UUID allows appending to another visitor's conversation. This does not cross businesses, but it can expose that conversation's prior content through the model.
2. **Service-role bypass:** the chat runtime does not use RLS; it relies on server-derived tenant keys. The widget's client-supplied `businessId` is a tenant selector, not an authorization token, but the RPC still constrains it to its own rows.
3. **Widget history diagnostics (S1):** metadata exposure, discussed in the diagnostic audit.

#### Live isolation test (designed, blocked)

1. Business A = NovaTech Solutions, website design ₦250,000.
2. Business B = Northwind Digital, website design ₦400,000.
3. Ask all pricing questions as Business A; assert no answer contains ₦400,000.
4. Ask all pricing questions as Business B; assert no answer contains ₦250,000.
5. Attempt to reuse an A conversation ID while sending a B business ID; expect “Conversation not found.”
6. Attempt to read A history with a B visitor ID; expect 403.

**Status: BLOCKED.** No isolated database and no permission to create test businesses.

---

### 8. Confirmed findings, ranked

| Rank | Finding | Scenario | Evidence | Severity | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Price verifier corrupts correct computed `₦` answers and ignores `NGN`-prefixed or bare amounts | E | Executed component test | High | **Measured** |
| 2 | Retrieval diagnostics are returned to widget visitors in message metadata | Security | `message-persistence.ts:64`, `history/route.ts:86-98` | Medium-high | **Static, direct** |
| 3 | Rerank boosts do not fire for deposit/payment/total/timeline wording | A/B contributor | Executed intent + boost test | Medium | **Measured** |
| 4 | Widget conversation reuse is not bound to `visitorId` | Security | `conversation-management.ts:66-75` | Medium | **Static, direct** |
| 5 | RAG schema cannot be reproduced from tracked migrations | F / operations | `supabase/README.md:6-8`; legacy-only definitions | High operational | **Static, direct** |
| 6 | Raw model output is not captured, so model-vs-post-processor failures cannot be separated | D/E | `ai-response.ts:68-97`, persistence stores final only | High diagnostic | **Static, direct** |

---

### 9. Unmeasured hypotheses (do not treat as conclusions)

| Hypothesis | Why plausible | What would confirm it |
| --- | --- | --- |
| Embedding similarity misses paraphrases such as “marketing site” | No lexical fallback; 0.55 threshold | Test A retrieval list |
| The 2-chunk slice drops needed evidence on single-topic multi-page questions | Aggressive slice at ≥0.70 | Test A `finalCount` vs. gold |
| `gemini-2.5-flash-lite` follows grounding rules less reliably | Most FAQ-like questions route to it | Paired raw answers by model |
| The free OpenRouter fallback produces more hallucinations | Different model, weaker guarantees | Fallback-only test run |
| 1000 output tokens truncates multi-part answers | M01/M04/M05 are long | Raw answer finish reason / length |
| Crawling misses JS-rendered content | Deterministic extractor; low-value skip | Crawl a controlled JS-only fixture |

None of these is reported as a failure rate.

---

### 10. Top five root causes (evidence-weighted)

1. **Measured post-processing defect (price gate).** It destroys correct answers written with `₦` and lets unverified `NGN`/bare amounts through.
2. **Rerank/intent lexicon gaps.** Deposit, payment, total, and timeline questions receive no boost, leaving retrieval entirely dependent on embedding similarity and the 0.55 cutoff.
3. **Retrieval filter and slice opacity.** The 0.55 threshold and 2-chunk slice are hardcoded and can suppress correct evidence, but this is not observable without an inspector.
4. **No raw-answer capture.** It is impossible to distinguish “model ignored knowledge” from “retrieval missed” from “post-processor replaced a correct answer.”
5. **No reproducible RAG environment.** Legacy-only schema plus absent credentials means retrieval quality cannot be measured or regression-tested safely.

Security findings S1 and S2 are not accuracy root causes, but they are material and should be scheduled alongside the first fix.

---

<a id="part-v"></a>

## Part V — Baseline Summary

**Baseline:** `e772b37` — `fix(ai): ground answers in knowledge and harden indexing`
**Commit date:** 2026-11-05
**Audit date:** 2026-11-06
**Mode:** read-only
**Application code, prompts, thresholds, embedding model, schema, crawler, and production indexes were not changed.**

---

### 1. What this baseline is

| Item | Value |
| --- | --- |
| Implementation audited | Current committed implementation at `e772b37` |
| Does it include the earlier reliability overhaul? | **Yes** |
| Is this a pre-overhaul baseline? | **No** |
| Why not? | Reverting the code or checking out an older commit would modify the workspace and still could not run without credentials |
| Live database inspected | No |
| Live model called | No |
| Synthetic corpus executed through production chunker/formatter | Yes |
| Test suite executed | Yes |

The baseline is therefore a **current-state, component-level baseline**. It establishes what is true by code inspection and deterministic execution, and it explicitly marks everything that requires live data as blocked.

---

### 2. What was actually executed

| Check | Command / method | Result |
| --- | --- | --- |
| Full test suite | `npx vitest run --pool=threads` | **18 files, 119/119 tests passed** |
| AI reliability suite | `npx vitest run tests/ai-engine-reliability.test.ts --pool=threads` | **27/27 tests passed** |
| Default test command | `npx vitest run` | **Did not start** — forks worker timed out under Node v26.5.0; not a test failure |
| Synthetic chunking | Production `chunkSourceText` via `tsx` | 6 chunks, 254–573 chars |
| Fact coverage | 35 fact-bearing benchmark questions | **35/35** required facts present in ≥1 chunk |
| Query expansion | Production `buildRetrievalQuery` | **5/5** follow-ups expanded |
| Intent classification | Production `classifyQueryIntent` on expanded queries | pricing 10, general 19, service 5, hours 4, refund 4, contact 3, shipping 3, sales 1, location 1 |
| Rerank boost probe | Production `scoreChunkRelevance` | 4 representative pricing/payment/timeline questions received **zero boost** |
| Quality gate probe | Production `runResponseQualityChecks` | 6 probes; price behavior is format-dependent and defective |
| Context formatting | Production `formatContext` | Exact context block produced; empty case returns the documented fallback string |

No retrieval or generation score was produced.

---

### 3. Baseline scorecard

#### 3.1 Retrieval (Test A)

| Metric | Status | Value |
| --- | --- | --- |
| Recall@1 | BLOCKED | — |
| Recall@3 | BLOCKED | — |
| Recall@5 | BLOCKED | — |
| MRR | BLOCKED | — |
| Relevant chunk rate | BLOCKED | — |
| Empty result rate | BLOCKED | — |
| Irrelevant result rate | BLOCKED | — |
| Cross-business leakage | BLOCKED | static analysis found no RPC tenant-filter gap |

#### 3.2 Answer quality (Test B)

| Metric | Status | Value |
| --- | --- | --- |
| Correct rate | BLOCKED | — |
| Grounded rate | BLOCKED | — |
| Unsupported claim rate | BLOCKED | — |
| Hallucination rate | BLOCKED | — |
| Correct uncertainty rate | BLOCKED | — |
| Correct clarification rate | BLOCKED | — |
| Numerical accuracy | BLOCKED | — |
| Cross-business leakage | BLOCKED | — |
| Post-processing survival | PARTIAL (component only) | correct `₦`-formatted computed totals are replaced |

#### 3.3 Component checks that did produce values

| Check | Value | Interpretation |
| --- | --- | --- |
| Fact survival after chunking | 35/35 | Chunking did not destroy synthetic evidence |
| Follow-up expansion | 5/5 | Referential follow-ups are rewritten |
| Rerank boost coverage | 4 representative gaps | Payment/deposit/total/timeline wording gets no boost |
| Quality gate: exact price | Pass | Correct exact context price survives |
| Quality gate: `₦` computed total | Fail (`unverified_price`) | Correct arithmetic is destroyed |
| Quality gate: `NGN` computed total | Pass | Unverified arithmetic slips through |
| Quality gate: bare computed total | Pass | Unverified arithmetic slips through |
| Quality gate: hallucinated email | Fail (`hallucinated_email`) | Safety check works |

---

### 4. Top five root causes

1. **Measured post-processing defect — price verification.**
   The verifier matches `₦amount` and `amount NGN`, but not `NGN amount` or bare numbers. Correct computed answers written with `₦` are replaced; unverified numbers written with `NGN` or bare pass. This is the only defect that is both measured and directly corrupts otherwise-correct answers.

2. **Rerank/intent lexicon gaps.**
   Deposit, “how do I pay”, “what is the total”, and “how long until live” classify as `general` or `sales` and receive no pricing/timeline boost. Retrieval for these questions depends entirely on embedding similarity and the 0.55 cutoff.

3. **Hardcoded retrieval filter and aggressive slice.**
   A 0.55 threshold and a 2-chunk slice at top similarity ≥ 0.70 can suppress correct evidence. The slice widens for compound questions, but single-topic multi-page evidence can still be cut. This is not observable without a live inspector.

4. **No raw-answer capture.**
   Only the post-quality-check reply is persisted. It is impossible to distinguish “retrieval missed”, “model ignored knowledge”, and “post-processor replaced a correct answer.” This blocks every attribution exercise.

5. **No reproducible RAG environment.**
   `knowledge_sources`, `knowledge_chunks`, `match_knowledge_chunks`, `messages`, `ai_engine_settings`, and `ai_interaction_logs` exist only in `supabase/legacy_sql/`, which is documented as not for new setups. Fresh environments cannot build or query the RAG index, so retrieval cannot be regression-tested safely.

Two security findings are outside the accuracy ranking but should be scheduled with the first fix:

- widget history returns retrieval diagnostics in `metadata`;
- widget conversation reuse does not verify `visitorId`.

---

### 5. If only one thing could be fixed first

**Fix the price verification gate first.**

Why:

- It is the only **measured** defect that corrupts a correct answer.
- It is isolated to `lib/ai/evaluation/quality-checks.ts:102-120`; the blast radius is small.
- It affects the natural Nigerian currency format (`₦`), which is exactly the format used in the task's gold facts.
- It currently fails in both directions: it blocks correct computed answers and allows unverified `NGN`/bare amounts. Fixing it improves both correctness and safety.
- It can be verified with the existing component-level harness, without a live model.

Caveat: before tuning retrieval or prompts, add the read-only observability described in §7. Retrieval changes made without measurement would be guesswork.

---

### 6. Riskiest changes

| Change | Why risky | Safer approach |
| --- | --- | --- |
| Changing the embedding model or vector dimensions | Invalidates every stored vector; requires full re-index; a failed re-index removes searchability | Stage a second index/table, compare retrieval offline, then swap |
| Re-indexing production knowledge in place | High write volume, quota consumption, partial-index risk | Use the existing non-destructive re-index per source, staged during low traffic, with rollback verified |
| Lowering/raising the 0.55 threshold | Unmeasured trade-off between empty answers and irrelevant evidence | Measure Recall@k / irrelevant rate on an isolated dataset first |
| Changing chunk size/overlap | Alters evidence boundaries and hash reuse; re-embeds everything | Compare chunk coverage and retrieval on a fixed corpus before rollout |
| Relaxing the price check to allow arithmetic | Could allow hallucinated totals | Allow only derived values whose operands are both present, and label them as calculated |
| Changing the system prompt broadly | Conflicting rules can reduce instruction-following; hard to attribute | Change one rule, run the 50-question benchmark, compare raw answers |
| Switching primary/provider model | Different grounding behavior, latency, and cost | A/B the same 50 questions with paired raw outputs |
| Adding new schema without a baseline migration | Worsens the existing drift | First capture the complete current schema as a versioned baseline |

---

### 7. Recommended next step (requires approval)

The smallest safe addition that unblocks real measurement:

1. **Admin-only retrieval inspector** — `requireAdmin()`, read-only, `(businessId, query)` → candidates, similarities, threshold counts, final chunks, formatted context, assembled prompt. No message writes, no schema change.
2. **Raw-answer capture** — return raw model text only to the inspector; never persist it to visitor-facing messages.
3. **Isolated seed + baseline migration** — later, for repeatable Test A/Test B runs.

Items 1 and 2 are small and directly resolve the Phase 2 requirement to demonstrate actual retrieved chunks and actual context safely. Item 3 is larger and should follow.

No diagnostic tool or fix was implemented in this audit.

---

### 8. Executive summary — the 10 questions

#### 1. Is the crawler correctly extracting complete, accurate website content?

**Not established for production.** Static review shows a defensive pipeline: public-URL validation, robots.txt, sitemap/index recursion, depth/page caps, deterministic extraction first, AI extraction only after validation, low-value page skipping, and page/URL markers for traceability (`lib/scraper/crawl-website.ts`, `lib/scraper/scrape-url.ts`). The synthetic corpus survived chunking without fact loss. However, no production crawl was run. Known coverage limits: 10 pages / depth 1 by default, JavaScript-only pages can fall under the 10-word skip threshold, and a partial crawl is possible.

#### 2. Are embeddings being generated and stored correctly?

**Not verified against a live database.** Code enforces 768 dimensions, rejects empty/non-finite vectors, reuses hashes, inserts replacements before deleting stale chunks, and rolls back partial inserts (`lib/ai/engine/embeddings.ts`, `lib/embeddings/generate-source.ts`). The vector RPC and table are defined. But the tables/RPC are absent from tracked migrations, and no live row was inspected, so actual production vector integrity is unconfirmed.

#### 3. Is retrieval selecting the right knowledge chunks?

**Not measured.** All Recall@k and MRR values are blocked. Deterministic checks show chunking preserved 35/35 required facts and query expansion worked for 5/5 follow-ups, but those are not retrieval results. Rerank boosts failed to fire for four representative payment/total/timeline questions.

#### 4. Is the retrieved context actually reaching the model?

**Yes by construction; not confirmed live.** Every final chunk is rendered by `formatContext` and inserted under `# KNOWLEDGE BASE CONTEXT` in the system prompt (`build-context.ts:6-26`, `business-system-prompt.ts:79-83`). There is no post-format truncation. The only omission point is the 2-or-5 chunk dynamic slice. No live prompt was captured.

#### 5. Is the model ignoring the retrieved knowledge?

**Unknown — not executed.** No raw model output is stored, so this cannot be attributed. The prompt contains ten explicit grounding rules, but model choice, the 1000-token output cap, and the fallback model are plausible contributors. Claiming either obedience or failure without raw output would be fabrication.

#### 6. What percentage of questions retrieve the correct knowledge?

**Not measured.** Reporting a percentage is blocked. The only executed coverage number is 35/35 fact survival after chunking, which is a pre-retrieval property and must not be presented as retrieval accuracy.

#### 7. What percentage of answers are correct and grounded?

**Not measured.** No answer was generated or graded. Component testing found one answer-corrupting post-processor defect, but that is not an answer-accuracy percentage.

#### 8. What are the top five root causes?

1. Format-asymmetric price verification that corrupts correct `₦` answers and lets `NGN`/bare amounts through.
2. Intent/rerank lexicon gaps for deposit, payment, total, and timeline questions.
3. Hardcoded 0.55 threshold and aggressive 2-chunk slice that can suppress evidence.
4. No raw-answer capture, preventing attribution between retrieval, model, and post-processing.
5. No reproducible RAG schema/environment, preventing safe measurement and regression testing.

#### 9. If you could only fix one thing first, what would it be and why?

**The price verification gate.** It is the only measured defect that turns a correct answer into a fallback, it fails in both directions, and it is a small, isolated change that can be verified without a live model. Build the read-only inspector alongside it so the fix is measured, not assumed.

#### 10. Which changes would be riskiest?

Changing the embedding model or dimensions, re-indexing production in place, changing the 0.55 threshold or chunk size without measurement, relaxing the price gate without operand checks, broadly rewriting the system prompt, and switching providers. Each can silently degrade retrieval or grounding and is expensive to reverse without an isolated benchmark.

---

### 9. Stop point

This is the end of the diagnostic. No fix, prompt change, threshold change, re-index, schema change, or diagnostic endpoint was implemented.

The next action requires explicit approval: add the admin-only read-only retrieval inspector and raw-answer capture, then use it to run Test A and Test B against an isolated synthetic tenant.

---

## Constraint compliance

| Rule | Compliance |
| --- | --- |
| Read-only diagnostic | Yes |
| No application code changes | Yes |
| No system prompt changes | Yes |
| No retrieval threshold changes | Yes |
| No embedding-model changes | Yes |
| No production re-index | Yes |
| No database schema changes | Yes |
| No production test businesses | Yes |
| No subscription or usage-limit changes | Yes |
| No new AI providers | Yes |
| No private customer information exposed | Yes |
| No claimed test without execution | Yes — blocked items are labelled |
| No invented retrieval results or scores | Yes |
| Unavailable configuration documented | Yes |

---

*End of consolidated audit. The next action requires approval: add an admin-only, read-only retrieval inspector plus raw-answer capture, then run Test A and Test B against an isolated synthetic tenant.*
