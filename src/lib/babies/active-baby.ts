import 'server-only'
import { cookies, headers } from 'next/headers'

const ACTIVE_BABY_COOKIE = 'somni_active_baby'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isBabyId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function shouldUseSecureActiveBabyCookie(args: {
  nodeEnv: string | undefined
  requestHost: string | null
  requestProtocol: string | null
}) {
  if (args.nodeEnv !== 'production') return false

  const hostname = args.requestHost?.toLowerCase().split(':')[0]
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1'
  const isPlainHttp = args.requestProtocol?.toLowerCase() === 'http'

  return !(isLoopback && isPlainHttp)
}

export async function readActiveBabyId() {
  const value = (await cookies()).get(ACTIVE_BABY_COOKIE)?.value
  return isBabyId(value) ? value : null
}

export async function setActiveBabyId(babyId: string) {
  if (!isBabyId(babyId)) throw new Error('Invalid baby selection')
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const forwardedProtocol = requestHeaders
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim() ?? null
  const requestHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  cookieStore.set(ACTIVE_BABY_COOKIE, babyId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureActiveBabyCookie({
      nodeEnv: process.env.NODE_ENV,
      requestHost,
      requestProtocol: forwardedProtocol,
    }),
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  })
}

export async function clearActiveBabyId() {
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_BABY_COOKIE)
}

export function resolveActiveBaby<T extends { id: string }>(
  babies: T[],
  preferredBabyId: string | null,
) {
  return babies.find((baby) => baby.id === preferredBabyId) ?? babies[0] ?? null
}

export function resolveStrictActiveBaby<T extends { id: string }>(
  babies: T[],
  preferredBabyId: string | null,
) {
  if (preferredBabyId) {
    return babies.find((baby) => baby.id === preferredBabyId) ?? null
  }
  return babies[0] ?? null
}
