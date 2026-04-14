import { describe, expect, it } from 'vitest'
import { resolveSupportOrigin } from './origin'

const appOrigin = 'https://somni.app'

describe('resolveSupportOrigin', () => {
  it('prefers explicit query origin when provided', () => {
    const result = resolveSupportOrigin({
      appOrigin,
      currentSupportPage: '/support?from=%2Fdashboard',
      queryOrigin: '/dashboard',
      lastInAppPage: '/chat',
      documentReferrer: `${appOrigin}/sleep`,
    })

    expect(result).toBe('/dashboard')
  })

  it('falls back to stored last in-app page', () => {
    const result = resolveSupportOrigin({
      appOrigin,
      currentSupportPage: '/support',
      queryOrigin: null,
      lastInAppPage: '/dashboard',
      documentReferrer: '',
    })

    expect(result).toBe('/dashboard')
  })

  it('uses same-origin referrer when query and storage are missing', () => {
    const result = resolveSupportOrigin({
      appOrigin,
      currentSupportPage: '/support',
      queryOrigin: null,
      lastInAppPage: null,
      documentReferrer: `${appOrigin}/billing`,
    })

    expect(result).toBe('/billing')
  })

  it('falls back to support page for cross-origin referrer', () => {
    const result = resolveSupportOrigin({
      appOrigin,
      currentSupportPage: '/support',
      queryOrigin: null,
      lastInAppPage: null,
      documentReferrer: 'https://example.com/other',
    })

    expect(result).toBe('/support')
  })
})
