# Outbound Webhook System Audit and Implementation

## Executive summary

The existing outbound webhook pages and business-scoped registration actions are retained. The system now creates durable delivery rows for the real `lead.created` workflow, signs outbound JSON with an endpoint-specific HMAC secret, and dispatches attempts through a protected scheduled worker. It supports endpoint editing, activation, deletion, diagnostic tests, secret rotation, server-filtered delivery history, and eligible manual retries.

The inbound Bachs payment webhook at `app/api/webhooks/bachs/route.ts` and all incoming payment event handling are out of scope and unchanged.

## Initial state and findings

- The existing `public.webhooks` and `public.webhook_deliveries` tables, owner RLS, settings page, monitor component, and `lib/actions/webhooks.ts` were the only outbound-webhook implementation.
- Retry changed a row's status but did not dispatch an HTTP request. Metrics loaded an unbounded delivery list and used the loaded rows as its counts. Delivery filtering was local to the first page.
- Endpoint validation only checked for an `https://` prefix. There was no sender, signing, durable event producer, atomic worker claim, or configured scheduler.
- `AVAILABLE_EVENTS` included conversation, message, and subscription names with no verified outbound producers.
- The application has a genuine lead persistence workflow in `lib/actions/chat/lead-handling.ts`.

## Design and data flow

1. A database `AFTER INSERT` trigger on `public.leads` creates one delivery per active matching endpoint in the same transaction as the lead insert. Updates do not generate duplicate create events.
2. The lead UUID is the stable event ID. The versioned payload contains `schema_version`, `event_id`, `type`, `created_at`, and a `data` object. An endpoint/event unique index plus `ON CONFLICT DO NOTHING` makes producer retries idempotent.
3. Vercel Cron calls `GET /api/webhooks/worker` every minute. The worker authenticates `Authorization: Bearer $CRON_SECRET`, atomically claims at most ten due rows through a service-role-only `SKIP LOCKED` RPC, and processes endpoint failures independently.
4. Each claim creates a durable ordered `webhook_delivery_attempts` row recording claim time, HTTP-start time, outcome, completion time, response, and duration.
5. The delivery attempt is an HTTPS POST with `X-Agentify-Event-Id`, `X-Agentify-Event`, `X-Agentify-Timestamp`, and `X-Agentify-Signature: v1=<hex HMAC-SHA256>`. The signature is calculated over the exact JSON request bytes.
6. A manual retry creates a new delivery row, retains the original event ID and payload, and has its own bounded attempt budget. A unique parent-attempt index prevents concurrent duplicate retries; a failed retry row can itself be retried once. Retries are allowed only for a failed or exhausted delivery whose endpoint still exists and is active.

The database migrations add claim, event, retry, attempt-history, and statistics fields/indexes, the lead producer trigger, and service-only RPCs. A compatibility migration maps legacy `success` to `delivered` and legacy `retrying` to `pending`, resetting legacy attempt counters/timestamps because the former retry action never sent HTTP requests and no actual attempt history can be reconstructed.

## Event support and semantics

Only `lead.created` is exposed to registrations. The lead trigger emits it for a newly persisted lead, including valid lead inserts from other application workflows. Updates to existing leads are not create events. The `webhook.test` diagnostic event is queued only by the explicit endpoint test action and is not a subscription event.

Conversation, message, and subscription events are deliberately not advertised until their production workflows can be verified and connected. The Bachs incoming event system is not an outbound producer.

## Security and privacy

- Registration authentication derives the business from the current authenticated user; business IDs supplied by the browser are not accepted. The owner-scoped RLS model remains in place.
- Endpoint signing keys are 32 random bytes, returned only by create/rotate actions. Secret reads are separated into `public.webhook_secrets`, inaccessible to `anon` and `authenticated`; the legacy `webhooks.secret` values are migrated and cleared. The normal registration query never selects a secret.
- URLs must be HTTPS, port 443, and omit credentials, query strings, and fragments. IP literals and hostnames are checked against **all** DNS A/AAAA answers; any non-public result rejects the endpoint. Immediately before connecting, the worker resolves and validates again, then pins the TLS socket to one of the checked IPs while retaining normal certificate/hostname verification.
- Redirects are never followed. The request has a five-second timeout and response preview limit. Private, loopback, link-local, carrier-grade NAT, reserved, multicast, documentation, and metadata ranges fail closed.
- The dashboard only returns recursively redacted payloads and redacted/omitted response previews. Transport errors and worker logs do not include endpoint secrets, request headers, or response text.
- The public scheduled route does not accept unauthenticated invocations. `CRON_SECRET` must be a high-entropy server-side environment variable.

Application-level DNS validation and socket pinning reduce rebinding/redirect SSRF risk. Production should additionally enforce outbound network policy at the hosting/egress layer; no application can guarantee that unusual routing, transparent proxies, or compromised resolvers will honor public-address assumptions.

## Retry and delivery behavior

- Delivery states are `pending`, `processing`, `delivered`, `retrying`, `failed`, and `exhausted`. `failed` is permanent/non-retryable; `exhausted` means a retryable failure used its attempt budget. Each endpoint configures a maximum of one to five attempts per delivery row (five by default). HTTP 408, 425, 429, 5xx, timeouts, and connection failures are retryable. Other non-2xx statuses, including redirects and ordinary 4xx responses, fail without another automatic attempt.
- Retry delay is exponential (starting at one minute, capped at one hour) with bounded jitter. Database claims set a two-minute lease and atomically create the attempt record and increment the attempt counter. Lease recovery marks an unfinished attempt `interrupted`, then retries the delivery or marks it `exhausted` when its budget is spent. Interrupted attempts are not included in the completed-HTTP success-rate denominator.
- A success is any 2xx response. A failed endpoint is isolated from other rows in the same worker batch.
- Manual retry is a new row with the original event ID, retaining the original attempt record. Automatic event creation is idempotent per endpoint/event; manual retries intentionally create additional delivery rows.
- Disabled endpoints are not claimed. A delivery queued before disabling remains eligible after re-enabling if still within its attempt budget. Deleting an endpoint marks its queued deliveries failed and retains the history, but they cannot be sent or manually retried.

## UI, actions, and metrics

The existing settings page and `WebhookMonitor` remain the product surface. They now support create/edit, enable/disable, delete, configurable maximum attempts, queued test deliveries, one-time secret display/rotation, endpoint-specific recent history, paginated server-side search, event, date, and status filtering, and a redacted delivery detail view with ordered attempts (including linked manual-retry rows). The log displays attempt count and last-attempt time.

Stats are calculated in PostgreSQL over the latest 30 days, avoiding Supabase row caps. Success rate is successful / total completed HTTP attempt records (success or failure); interrupted and pre-HTTP validation failures are excluded. Average response time uses those completed HTTP attempts. Failed and exhausted delivery counts are shown separately. “HTTP requests started (24h)” counts attempt records by `http_started_at`, excluding claims that never began HTTP while including interrupted requests that had begun. Legacy delivery rows remain visible but have no recoverable attempt history; success states are migrated to delivered and old fake retry counters are reset.

## Deployment and operations

1. Apply `supabase/migrations/20261104160000_outbound_webhooks.sql` and `supabase/migrations/20261104170000_webhook_attempt_history.sql` before deploying the application version that calls their RPCs.
2. Set `CRON_SECRET` in Vercel Production to a long random value. Vercel Cron sends it as a bearer token when this environment variable is configured.
3. `vercel.json` schedules `/api/webhooks/worker` every minute. Ensure the selected Vercel plan supports the configured route duration; the worker is bounded to ten concurrent five-second endpoint requests per invocation.
4. Monitor worker response counts (`claimed`, `completed`, and `failedToSave`) and failed delivery records. Protect the service-role key and do not expose endpoint secrets in support logs.
5. The endpoint contract uses JSON request bodies and the headers listed above. Receivers should compare HMAC signatures in constant time and deduplicate by `X-Agentify-Event-Id`; duplicate HTTP delivery is possible if the receiver accepts a request but the worker cannot persist its result.

## Verification and limitations

- Focused webhook tests: passed (16 tests), covering URL/IP validation including mixed DNS answers, signature generation, cron bearer verification, PII redaction, attempt-based metrics, delivery-state migration and lease recovery, server filter normalization, linked manual-retry attempt history, configurable attempt limits, retryable status classes, jitter bounds, stable lead-event IDs, idempotency, atomic claims, manual retry deduplication, and queued-delivery cleanup on endpoint deletion.
- Focused TypeScript check of changed actions, worker, security/metrics/retry helpers, UI, and tests: passed. The full project check/build is blocked by the existing `MAX_DEMO_AI_REPLIES` export error in `.next/types/app/api/demo/chat/route.ts`.
- Targeted ESLint on changed TypeScript/TSX files: passed with no warnings.
- `git diff --check`: passed.
- Production build: the default Turbopack build terminated with a Windows process failure. A Webpack build compiled successfully, then Next.js type validation failed on the existing unrelated `app/api/demo/chat/route.ts` export `MAX_DEMO_AI_REPLIES`. The existing `lib/documents/extract-text.ts` also produced a `pdf-parse` default-export warning. Safe dummy environment values were used; no live service credentials were present.
- The database migrations were not applied to a Supabase instance here. Trigger, RLS/grant, RPC, attempt-history, and concurrent `SKIP LOCKED` behavior still require an integration run against the target PostgreSQL/Supabase project.

The system is at-least-once, not exactly-once. It intentionally supports one business event until other actual producers are verified. No changes were made to the incoming Bachs route.
