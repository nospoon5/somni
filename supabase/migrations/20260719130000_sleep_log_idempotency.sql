-- A completed interval is a stable natural idempotency key for one baby. This
-- prevents a retried chat tool call from creating the same sleep twice.
CREATE UNIQUE INDEX IF NOT EXISTS sleep_logs_completed_interval_unique_idx
  ON public.sleep_logs (baby_id, started_at, ended_at)
  WHERE ended_at IS NOT NULL;
