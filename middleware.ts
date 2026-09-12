import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/reset-password', '/dev-login']

// These endpoints authenticate server-to-server requests themselves (Stripe signature / CRON_SECRET).
// They must not require a Supabase browser session in middleware.
const SERVICE_AUTH_PATHS = new Set([
  '/api/stripe/webhook',
  '/api/distribution/run',
  '/api/fraud/run',
  '/api/curator/run',
  '/api/payout/batch',
  '/api/payout/process',
  '/api/tracks/review',
  '/api/artist/review',
  '/api/dev/seed-account',
])

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (SERVICE_AUTH_PATHS.has(path)) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p))

  if (!user && !isPublic && path !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
