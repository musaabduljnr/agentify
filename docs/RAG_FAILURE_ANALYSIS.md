# RAG Failure Analysis

**Baseline:** `e772b37`
**Date:** 2026-11-06
**Method:** static code tracing + deterministic component execution + test-suite execution. No live retrieval or generation.

This document separates **measured** findings from **static** risks and **unmeasured hypotheses**. A finding is not called a root cause unless the evidence supports it.

---

## 1. Scenario A — Content exists but is not retrieved

### Mechanism

1. Query is expanded (`retrieve-context.ts:63-85`) and embedded (`retrieve-context.ts:118`).
2. Supabase returns the top 10 by cosine distance (`retrieve-context.ts:122-126`).
3. Any chunk below `0.55` is discarded (`retrieve-context.ts:138`).

Failure occurs if the query embedding is semantically distant from the relevant chunk, if the index is empty, or if the RPC fails. RPC failure is converted into an empty result, not an exception (`retrieve-context.ts:128-132,194-198`), so the chat continues with `No specific knowledge found for this query.`

### Evidence

- Threshold is hardcoded at `0.55`; it is not read from `ai_engine_settings`.
- `match_count` is `5 × 2 = 10`, so only 10 candidates are considered.
- There is no lexical/BM25 hybrid fallback.
- Embedding model must return exactly 768 dimensions or the call throws (`lib/ai/engine/embeddings.ts:22-44`).

### Questions most exposed

| Question type | Example | Why |
| --- | --- | --- |
| Vocabulary mismatch | S01 “marketing site” vs. “website design” | Embedding must bridge the paraphrase |
| Unboosted payment wording | E06 “deposit”, S05 “How do I pay you?” | Intent is `general`; no pricing boost |
| Unboosted total wording | P01 “order … total” | Intent is `sales`; no chunk contains sales keywords, so boost is zero |
| Unboosted timeline wording | S04 “project is live” | Intent is `general`; no boost |

### Status

**UNMEASURED.** No live embedding or vector query was possible. Severity if present: high (answer becomes fallback or unsupported). Confidence that the mechanism exists: high; confidence that it affects a specific production question: unknown.

---

## 2. Scenario B — Retrieved but filtered out

### Mechanism

After the RPC:

1. `similarity >= 0.55` filter (`retrieve-context.ts:138`).
2. Exact-content dedupe after whitespace/case normalization (`retrieve-context.ts:141-151`).
3. Intent boost and sort (`retrieve-context.ts:154-163`).
4. Dynamic slice: 2 chunks if top similarity ≥ 0.70 and the query is not compound; otherwise 5 (`retrieve-context.ts:167-172`).

A chunk can be in the top 10 and still never reach the prompt because it is below 0.55, is an exact duplicate, or ranks below the slice cutoff.

### Evidence and observations

- The 2-chunk slice is aggressive. It is only widened for queries containing `and|also|plus|as well as|both` or more than one `?` (`retrieve-context.ts:56,169`).
- Multi-part questions in the benchmark contain “and”, so they keep 5 chunks. A single-topic question with evidence split across two pages may still be cut to 2.
- Dedupe uses exact normalized content. Two pages that repeat the same paragraph collapse to one chunk; this is usually correct but can remove the page-level label used by the benchmark.
- Diagnostics expose `candidates`, `aboveThreshold`, `finalCount`, and `dynamicLimit`, so this scenario is fully observable once a live inspector exists.

### Status

**STATIC ONLY.** No live candidate list was available. Severity: medium. Confidence in the mechanism: high; frequency: unknown.

---

## 3. Scenario C — Retrieved but omitted from the model context

### Mechanism

After slicing, `formatContext` maps every final chunk into the context string (`build-context.ts:6-26`). There is no further truncation, summarization, or token-budget pruning before the prompt is assembled. Therefore the only way a retrieved chunk is omitted is the dynamic slice (Scenario B), not the formatter.

### Prompt size

- Maximum final chunks: 5.
- Maximum chunk length: 1200 characters.
- Worst-case context: ~6000 characters (~1500 estimated tokens), plus profile, rules, summary, and up to 8 history messages.
- Chat output limit is 1000 tokens (`ai-response.ts:75`), which limits answer length, not context inclusion.

### Status

**LOW RISK / STATIC.** Omission after retrieval is architecturally unlikely. The real omission risk is the slice, already covered in B.

---

## 4. Scenario D — Model ignores the knowledge

### Mechanism

The model receives the formatted context under `# KNOWLEDGE BASE CONTEXT` and 10 grounding rules (`business-system-prompt.ts:82-95`). It can still:

- answer from parametric knowledge,
- paraphrase a price incorrectly,
- omit half of a multi-part answer,
- follow a fallback model with weaker instruction adherence.

### Contributing factors visible in code

1. **Cheaper model routing:** benchmark questions that match a simple-FAQ pattern (price, hours, contact, booking) or are shorter than 35 characters route from `gemini-2.5-flash` to `gemini-2.5-flash-lite` (`lib/ai/engine/chat.ts:36-56`). Questions matching those patterns are therefore answered by the lite model, not the primary model.
2. **Fallback model:** on primary failure, the request goes to `openai/gpt-oss-20b:free` (`lib/ai/engine/config.ts:19-22`), a different model with different instruction-following behavior.
3. **Output cap:** 1000 output tokens (`ai-response.ts:75`) may truncate multi-part answers, especially M01, M04, and M05.
4. **Summary block:** a conversation summary is prepended as “secondary memory” (`ai-response.ts:53-62`). It is explicitly non-authoritative, but it still consumes attention and context.

### Status

**NOT EXECUTED.** This cannot be measured without raw model output. No claim is made about whether the model actually ignores knowledge in production.

### How to measure it

Capture raw model text before `runResponseQualityChecks`, then compare it to the formatted context and the gold answer. This is the single most important missing diagnostic capability.

---

## 5. Scenario E — Answer corrupted after generation (MEASURED)

### 5.1 Price verifier asymmetry

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

### Impact

- **False positive:** a correct computed answer is replaced when written with `₦`, which is the natural Nigerian currency format and the format used in the task's own facts.
- **False negative:** the same unverified number passes when written with `NGN` or bare, so the guard is not reliable as a safety control.
- **Benchmark impact:** P01, P02, and P05 will score differently based on answer formatting, not on model or retrieval quality.
- **Severity:** high. This is the only defect in this audit that is both measured and directly answer-corrupting.

### 5.2 Other post-processors

| Check | Behavior | Risk |
| --- | --- | --- |
| System-prompt leakage | Replaces text containing phrases like “system prompt” | Low; legitimate answers rarely contain these |
| Technical RAG leakage | Replaces text containing “chunk”, “embedding”, “vector search” | Low; could theoretically trigger on an unrelated use of “chunk” |
| Response length | Replaces text > 2500 characters | Low; multi-part answers might approach this |
| Email check | Replaces unverified emails | Working as intended (measured) |
| Phone check | Replaces unverified 7+ digit numbers | Needs live testing for false positives |
| Price check | See above | **Defective** |

---

## 6. Scenario F — Content was never crawled or indexed

### Crawl-side risks

| Risk | Evidence | Impact |
| --- | --- | --- |
| JavaScript-only pages produce little text | `crawl-website.ts:124-135` skips pages under 10 words after extraction | Real content never indexed |
| Defaults limit coverage | `maxPages = 10`, `depth = 1` (`crawl-website.ts:33-35`); source overrides exist | Deep pages never reached |
| Sitemap-only content | Sitemap URLs are queued at depth 1; sitemap index recurses up to 8 children (`lib/scraper/sitemap.ts`) | Better, but still capped |
| Partial crawl | `crawl_status: partial`, failed pages recorded | Some facts unavailable |
| Total crawl failure | Previous content preserved, status appropriate, notification created (`knowledge.ts:590-621`) | Old knowledge continues to be used |

### Index-side risks

| Risk | Evidence | Impact |
| --- | --- | --- |
| Source trained but not embedded | `processWebsiteSource` saves content and indexes; on indexing failure returns `embedded: false` + warning (`knowledge.ts:62-84,501-509`) | Stored but unsearchable |
| `autoEmbed` off | `crawlWebsiteSource` leaves `embedding_status: pending` (`knowledge.ts:661-667`) | Unsearchable until manual embed |
| Zero usable chunks | `embedding_status: failed` with explicit error (`generate-source.ts:180-198`) | Unsearchable |
| Embedding provider mismatch | 768-dimension enforcement rejects other models (`embeddings.ts:22-44`) | Index build fails loudly |
| Schema drift | RAG tables/RPC only in `legacy_sql`, which is documented as not for new setups (`supabase/README.md:6-8`) | Fresh environment cannot store or query vectors |

### Synthetic result

The isolated NovaTech corpus produced 6/6 page chunks and preserved every required fact (35/35 fact-bearing questions). This rules out chunking as a cause **for that corpus and size**, not for longer production pages.

### Status

**STATIC + SYNTHETIC.** Production crawl/index status is unmeasured. Severity: high when it occurs, because the assistant falls back for all questions on the missing topic. Confidence: mechanism confirmed; production frequency unknown.

---

## 7. Cross-business isolation

### Static controls

| Control | Evidence | Result |
| --- | --- | --- |
| Vector RPC tenant filter | `where knowledge_chunks.business_id = match_business_id` (`embeddings-schema.sql:79-82`) | No cross-tenant rows returned by the RPC |
| Conversation reuse | `.eq("id", conversationId).eq("business_id", businessId)` (`conversation-management.ts:67-74`) | Cannot attach an A-owned conversation to B |
| Dashboard sender | Business derived from authenticated owner (`lib/actions/chat.ts:154-167`) | Client cannot select another business |
| Demo sender | Business derived from `demo_businesses.placeholder_business_id` (`app/api/demo/chat/route.ts`) | Client IDs ignored |
| Knowledge search | Explicit `business.id !== businessId` rejection (`lib/actions/knowledge.ts:862-866`) | Owner cannot search another tenant |
| RLS | Owner policies on chunks, sources, messages, conversations | Defence in depth for non-service-role paths |

### Residual risks

1. **Widget conversation rebinding (S2):** reuse checks `business_id` but not `visitor_id` (`conversation-management.ts:66-75`). A leaked conversation UUID allows appending to another visitor's conversation. This does not cross businesses, but it can expose that conversation's prior content through the model.
2. **Service-role bypass:** the chat runtime does not use RLS; it relies on server-derived tenant keys. The widget's client-supplied `businessId` is a tenant selector, not an authorization token, but the RPC still constrains it to its own rows.
3. **Widget history diagnostics (S1):** metadata exposure, discussed in the diagnostic audit.

### Live isolation test (designed, blocked)

1. Business A = NovaTech Solutions, website design ₦250,000.
2. Business B = Northwind Digital, website design ₦400,000.
3. Ask all pricing questions as Business A; assert no answer contains ₦400,000.
4. Ask all pricing questions as Business B; assert no answer contains ₦250,000.
5. Attempt to reuse an A conversation ID while sending a B business ID; expect “Conversation not found.”
6. Attempt to read A history with a B visitor ID; expect 403.

**Status: BLOCKED.** No isolated database and no permission to create test businesses.

---

## 8. Confirmed findings, ranked

| Rank | Finding | Scenario | Evidence | Severity | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Price verifier corrupts correct computed `₦` answers and ignores `NGN`-prefixed or bare amounts | E | Executed component test | High | **Measured** |
| 2 | Retrieval diagnostics are returned to widget visitors in message metadata | Security | `message-persistence.ts:64`, `history/route.ts:86-98` | Medium-high | **Static, direct** |
| 3 | Rerank boosts do not fire for deposit/payment/total/timeline wording | A/B contributor | Executed intent + boost test | Medium | **Measured** |
| 4 | Widget conversation reuse is not bound to `visitorId` | Security | `conversation-management.ts:66-75` | Medium | **Static, direct** |
| 5 | RAG schema cannot be reproduced from tracked migrations | F / operations | `supabase/README.md:6-8`; legacy-only definitions | High operational | **Static, direct** |
| 6 | Raw model output is not captured, so model-vs-post-processor failures cannot be separated | D/E | `ai-response.ts:68-97`, persistence stores final only | High diagnostic | **Static, direct** |

---

## 9. Unmeasured hypotheses (do not treat as conclusions)

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

## 10. Top five root causes (evidence-weighted)

1. **Measured post-processing defect (price gate).** It destroys correct answers written with `₦` and lets unverified `NGN`/bare amounts through.
2. **Rerank/intent lexicon gaps.** Deposit, payment, total, and timeline questions receive no boost, leaving retrieval entirely dependent on embedding similarity and the 0.55 cutoff.
3. **Retrieval filter and slice opacity.** The 0.55 threshold and 2-chunk slice are hardcoded and can suppress correct evidence, but this is not observable without an inspector.
4. **No raw-answer capture.** It is impossible to distinguish “model ignored knowledge” from “retrieval missed” from “post-processor replaced a correct answer.”
5. **No reproducible RAG environment.** Legacy-only schema plus absent credentials means retrieval quality cannot be measured or regression-tested safely.

Security findings S1 and S2 are not accuracy root causes, but they are material and should be scheduled alongside the first fix.
