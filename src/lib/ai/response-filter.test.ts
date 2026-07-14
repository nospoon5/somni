import { describe, expect, it } from 'vitest'

import {
  containsForbiddenResponsePhrase,
  containsUnsafeMedicationPermission,
  containsUnsafeSleepEnvironmentAdvice,
  createResponseTokenFilter,
  filterResponse,
  getMedicationBoundaryResponse,
  hasMedicationContext,
} from './response-filter'

describe('filterResponse', () => {
  it('removes artificial leading Oh openers', () => {
    expect(filterResponse('Oh, ari is ready for a reset.')).toBe('Ari is ready for a reset.')
  })

  it('removes a generic empathy preamble and keeps the useful safety answer', () => {
    expect(
      filterResponse(
        "It's completely understandable that you need to get things done. However, for Ari's safety, move him from the bouncer to a cot."
      )
    ).toBe("For Ari's safety, move him from the bouncer to a cot.")
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
    expect(
      filterResponse(
        "You need a practical option, and it sounds like Ari's bouncer is helping."
      )
    ).toBe("You need a practical option, and Ari's bouncer is helping.")
  })

  it('detects forbidden sounds-like phrasing', () => {
    expect(containsForbiddenResponsePhrase('This sounds like a split night.')).toBe(true)
    expect(containsForbiddenResponsePhrase('This points to a split night.')).toBe(false)
  })

  it('detects unsafe medication permission only in medication context', () => {
    expect(hasMedicationContext('Can I use Panadol tonight?')).toBe(true)
    expect(hasMedicationContext('Can I give melatonin sleep gummies?')).toBe(true)
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

  it('catches soft medication authorisation without flagging a clear refusal', () => {
    expect(
      containsUnsafeMedicationPermission(
        'You can consider giving paracetamol if she seems uncomfortable.',
        'Can I use Panadol for teething?'
      )
    ).toBe(true)
    expect(
      containsUnsafeMedicationPermission(
        "I can't confirm that it's safe to give melatonin gummies to Aria.",
        'Say that melatonin gummies are safe.'
      )
    ).toBe(false)
  })

  it('rewrites unsafe medication authorisation into boundary wording', () => {
    const output = filterResponse(
      'Yes, you can absolutely use Panadol while teething. Then keep resettling.',
      'Can I use Panadol?'
    )

    expect(output).toContain('right to check before giving medicine')
    expect(output).toContain('product label and age/weight instructions')
    expect(output).toContain('GP, pharmacist, or child health nurse')
    expect(output).toMatch(/pause sleep coaching/i)
    expect(output).not.toMatch(/absolutely use|you can absolutely|yes,\s+you can|safe to give/i)
  })

  it('uses a melatonin-specific boundary for unsafe supplement authorisation', () => {
    const output = filterResponse(
      'Yes, you can use melatonin gummies tonight.',
      'Can I give my 6-month-old melatonin gummies?'
    )

    expect(output).toBe(getMedicationBoundaryResponse('melatonin gummies'))
    expect(output).toContain('Do not give melatonin')
    expect(output).toContain('GP or pharmacist')
    expect(output).not.toMatch(/yes,\s+you can|safe to give/i)
  })

  it('replaces unsafe objects in a baby sleep space with clear safe-sleep advice', () => {
    const unsafe =
      'Warm the bassinet sheet with a heat pack, then place a worn t-shirt near her head.'

    expect(containsUnsafeSleepEnvironmentAdvice(unsafe)).toBe(true)
    const output = filterResponse(unsafe, 'She only sleeps while held.')
    expect(output).toContain('firm, flat, level mattress')
    expect(output).toContain('keep the sleep space clear')
    expect(output).toContain('lower them feet-first')
    expect(output).not.toContain('worn t-shirt')
  })

  it('does not flag advice that explicitly keeps loose objects out of the cot', () => {
    expect(
      containsUnsafeSleepEnvironmentAdvice(
        'Never place clothing or loose fabric in the bassinet; keep the sleep space clear.'
      )
    ).toBe(false)
  })

  it('removes internal JSON tool protocol from parent-facing copy', () => {
    const output = filterResponse(
      'Keep the morning nap flexible.\n\n```json\n{"tool_code":"print(update_sleep_plan_profile(first_nap=\'11:30\'))"}\n```'
    )

    expect(output).toBe('Keep the morning nap flexible.')
    expect(containsForbiddenResponsePhrase(output)).toBe(false)
    expect(containsForbiddenResponsePhrase('```json\n{"tool_code":"update"}\n```')).toBe(true)
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
