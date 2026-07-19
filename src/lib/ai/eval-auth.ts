import 'server-only'
import { timingSafeEqual } from 'node:crypto'

const MINIMUM_EVAL_SECRET_LENGTH = 32

export type EvalRequestAuthorization = {
  requested: boolean
  authorized: boolean
}

export function authorizeEvalRequest(request: Request): EvalRequestAuthorization {
  const requested = request.headers.get('x-eval-mode') === 'true'
  if (!requested) return { requested: false, authorized: false }

  const expected = process.env.SOMNI_EVAL_SECRET
  const provided = request.headers.get('x-somni-eval-secret')
  if (
    !expected ||
    expected.length < MINIMUM_EVAL_SECRET_LENGTH ||
    !provided
  ) {
    return { requested: true, authorized: false }
  }

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length) {
    return { requested: true, authorized: false }
  }

  return {
    requested: true,
    authorized: timingSafeEqual(expectedBuffer, providedBuffer),
  }
}
