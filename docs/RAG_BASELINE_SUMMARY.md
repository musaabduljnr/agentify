# RAG Baseline Summary — Agentify

**Baseline:** `e772b37` — `fix(ai): ground answers in knowledge and harden indexing`
**Commit date:** 2026-11-05
**Audit date:** 2026-11-06
**Mode:** read-only
**Application code, prompts, thresholds, embedding model, schema, crawler, and production indexes were not changed.**

---

## 1. What this baseline is

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

## 2. What was actually executed

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

## 3. Baseline scorecard

### 3.1 Retrieval (Test A)

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

### 3.2 Answer quality (Test B)

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

### 3.3 Component checks that did produce values

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

## 4. Top five root causes

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

## 5. If only one thing could be fixed first

**Fix the price verification gate first.**

Why:

- It is the only **measured** defect that corrupts a correct answer.
- It is isolated to `lib/ai/evaluation/quality-checks.ts:102-120`; the blast radius is small.
- It affects the natural Nigerian currency format (`₦`), which is exactly the format used in the task's gold facts.
- It currently fails in both directions: it blocks correct computed answers and allows unverified `NGN`/bare amounts. Fixing it improves both correctness and safety.
- It can be verified with the existing component-level harness, without a live model.

Caveat: before tuning retrieval or prompts, add the read-only observability described in §7. Retrieval changes made without measurement would be guesswork.

---

## 6. Riskiest changes

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

## 7. Recommended next step (requires approval)

The smallest safe addition that unblocks real measurement:

1. **Admin-only retrieval inspector** — `requireAdmin()`, read-only, `(businessId, query)` → candidates, similarities, threshold counts, final chunks, formatted context, assembled prompt. No message writes, no schema change.
2. **Raw-answer capture** — return raw model text only to the inspector; never persist it to visitor-facing messages.
3. **Isolated seed + baseline migration** — later, for repeatable Test A/Test B runs.

Items 1 and 2 are small and directly resolve the Phase 2 requirement to demonstrate actual retrieved chunks and actual context safely. Item 3 is larger and should follow.

No diagnostic tool or fix was implemented in this audit.

---

## 8. Executive summary — the 10 questions

### 1. Is the crawler correctly extracting complete, accurate website content?

**Not established for production.** Static review shows a defensive pipeline: public-URL validation, robots.txt, sitemap/index recursion, depth/page caps, deterministic extraction first, AI extraction only after validation, low-value page skipping, and page/URL markers for traceability (`lib/scraper/crawl-website.ts`, `lib/scraper/scrape-url.ts`). The synthetic corpus survived chunking without fact loss. However, no production crawl was run. Known coverage limits: 10 pages / depth 1 by default, JavaScript-only pages can fall under the 10-word skip threshold, and a partial crawl is possible.

### 2. Are embeddings being generated and stored correctly?

**Not verified against a live database.** Code enforces 768 dimensions, rejects empty/non-finite vectors, reuses hashes, inserts replacements before deleting stale chunks, and rolls back partial inserts (`lib/ai/engine/embeddings.ts`, `lib/embeddings/generate-source.ts`). The vector RPC and table are defined. But the tables/RPC are absent from tracked migrations, and no live row was inspected, so actual production vector integrity is unconfirmed.

### 3. Is retrieval selecting the right knowledge chunks?

**Not measured.** All Recall@k and MRR values are blocked. Deterministic checks show chunking preserved 35/35 required facts and query expansion worked for 5/5 follow-ups, but those are not retrieval results. Rerank boosts failed to fire for four representative payment/total/timeline questions.

### 4. Is the retrieved context actually reaching the model?

**Yes by construction; not confirmed live.** Every final chunk is rendered by `formatContext` and inserted under `# KNOWLEDGE BASE CONTEXT` in the system prompt (`build-context.ts:6-26`, `business-system-prompt.ts:79-83`). There is no post-format truncation. The only omission point is the 2-or-5 chunk dynamic slice. No live prompt was captured.

### 5. Is the model ignoring the retrieved knowledge?

**Unknown — not executed.** No raw model output is stored, so this cannot be attributed. The prompt contains ten explicit grounding rules, but model choice, the 1000-token output cap, and the fallback model are plausible contributors. Claiming either obedience or failure without raw output would be fabrication.

### 6. What percentage of questions retrieve the correct knowledge?

**Not measured.** Reporting a percentage is blocked. The only executed coverage number is 35/35 fact survival after chunking, which is a pre-retrieval property and must not be presented as retrieval accuracy.

### 7. What percentage of answers are correct and grounded?

**Not measured.** No answer was generated or graded. Component testing found one answer-corrupting post-processor defect, but that is not an answer-accuracy percentage.

### 8. What are the top five root causes?

1. Format-asymmetric price verification that corrupts correct `₦` answers and lets `NGN`/bare amounts through.
2. Intent/rerank lexicon gaps for deposit, payment, total, and timeline questions.
3. Hardcoded 0.55 threshold and aggressive 2-chunk slice that can suppress evidence.
4. No raw-answer capture, preventing attribution between retrieval, model, and post-processing.
5. No reproducible RAG schema/environment, preventing safe measurement and regression testing.

### 9. If you could only fix one thing first, what would it be and why?

**The price verification gate.** It is the only measured defect that turns a correct answer into a fallback, it fails in both directions, and it is a small, isolated change that can be verified without a live model. Build the read-only inspector alongside it so the fix is measured, not assumed.

### 10. Which changes would be riskiest?

Changing the embedding model or dimensions, re-indexing production in place, changing the 0.55 threshold or chunk size without measurement, relaxing the price gate without operand checks, broadly rewriting the system prompt, and switching providers. Each can silently degrade retrieval or grounding and is expensive to reverse without an isolated benchmark.

---

## 9. Stop point

This is the end of the diagnostic. No fix, prompt change, threshold change, re-index, schema change, or diagnostic endpoint was implemented.

The next action requires explicit approval: add the admin-only read-only retrieval inspector and raw-answer capture, then use it to run Test A and Test B against an isolated synthetic tenant.
