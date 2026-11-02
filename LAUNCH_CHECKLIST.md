# Agentify Launch Checklist

Use this after the production deployment is live. Test with a real production domain, real Supabase project, real Resend sender, and Bachs sandbox credentials before enabling live payments.

## Core Auth

- [ ] Signup
- [ ] Login
- [ ] Password reset
- [ ] Email confirmation flow
- [ ] Onboarding

## Product Workflows

- [ ] AI Playground
- [ ] Website scraping
- [ ] Document uploads
- [ ] Embeddings
- [ ] Widget embed
- [ ] Hosted chat page
- [ ] Hosted chat sharing
- [ ] Public widget testing
- [ ] Lead capture
- [ ] Analytics
- [ ] Billing
- [ ] Admin dashboard
- [ ] AI provider switching

## Email

- [ ] Resend sending domain verified
- [ ] `EMAIL_FROM` uses verified domain
- [ ] Welcome email
- [ ] Lead notification email
- [ ] Booking/support email
- [ ] Payment email
- [ ] Usage warning email
- [ ] Email failures log safely and do not break app flow

## Payments

- [ ] Bachs hosted checkout opens in USD
- [ ] An open checkout is reused instead of creating a duplicate
- [ ] Bachs webhook rejects invalid signatures
- [ ] A completed checkout with `no_payment_required` does not activate a paid plan
- [ ] A provider-confirmed payment activates the matching plan and limits
- [ ] Duplicate and out-of-order Bachs events are handled idempotently

## Supabase

- [ ] RLS enabled on sensitive tables
- [ ] Storage bucket policies correct
- [ ] `pgvector` enabled
- [ ] Auth redirect URLs correct
- [ ] Production auth templates correct
- [ ] Service role key never exposed
- [ ] No unsafe public queries
- [ ] Admin service actions protected

## Security And Performance

- [ ] Production build
- [ ] Mobile responsiveness
- [ ] Rate limits
- [ ] Allowed domain validation
- [ ] Hosted chat APIs safe
- [ ] Widget APIs rate limited
- [ ] Payment routes protected
- [ ] CSP headers present
- [ ] CORS handling correct for widget APIs
- [ ] File upload validation
- [ ] Prompt injection resistance smoke test
- [ ] No localhost URLs in production UI or env
- [ ] No debug logs in production responses
- [ ] No secrets exposed in browser bundle or logs
