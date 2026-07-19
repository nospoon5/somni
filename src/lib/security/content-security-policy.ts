const NONCE_PATTERN = /^[A-Za-z0-9+/_=-]+$/

type RuntimeEnvironment = 'development' | 'production' | 'test'

/**
 * Build the browser policy for one rendered document.
 *
 * Next.js adds the matching nonce to its framework scripts and generated style
 * elements. Somni still has a small number of React `style` attributes, so the
 * production exception is deliberately limited to `style-src-attr` rather than
 * weakening scripts or all inline styles.
 */
export function buildContentSecurityPolicy(
  nonce: string,
  environment: RuntimeEnvironment,
  options: { upgradeInsecureRequests?: boolean } = {},
): string {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error('CSP nonce contains unsupported characters')
  }

  const isDevelopment = environment === 'development'
  const upgradeInsecureRequests =
    !isDevelopment && options.upgradeInsecureRequests !== false
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    "style-src 'self'",
    `style-src-elem 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(upgradeInsecureRequests ? ['upgrade-insecure-requests'] : []),
  ]

  return `${directives.join('; ')};`
}
