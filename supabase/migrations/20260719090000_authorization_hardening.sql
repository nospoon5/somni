-- Stage 7 authorization hardening.
--
-- This migration closes two privilege-escalation paths:
--   1. invitees could accept or alter a share through a direct table UPDATE;
--   2. an accepted caregiver could change babies.profile_id and become owner.
--
-- Invite acceptance is now a single database operation. The RPC validates the
-- signed-in identity, invitation state, expiry, and raw token hash before it
-- changes any data. Baby ownership is immutable outside a future, dedicated
-- transfer workflow.

-- The product currently has one delegated role. Normalize any legacy "admin"
-- rows before narrowing the database constraint, so the UI cannot imply a
-- permission level that the authorization model does not implement.
UPDATE public.baby_shares
SET access_role = 'caregiver'
WHERE access_role IS DISTINCT FROM 'caregiver';

ALTER TABLE public.baby_shares
  DROP CONSTRAINT IF EXISTS baby_shares_access_role_check;

ALTER TABLE public.baby_shares
  ADD CONSTRAINT baby_shares_access_role_check
  CHECK (access_role = 'caregiver');

ALTER TABLE public.baby_shares
  DROP CONSTRAINT IF EXISTS baby_shares_invite_token_hash_format_check;

-- Normalize hashes produced by older clients. Any malformed stored value is
-- unusable as proof of possession, so expire it instead of allowing bad legacy
-- data to block this migration.
UPDATE public.baby_shares
SET invite_token_hash = pg_catalog.lower(invite_token_hash)
WHERE invite_token_hash ~* '^[0-9a-f]{64}$';

UPDATE public.baby_shares
SET
  invite_token_hash = NULL,
  invite_expires_at = CASE
    WHEN status = 'pending'
      THEN pg_catalog.now() - INTERVAL '1 day'
    ELSE NULL
  END
WHERE invite_token_hash IS NOT NULL
  AND invite_token_hash !~ '^[0-9a-f]{64}$';

UPDATE public.baby_shares
SET
  invite_token_hash = NULL,
  invite_expires_at = NULL
WHERE status = 'accepted'
  AND (invite_token_hash IS NOT NULL OR invite_expires_at IS NOT NULL);

ALTER TABLE public.baby_shares
  ADD CONSTRAINT baby_shares_invite_token_hash_format_check
  CHECK (
    invite_token_hash IS NULL
    OR invite_token_hash ~ '^[0-9a-f]{64}$'
  );

COMMENT ON COLUMN public.baby_shares.access_role IS
  'Delegated access role. Alpha 1.2 supports caregiver access only.';

-- Rebuild the SECURITY DEFINER access helpers with an empty search path and
-- fully qualified object names. The user_uuid argument must match the caller,
-- which prevents an authenticated caller from using these public RPCs to probe
-- another account's ownership or sharing relationships.
CREATE OR REPLACE FUNCTION public.is_baby_owner(
  baby_uuid UUID,
  user_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    user_uuid IS NOT NULL
    AND user_uuid = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = baby_uuid
        AND babies.profile_id = user_uuid
    );
$$;

CREATE OR REPLACE FUNCTION public.has_baby_access(
  baby_uuid UUID,
  user_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    user_uuid IS NOT NULL
    AND user_uuid = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = baby_uuid
        AND (
          babies.profile_id = user_uuid
          OR EXISTS (
            SELECT 1
            FROM public.baby_shares
            WHERE baby_shares.baby_id = baby_uuid
              AND baby_shares.profile_id = user_uuid
              AND baby_shares.status = 'accepted'
              AND baby_shares.access_role = 'caregiver'
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.is_baby_owner(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_baby_access(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_baby_owner(UUID, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_baby_access(UUID, UUID)
  TO authenticated, service_role;

-- Pending invitations are no longer readable by matching email. The invitee
-- proves possession of the raw token only through accept_baby_invite(). Owners
-- can still manage their shares, and accepted caregivers can see their own row.
DROP POLICY IF EXISTS "Baby owners can insert baby shares"
  ON public.baby_shares;
DROP POLICY IF EXISTS "Baby owners and invitees can view baby shares"
  ON public.baby_shares;
DROP POLICY IF EXISTS "Owners and invitees can update baby shares"
  ON public.baby_shares;
DROP POLICY IF EXISTS "Baby owners can delete baby shares"
  ON public.baby_shares;

CREATE POLICY "Baby owners can insert pending caregiver shares"
  ON public.baby_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_baby_owner(baby_id, (SELECT auth.uid())))
    AND access_role = 'caregiver'
    AND status = 'pending'
    AND invite_token_hash IS NOT NULL
    AND invite_expires_at > (SELECT pg_catalog.now())
  );

CREATE POLICY "Owners and accepted caregivers can view baby shares"
  ON public.baby_shares
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_baby_owner(baby_id, (SELECT auth.uid())))
    OR (
      profile_id = (SELECT auth.uid())
      AND status = 'accepted'
      AND access_role = 'caregiver'
    )
  );

CREATE POLICY "Baby owners can delete baby shares"
  ON public.baby_shares
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_baby_owner(baby_id, (SELECT auth.uid()))));

-- No authenticated role may update a share row directly. Token rotation and
-- acceptance use narrowly scoped SECURITY DEFINER functions below.
REVOKE UPDATE ON TABLE public.baby_shares
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_baby_invite(
  p_share_id UUID,
  p_raw_token TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT := pg_catalog.lower(
    NULLIF(auth.jwt() ->> 'email', '')
  );
  v_baby_id UUID;
BEGIN
  IF v_user_id IS NULL OR v_user_email IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_share_id IS NULL
     OR p_raw_token IS NULL
     OR p_raw_token !~ '^[0-9A-Fa-f]{64}$' THEN
    RAISE EXCEPTION 'Invitation is invalid or no longer available.'
      USING ERRCODE = '22023';
  END IF;

  -- UPDATE provides the row lock. If two requests race, only the first can
  -- match status = 'pending'; the second observes the accepted row and fails.
  UPDATE public.baby_shares AS target_share
  SET
    profile_id = v_user_id,
    access_role = 'caregiver',
    status = 'accepted',
    invite_token_hash = NULL,
    invite_expires_at = NULL
  WHERE target_share.id = p_share_id
    AND target_share.status = 'pending'
    AND pg_catalog.lower(target_share.email) = v_user_email
    AND target_share.invite_token_hash IS NOT NULL
    AND target_share.invite_expires_at > pg_catalog.now()
    AND target_share.invite_token_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_raw_token, 'UTF8')),
      'hex'
    )
  RETURNING target_share.baby_id INTO v_baby_id;

  IF v_baby_id IS NULL THEN
    -- Deliberately use one message for missing, expired, consumed, wrong-email,
    -- and wrong-token cases to avoid exposing invitation state.
    RAISE EXCEPTION 'Invitation is invalid or no longer available.'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_baby_id;
END;
$$;

COMMENT ON FUNCTION public.accept_baby_invite(UUID, TEXT) IS
  'Atomically accepts one pending caregiver invite for the authenticated email after validating its raw token and expiry; returns the shared baby ID.';

REVOKE ALL ON FUNCTION public.accept_baby_invite(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_baby_invite(UUID, TEXT)
  TO authenticated;

-- Preserve the owner's "new invitation link" feature without restoring table
-- UPDATE access. The server supplies a new cryptographically random raw token;
-- only its SHA-256 hash is retained by the database.
CREATE OR REPLACE FUNCTION public.rotate_baby_invite(
  p_share_id UUID,
  p_raw_token TEXT
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_share_id IS NULL
     OR p_raw_token IS NULL
     OR p_raw_token !~ '^[0-9A-Fa-f]{64}$' THEN
    RAISE EXCEPTION 'Invitation is invalid or no longer available.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.baby_shares AS target_share
  SET
    access_role = 'caregiver',
    invite_token_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_raw_token, 'UTF8')),
      'hex'
    ),
    invite_expires_at = pg_catalog.now() + INTERVAL '7 days'
  WHERE target_share.id = p_share_id
    AND target_share.status = 'pending'
    AND public.is_baby_owner(target_share.baby_id, v_user_id)
  RETURNING target_share.invite_expires_at INTO v_expires_at;

  IF v_expires_at IS NULL THEN
    RAISE EXCEPTION 'Invitation is invalid or no longer available.'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_expires_at;
END;
$$;

COMMENT ON FUNCTION public.rotate_baby_invite(UUID, TEXT) IS
  'Rotates a pending caregiver invitation token for the authenticated baby owner and returns its new expiry.';

REVOKE ALL ON FUNCTION public.rotate_baby_invite(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_baby_invite(UUID, TEXT)
  TO authenticated;

-- RLS controls which baby row can be changed; column privileges and this
-- trigger independently prevent ownership transfer through UPDATE.
REVOKE UPDATE ON TABLE public.babies
  FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  name,
  date_of_birth,
  biggest_issue,
  feeding_type,
  bedtime_range,
  ai_memory
) ON TABLE public.babies TO authenticated;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.prevent_baby_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'Baby ownership cannot be changed through an update.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_baby_owner_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_baby_ownership ON public.babies;
CREATE TRIGGER protect_baby_ownership
  BEFORE UPDATE OF profile_id ON public.babies
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_baby_owner_change();

COMMENT ON TRIGGER protect_baby_ownership ON public.babies IS
  'Makes profile_id immutable; a future ownership-transfer feature must use a separately reviewed workflow.';
