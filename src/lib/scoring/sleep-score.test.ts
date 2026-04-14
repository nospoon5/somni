import { describe, expect, it } from 'vitest'
import {
  buildSleepScorePromptSummary,
  calculateSleepScore,
  getAgeBand,
  type SleepLogLike,
} from './sleep-score'

const MOCK_NOW = new Date('2024-05-01T12:00:00Z')

const MOCK_DOBS = {
  '0-3 months': new Date('2024-03-01T00:00:00Z').toISOString(),
  '4-6 months': new Date('2023-12-01T00:00:00Z').toISOString(),
  '6-12 months': new Date('2023-08-01T00:00:00Z').toISOString(),
  '12 months+': new Date('2022-05-01T00:00:00Z').toISOString(),
}

function hoursFrom(start: Date, durationHours: number) {
  return new Date(start.getTime() + durationHours * 60 * 60 * 1000)
}

function createLog(
  daysAgo: number,
  durationHours: number,
  isNight: boolean,
  tags: string[] = [],
  startHourUtc = isNight ? 20 : 13
): SleepLogLike {
  const start = new Date(MOCK_NOW)
  start.setUTCHours(startHourUtc, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - daysAgo)

  return {
    startedAt: start.toISOString(),
    endedAt: hoursFrom(start, durationHours).toISOString(),
    isNight,
    tags,
  }
}

function createPerfectLogs(nightHoursPerDay: number, dayHoursPerDay: number, days = 7) {
  const logs: SleepLogLike[] = []

  for (let day = 1; day <= days; day += 1) {
    logs.push(createLog(day, nightHoursPerDay, true, ['easy_settle']))
    logs.push(createLog(day, dayHoursPerDay, false, ['easy_settle']))
  }

  return logs
}

describe('sleep score v2', () => {
  describe('ready-state scoring', () => {
    it('gives a perfect score for a full 7-day newborn target match', () => {
      const result = calculateSleepScore(
        MOCK_DOBS['0-3 months'],
        createPerfectLogs(9, 6.5),
        MOCK_NOW
      )

      expect(result.hasData).toBe(true)
      expect(result.hasScore).toBe(true)
      expect(result.dataState).toBe('ready')
      expect(result.ageBand).toBe('0-3 months')
      expect(result.breakdown).toEqual({
        nightSleep: 100,
        daySleep: 100,
        totalSleep: 100,
        settling: 100,
      })
      expect(result.totalScore).toBe(100)
      expect(result.statusLabel).toBe('Steady rhythm')
      expect(result.coverageDays).toBe(7)
      expect(result.logCount).toBe(14)
    })

    it('scores over covered days once enough mixed data exists', () => {
      const result = calculateSleepScore(
        MOCK_DOBS['6-12 months'],
        createPerfectLogs(10.5, 3, 3),
        MOCK_NOW
      )

      expect(result.hasScore).toBe(true)
      expect(result.dataState).toBe('ready')
      expect(result.totalScore).toBe(100)
      expect(result.coverageDays).toBe(3)
      expect(result.logCount).toBe(6)
    })
  })

  describe('sparse-data policy', () => {
    it('keeps an empty state when there are no usable logs', () => {
      const result = calculateSleepScore(MOCK_DOBS['0-3 months'], [], MOCK_NOW)

      expect(result.hasData).toBe(false)
      expect(result.hasScore).toBe(false)
      expect(result.dataState).toBe('empty')
      expect(result.totalScore).toBeNull()
      expect(result.statusLabel).toBe('No score yet')
      expect(result.breakdown).toEqual({
        nightSleep: 0,
        daySleep: 0,
        totalSleep: 0,
        settling: 60,
      })
    })

    it('does not punish a single night log with a misleadingly poor score', () => {
      const result = calculateSleepScore(
        MOCK_DOBS['6-12 months'],
        [createLog(1, 10.5, true)],
        MOCK_NOW
      )

      expect(result.hasData).toBe(true)
      expect(result.hasScore).toBe(false)
      expect(result.dataState).toBe('sparse')
      expect(result.totalScore).toBeNull()
      expect(result.statusLabel).toBe('Learning your rhythm')
      expect(result.coverageDays).toBe(1)
      expect(result.logCount).toBe(1)
      expect(result.breakdown.nightSleep).toBe(100)
      expect(result.breakdown.daySleep).toBe(0)
      expect(result.breakdown.totalSleep).toBe(78)
      expect(result.clarifyingQuestions).toContain(
        'How are naps going right now: easy, short, skipped, or very inconsistent?'
      )
    })

    it('stays in learning mode for one or two days of logs', () => {
      const result = calculateSleepScore(
        MOCK_DOBS['4-6 months'],
        [createLog(1, 10, true), createLog(2, 4.5, false)],
        MOCK_NOW
      )

      expect(result.hasScore).toBe(false)
      expect(result.dataState).toBe('sparse')
      expect(result.coverageDays).toBe(2)
      expect(result.logCount).toBe(2)
      expect(result.totalScore).toBeNull()
    })

    it('requires both day and night coverage before showing a score', () => {
      const result = calculateSleepScore(
        MOCK_DOBS['12 months+'],
        [createLog(1, 11, true), createLog(2, 11, true), createLog(3, 11, true), createLog(4, 11, true)],
        MOCK_NOW
      )

      expect(result.hasData).toBe(true)
      expect(result.hasScore).toBe(false)
      expect(result.dataState).toBe('sparse')
      expect(result.breakdown.nightSleep).toBe(100)
      expect(result.breakdown.daySleep).toBe(0)
      expect(result.clarifyingQuestions[0]).toBe(
        'How are naps going right now: easy, short, skipped, or very inconsistent?'
      )
    })
  })

  describe('edge cases', () => {
    it('ignores logs that fall outside the 7-day lookback window', () => {
      const oldLog = createLog(9, 10, true)
      const result = calculateSleepScore(MOCK_DOBS['6-12 months'], [oldLog], MOCK_NOW)

      expect(result.hasData).toBe(false)
      expect(result.dataState).toBe('empty')
    })

    it('deduplicates repeated logs so active merges do not inflate the score', () => {
      const repeatedLog = createLog(1, 10.5, true, ['easy_settle'])
      const result = calculateSleepScore(
        MOCK_DOBS['6-12 months'],
        [
          repeatedLog,
          repeatedLog,
          createLog(1, 3, false, ['easy_settle']),
          createLog(2, 10.5, true, ['easy_settle']),
          createLog(2, 3, false, ['easy_settle']),
          createLog(3, 10.5, true, ['easy_settle']),
          createLog(3, 3, false, ['easy_settle']),
        ],
        MOCK_NOW
      )

      expect(result.hasScore).toBe(true)
      expect(result.logCount).toBe(6)
      expect(result.totalScore).toBe(100)
    })

    it('handles mixed day and night logs with a deterministic mid-range score', () => {
      const result = calculateSleepScore(
        MOCK_DOBS['6-12 months'],
        [
          createLog(1, 9, true, ['easy_settle']),
          createLog(1, 2, false),
          createLog(2, 10, true, ['needed_help']),
          createLog(2, 2.5, false),
          createLog(3, 10, true, ['easy_settle']),
          createLog(3, 2, false),
        ],
        MOCK_NOW
      )

      expect(result.hasScore).toBe(true)
      expect(result.breakdown).toEqual({
        nightSleep: 92,
        daySleep: 72,
        totalSleep: 88,
        settling: 67,
      })
      expect(result.totalScore).toBe(82)
      expect(result.statusLabel).toBe('Building rhythm')
    })

    it('keeps age-band transitions deterministic at the boundary months', () => {
      expect(getAgeBand(new Date('2024-01-01T00:00:00Z').toISOString(), MOCK_NOW)).toBe(
        '4-6 months'
      )
      expect(getAgeBand(new Date('2023-10-01T00:00:00Z').toISOString(), MOCK_NOW)).toBe(
        '6-12 months'
      )
      expect(getAgeBand(new Date('2023-04-01T00:00:00Z').toISOString(), MOCK_NOW)).toBe(
        '12 months+'
      )
    })

    it('scores older fragmented nights in a stable and explainable way', () => {
      const result = calculateSleepScore(
        MOCK_DOBS['12 months+'],
        [
          createLog(1, 3, true, ['false_start'], 19),
          createLog(1, 3, true, ['needed_help'], 23),
          createLog(1, 2, true, ['needed_help'], 3),
          createLog(1, 1, false, ['short_nap']),
          createLog(2, 3, true, ['false_start'], 19),
          createLog(2, 3, true, ['needed_help'], 23),
          createLog(2, 2, true, ['needed_help'], 3),
          createLog(2, 1, false, ['short_nap']),
          createLog(3, 3, true, ['false_start'], 19),
          createLog(3, 3, true, ['needed_help'], 23),
          createLog(3, 2, true, ['needed_help'], 3),
          createLog(3, 1, false, ['short_nap']),
        ],
        MOCK_NOW
      )

      expect(result.hasScore).toBe(true)
      expect(result.breakdown).toEqual({
        nightSleep: 73,
        daySleep: 67,
        totalSleep: 72,
        settling: 0,
      })
      expect(result.totalScore).toBe(60)
      expect(result.statusLabel).toBe('Mixed pattern')
      expect(result.biggestChallenge).toBe('Settling')
    })
  })

  describe('prompt summary', () => {
    it('tells chat to start with a generic answer when the score is still learning', () => {
      const summary = calculateSleepScore(
        MOCK_DOBS['6-12 months'],
        [createLog(1, 10.5, true)],
        MOCK_NOW
      )

      expect(buildSleepScorePromptSummary(summary)).toContain(
        'Give a generic, non-judgmental answer first'
      )
      expect(buildSleepScorePromptSummary(summary)).toContain(
        "Tonight's best next step"
      )
    })
  })
})
