import { describe, expect, it } from 'vitest'

import {
  getPremiumVoiceViolations,
  normalizeBabyNamePlacement,
  removeBabyName,
} from './response-style'

describe('getPremiumVoiceViolations', () => {
  it('accepts a concise personalised answer with the name placed after the opening', () => {
    const response =
      'Day-night confusion is very common at four weeks. Keep daytime bright and night feeds dim so Ari gets a clear contrast.'

    expect(getPremiumVoiceViolations(response, 'Ari')).toEqual([])
  })

  it('does not force the name into an answer when it would feel unnatural', () => {
    expect(
      getPremiumVoiceViolations(
        'Day-night confusion is common at four weeks. Keep daytime bright and nights dim.',
        'Ari'
      )
    ).toEqual([])
  })

  it('detects formulaic openings and repeated baby names', () => {
    const response =
      'Ari is experiencing day-night confusion. Keep Ari in bright light during the day.'

    expect(getPremiumVoiceViolations(response, 'Ari')).toEqual(
      expect.arrayContaining([
        'baby_name_count',
        'baby_name_in_first_sentence',
        'formulaic_name_opener',
      ])
    )
  })

  it('detects a formulaic opener even when the model swaps in a generic subject', () => {
    expect(
      getPremiumVoiceViolations(
        'Your little one is experiencing day-night confusion. Keep daytime bright.',
        'Ari'
      )
    ).toContain('formulaic_subject_opener')
    expect(
      getPremiumVoiceViolations(
        'Your 8-week-old is becoming overtired by late afternoon.',
        'Ari'
      )
    ).toContain('formulaic_subject_opener')
  })

  it('detects generic empathy, closers, and the full template', () => {
    const response = [
      "It's completely understandable that this is hard.",
      'What to try tonight: Keep the room dark for Ari.',
      'What compromise is okay: Use the pram if needed.',
      'Check-in: Let me know how it goes and we can adjust.',
    ].join('\n')

    expect(getPremiumVoiceViolations(response, 'Ari')).toEqual(
      expect.arrayContaining(['generic_empathy_opener', 'generic_closer', 'full_template'])
    )
  })

  it('detects a vague offer instead of giving the parent the useful next step', () => {
    expect(
      getPremiumVoiceViolations(
        'Bouncers are not safe for sleep. Perhaps we can look at other strategies for Ari.',
        'Ari'
      )
    ).toContain('generic_closer')
  })

  it('moves a first-sentence name out and limits later repetition', () => {
    const response =
      'Ari is finding the evenings difficult. Keep Ari close for the wind-down, then place Ari in the cot.'

    expect(normalizeBabyNamePlacement(response, 'Ari')).toBe(
      'Your baby is finding the evenings difficult. Keep Ari close for the wind-down, then place your baby in the cot.'
    )
  })

  it('turns a repeated generic AI opening into a direct pattern statement', () => {
    expect(
      normalizeBabyNamePlacement(
        'Your little one is experiencing day-night confusion. Keep daytime bright for Ari.',
        'Ari'
      )
    ).toBe('The main issue here is day-night confusion. Keep daytime bright for Ari.')
  })

  it('can omit a profile name when the latest-message pronouns may conflict', () => {
    expect(removeBabyName('Aria wakes often. Feed Aria in a quiet room.', 'Aria')).toBe(
      'Your baby wakes often. Feed your baby in a quiet room.'
    )
  })
})
