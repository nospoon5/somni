import { describe, expect, it } from 'vitest'

import { buildCompleteFallbackResponse, looksIncompleteAssistantResponse } from './response-completeness'

describe('looksIncompleteAssistantResponse', () => {
  it('detects severe truncated fragments from Run 5', () => {
    expect(
      looksIncompleteAssistantResponse(
        'Ari has developed a strong sleep association with the carrier, which is a common way babies find'
      )
    ).toBe(true)

    expect(
      looksIncompleteAssistantResponse(
        "When Ari wakes up rubbing his eyes but won't go back to sleep, it most"
      )
    ).toBe(true)

    expect(
      looksIncompleteAssistantResponse(
        'Aria is going through a common developmental leap, learning to pull to stand, which is temporarily'
      )
    ).toBe(true)
  })

  it('detects cut-off list items and unfinished section headers', () => {
    expect(
      looksIncompleteAssistantResponse(
        [
          'Ari is finding the bedtime routine overstimulating right now.',
          '',
          'What to try tonight:',
          '1. Shorten the routine to five minutes.',
          '2. Keep the room dim and quiet.',
          '3. Start as soon as you see tired signs, before',
        ].join('\n')
      )
    ).toBe(true)

    expect(
      looksIncompleteAssistantResponse(
        [
          'Ari is waking every two hours, which most likely points to a biological need.',
          '',
          'What to try tonight:',
          '1. Offer a feed when Ari wakes.',
          '2. Keep the room dim.',
          '',
          'What',
        ].join('\n')
      )
    ).toBe(true)
  })

  it('allows complete short clarification responses', () => {
    expect(
      looksIncompleteAssistantResponse(
        'You are feeling really overwhelmed right now. To help me understand what "bad" sleep means, are you seeing hard settling, frequent night wakes, short naps, or all three?'
      )
    ).toBe(false)
  })

  it('allows a mostly complete answer with a final check-in missing punctuation', () => {
    expect(
      looksIncompleteAssistantResponse(
        [
          'Aria might be experiencing some tummy discomfort or reflux after settling.',
          '',
          'What to try tonight:',
          '1. Keep Aria upright for 20-30 minutes after her last feed.',
          '2. Offer comfort if it has been a while since her last feed.',
          '3. Gently rub her tummy or bicycle her legs before bedtime.',
          '',
          'What compromise is okay: If she is really struggling, a gentle cuddle to help her settle back down is fine.',
          'Check-in: Let me know how this goes tonight',
        ].join('\n')
      )
    ).toBe(false)
  })
})

describe('buildCompleteFallbackResponse', () => {
  it('returns a complete practical fallback', () => {
    const fallback = buildCompleteFallbackResponse({ babyName: 'Ari' })

    expect(looksIncompleteAssistantResponse(fallback)).toBe(false)
    expect(fallback).toContain('What to try tonight:')
    expect(fallback).toContain('Check-in:')
  })

  it('adds medication boundaries when the original question involved medication', () => {
    const fallback = buildCompleteFallbackResponse({
      babyName: 'Aria',
      medicationContext: true,
    })

    expect(fallback).toContain('Medication note:')
    expect(fallback).toContain('label and age/weight instructions')
    expect(fallback).toContain('GP, pharmacist, or child health nurse')
    expect(fallback).not.toMatch(/absolutely use|yes,\s+you can|safe to give/i)
  })
})
