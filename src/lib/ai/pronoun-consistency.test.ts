import { describe, expect, it } from 'vitest'

import {
  containsConflictingPronouns,
  getPronounRewriteInstruction,
  inferLatestPronounPreference,
} from './pronoun-consistency'

describe('latest-message pronoun consistency', () => {
  it('infers an unambiguous preference from the latest parent message', () => {
    expect(inferLatestPronounPreference('He wakes and I feed him in his room.')).toBe(
      'masculine'
    )
    expect(inferLatestPronounPreference('She wakes when I put her in her cot.')).toBe(
      'feminine'
    )
    expect(inferLatestPronounPreference('My baby wakes often.')).toBeNull()
  })

  it('detects contradictions in the finished response', () => {
    expect(containsConflictingPronouns('Offer her a full feed.', 'masculine')).toBe(true)
    expect(containsConflictingPronouns('Offer him a full feed.', 'masculine')).toBe(false)
    expect(containsConflictingPronouns('Offer him a full feed.', 'feminine')).toBe(true)
  })

  it('builds a concrete correction instruction', () => {
    expect(getPronounRewriteInstruction('masculine')).toContain('he, him, and his')
    expect(getPronounRewriteInstruction('feminine')).toContain('she, her, and hers')
  })
})
