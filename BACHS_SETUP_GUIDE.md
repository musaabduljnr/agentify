# Agentify — Production Bachs Billing Setup Guide (Vercel & Supabase)

This guide provides the exact production deployment and configuration steps for Agentify using **Vercel** for hosting, **Supabase** for the database, and **Bachs** for USD subscription billing.

---

## Architecture Overview

```
   [User Browser]
         │
         ▼
  [Vercel Frontend / Next.js API]
   ├── /pricing ───────────────► Displays $2/mo & $10/mo USD plans
   ├── /api/payments/checkout ─► Creates Bachs checkout session
   ├── /api/billing/portal ────► Creates Bachs customer portal session
   └── /api/webhooks/bachs ◄─── Receives async webhook events from Bachs
         │                              │
         ▼                              ▼
  [Supabase Database] ◄─────────────────┘ (Service Role Client updates
   ├── subscriptions                       subscriptions, transactions,
   ├── payment_transactions                and webhook_events)
   └── platform_settings
```

---

## Production Setup Checklist

| Phase | Step | Target Platform | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Run SQL Migration | Supabase SQL Editor | ⏳ Action Required |
| **Phase 2** | Obtain Production Credentials | Bachs Dashboard | ⏳ Action Required |
| **Phase 3** | Provision Live Subscription Products | Local Terminal (`npm run bachs:setup`) | ⏳ Action Required |
| **Phase 4** | Configure Environment Variables | Vercel Project Settings | ⏳ Action Required |
| **Phase 5** | Register Live Webhook Endpoint | Bachs Webhook Dashboard | ⏳ Action Required |
| **Phase 6** | Redeploy & Live Smoke Test | Vercel & Production URL | ⏳ Action Required |

---

## Phase 1: Apply Migration to Production Supabase

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your production project.
3. In the left navigation, click on **SQL Editor** (icon: `>_`).
4. Click **+ New Query**.
5. Copy the entire contents of `supabase/migrations/20261031000000_bachs_billing_migration.sql` from the repository and paste it into the editor.
6. Click the green **Run** button (or press `Ctrl+Enter` / `Cmd+Enter`).
7. Confirm the response reads: `Success. No rows returned`.

### Quick Database Verification:
In the **Table Editor**:
- **`public.subscriptions`**: Verify columns `bachs_customer_id`, `bachs_subscription_id`, `bachs_product_id`, `billing_currency`, and `billing_amount` exist.
- **`public.payment_transactions`**: Verify columns `checkout_id`, `charge_id`, and `invoice_id` exist.
- **`public.platform_settings`**: In the row with `key = 'billing'`, verify `value` contains:
  ```json
  {"currency": "USD", "currency_symbol": "$", "default_payment_provider": "bachs"}
  ```

---

## Phase 2: Obtain Live Bachs Credentials

1. Sign in to your **[Bachs Dashboard](https://bachs.co)**.
2. Ensure you are in **Live Mode** (toggle at the top or in settings if applicable).
3. Navigate to **Developers** > **API Keys**.
4. Generate or copy your **Secret API Key** (`bachs_live_...` or your assigned key format).
5. Navigate to **Developers** > **Webhooks** (keep this tab open for Phase 5).

---

## Phase 3: Provision Live Subscription Products in Bachs

We created an automated provisioning script (`scripts/setup-bachs-products.ts`) that calls the Bachs SDK to configure the exact Starter and Growth recurring subscription products.

Run this script once locally using your live Bachs API key:

### On Windows PowerShell:
```powershell
$env:BACHS_API_KEY="your_live_bachs_api_key_here"
npm run bachs:setup
```

### On Mac/Linux:
```bash
BACHS_API_KEY="your_live_bachs_api_key_here" npm run bachs:setup
```

### Expected Output:
```
Connected to Bachs SDK...
Creating Starter plan ($2.00/month USD)...
Created Starter product: prod_starter_abc123xyz
Creating Growth plan ($10.00/month USD)...
Created Growth product: prod_growth_def456uvw

Done! Copy these into your Vercel Environment Variables:
BACHS_STARTER_PRODUCT_ID=prod_starter_abc123xyz
BACHS_GROWTH_PRODUCT_ID=prod_growth_def456uvw
```

> 📌 **Save the two generated Product IDs.** You will need them in Phase 4.

---

## Phase 4: Configure Environment Variables in Vercel

1. Open your **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Select your **Agentify** project.
3. Go to **Settings** > **Environment Variables**.
4. Add or update the following environment variables (enable for **Production** and **Preview**):

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `BACHS_API_KEY` | `your_live_bachs_api_key` | Secret key for checkout sessions & portal |
| `BACHS_WEBHOOK_SECRET` | `your_live_webhook_secret` | Validates HMAC signature on incoming webhooks |
| `BACHS_STARTER_PRODUCT_ID` | `prod_starter_...` *(from Phase 3)* | Bachs Product ID for $2/mo Starter plan |
| `BACHS_GROWTH_PRODUCT_ID` | `prod_growth_...` *(from Phase 3)* | Bachs Product ID for $10/mo Growth plan |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | Base URL for checkout success & cancel redirects |

> **Important:** Also verify that your Supabase production keys are present in Vercel:
> - `NEXT_PUBLIC_SUPABASE_URL`
> - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> - `SUPABASE_SERVICE_ROLE_KEY` *(Required for webhook processing & bypasses RLS)*

---

## Phase 5: Register Live Webhook Endpoint in Bachs

1. In your **Bachs Dashboard**, go to **Developers** > **Webhooks**.
2. Click **Create Webhook** or **Add Endpoint**.
3. Set the **Endpoint URL** to:
   ```
   https://your-domain.com/api/webhooks/bachs
   ```
   *(Replace `your-domain.com` with your production domain or Vercel production URL, e.g., `https://agentify.vercel.app/api/webhooks/bachs`)*.
4. Select the events to listen for:
   - ✅ `checkout.session.completed`
   - ✅ `subscription.created`
   - ✅ `subscription.updated`
   - ✅ `subscription.canceled`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
5. Copy the generated **Webhook Signing Secret**.
6. Ensure this secret matches the `BACHS_WEBHOOK_SECRET` set in Vercel in Phase 4.

---

## Phase 6: Trigger Redeployment & Smoke Test

### 1. Trigger Vercel Redeployment
To apply the new environment variables to all running serverless functions:
1. In Vercel, go to the **Deployments** tab.
2. Click the three dots (`...`) on your latest deployment.
3. Select **Redeploy**.

---

### 2. Live Smoke Test Checklist

#### Test 1: Public Pricing Page
- Open `https://your-domain.com/pricing`.
- Check:
  - Starter shows **$2 / month**.
  - Growth shows **$10 / month**.
  - No Nigerian Naira (NGN) toggle is present.
  - Clicking **Get Started** redirects unauthenticated users to `/sign-up?plan=starter` or `/sign-up?plan=growth`.

#### Test 2: In-App Billing Dashboard Checkout
- Log into your production app as a standard user.
- Navigate to `/dashboard/billing`.
- Check:
  - Current plan displays with limits (Starter: 200 replies, Growth: 1,500 replies).
  - Click **Upgrade** on a plan.
  - Verify redirection to the secure **Bachs Hosted Checkout** page in USD.
  - Complete a test payment.
  - Verify redirect back to `/dashboard/billing?status=success`.

#### Test 3: Webhook Verification
- Open your Supabase Dashboard:
  - Table **`public.webhook_events`**: Confirm a record exists with `provider = 'bachs'` and `status = 'processed'`.
  - Table **`public.payment_transactions`**: Confirm transaction status is `'success'` with `currency = 'USD'`.
  - Table **`public.subscriptions`**: Confirm the business subscription has `status = 'active'`, `plan = 'starter'` or `'growth'`, and `bachs_customer_id` is saved.

#### Test 4: Customer Portal
- In `/dashboard/billing`, click **Manage Subscription**.
- Confirm that you are redirected to the Bachs self-serve Customer Portal (for updating cards, downloading invoices, or cancellation).

---

## Production Security & Architecture Notes

- **Content-Security-Policy (CSP)**: `next.config.ts` is pre-configured with script and frame directives allowing `https://*.bachs.co` and `https://bachs.co`.
- **Signature Verification**: Every incoming webhook at `/api/webhooks/bachs` verifies the Bachs cryptographic signature using `BACHS_WEBHOOK_SECRET` before updating data.
- **Idempotency**: Webhook events are checked against `public.webhook_events` to ensure duplicate webhook deliveries are safely ignored.
- **RLS Safety**: The webhook route uses the Supabase Service Role client (`SUPABASE_SERVICE_ROLE_KEY`) so database updates execute reliably without requiring user cookies.
