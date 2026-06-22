# Agentify — Complete Project Audit Report

**Date:** June 22, 2026  
**Auditor:** Senior Software Architect / Principal Engineer / Security Auditor  
**Scope:** Full codebase — 214 source files, 23 SQL migrations, 68 components  

---

# Executive Summary

**Agentify** is a B2B SaaS platform that enables businesses to create AI-powered customer support chat assistants. Users upload business data (documents, website content), configure an AI personality, then embed a chat widget on their website to convert visitors into leads 24/7. It includes billing via Paystack, email notifications via Resend, an admin dashboard for platform management, a "demo generator" for sales, and multi-provider AI with Gemini/OpenRouter/Groq/Vertex.

The application is built with **Next.js 16 (App Router)**, **React 19**, **Supabase** (auth, database, storage), **Tailwind CSS 4**, **TypeScript**, deployed to **Vercel**. The codebase contains **~214 files** across `app/`, `lib/`, `components/`, and `supabase/` — roughly **4,227 lines** of server logic, **68 component files**, and **23 SQL migration files**.

The project is in **late-alpha / pre-production** stage. The architecture is sound for its scope, the AI engine with provider failover is well-designed, and many security fundamentals (RLS, rate limiting, CSP headers, webhook verification, input validation with Zod) are in place. However, there are **6 CRITICAL** and **15+ HIGH** severity issues that must be resolved before any public launch — particularly around data integrity race conditions, PII exposure via RLS, an unprotected test API route, and a conversation history IDOR vulnerability.

---

# What This Project Does

| Aspect | Detail |
|---|---|
| **Product** | AI customer support chat widget platform (SaaS) |
| **Target Users** | Small-to-medium businesses in African markets (Nigeria-first via Paystack) |
| **Core Value** | Turn any website into a 24/7 AI sales/support assistant trained on business data |
| **Revenue Model** | Subscription tiers (Free Trial → Starter → Growth) via Paystack recurring billing |
| **Tech Stack** | Next.js 16, React 19, TypeScript, Supabase, Gemini/OpenRouter/Groq/Vertex AI, Tailwind 4, shadcn/ui |
| **Deployment** | Vercel (serverless), Supabase (hosted), Paystack (payments), Resend (email) |

**Major Features:**
- AI chat widget embeddable on any website
- Hosted chat pages with unique slugs
- Multi-page website scraping/crawling for knowledge ingestion
- Document upload (PDF, DOCX, TXT) with embedding generation
- RAG-based AI responses with intent routing and lead detection
- Multi-provider AI engine with automatic failover
- Lead capture and email notification (booking, support, new leads)
- Manual human takeover for live conversations
- Subscription billing with Paystack
- Admin dashboard with platform analytics, user/business/conversation management
- Demo generator for sales prospects
- AI usage monitoring and quota enforcement
- Dynamic platform configuration (admin can change AI providers without code changes)

---

# Strengths

1. **Well-structured AI engine** (`lib/ai/engine/`) — provider abstraction, automatic failover with retry/timeout, quality checks, logging, intent classification, lead detection, and RAG retrieval form a solid foundation.

2. **Security fundamentals exist** — CSP headers, HSTS, X-Frame-Options, RLS on all major tables, webhook HMAC verification, Zod input validation on API routes, rate limiting with Upstash support, file upload validation, SSRF protection in the scraper (DNS resolution check, private IP blocking), `server-only` imports on all server modules.

3. **Good separation of concerns** — Server actions in `lib/actions/`, API routes in `app/api/`, shared logic in `lib/ai/`, `lib/billing/`, `lib/payments/`, reusable UI in `components/ui/`.

4. **Comprehensive documentation** — DEPLOYMENT.md, LAUNCH_CHECKLIST.md, AI_QUOTAS_GUIDE.md provide clear operational guidance.

5. **Admin security is solid** — All admin actions call `requireAdmin()` server-side. Admin layout enforces admin check. Secrets use AES-256-GCM encryption in the database. Audit logging for admin config changes.

6. **Billing/webhook design** — Idempotent webhook processing via unique event_id constraint, server-side payment verification (callback page verifies via Paystack API, not just URL params), amount cross-check between local record and provider response.

7. **Error handling philosophy** — Centralized error logger, user-friendly error messages that never expose internals, fire-and-forget pattern for non-critical operations (email sends).

8. **Scalability-conscious patterns** — Feature flags via database config, dynamic AI provider switching, usage quota system with monthly/daily/global caps.

---

# Weaknesses

1. **Zero test coverage** — No unit tests, integration tests, or E2E tests exist. No test framework configured. No CI/CD pipeline.

2. **Billing data integrity is broken** — The `increment_subscription_usage` RPC doesn't exist; the fallback has a TOCTOU bug where `current_usage` is reset to `amount` instead of incremented.

3. **Race conditions everywhere** — Demo counters, subscription usage, lead counts, active assistant toggling all use non-atomic read-modify-write patterns.

4. **PII exposure via RLS** — `profiles` table is world-readable; `demo_businesses` active rows expose PII to any anon user.

5. **Unprotected API routes** — `/api/test-fallback` and `/api/widget/chat/history` are exposed without authorization.

6. **No database migrations framework** — 23 raw SQL files applied manually with no versioning, no rollback capability, some are non-idempotent.

7. **Scratch files in repo root** — 8+ scratch/test files tracked by git (untracked in git status but should be cleaned/ignored).

8. **In-memory rate limiting as production default** — Without Upstash, rate limits are per-process and reset on serverless cold starts.

---

# Critical Issues

### CRITICAL-1: Missing RPC + Usage Counter Reset Bug
**Problem:** `lib/billing/usage.ts:50-67` calls `supabase.rpc("increment_subscription_usage", ...)` which does not exist in any SQL migration. The fallback code reads `sub` which was fetched with `select("id")` only (line 33-36), so `(sub as any)?.current_usage` is always `undefined`. The else branch always sets `current_usage = amount`, resetting the counter to the last increment value on every call.

**Impact:** Usage tracking is fundamentally broken. Every AI message call resets the counter instead of incrementing it. Combined with `verifyAIUsageLimits` counting from `usage_logs` (line 229-236), the dashboard shows a different number than what enforces limits. Users could exceed limits silently.

**Files:** `lib/billing/usage.ts:33-67`, all `supabase/*.sql` (no RPC defined)

**Fix:** Create the RPC function:
```sql
CREATE OR REPLACE FUNCTION increment_subscription_usage(p_business_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE subscriptions SET current_usage = COALESCE(current_usage, 0) + p_amount
  WHERE business_id = p_business_id;
END;
$$ LANGUAGE plpgsql;
```

### CRITICAL-2: PII Exposure — `profiles` World-Readable
**Problem:** `supabase/schema.sql:17-18` creates a SELECT policy `using (true)` on `profiles`, exposing every user's `email`, `full_name`, and `avatar_url` to anyone including unauthenticated visitors.

**Impact:** Email enumeration, privacy violation, GDPR/NDPR non-compliance. Any anon Supabase client can query all users.

**Files:** `supabase/schema.sql:17-18`

**Fix:** Change policy to `using (auth.uid() = id)` for non-admin users, or add admin check.

### CRITICAL-3: PII Exposure — `demo_businesses` Public SELECT
**Problem:** `supabase/demo-generator-schema.sql:86-87` allows anyone to `SELECT * FROM demo_businesses WHERE status = 'active'`. The table contains `contact_name`, `contact_email`, `contact_phone`, `sales_notes`, `follow_up_status` (lines 8-26).

**Impact:** Demo prospect PII harvested by any visitor. Sales pipeline data leaked.

**Files:** `supabase/demo-generator-schema.sql:8-26,86-87`

**Fix:** Create a view that exposes only non-sensitive columns, or use column-level RLS.

### CRITICAL-4: Unprotected `/api/test-fallback` Route
**Problem:** `app/api/test-fallback/route.ts:1-22` is a GET endpoint with NO authentication. It calls `generateChatResponse()` with a hardcoded business ID, bypassing usage limits, rate limits, and auth checks. It's currently untracked in git (in `app/api/test-fallback/`) but exists in the working directory.

**Impact:** Anyone can hit this endpoint to consume AI credits for a specific business, use it as an open AI proxy, or trigger provider calls at will.

**Files:** `app/api/test-fallback/route.ts`

**Fix:** Delete this file immediately. Add `requireAdmin()` if needed for internal testing.

### CRITICAL-5: IDOR — Chat History Exposure
**Problem:** `app/api/widget/chat/history/route.ts:32-36` fetches all messages for any given `conversationId` UUID with no authorization check. No rate limiting either. Anyone who guesses or discovers a conversation UUID can read the full chat transcript including visitor PII (emails, phones, names captured during conversations).

**Impact:** Full conversation content leakage including lead contact information.

**Files:** `app/api/widget/chat/history/route.ts`

**Fix:** Add rate limiting. Add a time-based signed token or HMAC to conversation IDs for widget access. At minimum, validate the conversation belongs to a business with an enabled widget.

### CRITICAL-6: Storage Policy Path Injection
**Problem:** `supabase/storage-schema.sql:26` uses `(string_to_array(name, '/'))[1]` to extract a business ID from the storage path. A user controls the file `name` and could set it to `{victim_business_id}/anything.pdf`. Since the policy checks `businesses.id = extracted_id AND owner_id = auth.uid()`, the attack doesn't work directly — BUT the check verifies the path segment matches a business the user owns, not that the uploaded file's business context matches. The real risk is subtle: if a user owns business A and uploads to `B/malicious.pdf`, and business B's owner can then read files at `B/*`, they'd see content from business A's user.

**Impact:** Cross-tenant data confusion potential. More importantly, there's no validation that the `name` path matches the intended business ID in the application code.

**Files:** `supabase/storage-schema.sql:26`

**Fix:** In the upload handler, explicitly construct the storage path from `business_id` + sanitized filename. Never accept user-provided paths.

---

# Security Findings

| # | Issue | Severity | File(s) |
|---|---|---|---|
| S-1 | `profiles` table world-readable (`SELECT using true`) | **CRITICAL** | `supabase/schema.sql:17` |
| S-2 | `demo_businesses` public SELECT exposes PII columns | **CRITICAL** | `supabase/demo-generator-schema.sql:86` |
| S-3 | Unprotected `/api/test-fallback` — open AI proxy | **CRITICAL** | `app/api/test-fallback/route.ts` |
| S-4 | `/api/widget/chat/history` — no auth, exposes full conversations by UUID | **CRITICAL** | `app/api/widget/chat/history/route.ts` |
| S-5 | Storage path user-controlled, potential cross-tenant | **CRITICAL** | `supabase/storage-schema.sql:26` |
| S-6 | Rate limiter fails open when Upstash unreachable | **HIGH** | `lib/security/rate-limit.ts:116-118` |
| S-7 | Rate limiter uses in-memory store in production (no Upstash config likely) | **HIGH** | `lib/security/rate-limit.ts:159` |
| S-8 | `/api/widget/chat/history` has no rate limiting | **HIGH** | `app/api/widget/chat/history/route.ts` |
| S-9 | `/api/demo/track` — no rate limiting, could spam demo_events table | **HIGH** | `app/api/demo/track/route.ts` |
| S-10 | CSP allows `'unsafe-eval'` and `'unsafe-inline'` for scripts | **HIGH** | `next.config.ts:44` |
| S-11 | `demo/conversations/leads/events` INSERT policies allow any anon user | **MEDIUM** | `supabase/demo-generator-schema.sql:89-123` |
| S-12 | `error.message` leaked in history route 500 response | **MEDIUM** | `app/api/widget/chat/history/route.ts:47` |
| S-13 | CORS `Access-Control-Allow-Origin: *` on all widget responses | **MEDIUM** | `lib/http/cors.ts:2` |
| S-14 | No CSRF tokens on widget/demo endpoints (relies on CORS only) | **MEDIUM** | All `app/api/widget/`, `app/api/demo/` |
| S-15 | `providerFailures` tracker in `fallback.ts` is per-process, lost on cold starts | **LOW** | `lib/ai/engine/fallback.ts:8` |
| S-16 | `.env.local` in working directory with live API keys (gitignored but present) | **LOW** | `.env.local` |
| S-17 | `CONFIG_ENCRYPTION_KEY` in .env.local — rotation mechanism unknown | **LOW** | `.env.local:41` |

---

# Performance Findings

| # | Issue | Severity | File(s) |
|---|---|---|---|
| P-1 | `checkResponseCache()` scans 50 most recent messages per business with sequential scan | **HIGH** | `lib/actions/chat.ts:153-193` |
| P-2 | No composite indexes on `usage_logs(business_id, type, created_at)` — full table scan per chat message | **HIGH** | `supabase/billing-schema.sql`, `lib/billing/usage.ts:115-130` |
| P-3 | `messages` table lacks `(business_id, role, created_at DESC)` index | **HIGH** | `supabase/chat-schema.sql` |
| P-4 | `ai_interaction_logs` has zero indexes | **MEDIUM** | `supabase/ai-logs-schema.sql` |
| P-5 | `demo_events`, `demo_conversations`, `demo_leads` have no indexes | **MEDIUM** | `supabase/demo-generator-schema.sql` |
| P-6 | `knowledge_chunks` missing btree index on `source_id` | **MEDIUM** | `supabase/embeddings-schema.sql` |
| P-7 | `runBusinessChat()` makes 10+ sequential database calls per message | **MEDIUM** | `lib/actions/chat.ts:195-770` |
| P-8 | Token estimation uses naive `text.length / 4` — wildly inaccurate for non-English | **MEDIUM** | `lib/embeddings/chunker.ts:59-61` |
| P-9 | No `robots.txt` or `sitemap.xml` for SEO | **LOW** | `public/` |
| P-10 | `agentify/node_modules/` nested directory tracked in git | **LOW** | `agentify/` |

---

# Database Findings

| # | Issue | Severity | File(s) |
|---|---|---|---|
| D-1 | Missing `increment_subscription_usage` RPC; fallback has counter reset bug | **CRITICAL** | `lib/billing/usage.ts:50-67` |
| D-2 | `subscriptions` lacks `UNIQUE(business_id)` — allows duplicate rows | **HIGH** | `supabase/business-schema.sql:57` |
| D-3 | No DB enforcement of single active assistant per business | **HIGH** | `supabase/business-schema.sql:21-33` |
| D-4 | Demo counters use non-atomic read-modify-write | **HIGH** | `lib/actions/chat.ts:314-377` |
| D-5 | `leads.conversation_id ON DELETE SET NULL` creates duplicate lead risk | **HIGH** | `supabase/leads-schema.sql:5` |
| D-6 | `fix-business-setup.sql` does destructive DELETE by ctid | **HIGH** | `supabase/fix-business-setup.sql:3-10` |
| D-7 | `businesses.owner_id DROP NOT NULL` weakens RLS | **HIGH** | `supabase/demo-generator-schema.sql:177` |
| D-8 | `conversations.source` CHECK missing 'playground' — inserts will fail | **MEDIUM** | `supabase/chat-schema.sql:115` |
| D-9 | Code references `assistant.provider`, `assistant.chat_model` not in schema | **MEDIUM** | `lib/actions/chat.ts:660`, `supabase/business-schema.sql:21-33` |
| D-10 | No CHECK constraints on numeric limits (negative values accepted) | **MEDIUM** | `supabase/billing-schema.sql:14-17` |
| D-11 | Non-idempotent migrations: `schema.sql`, `business-schema.sql`, `knowledge-schema.sql` | **MEDIUM** | `supabase/schema.sql`, `business-schema.sql`, `knowledge-schema.sql` |
| D-12 | 23 SQL files with no migration framework or rollback | **MEDIUM** | `supabase/` |
| D-13 | `subscriptions` table has no INSERT/UPDATE/DELETE client policies | **LOW** | `supabase/business-schema.sql:124-131` |

---

# UI/UX Findings

| # | Finding | Severity | Notes |
|---|---|---|---|
| U-1 | No `robots.txt` or `sitemap.xml` | **MEDIUM** | SEO visibility will be poor |
| U-2 | Landing page has only 1 font weight variant (font-extrabold) | **LOW** | Limited typographic hierarchy |
| U-3 | No loading skeleton states for dashboard data | **MEDIUM** | Users see nothing during data fetch |
| U-4 | No mobile-specific layout verification | **MEDIUM** | Components use `lg:` responsive classes but no mobile-first testing evidence |
| U-5 | No accessibility testing (aria labels, focus management) | **MEDIUM** | No `aria-*` attributes observed in key components |
| U-6 | `dangerouslySetInnerHTML` in `lib/markdown.tsx` is safe (escapes first) but should use React elements | **LOW** | `lib/markdown.tsx:63` |
| U-7 | Some pages are stubs (about, careers, blog, integrations, contact, terms, privacy, cookie-policy, changelog) | **LOW** | Expected for pre-launch |

---

# Product Findings

| # | Finding | Severity |
|---|---|---|
| PR-1 | No onboarding walkthrough after signup | **MEDIUM** |
| PR-2 | No analytics dashboard for business owners (only admin) | **MEDIUM** |
| PR-3 | No self-serve plan downgrade/cancellation flow | **MEDIUM** |
| PR-4 | No multi-language/internationalization support | **LOW** |
| PR-5 | No dark mode toggle (admin dashboard is dark, landing is light) | **LOW** |
| PR-6 | No chat analytics for business owners (message volume, lead conversion, visitor trends) | **MEDIUM** |
| PR-7 | No API documentation for widget/embed integration | **LOW** |
| PR-8 | No team/multi-user support per business | **LOW** (future) |
| PR-9 | Flutterwave integration is incomplete (placeholder) | **LOW** |

---

# Technical Debt

| # | Item | Severity | Effort |
|---|---|---|---|
| TD-1 | 8+ scratch/test files in repo root (not in .gitignore) | **HIGH** | 1 hour |
| TD-2 | Zero test infrastructure (no Jest, no Playwright, no CI) | **CRITICAL** | 1-2 weeks |
| TD-3 | `lib/actions/chat.ts` at 1,146 lines — god function | **HIGH** | 2-3 days |
| TD-4 | `lib/actions/demo-generator.ts` at 976 lines | **HIGH** | 1-2 days |
| TD-5 | No database migration framework (Supabase CLI migrations) | **HIGH** | 2-3 days |
| TD-6 | `catch (error: any)` used 67 times — bypasses TypeScript safety | **MEDIUM** | 1-2 days |
| TD-7 | Nested `agentify/node_modules/` tracked in git | **LOW** | 10 minutes |
| TD-8 | `console.log`/`console.error` used in production code paths (14 in core) | **MEDIUM** | 1 day |
| TD-9 | Some schemas are non-idempotent (CREATE TABLE without IF NOT EXISTS) | **MEDIUM** | 1 day |
| TD-10 | Hardcoded fallback URLs (`https://agentifyhq.vercel.app`) scattered in code | **LOW** | 2 hours |

---

# Bugs & Risks

| # | Bug/Risk | Severity | File(s) |
|---|---|---|---|
| B-1 | Usage counter resets to `amount` instead of incrementing | **CRITICAL** | `lib/billing/usage.ts:55-65` |
| B-2 | `conversations.source` CHECK rejects 'playground' but code uses it | **HIGH** | `supabase/chat-schema.sql:115`, `lib/actions/chat.ts:219` |
| B-3 | `setActiveAssistant()` does two non-atomic UPDATEs — can leave 0 or 2 active | **HIGH** | `lib/actions/chat.ts:1113-1145` |
| B-4 | `payment_callback/page.tsx` trusts user-provided `reference` from URL params | **MEDIUM** | `app/payment/callback/page.tsx:14` (mitigated: verifies ownership server-side in `payments.ts:208`) |
| B-5 | TOCTOU race in `verifyAIUsageLimits` — check and use are separate calls | **HIGH** | `lib/billing/usage.ts:229-244` |
| B-6 | `sendMessage` `.catch(err => console.error(...))` silently loses email errors | **MEDIUM** | `lib/actions/chat.ts:475-476,483-484` |
| B-7 | Demo counter increments lost on concurrent visitors | **HIGH** | `lib/actions/chat.ts:314-326` |
| B-8 | `quality_passed` metadata always `true` for cached responses | **LOW** | `lib/actions/chat.ts:694` |

---

# Scalability Assessment

| User Count | Feasibility | Bottlenecks |
|---|---|---|
| **100 users** | ✅ Ready | Usage counting bugs would cause incorrect billing |
| **1,000 users** | ⚠️ Needs fixes | Missing composite indexes on `usage_logs`, `messages`; in-memory rate limiting resets on serverless cold starts; no Redis for session state |
| **10,000 users** | ❌ Not ready | Sequential DB calls in chat pipeline (10+ per message); no connection pooling config; `messages` table grows unboundedly; `verifyAIUsageLimits` scans all free subscriptions globally |
| **100,000 users** | ❌ Not ready | Would require full rewrite: read replicas, message partitioning, proper job queue for AI calls, dedicated rate limiting infrastructure, CDN for widget.js |

**Key scaling blockers:**
1. Each chat message makes 10+ sequential Supabase queries (no batching, no parallelism)
2. `verifyAIUsageLimits` for free plans fetches ALL free subscriptions, then ALL their usage logs — O(N²) with free users
3. No database connection pooling configured (Supabase uses Neon, which supports pooling)
4. In-memory rate limiting is useless across multiple serverless instances
5. `messages` and `usage_logs` tables have no partitioning or archival strategy

---

# Recommended Roadmap

## Phase 1 — Critical Fixes (1-2 weeks)

1. **Create missing `increment_subscription_usage` RPC** — fixes billing
2. **Fix `profiles` RLS policy** — restrict to self + admin
3. **Restrict `demo_businesses` SELECT** — create a sanitized view or column-level RLS
4. **Delete `/api/test-fallback/` route entirely**
5. **Secure `/api/widget/chat/history`** — add rate limiting, auth validation, or signed conversation tokens
6. **Fix storage path injection** — server-constructs paths, not user-supplied
7. **Add `UNIQUE(business_id)` on `subscriptions` and `widget_configs`**
8. **Add partial unique index on `assistants(business_id) WHERE is_active = true`**
9. **Fix `conversations.source` CHECK** to include 'playground'
10. **Add composite indexes** on `usage_logs(business_id, type, created_at)`, `messages(business_id, role, created_at DESC)`, `leads(business_id, created_at DESC)`

## Phase 2 — Improvements (2-4 weeks)

1. **Set up test infrastructure** — Jest + React Testing Library + Playwright
2. **Write critical path tests** — auth flow, chat flow, payment flow, RLS policies
3. **Migrate to Supabase CLI migrations** — versioned, idempotent, with rollback
4. **Convert counter increments to atomic RPCs** — usage, demo counts, lead counts
5. **Add `robots.txt` and `sitemap.xml`**
6. **Set up CI/CD pipeline** — GitHub Actions with lint, build, test, deploy
7. **Split `lib/actions/chat.ts`** — extract conversation management, lead handling, and usage tracking
8. **Remove `unsafe-eval` from CSP** — audit what requires it
9. **Add rate limiting to `/api/widget/chat/history` and `/api/demo/track`**
10. **Replace in-memory rate limiting with Upstash** (required for production)

## Phase 3 — Growth Features (1-2 months)

1. **Business analytics dashboard** — chat volume, lead conversion, visitor trends
2. **Self-serve cancellation/downgrade flow**
3. **Multi-user/team support per business**
4. **Chat message archival/partitioning strategy**
5. **Parallelize DB calls in chat pipeline** (batch inserts, Promise.all for independent queries)
6. **Optimize `verifyAIUsageLimits` for free plans** — materialized view or cached daily counter
7. **Internationalization (i18n) framework**
8. **Webhook delivery monitoring/retry UI**

## Phase 4 — Enterprise Readiness (3+ months)

1. **Read replicas** for dashboard queries
2. **Message table partitioning** (by month or business)
3. **Background job queue** for AI calls, email sends, usage processing
4. **SOC 2 / compliance audit preparation** — PII encryption at rest, audit logging
5. **Multi-region deployment** strategy
6. **SLA monitoring** and incident response procedures
7. **Load testing** at 10K+ concurrent users

---

# Final Scorecard

| Category | Score (1-10) | Rationale |
|---|---|---|
| **Architecture** | **7** | Clean App Router structure, good separation of concerns, modular AI engine. Loses points for god functions in actions and no migration framework. |
| **Code Quality** | **6** | TypeScript strict mode, Zod validation, consistent patterns. Loses points for 1,146-line chat.ts, 67 `catch(error: any)`, console.logs in production, scratch files in repo. |
| **Security** | **4** | CSP, HSTS, RLS, webhook verification are good. Loses heavily for world-readable profiles, PII-exposing demo policies, unprotected test route, IDOR in chat history. |
| **Scalability** | **3** | Sequential DB calls in hot path, no connection pooling, in-memory rate limiting, O(N²) free plan check, no message archiving. |
| **Performance** | **5** | Missing composite indexes on hot tables, FAQ cache scans 50 messages, 10+ sequential queries per chat. Good: serverless deployment, CDN-ready widget. |
| **UI/UX** | **6** | Clean landing page, consistent dark admin dashboard, shadcn/ui components. Missing: accessibility, loading states, robots.txt, dark mode toggle. |
| **Product Readiness** | **5** | Core flows work. Missing: analytics for business owners, cancellation flow, onboarding walkthrough, Flutterwave integration incomplete. |
| **Maintainability** | **5** | Good module structure, but zero tests, no CI/CD, 23 manual SQL migrations, no documentation for AI engine internals. |
| **DevOps** | **3** | Vercel deployment documented, but no CI/CD, no monitoring/alerting, no backup strategy, no health checks, no staged environments. |
| **Overall Project Health** | **5/10** | Solid foundation with serious security and data integrity issues. Production-ready only after Phase 1 fixes. |

---

**Verdict:** Agentify has a well-architected core and impressive feature breadth for an alpha-stage project. The AI engine with multi-provider failover, RAG pipeline, and lead detection is genuinely well-built. However, the 6 CRITICAL issues (PII exposure, broken billing, unprotected routes) are launch-blockers. With Phase 1 addressed (estimated 1-2 weeks), the project could safely enter limited beta. Full production readiness requires Phase 2 completion (4-6 weeks total).
