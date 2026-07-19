import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequestLogger, StructuredLogger } from './logger'

describe('StructuredLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('marks actionable errors and redacts identifiers in context and metadata', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = new StructuredLogger({ requestId: 'request-1', userId: 'user-123' })

    logger.error(
      'Operation failed',
      { profileId: 'profile-123', baby_id: 'baby-123', email: 'parent@example.com' },
      new Error('provider failed'),
      true,
    )

    expect(errorSpy).toHaveBeenCalledOnce()
    const payload = JSON.parse(String(errorSpy.mock.calls[0][0])) as Record<string, unknown>
    expect(payload).toMatchObject({
      level: 'error',
      message: 'Operation failed',
      actionRequired: true,
      requestId: 'request-1',
      userId: '[REDACTED]',
      profileId: '[REDACTED]',
      baby_id: '[REDACTED]',
      email: '[REDACTED]',
      error_name: 'Error',
      error_message: 'provider failed',
    })
  })

  it('uses a fresh correlation id for each request and preserves it for nested work', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const firstRequest = createRequestLogger({ action: 'first' })
    const secondRequest = createRequestLogger({ action: 'second' })

    firstRequest.info('First request')
    firstRequest.child({ stage: 'nested' }).info('Nested work')
    secondRequest.info('Second request')

    const payloads = infoSpy.mock.calls.map(
      ([entry]) => JSON.parse(String(entry)) as Record<string, unknown>,
    )
    expect(payloads[0].requestId).toBe(payloads[1].requestId)
    expect(payloads[0].requestId).not.toBe(payloads[2].requestId)
  })
})
