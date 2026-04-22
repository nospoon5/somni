import { describe, expect, it } from 'vitest'
import {
  buildDailyPlanSnapshot,
  buildSleepPlanProfileSnapshot,
  compareSleepPlanEvidenceConfidence,
  getHigherSleepPlanEvidenceConfidence,
  isSleepPlanEvidenceAtLeast,
  normalizeSleepPlanChangeEventRow,
  normalizeSleepPlanClockTime,
  normalizeSleepPlanProfileRow,
} from './sleep-plan-profile'

describe('sleep plan profile helpers', () => {
  it('normalises profile rows into a stable code-friendly shape', () => {
    const profile = normalizeSleepPlanProfileRow({
      id: 'profile-1',
      baby_id: 'baby-1',
      age_band: '6-12 months',
      template_key: 'baseline-28-40wk',
      usual_wake_time: '06:30:00',
      target_bedtime: '7:15 pm',
      target_nap_count: 3,
      wake_window_profile: {
        windows: [
          {
            label: 'Morning window',
            min_minutes: 120,
            max_minutes: 150,
          },
        ],
        flexibility_minutes: 20,
      },
      feed_anchor_profile: {
        anchors: [
          {
            label: 'Morning feed',
            target_time: '7:00 am',
            notes: 'Offer after wake',
          },
        ],
        notes: 'Keep feed anchors supportive.',
      },
      schedule_preference: 'mix_of_cues_and_anchors',
      day_structure: 'mostly_home_flexible',
      adaptation_confidence: 'medium',
      learning_state: 'learning',
      last_auto_adjusted_at: '2026-04-22T08:30:00Z',
      last_evidence_summary: 'Repeated early wakes across four covered days.',
      created_at: '2026-04-22T08:00:00Z',
      updated_at: '2026-04-22T08:45:00Z',
    })

    expect(profile).toEqual({
      id: 'profile-1',
      babyId: 'baby-1',
      ageBand: '6-12 months',
      templateKey: 'baseline-28-40wk',
      usualWakeTime: '06:30',
      targetBedtime: '19:15',
      targetNapCount: 3,
      wakeWindowProfile: {
        windows: [
          {
            label: 'Morning window',
            minMinutes: 120,
            maxMinutes: 150,
          },
        ],
        flexibilityMinutes: 20,
      },
      feedAnchorProfile: {
        anchors: [
          {
            label: 'Morning feed',
            targetTime: '07:00',
            notes: 'Offer after wake',
          },
        ],
        notes: 'Keep feed anchors supportive.',
      },
      schedulePreference: 'mix_of_cues_and_anchors',
      dayStructure: 'mostly_home_flexible',
      adaptationConfidence: 'medium',
      learningState: 'learning',
      lastAutoAdjustedAt: '2026-04-22T08:30:00Z',
      lastEvidenceSummary: 'Repeated early wakes across four covered days.',
      createdAt: '2026-04-22T08:00:00Z',
      updatedAt: '2026-04-22T08:45:00Z',
    })
  })

  it('falls back to safe defaults for unknown confidence or learning states', () => {
    const profile = normalizeSleepPlanProfileRow({
      id: 'profile-2',
      baby_id: 'baby-2',
      age_band: '4-6 months',
      template_key: 'baseline-16-28wk',
      usual_wake_time: '7:00 am',
      target_bedtime: '18:45',
      target_nap_count: '3',
      wake_window_profile: [],
      feed_anchor_profile: [],
      schedule_preference: 'more_flexible',
      day_structure: 'daycare',
      adaptation_confidence: 'unclear',
      learning_state: 'pending',
      created_at: '2026-04-22T09:00:00Z',
    })

    expect(profile?.adaptationConfidence).toBe('low')
    expect(profile?.learningState).toBe('starting')
    expect(profile?.wakeWindowProfile.windows).toEqual([])
    expect(profile?.feedAnchorProfile.anchors).toEqual([])
  })

  it('normalises change events with snapshots for audit reads', () => {
    const event = normalizeSleepPlanChangeEventRow({
      id: 'event-1',
      baby_id: 'baby-1',
      sleep_plan_profile_id: 'profile-1',
      plan_date: '2026-04-22',
      change_scope: 'daily',
      change_source: 'chat',
      change_kind: 'daily_rescue',
      evidence_confidence: 'high',
      summary: 'Moved bedtime earlier after a rough nap day.',
      rationale: 'Two short naps and a long final wake window.',
      before_snapshot: {
        targetBedtime: '19:15',
      },
      after_snapshot: {
        targetBedtime: '18:45',
      },
      created_at: '2026-04-22T10:00:00Z',
    })

    expect(event).toEqual({
      id: 'event-1',
      babyId: 'baby-1',
      sleepPlanProfileId: 'profile-1',
      planDate: '2026-04-22',
      changeScope: 'daily',
      changeSource: 'chat',
      changeKind: 'daily_rescue',
      evidenceConfidence: 'high',
      summary: 'Moved bedtime earlier after a rough nap day.',
      rationale: 'Two short naps and a long final wake window.',
      beforeSnapshot: {
        targetBedtime: '19:15',
      },
      afterSnapshot: {
        targetBedtime: '18:45',
      },
      createdAt: '2026-04-22T10:00:00Z',
    })
  })

  it('builds cloned snapshots so later mutation does not leak back into the source data', () => {
    const profile = normalizeSleepPlanProfileRow({
      id: 'profile-3',
      baby_id: 'baby-3',
      age_band: '6-12 months',
      template_key: 'baseline-28-40wk',
      usual_wake_time: '06:45:00',
      target_bedtime: '19:00:00',
      target_nap_count: 2,
      wake_window_profile: {
        windows: [
          {
            label: 'First window',
            min_minutes: 150,
            max_minutes: 180,
          },
        ],
      },
      feed_anchor_profile: {
        anchors: [
          {
            label: 'Bedtime feed',
            target_time: '18:30',
          },
        ],
      },
      schedule_preference: 'more_clock_based',
      day_structure: 'work_constrained',
      adaptation_confidence: 'high',
      learning_state: 'stable',
      created_at: '2026-04-22T11:00:00Z',
    })

    expect(profile).not.toBeNull()

    const profileSnapshot = buildSleepPlanProfileSnapshot(profile!)
    profileSnapshot.wakeWindowProfile.windows[0].label = 'Changed in snapshot'
    profileSnapshot.feedAnchorProfile.anchors[0].label = 'Changed feed label'

    expect(profile?.wakeWindowProfile.windows[0].label).toBe('First window')
    expect(profile?.feedAnchorProfile.anchors[0].label).toBe('Bedtime feed')

    const dailyPlanSnapshot = buildDailyPlanSnapshot({
      id: 'plan-1',
      babyId: 'baby-3',
      planDate: '2026-04-22',
      sleepTargets: [
        {
          label: 'Bedtime',
          targetTime: '19:00',
          window: '18:45-19:15',
          notes: 'Pull earlier if naps run short.',
        },
      ],
      feedTargets: [
        {
          label: 'Bedtime feed',
          targetTime: '18:30',
          notes: null,
        },
      ],
      notes: 'Rescue plan only for today.',
      updatedAt: '2026-04-22T11:15:00Z',
    })

    expect(dailyPlanSnapshot).not.toBeNull()

    dailyPlanSnapshot!.sleepTargets[0].label = 'Snapshot bedtime'
    dailyPlanSnapshot!.feedTargets[0].label = 'Snapshot feed'

    expect(profileSnapshot.usualWakeTime).toBe('06:45')
    expect(dailyPlanSnapshot).toEqual({
      planDate: '2026-04-22',
      sleepTargets: [
        {
          label: 'Snapshot bedtime',
          targetTime: '19:00',
          window: '18:45-19:15',
          notes: 'Pull earlier if naps run short.',
        },
      ],
      feedTargets: [
        {
          label: 'Snapshot feed',
          targetTime: '18:30',
          notes: null,
        },
      ],
      notes: 'Rescue plan only for today.',
    })
  })

  it('compares evidence confidence in a deterministic order', () => {
    expect(compareSleepPlanEvidenceConfidence('low', 'medium')).toBeLessThan(0)
    expect(compareSleepPlanEvidenceConfidence('high', 'medium')).toBeGreaterThan(0)
    expect(isSleepPlanEvidenceAtLeast('medium', 'low')).toBe(true)
    expect(isSleepPlanEvidenceAtLeast('medium', 'high')).toBe(false)
    expect(getHigherSleepPlanEvidenceConfidence('medium', 'high')).toBe('high')
  })

  it('normalises common parent-facing time formats into HH:MM strings', () => {
    expect(normalizeSleepPlanClockTime('7pm')).toBe('19:00')
    expect(normalizeSleepPlanClockTime('07:15:00')).toBe('07:15')
    expect(normalizeSleepPlanClockTime('6:05 am')).toBe('06:05')
    expect(normalizeSleepPlanClockTime('not-a-time')).toBeNull()
  })
})
