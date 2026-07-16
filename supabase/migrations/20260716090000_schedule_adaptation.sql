-- Migration: Schedule Adaptation columns for daily_plans
-- Adds pending_rescue_targets (JSONB) and rescue_dismissed (BOOLEAN)
-- to support the chat-driven balanced schedule adaptation flow.
--
-- RLS Note: No new policies are required. The existing policies created in
-- 202607141200_add_baby_shares.sql already use public.has_baby_access() for all
-- SELECT / INSERT / UPDATE / DELETE operations on daily_plans, which covers
-- these new columns automatically.

-- 1. Add the pending_rescue_targets column.
--    Stores the dampened sleep/feed targets proposed by the adaptation engine.
--    NULL means no pending recommendation for this plan row.
ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS pending_rescue_targets JSONB DEFAULT NULL;

-- 2. Constrain pending_rescue_targets to only accept a JSON object (or NULL),
--    never a bare array or scalar.  This protects the application from writing
--    malformed data into the column.
ALTER TABLE public.daily_plans
  ADD CONSTRAINT daily_plans_pending_rescue_targets_is_object
    CHECK (
      pending_rescue_targets IS NULL
      OR jsonb_typeof(pending_rescue_targets) = 'object'
    );

-- 3. Add the rescue_dismissed flag so that a parent's "Dismiss" action is
--    persisted and the banner does not reappear on the next page load.
ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS rescue_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Partial index: speeds up the dashboard query that filters for
--    plans with a pending (non-null, non-dismissed) rescue recommendation.
CREATE INDEX IF NOT EXISTS daily_plans_pending_rescue_idx
  ON public.daily_plans (baby_id, plan_date DESC)
  WHERE pending_rescue_targets IS NOT NULL
    AND rescue_dismissed = FALSE;

-- Sanity comment: existing trigger set_daily_plans_updated_at already fires
-- BEFORE UPDATE on this table, so updated_at is kept fresh automatically
-- when either new column is written.
