# RAG Retrieval Benchmark — Test A

**Status:** **BLOCKED — no retrieval metric was executed.**
**Baseline:** `e772b37`
**Date:** 2026-11-06
**Production changes:** none.

> Do not read the deterministic checks in this document as Recall@k, MRR, or retrieval accuracy. They are pre-retrieval checks on chunking, query expansion, intent classification, and reranking boosts. Actual vector retrieval could not be run.

---

## 1. Why Test A is blocked

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

## 2. Synthetic isolated dataset — NovaTech Solutions

NovaTech Solutions is a fictional business created only for this benchmark. `novatech.example` is a reserved example domain. It is unrelated to any real company with a similar name.

### 2.1 Source corpus (exactly what was chunked)

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

### 2.2 Actual chunking result

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

## 3. 50-question benchmark

### 3.1 Label rules

- **Gold chunks** are the chunks that contain every required fact for the question.
- A question is a **retrieval hit** if at least one gold chunk appears in the top-k results.
- `missing`, `ambiguous`, and `unrelated` questions have **no gold evidence**. For these, retrieving nothing is acceptable and often desirable. They are excluded from Recall@k/MRR denominators and reported separately as empty-rate and irrelevant-rate.
- Questions P01, P02, and P05 require arithmetic. Their operands must be retrievable; the computed result is not stored verbatim in the knowledge base.

### 3.2 Questions

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

## 4. Metrics and formulas

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

## 5. Test A procedure (designed, not executed)

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

## 6. Pre-retrieval checks that were actually executed

### 6.1 Fact coverage after chunking — 35/35

For every one of the 35 fact-bearing questions, every required fact string survived chunking and appears in at least one chunk.

| Result | Value |
| --- | --- |
| Labeled questions | 35 |
| Questions with all required facts present in ≥1 chunk | 35 |
| Fact coverage | **35/35 (100%)** |
| Missing-fact questions | 0 |

This is **not** Recall@k. It only proves that chunking did not destroy the evidence before embedding.

### 6.2 Intent classification after production query expansion

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

### 6.3 Follow-up expansion — 5/5 expanded

| ID | Raw question | Expanded query | Intent |
| --- | --- | --- | --- |
| F01 | What about mobile apps? | How much is website design? / Follow-up: What about mobile apps? | pricing |
| F02 | Who do I contact about it? | What is your refund policy? / Follow-up: Who do I contact about it? | refund |
| F03 | Does the deposit affect that? | How long is delivery? / Follow-up: Does the deposit affect that? | shipping |
| F04 | What do they start from? | Do you build mobile applications? / Follow-up: What do they start from? | general |
| F05 | And on weekends? | What are your business hours? / Follow-up: And on weekends? | business_hours |

Production expansion works for the short/referential follow-ups. F04 still classifies as `general`, so it receives no pricing boost even though the expected answer is a price.

### 6.4 Rerank boost gaps (executed against the 6 synthetic chunks)

| Query | Intent | Chunks receiving a boost |
| --- | --- | --- |
| What deposit do you require? | general | none |
| How do I pay you? | general | none |
| If I order website design and business automation together, what is the total? | sales | none |
| How long until my project is live? | general | none |

These questions are expected to be answered from `c2` / `c1`, but the keyword boosts do not fire. Retrieval for them depends entirely on embedding similarity and the 0.55 threshold.

Relevant code: `lib/ai/intent/classify-query.ts:18-67`; `lib/ai/rag/chunk-scoring.ts:15-150`.

---

## 7. Status summary

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
