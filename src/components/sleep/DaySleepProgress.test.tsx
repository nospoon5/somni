// @vitest-environment jsdom

import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DaySleepProgress } from './DaySleepProgress'

describe('DaySleepProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders correctly when behind target', () => {
    render(<DaySleepProgress targetMinutes={270} loggedMinutes={120} />)
    
    expect(screen.getByText('Daytime Sleep Budget')).toBeDefined()
    expect(screen.getByText('Target: 4h 30m')).toBeDefined()
    // 120 // 60 = 2h. 270 - 120 = 150 = 2h 30m difference
    expect(screen.getByText('2h 0m logged • 2h 30m left')).toBeDefined()
  })

  it('renders sweet spot text when at or near target', () => {
    // 90% of 270 is 243. So 243+ minutes should show sweet spot
    render(<DaySleepProgress targetMinutes={270} loggedMinutes={250} />)
    
    expect(screen.getByText('Target reached! Perfect for today.')).toBeDefined()
  })

  it('renders warning text when over target', () => {
    render(<DaySleepProgress targetMinutes={180} loggedMinutes={210} />) // 30 mins over
    
    expect(
      screen.getByText("30m over target. Cap this nap to protect tonight's sleep.")
    ).toBeDefined()
  })

  it('calculates active nap time in real time', () => {
    const now = new Date('2026-04-21T10:00:00Z').getTime()
    vi.setSystemTime(now)

    // Nap started 30 mins ago
    const startedAt = new Date(now - 30 * 60000).toISOString()
    
    render(<DaySleepProgress targetMinutes={120} loggedMinutes={60} activeNapStart={startedAt} />)
    
    // Initially, 60m previous logs + 30m active = 90m total (1h 30m)
    expect(screen.getByText('1h 30m logged • 30m left')).toBeDefined()

    // Advance time by 30 mins (so total is now 120m)
    act(() => {
      vi.advanceTimersByTime(30 * 60000)
    })

    expect(screen.getAllByText('Target reached! Perfect for today.').length).toBeGreaterThan(0)
  })
})
