-- Admin privileges and support-ticket access controls

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_admin IS
  'Controls access to internal Somni administration features.';

-- Seed the main developer account supplied for this environment.
UPDATE public.profiles
SET is_admin = TRUE
WHERE id = '7490d01c-13d0-497b-974c-e9be76bf157b'::UUID;

-- RLS controls which profile rows a user may update, but it does not restrict
-- individual columns. Replace the broad table-level UPDATE privilege with the
-- ordinary profile fields that signed-in users are allowed to maintain. This
-- prevents a user from promoting their own profile by changing is_admin.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (email, full_name, timezone, onboarding_completed)
  ON TABLE public.profiles
  TO authenticated;

-- Keep the RLS helper outside the API-exposed public schema. SECURITY DEFINER
-- lets the helper read the caller's profile without being blocked by profile
-- RLS, while the empty search path avoids object-shadowing attacks.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND is_admin = TRUE
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Normal signed-in users may submit a ticket for their own profile, but they
-- may no longer read previously submitted tickets.
DROP POLICY IF EXISTS "Users can view their own support tickets"
  ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert their own support tickets"
  ON public.support_tickets;
DROP POLICY IF EXISTS "Authenticated users can submit support tickets"
  ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all support tickets"
  ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all support tickets"
  ON public.support_tickets;

CREATE POLICY "Authenticated users can submit support tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Admins can view all support tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin()));

CREATE POLICY "Admins can update all support tickets"
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

