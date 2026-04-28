import { describe, expect, it } from 'vitest'

import {
  containsForbiddenResponsePhrase,
  createResponseTokenFilter,
  filterResponse,
} from './response-filter'

describe('filterResponse', () => {
  it('removes artificial leading Oh openers', () => {
    expect(filterResponse('Oh, ari is ready for a reset.')).toBe('Ari is ready for a reset.')
  })

  it('removes leading it sounds like phrasing and capitalizes the next word', () => {
    expect(filterResponse('It sounds like ari is overtired by bedtime.')).toBe(
      'Ari is overtired by bedtime.'
    )
  })

  it('rewrites sounds like phrasing when it appears later in the response', () => {
    expect(filterResponse('That sounds like overtiredness, not hunger.')).toBe(
      'That points to overtiredness, not hunger.'
    )
  })

  it('detects forbidden sounds-like phrasing', () => {
    expect(containsForbiddenResponsePhrase('This sounds like a split night.')).toBe(true)
    expect(containsForbiddenResponsePhrase('This points to a split night.')).toBe(false)
  })

  it('filters forbidden phrasing across streamed token boundaries', () => {
    const emitted: string[] = []
    const filter = createResponseTokenFilter((token) => emitted.push(token))

    filter.push('It sou')
    filter.push('nds like ari is overtired by bedtime, and that sou')
    filter.push('nds like the main driver.')
    filter.flush()

    const output = emitted.join('')
    expect(output).toContain('Ari is overtired')
    expect(output).toContain('that points to the main driver')
    expect(output).not.toMatch(/\bsounds\s+like\b/i)
  })
})
