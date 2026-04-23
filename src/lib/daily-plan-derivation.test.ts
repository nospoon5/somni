import { describe, expect, it } from 'vitest'
import type { DailyPlanRecord } from './daily-plan'
import type { SleepPlanProfileRecord } from './sleep-plan-profile'
import {
  buildDailyPlanFromProfile,
  selectDailyPlanForDashboard,
} from './daily-plan-derivation'

function createProfile(
  overrides: Partial<SleepPlanProfileRecord> = {}
): SleepPlanProfileRecord {
  return {
    id: 'profile-1',
    babyId: 'baby-1',
    ageBand: '4-6 months',
    templateKey: 'baseline-16-28wk',
    usualWakeTime: '07:00',
    targetBedtime: '19:30',
    targetNapCount: 3,
    wakeWindowProfile: {
      windows: [
        { label: 'Wake window 1', minMinutes: 90, maxMinutes: 120 },
        { label: 'Wake window 2', minMinutes: 105, maxMinutes: 135 },
        { label: 'Wake window 3', minMinutes: 120, maxMinutes: 150 },
        { label: 'Final wake window', minMinutes: 135, maxMinutes: 165 },
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
          notes: 'Use wake-up feed as a light anchor.',
        },
      ],
      notes: 'Feed anchors stay supportive, not rigid.',
      nightFeedsExpected: false,
    },
    schedulePreference: 'mix_of_cues_and_anchors',
    dayStructure: 'mostly_home_flexible',
    adaptationConfidence: 'medium',
    learningState: 'starting',
    lastAutoAdjustedAt: null,
    lastEvidenceSummary: 'Built from onboarding answers.',
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  }
}

describe('daily plan derivation', () => {
  it('reflects different wake anchors in derived plans', () => {
    const earlyWakePlan = buildDailyPlanFromProfile({
      profile: createProfile({ usualWakeTime: '06:00' }),
      babyId: 'baby-1',
      planDate: '2026-04-23',
    })
    const laterWakePlan = buildDailyPlanFromProfile({
      profile: createProfile({ usualWakeTime: '07:30', targetBedtime: '20:00' }),
      babyId: 'baby-1',
      planDate: '2026-04-23',
    })

    expect(earlyWakePlan.sleepTargets[0].targetTime).not.toBe(
      laterWakePlan.sleepTargets[0].targetTime
    )
    expect(earlyWakePlan.sleepTargets.at(-1)?.targetTime).toBe('19:30')
    expect(laterWakePlan.sleepTargets.at(-1)?.targetTime).toBe('20:00')
  })

  it('reflects different day structures in target notes', () => {
    const daycarePlan = buildDailyPlanFromProfile({
      profile: createProfile({ dayStructure: 'daycare' }),
      babyId: 'baby-1',
      planDate: '2026-04-23',
    })
    const homePlan = buildDailyPlanFromProfile({
      profile: createProfile({ dayStructure: 'mostly_home_flexible' }),
      babyId: 'baby-1',
      planDate: '2026-04-23',
    })

    expect(daycarePlan.sleepTargets[0].notes).toContain('daycare')
    expect(homePlan.sleepTargets[0].notes).not.toContain('daycare')
  })

  it('honours a durable earliest first-nap constraint when the baseline includes one', () => {
    const constrainedPlan = buildDailyPlanFromProfile({
      profile: createProfile({
        usualWakeTime: '06:30',
        wakeWindowProfile: {
          ...createProfile().wakeWindowProfile,
          firstNapNotBefore: '09:30',
        },
      }),
      babyId: 'baby-1',
      planDate: '2026-04-23',
    })

    expect(constrainedPlan.sleepTargets[0].targetTime).toBe('09:30')
    expect(constrainedPlan.sleepTargets[0].notes).toContain('9:30 am')
  })

  it('keeps saved plans as the highest-priority source for today', () => {
    const savedPlan: DailyPlanRecord = {
      id: 'plan-saved-1',
      babyId: 'baby-1',
      planDate: '2026-04-23',
      sleepTargets: [
        {
          label: 'Bedtime',
          targetTime: '19:00',
          window: '+/- 15 min',
          notes: null,
        },
      ],
      feedTargets: [],
      notes: 'Saved daily rescue plan.',
      updatedAt: '2026-04-23T09:00:00.000Z',
      metadata: {
        origin: 'saved_daily_plan',
        confidence: 'high',
        reasonSummary: 'Using your saved plan for today.',
      },
    }

    const selection = selectDailyPlanForDashboard({
      savedPlan,
      profile: createProfile(),
      ageInWeeks: 24,
      babyId: 'baby-1',
      babyName: 'Arlo',
      planDate: '2026-04-23',
    })

    expect(selection.source).toBe('saved_daily_plan')
    expect(selection.plan?.id).toBe('plan-saved-1')
    expect(selection.plan?.notes).toBe('Saved daily rescue plan.')
  })

  it('is deterministic for the same profile input and date', () => {
    const profile = createProfile()

    const firstPlan = buildDailyPlanFromProfile({
      profile,
      babyId: 'baby-1',
      planDate: '2026-04-23',
    })
    const secondPlan = buildDailyPlanFromProfile({
      profile,
      babyId: 'baby-1',
      planDate: '2026-04-23',
    })

    expect(firstPlan).toEqual(secondPlan)
  })
})
