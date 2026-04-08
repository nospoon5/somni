import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateSleepScore, type SleepLogLike } from './sleep-score'

describe('Sleep Score Algorithm', () => {
  const MOCK_NOW = new Date('2024-05-01T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(MOCK_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const MOCK_DOBS = {
    '0-3 months': new Date('2024-03-01T00:00:00Z').toISOString(), // 2 months
    '4-6 months': new Date('2023-12-01T00:00:00Z').toISOString(), // 5 months
    '6-12 months': new Date('2023-08-01T00:00:00Z').toISOString(), // 9 months
    '12 months+': new Date('2022-05-01T00:00:00Z').toISOString(), // 24 months
  }

  // A helper function to create perfect 7-day logs
  function createPerfectLogs(nightHoursPerDay: number, dayHoursPerDay: number): SleepLogLike[] {
    const logs: SleepLogLike[] = []
    
    // Create 7 days of sleep data mapping nicely to targets
    for (let i = 0; i < 7; i++) {
        // Night sleep
        const nightStart = new Date(MOCK_NOW.getTime() - (i + 1) * 24 * 60 * 60 * 1000)
        const nightEnd = new Date(nightStart.getTime() + nightHoursPerDay * 60 * 60 * 1000)
        logs.push({
            startedAt: nightStart.toISOString(),
            endedAt: nightEnd.toISOString(),
            isNight: true,
            tags: ['easy_settle'] // standard positive tag for perfect settling
        })

        // Day sleep
        const dayStart = new Date(nightEnd.getTime() + 1 * 60 * 60 * 1000)
        const dayEnd = new Date(dayStart.getTime() + dayHoursPerDay * 60 * 60 * 1000)
        logs.push({
            startedAt: dayStart.toISOString(),
            endedAt: dayEnd.toISOString(),
            isNight: false,
            tags: ['easy_settle']
        })
    }
    return logs
  }

  describe('1. Age Band & Perfect Target Scoring', () => {
    it('achieves 100 total score for perfect 0-3 months target', () => {
      const logs = createPerfectLogs(9, 6.5)
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], logs)
      
      expect(result.hasData).toBe(true)
      expect(result.ageBand).toBe('0-3 months')
      expect(result.breakdown.nightSleep).toBe(100)
      expect(result.breakdown.daySleep).toBe(100)
      expect(result.breakdown.totalSleep).toBe(100)
      expect(result.breakdown.settling).toBe(100)
      expect(result.totalScore).toBe(100)
    })

    it('achieves 100 total score for perfect 4-6 months target', () => {
      const logs = createPerfectLogs(10, 4.5)
      const result = calculateSleepScore(MOCK_DOBS['4-6 months'], logs)
      expect(result.ageBand).toBe('4-6 months')
      expect(result.totalScore).toBe(100)
    })

    it('achieves 100 total score for perfect 6-12 months target', () => {
      const logs = createPerfectLogs(10.5, 3)
      const result = calculateSleepScore(MOCK_DOBS['6-12 months'], logs)
      expect(result.ageBand).toBe('6-12 months')
      expect(result.totalScore).toBe(100)
    })

    it('achieves 100 total score for perfect 12 months+ target', () => {
      const logs = createPerfectLogs(11, 1.5)
      const result = calculateSleepScore(MOCK_DOBS['12 months+'], logs)
      expect(result.ageBand).toBe('12 months+')
      expect(result.totalScore).toBe(100)
    })
  })

  describe('2. Empty States', () => {
    it('gracefully handles an empty log array', () => {
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], [])
      expect(result.hasData).toBe(false)
      expect(result.totalScore).toBe(0)
      expect(result.breakdown.nightSleep).toBe(0)
      expect(result.breakdown.daySleep).toBe(0)
      expect(result.breakdown.totalSleep).toBe(0)
      expect(result.breakdown.settling).toBe(60) // default empty settling parameter
    })
  })

  describe('3. Boundary and Clamping Cases', () => {
    it('clamps severe over-sleeping down to 0 and not below', () => {
      // e.g. target is 15.5 for 0-3 months, we give it 30 hours per day to create extreme deficit from target point
      const logs = createPerfectLogs(20, 15) 
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], logs)
      
      expect(result.breakdown.nightSleep).toBe(0)
      expect(result.breakdown.daySleep).toBe(0)
      expect(result.breakdown.totalSleep).toBe(0)
      expect(result.totalScore).toBeGreaterThanOrEqual(0) // total score has a minimum value of 0 due to clamping
    })

    it('clamps severe under-sleeping (0 total mapped duration)', () => {
      const logs: SleepLogLike[] = [{
          // 0 duration
          startedAt: MOCK_NOW.toISOString(),
          endedAt: MOCK_NOW.toISOString(),
          isNight: true,
          tags: []
      }]
      const result = calculateSleepScore(MOCK_DOBS['6-12 months'], logs)
      // Duration works out to <= 0, so it logs as durationMinutes = 0 and gets filtered out -> empty logs -> hasData = false
      expect(result.hasData).toBe(false)
    })

    it('evaluates very minor under-duration sleep logic correctly mapped >0 but vastly insufficient', () => {
      const start = new Date(MOCK_NOW.getTime() - 1 * 60 * 60 * 1000)
      const logs: SleepLogLike[] = [{
          startedAt: start.toISOString(),
          endedAt: MOCK_NOW.toISOString(), // 1 hour sleep
          isNight: true,
          tags: []
      }]
      
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], logs)
      expect(result.hasData).toBe(true)
      expect(result.observedSleepHours).toBeCloseTo(1)
      expect(result.breakdown.nightSleep).toBe(2) // 1 hr over 7 days vs 9 hr target -> 98.4% deficit = score of 2
    })
  })

  describe('4. Settling Tag Modifiers', () => {
    const start = new Date(MOCK_NOW.getTime() - 1 * 60 * 60 * 1000)

    function makeLogWithTags(tags: string[]): SleepLogLike[] {
        return [{
            startedAt: start.toISOString(),
            endedAt: MOCK_NOW.toISOString(),
            isNight: true,
            tags
        }]
    }

    it('awards 100 settling score for all positive tags', () => {
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], makeLogWithTags(['easy_settle', 'self_settled']))
      expect(result.breakdown.settling).toBe(100)
    })

    it('awards 0 settling score for all negative tags', () => {
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], makeLogWithTags(['hard_settle', 'needed_help', 'false_start', 'short_nap']))
      expect(result.breakdown.settling).toBe(0)
    })

    it('awards 50 settling score for proportionally balanced tags', () => {
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], makeLogWithTags(['easy_settle', 'hard_settle']))
      expect(result.breakdown.settling).toBe(50)
    })

    it('defaults to 60 for neutral logs (no positive or negative tags)', () => {
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], makeLogWithTags(['contact_nap']))
      expect(result.breakdown.settling).toBe(60)
    })
  })
})
