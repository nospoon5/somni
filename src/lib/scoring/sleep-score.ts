export type SleepLogLike = {
  startedAt: string
  endedAt: string | null
  isNight: boolean
  tags: string[]
}

export type SleepScoreDataState = 'empty' | 'sparse' | 'ready'

export type SleepScoreSummary = {
  hasData: boolean
  hasScore: boolean
  dataState: SleepScoreDataState
  ageBand: string
  totalScore: number | null
  statusLabel: string
  strongestArea: string
  biggestChallenge: string
  tonightFocus: string
  explanation: string
  observedSleepHours: number
  targetSleepHours: number
  coverageDays: number
  logCount: number
  clarifyingQuestions: string[]
  breakdown: {
    nightSleep: number
    daySleep: number
    totalSleep: number
    settling: number
  }
}

type EffectiveSleepLog = SleepLogLike & {
  durationMinutes: number
}

type SleepTargets = {
  ageBand: string
  totalHoursPerDay: number
  nightHoursPerDay: number
  dayHoursPerDay: number
}

export const SLEEP_SCORE_LOOKBACK_DAYS = 7
export const SLEEP_SCORE_FETCH_LIMIT = 64

const MIN_COVERED_DAYS_FOR_SCORE = 3
const MIN_LOGS_FOR_SCORE = 4
const POSITIVE_SETTLING_TAGS = new Set(['easy_settle', 'self_settled'])
const NEGATIVE_SETTLING_TAGS = new Set([
  'hard_settle',
  'needed_help',
  'false_start',
  'short_nap',
])

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getDurationMinutes(log: SleepLogLike, now: Date) {
  const start = new Date(log.startedAt).getTime()
  const end = log.endedAt ? new Date(log.endedAt).getTime() : now.getTime()
  const durationMinutes = (end - start) / 60000

  if (durationMinutes <= 0) {
    return 0
  }

  return Math.max(1, Math.round(durationMinutes))
}

function getAgeInMonths(dateOfBirth: string, now: Date) {
  const dob = new Date(dateOfBirth)
  const years = now.getFullYear() - dob.getFullYear()
  const months = now.getMonth() - dob.getMonth()
  const adjustedMonths =
    years * 12 + months - (now.getDate() < dob.getDate() ? 1 : 0)

  return Math.max(0, adjustedMonths)
}

export function getSleepScoreLookbackStart(now = new Date()) {
  return new Date(now.getTime() - SLEEP_SCORE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
}

export function getAgeBand(dateOfBirth: string, now = new Date()) {
  const ageMonths = getAgeInMonths(dateOfBirth, now)

  if (ageMonths < 4) {
    return '0-3 months'
  }

  if (ageMonths < 7) {
    return '4-6 months'
  }

  if (ageMonths < 13) {
    return '6-12 months'
  }

  return '12 months+'
}

function getTargetsForAgeBand(ageBand: string): SleepTargets {
  switch (ageBand) {
    case '0-3 months':
      return {
        ageBand,
        totalHoursPerDay: 15.5,
        nightHoursPerDay: 9,
        dayHoursPerDay: 6.5,
      }
    case '4-6 months':
      return {
        ageBand,
        totalHoursPerDay: 14.5,
        nightHoursPerDay: 10,
        dayHoursPerDay: 4.5,
      }
    case '6-12 months':
      return {
        ageBand,
        totalHoursPerDay: 13.5,
        nightHoursPerDay: 10.5,
        dayHoursPerDay: 3,
      }
    default:
      return {
        ageBand: '12 months+',
        totalHoursPerDay: 12.5,
        nightHoursPerDay: 11,
        dayHoursPerDay: 1.5,
      }
  }
}

function scoreAgainstTarget(actualPerDay: number, targetPerDay: number) {
  if (targetPerDay <= 0) {
    return 0
  }

  const distance = Math.abs(actualPerDay - targetPerDay) / targetPerDay
  return clampScore(100 - distance * 100)
}

function scoreSettling(logs: SleepLogLike[]) {
  let positive = 0
  let negative = 0

  for (const log of logs) {
    for (const tag of log.tags) {
      if (POSITIVE_SETTLING_TAGS.has(tag)) {
        positive += 1
      }

      if (NEGATIVE_SETTLING_TAGS.has(tag)) {
        negative += 1
      }
    }
  }

  const total = positive + negative

  if (total === 0) {
    return 60
  }

  return clampScore((positive / total) * 100)
}

function getCoveredDays(logs: EffectiveSleepLog[]) {
  return new Set(logs.map((log) => log.startedAt.slice(0, 10))).size
}

function getClarifyingQuestions(hasNightData: boolean, hasDayData: boolean) {
  const questions: string[] = []

  if (!hasNightData) {
    questions.push('Was the hardest stretch overnight, or have you mostly logged naps so far?')
  }

  if (!hasDayData) {
    questions.push('How are naps going right now: easy, short, skipped, or very inconsistent?')
  }

  questions.push('Is the main problem falling asleep, staying asleep, or waking too early?')
  questions.push('Were feeds, teething, illness, travel, or daycare part of these sleeps?')
  questions.push('Do these logs look like a usual few days for your baby, or an unusually rough patch?')

  return questions.slice(0, 3)
}

function getStatusLabel(totalScore: number) {
  if (totalScore >= 85) {
    return 'Steady rhythm'
  }

  if (totalScore >= 72) {
    return 'Building rhythm'
  }

  if (totalScore >= 60) {
    return 'Mixed pattern'
  }

  return 'Tough stretch'
}

function getTonightFocus(lowestArea: keyof SleepScoreSummary['breakdown']) {
  switch (lowestArea) {
    case 'nightSleep':
      return 'Keep bedtime calm and respond in the same simple way overnight.'
    case 'daySleep':
      return 'Protect nap windows a little earlier before overtiredness builds.'
    case 'totalSleep':
      return 'Look for one small way to increase sleep opportunity today.'
    case 'settling':
    default:
      return 'Keep the wind-down short, familiar, and easy to repeat.'
  }
}

function getAreaLabel(area: keyof SleepScoreSummary['breakdown']) {
  switch (area) {
    case 'nightSleep':
      return 'Night sleep'
    case 'daySleep':
      return 'Day sleep'
    case 'totalSleep':
      return 'Total sleep'
    case 'settling':
      return 'Settling'
  }
}

function normalizeSleepLogs(logs: SleepLogLike[], now: Date) {
  const lookbackStart = getSleepScoreLookbackStart(now).getTime()
  const seen = new Set<string>()
  const effectiveLogs: EffectiveSleepLog[] = []

  for (const log of logs) {
    const start = new Date(log.startedAt).getTime()

    if (!Number.isFinite(start) || start < lookbackStart || start > now.getTime()) {
      continue
    }

    const durationMinutes = getDurationMinutes(log, now)

    if (durationMinutes <= 0) {
      continue
    }

    const key = `${log.startedAt}::${log.endedAt ?? 'active'}::${log.isNight ? 'night' : 'day'}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    effectiveLogs.push({
      ...log,
      durationMinutes,
    })
  }

  return effectiveLogs
}

function createEmptySummary(targets: SleepTargets): SleepScoreSummary {
  return {
    hasData: false,
    hasScore: false,
    dataState: 'empty',
    ageBand: targets.ageBand,
    totalScore: null,
    statusLabel: 'No score yet',
    strongestArea: 'Log your first sleep',
    biggestChallenge: 'There is not enough history yet for a fair read',
    tonightFocus: 'Start with the next sleep you can catch. Close enough is still useful.',
    explanation:
      'Somni needs a little real sleep history before it can judge patterns fairly.',
    observedSleepHours: 0,
    targetSleepHours: targets.totalHoursPerDay,
    coverageDays: 0,
    logCount: 0,
    clarifyingQuestions: [
      'Is the hardest part bedtime, naps, overnight wakes, or early mornings?',
      'What have you already tried that helped a little, even once?',
      'Is today a fairly normal day for your baby, or a rough outlier?',
    ],
    breakdown: {
      nightSleep: 0,
      daySleep: 0,
      totalSleep: 0,
      settling: 60,
    },
  }
}

function createSparseSummary(
  targets: SleepTargets,
  effectiveLogs: EffectiveSleepLog[],
  nightMinutes: number,
  dayMinutes: number,
  totalMinutes: number,
  breakdown: SleepScoreSummary['breakdown']
): SleepScoreSummary {
  const coverageDays = getCoveredDays(effectiveLogs)
  const hasNightData = nightMinutes > 0
  const hasDayData = dayMinutes > 0

  let tonightFocus =
    'For now, keep the next sleep calm, repeatable, and a touch earlier if your baby seems wound up.'

  if (!hasNightData) {
    tonightFocus =
      'If you can, log the next overnight stretch. Night sleep gives Somni the clearest signal.'
  } else if (!hasDayData) {
    tonightFocus =
      'If you can, add one or two naps. Day sleep helps Somni tell overtiredness from a rough night.'
  }

  return {
    hasData: true,
    hasScore: false,
    dataState: 'sparse',
    ageBand: targets.ageBand,
    totalScore: null,
    statusLabel: 'Learning your rhythm',
    strongestArea: 'Too early to call',
    biggestChallenge: 'Not enough coverage for a fair score yet',
    tonightFocus,
    explanation: `Somni has ${effectiveLogs.length} sleep log${
      effectiveLogs.length === 1 ? '' : 's'
    } across ${coverageDays} covered day${
      coverageDays === 1 ? '' : 's'
    }. That is enough for a gentle starting read, but not enough for a fair score yet.`,
    observedSleepHours: Math.round((totalMinutes / 60) * 10) / 10,
    targetSleepHours: targets.totalHoursPerDay,
    coverageDays,
    logCount: effectiveLogs.length,
    clarifyingQuestions: getClarifyingQuestions(hasNightData, hasDayData),
    breakdown,
  }
}

export function buildSleepScorePromptSummary(summary: SleepScoreSummary) {
  if (summary.dataState === 'ready') {
    return `${summary.totalScore}/100 (${summary.statusLabel}). ${summary.explanation} Focus: ${summary.tonightFocus}`
  }

  if (summary.dataState === 'sparse') {
    return `${summary.statusLabel}. ${summary.explanation} Give a generic, non-judgmental answer first, then refine only if needed with questions such as: ${summary.clarifyingQuestions.join(
      ' '
    )} Tonight's best next step: ${summary.tonightFocus}`
  }

  return `No score yet. ${summary.explanation} Start with a gentle, generic answer and invite one focused next step: ${summary.tonightFocus}`
}

export function calculateSleepScore(
  dateOfBirth: string,
  logs: SleepLogLike[],
  now = new Date()
): SleepScoreSummary {
  const ageBand = getAgeBand(dateOfBirth, now)
  const targets = getTargetsForAgeBand(ageBand)
  const effectiveLogs = normalizeSleepLogs(logs, now)

  if (effectiveLogs.length === 0) {
    return createEmptySummary(targets)
  }

  const nightMinutes = effectiveLogs
    .filter((log) => log.isNight)
    .reduce((total, log) => total + log.durationMinutes, 0)
  const dayMinutes = effectiveLogs
    .filter((log) => !log.isNight)
    .reduce((total, log) => total + log.durationMinutes, 0)
  const totalMinutes = nightMinutes + dayMinutes
  const coverageDays = getCoveredDays(effectiveLogs)
  const hasNightData = nightMinutes > 0
  const hasDayData = dayMinutes > 0
  const daysForScoring = Math.max(1, coverageDays)

  const breakdown = {
    nightSleep: scoreAgainstTarget(
      nightMinutes / daysForScoring / 60,
      targets.nightHoursPerDay
    ),
    daySleep: scoreAgainstTarget(
      dayMinutes / daysForScoring / 60,
      targets.dayHoursPerDay
    ),
    totalSleep: scoreAgainstTarget(
      totalMinutes / daysForScoring / 60,
      targets.totalHoursPerDay
    ),
    settling: scoreSettling(effectiveLogs),
  }

  const hasEnoughCoverage =
    coverageDays >= MIN_COVERED_DAYS_FOR_SCORE &&
    effectiveLogs.length >= MIN_LOGS_FOR_SCORE &&
    hasNightData &&
    hasDayData

  if (!hasEnoughCoverage) {
    return createSparseSummary(
      targets,
      effectiveLogs,
      nightMinutes,
      dayMinutes,
      totalMinutes,
      breakdown
    )
  }

  const entries = Object.entries(breakdown) as Array<
    [keyof SleepScoreSummary['breakdown'], number]
  >
  const sorted = [...entries].sort((a, b) => b[1] - a[1])
  const strongestArea = getAreaLabel(sorted[0][0])
  const biggestChallenge = getAreaLabel(sorted[sorted.length - 1][0])
  const totalScore = clampScore(
    breakdown.nightSleep * 0.4 +
      breakdown.daySleep * 0.25 +
      breakdown.totalSleep * 0.2 +
      breakdown.settling * 0.15
  )

  return {
    hasData: true,
    hasScore: true,
    dataState: 'ready',
    ageBand: targets.ageBand,
    totalScore,
    statusLabel: getStatusLabel(totalScore),
    strongestArea,
    biggestChallenge,
    tonightFocus: getTonightFocus(sorted[sorted.length - 1][0]),
    explanation: `Somni is using ${effectiveLogs.length} sleep logs across ${coverageDays} covered days in the last ${SLEEP_SCORE_LOOKBACK_DAYS} days. Treat this as a pattern check, not a pass-or-fail grade.`,
    observedSleepHours: Math.round((totalMinutes / 60) * 10) / 10,
    targetSleepHours: targets.totalHoursPerDay,
    coverageDays,
    logCount: effectiveLogs.length,
    clarifyingQuestions: [],
    breakdown,
  }
}
