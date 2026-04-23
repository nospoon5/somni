import type { DailyPlanRecord } from './daily-plan'
import { getDateStringForTimezone } from './daily-plan'
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

export type SleepPlanAdaptationDecision =
  | 'hold_steady'
  | 'apply_daily_rescue'
  | 'apply_baseline_shift'

export type SleepPlanAdaptationLog = SleepLogLike & {
  notes?: string | null
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
const DAILY_RESCUE_BEDTIME_SHIFT_MINUTES = 15
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

function getTimeZoneParts(timezone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    second: Number(read('second')),
  }
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

function buildDailyRescueEvaluation(args: {
  profile: SleepPlanProfileRecord
  currentPlan: DailyPlanRecord | null
  todayDate: string
  days: ObservedDay[]
  evidence: SleepPlanAdaptationEvaluation['evidence']
  now: Date
}) {
  if (args.currentPlan) {
    return null
  }

  const today = args.days.find((day) => day.date === args.todayDate)
  if (!today || today.shortNapCount < 2 || today.dayLogCount < 2) {
    return null
  }

  const basePlan = buildDailyPlanFromProfile({
    profile: args.profile,
    babyId: args.profile.babyId,
    planDate: args.todayDate,
  })
  const nextPlan = clonePlan(basePlan)
  const bedtimeIndex = nextPlan.sleepTargets.findIndex((target) => BEDTIME_TARGET_PATTERN.test(target.label))
  if (bedtimeIndex === -1) {
    return null
  }

  const bedtimeTarget = nextPlan.sleepTargets[bedtimeIndex]
  if (!bedtimeTarget.targetTime) {
    return null
  }

  const nextBedtime = applyTimeDelta(bedtimeTarget.targetTime, -DAILY_RESCUE_BEDTIME_SHIFT_MINUTES)
  nextPlan.sleepTargets[bedtimeIndex] = {
    ...bedtimeTarget,
    targetTime: nextBedtime,
    notes: bedtimeTarget.notes
      ? `Pulled a little earlier after two short naps were logged today. ${bedtimeTarget.notes}`
      : 'Pulled a little earlier after two short naps were logged today.',
  }
  nextPlan.notes = nextPlan.notes
    ? `Today only: Somni pulled bedtime slightly earlier after two short naps were logged. ${nextPlan.notes}`
    : 'Today only: Somni pulled bedtime slightly earlier after two short naps were logged.'
  nextPlan.updatedAt = args.now.toISOString()
  nextPlan.metadata = {
    origin: 'saved_daily_plan',
    confidence: 'medium',
    reasonSummary: 'Adjusted for today after two short naps were logged.',
  }

  return {
    decision: 'apply_daily_rescue' as const,
    evidenceConfidence: 'medium' as const,
    summary: 'Adjusted for today after two short naps were logged.',
    rationale:
      "Somni kept the durable baseline steady because one rough day should not rewrite it. It only pulled today's bedtime a little earlier from the logged short naps.",
    blockedAdjustments: [],
    evidence: args.evidence,
    nextProfile: null,
    basePlan,
    nextPlan,
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

  const dailyRescue = buildDailyRescueEvaluation({
    profile: args.profile,
    currentPlan: args.currentPlan,
    todayDate: getDateStringForTimezone(args.timezone, now),
    days: observedDays,
    evidence,
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
