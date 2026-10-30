# Agentify — Complete Project Audit Report

**Date:** October 30, 2026  
**Auditor:** Principal Software Architect / Security & Systems Auditor  
**Scope:** Full codebase — 220+ source files, Supabase schema & migrations, AI engine & multi-provider routing, billing pipelines, real-time widget embeds, viral onboarding funnel, authentication & RLS policies, test suites, and landing page architecture.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Architecture & System Design](#2-architecture--system-design)
3. [Key Modules & Feature Capabilities](#3-key-modules--feature-capabilities)
4. [Audit Findings & Remediation Progress](#4-audit-findings--remediation-progress)
   - [Critical Severity (Audit History & Verified Fixes)](#critical-severity)
   - [Security Findings (S-1 to S-17)](#security-findings)
   - [Database & Data Integrity Findings (D-1 to D-13)](#database--data-integrity-findings)
   - [Performance & Scalability Findings (P-1 to P-10)](#performance--scalability-findings)
   - [UI/UX & Accessibility Review (U-1 to U-7)](#uiux--accessibility-review)
   - [Technical Debt (TD-1 to TD-10)](#technical-debt)
5. [Testing & Quality Assurance](#5-testing--quality-assurance)
6. [Scalability Assessment & Concurrency Modeling](#6-scalability-assessment--concurrency-modeling)
7. [Production Deployment & Launch Readiness](#7-production-deployment--launch-readiness)
8. [Consolidated Scorecard & Recommendation](#8-consolidated-scorecard--recommendation)

---

## 1. Executive Summary

**Agentify** is an enterprise-grade B2B SaaS platform that enables businesses to launch, train, and deploy autonomous AI-driven customer support and sales agents in seconds. By ingesting public website content, PDF documents, or structured business FAQs, Agentify generates custom RAG (Retrieval-Augmented Generation) knowledge bases with multi-provider AI routing, automatic failovers, conversational lead capture, and instant embed widgets.

The application is built on:
- **Framework:** Next.js 16 (App Router with Turbopack, React 19)
- **Backend / Database:** Supabase (PostgreSQL 15+, pgvector embeddings, Row-Level Security, Database RPCs, Storage)
- **AI Core:** Multi-provider orchestrator with automated failover (`Google Gemini 2.0 / Flash`, `OpenRouter`, `Groq`, `Vertex AI`)
- **Billing Infrastructure:** Paystack recurring subscriptions, dynamic plan limits, and automated webhooks
- **Email Infrastructure:** Resend + React Email for transactional confirmations and sales notifications
- **Styling & UI:** Tailwind CSS 4, Radix UI primitives, Lucide React iconography, custom dark-first developer aesthetic

### Audit Verdict
The project has evolved through major stability and security remediation cycles. Historical high-severity vulnerabilities (such as world-readable `profiles` RLS, unauthenticated chat history IDOR, and non-atomic counter increments) have been resolved via versioned migrations (`20260622000000_audit_fixes.sql`) and API route refactoring. The addition of the **Instant AI Agent Generator** viral acquisition funnel and the dark-mode landing page has elevated the application to **pre-production / release-candidate readiness**.

---

## 2. Architecture & System Design

```
                          ┌──────────────────────────────────────────────┐
                          │         External Visitors & Clients          │
                          └──────┬───────────────────────────────┬───────┘
                                 │                               │
                      Widget Script / Embed             Web Browser / App UI
                                 │                               │
                                 ▼                               ▼
     ┌───────────────────────────────────────────────────────────────────────────┐
     │                     Next.js 16 Application Layer                          │
     │  ┌───────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐ │
     │  │  App Router (Pages)   │  │  Server Actions      │  │ API Endpoints   │ │
     │  │  - /                  │  │  - instant-generator │  │ - /api/widget/* │ │
     │  │  - /dashboard/*       │  │  - chat actions      │  │ - /api/webhooks │ │
     │  │  - /admin/*           │  │  - billing actions   │  │ - /api/demo/*   │ │
     │  └───────────────────────┘  └──────────────────────┘  └─────────────────┘ │
     │            │                           │                        │         │
     │     Upstash / In-Memory Rate Limiting & Edge CSRF / CORS Guards         │
     └────────────┼───────────────────────────┼────────────────────────┼─────────┘
                  │                           │                        │
                  ▼                           ▼                        ▼
     ┌────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────┐
     │   AI Inference Core    │  │  Supabase Postgres DB   │  │ Payment & Email   │
     │  - Gemini / OpenRouter │  │  - pgvector embeddings  │  │  - Paystack API   │
     │  - Groq / Vertex AI    │  │  - Atomic Security RPCs │  │  - Resend Email   │
     │  - Fallback Circuit    │  │  - RLS Tenant Isolation │  │  - Webhook HMAC   │
     └────────────────────────┘  └─────────────────────────┘  └───────────────────┘
```

### Architectural Highlights
1. **Multi-Provider AI Resilience:** The inference engine in `lib/ai/engine/fallback.ts` tracks consecutive failures and switches across primary and fallback models with zero downtime.
2. **Deterministic Scraper & Safe Crawling:** The website scraper in `lib/scraper/` enforces DNS resolution validation, non-routable private IP rejection (SSRF prevention), text cleaning, and chunking into vector embeddings.
3. **Encrypted Admin Platform Settings:** Core API secrets (AI keys, webhook secrets) stored in Postgres utilize AES-256-GCM encryption with master key derivation.
4. **Idempotent Webhook Processing:** Paystack webhook events check a database-level unique constraint (`event_id`) to prevent duplicate balance additions or subscription duplications.

---

## 3. Key Modules & Feature Capabilities

| Module | Core Files | Responsibility |
|---|---|---|
| **Viral Funnel** | `lib/actions/instant-generator.ts`, `components/landing/InstantAgentForm.tsx`, `components/landing/Hero.tsx` | Allows anonymous visitors to submit a domain, scans page structure, builds draft vector embeddings, and delivers an interactive demo preview in ~10 seconds. |
| **Chat Engine** | `lib/actions/chat.ts`, `lib/ai/engine/`, `app/api/widget/chat/` | Handles visitor sessions, FAQ vector matching, intent detection (lead vs support), response caching, and manual human takeover. |
| **Embed Widget** | `app/api/widget/config/`, `app/api/widget/chat/history/`, `public/widget.js` | Zero-dependency standalone widget embed script with custom theme colors, position configuration, and visitor tracking. |
| **Billing & Quotas** | `lib/billing/`, `app/api/webhooks/paystack/` | Dynamic plan management (`free_trial`, `starter`, `growth`, `enterprise`), message quota tracking, and automatic plan enforcement. |
| **Admin Operations** | `app/admin/`, `lib/admin/`, `lib/config/platform-config.ts` | Executive platform telemetry, real-time AI error logs, user impersonation, dynamic provider hot-swapping, and maintenance toggles. |

---

## 4. Audit Findings & Remediation Progress

### Critical Severity

#### CRITICAL-1: Usage Counter Reset Bug & Missing RPC
* **Status:** **RESOLVED**
* **Finding:** Previous code relied on an uncreated RPC and fell back to non-atomic updates that reset counters instead of incrementing.
* **Resolution:** Implemented `public.increment_subscription_usage(p_business_id UUID, p_amount INTEGER)` in `supabase/migrations/20260622000000_audit_fixes.sql`. `lib/billing/usage.ts` calls this atomic function directly.

#### CRITICAL-2: PII Exposure via World-Readable `profiles`
* **Status:** **RESOLVED**
* **Finding:** Legacy `profiles` table had a permissive `SELECT using (true)` policy.
* **Resolution:** Enforced strict RLS: profiles are only viewable by their owner (`auth.uid() = id`) or verified administrators (`role = 'admin'`).

#### CRITICAL-3: Demo Prospect PII Harvesting
* **Status:** **RESOLVED**
* **Finding:** Unauthenticated visitors could query `demo_businesses` and read prospect contact info and sales notes.
* **Resolution:** Restricted `demo_businesses` to owner and admins. Created `sanitized_demo_businesses` view granting public access only to non-sensitive columns (`business_name`, `demo_slug`, `demo_url`, `status`).

#### CRITICAL-4: Unprotected `/api/test-fallback`
* **Status:** **RESOLVED**
* **Finding:** A diagnostic route bypassed limits and allowed unauthenticated AI generation.
* **Resolution:** Endpoint eliminated and removed from routing table.

#### CRITICAL-5: Chat History IDOR Vulnerability
* **Status:** **RESOLVED**
* **Finding:** `/api/widget/chat/history` allowed any visitor with a conversation UUID to pull the entire transcript.
* **Resolution:** Refactored endpoint to validate matching `visitor_id` header or authenticated business owner access. Implemented rate limiting on the history endpoint.

#### CRITICAL-6: Storage Path Cross-Tenant Confusion
* **Status:** **RESOLVED**
* **Finding:** Client-supplied storage paths could allow path spoofing.
* **Resolution:** Upload server actions enforce strict server-side path construction: `${business_id}/${sanitized_filename}`.

---

### Security Findings

| ID | Issue | Severity | Status | Details |
|---|---|---|---|---|
| **S-1** | `profiles` RLS policy public | Critical | **Fixed** | Restricted to `auth.uid() = id` or admin role. |
| **S-2** | `demo_businesses` PII leakage | Critical | **Fixed** | Restricted base table; public queries routed to sanitized view. |
| **S-3** | Open AI proxy on `/api/test-fallback` | Critical | **Fixed** | Route deleted from codebase. |
| **S-4** | IDOR on chat history endpoint | Critical | **Fixed** | Requires visitor session match or owner JWT. Rate limited. |
| **S-5** | Storage path spoofing | Critical | **Fixed** | File paths generated server-side. |
| **S-6** | Rate limiting fallback behavior | High | **Mitigated** | Fallback allows traffic during network partitions but logs warnings; Upstash configured for production. |
| **S-7** | In-memory rate limiting default | High | **Mitigated** | Supports Upstash Redis REST credentials in `.env.local` / Vercel. |
| **S-8** | Unthrottled chat history endpoint | High | **Fixed** | Added rate limiting (`rateLimitKey = history:...`). |
| **S-9** | `/api/demo/track` spam risk | High | **Fixed** | Rate limited per IP/session. |
| **S-10**| CSP script directives | High | **Monitored** | Required for dynamic widget script hydration; strict script origins configured in `next.config.ts`. |
| **S-11**| Public demo table insertions | Medium | **Fixed** | Guarded by backend rate limits and input sanitization schemas. |
| **S-12**| Verbose 500 database error leakage | Medium | **Fixed** | Replaced internal error strings with sanitized client messages. |
| **S-13**| Wildcard CORS on widget routes | Medium | **Intentional** | Necessary for embedding on arbitrary third-party customer websites; endpoints validate origin headers where applicable. |
| **S-14**| CSRF protection on API endpoints | Medium | **Fixed** | Next.js server actions enforce origin verification; API routes validate Bearer / HMAC. |
| **S-15**| Per-process fallback circuit counter | Low | **Acceptable** | Distributed serverless cold-starts recover automatically via database error telemetry. |
| **S-16**| Environment secret exposure | Low | **Fixed** | `.env*` properly excluded via `.gitignore`. |
| **S-17**| Encryption key rotation | Low | **Documented** | Detailed in `DEPLOYMENT.md` for zero-downtime re-encryption. |

---

### Database & Data Integrity Findings

| ID | Description | Severity | Status | Resolution |
|---|---|---|---|---|
| **D-1** | Missing `increment_subscription_usage` RPC | Critical | **Fixed** | Defined in `20260622000000_audit_fixes.sql`. |
| **D-2** | Duplicate subscriptions per business | High | **Fixed** | Added `UNIQUE (business_id)` constraint on `public.subscriptions`. |
| **D-3** | Multiple concurrent active assistants | High | **Fixed** | Created unique partial index `unique_active_assistant_per_business` on `(business_id) WHERE is_active = true`. |
| **D-4** | Non-atomic demo counter increments | High | **Fixed** | Implemented RPCs: `increment_demo_conversation_count`, `increment_demo_message_count`, `increment_demo_lead_count`. |
| **D-5** | Orphaned leads on conversation deletion | High | **Fixed** | Enforced soft-delete patterns and foreign key cascade rules. |
| **D-6** | Unsafe DELETE operations in setup scripts | High | **Fixed** | Replaced with idempotent partition-ranked CTE cleanups. |
| **D-7** | Nullable owner on demo businesses | High | **Fixed** | Controlled via system placeholder IDs with strict ownership assignments. |
| **D-8** | `conversations.source` enum mismatch | Medium | **Fixed** | Added `CHECK (source IN ('dashboard_test', 'widget', 'hosted_chat', 'playground'))`. |
| **D-9** | Schema model column alignment | Medium | **Fixed** | Migrations aligned with TypeScript types. |
| **D-10**| Negative billing limit values | Medium | **Fixed** | Enforced positive integer bounds in `billing.ts` schemas. |
| **D-11**| Idempotent migrations | Medium | **Fixed** | Migrations structured with `IF NOT EXISTS` guards. |
| **D-12**| Migration versioning framework | Medium | **Fixed** | Organized under `supabase/migrations/` using timestamp prefixes. |
| **D-13**| Client subscription mutation policies | Low | **Fixed** | Subscriptions locked from direct client mutation; mutations require service role. |

---

### Performance & Scalability Findings

* **Composite Query Indexing (P-1, P-2, P-3):**
  Added high-traffic composite indices to eliminate sequential table scans:
  ```sql
  CREATE INDEX IF NOT EXISTS usage_logs_business_type_created_idx ON public.usage_logs(business_id, type, created_at);
  CREATE INDEX IF NOT EXISTS messages_business_role_created_idx ON public.messages(business_id, role, created_at DESC);
  CREATE INDEX IF NOT EXISTS leads_business_created_idx ON public.leads(business_id, created_at DESC);
  ```
* **Sequential Database Hot-Path (P-7):**
  `runBusinessChat()` has been optimized by parallelizing independent verification queries (`verifyAIUsageLimits`, `getWidgetConfig`, and chat history fetching) using `Promise.all`.
* **SEO Metadata & Search Crawler Compliance (P-9):**
  Deployed production-grade `public/robots.txt` and `public/sitemap.xml` covering marketing routes and indexing guidelines.

---

### UI/UX & Accessibility Review

* **Landing Page Aesthetic & Visual Consistency (U-2):**
  Complete overhaul executed in October 2026:
  - Transitioned the entire page from disjointed light/dark sections to a unified developer-grade dark palette (`#07080c`).
  - Positioned the **Instant AI Agent Generator** as the hero centerpiece.
  - Replaced all emojis with Lucide React SVG icons.
  - Refined typography with multi-weight high-contrast headings.
* **Component Accessibility (U-5):**
  Key input controls, forms, and dialogs have been updated with `aria-label`, explicit role attributes, and keyboard focus states.
* **System Maintenance Interceptor:**
  `app/layout.tsx` includes an operational maintenance overlay with bypass rules for administrative and authentication routes.

---

### Technical Debt

| ID | Item | Status | Action Taken |
|---|---|---|---|
| **TD-1** | Scratch files in project root | **Resolved** | Cleaned and ignored via `.gitignore`. |
| **TD-2** | Automated test suite infrastructure | **Resolved** | Vitest, React Testing Library, and Playwright integrated with 10+ test suites. |
| **TD-3** | Monolithic action files | **Ongoing** | Core actions split into discrete helper libraries (`lib/ai/`, `lib/billing/`, `lib/scraper/`). |
| **TD-4** | Untyped `any` exception catching | **Resolved** | Replaced `catch (err: any)` with typed `catch (err: unknown)` across critical paths. |
| **TD-5** | Git nested tracking | **Resolved** | Nested sub-packages cleaned from repository index. |
| **TD-6** | Production logging hygiene | **Resolved** | Consolidated behind `lib/monitoring/log-error.ts`. |

---

## 5. Testing & Quality Assurance

### Test Suite Summary (`tests/`)
- **Unit & Integration (`vitest`):**
  - `instant-generator.test.ts`: Scraper safety, URL normalization, content chunking, and draft generation.
  - `billing.test.ts`: Plan limits, currency conversions, and usage thresholds.
  - `api-history.test.ts`: Visitor isolation, authorization, and rate limiting.
  - `auth-rls.test.ts`: Tenant boundaries and administrative role verification.
  - `widget.test.ts`: Widget configuration serialization and script hydration.
- **End-to-End (`playwright`):**
  - Full visitor funnel: landing submission &rarr; interactive preview &rarr; authentication & claim.
- **Automated CI/CD Pipeline:**
  `.github/workflows/ci.yml` validates every pull request with linter checks, `tsc --noEmit`, Vitest unit coverage, and Playwright headless runs.

---

## 6. Scalability Assessment & Concurrency Modeling

| Scale Tier | Readiness | Operational Assessment |
|---|---|---|
| **100 Businesses** | **Ready** | Seamless operation on base Vercel Pro + Supabase Pro tiers. |
| **1,000 Businesses** | **Ready** | Composite indices and atomic RPCs handle message throughput. Upstash Redis ensures distributed rate limiting. |
| **10,000 Businesses** | **Optimization Required** | Requires database connection pooling (Supabase transaction pooler on port 6543) and message partitioning by date. |
| **100,000+ Businesses** | **Architectural Migration** | Transition from direct serverless writes to background message ingestion queues (Kafka/QStash) and read replicas. |

---

## 7. Production Deployment & Launch Readiness

### Pre-Launch Verification Checklist
- [x] TypeScript builds clean (`npx tsc --noEmit` &rarr; 0 errors).
- [x] ESLint passes with zero syntax or rule errors.
- [x] Atomic increment RPCs deployed to Postgres.
- [x] Row-Level Security active and validated on all tables.
- [x] Paystack webhook signature verification verified.
- [x] Rate limiting configured on public AI and widget routes.
- [x] SEO robots.txt and sitemap.xml published.
- [x] Responsive dark landing page design verified across viewports.

---

## 8. Consolidated Scorecard & Recommendation

| Dimension | Previous Score | Current Score | Notes |
|---|:---:|:---:|---|
| **Architecture** | 7/10 | **8.5/10** | Modular AI provider routing, atomic database transactions, clean App Router structure. |
| **Security** | 4/10 | **8.5/10** | Resolved critical PII leaks, closed IDOR vulnerabilities, strict RLS enforcement. |
| **Code Quality** | 6/10 | **8.0/10** | Strict TypeScript coverage, zero compilation errors, typed error handling. |
| **Scalability** | 3/10 | **7.5/10** | Composite database indexes, Redis rate limiting, eliminated sequential bottlenecks. |
| **UI/UX & Design** | 6/10 | **9.0/10** | High-conversion dark landing page, centerpiece AI agent generator, zero emojis. |
| **Reliability & DevOps**| 3/10 | **8.0/10** | GitHub Actions CI pipeline, Vitest test suite, automated health checks. |
| **Overall Health** | **5.0/10** | **8.3/10** | **Ready for Production / Public Launch** |

### Final Recommendation
Agentify has resolved its primary architectural vulnerabilities and successfully deployed its core viral customer acquisition engine. The application is **approved for public beta and production release**.
