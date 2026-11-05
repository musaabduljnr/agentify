# AI Engine Fixes

This document maps each finding in `docs/AI_ENGINE_AUDIT.md` to the change that
addresses it, with code references. It also records compatibility and
operational notes.

## Summary of changed behavior

- Answers are always retrieved from the current business knowledge base; the
  unsafe cross-conversation FAQ cache is gone.
- Knowledge sources are only considered searchable when their embeddings exist;
  failures are reported and retryable instead of silently claimed as trained.
- Re-indexing is non-destructive: new chunks are stored and verified before the
  old index is removed, and unchanged chunks reuse their existing vectors.
- Prompts treat retrieved excerpts as the only factual authority, with explicit
  rules against invented prices, contact details, hours, and policies.
- Every assistant message records retrieval diagnostics and the real quality
  check result in `messages.metadata` (internal only, not exposed to visitors).
- Crawls distinguish completed, partial, and failed outcomes and preserve
  previous content on failed re-crawls.

## Finding-to-fix matrix

| ID | Finding | Fix | Evidence |
| --- | --- | --- | --- |
| F1 | Sources marked `trained` with zero embeddings | FAQ, manual, document, and updated content now auto-index after save. Failures return a warning, set `metadata.embedding_status`, and expose a retry path. | `lib/actions/knowledge.ts:62`, `:204`, `:243`, `:372`, `:696` |
| F2 | Re-index deleted existing chunks before inserting replacements | Replacement chunks are inserted first; stale rows are deleted only after every insert succeeds. Partial inserts are rolled back on error and the old index remains. | `lib/embeddings/generate-source.ts:131`, `:267`, `:281`, `:311` |
| F3 | Embedding dimension mismatches were padded/truncated silently | Dimension validation now throws on empty, non-768, or non-finite vectors. Batch responses must match the requested count. | `lib/ai/engine/embeddings.ts:22`, `:161` |
| F4 | FAQ cache returned answers from unrelated conversations and bypassed retrieval | Removed `checkResponseCache` entirely. Every turn retrieves and calls the model. | `lib/actions/chat/ai-response.ts:1-13` |
| F5 | Current user message was duplicated in model history | History is loaded after persistence and the trailing current user turn is stripped before retrieval and generation. | `lib/actions/chat/run-business-chat.ts:23`, `:164` |
| F6 | Grounding prompt was too weak | Added authoritative business profile, explicit knowledge-availability branch, and 10 highest-priority grounding rules (context authority, no invented prices, no outside knowledge, conflict handling, prompt-injection safety). | `lib/ai/prompts/business-system-prompt.ts:79-95` |
| F7 | Follow-up questions lost their subject | `buildRetrievalQuery()` merges the previous user turn for short/referential follow-ups and "continue". | `lib/ai/rag/retrieve-context.ts:63` |
| F8 | Retrieval errors were swallowed | RPC and unexpected errors are logged and recorded in `diagnostics.retrievalError`, then persisted with the assistant message. | `lib/ai/rag/retrieve-context.ts:29`, `:128`, `:194` |
| F9 | Source URLs were missing from retrieved context | Chunk metadata carries `source_url`, `page_url`, `page_title`, and `section_heading`; context formatting prints page and section. | `lib/embeddings/generate-source.ts:248`, `lib/ai/rag/build-context.ts:6` |
| F10 | Dynamic slicing dropped evidence for compound questions | Compound queries (multiple question marks or conjunctions) keep the 5-chunk window. | `lib/ai/rag/retrieve-context.ts:169` |
| F11 | Intent keyword collisions chose the wrong intent | Intent scoring counts keyword occurrences and picks the strongest match, with rule order as tie-break. | `lib/ai/intent/classify-query.ts:69`, `:80` |
| F12 | Chunker overlap exceeded limits and headings were lost | Overlap is applied only when it fits; overlong sentences are hard-split; chunks carry content hashes and page/section metadata. | `lib/embeddings/chunker.ts:49`, `:68`, `:167` |
| F13 | Tracking parameters created duplicate crawl URLs | Canonicalization strips tracking params, fragments, credentials, and trailing slashes, then sorts parameters. | `lib/scraper/url-safety.ts:42` |
| F14 | Structured data was discarded before AI extraction | JSON-LD and Next.js flight data are appended to deterministic text and to accepted AI output. | `lib/scraper/scrape-url.ts:615`, `:657`, `:541` |
| F15 | AI extraction was accepted without validation | AI output is sanitized and rejected for refusals, scripts, empty output, or >80% content loss versus deterministic extraction. | `lib/scraper/scrape-url.ts:553`, `:580`, `:651` |
| F16 | Boilerplate removal was incomplete | Navigation, menu, sidebar, and breadcrumb selectors are removed before extraction (footers retained for contact facts). | `lib/scraper/scrape-url.ts:25` |
| F17 | Every crawl was reported as `completed` | Crawl status is `completed`, `partial`, or `failed` based on scraped/failed pages. Failed re-crawls preserve previous content and status. | `lib/actions/knowledge.ts:582`, `:590`, `:676` |
| F18 | Sitemap indexes were not followed | `<sitemapindex>` is detected and up to 8 child sitemaps are parsed recursively. | `lib/scraper/sitemap.ts:72` |
| F19 | Two divergent crawlers had different behavior | Both entry points share canonicalization, robots rules, extraction helpers, page marker format, and the same indexing pipeline. | `lib/scraper/scrape-url.ts:691`, `lib/scraper/crawl-website.ts:163` |
| F20 | Timeouts did not cancel the provider request | `AbortController` signals are passed through every chat/embedding provider; the timer aborts and clears in `finally`. | `lib/ai/engine/fallback.ts:11`, `lib/ai/engine/chat.ts:58`, `lib/ai/providers/gemini.ts:44` |
| F21 | Chat output was hardcoded at 800 tokens | `maxOutputTokens` is configurable; chat uses 1000, crawl AI extraction uses 3000, embedding content uses 2048. | `lib/ai/engine/chat.ts:24`, `lib/actions/chat/ai-response.ts:75` |
| F22 | `quality_passed` was always true for live answers | The real `QualityCheckResult.passed` and `reason` are persisted. | `lib/actions/chat/message-persistence.ts:57` |
| F23 | No numeric or price verification | Currency amounts in a reply must match an amount present in retrieved context; invented prices trigger the safe fallback. Contact-detail checks remain. | `lib/ai/evaluation/quality-checks.ts:102` |
| F24 | Conversation summary outranked verified knowledge | The summary is injected as `SECONDARY CONVERSATION MEMORY` with an explicit non-authoritative warning, and a grounding rule forbids using it to fill gaps. | `lib/actions/chat/ai-response.ts:55`, `lib/ai/prompts/business-system-prompt.ts:91` |
| F25 | No retrieval diagnostics | Retrieval records query expansion, intent, candidate/above-threshold/final counts, top similarity, dynamic limit, and errors; message persistence stores them. | `lib/ai/rag/retrieve-context.ts:29`, `lib/actions/chat/message-persistence.ts:64` |

## Additional reliability changes

- **Batch embedding fallback**: a failed batch is retried chunk-by-chunk so one
  bad chunk does not fail a whole source.
- **Billing correctness**: only newly generated embeddings are reserved and
  billed; reused vectors are exempt. A zero-new-chunk run skips reservation.
- **Honest UI**: knowledge forms and buttons display warnings when content was
  saved but indexing failed, instead of claiming full success.
- **Batch count guard**: embedding batch responses must contain exactly one
  vector per requested text.
- **Traceable context**: retrieved chunks include page URLs and section
  headings, which flow into the prompt context.
- **Model routing preserved**: existing provider/model selection, simple-FAQ
  routing to `gemini-2.5-flash-lite`, retries, and OpenRouter fallback remain.

## Backward compatibility

- No database migration is required. All new state is stored in existing JSONB
  `metadata` columns (`knowledge_sources.metadata`, `knowledge_chunks.metadata`,
  `messages.metadata`) and existing crawl columns.
- No tables, columns, RPCs, environment variables, or providers were removed or
  replaced.
- Existing server-action signatures are unchanged; return types were widened
  with optional fields (`warning`, `embedded`, chunk counts, page counts).
- `retrieveBusinessContext()` keeps its return shape and adds `diagnostics`.
  `conversationHistory` is optional.
- The only removed export is the internal `checkResponseCache`, which was not
  used outside `ai-response.ts`.
- Existing sources remain usable. Their current chunks continue to serve
  retrieval until they are re-indexed.

## Operational steps after deploy

1. Re-index important existing sources with **Embed Content** (or re-crawl the
   site). This populates new page/section metadata and reuses unchanged vectors
   when content hashes match.
2. Check `knowledge_sources.metadata.embedding_status` for `failed` sources and
   use **Embed Content** to retry.
3. No SQL cleanup is needed for the removed FAQ cache; historical messages and
   conversations are untouched.
4. Internal diagnostics are available in `messages.metadata.retrieval`,
   `quality_passed`, `quality_reason`, and `fallback_used`; they are not exposed
   to visitors.

## Known limitations

- Price verification is conservative: a currency amount must appear in the
  retrieved context. This can reject a correct computed total; the assistant
  then uses the safe fallback instead of risking a hallucinated price.
- Re-indexing is not destructive, but it is not a single database transaction:
  a process crash between insert and stale-delete can leave duplicate chunks
  until the next successful index run.
- Retrieval diagnostics are stored per assistant message; there is no separate
  analytics dashboard for them yet.
- Live provider behavior (Gemini/OpenRouter rate limits, real crawl targets)
  cannot be fully verified from the local test environment.
