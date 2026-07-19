import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import {
  resolveActiveBaby,
  resolveStrictActiveBaby,
  shouldUseSecureActiveBabyCookie,
} from './active-baby'

const babies = [{ id: 'first' }, { id: 'second' }]

describe('active baby selection', () => {
  it('falls back only for display reads', () => {
    expect(resolveActiveBaby(babies, 'missing')).toEqual({ id: 'first' })
    expect(resolveStrictActiveBaby(babies, 'missing')).toBeNull()
  })

  it('keeps production cookies secure except for a plain-HTTP loopback request', () => {
    expect(
      shouldUseSecureActiveBabyCookie({
        nodeEnv: 'production',
        requestHost: 'somni.example',
        requestProtocol: 'https',
      }),
    ).toBe(true)
    expect(
      shouldUseSecureActiveBabyCookie({
        nodeEnv: 'production',
        requestHost: '127.0.0.1:3107',
        requestProtocol: 'http',
      }),
    ).toBe(false)
    expect(
      shouldUseSecureActiveBabyCookie({
        nodeEnv: 'production',
        requestHost: 'somni.example',
        requestProtocol: 'http',
      }),
    ).toBe(true)
  })
})
