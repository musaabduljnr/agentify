# RAG and AI Engine Test Results

Date: 2026-11-05
Platform: Windows 10 (win32), Node.js v24.22.1, Next.js 16, Vitest 4.1.9

This file records only commands that were actually executed and their real
results. No mock output is presented as evidence of a production fix.

## 1. Type check

Command:

```
npx tsc --noEmit
```

Result: exit code 0, no diagnostics.

## 2. Focused reliability suite

Command:

```
npx vitest run tests/ai-engine-reliability.test.ts
```

Result:

```
Test Files  1 passed (1)
Tests       27 passed (27)
```

## 3. Full test suite

Command:

```
npm test -- --run
```

Result:

```
Test Files  18 passed (18)
Tests       119 passed (119)
```

One existing assertion was updated: `tests/demo-preview.test.ts` previously
expected an empty string when retrieval returns no chunks. The retrieval
function now returns the explicit marker `No specific knowledge found for this
query.` so the prompt can distinguish "no retrieval" from an empty context. The
test now asserts `NO_KNOWLEDGE_CONTEXT`.

## 4. Lint

Command:

```
npm run lint
```

Result:

```
598 problems (0 errors, 598 warnings)
```

All problems are warnings (`@typescript-eslint/no-explicit-any`,
`no-unused-vars` in tests and legacy files). There are 0 errors.

## 5. Production build

Command (executed with placeholder environment values because `.env.local` is
not present in this workspace):

```
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
SUPABASE_SERVICE_ROLE_KEY=placeholder \
UPSTASH_REDIS_REST_URL=https://placeholder.upstash.io \
UPSTASH_REDIS_REST_TOKEN=placeholder \
npm run build
```

Result: build succeeded and emitted the full route table (static and dynamic
routes, middleware).

Important distinction: this verifies that the application compiles and bundles
with the new code. It does **not** verify live Supabase connectivity, live
Gemini/OpenRouter calls, or production crawl targets, because those require real
credentials and network access.

## 6. Test matrix A–L

All tests below are in `tests/ai-engine-reliability.test.ts` unless noted.

| ID | Area | Test(s) | Result |
| --- | --- | --- | --- |
| A | Follow-up query expansion | Referential follow-up inherits previous user turn; `continue` resumes previous question; standalone long questions unchanged. | Pass |
| B | Chunking integrity | Chunk size never exceeds the limit after overlap/hard split; page URL, page title, section heading, and SHA-256 hash are preserved. | Pass |
| C | Crawl URL identity | Tracking params, fragment, credentials, trailing slash, and parameter order are canonicalized. | Pass |
| D | AI extraction intake | Code fences/HTML stripped; refusals, scripts, empty scraps, and output losing >80% of deterministic content rejected; substantive output accepted. | Pass |
| E | Embedding dimensions | 3-value vector, empty vector, and NaN vectors rejected; 768 finite values accepted. | Pass |
| F | Re-index reuse | Reuse only when hash matches and vector is valid 768-dim; new chunks map to existing hashes without deleting first. | Pass |
| G | FAQ cache removal | Module no longer exports `checkResponseCache`; two identical questions call the model twice with `cachedAnswer: false`. | Pass |
| H | Grounding prompt | Prompt contains authoritative-context and no-invented-price rules; no-knowledge prompt instructs the exact fallback. | Pass |
| I | Response quality | Context price accepted; invented price rejected (`unverified_price`); invented email rejected (`hallucinated_email`); unsafe model output is replaced and `quality.passed` is false. | Pass |
| J | Context traceability | Formatted context contains the knowledge preamble, page URL, and section heading. | Pass |
| K | Timeout cancellation | A timed-out operation rejects with the timeout message and its `AbortSignal` is aborted. | Pass |
| L | Retrieval diagnostics | Candidate/above-threshold/final counts and top similarity are reported; RPC failure is recorded in `diagnostics.retrievalError` and returns the no-knowledge marker. | Pass |

Supporting coverage in the existing suite:

- `tests/demo-preview.test.ts` — zero-chunk behavior now asserts the explicit
  no-knowledge marker and still verifies that hallucinated prices/contacts are
  replaced by the safe fallback.
- `tests/playground.test.ts`, `tests/security.test.ts`, and others continue to
  pass unchanged (119 tests total).

## 7. Not executed

The following could not be executed honestly from this environment:

- **Live website crawl**: no target site or network access was provided, and
  crawling a real third-party site without authorization is not appropriate.
- **Live embedding generation**: requires a real `GEMINI_API_KEY` and a live
  Supabase project with the `vector(768)` schema.
- **Live chat generation**: requires provider credentials and a real assistant
  configuration.
- **Browser-level UI verification**: the dashboard knowledge page requires
  authentication and a populated Supabase project. The UI changes were verified
  by type checking and build compilation only; they were not exercised in a
  browser in this session.

These items require staging/production credentials and should be verified there
with the operational steps listed in `docs/AI_ENGINE_FIXES.md`.
