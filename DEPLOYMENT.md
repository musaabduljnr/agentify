# Agentify Production Deployment

This guide prepares Agentify for production deployment on Vercel with Supabase, Gemini, optional OpenRouter fallback, Paystack, Resend, and the embeddable widget.

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
| `PAYSTACK_SECRET_KEY` | Server only | Paystack secret key for transaction initialize/verify. |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Public | Paystack public key. Safe for browser use. |
| `PAYSTACK_WEBHOOK_SECRET` | Server only | Webhook signing secret used for HMAC verification. If Paystack only provides one secret, use the Paystack secret key value here too. |
| `PAYSTACK_STARTER_PLAN_CODE` | Server only | Paystack plan code for the Starter subscription. |
| `PAYSTACK_GROWTH_PLAN_CODE` | Server only | Paystack plan code for the Growth subscription. |
| `RESEND_API_KEY` | Server only | Resend API key for transactional email. |
| `EMAIL_FROM` | Public email value | Verified sender, for example `Agentify <hello@yourdomain.com>`. |
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
- `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` if used, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, and `RESEND_API_KEY` must stay server-only.
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

## Paystack Setup

Create production Paystack products/plans:

- Starter plan -> copy the plan code into `PAYSTACK_STARTER_PLAN_CODE`.
- Growth plan -> copy the plan code into `PAYSTACK_GROWTH_PLAN_CODE`.

Configure callback URL:

```text
https://yourdomain.com/payment/callback
```

Configure webhook URL:

```text
https://yourdomain.com/api/webhooks/paystack
```

Required Paystack webhook events:

- `charge.success`
- `subscription.create`
- `subscription.disable`
- `invoice.payment_failed`
- `invoice.update`

Webhook security:

- The route reads the raw request body and validates `x-paystack-signature`.
- Set `PAYSTACK_WEBHOOK_SECRET` to the signing secret. If Paystack signs with the account secret key in your setup, set `PAYSTACK_WEBHOOK_SECRET` to the same value as `PAYSTACK_SECRET_KEY`.
- Keep `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` server-only in Vercel.

Payment verification paths:

- Checkout server action initializes Paystack with callback URL from `NEXT_PUBLIC_APP_URL`.
- Callback page verifies `reference` or `trxref`.
- Webhook route independently verifies successful charges and updates subscriptions idempotently.

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
   - `SUPPORT_EMAIL`, for example `support@yourdomain.com`
6. Send a test transactional email from production and confirm inbox delivery.

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

- [ ] Checkout creates a Paystack transaction.
- [ ] Paystack redirects to `https://yourdomain.com/payment/callback`.
- [ ] Callback verifies `reference` or `trxref`.
- [ ] Paystack webhook receives `charge.success`.
- [ ] Duplicate webhook delivery is idempotent.
- [ ] Subscription changes to the selected paid plan.

Email:

- [ ] Resend sender domain is verified.
- [ ] `EMAIL_FROM` uses the verified domain.
- [ ] A production email send succeeds.
- [ ] Email arrives in inbox and does not land in spam during smoke testing.

Security:

- [ ] No server secrets are prefixed with `NEXT_PUBLIC_`.
- [ ] Supabase RLS is enabled and tested with anon/authenticated users.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used in server routes/actions.
- [ ] Admin routes require server-side admin validation.
- [ ] Paystack webhook rejects missing or invalid signatures.
- [ ] Vercel deployment logs do not print provider secrets.
