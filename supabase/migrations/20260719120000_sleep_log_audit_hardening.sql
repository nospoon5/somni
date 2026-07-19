-- Preserve caregiver attribution and the 48-hour history-integrity boundary at
-- the database layer. Client/server UI checks are helpful but are not an
-- authorization boundary because authenticated clients can call PostgREST.

CREATE OR REPLACE FUNCTION public.enforce_sleep_log_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_user_id IS NOT NULL THEN
      NEW.logged_by := v_user_id;
    END IF;
  ELSE
    NEW.baby_id := OLD.baby_id;
    NEW.created_at := OLD.created_at;
    NEW.logged_by := COALESCE(OLD.logged_by, v_user_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_sleep_log_audit_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_sleep_log_audit_fields ON public.sleep_logs;
CREATE TRIGGER enforce_sleep_log_audit_fields
  BEFORE INSERT OR UPDATE ON public.sleep_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sleep_log_audit_fields();

DROP POLICY IF EXISTS "Caregivers can insert sleep logs" ON public.sleep_logs;
DROP POLICY IF EXISTS "Caregivers can update sleep logs" ON public.sleep_logs;
DROP POLICY IF EXISTS "Caregivers can delete sleep logs" ON public.sleep_logs;

CREATE POLICY "Caregivers can insert attributed sleep logs"
  ON public.sleep_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_baby_access(baby_id, (SELECT auth.uid()))
    AND logged_by = (SELECT auth.uid())
  );

CREATE POLICY "Caregivers can update recent sleep logs"
  ON public.sleep_logs
  FOR UPDATE
  TO authenticated
  USING (
    public.has_baby_access(baby_id, (SELECT auth.uid()))
    AND started_at >= pg_catalog.now() - INTERVAL '48 hours'
  )
  WITH CHECK (
    public.has_baby_access(baby_id, (SELECT auth.uid()))
    AND started_at >= pg_catalog.now() - INTERVAL '48 hours'
    AND logged_by IS NOT DISTINCT FROM COALESCE(logged_by, (SELECT auth.uid()))
  );

CREATE POLICY "Caregivers can delete recent sleep logs"
  ON public.sleep_logs
  FOR DELETE
  TO authenticated
  USING (
    public.has_baby_access(baby_id, (SELECT auth.uid()))
    AND started_at >= pg_catalog.now() - INTERVAL '48 hours'
  );
