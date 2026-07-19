import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from './content-security-policy'

const nonce = 'c29tbmktbm9uY2U='

describe('buildContentSecurityPolicy', () => {
  it('uses a strict nonce policy for production scripts and style elements', () => {
    const policy = buildContentSecurityPolicy(nonce, 'production')

    expect(policy).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`)
    expect(policy).toContain(`style-src-elem 'self' 'nonce-${nonce}'`)
    expect(policy).toContain("script-src-attr 'none'")
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).toContain('upgrade-insecure-requests')
  })

  it('limits the inline compatibility exception to style attributes', () => {
    const policy = buildContentSecurityPolicy(nonce, 'production')

    expect(policy).toContain("style-src 'self';")
    expect(policy).toContain("style-src-attr 'unsafe-inline'")
    expect(policy).not.toMatch(/style-src-elem[^;]*'unsafe-inline'/)
  })

  it('does not break assets on an explicitly allowed plain-HTTP local test server', () => {
    const policy = buildContentSecurityPolicy(nonce, 'production', {
      upgradeInsecureRequests: false,
    })

    expect(policy).not.toContain('upgrade-insecure-requests')
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("style-src 'self'")
  })

  it('keeps the allowances required by the Next.js development runtime', () => {
    const policy = buildContentSecurityPolicy(nonce, 'development')

    expect(policy).toMatch(/script-src[^;]*'unsafe-eval'/)
    expect(policy).toContain("style-src-elem 'self' 'unsafe-inline'")
    expect(policy).toContain("connect-src 'self' ws: wss:")
    expect(policy).not.toContain('upgrade-insecure-requests')
  })

  it('rejects a nonce that could inject another directive', () => {
    expect(() =>
      buildContentSecurityPolicy("valid'; report-uri https://attacker.invalid", 'production')
    ).toThrow('CSP nonce contains unsupported characters')
  })
})
