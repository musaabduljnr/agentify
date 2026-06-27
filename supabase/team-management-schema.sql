-- ══════════════════════════════════════════════════════════════
-- Team Management Schema Migration
-- ══════════════════════════════════════════════════════════════

-- 1. Create business_members table
CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'support', 'sales', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT business_members_business_user_unique UNIQUE (business_id, user_id)
);

-- 2. Create team_invitations table
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'support', 'sales', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 3. Add team_member_limit to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS team_member_limit integer DEFAULT 1;

-- Update existing subscriptions team limit default based on plan
UPDATE public.subscriptions SET team_member_limit = 0 WHERE plan = 'free_trial' AND team_member_limit IS NULL;
UPDATE public.subscriptions SET team_member_limit = 2 WHERE plan = 'starter' AND team_member_limit IS NULL;
UPDATE public.subscriptions SET team_member_limit = 5 WHERE plan = 'growth' AND team_member_limit IS NULL;
UPDATE public.subscriptions SET team_member_limit = 10 WHERE plan = 'business' AND team_member_limit IS NULL;
UPDATE public.subscriptions SET team_member_limit = 999999 WHERE plan = 'enterprise' AND team_member_limit IS NULL;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS business_members_business_id_idx ON public.business_members (business_id);
CREATE INDEX IF NOT EXISTS business_members_user_id_idx ON public.business_members (user_id);
CREATE INDEX IF NOT EXISTS team_invitations_business_id_idx ON public.team_invitations (business_id);
CREATE INDEX IF NOT EXISTS team_invitations_email_idx ON public.team_invitations (email);
CREATE INDEX IF NOT EXISTS team_invitations_token_hash_idx ON public.team_invitations (token_hash);
CREATE INDEX IF NOT EXISTS team_invitations_status_idx ON public.team_invitations (status);

-- Partial index for active pending invitations uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_active_unique_idx 
  ON public.team_invitations (business_id, email) 
  WHERE (status = 'pending');

-- 5. Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER set_business_members_updated_at
  BEFORE UPDATE ON public.business_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_team_invitations_updated_at
  BEFORE UPDATE ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Helper Security Definer Function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_business_role(p_user_id uuid, p_business_id uuid)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_owner_id uuid;
BEGIN
  -- First check if user is the business owner
  SELECT owner_id INTO v_owner_id FROM public.businesses WHERE id = p_business_id;
  IF v_owner_id = p_user_id THEN
    RETURN 'owner';
  END IF;

  -- Otherwise check memberships table
  SELECT role INTO v_role FROM public.business_members
  WHERE business_id = p_business_id AND user_id = p_user_id AND status = 'active';
  
  RETURN v_role;
END;
$$;

-- 7. Enable RLS
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- 8. Policies for business_members
CREATE POLICY "Users can view members of businesses they belong to" ON public.business_members
  FOR SELECT USING (
    public.get_user_business_role(auth.uid(), business_id) IS NOT NULL
  );

CREATE POLICY "Owners and admins can manage members" ON public.business_members
  FOR ALL USING (
    public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'admin')
  );

-- 9. Policies for team_invitations
CREATE POLICY "Owners and admins can view invitations for their business" ON public.team_invitations
  FOR SELECT USING (
    public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (
    public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can update/revoke invitations" ON public.team_invitations
  FOR UPDATE USING (
    public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'admin')
  );

-- 10. Automatically insert business owner as a member
CREATE OR REPLACE FUNCTION public.handle_new_business_owner()
RETURNS trigger AS $$
BEGIN
  IF new.owner_id IS NOT NULL THEN
    INSERT INTO public.business_members (business_id, user_id, role, status)
    VALUES (new.id, new.owner_id, 'owner', 'active')
    ON CONFLICT (business_id, user_id) DO UPDATE
    SET role = 'owner', status = 'active';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_business_created
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_business_owner();

-- 11. Backfill existing business owners
INSERT INTO public.business_members (business_id, user_id, role, status)
SELECT id, owner_id, 'owner', 'active'
FROM public.businesses
WHERE owner_id IS NOT NULL
ON CONFLICT (business_id, user_id) DO UPDATE
SET role = 'owner', status = 'active';
