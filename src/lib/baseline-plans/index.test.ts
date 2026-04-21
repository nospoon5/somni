import { describe, expect, it } from 'vitest'
import { getBaselinePlan } from './index'

describe('getBaselinePlan', () => {
  it('personalises the baseline notes with the baby name', () => {
    const plan = getBaselinePlan(10, 'Elly')

    expect(plan.notes).toContain("Here's Somni's customised baseline plan to help Elly")
    expect(plan.notes).not.toContain('{{babyName}}')
  })

  it('keeps the age-band boundaries deterministic', () => {
    expect(getBaselinePlan(0, 'Elly').id).toBe('baseline-0-8wk')
    expect(getBaselinePlan(8, 'Elly').id).toBe('baseline-0-8wk')
    expect(getBaselinePlan(9, 'Elly').id).toBe('baseline-8-16wk')
    expect(getBaselinePlan(16, 'Elly').id).toBe('baseline-8-16wk')
    expect(getBaselinePlan(17, 'Elly').id).toBe('baseline-16-28wk')
    expect(getBaselinePlan(28, 'Elly').id).toBe('baseline-16-28wk')
    expect(getBaselinePlan(29, 'Elly').id).toBe('baseline-28-40wk')
    expect(getBaselinePlan(40, 'Elly').id).toBe('baseline-28-40wk')
    expect(getBaselinePlan(41, 'Elly').id).toBe('baseline-40-52wk')
    expect(getBaselinePlan(52, 'Elly').id).toBe('baseline-40-52wk')
    expect(getBaselinePlan(53, 'Elly').id).toBe('baseline-52-78wk')
    expect(getBaselinePlan(78, 'Elly').id).toBe('baseline-52-78wk')
    expect(getBaselinePlan(79, 'Elly').id).toBe('baseline-78wk-plus')
  })
})
