import { randomUUID } from 'crypto'

// Keys that should be redacted from structured logs
const REDACTED_KEYS = new Set([
  'email',
  'password',
  'message',
  'token',
  'push_endpoint',
  'secret',
  'authorization',
  'cookie',
  'jwt',
  'userid',
  'user_id',
  'profileid',
  'profile_id',
  'babyid',
  'baby_id',
])

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(redact)
  }
  
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'string') {
      let redactedStr = value.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
      redactedStr = redactedStr.replace(/cus_[a-zA-Z0-9]+/g, '[REDACTED_CUS]')
      redactedStr = redactedStr.replace(/sub_[a-zA-Z0-9]+/g, '[REDACTED_SUB]')
      redactedStr = redactedStr.replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
      result[key] = redactedStr
    } else {
      result[key] = typeof value === 'object' ? redact(value) : value
    }
  }
  return result
}

export type LoggerContext = {
  requestId?: string
  userId?: string
  [key: string]: unknown
}

export class StructuredLogger {
  private baseContext: LoggerContext

  constructor(context: LoggerContext = {}) {
    this.baseContext = {
      requestId: context.requestId ?? randomUUID(),
      ...context,
    }
  }

  child(context: LoggerContext): StructuredLogger {
    return new StructuredLogger({ ...this.baseContext, ...context })
  }

  info(msg: string, meta: Record<string, unknown> = {}) {
    this.log('info', msg, meta)
  }

  warn(msg: string, meta: Record<string, unknown> = {}) {
    this.log('warn', msg, meta)
  }

  error(msg: string, meta: Record<string, unknown> = {}, err?: Error | unknown, actionRequired = false) {
    const errorObj = err instanceof Error ? err : undefined
    this.log('error', msg, {
      ...meta,
      actionRequired,
      error_name: errorObj?.name,
      error_message: errorObj?.message,
      error_stack: errorObj?.stack,
    })
  }

  private log(level: string, msg: string, meta: Record<string, unknown>) {
    const safeContext = redact(this.baseContext) as Record<string, unknown>
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      actionRequired: meta.actionRequired === true ? true : undefined,
      ...safeContext,
      ...(redact(meta) as Record<string, unknown>),
    }

    const jsonString = JSON.stringify(payload)
    if (level === 'error') {
      console.error(jsonString)
    } else if (level === 'warn') {
      console.warn(jsonString)
    } else {
      console.info(jsonString)
    }
  }

  /**
   * Times an async function and logs its duration.
   */
  async timeStage<T>(
    stageName: string,
    operation: () => Promise<T>,
    meta: Record<string, unknown> = {}
  ): Promise<T> {
    const start = performance.now()
    try {
      const result = await operation()
      const durationMs = performance.now() - start
      this.info(`Stage completed: ${stageName}`, { stage: stageName, durationMs, ...meta })
      return result
    } catch (err) {
      const durationMs = performance.now() - start
      this.error(`Stage failed: ${stageName}`, { stage: stageName, durationMs, ...meta }, err instanceof Error ? err : undefined)
      throw err
    }
  }
}

/**
 * Creates a fresh correlation scope for one incoming request or server action.
 * Use child() only for work nested inside that same scope.
 */
export function createRequestLogger(context: LoggerContext = {}) {
  return new StructuredLogger(context)
}

export const logger = new StructuredLogger()
