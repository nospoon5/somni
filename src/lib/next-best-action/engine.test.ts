import { describe, expect, it } from 'vitest'
import { calculateNextBestAction } from './engine'
import type { NextBestActionEngineInputs } from './types'

function createInputs(overrides: Partial<NextBestActionEngineInputs> = {}): NextBestActionEngineInputs {
  return {
    currentTime: '2026-07-18T10:00:00.000Z',
    timezone: 'Australia/Sydney',
    babyAgeWeeks: 24,
    activeSleep: null,
    latestCompletedSleep: null,
    todaysLogs: [],
    todaysAcceptedPlan: {
      sleepTargets: [],
      feedTargets: []
    },
    pendingRescue: null,
    durableBaseline: null,
    onboardingConstraints: null,
    ...overrides
  }
}

describe('calculateNextBestAction', () => {
  it('handles active sleep approaching 2 hours', () => {
    // 10:00 Sydney = 00:00 UTC
    // Let's say sleep started at 07:30 Sydney (2.5 hours ago)
    const inputs = createInputs({
      currentTime: '2026-07-18T00:00:00.000Z', // UTC for 10:00 Sydney
      timezone: 'Australia/Sydney',
      activeSleep: {
        id: '1',
        startedAt: '2026-07-17T21:30:00.000Z', // 07:30 Sydney
        endedAt: null,
        isNight: false,
        tags: []
      }
    })
    
    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('do_this_next')
    expect(result.allowedActions).toContain('end_sleep')
    expect(result.shortRationale).toContain('reached 2 hours')
  })

  it('handles normal active sleep', () => {
    // 10:00 Sydney = 00:00 UTC
    // Sleep started at 09:15 Sydney (45 mins ago)
    const inputs = createInputs({
      currentTime: '2026-07-18T00:00:00.000Z',
      activeSleep: {
        id: '1',
        startedAt: '2026-07-17T23:15:00.000Z',
        endedAt: null,
        isNight: false,
        tags: []
      }
    })
    
    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('watch_for_this')
    expect(result.actionTitle).toBe('Baby is sleeping')
    expect(result.shortRationale).toContain('Asleep for 0h 45m')
  })

  it('suggests pending rescue if available', () => {
    const inputs = createInputs({
      pendingRescue: {
        sleepTargets: [{ label: 'Nap 1', targetTime: '10:30', window: null, notes: null }]
      }
    })
    
    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('log_or_confirm')
    expect(result.allowedActions).toContain('accept_rescue')
  })

  it('suggests overdue plan target logging', () => {
    // 10:00 time. Plan says Nap 1 at 09:00.
    const inputs = createInputs({
      currentTime: '2026-07-18T00:00:00.000Z', // 10:00 Sydney
      timezone: 'Australia/Sydney',
      todaysAcceptedPlan: {
        sleepTargets: [
          { label: 'Nap 1', targetTime: '09:00', window: null }
        ],
        feedTargets: []
      }
    })

    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('log_or_confirm')
    expect(result.actionTitle).toBe('Did nap 1 happen?')
    expect(result.allowedActions).toContain('log_missing_event')
  })

  it('suggests upcoming planned sleep', () => {
    // 10:00 time. Plan says Nap 2 at 11:00 (in 60 mins).
    const inputs = createInputs({
      currentTime: '2026-07-18T00:00:00.000Z', // 10:00 Sydney
      timezone: 'Australia/Sydney',
      todaysAcceptedPlan: {
        sleepTargets: [
          { label: 'Nap 2', targetTime: '11:00', window: null }
        ],
        feedTargets: []
      }
    })

    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('do_this_next')
    expect(result.actionTitle).toBe('Prepare for nap 2')
    expect(result.allowedActions).toContain('start_sleep')
  })

  it('handles very short naps', () => {
    // Current time 10:00 Sydney
    // Nap from 09:00 to 09:15 (15 mins)
    const inputs = createInputs({
      currentTime: '2026-07-18T00:00:00.000Z', // 10:00 Sydney
      timezone: 'Australia/Sydney',
      latestCompletedSleep: {
        id: '2',
        startedAt: '2026-07-17T23:00:00.000Z', // 09:00
        endedAt: '2026-07-17T23:15:00.000Z', // 09:15
        isNight: false,
        tags: []
      }
    })

    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('watch_for_this')
    expect(result.actionTitle).toBe('Short nap recorded')
    expect(result.shortRationale).toContain('only 15 minutes')
  })

  it('enters quiet nighttime state', () => {
    // 21:00 Sydney
    const inputs = createInputs({
      currentTime: '2026-07-18T11:00:00.000Z', // 21:00 Sydney
      timezone: 'Australia/Sydney'
    })

    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('watch_for_this')
    expect(result.actionTitle).toBe('Good night')
  })

  it('defaults to age fallback if no plan', () => {
    // 14:00 Sydney
    const inputs = createInputs({
      currentTime: '2026-07-18T04:00:00.000Z', // 14:00 Sydney
      timezone: 'Australia/Sydney'
    })

    const result = calculateNextBestAction(inputs)
    expect(result.state).toBe('do_this_next')
    expect(result.actionTitle).toBe("Follow your baby's cues")
  })
})
