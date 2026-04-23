import { describe, expect, it } from 'vitest'
import type { DailyPlanRecord } from '@/lib/daily-plan'
import type { SleepPlanProfileRecord } from '@/lib/sleep-plan-profile'
import {
  evaluateSleepPlanAdaptation,
  type SleepPlanAdaptationLog,
} from './sleep-plan-log-adaptation'

function createProfile(overrides: Partial<SleepPlanProfileRecord> = {}): SleepPlanProfileRecord {
  return {
    id: 'profile-1',
    babyId: 'baby-1',
    ageBand: '4-6 months',
    templateKey: 'baseline-16-28wk',
    usualWakeTime: '07:00',
    targetBedtime: '19:15',
    targetNapCount: 3,
    wakeWindowProfile: {
      windows: [
        { label: 'Wake window 1', minMinutes: 120, maxMinutes: 150 },
        { label: 'Wake window 2', minMinutes: 135, maxMinutes: 165 },
        { label: 'Final wake window', minMinutes: 150, maxMinutes: 180 },
      ],
      flexibilityMinutes: 20,
      assertiveness: 'balanced',
      adaptationPace: 'steady',
      firstNapNotBefore: null,
    },
    feedAnchorProfile: {
      anchors: [
        {
          label: 'Morning feed',
          targetTime: '07:00',
          notes: null,
        },
        {
          label: 'Bedtime feed',
          targetTime: '18:45',
          notes: null,
        },
      ],
      notes: 'Keep feed anchors supportive, not rigid.',
      nightFeedsExpected: false,
    },
    schedulePreference: 'mix_of_cues_and_anchors',
    dayStructure: 'mostly_home_flexible',
    adaptationConfidence: 'medium',
    learningState: 'learning',
    lastAutoAdjustedAt: null,
    lastEvidenceSummary: 'Built from onboarding answers.',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    ...overrides,
  }
}

function createSavedPlan(overrides: Partial<DailyPlanRecord> = {}): DailyPlanRecord {
  return {
    id: 'plan-1',
    babyId: 'baby-1',
    planDate: '2026-04-23',
    sleepTargets: [
      {
        label: 'Nap 1',
        targetTime: '09:00',
        window: '+/- 20 min',
        notes: null,
      },
      {
        label: 'Bedtime',
        targetTime: '19:15',
        window: '~2.5 hr after last nap',
        notes: 'Use this bedtime as your main evening anchor.',
      },
    ],
    feedTargets: [],
    notes: null,
    updatedAt: '2026-04-23T08:00:00.000Z',
    metadata: {
      origin: 'saved_daily_plan',
      confidence: 'high',
      reasonSummary: 'Using your saved plan for today.',
    },
    ...overrides,
  }
}

function createLog(
  startedAt: string,
  endedAt: string,
  isNight: boolean,
  options?: {
    tags?: string[]
    notes?: string | null
  }
): SleepPlanAdaptationLog {
  return {
    startedAt,
    endedAt,
    isNight,
    tags: options?.tags ?? [],
    notes: options?.notes ?? null,
  }
}

describe('sleep plan log adaptation', () => {
  const now = new Date('2026-04-23T12:00:00.000Z')

  it('holds steady when logs are too sparse to support a durable conclusion', () => {
    const evaluation = evaluateSleepPlanAdaptation({
      profile: createProfile(),
      currentPlan: null,
      dateOfBirth: '2025-11-15',
      timezone: 'UTC',
      logs: [
        createLog('2026-04-21T19:15:00.000Z', '2026-04-22T06:40:00.000Z', true),
        createLog('2026-04-22T09:20:00.000Z', '2026-04-22T10:10:00.000Z', false),
        createLog('2026-04-22T19:20:00.000Z', '2026-04-23T06:35:00.000Z', true),
      ],
      now,
    })

    expect(evaluation.decision).toBe('hold_steady')
    expect(evaluation.nextProfile).toBeNull()
    expect(evaluation.summary).toContain('Holding steady')
    expect(evaluation.rationale).toContain('Missing logs were treated as unknown')
  })

  it('applies a cautious baseline wake shift after repeated early wakes across covered days', () => {
    const logs: SleepPlanAdaptationLog[] = [
      createLog('2026-04-18T19:30:00.000Z', '2026-04-19T06:00:00.000Z', true),
      createLog('2026-04-19T08:45:00.000Z', '2026-04-19T09:45:00.000Z', false),
      createLog('2026-04-19T12:30:00.000Z', '2026-04-19T13:25:00.000Z', false),
      createLog('2026-04-19T19:30:00.000Z', '2026-04-20T06:00:00.000Z', true),
      createLog('2026-04-20T08:50:00.000Z', '2026-04-20T09:50:00.000Z', false),
      createLog('2026-04-20T12:35:00.000Z', '2026-04-20T13:20:00.000Z', false),
      createLog('2026-04-20T19:35:00.000Z', '2026-04-21T06:00:00.000Z', true),
      createLog('2026-04-21T08:40:00.000Z', '2026-04-21T09:35:00.000Z', false),
      createLog('2026-04-21T12:20:00.000Z', '2026-04-21T13:10:00.000Z', false),
      createLog('2026-04-21T19:30:00.000Z', '2026-04-22T06:00:00.000Z', true),
      createLog('2026-04-22T08:45:00.000Z', '2026-04-22T09:40:00.000Z', false),
      createLog('2026-04-22T12:25:00.000Z', '2026-04-22T13:10:00.000Z', false),
    ]

    const evaluation = evaluateSleepPlanAdaptation({
      profile: createProfile(),
      currentPlan: null,
      dateOfBirth: '2025-11-15',
      timezone: 'UTC',
      logs,
      now,
    })

    expect(evaluation.decision).toBe('apply_baseline_shift')
    expect(evaluation.nextProfile?.usualWakeTime).toBe('06:30')
    expect(evaluation.nextProfile?.feedAnchorProfile.anchors[0].targetTime).toBe('06:30')
    expect(evaluation.summary).toContain('6:00 am wakes')
    expect(evaluation.summary).toContain('4 logged days')
  })

  it('keeps one rough day as a same-day rescue instead of rewriting the durable baseline', () => {
    const sameDayRescueNow = new Date('2026-04-23T15:00:00.000Z')
    const evaluation = evaluateSleepPlanAdaptation({
      profile: createProfile(),
      currentPlan: null,
      dateOfBirth: '2025-11-15',
      timezone: 'UTC',
      logs: [
        createLog('2026-04-22T19:15:00.000Z', '2026-04-23T06:50:00.000Z', true),
        createLog('2026-04-23T09:10:00.000Z', '2026-04-23T09:35:00.000Z', false, {
          tags: ['short_nap'],
        }),
        createLog('2026-04-23T12:20:00.000Z', '2026-04-23T12:45:00.000Z', false, {
          tags: ['short_nap'],
        }),
      ],
      now: sameDayRescueNow,
    })

    expect(evaluation.decision).toBe('apply_daily_rescue')
    expect(evaluation.nextProfile).toBeNull()
    expect(evaluation.nextPlan?.sleepTargets.at(-1)?.targetTime).toBe('19:00')
    expect(evaluation.rationale).toContain('one rough day should not rewrite')
  })

  it('blocks an apparent nap drop when the baby is too young for that structural change', () => {
    const youngProfile = createProfile({
      ageBand: '4-6 months',
      targetNapCount: 4,
      wakeWindowProfile: {
        windows: [
          { label: 'Wake window 1', minMinutes: 75, maxMinutes: 105 },
          { label: 'Wake window 2', minMinutes: 90, maxMinutes: 120 },
          { label: 'Wake window 3', minMinutes: 105, maxMinutes: 135 },
          { label: 'Final wake window', minMinutes: 120, maxMinutes: 150 },
        ],
        flexibilityMinutes: 20,
        assertiveness: 'balanced',
        adaptationPace: 'steady',
        firstNapNotBefore: null,
      },
    })

    const evaluation = evaluateSleepPlanAdaptation({
      profile: youngProfile,
      currentPlan: createSavedPlan(),
      dateOfBirth: '2026-01-20',
      timezone: 'UTC',
      logs: [
        createLog('2026-04-18T19:15:00.000Z', '2026-04-19T07:00:00.000Z', true),
        createLog('2026-04-19T09:00:00.000Z', '2026-04-19T09:45:00.000Z', false),
        createLog('2026-04-19T12:00:00.000Z', '2026-04-19T12:40:00.000Z', false),
        createLog('2026-04-19T15:00:00.000Z', '2026-04-19T15:40:00.000Z', false),
        createLog('2026-04-19T19:15:00.000Z', '2026-04-20T07:00:00.000Z', true),
        createLog('2026-04-20T09:00:00.000Z', '2026-04-20T09:45:00.000Z', false),
        createLog('2026-04-20T12:00:00.000Z', '2026-04-20T12:40:00.000Z', false),
        createLog('2026-04-20T15:00:00.000Z', '2026-04-20T15:40:00.000Z', false),
        createLog('2026-04-20T19:15:00.000Z', '2026-04-21T07:00:00.000Z', true),
        createLog('2026-04-21T09:05:00.000Z', '2026-04-21T09:50:00.000Z', false),
        createLog('2026-04-21T12:05:00.000Z', '2026-04-21T12:45:00.000Z', false),
        createLog('2026-04-21T15:05:00.000Z', '2026-04-21T15:40:00.000Z', false),
        createLog('2026-04-21T19:15:00.000Z', '2026-04-22T07:00:00.000Z', true),
        createLog('2026-04-22T09:10:00.000Z', '2026-04-22T09:50:00.000Z', false),
        createLog('2026-04-22T12:10:00.000Z', '2026-04-22T12:45:00.000Z', false),
        createLog('2026-04-22T15:10:00.000Z', '2026-04-22T15:45:00.000Z', false),
      ],
      now,
    })

    expect(evaluation.decision).toBe('hold_steady')
    expect(evaluation.blockedAdjustments[0]).toContain('too early')
    expect(evaluation.nextProfile).toBeNull()
  })

  it('holds steady during rough-patch logs even when timing looks repeatable', () => {
    const evaluation = evaluateSleepPlanAdaptation({
      profile: createProfile(),
      currentPlan: null,
      dateOfBirth: '2025-11-15',
      timezone: 'UTC',
      logs: [
        createLog('2026-04-18T19:30:00.000Z', '2026-04-19T06:00:00.000Z', true, {
          notes: 'teething week',
        }),
        createLog('2026-04-19T08:45:00.000Z', '2026-04-19T09:45:00.000Z', false),
        createLog('2026-04-19T12:35:00.000Z', '2026-04-19T13:20:00.000Z', false),
        createLog('2026-04-19T19:30:00.000Z', '2026-04-20T06:00:00.000Z', true),
        createLog('2026-04-20T08:50:00.000Z', '2026-04-20T09:50:00.000Z', false),
        createLog('2026-04-20T12:35:00.000Z', '2026-04-20T13:20:00.000Z', false),
      ],
      now,
    })

    expect(evaluation.decision).toBe('hold_steady')
    expect(evaluation.summary).toContain('rough patch')
    expect(evaluation.rationale).toContain('does not auto-apply baseline changes')
  })

  it('applies a durable first-nap constraint after repeated later first naps on covered days', () => {
    const profile = createProfile({
      usualWakeTime: '06:30',
      wakeWindowProfile: {
        ...createProfile().wakeWindowProfile,
        firstNapNotBefore: null,
      },
    })

    const evaluation = evaluateSleepPlanAdaptation({
      profile,
      currentPlan: null,
      dateOfBirth: '2025-09-20',
      timezone: 'UTC',
      logs: [
        createLog('2026-04-18T19:20:00.000Z', '2026-04-19T06:30:00.000Z', true),
        createLog('2026-04-19T09:50:00.000Z', '2026-04-19T10:35:00.000Z', false),
        createLog('2026-04-19T13:00:00.000Z', '2026-04-19T13:45:00.000Z', false),
        createLog('2026-04-19T19:20:00.000Z', '2026-04-20T06:30:00.000Z', true),
        createLog('2026-04-20T09:55:00.000Z', '2026-04-20T10:35:00.000Z', false),
        createLog('2026-04-20T13:05:00.000Z', '2026-04-20T13:50:00.000Z', false),
        createLog('2026-04-20T19:20:00.000Z', '2026-04-21T06:30:00.000Z', true),
        createLog('2026-04-21T09:45:00.000Z', '2026-04-21T10:30:00.000Z', false),
        createLog('2026-04-21T13:00:00.000Z', '2026-04-21T13:40:00.000Z', false),
        createLog('2026-04-21T19:20:00.000Z', '2026-04-22T06:30:00.000Z', true),
        createLog('2026-04-22T09:50:00.000Z', '2026-04-22T10:35:00.000Z', false),
        createLog('2026-04-22T13:00:00.000Z', '2026-04-22T13:45:00.000Z', false),
      ],
      now,
    })

    expect(evaluation.decision).toBe('apply_baseline_shift')
    expect(evaluation.nextProfile?.wakeWindowProfile.firstNapNotBefore).toBe('09:15')
    expect(evaluation.summary).toContain('later first naps')
  })
})
