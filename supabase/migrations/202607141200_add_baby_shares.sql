-- Create baby_shares table for co-parenting and caregiver access
CREATE TABLE public.baby_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Nullable until invite is accepted
  email TEXT NOT NULL,
  access_role TEXT NOT NULL DEFAULT 'caregiver' CHECK (access_role IN ('admin', 'caregiver')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX baby_shares_baby_id_email_idx ON public.baby_shares (baby_id, LOWER(email));
CREATE INDEX baby_shares_profile_id_idx ON public.baby_shares (profile_id);

CREATE TRIGGER set_baby_shares_updated_at
  BEFORE UPDATE ON public.baby_shares
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Reusable Security Definer helper to check baby access levels (avoids RLS recursion loops)
CREATE OR REPLACE FUNCTION public.has_baby_access(baby_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.babies
    WHERE babies.id = baby_uuid
    AND (
      babies.profile_id = user_uuid
      OR EXISTS (
        SELECT 1 FROM public.baby_shares
        WHERE baby_shares.baby_id = baby_uuid
        AND baby_shares.profile_id = user_uuid
        AND baby_shares.status = 'accepted'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on baby_shares
ALTER TABLE public.baby_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Baby owners can insert baby shares"
  ON public.baby_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.babies
      WHERE babies.id = baby_shares.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Baby owners and invitees can view baby shares"
  ON public.baby_shares
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.babies
      WHERE babies.id = baby_shares.baby_id
      AND babies.profile_id = auth.uid()
    ) OR 
    profile_id = auth.uid() OR
    LOWER(email) = LOWER(auth.jwt() ->> 'email')
  );

CREATE POLICY "Owners and invitees can update baby shares"
  ON public.baby_shares
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.babies
      WHERE babies.id = baby_shares.baby_id
      AND babies.profile_id = auth.uid()
    ) OR 
    LOWER(email) = LOWER(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.babies
      WHERE babies.id = baby_shares.baby_id
      AND babies.profile_id = auth.uid()
    ) OR 
    (LOWER(email) = LOWER(auth.jwt() ->> 'email') AND profile_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "Baby owners can delete baby shares"
  ON public.baby_shares
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.babies
      WHERE babies.id = baby_shares.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

-- Drop old single-user RLS policies
DROP POLICY IF EXISTS "Users can view their own babies" ON public.babies;
DROP POLICY IF EXISTS "Users can insert their own babies" ON public.babies;
DROP POLICY IF EXISTS "Users can update their own babies" ON public.babies;
DROP POLICY IF EXISTS "Users can delete their own babies" ON public.babies;

DROP POLICY IF EXISTS "Users can view onboarding preferences for their babies" ON public.onboarding_preferences;
DROP POLICY IF EXISTS "Users can insert onboarding preferences for their babies" ON public.onboarding_preferences;
DROP POLICY IF EXISTS "Users can update onboarding preferences for their babies" ON public.onboarding_preferences;

DROP POLICY IF EXISTS "Users can view sleep logs for their babies" ON public.sleep_logs;
DROP POLICY IF EXISTS "Users can insert sleep logs for their babies" ON public.sleep_logs;
DROP POLICY IF EXISTS "Users can update sleep logs for their babies" ON public.sleep_logs;
DROP POLICY IF EXISTS "Users can delete sleep logs for their babies" ON public.sleep_logs;

DROP POLICY IF EXISTS "Users can view daily plans for their babies" ON public.daily_plans;
DROP POLICY IF EXISTS "Users can insert daily plans for their babies" ON public.daily_plans;
DROP POLICY IF EXISTS "Users can update daily plans for their babies" ON public.daily_plans;
DROP POLICY IF EXISTS "Users can delete daily plans for their babies" ON public.daily_plans;

DROP POLICY IF EXISTS "Users can view sleep plan profiles for their babies" ON public.sleep_plan_profiles;
DROP POLICY IF EXISTS "Users can insert sleep plan profiles for their babies" ON public.sleep_plan_profiles;
DROP POLICY IF EXISTS "Users can update sleep plan profiles for their babies" ON public.sleep_plan_profiles;
DROP POLICY IF EXISTS "Users can delete sleep plan profiles for their babies" ON public.sleep_plan_profiles;

DROP POLICY IF EXISTS "Users can view sleep plan change events for their babies" ON public.sleep_plan_change_events;
DROP POLICY IF EXISTS "Users can insert sleep plan change events for their babies" ON public.sleep_plan_change_events;

-- Re-create shared access RLS policies using public.has_baby_access()

-- babies
CREATE POLICY "Caregivers can view baby details"
  ON public.babies
  FOR SELECT
  USING (public.has_baby_access(id, auth.uid()));

CREATE POLICY "Baby owners can insert babies"
  ON public.babies
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Caregivers can update baby details"
  ON public.babies
  FOR UPDATE
  USING (public.has_baby_access(id, auth.uid()))
  WITH CHECK (public.has_baby_access(id, auth.uid()));

CREATE POLICY "Baby owners can delete babies"
  ON public.babies
  FOR DELETE
  USING (auth.uid() = profile_id);

-- onboarding_preferences
CREATE POLICY "Caregivers can view onboarding preferences"
  ON public.onboarding_preferences
  FOR SELECT
  USING (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can insert onboarding preferences"
  ON public.onboarding_preferences
  FOR INSERT
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can update onboarding preferences"
  ON public.onboarding_preferences
  FOR UPDATE
  USING (public.has_baby_access(baby_id, auth.uid()))
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

-- sleep_logs
CREATE POLICY "Caregivers can view sleep logs"
  ON public.sleep_logs
  FOR SELECT
  USING (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can insert sleep logs"
  ON public.sleep_logs
  FOR INSERT
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can update sleep logs"
  ON public.sleep_logs
  FOR UPDATE
  USING (public.has_baby_access(baby_id, auth.uid()))
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can delete sleep logs"
  ON public.sleep_logs
  FOR DELETE
  USING (public.has_baby_access(baby_id, auth.uid()));

-- daily_plans
CREATE POLICY "Caregivers can view daily plans"
  ON public.daily_plans
  FOR SELECT
  USING (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can insert daily plans"
  ON public.daily_plans
  FOR INSERT
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can update daily plans"
  ON public.daily_plans
  FOR UPDATE
  USING (public.has_baby_access(baby_id, auth.uid()))
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can delete daily plans"
  ON public.daily_plans
  FOR DELETE
  USING (public.has_baby_access(baby_id, auth.uid()));

-- sleep_plan_profiles
CREATE POLICY "Caregivers can view sleep plan profiles"
  ON public.sleep_plan_profiles
  FOR SELECT
  USING (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can insert sleep plan profiles"
  ON public.sleep_plan_profiles
  FOR INSERT
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can update sleep plan profiles"
  ON public.sleep_plan_profiles
  FOR UPDATE
  USING (public.has_baby_access(baby_id, auth.uid()))
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can delete sleep plan profiles"
  ON public.sleep_plan_profiles
  FOR DELETE
  USING (public.has_baby_access(baby_id, auth.uid()));

-- sleep_plan_change_events
CREATE POLICY "Caregivers can view sleep plan change events"
  ON public.sleep_plan_change_events
  FOR SELECT
  USING (public.has_baby_access(baby_id, auth.uid()));

CREATE POLICY "Caregivers can insert sleep plan change events"
  ON public.sleep_plan_change_events
  FOR INSERT
  WITH CHECK (public.has_baby_access(baby_id, auth.uid()));
