# Agentify — Bachs Billing Setup Guide

This guide details all remaining steps to complete the migration and configure Bachs billing in your Agentify deployment.

---

## Overview Checklist

| Step | Action | Status |
| :--- | :--- | :--- |
| **1** | Apply Supabase Database Migration | ⏳ Pending |
| **2** | Add Bachs API Credentials to Environment | ⏳ Pending |
| **3** | Provision Products in Bachs (`npm run bachs:setup`) | ⏳ Pending |
| **4** | Configure Product IDs in Environment | ⏳ Pending |
| **5** | Register Webhook Endpoint in Bachs Dashboard | ⏳ Pending |
| **6** | Verify Checkout & Customer Portal Flows | ⏳ Pending |

---

## Step 1: Apply Supabase Database Migration

Execute the migration file against your Supabase project.

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project and navigate to the **SQL Editor**.
3. Open or copy the entire contents of:
   ```
   supabase/migrations/20261031000000_bachs_billing_migration.sql
   ```
4. Click **Run**.
5. Confirm that the query executes successfully with `Success. No rows returned`.

> **What this migration does:**
> - Adds `bachs_customer_id`, `bachs_subscription_id`, `bachs_product_id`, `billing_currency`, and `billing_amount` to `public.subscriptions`.
> - Adds `checkout_id`, `charge_id`, `invoice_id` to `public.payment_transactions`.
> - Updates constraint checks to support `bachs` as payment provider.
> - Updates platform billing settings to USD currency (`$`) and Bachs as default provider.

---

## Step 2: Add Bachs API Credentials to Environment

1. Log in to your **[Bachs Dashboard](https://bachs.co)**.
2. Navigate to **Developers** or **API Keys**.
3. Obtain your API Key and Webhook Signing Secret.
4. Add them to your local environment file (`.env.local`) and your hosting provider (e.g. Vercel):

```env
# Bachs API & Webhooks
BACHS_API_KEY=your_bachs_api_key_here
BACHS_WEBHOOK_SECRET=your_bachs_webhook_signing_secret_here

# App Base URL (used for success and cancel redirect URLs)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **For Production:** Replace `NEXT_PUBLIC_APP_URL` with your live domain: `https://agentify.co` (or your domain).

---

## Step 3: Provision Starter & Growth Products

We have included an automated provisioning script: `scripts/setup-bachs-products.ts`.

Run the setup command in your terminal:

```bash
npm run bachs:setup
```

### What this script does:
1. Connects to Bachs using your `BACHS_API_KEY`.
2. Creates the **Starter** subscription product:
   - **Price**: `$2.00 / month` (USD)
3. Creates the **Growth** subscription product:
   - **Price**: `$10.00 / month` (USD)
4. Displays the generated product IDs in your terminal.

---

## Step 4: Configure Product IDs in Environment

Copy the product IDs returned by the setup script and add them to your `.env.local` (and production environment):

```env
# Bachs Product IDs (Generated from Step 3)
BACHS_STARTER_PRODUCT_ID=prod_starter_xxxxxxxxxxxx
BACHS_GROWTH_PRODUCT_ID=prod_growth_xxxxxxxxxxxx
```

Restart your Next.js development server (or trigger a redeploy on Vercel) so the new environment variables take effect:

```bash
npm run dev
```

---

## Step 5: Register Webhook Endpoint in Bachs Dashboard

Bachs sends webhooks for checkout completion, invoice status, and subscription updates.

1. Go to your **Bachs Dashboard** > **Developers** > **Webhooks**.
2. Click **Add Endpoint** (or **New Webhook**).
3. Set the **Endpoint URL**:
   - **Production:** `https://your-domain.com/api/webhooks/bachs`
   - **Local Testing:** Use a tunnel URL such as `https://xxxx.ngrok-free.app/api/webhooks/bachs`
4. Subscribe to the following webhook events:
   - `checkout.session.completed`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing Secret** provided by Bachs and ensure it matches `BACHS_WEBHOOK_SECRET` in your environment.

---

## Step 6: Verify End-to-End Flows

### 1. Test Public Pricing Page (`/pricing`)
- Visit `http://localhost:3000/pricing` (or production URL).
- Verify:
  - **Starter**: `$2/month`
  - **Growth**: `$10/month`
  - No NGN currency toggles appear.
  - Clicking **Get Started** redirects unauthenticated users to `/sign-up?plan=starter` or `/sign-up?plan=growth`.
  - For logged-in users, clicking upgrades opens the Bachs checkout session.

### 2. Test Dashboard Billing Page (`/dashboard/billing`)
- Log in to your dashboard and navigate to **Billing**.
- Verify:
  - Current plan displays accurately.
  - Usage cards reflect USD limits (e.g., 200 replies for Starter, 1,500 replies for Growth).
  - Clicking **Upgrade** initiates a Bachs checkout session.
  - Clicking **Manage Subscription** opens the Bachs Customer Portal.

### 3. Verify Webhook Reconciliation
- After completing a test checkout:
  - Check the Supabase `payment_transactions` table to confirm the record status changed from `pending` to `success`.
  - Check the `subscriptions` table to confirm `plan` updated to `'starter'` or `'growth'`, `status` is `'active'`, and `bachs_customer_id` is populated.

---

## Troubleshooting & FAQ

#### Q: How do I reconfigure plan limits or override product IDs dynamically?
You can navigate to `/admin/settings` in your Agentify dashboard. Admins can update:
- Platform default currency (`USD`)
- Provider (`bachs` / `manual`)
- Bachs Product IDs per plan
- Plan quotas and feature bullet points

#### Q: Where are webhook failures logged?
All incoming webhook events are recorded in the `public.webhook_events` table with:
- `status`: `'processed'` or `'failed'`
- `error_details`: Exception details if processing failed
- `payload`: The raw JSON event received from Bachs
