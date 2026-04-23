import { describe, expect, it } from 'vitest'
import type { DailyPlanRecord } from '@/lib/daily-plan'
import type { SleepPlanProfileRecord } from '@/lib/sleep-plan-profile'
import {
  buildChatPlanUpdateConfirmation,
  buildDailyPlanChangeEvent,
  buildProfileChangeEvent,
  inferChatPlanUpdateSignal,
  mergeSleepPlanProfile,
  normalizeSleepPlanProfileUpdateInput,
  shouldApplyDurableProfileUpdate,
} from './sleep-plan-chat-updates'

function createProfile(overrides: Partial<SleepPlanProfileRecord> = {}): SleepPlanProfileRecord {
  return {
    id: 'profile-1',
    babyId: 'baby-1',
    ageBand: '6-12 months',
    templateKey: 'baseline-28-40wk',
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
      anchors: [],
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
    updatedAt: '2026-04-22T00:00:00.000Z',
    ...overrides,
  }
}

function createPlan(overrides: Partial<DailyPlanRecord> = {}): DailyPlanRecord {
  return {
    id: 'plan-1',
    babyId: 'baby-1',
    planDate: '2026-04-23',
    sleepTargets: [
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

describe('sleep plan chat update helpers', () => {
  it('treats explicit stable parent statements as high-confidence baseline signals', () => {
    const signal = inferChatPlanUpdateSignal('the plan says wake at 7 but he always wakes at 6')

    expect(signal).toEqual({
      explicitStablePattern: true,
      sameDayRescue: false,
      sparseLoggingHint: false,
    })

    const beforeProfile = createProfile()
    const afterProfile = mergeSleepPlanProfile(beforeProfile, {
      usualWakeTime: '06:00',
    })
    const event = buildProfileChangeEvent({
      message: 'the plan says wake at 7 but he always wakes at 6',
      beforeProfile,
      afterProfile,
    })

    expect(event.evidenceConfidence).toBe('high')
    expect(event.summary).toContain('usual wake time to 6:00 am')
    expect(event.rationale).toContain('ongoing pattern')
  })

  it('keeps same-day rescue changes separate from the durable baseline', () => {
    const signal = inferChatPlanUpdateSignal("today's naps were awful, move bedtime earlier")

    expect(signal.sameDayRescue).toBe(true)

    const beforePlan = createPlan()
    const afterPlan = createPlan({
      sleepTargets: [
        {
          label: 'Bedtime',
          targetTime: '18:45',
          window: '~2 hr after last nap',
          notes: 'Pull earlier after the rough nap day.',
        },
      ],
    })
    const event = buildDailyPlanChangeEvent({
      message: "today's naps were awful, move bedtime earlier",
      beforePlan,
      afterPlan,
    })

    expect(event.changeKind).toBe('daily_rescue')
    expect(event.evidenceConfidence).toBe('high')
    expect(event.summary).toContain("Updated today's plan")
    expect(event.rationale).toContain('same-day rescue')
  })

  it('supports a durable first-nap constraint for repeating daycare-style limits', () => {
    const updates = normalizeSleepPlanProfileUpdateInput({
      day_structure: 'daycare',
      first_nap_not_before: '9:30am',
    })

    expect(updates).toEqual({
      dayStructure: 'daycare',
      firstNapNotBefore: '09:30',
    })

    const updatedProfile = mergeSleepPlanProfile(createProfile(), updates!)

    expect(updatedProfile.dayStructure).toBe('daycare')
    expect(updatedProfile.wakeWindowProfile.firstNapNotBefore).toBe('09:30')
  })

  it('refuses durable baseline updates when the message only signals sparse logging', () => {
    const signal = inferChatPlanUpdateSignal(
      'we only logged one nap this week so maybe she is ready to drop to 2 naps'
    )

    expect(signal.explicitStablePattern).toBe(false)
    expect(signal.sparseLoggingHint).toBe(true)
    expect(shouldApplyDurableProfileUpdate(signal)).toBe(false)
  })

  it('builds confirmation copy that distinguishes daily and durable changes', () => {
    const beforeProfile = createProfile()
    const afterProfile = mergeSleepPlanProfile(beforeProfile, { usualWakeTime: '06:00' })
    const beforePlan = createPlan()
    const afterPlan = createPlan({
      sleepTargets: [
        {
          label: 'Bedtime',
          targetTime: '18:45',
          window: '~2 hr after last nap',
          notes: 'Pull earlier after the rough nap day.',
        },
      ],
    })

    const profileOnly = buildChatPlanUpdateConfirmation({
      babyName: 'Arlo',
      beforePlan,
      afterPlan: beforePlan,
      beforeProfile,
      afterProfile,
    })
    const dailyOnly = buildChatPlanUpdateConfirmation({
      babyName: 'Arlo',
      beforePlan,
      afterPlan,
      beforeProfile,
      afterProfile: beforeProfile,
    })
    const both = buildChatPlanUpdateConfirmation({
      babyName: 'Arlo',
      beforePlan,
      afterPlan,
      beforeProfile,
      afterProfile,
    })

    expect(profileOnly).toContain('learned baseline')
    expect(profileOnly).toContain('across days')
    expect(dailyOnly).toContain("same-day rescue change only")
    expect(both).toContain("learned baseline and today's dashboard plan")
  })
})
