# Subscription Access and Quota Implementation

## Implemented

- Added a server-only subscription entitlement resolver. Paid access now requires a recognized plan, `active` status, a non-expired billing period, and a successful subscription lookup. Plan display fallbacks are not used to authorize unknown plans.
- Added atomic quota reservation, completion, and release RPCs for AI messages, embeddings, knowledge sources, leads, assistants, and team members. Message and widget reservations share a lock and enforce both monthly and UTC daily limits. Existing plan limits are preserved.
- Applied server checks to AI chat, assistant changes, knowledge creation and processing, embedding generation, lead capture, team invitations/reactivation/acceptance, and public widget configuration.
- Removed AI generation from the exported server-action surface; dashboard actions and validated widget/demo routes now call the server-only chat runner.
- Kept demo generation separate from paid entitlements. Moved embedding implementation into a server-only helper and bound source lookup and chunk mutations to the requested business.
- Added database access controls: authenticated users can only create their own pending Starter subscription; they cannot directly update/delete subscriptions or write usage logs. Quota RPCs are executable only by `service_role`.
- Updated admin subscription-limit writes so daily and team limits are stored in the columns enforced by the quota RPCs.
- Added unit coverage for missing, pending, expired, unknown, Starter, Growth, database-error, and denied-quota cases.

## Validation

- `tsc --noEmit` — passed.
- Focused billing, entitlement, widget, demo, and playground tests — 29 passed.
- ESLint on changed TypeScript files — passed with existing warnings; no lint errors.

## Deployment and verification limits

The additive migration is [20261103000000_subscription_access_and_quotas.sql](../supabase/migrations/20261103000000_subscription_access_and_quotas.sql). It has **not** been applied or verified against the production Supabase database in this work. Production enforcement depends on applying it successfully; do not claim the new database controls are live before checking the migration ledger and validating the RPCs and policies against the deployed schema.

The quota RPC has unit-level caller coverage but no live PostgreSQL concurrency test. Verify simultaneous reservations in a staging database before rollout. Existing production data, historical RLS policies, and payment-provider state were not accessible for verification.
