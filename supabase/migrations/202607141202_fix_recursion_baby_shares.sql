-- Create is_baby_owner Security Definer helper to query babies table without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_baby_owner(baby_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.babies
    WHERE babies.id = baby_uuid
    AND babies.profile_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old baby_shares RLS policies that query public.babies directly
DROP POLICY IF EXISTS "Baby owners can insert baby shares" ON public.baby_shares;
DROP POLICY IF EXISTS "Baby owners and invitees can view baby shares" ON public.baby_shares;
DROP POLICY IF EXISTS "Owners and invitees can update baby shares" ON public.baby_shares;
DROP POLICY IF EXISTS "Baby owners can delete baby shares" ON public.baby_shares;

-- Recreate policies on baby_shares using is_baby_owner helper to break recursion loops
CREATE POLICY "Baby owners can insert baby shares"
  ON public.baby_shares FOR INSERT
  WITH CHECK (public.is_baby_owner(baby_id, auth.uid()));

CREATE POLICY "Baby owners and invitees can view baby shares"
  ON public.baby_shares FOR SELECT
  USING (
    public.is_baby_owner(baby_id, auth.uid()) OR 
    profile_id = auth.uid() OR
    LOWER(email) = LOWER(auth.jwt() ->> 'email')
  );

CREATE POLICY "Owners and invitees can update baby shares"
  ON public.baby_shares FOR UPDATE
  USING (
    public.is_baby_owner(baby_id, auth.uid()) OR 
    LOWER(email) = LOWER(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    public.is_baby_owner(baby_id, auth.uid()) OR 
    (LOWER(email) = LOWER(auth.jwt() ->> 'email') AND profile_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "Baby owners can delete baby shares"
  ON public.baby_shares FOR DELETE
  USING (public.is_baby_owner(baby_id, auth.uid()));
