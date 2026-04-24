import { getDateStringForTimezone as getDateStringForTimezoneFromUtils } from './date-utils'

export const DAILY_PLAN_STORAGE_KEY = 'somni:daily-plan'

export const DAILY_PLAN_ORIGINS = [
  'saved_daily_plan',
  'profile_derived',
  'age_baseline_fallback',
  'live_stream',
] as const
export const DAILY_PLAN_CONFIDENCE_VALUES = ['low', 'medium', 'high'] as const

export type DailyPlanOrigin = (typeof DAILY_PLAN_ORIGINS)[number]
export type DailyPlanConfidence = (typeof DAILY_PLAN_CONFIDENCE_VALUES)[number]

export type DailyPlanMetadata = {
  origin: DailyPlanOrigin
  confidence: DailyPlanConfidence | null
  reasonSummary: string | null
}

export type DailyPlanSleepTarget = {
  label: string
  targetTime: string | null
  window: string | null
  notes: string | null
}

export type DailyPlanFeedTarget = {
  label: string
  targetTime: string | null
  notes: string | null
}

export type DailyPlanRecord = {
  id: string
  babyId: string
  planDate: string
  sleepTargets: DailyPlanSleepTarget[]
  feedTargets: DailyPlanFeedTarget[]
  notes: string | null
  updatedAt: string | null
  metadata: DailyPlanMetadata | null
}

export type DailyPlanUpdateInput = {
  sleepTargets?: DailyPlanSleepTarget[]
  feedTargets?: DailyPlanFeedTarget[]
  notes?: string | null
}

export type DailyPlanStreamPayload = {
  planDate: string
  sleepTargets: DailyPlanSleepTarget[]
  feedTargets: DailyPlanFeedTarget[]
  notes: string | null
  updatedAt: string | null
  metadata?: DailyPlanMetadata | null
}

type DailyPlanRow = {
  id: string
  baby_id: string
  plan_date: string
  sleep_targets: unknown
  feed_targets: unknown
  notes: string | null
  updated_at?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function pickOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeEnum<T extends string>(value: unknown, allowedValues: readonly T[]) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return allowedValues.includes(normalized as T) ? (normalized as T) : null
}

function normalizeDailyPlanMetadata(value: unknown): DailyPlanMetadata | null {
  if (!isRecord(value)) {
    return null
  }

  const origin = normalizeEnum(value.origin, DAILY_PLAN_ORIGINS)
  if (!origin) {
    return null
  }

  return {
    origin,
    confidence: normalizeEnum(value.confidence, DAILY_PLAN_CONFIDENCE_VALUES),
    reasonSummary: pickOptionalString(value.reasonSummary ?? value.reason_summary),
  }
}

function normalizeLabel(value: unknown) {
  return pickOptionalString(value)
}

function normalizeSleepTarget(value: unknown): DailyPlanSleepTarget | null {
  if (!isRecord(value)) {
    return null
  }

  const label = normalizeLabel(value.label)
  if (!label) {
    return null
  }

  return {
    label,
    targetTime: pickOptionalString(value.targetTime ?? value.target_time),
    window: pickOptionalString(value.window),
    notes: pickOptionalString(value.notes),
  }
}

function normalizeFeedTarget(value: unknown): DailyPlanFeedTarget | null {
  if (!isRecord(value)) {
    return null
  }

  const label = normalizeLabel(value.label)
  if (!label) {
    return null
  }

  return {
    label,
    targetTime: pickOptionalString(value.targetTime ?? value.target_time),
    notes: pickOptionalString(value.notes),
  }
}

function normalizeSleepTargets(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((target) => normalizeSleepTarget(target))
    .filter((target): target is DailyPlanSleepTarget => target !== null)
}

function normalizeFeedTargets(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((target) => normalizeFeedTarget(target))
    .filter((target): target is DailyPlanFeedTarget => target !== null)
}

export function hasDailyPlanChanges(input: DailyPlanUpdateInput) {
  return (
    input.notes !== undefined ||
    input.sleepTargets !== undefined ||
    input.feedTargets !== undefined
  )
}

export function normalizeDailyPlanUpdateInput(value: unknown): DailyPlanUpdateInput | null {
  if (!isRecord(value)) {
    return null
  }

  const sleepTargets = Array.isArray(value.sleepTargets ?? value.sleep_targets)
    ? normalizeSleepTargets(value.sleepTargets ?? value.sleep_targets)
    : undefined
  const feedTargets = Array.isArray(value.feedTargets ?? value.feed_targets)
    ? normalizeFeedTargets(value.feedTargets ?? value.feed_targets)
    : undefined
  const notes =
    value.notes === null || typeof value.notes === 'string'
      ? pickOptionalString(value.notes)
      : undefined

  const output: DailyPlanUpdateInput = {}

  if (sleepTargets !== undefined) {
    output.sleepTargets = sleepTargets
  }

  if (feedTargets !== undefined) {
    output.feedTargets = feedTargets
  }

  if (notes !== undefined || value.notes === null) {
    output.notes = notes
  }

  return hasDailyPlanChanges(output) ? output : null
}

export function normalizeDailyPlanRow(row: DailyPlanRow | null | undefined): DailyPlanRecord | null {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    babyId: row.baby_id,
    planDate: row.plan_date,
    sleepTargets: normalizeSleepTargets(row.sleep_targets),
    feedTargets: normalizeFeedTargets(row.feed_targets),
    notes: pickOptionalString(row.notes),
    updatedAt: pickOptionalString(row.updated_at ?? null),
    metadata: {
      origin: 'saved_daily_plan',
      confidence: 'high',
      reasonSummary: 'Using your saved plan for today.',
    },
  }
}

function targetKey(label: string) {
  return label.trim().toLowerCase()
}

function mergeSleepTargets(
  existing: DailyPlanSleepTarget[],
  incoming: DailyPlanSleepTarget[] | undefined
) {
  if (incoming === undefined) {
    return existing
  }

  const merged = [...existing]

  for (const nextTarget of incoming) {
    const index = merged.findIndex((current) => targetKey(current.label) === targetKey(nextTarget.label))

    if (index === -1) {
      merged.push(nextTarget)
      continue
    }

    merged[index] = {
      ...merged[index],
      ...nextTarget,
      targetTime:
        nextTarget.targetTime !== null ? nextTarget.targetTime : merged[index].targetTime,
      window: nextTarget.window !== null ? nextTarget.window : merged[index].window,
      notes: nextTarget.notes !== null ? nextTarget.notes : merged[index].notes,
    }
  }

  return merged
}

function mergeFeedTargets(
  existing: DailyPlanFeedTarget[],
  incoming: DailyPlanFeedTarget[] | undefined
) {
  if (incoming === undefined) {
    return existing
  }

  const merged = [...existing]

  for (const nextTarget of incoming) {
    const index = merged.findIndex((current) => targetKey(current.label) === targetKey(nextTarget.label))

    if (index === -1) {
      merged.push(nextTarget)
      continue
    }

    merged[index] = {
      ...merged[index],
      ...nextTarget,
      targetTime:
        nextTarget.targetTime !== null ? nextTarget.targetTime : merged[index].targetTime,
      notes: nextTarget.notes !== null ? nextTarget.notes : merged[index].notes,
    }
  }

  return merged
}

export function mergeDailyPlan(
  existing: DailyPlanRecord | null,
  updates: DailyPlanUpdateInput,
  options: { id?: string; babyId: string; planDate: string; updatedAt?: string | null }
): DailyPlanRecord {
  return {
    id: options.id ?? existing?.id ?? crypto.randomUUID(),
    babyId: options.babyId,
    planDate: options.planDate,
    sleepTargets: mergeSleepTargets(existing?.sleepTargets ?? [], updates.sleepTargets),
    feedTargets: mergeFeedTargets(existing?.feedTargets ?? [], updates.feedTargets),
    notes:
      updates.notes !== undefined
        ? updates.notes
        : existing?.notes ?? null,
    updatedAt: options.updatedAt ?? existing?.updatedAt ?? null,
    metadata:
      existing?.metadata ??
      normalizeDailyPlanMetadata({
        origin: 'saved_daily_plan',
        confidence: 'high',
        reasonSummary: 'Using your saved plan for today.',
      }),
  }
}

export function getDateStringForTimezone(timezone: string, date = new Date()) {
  return getDateStringForTimezoneFromUtils(timezone, date)
}

export function formatDailyPlanTime(value: string | null | undefined) {
  const raw = value?.trim()
  if (!raw) {
    return null
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, '')

  const twelveHourMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/)
  if (twelveHourMatch) {
    const hour = Number(twelveHourMatch[1])
    const minute = twelveHourMatch[2] ?? '00'
    const period = twelveHourMatch[3]
    return `${hour}:${minute} ${period}`
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHourMatch) {
    const rawHour = Number(twentyFourHourMatch[1])
    const minute = twentyFourHourMatch[2]
    const period = rawHour >= 12 ? 'pm' : 'am'
    const hour = rawHour % 12 || 12
    return `${hour}:${minute} ${period}`
  }

  return raw
}

function summarizeSleepTarget(target: DailyPlanSleepTarget) {
  const time = formatDailyPlanTime(target.targetTime)

  if (time) {
    return `${target.label} at ${time}`
  }

  if (target.window) {
    return `${target.label} around ${target.window}`
  }

  return target.label
}

function summarizeFeedTarget(target: DailyPlanFeedTarget) {
  const time = formatDailyPlanTime(target.targetTime)

  return time ? `${target.label} at ${time}` : target.label
}

export function summarizeDailyPlanForPrompt(plan: DailyPlanRecord | null) {
  if (!plan) {
    return 'No daily dashboard plan exists yet for today.'
  }

  const sections = [
    plan.sleepTargets.length > 0
      ? `Sleep targets: ${plan.sleepTargets.map((target) => summarizeSleepTarget(target)).join('; ')}.`
      : 'Sleep targets: none saved yet.',
    plan.feedTargets.length > 0
      ? `Feed targets: ${plan.feedTargets.map((target) => summarizeFeedTarget(target)).join('; ')}.`
      : 'Feed targets: none saved yet.',
  ]

  if (plan.notes) {
    sections.push(`Plan notes: ${plan.notes}.`)
  }

  return sections.join(' ')
}

export function buildDailyPlanConfirmation(args: {
  babyName: string
  plan: DailyPlanRecord
}) {
  const sleepHighlights = args.plan.sleepTargets
    .slice(0, 2)
    .map((target) => summarizeSleepTarget(target))
  const feedHighlights = args.plan.feedTargets
    .slice(0, 2)
    .map((target) => summarizeFeedTarget(target))

  const lines = [
    `I've updated today's dashboard plan for ${args.babyName}.`,
  ]

  if (sleepHighlights.length > 0) {
    lines.push(`Sleep anchors now: ${sleepHighlights.join(', ')}.`)
  }

  if (feedHighlights.length > 0) {
    lines.push(`Feed anchors: ${feedHighlights.join(', ')}.`)
  }

  if (args.plan.notes) {
    lines.push(`I've also saved a note for the day: ${args.plan.notes}.`)
  }

  lines.push(
    'Use that as today\'s shared plan, then keep following your baby\'s cues around the edges.'
  )

  return lines.join('\n\n')
}
