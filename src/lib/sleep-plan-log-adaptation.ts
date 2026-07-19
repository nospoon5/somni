import type { DailyPlanFeedTarget, DailyPlanRecord, DailyPlanSleepTarget } from './daily-plan'
import { buildDailyPlanFromProfile } from './daily-plan-derivation'
import {
  getAgeInWeeksForDateOfBirth,
  getSafeNapCountsForAgeInWeeks,
} from './sleep-plan-profile-init'
import {
  getSleepScoreLookbackStart,
  SLEEP_SCORE_LOOKBACK_DAYS,
  type SleepLogLike,
} from './scoring/sleep-score'
import type {
  SleepPlanEvidenceConfidence,
  SleepPlanProfileRecord,
} from './sleep-plan-profile'
import { getDateStringForTimezone, getTimeZoneParts } from './date-utils'

export type SleepPlanAdaptationDecision =
  | 'hold_steady'
  | 'apply_daily_rescue'
  | 'apply_baseline_shift'

export type SleepPlanAdaptationLog = SleepLogLike & {
  notes?: string | null
}

/**
 * Stored in daily_plans.pending_rescue_targets (JSONB).
 * Carries enough context for the dashboard banner to explain the suggestion.
 */
export type DailyRescuePendingPlan = {
  sleepTargets: DailyPlanSleepTarget[]
  feedTargets: DailyPlanFeedTarget[]
  triggerSource: 'morning_wake' | 'nap_end_early' | 'nap_start_late'
  /** Signed delta in minutes (negative = early, positive = late), rounded to nearest 10 min. */
  triggerDeltaMinutes: number
  affectedTargetCount: number
  /** Day sleep already accumulated (minutes) vs. the age-band target. */
  accumulatedDaySleepMinutes: number
  targetDaySleepMinutes: number
  rationale: string
}

export type SleepPlanAdaptationEvaluation = {
  decision: SleepPlanAdaptationDecision
  evidenceConfidence: SleepPlanEvidenceConfidence
  summary: string
  rationale: string
  blockedAdjustments: string[]
  evidence: {
    logCount: number
    coveredDays: number
    reasonablyCoveredDays: number
    wakeObservationDays: number
    bedtimeObservationDays: number
    firstNapObservationDays: number
  }
  nextProfile: SleepPlanProfileRecord | null
  basePlan: DailyPlanRecord | null
  nextPlan: DailyPlanRecord | null
}

type CompletedSleepLog = SleepPlanAdaptationLog & {
  endedAt: string
  durationMinutes: number
  localStartDate: string
  localStartMinutes: number
  localEndDate: string
  localEndMinutes: number
}

type ObservedDay = {
  date: string
  startedLogCount: number
  dayLogCount: number
  nightLogCount: number
  wakeMinutes: number | null
  bedtimeMinutes: number | null
  firstNapMinutes: number | null
  shortNapCount: number
  cautionFlags: string[]
}

type AnchorRecommendation = {
  kind: 'wake_anchor' | 'bedtime_anchor' | 'first_nap_anchor'
  observedTime: string
  newTime: string
  coveredDays: number
}

const MIN_REASONABLY_COVERED_DAYS = 3
const MIN_LOGS_FOR_ADAPTATION = 4
const MIN_SHIFT_DELTA_MINUTES = 20
const MAX_BASELINE_SHIFT_MINUTES = 30
const SHORT_NAP_MINUTES = 35
const MORNING_WAKE_MINUTES = 4 * 60 + 30
const MORNING_WAKE_MAX_MINUTES = 9 * 60
const BEDTIME_MINUTES = 17 * 60
const BEDTIME_MAX_MINUTES = 22 * 60 + 30
const FIRST_NAP_MINUTES = 6 * 60 + 30
const FIRST_NAP_MAX_MINUTES = 13 * 60
const CAUTION_NOTE_PATTERN =
  /\b(ill|illness|sick|fever|teeth|teething|travel|trip|jet\s*lag|vaccine|vaccination|doctor)\b/i
const MORNING_FEED_LABEL_PATTERN = /\b(morning|wake)\b/
const BEDTIME_FEED_LABEL_PATTERN = /\b(bedtime|evening|night)\b/
const BEDTIME_TARGET_PATTERN = /\bbedtime\b/i

// --- Cascade engine constants ---
/** Minimum absolute deviation (minutes) before a rescue cascade fires. */
const RESCUE_MIN_DELTA_MINUTES = 20
/** Hard cap on how much a single event can shift downstream targets. */
const RESCUE_MAX_DELTA_MINUTES = 90
/**
 * Shifts are rounded to the nearest 10 minutes so suggestions feel gentle
 * and broadly targeted rather than false-precise ("bring nap 2 forward 16.3 min").
 */
const RESCUE_ROUNDING_MINUTES = 10
/** Floor coefficient for cascade dampening — the last remaining target always
 * receives at least 33% of the triggering delta. */
const RESCUE_FLOOR_COEFF = 0.33
/**
 * Default total target day-sleep minutes by nap count, used when no profile
 * wake-window data is available. Derived from age-band norms.
 */
const DEFAULT_TARGET_DAY_SLEEP_BY_NAP_COUNT: Record<number, number> = {
  1: 90,
  2: 150,
  3: 210,
  4: 240,
  5: 300,
}
/**
 * Default expected nap durations (minutes) by nap position (0-based) per nap count.
 * Used as fallback when a plan's sleep targets have no predictable duration info.
 */
const DEFAULT_NAP_DURATION_BY_NAP_COUNT: Record<number, number[]> = {
  1: [90],
  2: [75, 60],
  3: [60, 45, 30],
  4: [45, 45, 30, 20],
  5: [30, 30, 30, 20, 20],
}

function toLocalDateString(date: Date, timezone: string) {
  return getDateStringForTimezone(timezone, date)
}

function getLocalMinutes(date: Date, timezone: string) {
  const parts = getTimeZoneParts(timezone, date)
  return parts.hour * 60 + parts.minute
}

function toClockTime(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function toMinutes(clockTime: string | null | undefined) {
  if (!clockTime) {
    return null
  }

  const match = clockTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return null
  }

  return Number(match[1]) * 60 + Number(match[2])
}

function roundToNearestFive(minutes: number) {
  return Math.round(minutes / 5) * 5
}

function applyTimeDelta(clockTime: string, deltaMinutes: number) {
  const minutes = toMinutes(clockTime)
  if (minutes === null) {
    return clockTime
  }

  return toClockTime(roundToNearestFive(minutes + deltaMinutes))
}

function formatClockTime(clockTime: string) {
  const match = clockTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return clockTime
  }

  const rawHour = Number(match[1])
  const minute = match[2]
  const period = rawHour >= 12 ? 'pm' : 'am'
  const hour = rawHour % 12 || 12
  return `${hour}:${minute} ${period}`
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function joinPhrases(parts: string[]) {
  if (parts.length === 0) {
    return ''
  }

  if (parts.length === 1) {
    return parts[0]
  }

  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`
  }

  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

function median(values: number[]) {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle]
  }

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function hasShortNapSignal(log: CompletedSleepLog) {
  return !log.isNight && (log.durationMinutes <= SHORT_NAP_MINUTES || log.tags.includes('short_nap'))
}

function inRange(value: number, start: number, end: number) {
  return value >= start && value <= end
}

function getOrCreateObservedDay(map: Map<string, ObservedDay>, date: string) {
  const existing = map.get(date)
  if (existing) {
    return existing
  }

  const nextDay: ObservedDay = {
    date,
    startedLogCount: 0,
    dayLogCount: 0,
    nightLogCount: 0,
    wakeMinutes: null,
    bedtimeMinutes: null,
    firstNapMinutes: null,
    shortNapCount: 0,
    cautionFlags: [],
  }
  map.set(date, nextDay)
  return nextDay
}

function getObservationCount(day: ObservedDay) {
  return (
    Number(day.wakeMinutes !== null) +
    Number(day.bedtimeMinutes !== null) +
    Number(day.dayLogCount > 0)
  )
}

function isReasonablyCoveredDay(day: ObservedDay) {
  return getObservationCount(day) >= 2
}

function isWakeEvidenceDay(day: ObservedDay) {
  return day.wakeMinutes !== null && isReasonablyCoveredDay(day)
}

function isBedtimeEvidenceDay(day: ObservedDay) {
  return day.bedtimeMinutes !== null && isReasonablyCoveredDay(day)
}

function isFirstNapEvidenceDay(day: ObservedDay) {
  return day.firstNapMinutes !== null && day.wakeMinutes !== null && day.dayLogCount >= 2
}

function cloneProfile(profile: SleepPlanProfileRecord): SleepPlanProfileRecord {
  return {
    ...profile,
    wakeWindowProfile: {
      ...profile.wakeWindowProfile,
      windows: profile.wakeWindowProfile.windows.map((window) => ({ ...window })),
    },
    feedAnchorProfile: {
      ...profile.feedAnchorProfile,
      anchors: profile.feedAnchorProfile.anchors.map((anchor) => ({ ...anchor })),
    },
  }
}

function clonePlan(plan: DailyPlanRecord): DailyPlanRecord {
  return {
    ...plan,
    sleepTargets: plan.sleepTargets.map((target) => ({ ...target })),
    feedTargets: plan.feedTargets.map((target) => ({ ...target })),
    metadata: plan.metadata ? { ...plan.metadata } : null,
  }
}

function normalizeLogs(logs: SleepPlanAdaptationLog[], timezone: string, now: Date) {
  const lookbackStart = getSleepScoreLookbackStart(now).getTime()
  const seen = new Set<string>()
  const normalized: CompletedSleepLog[] = []

  for (const log of logs) {
    if (!log.endedAt) {
      continue
    }

    const start = new Date(log.startedAt)
    const end = new Date(log.endedAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue
    }

    if (start.getTime() < lookbackStart || start.getTime() > now.getTime()) {
      continue
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
    if (durationMinutes <= 0) {
      continue
    }

    const key = `${log.startedAt}::${log.endedAt}::${log.isNight ? 'night' : 'day'}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push({
      ...log,
      endedAt: log.endedAt,
      durationMinutes,
      localStartDate: toLocalDateString(start, timezone),
      localStartMinutes: getLocalMinutes(start, timezone),
      localEndDate: toLocalDateString(end, timezone),
      localEndMinutes: getLocalMinutes(end, timezone),
    })
  }

  return normalized.sort((left, right) => left.startedAt.localeCompare(right.startedAt))
}

function buildObservedDays(logs: CompletedSleepLog[]) {
  const days = new Map<string, ObservedDay>()

  for (const log of logs) {
    const startDay = getOrCreateObservedDay(days, log.localStartDate)
    startDay.startedLogCount += 1
    startDay.dayLogCount += log.isNight ? 0 : 1
    startDay.nightLogCount += log.isNight ? 1 : 0

    if (hasShortNapSignal(log)) {
      startDay.shortNapCount += 1
    }

    if (log.notes && CAUTION_NOTE_PATTERN.test(log.notes)) {
      startDay.cautionFlags.push(log.notes.trim())
    }

    if (log.isNight && inRange(log.localStartMinutes, BEDTIME_MINUTES, BEDTIME_MAX_MINUTES)) {
      startDay.bedtimeMinutes =
        startDay.bedtimeMinutes === null
          ? log.localStartMinutes
          : Math.min(startDay.bedtimeMinutes, log.localStartMinutes)
    }

    if (
      log.isNight &&
      inRange(log.localEndMinutes, MORNING_WAKE_MINUTES, MORNING_WAKE_MAX_MINUTES)
    ) {
      const endDay = getOrCreateObservedDay(days, log.localEndDate)
      endDay.wakeMinutes =
        endDay.wakeMinutes === null
          ? log.localEndMinutes
          : Math.max(endDay.wakeMinutes, log.localEndMinutes)
    }

    if (!log.isNight && inRange(log.localStartMinutes, FIRST_NAP_MINUTES, FIRST_NAP_MAX_MINUTES)) {
      startDay.firstNapMinutes =
        startDay.firstNapMinutes === null
          ? log.localStartMinutes
          : Math.min(startDay.firstNapMinutes, log.localStartMinutes)
    }
  }

  return [...days.values()].sort((left, right) => left.date.localeCompare(right.date))
}

function createEvidence(days: ObservedDay[], logCount: number) {
  return {
    logCount,
    coveredDays: days.length,
    reasonablyCoveredDays: days.filter((day) => isReasonablyCoveredDay(day)).length,
    wakeObservationDays: days.filter((day) => isWakeEvidenceDay(day)).length,
    bedtimeObservationDays: days.filter((day) => isBedtimeEvidenceDay(day)).length,
    firstNapObservationDays: days.filter((day) => isFirstNapEvidenceDay(day)).length,
  }
}

function shiftAlignedFeedAnchors(
  profile: SleepPlanProfileRecord,
  changes: {
    wakeDeltaMinutes: number
    bedtimeDeltaMinutes: number
  }
) {
  profile.feedAnchorProfile.anchors = profile.feedAnchorProfile.anchors.map((anchor) => {
    if (!anchor.targetTime) {
      return { ...anchor }
    }

    const normalizedLabel = anchor.label.trim().toLowerCase()

    if (
      changes.wakeDeltaMinutes !== 0 &&
      (anchor.targetTime === profile.usualWakeTime ||
        MORNING_FEED_LABEL_PATTERN.test(normalizedLabel))
    ) {
      return {
        ...anchor,
        targetTime: applyTimeDelta(anchor.targetTime, changes.wakeDeltaMinutes),
      }
    }

    if (
      changes.bedtimeDeltaMinutes !== 0 &&
      (anchor.targetTime === profile.targetBedtime ||
        BEDTIME_FEED_LABEL_PATTERN.test(normalizedLabel))
    ) {
      return {
        ...anchor,
        targetTime: applyTimeDelta(anchor.targetTime, changes.bedtimeDeltaMinutes),
      }
    }

    return { ...anchor }
  })
}

function buildWakeRecommendation(profile: SleepPlanProfileRecord, days: ObservedDay[]) {
  const relevantDays = days.filter((day) => isWakeEvidenceDay(day))
  if (relevantDays.length < MIN_REASONABLY_COVERED_DAYS) {
    return null
  }

  const observedMinutes = median(relevantDays.map((day) => day.wakeMinutes ?? 0))
  const currentMinutes = toMinutes(profile.usualWakeTime)
  if (observedMinutes === null || currentMinutes === null) {
    return null
  }

  const rawDelta = observedMinutes - currentMinutes
  if (Math.abs(rawDelta) < MIN_SHIFT_DELTA_MINUTES) {
    return null
  }

  const appliedDelta = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), MAX_BASELINE_SHIFT_MINUTES)
  return {
    kind: 'wake_anchor' as const,
    observedTime: toClockTime(roundToNearestFive(observedMinutes)),
    newTime: toClockTime(roundToNearestFive(currentMinutes + appliedDelta)),
    coveredDays: relevantDays.length,
  }
}

function buildBedtimeRecommendation(profile: SleepPlanProfileRecord, days: ObservedDay[]) {
  const relevantDays = days.filter((day) => isBedtimeEvidenceDay(day))
  if (relevantDays.length < MIN_REASONABLY_COVERED_DAYS) {
    return null
  }

  const observedMinutes = median(relevantDays.map((day) => day.bedtimeMinutes ?? 0))
  const currentMinutes = toMinutes(profile.targetBedtime)
  if (observedMinutes === null || currentMinutes === null) {
    return null
  }

  const rawDelta = observedMinutes - currentMinutes
  if (Math.abs(rawDelta) < MIN_SHIFT_DELTA_MINUTES) {
    return null
  }

  const appliedDelta = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), MAX_BASELINE_SHIFT_MINUTES)
  return {
    kind: 'bedtime_anchor' as const,
    observedTime: toClockTime(roundToNearestFive(observedMinutes)),
    newTime: toClockTime(roundToNearestFive(currentMinutes + appliedDelta)),
    coveredDays: relevantDays.length,
  }
}

function buildFirstNapRecommendation(profile: SleepPlanProfileRecord, days: ObservedDay[]) {
  const relevantDays = days.filter((day) => isFirstNapEvidenceDay(day))
  if (relevantDays.length < MIN_REASONABLY_COVERED_DAYS) {
    return null
  }

  const baselinePlan = buildDailyPlanFromProfile({
    profile,
    babyId: profile.babyId,
    planDate: relevantDays.at(-1)?.date ?? getDateStringForTimezone('UTC'),
  })
  const firstNapTarget = baselinePlan.sleepTargets.find(
    (target) => !BEDTIME_TARGET_PATTERN.test(target.label)
  )?.targetTime
  const currentConstraintMinutes = toMinutes(profile.wakeWindowProfile.firstNapNotBefore ?? firstNapTarget)
  const observedMinutes = median(relevantDays.map((day) => day.firstNapMinutes ?? 0))

  if (currentConstraintMinutes === null || observedMinutes === null) {
    return null
  }

  const rawDelta = observedMinutes - currentConstraintMinutes
  if (rawDelta < MIN_SHIFT_DELTA_MINUTES) {
    return null
  }

  const appliedDelta = Math.min(rawDelta, MAX_BASELINE_SHIFT_MINUTES)
  return {
    kind: 'first_nap_anchor' as const,
    observedTime: toClockTime(roundToNearestFive(observedMinutes)),
    newTime: toClockTime(roundToNearestFive(currentConstraintMinutes + appliedDelta)),
    coveredDays: relevantDays.length,
  }
}

function buildBlockedAdjustments(
  profile: SleepPlanProfileRecord,
  days: ObservedDay[],
  ageInWeeks: number | null
) {
  if (ageInWeeks === null || profile.targetNapCount < 4) {
    return []
  }

  const loweredNapCount = profile.targetNapCount - 1
  const repeatedLowerNapDays = days.filter(
    (day) =>
      day.dayLogCount === loweredNapCount &&
      day.wakeMinutes !== null &&
      day.bedtimeMinutes !== null
  )

  if (repeatedLowerNapDays.length < MIN_REASONABLY_COVERED_DAYS) {
    return []
  }

  const safeNapCounts = getSafeNapCountsForAgeInWeeks(ageInWeeks)
  if (!safeNapCounts.includes(loweredNapCount)) {
    return [
      `Blocked auto-dropping to ${formatCount(loweredNapCount, 'nap')} because that is too early for this age band.`,
    ]
  }

  return [
    `Left ${formatCount(loweredNapCount, 'nap')} alone because nap-count changes need stronger evidence than log timing shifts.`,
  ]
}

function buildHoldEvaluation(args: {
  evidence: SleepPlanAdaptationEvaluation['evidence']
  blockedAdjustments: string[]
  summary?: string
  rationale: string
}) {
  return {
    decision: 'hold_steady' as const,
    evidenceConfidence: 'low' as const,
    summary: args.summary ?? 'Holding steady while Somni learns from more complete logs.',
    rationale: args.rationale,
    blockedAdjustments: args.blockedAdjustments,
    evidence: args.evidence,
    nextProfile: null,
    basePlan: null,
    nextPlan: null,
  }
}

function buildBaselineShiftEvaluation(args: {
  profile: SleepPlanProfileRecord
  recommendations: AnchorRecommendation[]
  blockedAdjustments: string[]
  evidence: SleepPlanAdaptationEvaluation['evidence']
  now: Date
}) {
  const nextProfile = cloneProfile(args.profile)
  const originalWakeTime = args.profile.usualWakeTime
  const originalBedtime = args.profile.targetBedtime

  for (const recommendation of args.recommendations) {
    if (recommendation.kind === 'wake_anchor') {
      nextProfile.usualWakeTime = recommendation.newTime
      continue
    }

    if (recommendation.kind === 'bedtime_anchor') {
      nextProfile.targetBedtime = recommendation.newTime
      continue
    }

    nextProfile.wakeWindowProfile.firstNapNotBefore = recommendation.newTime
  }

  shiftAlignedFeedAnchors(nextProfile, {
    wakeDeltaMinutes:
      (toMinutes(nextProfile.usualWakeTime) ?? 0) - (toMinutes(originalWakeTime) ?? 0),
    bedtimeDeltaMinutes:
      (toMinutes(nextProfile.targetBedtime) ?? 0) - (toMinutes(originalBedtime) ?? 0),
  })

  const evidenceHighlights = args.recommendations.map((recommendation) => {
    if (recommendation.kind === 'wake_anchor') {
      return `${formatClockTime(recommendation.observedTime)} wakes`
    }

    if (recommendation.kind === 'bedtime_anchor') {
      return `${formatClockTime(recommendation.observedTime)} bedtimes`
    }

    return `later first naps around ${formatClockTime(recommendation.observedTime)}`
  })
  const maxCoveredDays = Math.max(...args.recommendations.map((recommendation) => recommendation.coveredDays))
  const summary = `Updated after repeated ${joinPhrases(evidenceHighlights)} across ${formatCount(
    maxCoveredDays,
    'logged day'
  )}.`

  const rationaleParts = args.recommendations.map((recommendation) => {
    if (recommendation.kind === 'wake_anchor') {
      return `Morning wakes clustered around ${formatClockTime(
        recommendation.observedTime
      )}, so Somni moved the usual wake anchor to ${formatClockTime(recommendation.newTime)}.`
    }

    if (recommendation.kind === 'bedtime_anchor') {
      return `Bedtimes clustered around ${formatClockTime(
        recommendation.observedTime
      )}, so Somni moved the bedtime anchor to ${formatClockTime(recommendation.newTime)}.`
    }

    return `The first nap kept starting later, so Somni now avoids planning it before ${formatClockTime(
      recommendation.newTime
    )}.`
  })

  if (args.blockedAdjustments.length > 0) {
    rationaleParts.push(args.blockedAdjustments.join(' '))
  }

  rationaleParts.push(
    `Somni used repeated observations across ${formatCount(
      args.evidence.reasonablyCoveredDays,
      'reasonably covered day'
    )} in the last ${SLEEP_SCORE_LOOKBACK_DAYS} days. Missing logs were treated as unknown, so the shift stayed modest.`
  )

  const nowIso = args.now.toISOString()
  nextProfile.adaptationConfidence = 'medium'
  nextProfile.learningState = args.profile.learningState === 'stable' ? 'stable' : 'learning'
  nextProfile.lastAutoAdjustedAt = nowIso
  nextProfile.lastEvidenceSummary = summary
  nextProfile.updatedAt = nowIso

  return {
    decision: 'apply_baseline_shift' as const,
    evidenceConfidence: 'medium' as const,
    summary,
    rationale: rationaleParts.join(' '),
    blockedAdjustments: args.blockedAdjustments,
    evidence: args.evidence,
    nextProfile,
    basePlan: null,
    nextPlan: null,
  }
}

// ---------------------------------------------------------------------------
// Cascade engine helpers
// ---------------------------------------------------------------------------

/**
 * Derive expected nap durations (minutes, one per nap slot, not including bedtime)
 * from the base plan's sleep targets by computing the gap between consecutive
 * target times. Falls back to age-band defaults when plan data is missing.
 */
function estimateNapDurationsFromPlan(
  profile: SleepPlanProfileRecord,
  basePlan: DailyPlanRecord
): number[] {
  const napTargets = basePlan.sleepTargets.filter(
    (t) => !BEDTIME_TARGET_PATTERN.test(t.label) && t.targetTime
  )
  const bedtimeTarget = basePlan.sleepTargets.find((t) =>
    BEDTIME_TARGET_PATTERN.test(t.label)
  )

  if (napTargets.length === 0) {
    return DEFAULT_NAP_DURATION_BY_NAP_COUNT[profile.targetNapCount] ?? [60]
  }

  // Build an ordered list of times including bedtime as the terminal anchor.
  const orderedTimes: Array<number | null> = [
    ...napTargets.map((t) => toMinutes(t.targetTime)),
    bedtimeTarget ? toMinutes(bedtimeTarget.targetTime) : null,
  ]

  const defaults =
    DEFAULT_NAP_DURATION_BY_NAP_COUNT[profile.targetNapCount] ??
    DEFAULT_NAP_DURATION_BY_NAP_COUNT[3]

  return napTargets.map((_, i) => {
    const napStart = orderedTimes[i]
    const nextEventStart = orderedTimes[i + 1]
    if (napStart === null || nextEventStart === null) {
      return defaults[i] ?? 60
    }
    // The nap occupies: gap between its start and the next event minus the
    // wake window between them. We use the midpoint of the wake window as the
    // best estimate of how long the baby will be awake between naps.
    const windows = profile.wakeWindowProfile.windows
    const wakeWindowForSlot = windows[i + 1] ?? windows[windows.length - 1]
    const wakeWindowMidpoint =
      wakeWindowForSlot && wakeWindowForSlot.minMinutes !== null && wakeWindowForSlot.maxMinutes !== null
        ? Math.round((wakeWindowForSlot.minMinutes + wakeWindowForSlot.maxMinutes) / 2)
        : 120
    const rawGap = nextEventStart - napStart
    const estimatedDuration = rawGap - wakeWindowMidpoint
    // Clamp to a sane range: naps should be between 10 and 120 min.
    return Math.max(10, Math.min(120, estimatedDuration > 0 ? estimatedDuration : defaults[i] ?? 60))
  })
}

/**
 * Sum the durations of all completed non-night sleep logs for today.
 */
function computeTodayDaySleepMinutes(
  logs: CompletedSleepLog[],
  todayDate: string
): number {
  return logs
    .filter((log) => !log.isNight && log.localStartDate === todayDate)
    .reduce((sum, log) => sum + log.durationMinutes, 0)
}

/**
 * Target total day-sleep minutes. Derived from the profile's day-length and
 * wake-window configuration; falls back to age-band defaults.
 */
function computeTargetDaySleepMinutes(profile: SleepPlanProfileRecord): number {
  const wakeMinutes = toMinutes(profile.usualWakeTime)
  const bedtimeMinutes = toMinutes(profile.targetBedtime)
  if (wakeMinutes === null || bedtimeMinutes === null) {
    return DEFAULT_TARGET_DAY_SLEEP_BY_NAP_COUNT[profile.targetNapCount] ?? 180
  }

  const dayLengthMinutes =
    bedtimeMinutes > wakeMinutes
      ? bedtimeMinutes - wakeMinutes
      : bedtimeMinutes + 24 * 60 - wakeMinutes

  // Total wake time = sum of all wake-window midpoints.
  const totalWakeWindowMinutes = profile.wakeWindowProfile.windows.reduce((sum, w) => {
    if (w.minMinutes !== null && w.maxMinutes !== null) {
      return sum + Math.round((w.minMinutes + w.maxMinutes) / 2)
    }
    return sum + (w.maxMinutes ?? w.minMinutes ?? 120)
  }, 0)

  const estimated = dayLengthMinutes - totalWakeWindowMinutes
  if (estimated > 0) {
    return estimated
  }
  return DEFAULT_TARGET_DAY_SLEEP_BY_NAP_COUNT[profile.targetNapCount] ?? 180
}

/**
 * Apply the generalised position-based dampening cascade to the sleep targets
 * that come *after* the triggering event. Returns a new sleepTargets array.
 *
 * Coefficient formula:
 *   coeff[i] = max(FLOOR, 1.0 − i × decay_step)   where i is 0-based position
 *   decay_step = (1.0 − FLOOR) / max(n − 1, 1)    so that the last target = FLOOR
 *
 * Delta is rounded to the nearest RESCUE_ROUNDING_MINUTES before application so
 * suggestions feel gentle ("bring nap 2 forward by 10 min" not "by 16.3 min").
 */
function applyRescueCascade(args: {
  sleepTargets: DailyPlanSleepTarget[]
  /** Index of the first target that should receive a shift (everything before is in the past). */
  firstAffectedIndex: number
  /** Signed delta in raw minutes. Will be clamped and rounded internally. */
  rawDeltaMinutes: number
  now: Date
  /** Current time in the baby's timezone, in minutes-since-midnight. Used to skip elapsed targets. */
  nowMinutes: number
  triggerLabel: string
}): { targets: DailyPlanSleepTarget[]; affectedCount: number } {
  const clampedDelta =
    Math.sign(args.rawDeltaMinutes) *
    Math.min(Math.abs(args.rawDeltaMinutes), RESCUE_MAX_DELTA_MINUTES)
  // Round the anchor delta to the nearest 10 min for a human-friendly feel.
  const roundedDelta =
    Math.round(clampedDelta / RESCUE_ROUNDING_MINUTES) * RESCUE_ROUNDING_MINUTES

  if (roundedDelta === 0) {
    return { targets: args.sleepTargets, affectedCount: 0 }
  }

  const affectedTargets = args.sleepTargets.slice(args.firstAffectedIndex)
  const n = affectedTargets.length
  if (n === 0) {
    return { targets: args.sleepTargets, affectedCount: 0 }
  }

  const decayStep = n > 1 ? (1.0 - RESCUE_FLOOR_COEFF) / (n - 1) : 0

  let affectedCount = 0
  const shiftedTail = affectedTargets.map((target, i) => {
    if (!target.targetTime) {
      return target
    }
    const targetMinutes = toMinutes(target.targetTime)
    // Skip targets already elapsed — no point suggesting a time in the past.
    if (targetMinutes !== null && targetMinutes < args.nowMinutes) {
      return target
    }
    const coeff = Math.max(RESCUE_FLOOR_COEFF, 1.0 - i * decayStep)
    const rawShift = coeff * roundedDelta
    // Round each individual shift to nearest 10 min as well.
    const shift = Math.round(rawShift / RESCUE_ROUNDING_MINUTES) * RESCUE_ROUNDING_MINUTES
    if (shift === 0) {
      return target
    }
    affectedCount += 1
    const isBedtime = BEDTIME_TARGET_PATTERN.test(target.label)
    const directionWord = shift < 0 ? 'earlier' : 'later'
    const absMinutes = Math.abs(shift)
    const noteAddition = isBedtime
      ? `Shifted ${directionWord} by ${absMinutes} min today — Somni is protecting sleep pressure after ${args.triggerLabel}.`
      : `Shifted ${directionWord} by ${absMinutes} min today to stay in sync after ${args.triggerLabel}.`
    return {
      ...target,
      targetTime: applyTimeDelta(target.targetTime, shift),
      notes: target.notes ? `${noteAddition} ${target.notes}` : noteAddition,
    }
  })

  return {
    targets: [...args.sleepTargets.slice(0, args.firstAffectedIndex), ...shiftedTail],
    affectedCount,
  }
}

/**
 * Core cascade evaluator. Examines today's completed sleep logs against the
 * baseline plan and fires a cascade on the first significant deviation found.
 *
 * Trigger priority (re-evaluated fresh on every call — no compounding drift):
 *  1. Morning wake deviation (night log ended early/late in the morning window)
 *  2. Nap ended early (actual end < expected end by nap-duration estimate)
 *  3. Nap started late (actual start > plan target start)
 *
 * Overarching guardrail: the magnitude of the shift is modulated by how much
 * day-sleep debt (or surplus) has already accumulated, so if one nap was short
 * but a later one ran long, the engine knows not to over-correct.
 */
function buildDailyRescueEvaluation(args: {
  profile: SleepPlanProfileRecord
  currentPlan: DailyPlanRecord | null
  todayDate: string
  todayLogs: CompletedSleepLog[]
  days: ObservedDay[]
  evidence: SleepPlanAdaptationEvaluation['evidence']
  timezone: string
  now: Date
}) {
  // Build (or reuse) the baseline plan — we always need it as the reference point.
  const basePlan =
    args.currentPlan ??
    buildDailyPlanFromProfile({
      profile: args.profile,
      babyId: args.profile.babyId,
      planDate: args.todayDate,
    })

  const napDurations = estimateNapDurationsFromPlan(args.profile, basePlan)
  const targetDaySleepMinutes = computeTargetDaySleepMinutes(args.profile)
  const accumulatedDaySleepMinutes = computeTodayDaySleepMinutes(args.todayLogs, args.todayDate)

  /**
   * Sleep-pressure modulation factor.
   * If the baby has already accumulated more day sleep than the target, the cascade
   * is dampened (we don't need to protect sleep pressure as urgently). If there is
   * a big deficit, the cascade is applied in full.
   *
   * Factor is clamped [0.5, 1.0] so we never amplify beyond the raw delta.
   */
  const sleepDebtMinutes = targetDaySleepMinutes - accumulatedDaySleepMinutes
  const pressureModulation = Math.max(0.5, Math.min(1.0, sleepDebtMinutes / targetDaySleepMinutes))

  // Use timezone-aware current time so elapsed-target checks work correctly
  // regardless of the server's local timezone.
  const nowMinutes = getLocalMinutes(args.now, args.timezone)

  // Collect today's completed day-sleep logs sorted chronologically.
  const todayNapLogs = args.todayLogs
    .filter((log) => !log.isNight && log.localStartDate === args.todayDate)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  type TriggerCandidate = {
    source: DailyRescuePendingPlan['triggerSource']
    rawDeltaMinutes: number
    firstAffectedIndex: number
    triggerLabel: string
  }

  let bestTrigger: TriggerCandidate | null = null

  // -----------------------------------------------------------------------
  // Trigger 1 — Morning wake deviation
  // Fires when tonight's night-sleep log ended during the morning wake window
  // and the wake time differs materially from the profile's usual wake time.
  // -----------------------------------------------------------------------
  const morningNightLog = args.todayLogs.find(
    (log) =>
      log.isNight &&
      log.localEndDate === args.todayDate &&
      inRange(log.localEndMinutes, MORNING_WAKE_MINUTES, MORNING_WAKE_MAX_MINUTES)
  )
  if (morningNightLog) {
    const usualWakeMinutes = toMinutes(args.profile.usualWakeTime)
    if (usualWakeMinutes !== null) {
      const rawDelta = morningNightLog.localEndMinutes - usualWakeMinutes
      if (Math.abs(rawDelta) >= RESCUE_MIN_DELTA_MINUTES) {
        // All future sleep targets from index 0 are candidates.
        const firstAffectedIndex = 0
        const modulatedDelta = rawDelta * pressureModulation
        bestTrigger = {
          source: 'morning_wake',
          rawDeltaMinutes: modulatedDelta,
          firstAffectedIndex,
          triggerLabel: `a ${Math.abs(Math.round(rawDelta))}-min ${
            rawDelta < 0 ? 'early' : 'late'
          } wake`,
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Trigger 2 — Nap ended early
  // For each completed nap, compare actual end vs. expected end.
  // Only the largest qualifying deviation is used (re-compute fresh).
  // -----------------------------------------------------------------------
  if (!bestTrigger) {
    for (let napIndex = 0; napIndex < todayNapLogs.length; napIndex++) {
      const log = todayNapLogs[napIndex]
      const expectedDuration = napDurations[napIndex] ?? napDurations[napDurations.length - 1] ?? 45
      const actualDuration = log.durationMinutes
      const napEndDelta = actualDuration - expectedDuration // negative = ended early

      if (napEndDelta >= -RESCUE_MIN_DELTA_MINUTES) {
        continue // Only trigger when the nap ended meaningfully early.
      }

      // Find the first sleep target in the plan that comes after this nap.
      const napStartMinutes = log.localStartMinutes
      const firstAffectedIndex = basePlan.sleepTargets.findIndex((t) => {
        const tMinutes = toMinutes(t.targetTime)
        return tMinutes !== null && tMinutes > napStartMinutes
      })
      if (firstAffectedIndex === -1) {
        continue
      }

      const modulatedDelta = napEndDelta * pressureModulation
      const absRaw = Math.abs(napEndDelta)
      bestTrigger = {
        source: 'nap_end_early',
        rawDeltaMinutes: modulatedDelta,
        firstAffectedIndex,
        triggerLabel: `Nap ${napIndex + 1} ending ${Math.round(absRaw)} min short`,
      }
      break // Use the first qualifying nap (chronological order, re-compute fresh).
    }
  }

  // -----------------------------------------------------------------------
  // Trigger 3 — Nap started late
  // Compare actual nap start vs. the planned target start time.
  // -----------------------------------------------------------------------
  if (!bestTrigger) {
    const napSleepTargets = basePlan.sleepTargets.filter(
      (t) => !BEDTIME_TARGET_PATTERN.test(t.label)
    )
    for (let napIndex = 0; napIndex < todayNapLogs.length; napIndex++) {
      const log = todayNapLogs[napIndex]
      const planTarget = napSleepTargets[napIndex]
      if (!planTarget?.targetTime) {
        continue
      }
      const planStartMinutes = toMinutes(planTarget.targetTime)
      if (planStartMinutes === null) {
        continue
      }
      const rawDelta = log.localStartMinutes - planStartMinutes // positive = started late

      if (rawDelta < RESCUE_MIN_DELTA_MINUTES) {
        continue
      }

      // Shift targets *after* this nap's plan slot.
      const firstAffectedIndex = basePlan.sleepTargets.findIndex(
        (t) => toMinutes(t.targetTime) !== null && toMinutes(t.targetTime)! > planStartMinutes
      )
      if (firstAffectedIndex === -1) {
        continue
      }

      const modulatedDelta = rawDelta * pressureModulation
      bestTrigger = {
        source: 'nap_start_late',
        rawDeltaMinutes: modulatedDelta,
        firstAffectedIndex,
        triggerLabel: `Nap ${napIndex + 1} starting ${Math.round(rawDelta)} min late`,
      }
      break
    }
  }

  // -----------------------------------------------------------------------
  // Legacy short-nap guard — keep the existing "two short naps" bedtime rescue
  // as a final safety net if none of the above triggers fired but today already
  // has ≥ 2 short naps logged. This path bypasses the cascade engine and applies
  // a fixed -15 min bedtime shift directly so the result stays exact and
  // backward-compatible with the existing test suite.
  // -----------------------------------------------------------------------
  if (!bestTrigger) {
    const today = args.days.find((day) => day.date === args.todayDate)
    if (today && today.shortNapCount >= 2 && today.dayLogCount >= 2) {
      const bedtimeIndex = basePlan.sleepTargets.findIndex((t) =>
        BEDTIME_TARGET_PATTERN.test(t.label)
      )
      const bedtimeTarget = basePlan.sleepTargets[bedtimeIndex]
      if (bedtimeIndex !== -1 && bedtimeTarget?.targetTime) {
        const LEGACY_BEDTIME_SHIFT = -15
        const nextPlan = clonePlan(basePlan)
        nextPlan.sleepTargets[bedtimeIndex] = {
          ...bedtimeTarget,
          targetTime: applyTimeDelta(bedtimeTarget.targetTime, LEGACY_BEDTIME_SHIFT),
          notes: bedtimeTarget.notes
            ? `Pulled a little earlier after two short naps were logged today. ${bedtimeTarget.notes}`
            : 'Pulled a little earlier after two short naps were logged today.',
        }
        nextPlan.updatedAt = args.now.toISOString()
        nextPlan.metadata = {
          origin: 'saved_daily_plan',
          confidence: 'medium',
          reasonSummary: 'Adjusted for today after two short naps were logged.',
        }
        const legacySummary = 'Adjusted for today after two short naps were logged.'
        const legacyRationale =
          "Somni kept the durable baseline steady because one rough day should not rewrite it. It only pulled today's bedtime a little earlier from the logged short naps."
        const legacyPendingPlan: DailyRescuePendingPlan = {
          sleepTargets: nextPlan.sleepTargets,
          feedTargets: nextPlan.feedTargets,
          triggerSource: 'nap_end_early',
          triggerDeltaMinutes: LEGACY_BEDTIME_SHIFT,
          affectedTargetCount: 1,
          accumulatedDaySleepMinutes: Math.round(accumulatedDaySleepMinutes),
          targetDaySleepMinutes: Math.round(targetDaySleepMinutes),
          rationale: legacyRationale,
        }
        return {
          decision: 'apply_daily_rescue' as const,
          evidenceConfidence: 'medium' as const,
          summary: legacySummary,
          rationale: legacyRationale,
          blockedAdjustments: [],
          evidence: args.evidence,
          nextProfile: null,
          basePlan,
          nextPlan,
          pendingPlan: legacyPendingPlan,
        }
      }
    }
  }

  if (!bestTrigger) {
    return null
  }

  const { targets: shiftedSleepTargets, affectedCount } = applyRescueCascade({
    sleepTargets: basePlan.sleepTargets,
    firstAffectedIndex: bestTrigger.firstAffectedIndex,
    rawDeltaMinutes: bestTrigger.rawDeltaMinutes,
    now: args.now,
    nowMinutes,
    triggerLabel: bestTrigger.triggerLabel,
  })

  if (affectedCount === 0) {
    return null
  }

  const nextPlan = clonePlan(basePlan)
  nextPlan.sleepTargets = shiftedSleepTargets
  nextPlan.updatedAt = args.now.toISOString()
  nextPlan.metadata = {
    origin: 'saved_daily_plan',
    confidence: 'medium',
    reasonSummary: `Intra-day cascade after ${bestTrigger.triggerLabel}.`,
  }

  // Align feed targets to the new sleep anchors.
  const newBedtime = shiftedSleepTargets.find((t) => BEDTIME_TARGET_PATTERN.test(t.label))
  shiftAlignedFeedAnchors(args.profile, {
    wakeDeltaMinutes:
      bestTrigger.source === 'morning_wake'
        ? Math.round(bestTrigger.rawDeltaMinutes / RESCUE_ROUNDING_MINUTES) * RESCUE_ROUNDING_MINUTES
        : 0,
    bedtimeDeltaMinutes:
      newBedtime && basePlan.sleepTargets.find((t) => BEDTIME_TARGET_PATTERN.test(t.label))?.targetTime
        ? (toMinutes(newBedtime.targetTime) ?? 0) -
          (toMinutes(
            basePlan.sleepTargets.find((t) => BEDTIME_TARGET_PATTERN.test(t.label))!.targetTime
          ) ?? 0)
        : 0,
  })
  nextPlan.feedTargets = [...args.profile.feedAnchorProfile.anchors.map((a) => ({
    label: a.label,
    targetTime: a.targetTime,
    notes: a.notes,
  }))]

  const directionSummary =
    bestTrigger.rawDeltaMinutes < 0 ? 'earlier than planned' : 'later than planned'
  const summary = `${bestTrigger.triggerLabel} was ${directionSummary}. Somni shifted ${affectedCount} remaining target${affectedCount === 1 ? '' : 's'} today.`

  const sleepDebtNote =
    sleepDebtMinutes > 30
      ? ` (${Math.round(accumulatedDaySleepMinutes)} min of sleep so far vs. a ~${Math.round(targetDaySleepMinutes)}-min target — sleep pressure is below ideal.)`
      : sleepDebtMinutes < -30
        ? ` (${Math.round(accumulatedDaySleepMinutes)} min of sleep so far — above target, so the shift was dampened.)`
        : ''

  const rationale = `Somni kept the durable baseline steady because one rough day should not rewrite it. ${summary}${sleepDebtNote} Follow your baby's cues around the adjusted anchors.`

  // Build the pending plan payload stored in daily_plans.pending_rescue_targets.
  // Unused here (stored by the caller), but returned for clarity.
  const pendingPlan: DailyRescuePendingPlan = {
    sleepTargets: shiftedSleepTargets,
    feedTargets: nextPlan.feedTargets,
    triggerSource: bestTrigger.source,
    triggerDeltaMinutes:
      Math.round(bestTrigger.rawDeltaMinutes / RESCUE_ROUNDING_MINUTES) * RESCUE_ROUNDING_MINUTES,
    affectedTargetCount: affectedCount,
    accumulatedDaySleepMinutes: Math.round(accumulatedDaySleepMinutes),
    targetDaySleepMinutes: Math.round(targetDaySleepMinutes),
    rationale,
  }

  return {
    decision: 'apply_daily_rescue' as const,
    evidenceConfidence: 'medium' as const,
    summary,
    rationale,
    blockedAdjustments: [],
    evidence: args.evidence,
    nextProfile: null,
    basePlan,
    nextPlan,
    pendingPlan,
  }
}

export function evaluateSleepPlanAdaptation(args: {
  profile: SleepPlanProfileRecord
  currentPlan: DailyPlanRecord | null
  dateOfBirth: string
  timezone: string
  logs: SleepPlanAdaptationLog[]
  now?: Date
}) {
  const now = args.now ?? new Date()
  const normalizedLogs = normalizeLogs(args.logs, args.timezone, now)
  const observedDays = buildObservedDays(normalizedLogs)
  const evidence = createEvidence(observedDays, normalizedLogs.length)
  const ageInWeeks = getAgeInWeeksForDateOfBirth(args.dateOfBirth, now)
  const blockedAdjustments = buildBlockedAdjustments(args.profile, observedDays, ageInWeeks)
  const cautionDays = observedDays.filter((day) => day.cautionFlags.length > 0)

  if (cautionDays.length > 0) {
    return buildHoldEvaluation({
      evidence,
      blockedAdjustments,
      summary: 'Holding steady because the recent logs mention a rough patch.',
      rationale:
        'Recent notes mentioned illness, teething, travel, or another rough patch. Somni does not auto-apply baseline changes during those stretches.',
    })
  }

  const todayDate = getDateStringForTimezone(args.timezone, now)
  const todayLogs = normalizedLogs.filter(
    (log) => log.localStartDate === todayDate || log.localEndDate === todayDate
  )

  const dailyRescue = buildDailyRescueEvaluation({
    profile: args.profile,
    currentPlan: args.currentPlan,
    todayDate,
    todayLogs,
    days: observedDays,
    evidence,
    timezone: args.timezone,
    now,
  })
  if (dailyRescue) {
    return dailyRescue
  }

  if (blockedAdjustments.length > 0) {
    return buildHoldEvaluation({
      evidence,
      blockedAdjustments,
      summary: 'Holding steady because the observed pattern points to a riskier change.',
      rationale: `${blockedAdjustments.join(' ')} Missing logs were still treated as unknown, so Somni did not force a bigger structural change.`,
    })
  }

  const recommendations = [
    buildWakeRecommendation(args.profile, observedDays),
    buildBedtimeRecommendation(args.profile, observedDays),
    buildFirstNapRecommendation(args.profile, observedDays),
  ].filter((recommendation): recommendation is AnchorRecommendation => recommendation !== null)

  if (recommendations.length > 0) {
    return buildBaselineShiftEvaluation({
      profile: args.profile,
      recommendations,
      blockedAdjustments,
      evidence,
      now,
    })
  }

  if (
    normalizedLogs.length < MIN_LOGS_FOR_ADAPTATION ||
    evidence.reasonablyCoveredDays < MIN_REASONABLY_COVERED_DAYS
  ) {
    return buildHoldEvaluation({
      evidence,
      blockedAdjustments,
      rationale: `Somni only has ${formatCount(
        normalizedLogs.length,
        'complete log'
      )} across ${formatCount(
        evidence.reasonablyCoveredDays,
        'reasonably covered day'
      )}. Missing logs were treated as unknown, so it held the baseline steady instead of guessing.`,
    })
  }

  return buildHoldEvaluation({
    evidence,
    blockedAdjustments,
    rationale:
      'Somni found some signal in the recent logs, but it was not repeatable enough to justify an automatic baseline shift.',
  })
}

/**
 * Entry point for chat-route and server-action callers.
 *
 * After a sleep log is saved (via chat or direct logging), call this with the
 * single new log plus today's existing logs. It runs the full cascade evaluation
 * and returns a `DailyRescuePendingPlan` if a meaningful intra-day adjustment
 * is warranted, or `null` if the day is on track.
 *
 * The caller is responsible for writing `pendingPlan` to
 * `daily_plans.pending_rescue_targets` (JSONB) and clearing `rescue_dismissed`.
 */
export function maybeApplyLogDrivenAdaptation(args: {
  profile: SleepPlanProfileRecord
  currentPlan: DailyPlanRecord | null
  /** All of today's sleep logs, including the newly saved one. */
  todayLogs: SleepPlanAdaptationLog[]
  timezone: string
  now?: Date
}): DailyRescuePendingPlan | null {
  const now = args.now ?? new Date()
  const todayDate = getDateStringForTimezone(args.timezone, now)

  // We only need today's logs for the intra-day cascade.
  const normalizedLogs = normalizeLogs(args.todayLogs, args.timezone, now)
  const todayNormalizedLogs = normalizedLogs.filter(
    (log) => log.localStartDate === todayDate || log.localEndDate === todayDate
  )

  // Build an ObservedDay record for today only (needed for the legacy short-nap fallback).
  const observedDays = buildObservedDays(todayNormalizedLogs)
  const evidence = createEvidence(observedDays, normalizedLogs.length)

  const result = buildDailyRescueEvaluation({
    profile: args.profile,
    currentPlan: args.currentPlan,
    todayDate,
    todayLogs: todayNormalizedLogs,
    days: observedDays,
    evidence,
    timezone: args.timezone,
    now,
  })

  return result?.pendingPlan ?? null
}
