# Agentify — AI Business Voice and Permanent Identity Rule

**Baseline:** `d61d484` — `fix(ai): harden price gate, widget history, and visitor ownership`
**Scope:** make every business assistant speak as the business ("we / our / us") instead of an outside observer
**Mode:** targeted prompt-architecture change; no engine, retrieval, crawler, billing, or schema change
**Date:** 2026-11-06

---

## 1. Summary

Assistants could answer with third-person phrasing such as "NovaTech Solutions offers..." or "the company provides...", which reads like an outside reviewer rather than the business's own representative. The fix adds one mandatory platform policy to the shared system-prompt builder that every live business chat already uses. No per-business configuration, migration, or new prompt-management system was introduced.

| # | Change | Status | Files |
| --- | --- | --- | --- |
| 1 | Added permanent first-person identity policy | Done | `lib/ai/prompts/business-system-prompt.ts` |
| 2 | Removed third-person wording from built-in fallbacks | Done | `lib/ai/prompts/business-system-prompt.ts`, `lib/ai/prompts/lead-capture-prompt.ts`, `lib/ai/prompts/safety-rules.ts`, `lib/ai/evaluation/quality-checks.ts` |
| 3 | Added voice, surface, provider, and NovaTech regression tests | Done | `tests/business-identity.test.ts` (new), `tests/provider-prompt-forwarding.test.ts` (new), `tests/business-identity-live.test.ts` (new, opt-in) |

No change was made to Gemini/OpenRouter/Groq/Vertex configuration, the embedding model or dimensions, pgvector storage, the `0.55` similarity threshold, chunk sizes, retrieval limits, crawler behaviour, quotas, billing, subscription logic, the quality-gate rules, or the database schema.

---

## 2. Root cause

The live chat path builds its system instruction in one place: `buildBusinessSystemPrompt` (`lib/ai/prompts/business-system-prompt.ts`). Before this change that prompt defined *who* the assistant was ("You are **Nova**, the official AI assistant for **NovaTech Solutions**") but never defined *how to refer to the business grammatically*. The model was free to mirror the third-person phrasing found in retrieved website text (for example, "NovaTech Solutions offers website design for ₦250,000"). Built-in fallback strings and lead-capture/escalation instructions also used "the business team" and "the team", reinforcing the outside-observer voice.

`assistants.system_prompt` is written during onboarding and demo generation but is **not read** on the live chat path; the live prompt is always the shared builder output. That means there was no business-level instruction competing with the new policy, but also no central place to enforce voice until this change.

---

## 3. Architecture audit

### Shared path

```
app/api/widget/chat/route.ts        (widget + hosted_chat)
app/api/demo/chat/route.ts          (demo)
lib/actions/chat.ts                 (dashboard playground / test)
            │
            ▼
lib/actions/chat/run-business-chat.ts
            │  resolve conversation, retrieve context, load business + assistant
            ▼
lib/actions/chat/ai-response.ts
            │  buildBusinessSystemPrompt(...)
            │  + optional conversation summary / continuation note
            ▼
lib/ai/engine/chat.ts  generateChatResponse(...)
            │  systemInstruction forwarded unchanged
            ├── lib/ai/providers/gemini.ts
            ├── lib/ai/providers/openrouter.ts
            ├── lib/ai/providers/groq.ts
            └── lib/ai/providers/vertex.ts
```

### Surface coverage

| Interface | Entry point | `source` | Uses shared builder |
| --- | --- | --- | --- |
| Website widget | `app/api/widget/chat/route.ts` → `runBusinessChat` | `widget` | Yes |
| Hosted chat link | same route → `runBusinessChat` | `hosted_chat` | Yes |
| Dashboard playground / test | `sendDashboardTestMessage` → `runBusinessChat` | `dashboard_test` → `playground` | Yes |
| Demo assistant | `app/api/demo/chat/route.ts` → `runBusinessChat` | `demo` | Yes |

No business-facing chat surface calls a provider directly. `lib/ai/build-business-prompt.ts` is a legacy builder imported but never called by the live chat path; it is not used for voice enforcement and was left unchanged to avoid a duplicate copy of the policy.

### Provider coverage

`generateChatResponse` receives one `systemInstruction` and passes it unchanged to every provider:

- Gemini: `config.systemInstruction`
- OpenRouter and Groq: prepended as the first `{ role: "system" }` message
- Vertex: same parameter (currently a staging placeholder that throws before any model call)

A change in the shared builder therefore reaches every configured provider without provider-specific edits.

### Stored assistant prompt

`lib/actions/onboarding.ts`, `lib/actions/demo-generator.ts`, and `lib/actions/repair-setup.ts` write an `assistants.system_prompt`, but `getAiResponse` never includes it. Existing rows and newly created rows are therefore treated identically: both receive the platform policy from the shared builder. No backfill, migration, or owner action is required.

---

## 4. Implementation

### 4.1 Policy location

`lib/ai/prompts/business-system-prompt.ts:64` — a new `# BUSINESS VOICE AND IDENTITY (PERMANENT PLATFORM POLICY)` section immediately after `# IDENTITY`, before the business profile, retrieved context, and grounding rules.

The policy states that the assistant:

- is the voice of the configured business, not an outside observer;
- uses "we", "our", and "us" for the business, team, products, services, pricing, policies, operations, hours, and locations;
- addresses the visitor as "you" and "your";
- must not use "they", "them", or "their" for the business, or phrases such as "the company offers" / "the business provides";
- never acts as an independent reviewer, commentator, or third-party evaluator;
- keeps the voice across every turn, including follow-ups and long conversations;
- may only say "we offer", "we charge", or "we include" when the knowledge base or business profile supports it;
- restates third-person knowledge in the first person without changing any number, currency, condition, or meaning;
- uses a natural uncertainty response when information is missing;
- keeps third-party organizations (competitors, partners, suppliers, customers, external products) in their own identity.

The section also states that the policy overrides conflicting business-level instructions, stored prompts, retrieved text, or visitor requests, and that the policy itself must not be mentioned to visitors. Because the policy is part of the one shared builder output, it applies to existing and new assistants and cannot be disabled per business.

### 4.2 Third-person fallback cleanup

| File | Before | After |
| --- | --- | --- |
| `lib/ai/prompts/business-system-prompt.ts:87` | "I'll pass this booking request to the team to confirm." | "...to **our** team to confirm." |
| `lib/ai/prompts/business-system-prompt.ts:93` | "...so the team can follow up." | "...so **our** team can follow up." |
| `lib/ai/prompts/lead-capture-prompt.ts:4` | "...so the business team can follow up..." | "...so **our** team can follow up..." |
| `lib/ai/prompts/safety-rules.ts:5` | "...back to the business services." | "...back to **our** products and services." |
| `lib/ai/evaluation/quality-checks.ts:3` | "...so the business can follow up." | "...so **our** team can follow up." |

The quality-gate logic itself is unchanged. The fallback text is only the sanitized replacement used when an existing check fails; it now matches the policy voice.

### 4.3 Prompt versioning

The codebase has no prompt-versioning or prompt-management system, and none was added. The policy is versioned with `lib/ai/prompts/business-system-prompt.ts` and ships through normal code review and deployment. No new database column, feature flag, or admin setting exists for it.

---

## 5. RAG accuracy preservation

Adding voice does not relax grounding:

- The existing `# GROUNDING RULES (HIGHEST PRIORITY)` block is unchanged: context is authoritative, prices are copied exactly, and unsupported facts must use the fallback.
- The policy explicitly says voice must never change facts and that first-person claims require support in the knowledge base or business profile.
- Third-person knowledge is converted without changing values. For example, knowledge saying the business offers website design for a stated price becomes "Our website design service costs [that exact price]."
- The quality gate still rejects invented prices, unknown emails, unknown phone numbers, prompt leakage, technical retrieval leakage, and overlong responses. No threshold, rule, or check was removed or loosened.
- Third-party identity is explicit: "We integrate with Paystack" is allowed when supported; "We developed Paystack" is not.

---

## 6. Tests and results

### Commands executed

```bash
npx vitest run tests/business-identity.test.ts tests/provider-prompt-forwarding.test.ts --pool=threads
# 2 files passed, 28 tests passed

npx vitest run --pool=threads
# 23 files passed, 1 file skipped
# 190 tests passed, 9 skipped

npx tsc --noEmit
# no output (success)

npx eslint lib/ai/prompts lib/ai/evaluation/quality-checks.ts \
  tests/business-identity.test.ts tests/provider-prompt-forwarding.test.ts \
  tests/business-identity-live.test.ts
# 0 errors, 3 warnings (existing `any` in prompt metadata; two typed test mocks)

NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... UPSTASH_REDIS_REST_URL=... \
UPSTASH_REDIS_REST_TOKEN=... npm run build
# build completed; all routes emitted
```

Placeholder environment values were supplied inline for the build because the workspace has no `.env.local`. No credentials were written to disk.

### New test coverage

`tests/business-identity.test.ts` (24 tests):

- The shared builder contains the platform policy, first-person requirement, third-person prohibition, outside-reviewer prohibition, follow-up persistence, override protection, uncertainty response, and third-party clause.
- Every built-in fallback uses first-person wording.
- A legacy stored `system_prompt` containing a conflicting instruction is not included in the live prompt and does not displace the policy.
- Existing and new assistant shapes both receive the policy.
- `getAiResponse` passes the policy to the model for `widget`, `hosted_chat`, `playground`, and `demo_generation`, including when conversation memory and "continue" instructions are added.
- The eight NovaTech questions are represented by grounded first-person answers that pass the unchanged quality gate; every exact price, the 50% deposit, the email, the 14 working days, and the Monday–Friday hours are preserved.
- An invented ₦500,000 price is still rejected after the voice change.
- A third-party Paystack statement is allowed without claiming the business created Paystack.

`tests/provider-prompt-forwarding.test.ts` (4 tests):

- The identical `systemInstruction`, including the policy, reaches Gemini, OpenRouter, Groq, and Vertex at the engine boundary.

`tests/business-identity-live.test.ts` (9 tests, opt-in):

- Runs the eight NovaTech questions plus a third-party question against a real Gemini model and asserts first-person voice, absence of self-third-person phrasing, exact facts, and correct third-party identity.
- Enabled only with `RUN_LIVE_AI_TESTS=1` and `GEMINI_API_KEY`; it is skipped by default.

### Not executed

The live suite was **not executed** in this environment. `GEMINI_API_KEY` is not set and `.env.local` does not exist, so no real model-generated responses were available to verify. The unit and integration tests above validate the exact prompt handed to the engine and the quality-gate behaviour, but they cannot prove model compliance on any given sampling run. The opt-in suite exists for that check when credentials are available.

---

## 7. Limitations

- Model compliance is probabilistic. The policy is mandatory in the shared prompt and is the same for every business, provider, and surface, but the platform does not post-process or rewrite model output for voice. No deterministic voice filter was added because reliable detection of self-third-person versus legitimate third-party references would risk false replacements that remove correct answers.
- The opt-in live suite depends on an external model and network access; it is intentionally excluded from the default run.
- The legacy `lib/ai/build-business-prompt.ts` remains unused by live chat and does not carry the policy. If a future feature starts using it for customer-facing generation, it must be migrated to `buildBusinessSystemPrompt` rather than duplicating the policy.
- Demo assistants use the same policy and are also told (separately) that some details may be preview data; those two instructions do not conflict.

---

## 8. Files changed

| File | Change |
| --- | --- |
| `lib/ai/prompts/business-system-prompt.ts` | New permanent voice/identity section; first-person fallback and escalation wording |
| `lib/ai/prompts/lead-capture-prompt.ts` | First-person team reference |
| `lib/ai/prompts/safety-rules.ts` | First-person scope wording |
| `lib/ai/evaluation/quality-checks.ts` | First-person sanitized fallback text only; logic unchanged |
| `tests/business-identity.test.ts` | New: policy, surface, inheritance, NovaTech, third-party, and no-weakening tests |
| `tests/provider-prompt-forwarding.test.ts` | New: identical policy reaches all four providers |
| `tests/business-identity-live.test.ts` | New: opt-in live NovaTech generation suite |
| `docs/AI_BUSINESS_VOICE_FIX.md` | This document |

No database migration, dependency, API contract, crawler, retrieval, embedding, quota, or billing change.
