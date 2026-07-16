import { describe, expect, it } from 'vitest'
import { formatNotificationTime } from './feed'

describe('formatNotificationTime', () => {
  it('formats recent updates in minutes', () => {
    expect(
      formatNotificationTime(
        '2026-07-16T00:00:00.000Z',
        new Date('2026-07-16T00:30:00.000Z')
      )
    ).toBe('30m ago')
  })

  it('formats updates from the same day in hours', () => {
    expect(
      formatNotificationTime(
        '2026-07-16T00:00:00.000Z',
        new Date('2026-07-16T03:00:00.000Z')
      )
    ).toBe('3h ago')
  })
})
