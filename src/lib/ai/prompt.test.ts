import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('buildChatPrompt', () => {
  it('includes the durable-vs-daily tool rules and sparse logging guardrails', async () => {
    const { buildChatPrompt } = await import('./prompt')

    const prompt = buildChatPrompt({
      babyName: 'Arlo',
      ageBand: '6-12 months',
      sleepStyleLabel: 'balanced',
      timezone: 'Australia/Sydney',
      localToday: '2026-04-23',
      aiMemory: null,
      durableProfileSummary:
        'Usual wake time: 7:00 am. Target bedtime: 7:15 pm. Target naps: 3.',
      todayPlanSummary: 'Sleep targets: Bedtime at 7:15 pm.',
      biggestIssue: 'Early waking',
      feedingType: 'breastfed',
      bedtimeRange: '7:00-7:30 pm',
      recentSleepSummary: '3 recent logs.',
      scoreSummary: 'Learning state.',
      conversationHistory: [],
      retrievedChunks: [],
      latestUserMessage: 'the plan says wake at 7 but he always wakes at 6',
    })

    expect(prompt).toContain('Treat explicit parent statements about stable patterns as high-confidence signals.')
    expect(prompt).toContain('Missing logs do not prove missing sleep.')
    expect(prompt).toContain('update_daily_plan')
    expect(prompt).toContain('update_sleep_plan_profile')
    expect(prompt).toContain('Learned baseline profile')
  })
})
