const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const MINUTES_PER_DAY = 24 * 60
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function parseDateOnly(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return Number.NaN
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return Number.NaN
  }

  const normalized = DATE_ONLY_PATTERN.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed
  return new Date(normalized).getTime()
}

export function getAgeInWeeks(dateOfBirth: string | null | undefined, referenceDate: string) {
  const dateOfBirthTime = parseDateOnly(dateOfBirth)
  const referenceTime = parseDateOnly(referenceDate)

  if (!Number.isFinite(dateOfBirthTime) || !Number.isFinite(referenceTime)) {
    return null
  }

  const ageInDays = Math.floor((referenceTime - dateOfBirthTime) / MS_PER_DAY)
  return ageInDays >= 0 ? Math.floor(ageInDays / 7) : null
}

export function getUtcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function getDateStringForTimezone(timezone: string, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${read('year')}-${read('month')}-${read('day')}`
}

export function getTimeZoneParts(timezone: string, date: Date) {
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

export function clockTimeToMinutes(clockTime: string) {
  const match = clockTime.match(CLOCK_TIME_PATTERN)
  if (!match) {
    return null
  }

  return Number(match[1]) * 60 + Number(match[2])
}

export function minutesToClockTime(totalMinutes: number) {
  const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatClockTime(clockTime: string) {
  const match = clockTime.match(CLOCK_TIME_PATTERN)
  if (!match) {
    return clockTime
  }

  const rawHour = Number(match[1])
  const minute = match[2]
  const period = rawHour >= 12 ? 'pm' : 'am'
  const hour = rawHour % 12 || 12

  return `${hour}:${minute} ${period}`
}

export function roundToNearestFive(minutes: number) {
  return Math.round(minutes / 5) * 5
}
