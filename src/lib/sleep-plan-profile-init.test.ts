import { describe, expect, it } from 'vitest'
import { createInitialSleepPlanProfile } from './sleep-plan-profile-init'

const REFERENCE_DATE = new Date('2026-04-22T08:00:00Z')

describe('createInitialSleepPlanProfile', () => {
  it('shifts the starting anchors when babies of the same age wake at different times', () => {
    const earlyWakeProfile = createInitialSleepPlanProfile({
      id: 'baby-1',
      name: 'Arlo',
      dateOfBirth: '2025-10-29',
      sleepStyleLabel: 'balanced',
      typicalWakeTime: '06:00',
      dayStructure: 'mostly_home_flexible',
      napPattern: 'mostly_3_naps',
      nightFeeds: true,
      schedulePreference: 'mix_of_cues_and_anchors',
      referenceDate: REFERENCE_DATE,
    })
    const laterWakeProfile = createInitialSleepPlanProfile({
      id: 'baby-2',
      name: 'Arlo',
      dateOfBirth: '2025-10-29',
      sleepStyleLabel: 'balanced',
      typicalWakeTime: '07:30',
      dayStructure: 'mostly_home_flexible',
      napPattern: 'mostly_3_naps',
      nightFeeds: true,
      schedulePreference: 'mix_of_cues_and_anchors',
      referenceDate: REFERENCE_DATE,
    })

    expect(earlyWakeProfile.template_key).toBe(laterWakeProfile.template_key)
    expect(earlyWakeProfile.target_nap_count).toBe(laterWakeProfile.target_nap_count)
    expect(earlyWakeProfile.usual_wake_time).toBe('06:00')
    expect(laterWakeProfile.usual_wake_time).toBe('07:30')
    expect(earlyWakeProfile.target_bedtime).toBe('18:30')
    expect(laterWakeProfile.target_bedtime).toBe('20:00')
  })

  it('changes plan strictness by sleep style without changing the age-driven biology', () => {
    const gentleProfile = createInitialSleepPlanProfile({
      id: 'baby-1',
      name: 'Luca',
      dateOfBirth: '2025-12-10',
      sleepStyleLabel: 'gentle',
      typicalWakeTime: '07:00',
      dayStructure: 'mostly_home_flexible',
      napPattern: 'mostly_3_naps',
      nightFeeds: true,
      schedulePreference: 'mix_of_cues_and_anchors',
      referenceDate: REFERENCE_DATE,
    })
    const fasterProfile = createInitialSleepPlanProfile({
      id: 'baby-2',
      name: 'Luca',
      dateOfBirth: '2025-12-10',
      sleepStyleLabel: 'fast-track',
      typicalWakeTime: '07:00',
      dayStructure: 'mostly_home_flexible',
      napPattern: 'mostly_3_naps',
      nightFeeds: true,
      schedulePreference: 'mix_of_cues_and_anchors',
      referenceDate: REFERENCE_DATE,
    })

    expect(gentleProfile.age_band).toBe(fasterProfile.age_band)
    expect(gentleProfile.template_key).toBe(fasterProfile.template_key)
    expect(gentleProfile.target_nap_count).toBe(fasterProfile.target_nap_count)
    expect(gentleProfile.wake_window_profile.windows).toEqual(fasterProfile.wake_window_profile.windows)
    expect(gentleProfile.wake_window_profile.flexibilityMinutes).toBeGreaterThan(
      fasterProfile.wake_window_profile.flexibilityMinutes ?? 0
    )
    expect(gentleProfile.wake_window_profile.assertiveness).toBe('gentle')
    expect(fasterProfile.wake_window_profile.assertiveness).toBe('assertive')
    expect(gentleProfile.wake_window_profile.adaptationPace).toBe('slow')
    expect(fasterProfile.wake_window_profile.adaptationPace).toBe('responsive')
  })

  it('keeps nap biology age-led even if the reported nap pattern asks for something unrealistic', () => {
    const profile = createInitialSleepPlanProfile({
      id: 'baby-1',
      name: 'Mila',
      dateOfBirth: '2025-06-01',
      sleepStyleLabel: 'balanced',
      typicalWakeTime: '06:30',
      dayStructure: 'daycare',
      napPattern: 'mostly_4_naps',
      nightFeeds: false,
      schedulePreference: 'more_clock_based',
      referenceDate: REFERENCE_DATE,
    })

    expect(profile.age_band).toBe('6-12 months')
    expect(profile.target_nap_count).toBe(2)
    expect(profile.template_key).toBe('baseline-40-52wk')
  })

  it('creates a low-confidence bootstrap profile when newer onboarding answers are missing', () => {
    const profile = createInitialSleepPlanProfile({
      id: 'baby-1',
      name: 'Nora',
      dateOfBirth: '2025-11-12',
      sleepStyleLabel: null,
      typicalWakeTime: null,
      dayStructure: null,
      napPattern: null,
      nightFeeds: null,
      schedulePreference: null,
      referenceDate: REFERENCE_DATE,
    })

    expect(profile.usual_wake_time).toBe('07:00')
    expect(profile.schedule_preference).toBe('mix_of_cues_and_anchors')
    expect(profile.day_structure).toBe('mostly_home_flexible')
    expect(profile.adaptation_confidence).toBe('low')
    expect(profile.feed_anchor_profile.nightFeedsExpected).toBeNull()
    expect(profile.last_evidence_summary).toContain('missing')
  })

  it('keeps any known onboarding anchors during bootstrap instead of resetting to defaults', () => {
    const profile = createInitialSleepPlanProfile({
      id: 'baby-1',
      name: 'Nora',
      dateOfBirth: '2025-11-12',
      sleepStyleLabel: null,
      typicalWakeTime: '06:15',
      dayStructure: 'work_constrained',
      napPattern: null,
      nightFeeds: null,
      schedulePreference: null,
      referenceDate: REFERENCE_DATE,
    })

    expect(profile.usual_wake_time).toBe('06:15')
    expect(profile.day_structure).toBe('work_constrained')
    expect(profile.adaptation_confidence).toBe('low')
    expect(profile.last_evidence_summary).toContain('missing')
  })
})
