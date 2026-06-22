-- ==========================================================
-- Notifications Schema & Row-Level Security (RLS) Policies
-- ==========================================================

-- 1. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_new_leads BOOLEAN DEFAULT TRUE,
  email_support_requests BOOLEAN DEFAULT TRUE,
  email_booking_requests BOOLEAN DEFAULT TRUE,
  email_usage_warnings BOOLEAN DEFAULT TRUE,
  email_payment_updates BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage their own notification preferences." ON public.notification_preferences;

-- 4. Create comprehensive manage policy for authenticated users
CREATE POLICY "Users can manage their own notification preferences." ON public.notification_preferences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = notification_preferences.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS set_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at 
  BEFORE UPDATE ON public.notification_preferences 
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
