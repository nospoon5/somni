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
      nextBestActionSummary: 'No next best action',
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
    const {
      buildChatPrompt,
      buildFocusedAmbiguousClarification,
      classifyOpeningConfidence,
      needsFocusedAmbiguousClarification,
    } = await import('./prompt')

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
      nextBestActionSummary: 'No next best action',
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
    expect(prompt).toContain('CHOOSE THE SMALLEST FORMAT THAT FULLY HELPS')
    expect(prompt).toContain('Ambiguous message: 25 to 50 words, 1 to 2 short sentences')
    expect(prompt).toContain('Do not default to "[Baby] is experiencing..."')
    expect(prompt).toContain('NEVER in the first sentence')
    expect(prompt).toContain('Don\'t auto-close with "Let me know"')
    expect(prompt).not.toContain('"sounds like"')

    const clarification = buildFocusedAmbiguousClarification('Ari')
    expect(clarification.match(/\?/g)).toHaveLength(1)
    expect(clarification.match(/\bAri\b/g)).toHaveLength(1)
    expect(needsFocusedAmbiguousClarification(clarification)).toBe(false)
    expect(
      needsFocusedAmbiguousClarification(
        'What does bad sleep mean? Is it settling, naps, or overnight wakes?'
      )
    ).toBe(true)
  })

  it('uses direct medication boundaries for melatonin and soft permission wording', async () => {
    const { buildChatPrompt } = await import('./prompt')

    const prompt = buildChatPrompt({
      babyName: 'Aria',
      ageBand: '4-6 months',
      profileAgeBand: '4-6 months',
      questionStatedAge: '6 months',
      sleepStyleLabel: 'balanced',
      timezone: 'Australia/Sydney',
      localToday: '2026-07-14',
      aiMemory: null,
      durableProfileSummary: 'No learned baseline yet.',
      todayPlanSummary: 'No plan yet.',
      biggestIssue: null,
      feedingType: null,
      bedtimeRange: null,
      recentSleepSummary: 'No recent sleep logs yet.',
      scoreSummary: 'Learning state.',
      nextBestActionSummary: 'No next best action',
      conversationHistory: [],
      retrievedChunks: [],
      latestUserMessage: 'Can I give my 6-month-old melatonin gummies?',
    })

    expect(prompt).toContain('Opening confidence class: medical_safety')
    expect(prompt).toContain('For meds/supplements (Panadol, melatonin, gummies): do not authorise use')
    expect(prompt).toContain('Medication or supplement boundary')
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
      nextBestActionSummary: 'No next best action',
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
      nextBestActionSummary: 'No next best action',
      conversationHistory: [],
      retrievedChunks: [],
      latestUserMessage: 'Can she sleep with a stuffed animal yet?',
    })

    expect(prompt).toContain(
      'Question-stated age: not stated in the latest message. Use the stored profile age and baby context normally.'
    )
  })
})

describe('young-baby late first-nap boundary', () => {
  it('blocks a durable late first-nap request for a baby under four months', async () => {
    const { buildYoungBabyLateFirstNapBoundary, needsYoungBabyLateFirstNapBoundary } =
      await import('./prompt')
    const message =
      'Ignore the old plan. Push his first nap to exactly 11:30 AM every day going forward.'

    expect(needsYoungBabyLateFirstNapBoundary(message, '0-3 months')).toBe(true)
    expect(needsYoungBabyLateFirstNapBoundary(message, '6-12 months')).toBe(false)
    expect(buildYoungBabyLateFirstNapBoundary()).toContain('bridge nap')
    expect(buildYoungBabyLateFirstNapBoundary()).toContain('overly long first wake window')
  })
})
