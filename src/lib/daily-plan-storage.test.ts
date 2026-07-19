import { describe, expect, it } from 'vitest'
import { getDailyPlanStorageKey } from './daily-plan'

describe('daily plan browser storage isolation', () => {
  it('uses both the signed-in profile and selected baby', () => {
    expect(getDailyPlanStorageKey('profile-a', 'baby-a')).not.toBe(
      getDailyPlanStorageKey('profile-b', 'baby-a'),
    )
    expect(getDailyPlanStorageKey('profile-a', 'baby-a')).not.toBe(
      getDailyPlanStorageKey('profile-a', 'baby-b'),
    )
  })
})
