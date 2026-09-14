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

function withSecurityHeaders(response: NextResponse) {
  // 全画面・APIに共通する、防御的かつ外部決済や音声再生を妨げないヘッダー。
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  return response
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (SERVICE_AUTH_PATHS.has(path)) {
    return withSecurityHeaders(NextResponse.next())
  }

  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p)) || path === '/'
  // 公開ページではセッション更新が不要。ここでSupabaseへ接続しないことで、閲覧だけの
  // ページを認証基盤の一時障害から切り離し、静的プレビューも安定させる。
  if (isPublic) {
    return withSecurityHeaders(NextResponse.next())
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
  if (!user) {
    return withSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)))
  }

  return withSecurityHeaders(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
