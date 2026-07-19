import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { normalizeCompletedSleepLogArgs } from './chat-plan-persistence'

describe('completed sleep-log tool validation', () => {
  const now = new Date('2026-07-19T08:00:00.000Z')

  it('normalizes a recent, ordered interval', () => {
    expect(
      normalizeCompletedSleepLogArgs(
        {
          started_at: '2026-07-19T06:00:00Z',
          ended_at: '2026-07-19T07:00:00Z',
          is_night: false,
          notes: '  settled quickly  ',
        },
        now
      )
    ).toEqual({
      startedAt: '2026-07-19T06:00:00.000Z',
      endedAt: '2026-07-19T07:00:00.000Z',
      isNight: false,
      notes: 'settled quickly',
    })
  })

  it.each([
    ['unparseable', 'not-a-date', '2026-07-19T07:00:00Z'],
    ['reversed', '2026-07-19T07:00:00Z', '2026-07-19T06:00:00Z'],
    ['too old', '2026-07-16T06:00:00Z', '2026-07-16T07:00:00Z'],
    ['future', '2026-07-19T09:00:00Z', '2026-07-19T10:00:00Z'],
    ['too long', '2026-07-18T06:00:00Z', '2026-07-19T07:00:01Z'],
  ])('rejects %s model timestamps', (_label, startedAt, endedAt) => {
    expect(
      normalizeCompletedSleepLogArgs({ started_at: startedAt, ended_at: endedAt }, now)
    ).toBeNull()
  })
})
