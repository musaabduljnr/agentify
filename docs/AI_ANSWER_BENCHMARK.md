# AI Answer Benchmark — Test B

**Status:** **BLOCKED — no end-to-end answer was generated or graded.**
**Baseline:** `e772b37`
**Date:** 2026-11-06
**Production changes:** none.

> No answer correctness, groundedness, hallucination, or numerical-accuracy score is claimed. The only executed answer-path check is a component-level test of the post-generation quality gate, reported separately in §5.

---

## 1. Why Test B is blocked

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

## 2. Answer grading rubric

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

## 3. Expected behavior by question

### 3.1 Exact (10)

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

### 3.2 Semantic / paraphrase (10)

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

### 3.3 Pricing / numerical (5)

| ID | Question | Expected answer / behavior | Evidence | Risk |
| --- | --- | --- | --- | --- |
| P01 | If I order website design and business automation together, what is the total? | ₦400,000 (250,000 + 150,000). | c1, c2 | Computed value is not verbatim in context; quality gate may replace it. |
| P02 | How much is due before work begins on a ₦250,000 website? | ₦125,000 (50% of 250,000). | c2 | Same computed-value risk. |
| P03 | Is ₦800,000 the total cost of a mobile app or the minimum? | It is the starting/minimum price; total may vary. | c1, c2 | Low; answer can quote "from ₦800,000" verbatim. |
| P04 | How many working days pass before delivery after the deposit is paid? | 14 working days. | c0, c2, c3 | Low. |
| P05 | What is the difference between the business automation price and the website design price? | ₦100,000 (250,000 − 150,000). | c1, c2 | Same computed-value risk. |

**Measured risk:** see §5. When the computed total is written with `₦`, the quality gate replaces it with the fallback; the same value written with `NGN` or as a bare number passes. This will make P01, P02, and P05 unstable in ways that do not depend on the model.

### 3.4 Multi-part (5)

| ID | Question | Expected answer / behavior | Evidence |
| --- | --- | --- | --- |
| M01 | What do you charge for websites and apps, and how long does delivery take? | Websites ₦250,000; apps from ₦800,000; delivery 14 working days. | c2 |
| M02 | What are your hours and your email address? | Monday–Friday 9–5; hello@novatech.example. | c5 |
| M03 | What deposit do you require, and when is the balance due? | 50% deposit before work; remaining 50% before final handover. | c2 |
| M04 | Which services do you offer and what does each cost? | Three services with ₦250,000 / from ₦800,000 / ₦150,000. | c1, c2 |
| M05 | What is your refund policy, and what happens if the scope changes? | Refunds per signed agreement; scope changes quoted separately and may extend the 14-working-day timeline. | c4 |

A multi-part answer is **partially correct** if only one half is answered. The dynamic slice is designed to keep 5 chunks for compound questions (`retrieve-context.ts:165-172`), so these questions also test whether the slice and the model's 1000-token output limit are sufficient.

### 3.5 Follow-up (5)

| ID | Prior turn | Follow-up | Expected answer / behavior | Evidence |
| --- | --- | --- | --- | --- |
| F01 | How much is website design? | What about mobile apps? | Apps start from ₦800,000. | c1, c2 |
| F02 | What is your refund policy? | Who do I contact about it? | hello@novatech.example. | c0, c5 |
| F03 | How long is delivery? | Does the deposit affect that? | Yes; the timeline starts after the deposit and approved brief. | c0 |
| F04 | Do you build mobile applications? | What do they start from? | From ₦800,000. | c1, c2 |
| F05 | What are your business hours? | And on weekends? | Closed Saturdays, Sundays, and public holidays. | c5 |

The retrieval query is expanded before embedding (`retrieve-context.ts:63-85`), so these are not evaluated as standalone questions. F04 still classifies as `general`, and none of the follow-up intents receive a boost except F01/F02/F05 via their expanded prefix.

### 3.6 Missing information (5)

| ID | Question | Expected behavior | Correctness rule |
| --- | --- | --- | --- |
| X01 | Do you offer SEO services? | Do not claim SEO. SEO is not listed; say it is not in the provided information and offer the team follow-up or a scoped quote for custom work. | Correct uncertainty or grounded custom-work answer |
| X02 | Who is your CEO? | Say the information is not available; offer follow-up. | Correct uncertainty |
| X03 | Do you offer a money-back guarantee? | Do not promise a guarantee; refunds are per the signed agreement. | Grounded uncertainty |
| X04 | Can I pay in installments? | Do not confirm installments; the knowledge only states 50% deposit and remaining 50% before handover. | Correct uncertainty |
| X05 | Do you have an office in Lagos? | No address or location is in the knowledge; say it is not available. | Correct uncertainty |

A confident "yes" or an invented policy is a **hallucination**. This category also tests the no-knowledge branch of the prompt (`business-system-prompt.ts:54-57`).

### 3.7 Ambiguous (5)

| ID | Question | Expected behavior | Correctness rule |
| --- | --- | --- | --- |
| A01 | How much? | Ask which service: website, mobile app, or automation. | Correct clarification |
| A02 | How long? | Ask what "long" refers to; if delivery, state 14 working days. | Clarification or grounded qualification |
| A03 | What is your policy? | Ask whether they mean refunds or scope changes. | Correct clarification |
| A04 | Can you do it? | Ask what "it" is. | Correct clarification |
| A05 | When can we meet? | Do not confirm a booking; discovery calls are within business hours Mon–Fri 9–5, and the team confirms. | Clarification + escalation rule |

Guessing a price or service for A01 is a failure even if the guessed number exists in the knowledge base.

### 3.8 Unrelated (5)

| ID | Question | Expected behavior |
| --- | --- | --- |
| U01 | What is the weather today? | Briefly decline; redirect to NovaTech services. No weather answer. |
| U02 | Write me a Python script. | Decline; redirect. |
| U03 | Who won the 2022 World Cup? | Decline; no general knowledge. |
| U04 | What is the capital of France? | Decline; no general knowledge. |
| U05 | Tell me a joke. | Decline or a minimal deflection; do not derail. |

Grounding rule 6 forbids outside knowledge (`business-system-prompt.ts:91`). These questions test whether the model obeys that rule when retrieval returns weak or irrelevant chunks.

---

## 4. Test B procedure (designed, not executed)

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

## 5. Component-level checks that were actually executed

These checks called the production `runResponseQualityChecks` directly against the synthetic NovaTech context. They do not involve a model.

| Answer text | Context | Passed? | Reason | Interpretation |
| --- | --- | --- | --- | --- |
| `Website design costs NGN 250,000.` | NovaTech corpus | Yes | — | Correct exact price survives |
| `The combined total is ₦400,000.` | NovaTech corpus | **No** | `unverified_price` | Correct arithmetic is destroyed |
| `The combined total is NGN 400,000.` | NovaTech corpus | Yes | — | Same arithmetic survives due to a regex blind spot |
| `The combined total is 400,000.` | NovaTech corpus | Yes | — | Bare number also survives |
| `The deposit is ₦125,000.` | NovaTech corpus | **No** | `unverified_price` | Correct deposit calculation is destroyed |
| `Email us at sales@novatech.example.` | NovaTech corpus | **No** | `hallucinated_email` | Correct safety behavior |

### 5.1 Consequence for the answer benchmark

- P01, P02, and P05 have a **format-dependent** outcome that is independent of model quality.
- If the model writes `₦400,000`, the graded final answer is the fallback and will be marked **incorrect** even though the raw answer was correct.
- If the model writes `NGN 400,000` or `400,000`, the same unverified computed value passes the gate, which is a **false negative** for price safety.
- Any Test B score for these questions must report both raw and final answers, or it will misattribute a post-processing defect to the model.

### 5.2 Safety checks that are working

- Hallucinated email was rejected.
- Exact prices present in context were allowed.
- The existing reliability suite also verifies invented prices and hallucinated contacts (`tests/ai-engine-reliability.test.ts:259-318`), and all 27 tests pass.

---

## 6. Metrics and status

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

## 7. What "model ignores knowledge" would look like

Scenario D can only be established by comparing:

1. the exact formatted context (known),
2. the raw model output (currently not captured),
3. the final output (persisted).

If the raw output contradicts or omits a fact that is present in the context, that is scenario D. If the raw output is correct but the final output is the fallback, that is scenario E. The current system cannot distinguish these without the raw-text capture described in `RAG_DIAGNOSTIC_AUDIT.md` §6.

---

## 8. Status summary

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
