-- Migration: New Pricing System & Demo AI Reply Count Limit
-- Date: 2026-10-30
-- Description:
-- 1. Adds demo_ai_reply_count to demo_businesses for strict 9-AI-reply limit.
-- 2. Creates increment_demo_ai_reply_count RPC.
-- 3. Migrates legacy free_trial subscriptions to starter with pending status.

-- 1. Add demo_ai_reply_count column if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'demo_businesses'
      AND column_name = 'demo_ai_reply_count'
  ) THEN
    ALTER TABLE public.demo_businesses
    ADD COLUMN demo_ai_reply_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. RPC to atomically increment demo_ai_reply_count upon successful AI generation
CREATE OR REPLACE FUNCTION public.increment_demo_ai_reply_count(p_demo_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.demo_businesses
  SET demo_ai_reply_count = COALESCE(demo_ai_reply_count, 0) + 1,
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = p_demo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Migrate legacy free_trial subscriptions to starter plan with pending status
-- Users previously on free_trial are transitioned cleanly without data loss.
UPDATE public.subscriptions
SET plan = 'starter',
    status = 'pending',
    updated_at = NOW()
WHERE plan = 'free_trial';
