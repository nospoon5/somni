import { describe, expect, it } from 'vitest'

import {
  containsConflictingQuestionAge,
  parseQuestionStatedAge,
  rewriteConflictingQuestionAge,
} from './age-override'

describe('explicit latest-message age override', () => {
  it.each([
    ['Can my 8-month-old sleep with a stuffed animal yet?', '8 months', '6-12 months'],
    ['Can my 8 month old sleep with a stuffed animal yet?', '8 months', '6-12 months'],
    ['Can my 8 months old sleep with a stuffed animal yet?', '8 months', '6-12 months'],
    ['Is my 8mo ready for two naps?', '8 months', '6-12 months'],
    ['Is my 8 m/o ready for two naps?', '8 months', '6-12 months'],
    ['Can my 4-week-old sleep longer overnight?', '4 weeks', '0-3 months'],
    ['Can my 4 weeks old sleep longer overnight?', '4 weeks', '0-3 months'],
    ['How should I settle my newborn?', '2 weeks', '0-3 months'],
    ['Can my 3-year-old still nap?', '3 years', '12 months+'],
  ])('parses "%s"', (message, label, ageBand) => {
    const age = parseQuestionStatedAge(message)

    expect(age?.label).toBe(label)
    expect(age?.ageBand).toBe(ageBand)
  })

  it('does not override when the latest message does not state an age', () => {
    expect(parseQuestionStatedAge('Can she sleep with a stuffed animal yet?')).toBeNull()
  })

  it('flags the Q028-style profile age contamination', () => {
    const age = parseQuestionStatedAge('Can my 8-month-old sleep with a stuffed animal yet?')

    expect(
      containsConflictingQuestionAge(
        "For an 11-month-old, it's best to keep the cot clear.",
        age
      )
    ).toBe(true)
  })

  it('does not flag normal age cutoffs for safe sleep guidance', () => {
    const age = parseQuestionStatedAge('Can my 8-month-old sleep with a stuffed animal yet?')

    expect(
      containsConflictingQuestionAge(
        'For an 8-month-old, keep the cot clear. Soft toys are usually delayed until 12 months, or closer to 12 months if you are unsure.',
        age
      )
    ).toBe(false)
  })

  it('covers safety-style prompts where age changes the advice', () => {
    const medicationAge = parseQuestionStatedAge('Can my 4-week-old have Panadol?')
    const feedingAge = parseQuestionStatedAge('Can my newborn have formula top-ups overnight?')
    const safeSleepAge = parseQuestionStatedAge('Can my 8 m/o sleep with a stuffed animal?')

    expect(medicationAge?.label).toBe('4 weeks')
    expect(feedingAge?.label).toBe('2 weeks')
    expect(safeSleepAge?.label).toBe('8 months')
  })

  it('can deterministically rewrite a conflicting age mention if retry still fails', () => {
    const age = parseQuestionStatedAge('Can my 8-month-old sleep with a stuffed animal yet?')

    expect(
      rewriteConflictingQuestionAge(
        "For an 11-month-old, it's best to keep the cot clear until 12 months.",
        age
      )
    ).toBe("For an 8-month-old, it's best to keep the cot clear until 12 months.")
  })
})
