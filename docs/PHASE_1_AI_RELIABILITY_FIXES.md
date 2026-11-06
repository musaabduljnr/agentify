# Agentify — Phase 1 AI Reliability and Security Fixes

**Baseline:** `e772b37` — `fix(ai): ground answers in knowledge and harden indexing`
**Scope:** the three confirmed low-risk defects from the RAG diagnostic audit
**Mode:** targeted implementation; no AI engine rewrite
**Date:** 2026-11-06

---

## 1. Summary

| # | Issue | Status | Files changed |
| --- | --- | --- | --- |
| 1 | Price verification rejected valid ₦ amounts and accepted format-laundered or bare amounts | Fixed | `lib/ai/evaluation/quality-checks.ts` |
| 2 | Widget history returned retrieval diagnostics and other internal metadata to visitors | Fixed | `app/api/widget/chat/history/route.ts`, `lib/actions/chat/message-dto.ts` (new) |
| 3 | Conversation reuse checked business but not the original visitor | Fixed | `lib/actions/chat/conversation-management.ts`, `app/api/widget/chat/route.ts` |

No changes were made to Gemini/OpenRouter configuration, embedding model or dimensions, vector storage, similarity threshold, chunking, retrieval limits, the system prompt, crawler behaviour, quotas, usage accounting, or database schema.

No migration is required. No dependency was added. No API request contract was broken.

---

## 2. Issue 1 — Price verification quality gate

### Confirmed defect

The audit measured the gate failing in both directions:

- Valid computed amounts in ₦ were replaced by the fallback message.
- `NGN 400,000` and bare `400,000` passed even when unsupported.

### Root cause

`runResponseQualityChecks` used one regular expression that only recognised a symbol prefix (`₦400,000`) or a currency word suffix (`400,000 NGN`). It did not recognise `NGN 400,000`, `N400,000`, or `250,000 naira` when matched as a code-prefix form, and it compared amounts as plain strings without understanding calculated values. Bare numbers were ignored entirely.

### Implementation

File: `lib/ai/evaluation/quality-checks.ts`

- **Currency parsing** (`extractMoneyAmounts`, line 208) recognises:
  - symbol prefix: `₦250,000`, `$1,234`, `€500`, `£500`
  - naira `N` prefix: `N250,000`, `N 250,000`
  - code prefix: `NGN 250,000`, `NGN250,000`, `USD 1,234`
  - code/word suffix: `250,000 NGN`, `250,000 naira`
  - decimals: `₦12,500.50`, `NGN 12,500.50`
- **Normalisation** maps every symbol/word to `NGN`, `USD`, `EUR`, or `GBP` and parses comma-separated values to numbers.
- **Exact validation** accepts an amount only when the same numeric value appears in the retrieved context with the same currency, or with no explicit currency.
- **Derived validation** (`isDerivedMoney`, line 330) accepts values that are:
  - a supported percentage/fraction of a supported amount, or
  - the sum of two or three distinct supported amounts, or
  - a supported percentage of such a sum.
  Evidence amounts are de-duplicated so the same price cannot be counted twice. Sums with conflicting explicit currencies are rejected.
- **Currency laundering is rejected**: `₦1,234` is not accepted when the knowledge context only contains `$1,234`.
- **Bare amounts** are validated when they look like prices (thousands separators, or large unseparated values) and appear near price wording. Bare values are accepted when the number exists in the context or is derivable from supported operands. Years (1900–2100) and quantity units (`users`, `businesses`, `days`, etc.) are excluded.
- All previous checks are unchanged and still run first: empty response, prompt leakage, retrieval-internal leakage, length, hallucinated email, and hallucinated phone.

No price check was weakened to make a test pass: every previously rejected invented amount remains rejected.

### Tests added

File: `tests/quality-checks.test.ts` — 23 tests covering:

- exact ₦ price
- exact `NGN` price
- `N` prefix
- currency code before amount
- currency code after amount
- `naira` word
- decimal formatting
- multiple prices in one response
- correct calculated total
- correct calculated deposit
- deposit calculated from a supported total
- incorrect calculated total
- invented product price
- unverified bare numerical amount
- bare amount supported by context
- quantities and dates not treated as prices
- cross-currency laundering rejected
- one unsupported price rejects a multi-price response
- existing email, phone, prompt, retrieval-leakage, empty, and length checks

Result: **23/23 passed**.

---

## 3. Issue 2 — Widget message metadata exposure

### Confirmed defect

`GET /api/widget/chat/history` selected whole `metadata` values and returned them to the visitor who owns the conversation. Stored metadata includes retrieval diagnostics (`query`, `expandedQuery`, `intent`, `candidates`, `aboveThreshold`, `topSimilarity`, `dynamicLimit`), provider/model, latency, quality flags, and cached-answer state.

### Root cause

The route returned database rows without a response DTO. Authorization was enforced, but the authorized visitor still received operator-level diagnostics.

### Implementation

New file: `lib/actions/chat/message-dto.ts`

- `toPublicMessageDTO` allowlists `id`, `role`, `content`, `created_at`, and only `metadata.is_manual` when true.
- `toOwnerMessageDTO` allows `id`, `role`, `content`, `created_at`, and an explicit metadata allowlist: `is_manual`, `intent`, `quality_passed`, `quality_reason`, `fallback_used`, `provider`, `model`, `latency_ms`, `cached_answer`, `retrieval`.
- Both DTOs drop rows with unknown or invalid roles, so internal `system` messages never reach public visitors.
- `retrieved_chunks` and arbitrary metadata keys (for example a stored prompt) are never serialized.

`app/api/widget/chat/history/route.ts`

- Tracks `accessLevel` explicitly as `visitor` or `owner` (line 47).
- Visitor access uses `toPublicMessageDTO`; owner/admin access uses `toOwnerMessageDTO` (line 97).
- Response shape is unchanged: `{ messages, isManualTakeover }`.
- No changes to the POST widget endpoint, which already returned only `conversationId`, `reply`, and `limitReached`.
- Dashboard retrieval inspection is unchanged: `getDashboardConversation` and the playground still return the authorized owner's full rows/chunks through RLS-protected server actions.

### Tests added

File: `tests/widget-history-security.test.ts` — 7 tests:

- visitor receives normal history
- visitor does not receive retrieval diagnostics, prompts, provider data, or chunk contents
- visitor does not receive system messages
- a different visitor is rejected
- an authenticated owner still receives authorized diagnostics
- unlisted metadata is stripped even for owners
- an authenticated non-owner is rejected

Result: **7/7 passed**, together with the 5 pre-existing history tests.

---

## 4. Issue 3 — Conversation reuse not bound to visitors

### Confirmed defect

`resolveOrCreateConversation` verified `id` and `business_id` when reusing a conversation. It did not compare `visitor_id`, so a leaked conversation UUID allowed another visitor to append messages to that conversation.

### Root cause

The reuse query scoped the conversation to the business only. Ownership by visitor was assumed, not checked.

### Caller audit

| Caller | Source | Visitor ID | Impact |
| --- | --- | --- | --- |
| `POST /api/widget/chat` | `widget` / `hosted_chat` | client-generated, optional | Enforced |
| `POST /api/demo/chat` | any | required | Preserved (demo) |
| `sendDashboardTestMessage` | `dashboard_test` | none | Preserved (owner) |

No caller contract changed.

### Implementation

File: `lib/actions/chat/conversation-management.ts`

For non-demo `widget` and `hosted_chat` conversations:

- A bound conversation is reusable only when the supplied visitor ID matches the stored `visitor_id`.
- A missing visitor ID on a bound conversation is rejected.
- A conversation stored under another business is rejected by the existing business filter.
- A legacy conversation with `visitor_id = null` is bound to the first visitor that continues it using a conditional update (`WHERE visitor_id IS NULL`). If that update affects no row because another request won the race, the route re-reads the conversation and rejects the request unless the winner is the same visitor.
- Binding failures are surfaced, not swallowed.
- Ownership rejections use a typed `ConversationAccessError`, which `POST /api/widget/chat` maps to a controlled `403` with `{ error: "Conversation not found." }` instead of the generic 500 error path.

Demo conversations and dashboard-owner `dashboard_test` conversations keep their previous behaviour.

No database migration or schema change is required: `conversations.visitor_id` already exists.

### Tests added

File: `tests/conversation-ownership.test.ts` — 12 tests:

1. Visitor A creates a conversation bound to A.
2. Visitor A continues the same conversation.
3. Visitor B is rejected when reusing A's conversation.
4. A continuation without a visitor ID is rejected once bound.
5. A conversation from another business is rejected.
6. A legacy unbound conversation is bound on first continuation.
7. An anonymous continuation of a legacy unbound conversation is rejected.
8. A concurrent claim loses safely to the winning visitor.
9. Binding errors are surfaced.
10. Dashboard-owner management still works.
11. Demo continuation still works.
12. Demo creation still works.

Result: **12/12 passed**.

---

## 5. Verification results

All commands were executed on this working tree. No result is reported that was not observed.

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | Passed; no diagnostics |
| ESLint | `npm run lint` | 0 errors; repository-wide warnings only, predominantly pre-existing `no-explicit-any` in tests. Changed production files lint with 0 errors. |
| New price tests | `npx vitest run --pool=threads tests/quality-checks.test.ts` | 23/23 passed |
| History security tests | `npx vitest run --pool=threads tests/widget-history-security.test.ts` | 7/7 passed |
| Ownership tests | `npx vitest run --pool=threads tests/conversation-ownership.test.ts` | 12/12 passed |
| Widget route tests | `npx vitest run --pool=threads tests/widget.test.ts` | 4/4 passed, including the new 403 case |
| Full suite | `npx vitest run --pool=threads` | 21 files, 162/162 passed |
| Production build | `npm run build` with inline placeholder env values | Exit 0; full route manifest emitted |

### Build environment note

This workspace has no `.env.local`; the repository contains only `.env.example`. `npm run build` therefore fails the startup env guard before compilation. The build was executed with placeholder values supplied inline on the command line (not written to disk) to validate compilation and route generation. The build completed and emitted the full route manifest. No production credentials were used.

The default Vitest forks pool still times out under Node 26.5.0 (`Timeout waiting for worker to respond`), as recorded in the baseline audit. `--pool=threads` was used, matching the baseline methodology.

---

## 6. API contract impact

- `POST /api/widget/chat`: success contract unchanged. Reusing a conversation that belongs to another visitor now returns `403` with `{ error: "Conversation not found." }` through the typed access error; previously this scenario was not detected.
- `GET /api/widget/chat/history`: same envelope; message objects are now explicit DTOs. Visitors lose diagnostic metadata they should never have received. Owners retain an allowlisted diagnostic view.
- `POST /api/demo/chat`: unchanged.
- Server actions `getDashboardConversation`, `getBusinessConversations`, `sendDashboardTestMessage`, `sendManualMessage`: unchanged.

No existing feature was removed.

---

## 7. Remaining limitations

1. **Derived price scope:** only sums of two or three distinct supported amounts and percentage/fraction derivations are accepted. Differences, balances, tax-inclusive calculations, currency conversion, and arbitrary arithmetic are not supported and will be treated as unverified.
2. **Rounding:** comparisons use a ±0.005 tolerance. Answers that round a derived amount to a different naira value are rejected.
3. **Bare-amount heuristic:** bare numbers are only evaluated near price wording, exclude years and common quantity units, and require evidence or derivation. Unusual phrasing may still need tuning; only explicitly formatted monetary amounts are fully deterministic.
4. **Visitor identity:** the widget visitor ID is a client-generated bearer value stored in the browser. Binding prevents accidental cross-visitor reuse of a conversation UUID; it is not a cryptographic authentication mechanism.
5. **Legacy conversations:** an unbound legacy conversation is claimed by the first visitor that continues it. There is no way to recover an original visitor for rows that never stored one.
6. **Demo conversations:** deliberately unbound across visitor IDs to preserve the preview experience, per the task constraints.
7. **No live production verification:** tests use mocked Supabase clients. No production database or model was called in this phase; live RAG retrieval and answer benchmarks remain blocked as documented in the diagnostic audit.
8. **Owner diagnostics through the history endpoint** are limited to message metadata; chunk contents remain served by the RLS-protected dashboard actions. No chunk payload was added to the public endpoint.

---

## 8. What was intentionally not changed

Per the task constraints, this phase did not touch:

- Gemini or OpenRouter configuration
- embedding model or dimensions
- vector database or similarity threshold
- chunk size or overlap
- dynamic retrieval limits
- the system prompt
- crawler behaviour
- subscription quotas or usage accounting
- database schemas or production indexes
- unrelated UI or features

Retrieval optimization and crawler restructuring remain out of scope for Phase 1.
