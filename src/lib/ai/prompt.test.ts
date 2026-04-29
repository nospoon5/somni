import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('buildChatPrompt', () => {
  it('includes the durable-vs-daily tool rules and sparse logging guardrails', async () => {
    const { buildChatPrompt } = await import('./prompt')

    const prompt = buildChatPrompt({
      babyName: 'Arlo',
      ageBand: '6-12 months',
      profileAgeBand: '6-12 months',
      questionStatedAge: null,
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
    expect(prompt).toContain(
      "If the conversation suggests a clear schedule change, ask the parent if they'd like you to update today's plan on their dashboard."
    )
    expect(prompt).toContain('update_daily_plan')
    expect(prompt).toContain('update_sleep_plan_profile')
    expect(prompt).toContain('Learned baseline profile')
  })

  it('adds the opening confidence class and bans the recurring sounds-like phrase', async () => {
    const { buildChatPrompt, classifyOpeningConfidence } = await import('./prompt')

    const prompt = buildChatPrompt({
      babyName: 'Ari',
      ageBand: '4-6 months',
      profileAgeBand: '4-6 months',
      questionStatedAge: null,
      sleepStyleLabel: 'balanced',
      timezone: 'Australia/Sydney',
      localToday: '2026-04-28',
      aiMemory: null,
      durableProfileSummary: 'No learned baseline yet.',
      todayPlanSummary: 'No plan yet.',
      biggestIssue: null,
      feedingType: null,
      bedtimeRange: null,
      recentSleepSummary: 'No recent sleep logs yet.',
      scoreSummary: 'Learning state.',
      conversationHistory: [],
      retrievedChunks: [],
      latestUserMessage: 'He wakes every 45 minutes overnight.',
    })

    expect(classifyOpeningConfidence('He wakes every 45 minutes overnight.')).toBe(
      'clear_pattern'
    )
    expect(classifyOpeningConfidence('Sleep is bad. Fix it.')).toBe('ambiguous')
    expect(classifyOpeningConfidence('Can I give melatonin gummies?')).toBe('medical_safety')
    expect(prompt).toContain('Opening confidence class: clear_pattern')
    expect(prompt).toContain('Never use the recurring sound-based hedge.')
    expect(prompt).not.toContain('"sounds like"')
  })

  it('makes the latest-message age override the stored profile age for the current answer', async () => {
    const { buildChatPrompt } = await import('./prompt')

    const prompt = buildChatPrompt({
      babyName: 'Ari',
      ageBand: '6-12 months',
      profileAgeBand: '6-12 months',
      questionStatedAge: '8 months',
      sleepStyleLabel: 'balanced',
      timezone: 'Australia/Sydney',
      localToday: '2026-04-29',
      aiMemory: 'Ari is 11 months old and usually sleeps in a cot.',
      durableProfileSummary: 'Usual wake time: 6:30 am.',
      todayPlanSummary: 'Sleep targets: Bedtime at 7:00 pm.',
      biggestIssue: null,
      feedingType: 'breastfed',
      bedtimeRange: '7:00-7:30 pm',
      recentSleepSummary: 'No recent sleep logs yet.',
      scoreSummary: 'Learning state.',
      conversationHistory: [],
      retrievedChunks: [],
      latestUserMessage: 'Can my 8-month-old sleep with a stuffed animal yet?',
    })

    expect(prompt).toContain('Question-stated age: 8 months. Use this age')
    expect(prompt).toContain('Stored profile age band: 6-12 months')
    expect(prompt).toContain('lower priority for this answer')
    expect(prompt).toContain('every age-sensitive statement must match that age')
  })

  it('keeps stored profile age as the normal fallback when the latest question has no age', async () => {
    const { buildChatPrompt } = await import('./prompt')

    const prompt = buildChatPrompt({
      babyName: 'Ari',
      ageBand: '6-12 months',
      profileAgeBand: '6-12 months',
      questionStatedAge: null,
      sleepStyleLabel: 'balanced',
      timezone: 'Australia/Sydney',
      localToday: '2026-04-29',
      aiMemory: null,
      durableProfileSummary: 'Usual wake time: 6:30 am.',
      todayPlanSummary: 'Sleep targets: Bedtime at 7:00 pm.',
      biggestIssue: null,
      feedingType: 'breastfed',
      bedtimeRange: '7:00-7:30 pm',
      recentSleepSummary: 'No recent sleep logs yet.',
      scoreSummary: 'Learning state.',
      conversationHistory: [],
      retrievedChunks: [],
      latestUserMessage: 'Can she sleep with a stuffed animal yet?',
    })

    expect(prompt).toContain(
      'Question-stated age: not stated in the latest message. Use the stored profile age and baby context normally.'
    )
  })
})
