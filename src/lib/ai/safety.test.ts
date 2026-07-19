import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('safety routing', () => {
  it('routes fever plus lethargy or passing out to urgent medical safety', async () => {
    const { checkEmergencyRisk, getEmergencyRedirectMessage } = await import('./safety')

    const safety = checkEmergencyRisk(
      'She has a fever, is lethargic, and looked like she was passing out.'
    )
    const message = getEmergencyRedirectMessage(safety.route)

    expect(safety.isEmergency).toBe(true)
    expect(safety.route).toBe('urgent_medical')
    expect(message).toContain('urgent medical advice now')
    expect(message).toContain('not a normal sleep issue')
    expect(message).toContain('Pause sleep coaching')
    expect(message).not.toMatch(/\bsounds\s+like\b/i)
  })

  it('routes under-3-month fever to urgent medical safety', async () => {
    const { checkEmergencyRisk } = await import('./safety')

    expect(checkEmergencyRisk('My 8 week old has a fever.').route).toBe('urgent_medical')
    expect(checkEmergencyRisk('She has a fever.', { babyAgeWeeks: 8 }).route).toBe(
      'urgent_medical'
    )
    expect(checkEmergencyRisk('She has a fever.', { babyAgeWeeks: 30 }).route).toBe('none')
  })

  it('does not treat an outfit question as a seizure because fit is only a whole word', async () => {
    const { checkEmergencyRisk } = await import('./safety')

    expect(checkEmergencyRisk('Is this sleep outfit warm enough?').route).toBe('none')
  })

  it('keeps parent crisis routing separate from urgent illness routing', async () => {
    const { checkEmergencyRisk, getEmergencyRedirectMessage } = await import('./safety')

    const safety = checkEmergencyRisk("I can't do this anymore and feel like shaking the baby.")
    const message = getEmergencyRedirectMessage(safety.route)

    expect(safety.isEmergency).toBe(true)
    expect(safety.route).toBe('crisis')
    expect(message).toContain('safest choice here, not a failure')
    expect(message).toContain('Call someone you trust')
    expect(message).toContain('PANDA')
    expect(message).toContain('Sleep coaching can wait')
    expect(message).not.toContain('What to try')
  })
})
