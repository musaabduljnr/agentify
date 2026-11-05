# Agentify AI Engine Audit

Date: 2026-11-05
Scope: website crawling, knowledge extraction, chunking, embeddings, retrieval, grounding, conversation memory, AI provider reliability.

This audit was performed by reading the current implementation end-to-end before changing any code. It records what exists, what fails, and why, so the fixes can be verified against a written baseline.

## 1. Request flow (current)

```
Widget / hosted chat / playground
  -> runBusinessChat                      lib/actions/chat/run-business-chat.ts
     -> resolveOrCreateConversation       lib/actions/chat/conversation-management.ts
     -> saveUserMessage                   lib/actions/chat/message-persistence.ts
     -> reserveUsageQuota                 lib/billing/usage.ts
     -> retrieveBusinessContext           lib/ai/rag/retrieve-context.ts
        -> generateEmbedding              lib/ai/engine/embeddings.ts
        -> RPC match_knowledge_chunks     supabase/legacy_sql/embeddings-schema.sql
        -> intent boost + dynamic slice   lib/ai/rag/chunk-scoring.ts
     -> processLeadHandling               lib/actions/chat/lead-handling.ts
     -> summarizeConversationIfNeeded     lib/ai/memory/conversation-summary.ts
     -> getRecentConversationMessages     lib/ai/memory/message-history.ts
     -> getAiResponse                     lib/actions/chat/ai-response.ts
        -> checkResponseCache             (unsafe FAQ cache)
        -> buildBusinessSystemPrompt      lib/ai/prompts/business-system-prompt.ts
        -> generateChatResponse           lib/ai/engine/chat.ts
        -> runResponseQualityChecks       lib/ai/evaluation/quality-checks.ts
     -> saveAssistantMessage              lib/actions/chat/message-persistence.ts
     -> completeUsageQuota
```

Knowledge ingestion has two separate paths:

```
processWebsiteSource  -> scrapeUrl   (lib/scraper/scrape-url.ts)  -> never embeds
crawlWebsiteSource    -> crawlWebsite(lib/scraper/crawl-website.ts) -> embeds only if autoEmbed
generateEmbeddingsForSource -> generateEmbeddingsForSourceInternal
                                  (lib/embeddings/generate-source.ts)
```

## 2. Findings

### P0 - Correctness / data integrity

#### F1. Website sources are marked `trained` without any embeddings
- Evidence: `lib/actions/knowledge.ts:363-463` (`processWebsiteSource`) writes `status: "trained"` and deletes all `knowledge_chunks`, but never calls the embedding pipeline. `lib/actions/knowledge.ts:465-600` (`crawlWebsiteSource`) sets `status: "trained"` at line 524 and only embeds when `options.autoEmbed` is true at line 574.
- Impact: a customer can "train" a website, see it as trained, and the assistant retrieves nothing. This is the most likely cause of "the assistant ignores my knowledge base".
- Root cause: extraction and indexing are treated as one status, but implemented as two different pipelines.

#### F2. Re-indexing is destructive before success
- Evidence: `lib/embeddings/generate-source.ts:37` deletes every chunk *before* embedding and inserting the replacements. `lib/actions/knowledge.ts:440-444` and `567-571` also delete chunks immediately after extraction, before new embeddings exist.
- Impact: a provider outage, quota error, timeout, or one failed insert leaves the business with zero knowledge. There is no rollback.
- Root cause: no atomic swap / staging of the new index.

#### F3. Silent embedding dimension corruption
- Evidence: `lib/ai/engine/embeddings.ts:22-35` pads short vectors with zeros and truncates long vectors to 768.
- Impact: wrong-dimension vectors are written to `knowledge_chunks` and produce meaningless similarity scores instead of a loud, actionable error. A truncated/padded vector can permanently poison retrieval until re-indexed.
- Root cause: defensive coercion hides provider/model misconfiguration.

#### F4. Cross-conversation FAQ cache returns stale answers
- Evidence: `lib/actions/chat/ai-response.ts:6-44` scans the last 50 user messages for the entire business, finds an exact normalized match, then returns the next assistant message from that unrelated conversation. It is called first at line 75, so it bypasses retrieval, context, conversation history, and grounding checks.
- Impact: different visitors receive another visitor's answer; old prices/policies persist after a re-crawl; the answer is not grounded in the current knowledge base.
- Root cause: a cache keyed only by normalized query, without business KB version, conversation, or answer provenance.

#### F5. Current user message is sent twice to the model
- Evidence: `lib/actions/chat/run-business-chat.ts:111-115` saves the user message; line 189 fetches the last 4 messages, which now includes that message; `getAiResponse` also passes `message` separately at `ai-response.ts:109`.
- Impact: duplicated user turn in the provider request. This can distort instruction-following and waste tokens, especially with small local/free models.
- Root cause: history is loaded after persistence, with no exclusion of the in-flight message.

#### F6. Grounding prompt is too weak for reliable answers
- Evidence: `lib/ai/prompts/business-system-prompt.ts:73-78` has four rules ("Answer ONLY using context"). It does not define what to do when context is empty, how to handle conflicting sources, that prices/contact details must be copied exactly, or that the conversation summary is not authoritative.
- Impact: models fill gaps, invent prices, merge sources, or answer from the summary. The quality check only catches a subset of this.
- Root cause: prompt assumes strong model behavior instead of constraining it.

### P1 - Retrieval quality

#### F7. Follow-up queries retrieve the wrong context
- Evidence: `lib/actions/chat/run-business-chat.ts:152-166` only rewrites the query when the entire message is `"continue"`. Questions such as "how much is it?", "and for two people?", "where is that?" are embedded verbatim with no prior context.
- Impact: poor similarity match, empty context, hallucination or generic answer.
- Root cause: no deterministic query expansion using recent user turns.

#### F8. Retrieval errors are indistinguishable from "no knowledge"
- Evidence: `lib/ai/rag/retrieve-context.ts:53-56` and `104-107` swallow both RPC failures and exceptions and return empty chunks. `formatContext` then returns "No specific knowledge found for this query." (`lib/ai/rag/build-context.ts:4-6`).
- Impact: an embedding quota error or schema/RPC problem looks like "the website has no information", so nobody investigates. The model is still called and may answer from memory.
- Root cause: error state is not propagated or surfaced.

#### F9. Retrieved context omits the source URL
- Evidence: `lib/ai/rag/build-context.ts:9-17` includes title/type/heading but not `source_url`; chunk metadata does not store a page URL (`lib/embeddings/generate-source.ts:50-53`).
- Impact: the model cannot cite or distinguish pages; contact/booking answers cannot point to the right page. Diagnostics cannot tell which page produced a bad answer.
- Root cause: metadata contract was never extended past `source_type`/`source_title`.

#### F10. Dynamic slicing can drop relevant context
- Evidence: `lib/ai/rag/retrieve-context.ts:87-94` returns only 2 chunks whenever the top similarity is >= 0.70, even if the query is multi-part (e.g. "what are your prices and opening hours?").
- Impact: one half of a compound question loses its evidence.
- Root cause: optimization keyed only on top score, not on query shape.

#### F11. Intent classifier keyword collisions
- Evidence: `lib/ai/intent/classify-query.ts`: "package" appears in pricing and shipping; "order" in sales but "track order" in shipping; "broken" in complaint and support. First matching rule wins, so "shipping package" can be classified as pricing.
- Impact: reranking boosts the wrong chunks.
- Root cause: ordered regex list without priority or multi-intent support.

#### F12. Chunk quality
- Evidence: `lib/embeddings/chunker.ts:13-44` splits only on blank lines/sentences, ignores headings, and has an overlap bug: after `chunks.push(currentChunk)` the code reads `currentChunk.slice(-overlap)` (works by accident) and the new chunk can exceed `maxChunkSize` because the suffix is prepended to a full paragraph.
- Impact: chunks can mix unrelated sections; heading context is lost; oversized chunks are diluted embeddings.
- Root cause: text-only chunker with no structural awareness.

#### F13. Duplicate/irrelevant crawl URLs
- Evidence: `lib/scraper/scrape-url.ts:87-111` strips hash/credentials/trailing slash but keeps all query parameters, so `?utm_source=...`, `?fbclid=...`, and pagination parameters create duplicate entries. `normalizeCrawlUrl` also accepts paths outside the start path.
- Impact: `maxPages` is consumed by duplicates/tracking URLs, reducing real coverage.
- Root cause: no query canonicalization and no crawl-budget priority guarantee.

### P1 - Crawler / extraction

#### F14. Structured data is discarded before AI extraction
- Evidence: `lib/scraper/scrape-url.ts:470-473` extracts JSON-LD and Next.js flight text from scripts, then immediately removes all `script` elements and passes the clean HTML to Gemini. The structured text is only appended in the deterministic fallback branch (line 588).
- Impact: `Product`, `Offer`, `FAQPage`, `LocalBusiness`, and Next.js server data - often the most accurate price/contact source - are invisible to the AI extractor.
- Root cause: ordering bug between structured-data extraction and script removal.

#### F15. LLM extraction output is not validated
- Evidence: `lib/scraper/scrape-url.ts:508-518` accepts any Gemini output longer than 50 characters and sets `isAiExtracted = true`. There is no refusal detection, HTML/code-fence stripping, word-count sanity check, or comparison with deterministic extraction.
- Impact: a refusal ("I cannot access..."), a summary, or truncated HTML becomes the knowledge source.
- Root cause: no validation layer between AI output and persistence.

#### F16. Boilerplate selectors are incomplete
- Evidence: `lib/scraper/scrape-url.ts:23-33` removes scripts/styles/cookie UI but not navigation, menus, breadcrumbs, or sidebar links. Footer contact data is intentionally not removed (correct), but nav/menu noise is included.
- Impact: token waste and diluted embeddings; navigation text can match queries weakly.
- Root cause: selector list was never completed.

#### F17. `processWebsiteSource` reports completed even with failed pages
- Evidence: `lib/actions/knowledge.ts:409-414` hardcodes `crawl_status: "completed"` and `pages_failed: result.failedPageCount`; failed pages are recorded but not reflected in status.
- Impact: partial extraction looks fully successful.
- Root cause: status logic exists only in the other crawl path.

#### F18. Sitemap indexes are not followed
- Evidence: `lib/scraper/sitemap.ts:43-84` reads `sitemap.xml` and `sitemap_index.xml` as flat URL lists and stops at the first non-empty file. A `<sitemapindex>` yields child `sitemap.xml` URLs, which are then treated as page URLs.
- Impact: large WordPress/Shopify sites contribute no real pages; crawl discovery is ineffective.
- Root cause: no distinction between `<urlset>` and `<sitemapindex>`.

#### F19. Two divergent crawlers
- Evidence: `crawlWebsite` (max 10, depth 1, concurrency 5) and `scrapeUrl` (max 15, depth 2, concurrency 3) duplicate queue/robots/link logic and return different shapes.
- Impact: fixes applied to one path do not help the other; status/metrics differ between "Process" and "Crawl".
- Root cause: parallel implementations. This audit keeps both to avoid breaking callers, but aligns their behavior and shared helpers.

### P2 - Reliability / observability

#### F20. Provider timeout does not cancel the request
- Evidence: `lib/ai/engine/fallback.ts:22-37` creates an `AbortController` but never passes `signal`; it races the operation against a separate `setTimeout` rejection. The underlying `fetch`/SDK call keeps running after timeout.
- Impact: timed-out requests continue consuming quota; serverless invocations linger; retries multiply load.
- Root cause: timeout wrapper is not connected to the transport.

#### F21. `maxOutputTokens` is hardcoded in the Gemini chat provider
- Evidence: `lib/ai/providers/gemini.ts:83` uses `maxOutputTokens: 800`, while `ChatParams.maxOutputTokens` exists (`lib/ai/engine/types.ts:18`) and is ignored by `callProvider`.
- Impact: long grounded answers can be cut off, causing "Continue" loops; short answers cannot be tuned.
- Root cause: parameter not threaded through.

#### F22. `quality_passed` is not the quality result
- Evidence: `lib/actions/chat/message-persistence.ts:51` stores `quality_passed: !cachedAnswer`. In the normal path this is always `true`, even when `runResponseQualityChecks` replaced the answer with the fallback.
- Impact: the dashboard/logs cannot distinguish sanitized answers from valid ones; debugging grounding failures is impossible.
- Root cause: persistence does not receive the check result.

#### F23. Quality checks miss numeric claims
- Evidence: `lib/ai/evaluation/quality-checks.ts` validates emails/phones and leakage, but not prices, fees, time windows, or policy statements.
- Impact: hallucinated prices/policies pass through.
- Root cause: no deterministic numeric grounding check.

#### F24. Conversation summary is treated as authoritative
- Evidence: `lib/actions/chat/ai-response.ts:97-99` prepends the summary to the system prompt with no hierarchy instruction.
- Impact: stale or inferred facts from the summary can override the current knowledge base.
- Root cause: no priority statement.

#### F25. No retrieval diagnostics
- Evidence: `retrieveBusinessContext` returns only successful chunks; failures, scores, threshold decisions, and reused embeddings are not stored. `saveAssistantMessage` stores chunks but not retrieval stats.
- Impact: "why did the bot say that?" cannot be answered without re-running the request.
- Root cause: observability was not part of the RAG contract.

## 3. Things that are already sound

- URL safety blocks private/local targets, resolves DNS, and limits redirects (`lib/scraper/url-safety.ts`).
- Robots.txt is parsed for `*` and `AgentifyBot` (`lib/scraper/robots.ts`).
- HNSW cosine index and RPC already filter by `business_id` (`supabase/legacy_sql/embeddings-schema.sql`).
- Embeddings request 768 dimensions and both schema/RPC are `vector(768)`.
- Chunks are deduplicated and short fragments filtered (`lib/embeddings/chunker.ts:48-52`).
- Quota reserve/complete/release is used around embeddings and chat.
- Prompt-leakage and technical-terminology checks exist and are useful.
- Per-request provider and model are logged (`lib/ai/logs/ai-logs.ts`).
- `AiInteractionLog` write has a fallback for older schemas.

## 4. Remediation order used

1. **Stop active corruption**: remove the cross-conversation cache; remove the duplicated user turn; make dimension mismatches fail loudly.
2. **Make ingestion honest and non-destructive**: embed before declaring success; stage new chunks and remove old ones only after inserts; record `embedding_status`, hashes, URLs, headings, and reuse.
3. **Improve extraction**: preserve structured data for AI extraction, validate AI output, remove navigation boilerplate, canonicalize URLs, follow sitemap indexes, report partial crawls accurately.
4. **Improve retrieval and grounding**: query expansion for follow-ups, source URLs in context, explicit no-knowledge behavior, ten grounding rules, summary de-prioritization, conservative numeric validation.
5. **Add diagnostics and tests**, then run the real build/test/lint commands and record the outputs in `docs/RAG_TEST_RESULTS.md`.

## 5. Compatibility constraints honored

- No AI provider, embedding model, database engine, or RPC signature is replaced.
- No table or column is dropped. New values live in existing JSONB metadata (`knowledge_sources.metadata`, `knowledge_chunks.metadata`, `messages.metadata`).
- Existing server-action signatures are preserved. New optional parameters only.
- `status` values remain `draft|pending|processing|trained|failed`; embedding progress is tracked in metadata so existing UI and gating keep working.
- Both crawler entry points remain exported.
