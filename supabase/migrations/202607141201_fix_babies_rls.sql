-- Drop policies on babies that use the recursive has_baby_access helper
DROP POLICY IF EXISTS "Caregivers can view baby details" ON public.babies;
DROP POLICY IF EXISTS "Caregivers can update baby details" ON public.babies;
DROP POLICY IF EXISTS "Baby owners can insert babies" ON public.babies;
DROP POLICY IF EXISTS "Baby owners can delete babies" ON public.babies;

-- Re-create policies using direct checks to prevent RLS insert/select constraint failures
CREATE POLICY "Caregivers can view baby details"
  ON public.babies FOR SELECT
  USING (
    auth.uid() = profile_id OR 
    EXISTS (
      SELECT 1 FROM public.baby_shares 
      WHERE baby_shares.baby_id = babies.id 
      AND baby_shares.profile_id = auth.uid() 
      AND baby_shares.status = 'accepted'
    )
  );

CREATE POLICY "Baby owners can insert babies"
  ON public.babies FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Caregivers can update baby details"
  ON public.babies FOR UPDATE
  USING (
    auth.uid() = profile_id OR 
    EXISTS (
      SELECT 1 FROM public.baby_shares 
      WHERE baby_shares.baby_id = babies.id 
      AND baby_shares.profile_id = auth.uid() 
      AND baby_shares.status = 'accepted'
    )
  )
  WITH CHECK (
    auth.uid() = profile_id OR 
    EXISTS (
      SELECT 1 FROM public.baby_shares 
      WHERE baby_shares.baby_id = babies.id 
      AND baby_shares.profile_id = auth.uid() 
      AND baby_shares.status = 'accepted'
    )
  );

CREATE POLICY "Baby owners can delete babies"
  ON public.babies FOR DELETE
  USING (auth.uid() = profile_id);
