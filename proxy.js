import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// ── Admin guard ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'mouadguarraz@gmail.com'

// Rate limit: 5 failed admin attempts per IP per hour.
// Uses global Map — survives hot reloads, works for single-process deployments.
if (!global.__adminRl) global.__adminRl = new Map()
const rl = global.__adminRl

function isAdminRateLimited(ip) {
  const now  = Date.now()
  const hour = 60 * 60 * 1000
  const e    = rl.get(ip)
  if (!e || now > e.resetAt) { rl.set(ip, { count: 1, resetAt: now + hour }); return false }
  if (e.count >= 5) return true
  e.count++
  return false
}

// ── Main proxy ─────────────────────────────────────────────────────────────────

export async function proxy(request) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })
  let user = null

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
            Object.entries(headers ?? {}).forEach(([k, v]) =>
              supabaseResponse.headers.set(k, v)
            )
          },
        },
      }
    )
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Supabase unreachable (DNS/network) — treat as unauthenticated
    console.error('[proxy] Supabase auth check failed:', err.code ?? err.message)
  }

  // ── Admin route protection ────────────────────────────────────────────────────
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (isAdminRoute) {
    // Admin email check FIRST — if it's the real admin, let them through immediately
    if (user?.email === ADMIN_EMAIL) {
      return supabaseResponse
    }

    // Not the admin — rate limit only non-admin IPs to avoid lockout of legitimate admin
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'
    )
    isAdminRateLimited(ip) // record the failed attempt

    // Silent redirect — no indication that /admin exists
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── Standard auth protection ──────────────────────────────────────────────────
  const url = request.nextUrl.clone()

  if (!user && pathname.startsWith('/dashboard')) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
