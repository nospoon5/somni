import type { DailyPlanRecord } from './daily-plan'
import {
  normalizeDayStructure,
  normalizeSchedulePreference,
  type OnboardingDayStructure,
  type OnboardingSchedulePreference,
} from './onboarding-preferences'
import {
  buildDailyPlanSnapshot,
  buildSleepPlanProfileSnapshot,
  normalizeSleepPlanClockTime,
  type SleepPlanChangeKind,
  type SleepPlanEvidenceConfidence,
  type SleepPlanProfileRecord,
} from './sleep-plan-profile'

export type SleepPlanProfileUpdateInput = {
  usualWakeTime?: string
  targetBedtime?: string
  targetNapCount?: number
  dayStructure?: OnboardingDayStructure
  schedulePreference?: OnboardingSchedulePreference
  firstNapNotBefore?: string | null
}

export type ChatPlanUpdateSignal = {
  explicitStablePattern: boolean
  sameDayRescue: boolean
  sparseLoggingHint: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function pickOptionalInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10)
  }

  return null
}

function formatClockTime(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return value
  }

  const rawHour = Number(match[1])
  const minute = match[2]
  const period = rawHour >= 12 ? 'pm' : 'am'
  const hour = rawHour % 12 || 12
  return `${hour}:${minute} ${period}`
}

function humanizeDayStructure(value: string) {
  switch (value) {
    case 'mostly_home_flexible':
      return 'mostly home and flexible'
    case 'daycare':
      return 'daycare-led'
    case 'work_constrained':
      return 'work-constrained'
    default:
      return value.replace(/_/g, ' ')
  }
}

function humanizeSchedulePreference(value: string) {
  switch (value) {
    case 'more_flexible':
      return 'more flexible'
    case 'mix_of_cues_and_anchors':
      return 'a mix of cues and anchors'
    case 'more_clock_based':
      return 'more clock-based'
    default:
      return value.replace(/_/g, ' ')
  }
}

function limitDescriptions(descriptions: string[]) {
  if (descriptions.length <= 3) {
    return descriptions.join(', ')
  }

  return `${descriptions.slice(0, 3).join(', ')}, plus ${descriptions.length - 3} more change${
    descriptions.length - 3 === 1 ? '' : 's'
  }`
}

function summarizeDailyPlanChanges(before: DailyPlanRecord | null, after: DailyPlanRecord) {
  const descriptions: string[] = []
  const previousSleepTargets = new Map(
    (before?.sleepTargets ?? []).map((target) => [target.label.trim().toLowerCase(), target])
  )
  const previousFeedTargets = new Map(
    (before?.feedTargets ?? []).map((target) => [target.label.trim().toLowerCase(), target])
  )

  for (const target of after.sleepTargets) {
    const previous = previousSleepTargets.get(target.label.trim().toLowerCase())
    if (
      !previous ||
      previous.targetTime !== target.targetTime ||
      previous.window !== target.window ||
      previous.notes !== target.notes
    ) {
      descriptions.push(
        target.targetTime
          ? `${target.label} at ${formatClockTime(target.targetTime)}`
          : target.window
            ? `${target.label} around ${target.window}`
            : target.label
      )
    }
  }

  for (const target of after.feedTargets) {
    const previous = previousFeedTargets.get(target.label.trim().toLowerCase())
    if (
      !previous ||
      previous.targetTime !== target.targetTime ||
      previous.notes !== target.notes
    ) {
      descriptions.push(
        target.targetTime
          ? `${target.label} at ${formatClockTime(target.targetTime)}`
          : target.label
      )
    }
  }

  if (before?.notes !== after.notes && after.notes) {
    descriptions.push(`day note: ${after.notes}`)
  }

  return descriptions.length > 0
    ? limitDescriptions(descriptions)
    : 'kept the same targets but saved the latest note for today'
}

function summarizeProfileChanges(
  before: SleepPlanProfileRecord,
  after: SleepPlanProfileRecord
) {
  const descriptions: string[] = []

  if (before.usualWakeTime !== after.usualWakeTime) {
    descriptions.push(`usual wake time to ${formatClockTime(after.usualWakeTime)}`)
  }

  if (before.targetBedtime !== after.targetBedtime) {
    descriptions.push(`target bedtime to ${formatClockTime(after.targetBedtime)}`)
  }

  if (before.targetNapCount !== after.targetNapCount) {
    descriptions.push(`nap count to ${after.targetNapCount}`)
  }

  if (before.dayStructure !== after.dayStructure) {
    descriptions.push(`day structure to ${humanizeDayStructure(after.dayStructure)}`)
  }

  if (before.schedulePreference !== after.schedulePreference) {
    descriptions.push(
      `schedule feel to ${humanizeSchedulePreference(after.schedulePreference)}`
    )
  }

  if (
    before.wakeWindowProfile.firstNapNotBefore !==
    after.wakeWindowProfile.firstNapNotBefore
  ) {
    descriptions.push(
      after.wakeWindowProfile.firstNapNotBefore
        ? `earliest first nap to ${formatClockTime(after.wakeWindowProfile.firstNapNotBefore)}`
        : 'removed the earliest first-nap constraint'
    )
  }

  return descriptions.length > 0
    ? limitDescriptions(descriptions)
    : 'kept the durable settings the same'
}

export function normalizeSleepPlanProfileUpdateInput(
  value: unknown
): SleepPlanProfileUpdateInput | null {
  if (!isRecord(value)) {
    return null
  }

  const usualWakeTime = normalizeSleepPlanClockTime(
    value.usualWakeTime ?? value.usual_wake_time
  )
  const targetBedtime = normalizeSleepPlanClockTime(
    value.targetBedtime ?? value.target_bedtime
  )
  const firstNapNotBeforeRaw = value.firstNapNotBefore ?? value.first_nap_not_before
  const targetNapCount = pickOptionalInteger(value.targetNapCount ?? value.target_nap_count)
  const dayStructure = normalizeDayStructure(value.dayStructure ?? value.day_structure)
  const schedulePreference = normalizeSchedulePreference(
    value.schedulePreference ?? value.schedule_preference
  )

  const output: SleepPlanProfileUpdateInput = {}

  if (usualWakeTime) {
    output.usualWakeTime = usualWakeTime
  }

  if (targetBedtime) {
    output.targetBedtime = targetBedtime
  }

  if (targetNapCount !== null && targetNapCount >= 0 && targetNapCount <= 8) {
    output.targetNapCount = targetNapCount
  }

  if (dayStructure) {
    output.dayStructure = dayStructure
  }

  if (schedulePreference) {
    output.schedulePreference = schedulePreference
  }

  if (firstNapNotBeforeRaw === null) {
    output.firstNapNotBefore = null
  } else {
    const firstNapNotBefore = normalizeSleepPlanClockTime(firstNapNotBeforeRaw)
    if (firstNapNotBefore) {
      output.firstNapNotBefore = firstNapNotBefore
    }
  }

  return hasSleepPlanProfileChanges(output) ? output : null
}

export function hasSleepPlanProfileChanges(input: SleepPlanProfileUpdateInput) {
  return (
    input.usualWakeTime !== undefined ||
    input.targetBedtime !== undefined ||
    input.targetNapCount !== undefined ||
    input.dayStructure !== undefined ||
    input.schedulePreference !== undefined ||
    input.firstNapNotBefore !== undefined
  )
}

export function mergeSleepPlanProfile(
  existing: SleepPlanProfileRecord,
  updates: SleepPlanProfileUpdateInput,
  options?: {
    evidenceConfidence?: SleepPlanEvidenceConfidence
    evidenceSummary?: string | null
    updatedAt?: string | null
  }
) {
  return {
    ...existing,
    usualWakeTime: updates.usualWakeTime ?? existing.usualWakeTime,
    targetBedtime: updates.targetBedtime ?? existing.targetBedtime,
    targetNapCount: updates.targetNapCount ?? existing.targetNapCount,
    dayStructure: updates.dayStructure ?? existing.dayStructure,
    schedulePreference: updates.schedulePreference ?? existing.schedulePreference,
    adaptationConfidence: options?.evidenceConfidence ?? existing.adaptationConfidence,
    learningState: 'learning' as const,
    lastEvidenceSummary:
      options?.evidenceSummary !== undefined
        ? options.evidenceSummary
        : existing.lastEvidenceSummary,
    updatedAt: options?.updatedAt ?? existing.updatedAt,
    wakeWindowProfile: {
      ...existing.wakeWindowProfile,
      firstNapNotBefore:
        updates.firstNapNotBefore !== undefined
          ? updates.firstNapNotBefore
          : existing.wakeWindowProfile.firstNapNotBefore,
      windows: existing.wakeWindowProfile.windows.map((window) => ({ ...window })),
    },
    feedAnchorProfile: {
      ...existing.feedAnchorProfile,
      anchors: existing.feedAnchorProfile.anchors.map((anchor) => ({ ...anchor })),
    },
  } satisfies SleepPlanProfileRecord
}

export function inferChatPlanUpdateSignal(message: string): ChatPlanUpdateSignal {
  const normalized = message.toLowerCase()

  return {
    explicitStablePattern:
      /(always|usually|consistently|most days|every day|every night|every morning|on weekdays|on weekends|plan says|keeps|cannot|can't|won't|never)/.test(
        normalized
      ),
    sameDayRescue:
      /(today|tonight|this afternoon|this evening|for today|today only|rough nap day|naps were awful|naps have been awful today|move bedtime earlier)/.test(
        normalized
      ),
    sparseLoggingHint:
      /(didn't log|did not log|forgot to log|only logged|hardly logged|sparse log|sparse logging|missing log|missing logging|not much logged)/.test(
        normalized
      ),
  }
}

export function shouldApplyDurableProfileUpdate(signal: ChatPlanUpdateSignal) {
  return signal.explicitStablePattern || !signal.sparseLoggingHint
}

export function resolveChatEvidenceConfidence(args: {
  scope: 'daily' | 'profile'
  signal: ChatPlanUpdateSignal
}): SleepPlanEvidenceConfidence {
  if (args.scope === 'profile') {
    if (args.signal.explicitStablePattern) {
      return 'high'
    }

    if (args.signal.sparseLoggingHint) {
      return 'low'
    }

    return 'medium'
  }

  if (args.signal.sparseLoggingHint && !args.signal.sameDayRescue) {
    return 'medium'
  }

  return 'high'
}

export function buildDailyPlanChangeEvent(args: {
  message: string
  beforePlan: DailyPlanRecord | null
  afterPlan: DailyPlanRecord
}) {
  const signal = inferChatPlanUpdateSignal(args.message)
  const summary = `Updated today's plan: ${summarizeDailyPlanChanges(
    args.beforePlan,
    args.afterPlan
  )}.`

  return {
    changeKind: 'daily_rescue' as SleepPlanChangeKind,
    evidenceConfidence: resolveChatEvidenceConfidence({
      scope: 'daily',
      signal,
    }),
    summary,
    rationale: signal.sameDayRescue
      ? 'Applied as a same-day rescue change from the parent chat message.'
      : 'Applied from a concrete parent-requested change for today without rewriting the durable baseline.',
    beforeSnapshot: buildDailyPlanSnapshot(args.beforePlan) ?? {},
    afterSnapshot: buildDailyPlanSnapshot(args.afterPlan) ?? {},
  }
}

export function buildProfileChangeEvent(args: {
  message: string
  beforeProfile: SleepPlanProfileRecord
  afterProfile: SleepPlanProfileRecord
}) {
  const signal = inferChatPlanUpdateSignal(args.message)
  const summary = `Updated learned baseline: ${summarizeProfileChanges(
    args.beforeProfile,
    args.afterProfile
  )}.`

  return {
    changeKind: 'manual_correction' as SleepPlanChangeKind,
    evidenceConfidence: resolveChatEvidenceConfidence({
      scope: 'profile',
      signal,
    }),
    summary,
    rationale: signal.explicitStablePattern
      ? 'The parent described this as an ongoing pattern, so Somni treated it as a high-confidence baseline signal.'
      : signal.sparseLoggingHint
        ? 'Applied cautiously from chat context. Missing or partial logs were not treated as proof.'
        : 'Applied from a parent-reported routine update that should carry across days.',
    beforeSnapshot: buildSleepPlanProfileSnapshot(args.beforeProfile),
    afterSnapshot: buildSleepPlanProfileSnapshot(args.afterProfile),
  }
}

export function buildChatPlanUpdateConfirmation(args: {
  babyName: string
  beforePlan: DailyPlanRecord | null
  afterPlan: DailyPlanRecord | null
  beforeProfile: SleepPlanProfileRecord | null
  afterProfile: SleepPlanProfileRecord | null
}) {
  const dailyChanged = Boolean(args.beforePlan !== args.afterPlan && args.afterPlan)
  const profileChanged = Boolean(args.beforeProfile && args.afterProfile && args.beforeProfile !== args.afterProfile)

  if (dailyChanged && profileChanged && args.afterPlan && args.beforeProfile && args.afterProfile) {
    return [
      `I've updated ${args.babyName}'s learned baseline and today's dashboard plan.`,
      `Learned baseline: ${summarizeProfileChanges(args.beforeProfile, args.afterProfile)}.`,
      `Today's plan: ${summarizeDailyPlanChanges(args.beforePlan, args.afterPlan)}.`,
      'So today gets the rescue tweak, and the learned baseline now carries the ongoing pattern forward too.',
    ].join('\n\n')
  }

  if (profileChanged && args.beforeProfile && args.afterProfile) {
    return [
      `I've updated ${args.babyName}'s learned baseline.`,
      `Learned baseline: ${summarizeProfileChanges(args.beforeProfile, args.afterProfile)}.`,
      "This changes Somni's durable plan across days. Today's plan only changes as well if we update it separately.",
    ].join('\n\n')
  }

  if (dailyChanged && args.afterPlan) {
    return [
      `I've updated today's dashboard plan for ${args.babyName}.`,
      `Today's change: ${summarizeDailyPlanChanges(args.beforePlan, args.afterPlan)}.`,
      'This is a same-day rescue change only, so it does not rewrite the learned baseline.',
    ].join('\n\n')
  }

  return null
}

export function summarizeSleepPlanProfileForPrompt(profile: SleepPlanProfileRecord | null) {
  if (!profile) {
    return 'No durable learned sleep profile exists yet.'
  }

  const parts = [
    `Usual wake time: ${formatClockTime(profile.usualWakeTime) ?? profile.usualWakeTime}.`,
    `Target bedtime: ${formatClockTime(profile.targetBedtime) ?? profile.targetBedtime}.`,
    `Target naps: ${profile.targetNapCount}.`,
    `Day structure: ${humanizeDayStructure(profile.dayStructure)}.`,
    `Schedule feel: ${humanizeSchedulePreference(profile.schedulePreference)}.`,
  ]

  if (profile.wakeWindowProfile.firstNapNotBefore) {
    parts.push(
      `Earliest first nap: ${formatClockTime(profile.wakeWindowProfile.firstNapNotBefore)}.`
    )
  }

  if (profile.lastEvidenceSummary) {
    parts.push(`Why it currently looks like this: ${profile.lastEvidenceSummary}.`)
  }

  return parts.join(' ')
}
