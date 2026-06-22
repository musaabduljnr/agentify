-- ==========================================================
-- Migration: Add support_email to businesses table
-- Purpose: Stores a custom notification recipient email per
--          business, separate from the general contact_email.
--          Used by the Notification Center to route all
--          Agentify alert emails to the right inbox.
-- ==========================================================

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS support_email TEXT;

-- Optional: add a comment for clarity in the DB
COMMENT ON COLUMN public.businesses.support_email IS
  'Custom email for Agentify notifications (leads, support, billing alerts). Falls back to contact_email or owner profile email if NULL.';
