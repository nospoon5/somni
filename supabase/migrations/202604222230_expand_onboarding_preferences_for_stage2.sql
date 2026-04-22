ALTER TABLE public.onboarding_preferences
  ADD COLUMN typical_wake_time TIME,
  ADD COLUMN day_structure TEXT,
  ADD COLUMN nap_pattern TEXT,
  ADD COLUMN night_feeds BOOLEAN,
  ADD COLUMN schedule_preference TEXT;

ALTER TABLE public.onboarding_preferences
  ADD CONSTRAINT onboarding_preferences_day_structure_check
    CHECK (
      day_structure IS NULL
      OR day_structure IN ('mostly_home_flexible', 'daycare', 'work_constrained')
    ),
  ADD CONSTRAINT onboarding_preferences_nap_pattern_check
    CHECK (
      nap_pattern IS NULL
      OR nap_pattern IN (
        'catnaps_or_varies',
        'mostly_4_naps',
        'mostly_3_naps',
        'mostly_2_naps',
        'mostly_1_nap'
      )
    ),
  ADD CONSTRAINT onboarding_preferences_schedule_preference_check
    CHECK (
      schedule_preference IS NULL
      OR schedule_preference IN (
        'more_flexible',
        'mix_of_cues_and_anchors',
        'more_clock_based'
      )
    );
