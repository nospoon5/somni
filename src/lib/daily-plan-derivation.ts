import { getBaselinePlan } from './baseline-plans'
import type {
  DailyPlanConfidence,
  DailyPlanFeedTarget,
  DailyPlanRecord,
  DailyPlanSleepTarget,
} from './daily-plan'
import type { SleepPlanProfileRecord, SleepPlanWakeWindow } from './sleep-plan-profile'
import {
  clockTimeToMinutes,
  formatClockTime,
  minutesToClockTime,
  roundToNearestFive,
} from './date-utils'

type DailyPlanSelectionInput = {
  savedPlan: DailyPlanRecord | null
  profile: SleepPlanProfileRecord | null
  ageInWeeks: number | null
  babyId: string
  babyName: string
  planDate: string
}

export type DailyPlanSelectionSource =
  | 'saved_daily_plan'
  | 'profile_derived'
  | 'age_baseline_fallback'
  | 'none'

function midpointMinutes(window: SleepPlanWakeWindow | undefined, fallbackMinutes: number) {
  if (!window) {
    return fallbackMinutes
  }

  if (window.minMinutes !== null && window.maxMinutes !== null) {
    return Math.round((window.minMinutes + window.maxMinutes) / 2)
  }

  if (window.maxMinutes !== null) {
    return window.maxMinutes
  }

  if (window.minMinutes !== null) {
    return window.minMinutes
  }

  return fallbackMinutes
}

function formatFlexibilityWindow(flexibilityMinutes: number | null) {
  if (!flexibilityMinutes || flexibilityMinutes < 5) {
    return 'Follow cues around this anchor'
  }

  return `+/- ${flexibilityMinutes} min`
}

function buildNapLabels(targetNapCount: number) {
  if (targetNapCount <= 1) {
    return ['Nap']
  }

  return Array.from({ length: targetNapCount }, (_, index) => `Nap ${index + 1}`)
}

function buildSleepTargetsFromProfile(profile: SleepPlanProfileRecord): DailyPlanSleepTarget[] {
  const wakeMinutes = clockTimeToMinutes(profile.usualWakeTime)
  const bedtimeMinutes = clockTimeToMinutes(profile.targetBedtime)
  const firstNapNotBeforeMinutes = clockTimeToMinutes(profile.wakeWindowProfile.firstNapNotBefore ?? '')
  if (wakeMinutes === null || bedtimeMinutes === null) {
    return [
      {
        label: 'Bedtime',
        targetTime: profile.targetBedtime,
        window: formatFlexibilityWindow(profile.wakeWindowProfile.flexibilityMinutes),
        notes: "Keep this bedtime anchor steady, then follow your baby's cues around the edges.",
      },
    ]
  }

  const dayLengthMinutes =
    bedtimeMinutes > wakeMinutes
      ? bedtimeMinutes - wakeMinutes
      : bedtimeMinutes + 24 * 60 - wakeMinutes
  const targetNapCount = Math.max(1, profile.targetNapCount)
  const napLabels = buildNapLabels(targetNapCount)
  const firstWakeWindow = midpointMinutes(profile.wakeWindowProfile.windows[0], 105)
  const finalWakeWindow = midpointMinutes(
    profile.wakeWindowProfile.windows[targetNapCount],
    150
  )
  const fallbackNapDuration = targetNapCount >= 3 ? 60 : 75
  const unconstrainedFirstNapStart = wakeMinutes + firstWakeWindow
  const firstNapStart =
    firstNapNotBeforeMinutes !== null
      ? Math.max(unconstrainedFirstNapStart, firstNapNotBeforeMinutes)
      : unconstrainedFirstNapStart
  const latestLastNapStart =
    wakeMinutes + dayLengthMinutes - finalWakeWindow - fallbackNapDuration
  const safeLastNapStart = Math.max(firstNapStart, latestLastNapStart)
  const span =
    targetNapCount > 1 ? Math.max(0, safeLastNapStart - firstNapStart) : 0
  const spacing = targetNapCount > 1 ? Math.floor(span / (targetNapCount - 1)) : 0
  const napTargets: DailyPlanSleepTarget[] = napLabels.map((label, index) => ({
    label,
    targetTime: minutesToClockTime(roundToNearestFive(firstNapStart + spacing * index)),
    window: formatFlexibilityWindow(profile.wakeWindowProfile.flexibilityMinutes),
    notes:
      profile.dayStructure === 'daycare'
        ? 'Keep this close to daycare reality, even if exact timing shifts.'
        : profile.dayStructure === 'work_constrained'
          ? 'Use this as a practical anchor around work and school timing limits.'
          : "Treat this as an anchor, then flex gently with your baby's cues.",
  }))

  if (napTargets.length > 0 && profile.wakeWindowProfile.firstNapNotBefore) {
    const notePrefix = `Do not aim earlier than ${formatClockTime(profile.wakeWindowProfile.firstNapNotBefore)}.`
    napTargets[0] = {
      ...napTargets[0],
      notes: napTargets[0].notes ? `${notePrefix} ${napTargets[0].notes}` : notePrefix,
    }
  }

  const bedtimeWindowHours = Math.max(1.5, Math.min(4, finalWakeWindow / 60)).toFixed(1)
  const bedtimeTarget: DailyPlanSleepTarget = {
    label: 'Bedtime',
    targetTime: profile.targetBedtime,
    window: `~${bedtimeWindowHours} hr after last nap`,
    notes:
      profile.wakeWindowProfile.assertiveness === 'assertive'
        ? 'Keep this bedtime steady where possible to protect overnight sleep.'
        : profile.wakeWindowProfile.assertiveness === 'gentle'
          ? 'Aim for this bedtime anchor, but follow cues if your baby needs earlier wind-down.'
          : 'Use this bedtime as your main evening anchor.',
  }

  return [...napTargets, bedtimeTarget]
}

function buildFeedTargetsFromProfile(profile: SleepPlanProfileRecord): DailyPlanFeedTarget[] {
  if (profile.feedAnchorProfile.anchors.length > 0) {
    return profile.feedAnchorProfile.anchors.map((anchor) => ({
      label: anchor.label,
      targetTime: anchor.targetTime,
      notes: anchor.notes,
    }))
  }

  return [
    {
      label: 'Morning feed',
      targetTime: profile.usualWakeTime,
      notes: 'Use this as a light start-of-day feed anchor.',
    },
    {
      label: 'Bedtime feed',
      targetTime: profile.targetBedtime,
      notes: 'Keep this feed calm and low-stimulation.',
    },
  ]
}

function getProfileReasonSummary(profile: SleepPlanProfileRecord) {
  if (profile.adaptationConfidence === 'low' && profile.learningState !== 'stable') {
    return 'Holding steady while Somni learns from more complete logs.'
  }

  return (
    profile.lastEvidenceSummary ??
    "Built from your baby's current durable sleep profile."
  )
}

export function buildDailyPlanFromProfile(args: {
  profile: SleepPlanProfileRecord
  babyId: string
  planDate: string
}) {
  return {
    id: `derived-${args.profile.id}-${args.planDate}`,
    babyId: args.babyId,
    planDate: args.planDate,
    sleepTargets: buildSleepTargetsFromProfile(args.profile),
    feedTargets: buildFeedTargetsFromProfile(args.profile),
    notes: args.profile.feedAnchorProfile.notes,
    updatedAt: null,
    metadata: {
      origin: 'profile_derived',
      confidence: args.profile.adaptationConfidence as DailyPlanConfidence,
      reasonSummary: getProfileReasonSummary(args.profile),
    },
  } satisfies DailyPlanRecord
}

function buildDailyPlanFromAgeFallback(args: {
  ageInWeeks: number
  babyName: string
  babyId: string
  planDate: string
}) {
  const baselinePlan = getBaselinePlan(args.ageInWeeks, args.babyName)

  return {
    ...baselinePlan,
    babyId: args.babyId,
    planDate: args.planDate,
    metadata: {
      origin: 'age_baseline_fallback',
      confidence: 'low',
      reasonSummary:
        'Using age-based fallback because no durable sleep profile is available yet.',
    },
  } satisfies DailyPlanRecord
}

function markSavedPlan(plan: DailyPlanRecord) {
  return {
    ...plan,
    metadata:
      plan.metadata ??
      ({
        origin: 'saved_daily_plan',
        confidence: 'high',
        reasonSummary: 'Using your saved plan for today.',
      } satisfies DailyPlanRecord['metadata']),
  }
}

export function selectDailyPlanForDashboard(input: DailyPlanSelectionInput) {
  if (input.savedPlan) {
    return {
      source: 'saved_daily_plan' as const,
      plan: markSavedPlan(input.savedPlan),
    }
  }

  if (input.profile) {
    return {
      source: 'profile_derived' as const,
      plan: buildDailyPlanFromProfile({
        profile: input.profile,
        babyId: input.babyId,
        planDate: input.planDate,
      }),
    }
  }

  if (input.ageInWeeks !== null) {
    return {
      source: 'age_baseline_fallback' as const,
      plan: buildDailyPlanFromAgeFallback({
        ageInWeeks: input.ageInWeeks,
        babyName: input.babyName,
        babyId: input.babyId,
        planDate: input.planDate,
      }),
    }
  }

  return {
    source: 'none' as const,
    plan: null,
  }
}
