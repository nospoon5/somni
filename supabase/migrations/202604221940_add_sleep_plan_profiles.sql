CREATE TABLE public.sleep_plan_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL UNIQUE REFERENCES public.babies(id) ON DELETE CASCADE,
  age_band TEXT NOT NULL,
  template_key TEXT NOT NULL,
  usual_wake_time TIME NOT NULL,
  target_bedtime TIME NOT NULL,
  target_nap_count INTEGER NOT NULL CHECK (target_nap_count >= 0 AND target_nap_count <= 8),
  wake_window_profile JSONB NOT NULL DEFAULT '{"windows":[]}'::jsonb,
  feed_anchor_profile JSONB NOT NULL DEFAULT '{"anchors":[]}'::jsonb,
  schedule_preference TEXT NOT NULL,
  day_structure TEXT NOT NULL,
  adaptation_confidence TEXT NOT NULL DEFAULT 'low'
    CHECK (adaptation_confidence IN ('low', 'medium', 'high')),
  learning_state TEXT NOT NULL DEFAULT 'starting'
    CHECK (learning_state IN ('starting', 'learning', 'stable')),
  last_auto_adjusted_at TIMESTAMP WITH TIME ZONE,
  last_evidence_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sleep_plan_profiles_wake_window_profile_object
    CHECK (jsonb_typeof(wake_window_profile) = 'object'),
  CONSTRAINT sleep_plan_profiles_feed_anchor_profile_object
    CHECK (jsonb_typeof(feed_anchor_profile) = 'object')
);

CREATE INDEX sleep_plan_profiles_updated_at_idx
  ON public.sleep_plan_profiles (updated_at DESC);

ALTER TABLE public.sleep_plan_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sleep plan profiles for their babies"
  ON public.sleep_plan_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_plan_profiles.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sleep plan profiles for their babies"
  ON public.sleep_plan_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_plan_profiles.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sleep plan profiles for their babies"
  ON public.sleep_plan_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_plan_profiles.baby_id
      AND babies.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_plan_profiles.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sleep plan profiles for their babies"
  ON public.sleep_plan_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_plan_profiles.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE TRIGGER set_sleep_plan_profiles_updated_at
  BEFORE UPDATE ON public.sleep_plan_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.sleep_plan_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  sleep_plan_profile_id UUID REFERENCES public.sleep_plan_profiles(id) ON DELETE SET NULL,
  plan_date DATE,
  change_scope TEXT NOT NULL CHECK (change_scope IN ('profile', 'daily')),
  change_source TEXT NOT NULL CHECK (change_source IN ('onboarding', 'chat', 'logs', 'system')),
  change_kind TEXT NOT NULL
    CHECK (change_kind IN ('bootstrap', 'daily_rescue', 'baseline_shift', 'manual_correction')),
  evidence_confidence TEXT NOT NULL DEFAULT 'low'
    CHECK (evidence_confidence IN ('low', 'medium', 'high')),
  summary TEXT NOT NULL,
  rationale TEXT,
  before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sleep_plan_change_events_before_snapshot_object
    CHECK (jsonb_typeof(before_snapshot) = 'object'),
  CONSTRAINT sleep_plan_change_events_after_snapshot_object
    CHECK (jsonb_typeof(after_snapshot) = 'object'),
  CONSTRAINT sleep_plan_change_events_daily_requires_plan_date
    CHECK (change_scope = 'profile' OR plan_date IS NOT NULL)
);

CREATE INDEX sleep_plan_change_events_baby_created_at_idx
  ON public.sleep_plan_change_events (baby_id, created_at DESC);

CREATE INDEX sleep_plan_change_events_profile_created_at_idx
  ON public.sleep_plan_change_events (sleep_plan_profile_id, created_at DESC);

CREATE INDEX sleep_plan_change_events_plan_date_idx
  ON public.sleep_plan_change_events (plan_date DESC)
  WHERE plan_date IS NOT NULL;

ALTER TABLE public.sleep_plan_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sleep plan change events for their babies"
  ON public.sleep_plan_change_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_plan_change_events.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sleep plan change events for their babies"
  ON public.sleep_plan_change_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_plan_change_events.baby_id
      AND babies.profile_id = auth.uid()
    )
  );
