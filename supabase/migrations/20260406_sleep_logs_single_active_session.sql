-- Stage 7: Prevent multiple active sleep sessions per baby.
-- Rule: each baby can only have one row where ended_at IS NULL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sleep_logs
    WHERE ended_at IS NULL
    GROUP BY baby_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add unique active-session index: found babies with multiple open sleep logs (ended_at IS NULL).';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS sleep_logs_single_active_session_idx
  ON public.sleep_logs (baby_id)
  WHERE ended_at IS NULL;
