-- Stage 5.4: Caregiver handoff view
-- Add attribution to sleep logs so we know who created them.

ALTER TABLE public.sleep_logs
ADD COLUMN logged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create an index to look up activity by profile if needed
CREATE INDEX idx_sleep_logs_logged_by ON public.sleep_logs (logged_by);

-- Optional: Since we already have data, we might want to backfill logged_by.
-- Since only caregivers with access could have logged them, we'll leave existing logs as NULL, 
-- or we can backfill with the baby_owner's profile_id if we really want to.
-- We will leave it NULL for older logs to indicate "Legacy Log".
