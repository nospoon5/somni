import { describe, expect, it } from 'vitest'

import {
  containsForbiddenResponsePhrase,
  containsUnsafeMedicationPermission,
  createResponseTokenFilter,
  filterResponse,
  hasMedicationContext,
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

  it('detects unsafe medication permission only in medication context', () => {
    expect(hasMedicationContext('Can I use Panadol tonight?')).toBe(true)
    expect(
      containsUnsafeMedicationPermission(
        'Yes, you can absolutely use Panadol while teething.',
        'Can I use Panadol tonight?'
      )
    ).toBe(true)
    expect(
      containsUnsafeMedicationPermission(
        'Yes, you can use it if she seems uncomfortable.',
        'Can I use Panadol tonight?'
      )
    ).toBe(true)
    expect(containsForbiddenResponsePhrase('Panadol is safe to give at the right dose.')).toBe(
      true
    )
    expect(containsForbiddenResponsePhrase('Yes, you can resettle first.')).toBe(false)
  })

  it('rewrites unsafe medication authorisation into boundary wording', () => {
    const output = filterResponse(
      'Yes, you can absolutely use Panadol while teething. Then keep resettling.',
      'Can I use Panadol?'
    )

    expect(output).toContain('commonly used in some situations')
    expect(output).toContain('label and the age/weight dosing instructions')
    expect(output).toContain('GP, pharmacist, or child health nurse')
    expect(output).toMatch(/pause sleep coaching/i)
    expect(output).not.toMatch(/absolutely use|you can absolutely|yes,\s+you can|safe to give/i)
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
