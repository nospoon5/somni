import type {
  DailyPlanFeedTarget,
  DailyPlanRecord,
  DailyPlanSleepTarget,
} from '@/lib/daily-plan'

export const SLEEP_PLAN_CHANGE_SCOPES = ['profile', 'daily'] as const
export const SLEEP_PLAN_CHANGE_SOURCES = ['onboarding', 'chat', 'logs', 'system'] as const
export const SLEEP_PLAN_CHANGE_KINDS = [
  'bootstrap',
  'daily_rescue',
  'baseline_shift',
  'manual_correction',
] as const
export const SLEEP_PLAN_EVIDENCE_CONFIDENCE_VALUES = ['low', 'medium', 'high'] as const
export const SLEEP_PLAN_LEARNING_STATES = ['starting', 'learning', 'stable'] as const

export type SleepPlanChangeScope = (typeof SLEEP_PLAN_CHANGE_SCOPES)[number]
export type SleepPlanChangeSource = (typeof SLEEP_PLAN_CHANGE_SOURCES)[number]
export type SleepPlanChangeKind = (typeof SLEEP_PLAN_CHANGE_KINDS)[number]
export type SleepPlanEvidenceConfidence =
  (typeof SLEEP_PLAN_EVIDENCE_CONFIDENCE_VALUES)[number]
export type SleepPlanLearningState = (typeof SLEEP_PLAN_LEARNING_STATES)[number]

export type SleepPlanWakeWindow = {
  label: string
  minMinutes: number | null
  maxMinutes: number | null
}

export type SleepPlanWakeWindowProfile = {
  windows: SleepPlanWakeWindow[]
  flexibilityMinutes: number | null
}

export type SleepPlanFeedAnchor = {
  label: string
  targetTime: string | null
  notes: string | null
}

export type SleepPlanFeedAnchorProfile = {
  anchors: SleepPlanFeedAnchor[]
  notes: string | null
}

export type SleepPlanProfileRecord = {
  id: string
  babyId: string
  ageBand: string
  templateKey: string
  usualWakeTime: string
  targetBedtime: string
  targetNapCount: number
  wakeWindowProfile: SleepPlanWakeWindowProfile
  feedAnchorProfile: SleepPlanFeedAnchorProfile
  schedulePreference: string
  dayStructure: string
  adaptationConfidence: SleepPlanEvidenceConfidence
  learningState: SleepPlanLearningState
  lastAutoAdjustedAt: string | null
  lastEvidenceSummary: string | null
  createdAt: string
  updatedAt: string | null
}

export type SleepPlanProfileSnapshot = Omit<
  SleepPlanProfileRecord,
  'id' | 'babyId' | 'createdAt' | 'updatedAt' | 'lastAutoAdjustedAt'
> & {
  lastAutoAdjustedAt: string | null
}

export type DailyPlanSnapshot = {
  planDate: string
  sleepTargets: DailyPlanSleepTarget[]
  feedTargets: DailyPlanFeedTarget[]
  notes: string | null
}

export type SleepPlanChangeEventRecord = {
  id: string
  babyId: string
  sleepPlanProfileId: string | null
  planDate: string | null
  changeScope: SleepPlanChangeScope
  changeSource: SleepPlanChangeSource
  changeKind: SleepPlanChangeKind
  evidenceConfidence: SleepPlanEvidenceConfidence
  summary: string
  rationale: string | null
  beforeSnapshot: Record<string, unknown>
  afterSnapshot: Record<string, unknown>
  createdAt: string
}

type SleepPlanProfileRow = {
  id: unknown
  baby_id: unknown
  age_band: unknown
  template_key: unknown
  usual_wake_time: unknown
  target_bedtime: unknown
  target_nap_count: unknown
  wake_window_profile: unknown
  feed_anchor_profile: unknown
  schedule_preference: unknown
  day_structure: unknown
  adaptation_confidence: unknown
  learning_state: unknown
  last_auto_adjusted_at?: unknown
  last_evidence_summary?: unknown
  created_at: unknown
  updated_at?: unknown
}

type SleepPlanChangeEventRow = {
  id: unknown
  baby_id: unknown
  sleep_plan_profile_id?: unknown
  plan_date?: unknown
  change_scope: unknown
  change_source: unknown
  change_kind: unknown
  evidence_confidence: unknown
  summary: unknown
  rationale?: unknown
  before_snapshot?: unknown
  after_snapshot?: unknown
  created_at: unknown
}

const EVIDENCE_CONFIDENCE_RANK: Record<SleepPlanEvidenceConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
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

function pickNonNegativeInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10)
  }

  return null
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T
) {
  const normalized = pickOptionalString(value)?.toLowerCase()
  return allowedValues.includes(normalized as T) ? (normalized as T) : fallback
}

export function normalizeSleepPlanClockTime(value: unknown) {
  const raw = pickOptionalString(value)
  if (!raw) {
    return null
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, '')

  const twentyFourHourMatch = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  if (twentyFourHourMatch) {
    const hour = twentyFourHourMatch[1].padStart(2, '0')
    return `${hour}:${twentyFourHourMatch[2]}`
  }

  const twelveHourMatch = normalized.match(/^(0?\d|1[0-2])(?::([0-5]\d))?(am|pm)$/)
  if (!twelveHourMatch) {
    return null
  }

  const rawHour = Number.parseInt(twelveHourMatch[1], 10)
  const minute = twelveHourMatch[2] ?? '00'
  const isPm = twelveHourMatch[3] === 'pm'
  const adjustedHour = isPm ? (rawHour % 12) + 12 : rawHour % 12

  return `${String(adjustedHour).padStart(2, '0')}:${minute}`
}

function normalizeWakeWindow(value: unknown): SleepPlanWakeWindow | null {
  if (!isRecord(value)) {
    return null
  }

  const label = pickOptionalString(value.label)
  if (!label) {
    return null
  }

  return {
    label,
    minMinutes: pickNonNegativeInteger(value.minMinutes ?? value.min_minutes),
    maxMinutes: pickNonNegativeInteger(value.maxMinutes ?? value.max_minutes),
  }
}

function normalizeWakeWindowProfile(value: unknown): SleepPlanWakeWindowProfile {
  const record = isRecord(value) ? value : null
  const rawWindows = Array.isArray(record?.windows) ? record.windows : Array.isArray(value) ? value : []

  return {
    windows: rawWindows
      .map((window) => normalizeWakeWindow(window))
      .filter((window): window is SleepPlanWakeWindow => window !== null),
    flexibilityMinutes: pickNonNegativeInteger(
      record?.flexibilityMinutes ?? record?.flexibility_minutes
    ),
  }
}

function normalizeFeedAnchor(value: unknown): SleepPlanFeedAnchor | null {
  if (!isRecord(value)) {
    return null
  }

  const label = pickOptionalString(value.label)
  if (!label) {
    return null
  }

  return {
    label,
    targetTime: normalizeSleepPlanClockTime(value.targetTime ?? value.target_time),
    notes: pickOptionalString(value.notes),
  }
}

function normalizeFeedAnchorProfile(value: unknown): SleepPlanFeedAnchorProfile {
  const record = isRecord(value) ? value : null
  const rawAnchors = Array.isArray(record?.anchors) ? record.anchors : Array.isArray(value) ? value : []

  return {
    anchors: rawAnchors
      .map((anchor) => normalizeFeedAnchor(anchor))
      .filter((anchor): anchor is SleepPlanFeedAnchor => anchor !== null),
    notes: pickOptionalString(record?.notes),
  }
}

function cloneSleepTargets(targets: ReadonlyArray<DailyPlanSleepTarget>) {
  return targets.map((target) => ({ ...target }))
}

function cloneFeedTargets(targets: ReadonlyArray<DailyPlanFeedTarget>) {
  return targets.map((target) => ({ ...target }))
}

function normalizeSnapshotObject(value: unknown) {
  return isRecord(value) ? { ...value } : {}
}

export function normalizeSleepPlanProfileRow(
  row: SleepPlanProfileRow | null | undefined
): SleepPlanProfileRecord | null {
  if (!row) {
    return null
  }

  const id = pickOptionalString(row.id)
  const babyId = pickOptionalString(row.baby_id)
  const ageBand = pickOptionalString(row.age_band)
  const templateKey = pickOptionalString(row.template_key)
  const usualWakeTime = normalizeSleepPlanClockTime(row.usual_wake_time)
  const targetBedtime = normalizeSleepPlanClockTime(row.target_bedtime)
  const targetNapCount = pickNonNegativeInteger(row.target_nap_count)
  const schedulePreference = pickOptionalString(row.schedule_preference)
  const dayStructure = pickOptionalString(row.day_structure)
  const createdAt = pickOptionalString(row.created_at)

  if (
    !id ||
    !babyId ||
    !ageBand ||
    !templateKey ||
    !usualWakeTime ||
    !targetBedtime ||
    targetNapCount === null ||
    !schedulePreference ||
    !dayStructure ||
    !createdAt
  ) {
    return null
  }

  return {
    id,
    babyId,
    ageBand,
    templateKey,
    usualWakeTime,
    targetBedtime,
    targetNapCount,
    wakeWindowProfile: normalizeWakeWindowProfile(row.wake_window_profile),
    feedAnchorProfile: normalizeFeedAnchorProfile(row.feed_anchor_profile),
    schedulePreference,
    dayStructure,
    adaptationConfidence: normalizeEnum(
      row.adaptation_confidence,
      SLEEP_PLAN_EVIDENCE_CONFIDENCE_VALUES,
      'low'
    ),
    learningState: normalizeEnum(row.learning_state, SLEEP_PLAN_LEARNING_STATES, 'starting'),
    lastAutoAdjustedAt: pickOptionalString(row.last_auto_adjusted_at),
    lastEvidenceSummary: pickOptionalString(row.last_evidence_summary),
    createdAt,
    updatedAt: pickOptionalString(row.updated_at),
  }
}

export function normalizeSleepPlanChangeEventRow(
  row: SleepPlanChangeEventRow | null | undefined
): SleepPlanChangeEventRecord | null {
  if (!row) {
    return null
  }

  const id = pickOptionalString(row.id)
  const babyId = pickOptionalString(row.baby_id)
  const summary = pickOptionalString(row.summary)
  const createdAt = pickOptionalString(row.created_at)

  if (!id || !babyId || !summary || !createdAt) {
    return null
  }

  return {
    id,
    babyId,
    sleepPlanProfileId: pickOptionalString(row.sleep_plan_profile_id),
    planDate: pickOptionalString(row.plan_date),
    changeScope: normalizeEnum(row.change_scope, SLEEP_PLAN_CHANGE_SCOPES, 'profile'),
    changeSource: normalizeEnum(row.change_source, SLEEP_PLAN_CHANGE_SOURCES, 'system'),
    changeKind: normalizeEnum(row.change_kind, SLEEP_PLAN_CHANGE_KINDS, 'manual_correction'),
    evidenceConfidence: normalizeEnum(
      row.evidence_confidence,
      SLEEP_PLAN_EVIDENCE_CONFIDENCE_VALUES,
      'low'
    ),
    summary,
    rationale: pickOptionalString(row.rationale),
    beforeSnapshot: normalizeSnapshotObject(row.before_snapshot),
    afterSnapshot: normalizeSnapshotObject(row.after_snapshot),
    createdAt,
  }
}

export function buildSleepPlanProfileSnapshot(
  profile: SleepPlanProfileRecord
): SleepPlanProfileSnapshot {
  return {
    ageBand: profile.ageBand,
    templateKey: profile.templateKey,
    usualWakeTime: profile.usualWakeTime,
    targetBedtime: profile.targetBedtime,
    targetNapCount: profile.targetNapCount,
    wakeWindowProfile: {
      windows: profile.wakeWindowProfile.windows.map((window) => ({ ...window })),
      flexibilityMinutes: profile.wakeWindowProfile.flexibilityMinutes,
    },
    feedAnchorProfile: {
      anchors: profile.feedAnchorProfile.anchors.map((anchor) => ({ ...anchor })),
      notes: profile.feedAnchorProfile.notes,
    },
    schedulePreference: profile.schedulePreference,
    dayStructure: profile.dayStructure,
    adaptationConfidence: profile.adaptationConfidence,
    learningState: profile.learningState,
    lastAutoAdjustedAt: profile.lastAutoAdjustedAt,
    lastEvidenceSummary: profile.lastEvidenceSummary,
  }
}

export function buildDailyPlanSnapshot(plan: DailyPlanRecord | null): DailyPlanSnapshot | null {
  if (!plan) {
    return null
  }

  return {
    planDate: plan.planDate,
    sleepTargets: cloneSleepTargets(plan.sleepTargets),
    feedTargets: cloneFeedTargets(plan.feedTargets),
    notes: plan.notes,
  }
}

export function compareSleepPlanEvidenceConfidence(
  left: SleepPlanEvidenceConfidence,
  right: SleepPlanEvidenceConfidence
) {
  return EVIDENCE_CONFIDENCE_RANK[left] - EVIDENCE_CONFIDENCE_RANK[right]
}

export function isSleepPlanEvidenceAtLeast(
  value: SleepPlanEvidenceConfidence,
  threshold: SleepPlanEvidenceConfidence
) {
  return compareSleepPlanEvidenceConfidence(value, threshold) >= 0
}

export function getHigherSleepPlanEvidenceConfidence(
  left: SleepPlanEvidenceConfidence,
  right: SleepPlanEvidenceConfidence
) {
  return compareSleepPlanEvidenceConfidence(left, right) >= 0 ? left : right
}
