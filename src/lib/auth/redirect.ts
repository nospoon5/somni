const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/i

export function sanitizeInviteRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null

  let url: URL
  try {
    url = new URL(value, 'https://somni.local')
  } catch {
    return null
  }

  if (url.origin !== 'https://somni.local' || url.pathname !== '/invite/accept') {
    return null
  }

  const shareId = url.searchParams.get('id')
  const token = url.searchParams.get('token')
  if (!shareId || !UUID_PATTERN.test(shareId) || !token || !INVITE_TOKEN_PATTERN.test(token)) {
    return null
  }

  return `/invite/accept?id=${encodeURIComponent(shareId)}&token=${encodeURIComponent(token)}`
}
