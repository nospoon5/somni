import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { buildContentSecurityPolicy } from '@/lib/security/content-security-policy'

function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce()
  const forwardedProtocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  const isHttpsRequest = forwardedProtocol
    ? forwardedProtocol === 'https'
    : request.nextUrl.protocol === 'https:'
  const contentSecurityPolicy = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV,
    { upgradeInsecureRequests: isHttpsRequest },
  )
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  const createResponse = () => {
    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    nextResponse.headers.set('Content-Security-Policy', contentSecurityPolicy)
    return nextResponse
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // CSP remains enforced even if authentication cannot refresh its session.
    return createResponse()
  }

  let response = createResponse()

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          response = createResponse()
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    await supabase.auth.getUser()
  } catch {
    // If Supabase refresh fails here, let the request continue instead of 500ing.
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
