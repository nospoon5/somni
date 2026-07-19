import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { authorizeEvalRequest } from './eval-auth'

const ORIGINAL_SECRET = process.env.SOMNI_EVAL_SECRET

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.SOMNI_EVAL_SECRET
  } else {
    process.env.SOMNI_EVAL_SECRET = ORIGINAL_SECRET
  }
})

function request(headers: HeadersInit = {}) {
  return new Request('https://somni.test/api/chat', { headers })
}

describe('evaluation request authorization', () => {
  it('does not enable evaluation behavior from the mode header alone', () => {
    process.env.SOMNI_EVAL_SECRET = 'a'.repeat(64)
    expect(authorizeEvalRequest(request({ 'x-eval-mode': 'true' }))).toEqual({
      requested: true,
      authorized: false,
    })
  })

  it('requires a sufficiently strong server-side secret', () => {
    process.env.SOMNI_EVAL_SECRET = 'short'
    expect(
      authorizeEvalRequest(
        request({
          'x-eval-mode': 'true',
          'x-somni-eval-secret': 'short',
        }),
      ),
    ).toEqual({ requested: true, authorized: false })
  })

  it('uses the shared secret only when evaluation mode was requested', () => {
    const secret = 'stage-seven-evaluation-secret-value'
    process.env.SOMNI_EVAL_SECRET = secret
    expect(
      authorizeEvalRequest(
        request({
          'x-eval-mode': 'true',
          'x-somni-eval-secret': secret,
        }),
      ),
    ).toEqual({ requested: true, authorized: true })
    expect(
      authorizeEvalRequest(request({ 'x-somni-eval-secret': secret })),
    ).toEqual({ requested: false, authorized: false })
  })
})
