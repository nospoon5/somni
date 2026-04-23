import type { SupabaseClient } from '@supabase/supabase-js'
import { getBaselinePlan } from './baseline-plans'
import {
  type OnboardingDayStructure,
  type OnboardingNapPattern,
  type OnboardingSchedulePreference,
  type SleepStyleLabel,
} from './onboarding-preferences'
import { getAgeBand } from './scoring/sleep-score'
import {
  buildSleepPlanProfileSnapshot,
  normalizeSleepPlanClockTime,
  normalizeSleepPlanProfileRow,
  type SleepPlanEvidenceConfidence,
  type SleepPlanFeedAnchorProfile,
  type SleepPlanWakeWindowProfile,
} from './sleep-plan-profile'

type SleepPlanProfileInsert = {
  age_band: string
  template_key: string
  usual_wake_time: string
  target_bedtime: string
  target_nap_count: number
  wake_window_profile: SleepPlanWakeWindowProfile
  feed_anchor_profile: SleepPlanFeedAnchorProfile
  schedule_preference: OnboardingSchedulePreference
  day_structure: OnboardingDayStructure
  adaptation_confidence: SleepPlanEvidenceConfidence
  learning_state: 'starting'
  last_evidence_summary: string
}

type BabyProfileDetails = {
  id: string
  name: string
  dateOfBirth: string
}

type SleepPlanProfileSeed = {
  sleepStyleLabel: SleepStyleLabel | null
  typicalWakeTime: string | null
  dayStructure: OnboardingDayStructure | null
  napPattern: OnboardingNapPattern | null
  nightFeeds: boolean | null
  schedulePreference: OnboardingSchedulePreference | null
}

type CreateInitialSleepPlanProfileInput = BabyProfileDetails &
  SleepPlanProfileSeed & {
    referenceDate?: Date
  }

type EnsureSleepPlanProfileInput = BabyProfileDetails &
  SleepPlanProfileSeed & {
    supabase: Pick<SupabaseClient, 'from'>
    source: 'onboarding' | 'system'
  }

type AgeRule = {
  maxAgeInWeeks: number
  safeNapCounts: number[]
  defaultNapCount: (ageInWeeks: number) => number
  dayLengthMinutes: number
  bedtimeFloor: string
  bedtimeCeiling: string
  defaultWakeTime: string
}

const PROFILE_SELECT =
  'id, baby_id, age_band, template_key, usual_wake_time, target_bedtime, target_nap_count, wake_window_profile, feed_anchor_profile, schedule_preference, day_structure, adaptation_confidence, learning_state, last_auto_adjusted_at, last_evidence_summary, created_at, updated_at'

const DEFAULT_DAY_STRUCTURE: OnboardingDayStructure = 'mostly_home_flexible'
const DEFAULT_SCHEDULE_PREFERENCE: OnboardingSchedulePreference = 'mix_of_cues_and_anchors'
const DEFAULT_SLEEP_STYLE: SleepStyleLabel = 'balanced'

const AGE_RULES: AgeRule[] = [
  {
    maxAgeInWeeks: 8,
    safeNapCounts: [5],
    defaultNapCount: () => 5,
    dayLengthMinutes: 720,
    bedtimeFloor: '18:00',
    bedtimeCeiling: '21:00',
    defaultWakeTime: '07:00',
  },
  {
    maxAgeInWeeks: 16,
    safeNapCounts: [4],
    defaultNapCount: () => 4,
    dayLengthMinutes: 720,
    bedtimeFloor: '18:00',
    bedtimeCeiling: '20:30',
    defaultWakeTime: '07:00',
  },
  {
    maxAgeInWeeks: 28,
    safeNapCounts: [3, 4],
    defaultNapCount: (ageInWeeks) => (ageInWeeks < 22 ? 4 : 3),
    dayLengthMinutes: 750,
    bedtimeFloor: '18:15',
    bedtimeCeiling: '20:15',
    defaultWakeTime: '07:00',
  },
  {
    maxAgeInWeeks: 40,
    safeNapCounts: [3],
    defaultNapCount: () => 3,
    dayLengthMinutes: 750,
    bedtimeFloor: '18:15',
    bedtimeCeiling: '20:00',
    defaultWakeTime: '07:00',
  },
  {
    maxAgeInWeeks: 52,
    safeNapCounts: [2],
    defaultNapCount: () => 2,
    dayLengthMinutes: 750,
    bedtimeFloor: '18:15',
    bedtimeCeiling: '20:00',
    defaultWakeTime: '07:00',
  },
  {
    maxAgeInWeeks: 78,
    safeNapCounts: [1, 2],
    defaultNapCount: (ageInWeeks) => (ageInWeeks < 68 ? 2 : 1),
    dayLengthMinutes: 750,
    bedtimeFloor: '18:30',
    bedtimeCeiling: '20:00',
    defaultWakeTime: '07:00',
  },
  {
    maxAgeInWeeks: Number.POSITIVE_INFINITY,
    safeNapCounts: [1],
    defaultNapCount: () => 1,
    dayLengthMinutes: 750,
    bedtimeFloor: '18:30',
    bedtimeCeiling: '20:00',
    defaultWakeTime: '07:00',
  },
]

const WAKE_WINDOW_PRESETS: Record<
  number,
  Array<{
    label: string
    minMinutes: number
    maxMinutes: number
  }>
> = {
  1: [
    { label: 'Morning wake window', minMinutes: 270, maxMinutes: 330 },
    { label: 'Afternoon wake window', minMinutes: 240, maxMinutes: 300 },
  ],
  2: [
    { label: 'Wake window 1', minMinutes: 150, maxMinutes: 180 },
    { label: 'Wake window 2', minMinutes: 180, maxMinutes: 210 },
    { label: 'Final wake window', minMinutes: 210, maxMinutes: 240 },
  ],
  3: [
    { label: 'Wake window 1', minMinutes: 105, maxMinutes: 135 },
    { label: 'Wake window 2', minMinutes: 120, maxMinutes: 150 },
    { label: 'Wake window 3', minMinutes: 135, maxMinutes: 165 },
    { label: 'Final wake window', minMinutes: 150, maxMinutes: 180 },
  ],
  4: [
    { label: 'Wake window 1', minMinutes: 75, maxMinutes: 105 },
    { label: 'Wake window 2', minMinutes: 90, maxMinutes: 120 },
    { label: 'Wake window 3', minMinutes: 105, maxMinutes: 135 },
    { label: 'Wake window 4', minMinutes: 105, maxMinutes: 135 },
    { label: 'Final wake window', minMinutes: 120, maxMinutes: 150 },
  ],
  5: [
    { label: 'Wake window 1', minMinutes: 45, maxMinutes: 60 },
    { label: 'Wake window 2', minMinutes: 45, maxMinutes: 60 },
    { label: 'Wake window 3', minMinutes: 50, maxMinutes: 65 },
    { label: 'Wake window 4', minMinutes: 55, maxMinutes: 70 },
    { label: 'Wake window 5', minMinutes: 60, maxMinutes: 75 },
    { label: 'Final wake window', minMinutes: 75, maxMinutes: 90 },
  ],
}

function parseDateOnly(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return Number.NaN
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return Number.NaN
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed
  return new Date(normalized).getTime()
}

function getTodayDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getAgeInWeeksForDateOfBirth(dateOfBirth: string, referenceDate = new Date()) {
  const dateOfBirthTime = parseDateOnly(dateOfBirth)
  const referenceTime = parseDateOnly(getTodayDateString(referenceDate))

  if (!Number.isFinite(dateOfBirthTime) || !Number.isFinite(referenceTime)) {
    return null
  }

  const ageInDays = Math.floor((referenceTime - dateOfBirthTime) / (24 * 60 * 60 * 1000))
  return ageInDays >= 0 ? Math.floor(ageInDays / 7) : null
}

function pickAgeRule(ageInWeeks: number) {
  return AGE_RULES.find((rule) => ageInWeeks <= rule.maxAgeInWeeks) ?? AGE_RULES[AGE_RULES.length - 1]
}

export function getSafeNapCountsForAgeInWeeks(ageInWeeks: number) {
  return [...pickAgeRule(Math.max(0, ageInWeeks)).safeNapCounts]
}

function toMinutes(time: string) {
  const normalized = normalizeSleepPlanClockTime(time)
  if (!normalized) {
    return null
  }

  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

function toClockTime(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addMinutes(time: string, offsetMinutes: number) {
  const parsed = toMinutes(time)
  return parsed === null ? time : toClockTime(parsed + offsetMinutes)
}

function clampTime(time: string, floor: string, ceiling: string) {
  const value = toMinutes(time)
  const min = toMinutes(floor)
  const max = toMinutes(ceiling)

  if (value === null || min === null || max === null) {
    return time
  }

  return toClockTime(Math.max(min, Math.min(max, value)))
}

function getDesiredNapCount(napPattern: OnboardingNapPattern | null) {
  switch (napPattern) {
    case 'mostly_4_naps':
      return 4
    case 'mostly_3_naps':
      return 3
    case 'mostly_2_naps':
      return 2
    case 'mostly_1_nap':
      return 1
    case 'catnaps_or_varies':
    default:
      return null
  }
}

function resolveNapCount(
  ageRule: AgeRule,
  ageInWeeks: number,
  napPattern: OnboardingNapPattern | null
) {
  const desiredNapCount = getDesiredNapCount(napPattern)
  const fallbackNapCount = ageRule.defaultNapCount(ageInWeeks)

  if (desiredNapCount === null) {
    return fallbackNapCount
  }

  return ageRule.safeNapCounts.reduce((closest, current) =>
    Math.abs(current - desiredNapCount) < Math.abs(closest - desiredNapCount) ? current : closest
  )
}

function buildWakeWindowProfile(args: {
  targetNapCount: number
  sleepStyleLabel: SleepStyleLabel
  schedulePreference: OnboardingSchedulePreference
  dayStructure: OnboardingDayStructure
}): SleepPlanWakeWindowProfile {
  const baseWindows = WAKE_WINDOW_PRESETS[args.targetNapCount] ?? WAKE_WINDOW_PRESETS[3]

  let flexibilityMinutes = 20

  if (args.sleepStyleLabel === 'gentle') {
    flexibilityMinutes += 10
  } else if (args.sleepStyleLabel === 'fast-track') {
    flexibilityMinutes -= 8
  }

  if (args.schedulePreference === 'more_flexible') {
    flexibilityMinutes += 10
  } else if (args.schedulePreference === 'more_clock_based') {
    flexibilityMinutes -= 6
  }

  if (args.dayStructure === 'mostly_home_flexible') {
    flexibilityMinutes += 4
  } else {
    flexibilityMinutes -= 4
  }

  return {
    windows: baseWindows.map((window) => ({ ...window })),
    flexibilityMinutes: Math.max(10, Math.min(45, flexibilityMinutes)),
    assertiveness:
      args.sleepStyleLabel === 'fast-track'
        ? 'assertive'
        : args.sleepStyleLabel === 'gentle'
          ? 'gentle'
          : 'balanced',
    adaptationPace:
      args.sleepStyleLabel === 'fast-track'
        ? 'responsive'
        : args.sleepStyleLabel === 'gentle'
          ? 'slow'
          : 'steady',
    firstNapNotBefore: null,
  }
}

function buildFeedAnchorProfile(args: {
  ageInWeeks: number
  usualWakeTime: string
  targetBedtime: string
  nightFeeds: boolean | null
  dayStructure: OnboardingDayStructure
}): SleepPlanFeedAnchorProfile {
  const anchors: SleepPlanFeedAnchorProfile['anchors'] =
    args.ageInWeeks <= 16
      ? [
          {
            label: 'Morning feed',
            targetTime: args.usualWakeTime,
            notes: 'Offer a full feed soon after the day starts.',
          },
          {
            label: 'Day feeds',
            targetTime: addMinutes(args.usualWakeTime, 180),
            notes: 'Keep feeds regular through the day, but stay led by hunger cues too.',
          },
          {
            label: 'Bedtime feed',
            targetTime: addMinutes(args.targetBedtime, -30),
            notes: 'Keep the last feed calm and unhurried.',
          },
        ]
      : args.ageInWeeks <= 52
        ? [
            {
              label: 'Morning feed',
              targetTime: args.usualWakeTime,
              notes: 'Use the first feed as a clear start-of-day anchor.',
            },
            {
              label: 'Midday feed',
              targetTime: addMinutes(args.usualWakeTime, 300),
              notes: 'A reliable midday feed helps the day stay steadier.',
            },
            {
              label: 'Bedtime feed',
              targetTime: addMinutes(args.targetBedtime, -30),
              notes: 'Keep this feed low-stimulation so it supports the wind-down.',
            },
          ]
        : [
            {
              label: 'Breakfast',
              targetTime: addMinutes(args.usualWakeTime, 30),
              notes: 'Keep breakfast close to wake-up so the day starts clearly.',
            },
            {
              label: 'Lunch',
              targetTime: addMinutes(args.usualWakeTime, 330),
              notes: 'A steady lunch anchor usually helps the afternoon run more smoothly.',
            },
            {
              label: 'Bedtime milk',
              targetTime: addMinutes(args.targetBedtime, -30),
              notes: 'Use this only if it still suits your routine.',
            },
          ]

  if (args.nightFeeds) {
    anchors.push({
      label: 'Night feeds',
      targetTime: null,
      notes: 'If a night feed is still happening, keep it calm, low-light, and simple.',
    })
  }

  const notes =
    args.nightFeeds === null
      ? 'Feed anchors stay light. If overnight feeds are still part of your reality, keep them calm and predictable.'
      : args.dayStructure === 'daycare'
        ? 'Feed anchors stay supportive, with enough flexibility around daycare timing.'
        : 'Feed anchors stay supportive, not rigid.'

  return {
    anchors,
    notes,
    nightFeedsExpected: args.nightFeeds,
  }
}

function buildEvidenceSummary(args: {
  hasWakeTime: boolean
  hasDayStructure: boolean
  hasNapPattern: boolean
  hasNightFeeds: boolean
  hasSchedulePreference: boolean
}) {
  if (
    args.hasWakeTime &&
    args.hasDayStructure &&
    args.hasNapPattern &&
    args.hasNightFeeds &&
    args.hasSchedulePreference
  ) {
    return 'Built from onboarding answers about wake time, day shape, naps, night feeds, and preferred schedule feel.'
  }

  return 'Built from age plus older onboarding data because some newer planning answers were missing.'
}

export function createInitialSleepPlanProfile(
  input: CreateInitialSleepPlanProfileInput
): SleepPlanProfileInsert {
  const referenceDate = input.referenceDate ?? new Date()
  const ageInWeeks = getAgeInWeeksForDateOfBirth(input.dateOfBirth, referenceDate) ?? 0
  const ageRule = pickAgeRule(ageInWeeks)
  const templateKey = getBaselinePlan(ageInWeeks, input.name).id
  const ageBand = getAgeBand(input.dateOfBirth, referenceDate)
  const sleepStyleLabel = input.sleepStyleLabel ?? DEFAULT_SLEEP_STYLE
  const usualWakeTime = normalizeSleepPlanClockTime(input.typicalWakeTime) ?? ageRule.defaultWakeTime
  const dayStructure = input.dayStructure ?? DEFAULT_DAY_STRUCTURE
  const schedulePreference = input.schedulePreference ?? DEFAULT_SCHEDULE_PREFERENCE
  const targetNapCount = resolveNapCount(ageRule, ageInWeeks, input.napPattern)
  const targetBedtime = clampTime(
    addMinutes(usualWakeTime, ageRule.dayLengthMinutes),
    ageRule.bedtimeFloor,
    ageRule.bedtimeCeiling
  )
  const wakeWindowProfile = buildWakeWindowProfile({
    targetNapCount,
    sleepStyleLabel,
    schedulePreference,
    dayStructure,
  })
  const feedAnchorProfile = buildFeedAnchorProfile({
    ageInWeeks,
    usualWakeTime,
    targetBedtime,
    nightFeeds: input.nightFeeds,
    dayStructure,
  })

  const hasWakeTime = Boolean(normalizeSleepPlanClockTime(input.typicalWakeTime))
  const hasDayStructure = Boolean(input.dayStructure)
  const hasNapPattern = Boolean(input.napPattern)
  const hasNightFeeds = input.nightFeeds !== null
  const hasSchedulePreference = Boolean(input.schedulePreference)

  return {
    age_band: ageBand,
    template_key: templateKey,
    usual_wake_time: usualWakeTime,
    target_bedtime: targetBedtime,
    target_nap_count: targetNapCount,
    wake_window_profile: wakeWindowProfile,
    feed_anchor_profile: feedAnchorProfile,
    schedule_preference: schedulePreference,
    day_structure: dayStructure,
    adaptation_confidence:
      hasWakeTime && hasDayStructure && hasNapPattern && hasNightFeeds && hasSchedulePreference
        ? 'medium'
        : 'low',
    learning_state: 'starting',
    last_evidence_summary: buildEvidenceSummary({
      hasWakeTime,
      hasDayStructure,
      hasNapPattern,
      hasNightFeeds,
      hasSchedulePreference,
    }),
  }
}

export async function ensureSleepPlanProfile(input: EnsureSleepPlanProfileInput) {
  const { data: existingRow, error: existingError } = await input.supabase
    .from('sleep_plan_profiles')
    .select(PROFILE_SELECT)
    .eq('baby_id', input.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existingProfile = normalizeSleepPlanProfileRow(existingRow)
  if (existingProfile) {
    return {
      profile: existingProfile,
      created: false,
    }
  }

  const initialProfile = createInitialSleepPlanProfile(input)
  const { data: createdRow, error: createError } = await input.supabase
    .from('sleep_plan_profiles')
    .insert({
      baby_id: input.id,
      ...initialProfile,
    })
    .select(PROFILE_SELECT)
    .single()

  if (createError) {
    throw new Error(createError.message)
  }

  const createdProfile = normalizeSleepPlanProfileRow(createdRow)
  if (!createdProfile) {
    throw new Error('Sleep plan profile insert returned an invalid record')
  }

  const summary =
    input.source === 'onboarding'
      ? `Created ${input.name}'s starting sleep plan profile from onboarding answers.`
      : `Bootstrapped ${input.name}'s starting sleep plan profile from age and existing onboarding data.`
  const rationale =
    input.source === 'onboarding'
      ? 'Created as part of onboarding so Somni starts with one recommended baseline profile.'
      : 'Created automatically because this account pre-dated the expanded onboarding questions.'

  const { error: eventError } = await input.supabase.from('sleep_plan_change_events').insert({
    baby_id: input.id,
    sleep_plan_profile_id: createdProfile.id,
    change_scope: 'profile',
    change_source: input.source,
    change_kind: 'bootstrap',
    evidence_confidence: createdProfile.adaptationConfidence,
    summary,
    rationale,
    before_snapshot: {},
    after_snapshot: buildSleepPlanProfileSnapshot(createdProfile),
  })

  if (eventError) {
    console.error('[sleep-plan-profile] failed to save bootstrap event', eventError)
  }

  return {
    profile: createdProfile,
    created: true,
  }
}
