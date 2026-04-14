import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  calculateSleepScore,
  type SleepLogLike,
} from '../../lib/scoring/sleep-score'
import { SleepScorePanel } from './SleepScorePanel'

const MOCK_NOW = new Date('2024-05-01T12:00:00Z')
const DOB = new Date('2023-08-01T00:00:00Z').toISOString()

const fakeStyles = {
  scorePanel: 'scorePanel',
  scoreHeader: 'scoreHeader',
  scoreKicker: 'scoreKicker',
  scoreTitle: 'scoreTitle',
  scoreBadge: 'scoreBadge',
  scoreBody: 'scoreBody',
  scoreFocus: 'scoreFocus',
  metricGrid: 'metricGrid',
  metricCard: 'metricCard',
  scoreMeta: 'scoreMeta',
  questionCard: 'questionCard',
  questionList: 'questionList',
  emptySteps: 'emptySteps',
  step: 'step',
  stepNumber: 'stepNumber',
  stepBody: 'stepBody',
  emptyTip: 'emptyTip',
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
    endedAt: new Date(start.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
    isNight,
    tags,
  }
}

describe('SleepScorePanel', () => {
  it('renders the empty dashboard state', () => {
    const html = renderToStaticMarkup(
      <SleepScorePanel sleepScore={null} hasActiveSleep={false} styles={fakeStyles} />
    )

    expect(html).toContain('Ready when you are')
    expect(html).toContain('Log the next sleep')
    expect(html).toContain('Ask Somni one focused question')
  })

  it('renders the learning state for sparse data', () => {
    const summary = calculateSleepScore(DOB, [createLog(1, 10.5, true)], MOCK_NOW)
    const html = renderToStaticMarkup(
      <SleepScorePanel sleepScore={summary} hasActiveSleep={false} styles={fakeStyles} />
    )

    expect(html).toContain('Learning your rhythm')
    expect(html).toContain('Best next step tonight')
    expect(html).toContain('Questions that will sharpen Somni')
    expect(html).toContain('How are naps going right now')
  })

  it('renders the ready state with the numeric score and supporting copy', () => {
    const summary = calculateSleepScore(
      DOB,
      [
        createLog(1, 10.5, true, ['easy_settle']),
        createLog(1, 3, false, ['easy_settle']),
        createLog(2, 10.5, true, ['easy_settle']),
        createLog(2, 3, false, ['easy_settle']),
        createLog(3, 10.5, true, ['easy_settle']),
        createLog(3, 3, false, ['easy_settle']),
      ],
      MOCK_NOW
    )
    const html = renderToStaticMarkup(
      <SleepScorePanel sleepScore={summary} hasActiveSleep={false} styles={fakeStyles} />
    )

    expect(html).toContain('100/100')
    expect(html).toContain('Strongest area:')
    expect(html).toContain('Tonight&#x27;s focus')
    expect(html).toContain('Observed 40.5h across 3 covered days in the last 7 days')
  })
})
