export const SLEEP_STYLE_LABELS = ['gentle', 'balanced', 'fast-track'] as const
export const DAY_STRUCTURE_VALUES = [
  'mostly_home_flexible',
  'daycare',
  'work_constrained',
] as const
export const NAP_PATTERN_VALUES = [
  'catnaps_or_varies',
  'mostly_4_naps',
  'mostly_3_naps',
  'mostly_2_naps',
  'mostly_1_nap',
] as const
export const SCHEDULE_PREFERENCE_VALUES = [
  'more_flexible',
  'mix_of_cues_and_anchors',
  'more_clock_based',
] as const
export const NIGHT_FEED_RESPONSE_VALUES = ['yes', 'no'] as const

export type SleepStyleLabel = (typeof SLEEP_STYLE_LABELS)[number]
export type OnboardingDayStructure = (typeof DAY_STRUCTURE_VALUES)[number]
export type OnboardingNapPattern = (typeof NAP_PATTERN_VALUES)[number]
export type OnboardingSchedulePreference = (typeof SCHEDULE_PREFERENCE_VALUES)[number]
export type OnboardingNightFeedResponse = (typeof NIGHT_FEED_RESPONSE_VALUES)[number]

type Option<Value extends string> = {
  value: Value
  label: string
}

export const dayStructureOptions: Option<OnboardingDayStructure>[] = [
  {
    value: 'mostly_home_flexible',
    label: 'Mostly at home, so the day can stay flexible',
  },
  {
    value: 'daycare',
    label: 'Daycare shapes a lot of the day',
  },
  {
    value: 'work_constrained',
    label: 'Work or school timings limit the day',
  },
]

export const napPatternOptions: Option<OnboardingNapPattern>[] = [
  {
    value: 'catnaps_or_varies',
    label: 'Short naps or the day feels a bit all over the place',
  },
  {
    value: 'mostly_4_naps',
    label: 'Usually 4 naps',
  },
  {
    value: 'mostly_3_naps',
    label: 'Usually 3 naps',
  },
  {
    value: 'mostly_2_naps',
    label: 'Usually 2 naps',
  },
  {
    value: 'mostly_1_nap',
    label: 'Usually 1 nap',
  },
]

export const schedulePreferenceOptions: Option<OnboardingSchedulePreference>[] = [
  {
    value: 'more_flexible',
    label: 'More flexible',
  },
  {
    value: 'mix_of_cues_and_anchors',
    label: 'A mix of cues and time anchors',
  },
  {
    value: 'more_clock_based',
    label: 'More clock-based',
  },
]

export const nightFeedOptions: Option<OnboardingNightFeedResponse>[] = [
  {
    value: 'yes',
    label: 'Yes, night feeds are still part of things',
  },
  {
    value: 'no',
    label: 'No, not usually',
  },
]

function normalizeEnum<T extends string>(value: unknown, allowedValues: readonly T[]) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return allowedValues.includes(normalized as T) ? (normalized as T) : null
}

export function normalizeSleepStyleLabel(value: unknown) {
  return normalizeEnum(value, SLEEP_STYLE_LABELS)
}

export function normalizeDayStructure(value: unknown) {
  return normalizeEnum(value, DAY_STRUCTURE_VALUES)
}

export function normalizeNapPattern(value: unknown) {
  return normalizeEnum(value, NAP_PATTERN_VALUES)
}

export function normalizeSchedulePreference(value: unknown) {
  return normalizeEnum(value, SCHEDULE_PREFERENCE_VALUES)
}

export function normalizeNightFeedResponse(value: unknown) {
  return normalizeEnum(value, NIGHT_FEED_RESPONSE_VALUES)
}

export function parseNightFeeds(value: unknown) {
  const normalized = normalizeNightFeedResponse(value)

  if (normalized === 'yes') {
    return true
  }

  if (normalized === 'no') {
    return false
  }

  return null
}

export function getSleepStyleLabel(score: number): SleepStyleLabel {
  if (score <= 3.9) {
    return 'gentle'
  }

  if (score <= 6.9) {
    return 'balanced'
  }

  return 'fast-track'
}
