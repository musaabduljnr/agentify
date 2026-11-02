# Agentify Billing Forensic Audit

**Audit date:** 2026-11-02  
**Repository state:** `main` at `34a8883`; worktree was clean before this audit.  
**Scope:** Source code, local Supabase migration history, existing billing tests, environment-variable names, and current Bachs documentation. No production credentials, Bachs dashboard, webhook delivery logs, or live Supabase schema were available. No application code or database was changed during this audit.

The findings and flow description below document the pre-implementation audit snapshot. The implementation and validation update at the end records changes made afterward.

## Executive summary

Agentify uses Next.js App Router, TypeScript, Supabase Auth/Postgres, the `@bachs/sdk` server SDK, and Vitest. Checkout is initiated by an authenticated server action; the intended plan and authenticated user/business IDs are put in Bachs metadata and a pending transaction is written to Supabase. Bachs webhooks are signature-verified against the raw body and are intended to activate subscriptions.

The reported Starter, Growth, and dashboard failures cannot be tied to a specific production event or database condition from this checkout: the actual webhook deliveries, provider configuration, deployed migration versions, and production rows are unavailable. The source does, however, establish several concrete defects that can produce inconsistent billing state:

1. Both the webhook and browser-return reconciliation treat a completed checkout session as proof of payment, although Bachs documents that `checkout.completed` is emitted for unpaid setup/free/trial checkouts too.
2. Webhook event insertion/lookup/update errors are ignored in key paths. Concurrent duplicates can therefore be processed without owning the unique event row, and the handler can return success without persisting completion.
3. Subscription activation and transaction recording are separate writes. Transaction update/insert failures are swallowed, and the activation helper has unsafe fallback-to-Starter behavior for unknown or missing plans.
4. The dashboard renders the pending-payment banner from `subscriptions.status = 'pending'`, not from a genuinely open checkout. Its best-effort reconciliation does not make that status authoritative.

The focused pre-change billing tests passed (10 tests), but they mock Supabase and the provider. They do not execute the webhook route, verify signatures, exercise real database constraints, or demonstrate a sandbox purchase.

## Existing architecture

| Area | Current implementation |
|---|---|
| Framework/runtime | Next.js 16 App Router, TypeScript, Node server actions and route handlers |
| Authentication | Supabase Auth; server code uses `createClient()` and `auth.getUser()` |
| Database access | Supabase JS; service-role client in webhook/activation paths, user-scoped client in dashboard actions |
| Provider | Bachs SDK in `lib/payments/bachs.ts`; product IDs/API and webhook secrets come from configuration/environment |
| Checkout route | `POST /api/payments/checkout` validates `starter` or `growth`, authenticates, rate-limits, then calls `createCheckoutSession()` |
| Checkout service | `lib/actions/payments.ts` looks up the authenticated user/business and configured product, creates hosted checkout, then inserts a pending `payment_transactions` row |
| Webhook | `POST /api/webhooks/bachs`; reads raw request body and calls the SDK verifier before dispatch |
| Activation | `lib/billing/upgrade.ts::activateSubscriptionPlan()` resolves business/plan, writes limits and subscription state, then separately writes transaction history |
| Subscription lookup | `lib/billing/subscription.ts::getBusinessSubscription()` queries by business; dashboard billing data is assembled by `getBillingData()` |
| Quotas | Plan constants in `lib/billing/plans.ts`, dynamic database overrides in `lib/billing/platform.ts`, quota checks in `lib/billing/usage.ts` and related callers |
| Tests | Vitest; focused tests are `tests/bachs-upgrade.test.ts` and `tests/billing-system.test.ts` |

No values from local secret files were printed or recorded. `.env.example` documents server-side Bachs API key, webhook secret, API URL, and Starter/Growth product-ID variables.

## Checkout-to-subscription flow

1. The dashboard calls `POST /api/payments/checkout` with a plan. The route requires an authenticated Supabase user and accepts only `starter` or `growth`; the amount and product are not taken from the request.
2. `createCheckoutSession()` loads the user's business and subscription, resolves a plan configuration/product ID, then calls `createBachsCheckoutSession()`.
3. The Bachs request uses a recurring product cart, USD, a customer email/customer ID, success/cancel URLs, and metadata containing `user_id`, `business_id`, `plan`, `product_id`, and reference.
4. Only after Bachs returns a checkout session does Agentify insert a pending transaction containing the checkout ID and the metadata needed to resolve the purchase. An insert error prevents the redirect, but leaves an external checkout already created.
5. On webhook delivery, the handler verifies the signature, finds or inserts a `webhook_events` row, then dispatches events to activation/failure/cancellation logic.
6. On dashboard return, `app/dashboard/billing/page.tsx` calls `reconcileCheckoutSession()` for a checkout ID before it loads the billing view. That action retrieves a Bachs session and currently may activate from the session status.
7. `getBillingData()` attempts a second, best-effort repair using the latest successful transaction or pending checkout. It ultimately reports the subscription row's status/plan.

## Database schema evidence and limits

The local migration history and legacy SQL describe the following billing objects. This is **repository schema evidence only**, not proof of the current production schema or that these migrations were applied.

| Object | Relevant locally defined columns/constraints |
|---|---|
| `subscriptions` | `business_id`, `plan`, `status`, usage limits/counters, period/reset dates, provider identifiers, `payment_provider`, `provider`, Bachs IDs, billing currency/amount, cancellation fields, metadata. A local migration establishes a unique constraint on `business_id`. |
| `payment_transactions` | `business_id`, `subscription_id`, provider/reference/plan/amount/currency/status, raw response, checkout/charge/invoice IDs, provider customer/subscription IDs, checkout URL, verification time. The legacy schema used integer `amount` and NGN; newer migrations add USD defaults and `billing_amount`, but do not change the original amount column's type. |
| `webhook_events` | provider, nullable provider event ID, event type, payload, processed flag, status/timestamps/errors. A local unique partial index covers `(provider, event_id)` when event ID is non-null. |
| `billing_plan_overrides` | Used by application code to override plan values, including limits and provider product identifiers. |
| `usage_logs` | Business/subscription references, usage type/amount, metadata, timestamp; reads drive quota checks. |

The 2026-11-02 refactor migration adds Bachs fields, indexes, and owner `SELECT` policies but does not itself make event processing and subscription/payment writes transactional. Existing migration files contain historical Paystack/Flutterwave provider checks and NGN defaults; later migrations partially replace those values. No migration status table, production schema introspection, or database connectivity was used during this audit. No database operation was run.

## Bachs documentation checked

- [Checkout sessions](https://docs.bachs.io/guides/checkout/checkout-sessions): hosted checkout, recurring product cart, `checkout_id`, and the documented relationship between checkout redirects and webhook confirmation.
- [Webhook overview](https://docs.bachs.io/guides/webhooks/overview.md): deliveries carry `X-Bachs-Signature`; validate against the original raw request body.
- [`collection.succeeded`](https://docs.bachs.io/guides/webhooks/events/collection-succeeded): successful collection payload carries `checkout_id`/reference, uppercase collection status, decimal-string amount and currency, and optional product cart/customer details.
- [`checkout.completed`](https://docs.bachs.io/guides/webhooks/events/checkout-completed): emitted when checkout finishes whether or not payment was collected; `payment_status` may be `no_payment_required`; `status` is `completed`.
- [`invoice.paid`](https://docs.bachs.io/guides/webhooks/events/invoice-paid): carries `subscription.subscription_id`, customer, paid status, currency/amount and billing period.

The event names and payload shapes for subscription lifecycle, cancellation, and failed invoice events still need confirmation against their individual current Bachs event pages before relying on them. The repository currently handles several aliases not established by the documentation checked here.

## Findings

### Bug A — Starter payment does not activate

| Required item | Finding |
|---|---|
| Bug | A paid Starter checkout can leave the subscription row in `pending`, so AI entitlements remain unavailable. |
| Root cause | The checkout service deliberately does not activate the subscription; activation depends on a valid webhook (or a dashboard reconciliation). The webhook's collection path depends on finding the Agentify transaction by checkout ID/reference and then on successful subscription update. Event persistence/database errors are not consistently surfaced; no production delivery/error evidence was available to identify which dependency failed for the reported purchase. |
| Location | `app/api/webhooks/bachs/route.ts` event lookup/insert and `collection.succeeded` handler; `lib/actions/payments.ts::createCheckoutSession`; `lib/billing/upgrade.ts::activateSubscriptionPlan`; `lib/actions/onboarding.ts` initializes new subscriptions as pending. |
| Evidence | Checkout transaction creation occurs after Bachs session creation. Activation is an independent later call. Webhook insert/select errors are ignored, and activation handles payment-transaction write errors as non-fatal. `getBillingData()` can only repair from an already successful transaction or a pending checkout it can retrieve. |
| Fix | Require durable event ownership; validate provider payment/product/currency/amount; resolve only a matching pending checkout; perform subscription, transaction, and webhook completion updates atomically; return a retryable error if persistence fails. |
| Verification | Add route-level tests with signed event fixtures and a database/RPC contract test for a new Starter checkout, including delayed/duplicate delivery and persistence failures. A sandbox E2E run remains required for provider delivery. |

### Bug B — Growth payment does not upgrade Starter

| Required item | Finding |
|---|---|
| Bug | A paid Growth checkout can leave the stored plan and quotas at Starter. |
| Root cause | The activation code is capable of updating Starter to Growth when it receives a trusted Growth plan, but the codebase has no route-level or provider integration test proving the webhook resolves a Growth checkout from Bachs' real payload. The current handler relies on a transaction lookup, metadata, product ID, or amount fallbacks, and suppresses transaction-write errors. Without the actual event, transaction row, and database error for the reported payment, the production root cause cannot be established honestly. |
| Location | `app/api/webhooks/bachs/route.ts` collection/checkout event parsing; `lib/billing/upgrade.ts::activateSubscriptionPlan`; Bachs product mapping in `resolvePlanFromProductId()`. |
| Evidence | The current tests call `activateSubscriptionPlan()` with a mocked `plan: "growth"` and therefore do not test Bachs event mapping. Unknown plans can fall through to Starter, and current plan resolution can infer a plan from amount instead of requiring a matching configured product and exact USD price. |
| Fix | Require a transaction matched by checkout/reference or a configured product ID; reject missing/unknown plan, wrong currency, wrong amount, and mismatched user/business metadata; perform a monotonic, atomic subscription upsert from a verified collection. |
| Verification | Add event-route tests using documented Growth payloads and test Starter-to-Growth limits through the same webhook path; verify resulting database/API response. |

### Bug C — Dashboard reports pending after payment

| Required item | Finding |
|---|---|
| Bug | The dashboard can continue to show a pending-payment banner and a pay button after a checkout is no longer genuinely outstanding. |
| Root cause | The view derives `isPending` solely from the subscription row's `status === "pending"` and does not require an open pending checkout. The row changes only through successful activation; expired/abandoned checkout handling updates a transaction but does not resolve the subscription state. Best-effort reconciliation can fail or cannot correct an unrecorded/mismatched transaction. |
| Location | `app/dashboard/billing/page.tsx` pending banner; `lib/actions/billing.ts::getBillingData()`; `app/api/webhooks/bachs/route.ts` `checkout.expired`; `lib/actions/payments.ts::reconcileCheckoutSession()`. |
| Evidence | `isPending` is a direct status comparison. The transaction query is separate from the banner condition. Both checkout reconciliation paths currently accept `session.status === "completed"` as a paid signal. |
| Fix | Make pending checkout state explicit and tied to a non-expired outstanding transaction; only transition to active from verified paid evidence; expire/close checkout state durably; return billing status from the centralized authoritative resolver and refresh after reconciliation. |
| Verification | Test pending/open, paid, expired, failed, and delayed-webhook states against the rendered/API billing model. |

## Additional high-confidence defects

- **False activation:** The webhook's `checkout.completed` handler accepts `status === "completed"` even when `payment_status` is not `paid`; Bachs explicitly documents that completed checkouts can have `no_payment_required`. `reconcileCheckoutSession()` and the dashboard's self-heal use the same unsafe `status === "completed"` fallback. This can grant an entitlement without a successful collection.
- **Weak event durability/concurrency:** The webhook ignores errors when looking up, inserting, and marking events. A duplicate-key race can leave `eventRecordId` unset while processing still proceeds. The handler may then return HTTP 200 without a durable processed marker.
- **Non-atomic activation:** Subscription update/insert happens before separate transaction persistence. Transaction failures are caught and logged as non-fatal, allowing the event to be marked processed even if payment history is incomplete. There is no single database transaction covering subscription, transaction, and event state.
- **Plan inference defaults to paid Starter:** `activateSubscriptionPlan()` initializes `targetPlan` to Starter and can retain that when product/metadata is absent or unrecognized; it also infers Growth from amount. Unknown provider data should fail closed, not grant a plan.
- **Client reconciliation is not checkout-owner-bound:** `reconcileCheckoutSession(checkoutId)` authenticates a caller but does not first prove that the matched Agentify transaction belongs to that user/business. It may use provider metadata to select the target business. The reference verifier likewise returns transaction status by reference without checking transaction ownership.
- **Canceled/failed transitions:** Cancellation/failure paths query subscriptions with loosely composed provider-ID filters and ignore some update errors. The cancellation handler uses the nonstandard local status spelling `"canceled"` while the request specification includes `cancelled`; statuses are not centrally normalized.
- **Entitlements have multiple readers:** Subscription lookup is repeated in usage, chat, team, admin, and billing code; the dashboard's plan config is resolved separately from stored numeric limits. These can disagree after changes or on read failures.
- **Provider/currency residue:** Paystack source utilities and a webhook route remain in the repository; marketing/privacy/terms pages still mention Paystack; plan formatting and payment-history UI retain NGN branches. Local provider constraints continue to allow historical provider names. Existing records should be preserved rather than rewritten or deleted merely to remove active Paystack code.
- **Test gap:** The 10 focused billing tests passed before changes, but their Supabase/Bachs dependencies are mocked. They include tests that treat `checkout.completed` as activation proof and do not test the actual route, raw signature verification, uniqueness race, RLS, SQL atomicity, or sandbox provider interactions.

## Reproduction based on source (not production)

1. Create a test Agentify user/business with a pending Starter subscription and configured Starter product.
2. Call `POST /api/payments/checkout` as that user; verify the Bachs checkout and pending transaction are created.
3. Deliver a documented `collection.succeeded` fixture with the matching checkout/reference and valid `X-Bachs-Signature`. Observe webhook persistence, subscription row, transaction row, and usage limits.
4. Repeat for Growth while the subscription is Starter.
5. Deliver `checkout.completed` with `status: "completed"` and `payment_status: "no_payment_required"`; the current code path treats this as paid and may activate.
6. Set an expired/abandoned transaction while the subscription row remains pending; the current dashboard banner remains based on that row status.

These are source-derived reproductions; no live payment or production database test was performed.

## Proposed architecture changes

1. Keep Bachs as the only active subscription provider and Supabase as the authoritative entitlement source.
2. Keep fixed USD Starter (`$2.00/month`) and Growth (`$10.00/month`) plan/pricing/limit configuration centralized; use configured product IDs only as identifiers, not as price authority.
3. Create and persist the pending transaction before returning a checkout URL, bind it to the authenticated user/business and intended plan, and require the webhook's product/currency/amount to match it.
4. Verify raw-body signature, persist the event with unique ownership, and process only documented event names and payloads. Treat `checkout.completed` as a checkout lifecycle signal; activate only with verified paid evidence (`collection.succeeded` or an authoritative provider retrieval that confirms payment).
5. Process each event idempotently and transactionally. Persist failures for provider retry; never acknowledge an event whose required state changes failed.
6. Use provider event timestamps and subscription identifiers to prevent stale events overwriting newer states; reject unknown IDs/statuses rather than defaulting to Starter.
7. Centralize subscription/entitlement resolution and have billing, quota, and feature gates consume the same status, limits, and period boundaries.
8. Tie dashboard pending state to a genuinely outstanding checkout and show processing while a verified event is delayed; do not activate from redirect query parameters.
9. Add additive, non-destructive migrations for provider constraints/indexes/RPCs. Preserve transaction history; do not claim application until deployment status is verified.
10. Remove active Paystack code/configuration and user-facing billing references while retaining historical payment records and general-purpose payment-history displays.

## Risks and verification boundaries

- No production Supabase schema, migration ledger, billing rows, Bachs event logs, or provider dashboard were accessible. Migration application and production root causes are therefore unverified.
- Bachs credentials were not used; no sandbox or live payment was initiated, and no webhook delivery was observed.
- The installed Bachs SDK's signature verifier is used by the current route; exact subscription-created/updated/failed/cancellation event payloads still require verification against provider docs before implementation.
- No destructive database operation was performed. Any migration added after this audit must be reviewed and applied by the deployment owner; this workspace cannot establish whether a production database has applied it.

## Implementation and verification update (2026-11-02)

- Implemented pending-transaction-first checkout creation, authenticated checkout reconciliation, strict plan/product/amount/currency validation, provider event claiming/retry, atomic database RPCs, and dashboard states for open/processing/failed/expired checkouts.
- Removed the debug reconciliation endpoint and active Paystack utilities, webhook route, admin connectivity controls, pricing claims, and deployment references. Historical migration constraints/schema examples remain to preserve legacy transaction compatibility.
- Added focused mock-based tests. `npx vitest run tests/bachs-upgrade.test.ts tests/billing-system.test.ts tests/payments.test.ts --maxWorkers=1` passed (10 tests).
- `npx tsc --noEmit` passed after regenerating Next route types with temporary dummy environment values and removing the stale generated dev validator.
- `npm run build` passed with temporary dummy Supabase/Upstash environment values; no real service credentials were used.
- The new SQL migration remains unapplied and was not checked against a live or disposable Supabase instance. Bachs sandbox/live flows, actual webhook delivery, production migration state, and rendered dashboard behavior remain unverified.
