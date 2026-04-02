export type SleepLogLike = {
  startedAt: string
  endedAt: string | null
  isNight: boolean
  tags: string[]
}

export type SleepScoreSummary = {
  hasData: boolean
  ageBand: string
  totalScore: number
  statusLabel: string
  strongestArea: string
  biggestChallenge: string
  tonightFocus: string
  observedSleepHours: number
  targetSleepHours: number
  breakdown: {
    nightSleep: number
    daySleep: number
    totalSleep: number
    settling: number
  }
}

type SleepTargets = {
  ageBand: string
  totalHoursPerDay: number
  nightHoursPerDay: number
  dayHoursPerDay: number
}

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

function getStatusLabel(totalScore: number) {
  if (totalScore >= 85) {
    return 'Steady'
  }

  if (totalScore >= 70) {
    return 'Mostly steady'
  }

  if (totalScore >= 55) {
    return 'Needs support'
  }

  return 'Needs a reset'
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

export function calculateSleepScore(
  dateOfBirth: string,
  logs: SleepLogLike[],
  now = new Date()
): SleepScoreSummary {
  const ageBand = getAgeBand(dateOfBirth, now)
  const targets = getTargetsForAgeBand(ageBand)
  const effectiveLogs = logs
    .map((log) => ({
      ...log,
      durationMinutes: getDurationMinutes(log, now),
    }))
    .filter((log) => log.durationMinutes > 0)

  if (effectiveLogs.length === 0) {
    return {
      hasData: false,
      ageBand: targets.ageBand,
      totalScore: 0,
      statusLabel: 'No sleep data yet',
      strongestArea: 'Log your first sleep',
      biggestChallenge: 'There is not enough sleep history yet',
      tonightFocus: 'Start a sleep session to begin building a personalised score.',
      observedSleepHours: 0,
      targetSleepHours: targets.totalHoursPerDay,
      breakdown: {
        nightSleep: 0,
        daySleep: 0,
        totalSleep: 0,
        settling: 60,
      },
    }
  }

  const nightMinutes = effectiveLogs
    .filter((log) => log.isNight)
    .reduce((total, log) => total + log.durationMinutes, 0)
  const dayMinutes = effectiveLogs
    .filter((log) => !log.isNight)
    .reduce((total, log) => total + log.durationMinutes, 0)
  const totalMinutes = nightMinutes + dayMinutes
  const daysInWindow = 7

  const breakdown = {
    nightSleep: scoreAgainstTarget(
      nightMinutes / daysInWindow / 60,
      targets.nightHoursPerDay
    ),
    daySleep: scoreAgainstTarget(dayMinutes / daysInWindow / 60, targets.dayHoursPerDay),
    totalSleep: scoreAgainstTarget(
      totalMinutes / daysInWindow / 60,
      targets.totalHoursPerDay
    ),
    settling: scoreSettling(effectiveLogs),
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
    ageBand: targets.ageBand,
    totalScore,
    statusLabel: getStatusLabel(totalScore),
    strongestArea,
    biggestChallenge,
    tonightFocus: getTonightFocus(sorted[sorted.length - 1][0]),
    observedSleepHours: Math.round((totalMinutes / 60) * 10) / 10,
    targetSleepHours: targets.totalHoursPerDay,
    breakdown,
  }
}
