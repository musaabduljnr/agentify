# Agentify Production Deployment

This guide prepares Agentify for production deployment on Vercel with Supabase, Gemini, optional OpenRouter fallback, Bachs billing, Resend, and the embeddable widget.

Replace `https://yourdomain.com` with the final production domain before deploying.

## Production Environment Variables

Set these in Vercel under Project Settings -> Environment Variables for the Production environment.

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public | `https://yourdomain.com`. No trailing slash. Used for callbacks and widget embed code. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL. Safe for browser use. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key. Safe for browser use with RLS enabled. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never expose client-side. Used by server routes and actions. |
| `GEMINI_API_KEY` | Server only | Gemini provider key. |
| `BACHS_API_KEY` | Server only | Bachs API key for hosted checkout and customer portal sessions. |
| `BACHS_WEBHOOK_SECRET` | Server only | Bachs webhook signing secret used to verify the raw request body. |
| `BACHS_API_URL` | Server only | Optional API base URL; use the documented sandbox URL for testing and production URL for live billing. |
| `BACHS_STARTER_PRODUCT_ID` | Server only | Bachs recurring USD product ID for Starter. |
| `BACHS_GROWTH_PRODUCT_ID` | Server only | Bachs recurring USD product ID for Growth. |
| `RESEND_API_KEY` | Server only | Resend API key for transactional email. |
| `EMAIL_FROM` | Public email value | Verified sender, for example `Agentify <hello@yourdomain.com>`. |
| `RESEND_VERIFIED_DOMAIN` | Server only | Optional guardrail. Set to the verified Resend domain, for example `yourdomain.com`, so production sends fail closed if `EMAIL_FROM` uses the wrong domain. |
| `SUPPORT_EMAIL` | Public email value | Support inbox, for example `support@yourdomain.com`. |

Optional environment variables already referenced by the codebase:

| Variable | Scope | Notes |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Server only | Enables persistent rate limiting if configured. |
| `UPSTASH_REDIS_REST_TOKEN` | Server only | Upstash token. |
| `FLUTTERWAVE_SECRET_KEY` | Server only | Reserved for Flutterwave checkout. |
| `FLUTTERWAVE_WEBHOOK_SECRET` | Server only | Reserved for Flutterwave webhook verification. |
| `OPENROUTER_API_KEY` | Server only | Required only if OpenRouter is selected as a primary or fallback AI provider. |
| `GROQ_API_KEY` | Server only | Optional AI provider support. |
| `GOOGLE_CLOUD_PROJECT_ID` | Server only | Optional Vertex AI support. |

Secret safety rules:

- Only variables that intentionally start with `NEXT_PUBLIC_` are bundled for browser use.
- Do not create `NEXT_PUBLIC_` copies of service role keys, API keys, secret keys, webhook secrets, private tokens, or provider tokens.
- `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` if used, `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`, and `RESEND_API_KEY` must stay server-only.
- Provider secrets are configured in Vercel, not through the browser admin UI.

## Vercel Setup

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Vercel, import the repository.
3. Use the default Next.js framework preset.
4. Set the production environment variables listed above.
5. Set the production domain:
   - Vercel Project -> Settings -> Domains.
   - Add `yourdomain.com` and `www.yourdomain.com` if needed.
6. Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com`.
7. Deploy from the production branch.
8. After the domain is live, redeploy once so all build-time public env values are compiled with the final domain.

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

Current build status:

- `npm run build` passes when the required production envs are present.
- Local verification used safe dummy provider values only; real provider keys must be configured in Vercel.

## Supabase Setup

1. Create a production Supabase project.
2. Apply the SQL files in `supabase/` in a controlled order:
   - `schema.sql`
   - `business-schema.sql`
   - `chat-schema.sql`
   - `knowledge-schema.sql`
   - `embeddings-schema.sql`
   - `billing-schema.sql`
   - `payments-schema.sql`
   - `leads-schema.sql`
   - `ai-settings-schema.sql`
   - `webhook-events-schema.sql`
   - `storage-schema.sql`
   - `error-logs-schema.sql`
3. Confirm Row Level Security is enabled on user-owned tables.
4. Confirm public anon access is limited by RLS policies.
5. Copy the production values into Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. In Supabase Auth -> URL Configuration:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs:
     - `https://yourdomain.com/auth/callback`
     - `https://yourdomain.com/dashboard`
     - `https://yourdomain.com/onboarding`
7. Configure any required email templates and SMTP settings if Supabase auth emails are used.
8. Create the first admin user:
   - Sign up normally.
   - Update that profile's `role` to `admin` from the SQL editor or an internal admin seed script.

Storage checks:

- Confirm document upload buckets exist.
- Confirm bucket size/type limits match `lib/security/file-upload.ts`.
- Confirm private buckets are not publicly listable unless intentionally public.

## Bachs Billing Setup

Follow [BACHS_SETUP_GUIDE.md](./BACHS_SETUP_GUIDE.md) to create the Starter and Growth products, configure the Bachs API and webhook secrets, and register:

```text
https://yourdomain.com/api/webhooks/bachs
```

The app validates Bachs signatures against the original request body. It activates paid plans only after confirming a paid checkout or successful collection, and reconciles the checkout against the matching Agentify transaction.

## Resend Setup

1. In Resend, add and verify the sending domain.
2. Add the DNS records Resend provides:
   - SPF/TXT
   - DKIM
   - Return-Path, if provided
3. Wait for Resend to show the domain as verified.
4. Create a production API key.
5. Add Vercel env vars:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`, for example `Agentify <hello@yourdomain.com>`
   - `RESEND_VERIFIED_DOMAIN`, for example `yourdomain.com`
   - `SUPPORT_EMAIL`, for example `support@yourdomain.com`
6. Confirm `EMAIL_FROM` uses an address on the verified domain.
7. From an admin session, POST to `/api/admin/email-test` with each template name to verify rendering and delivery:
   - `welcome`
   - `lead-notification`
   - `booking-support`
   - `payment`
   - `usage-warning`
8. Send a real production smoke test and confirm inbox delivery.

Email reliability notes:

- Email sends are non-blocking for app flow. Failures are written through the centralized error logger with source `email-send`.
- The app never returns `RESEND_API_KEY` or provider errors to public users.
- Lead, payment, usage-warning, and onboarding welcome sends use React Email templates rendered server-side.

## Widget Production URL

The production widget script is served from:

```text
https://yourdomain.com/widget.js
```

Example embed:

```html
<script
  src="https://yourdomain.com/widget.js"
  data-business-id="YOUR_BUSINESS_ID"
  async
></script>
```

Widget API endpoints:

```text
GET  https://yourdomain.com/api/widget/config?businessId=YOUR_BUSINESS_ID
POST https://yourdomain.com/api/widget/chat
```

Widget deployment notes:

- `/widget.js` sends `Access-Control-Allow-Origin: *`.
- `/api/widget/*` routes send CORS headers for customer sites.
- In production, widget domain allowlists reject localhost origins.
- Ensure each business has `allowed_domains` configured for its real customer domain, or leave empty only when broad embedding is intentional.

## Post-Deployment Testing Checklist

General app:

- [ ] `https://yourdomain.com/` loads.
- [ ] `https://yourdomain.com/login` loads.
- [ ] `/signup` creates a user.
- [ ] `/auth/callback` completes Supabase auth redirects.
- [ ] `/dashboard` redirects anonymous users to `/login`.
- [ ] `/dashboard` loads for an authenticated user.
- [ ] `/admin` redirects anonymous or non-admin users away.
- [ ] `/admin` loads for a user with `profiles.role = 'admin'`.

Widget:

- [ ] `https://yourdomain.com/widget.js` returns JavaScript with status 200.
- [ ] `/api/widget/config?businessId=...` returns config for an enabled widget.
- [ ] `/api/widget/config?businessId=...` rejects disallowed domains.
- [ ] `/api/widget/chat` returns an AI reply for a valid business/widget.
- [ ] Embedded widget loads on a real allowed domain.

Billing:

- [ ] Checkout creates a pending USD Bachs transaction before creating the provider session.
- [ ] Bachs redirects to `/dashboard/billing` with the checkout ID.
- [ ] A provider-confirmed payment updates the matching subscription.
- [ ] Bachs webhook receives and processes the expected checkout/collection events.
- [ ] Duplicate webhook delivery is idempotent.
- [ ] Subscription changes to the selected paid plan.

Email:

- [ ] Resend sender domain is verified.
- [ ] `EMAIL_FROM` uses the verified domain.
- [ ] `RESEND_VERIFIED_DOMAIN` matches the verified sending domain.
- [ ] Welcome, lead notification, booking/support, payment, and usage warning templates render through `/api/admin/email-test`.
- [ ] A production email send succeeds.
- [ ] Email arrives in inbox and does not land in spam during smoke testing.

Security:

- [ ] No server secrets are prefixed with `NEXT_PUBLIC_`.
- [ ] Supabase RLS is enabled and tested with anon/authenticated users.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used in server routes/actions.
- [ ] Admin routes require server-side admin validation.
- [ ] Bachs webhook rejects missing or invalid signatures.
- [ ] Vercel deployment logs do not print provider secrets.
