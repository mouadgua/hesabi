import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// ── Admin guard ────────────────────────────────────────────────────────────────
import { ADMIN_EMAIL } from '@/lib/admin-email'

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

// ── Content-Security-Policy ────────────────────────────────────────────────────
//
// Deux politiques, parce que les contraintes ne sont pas les mêmes selon le
// chemin :
//
//   /dashboard, /admin — les données comptables des cabinets. Politique stricte
//     à base de nonce, sans 'unsafe-inline' : un script injecté ne peut pas
//     s'exécuter sans deviner une valeur aléatoire régénérée à chaque requête.
//     Ces pages sont **déjà rendues à la demande** (22 routes, aucune statique),
//     donc le nonce ne coûte rien ici.
//
//   pages publiques — landing, /demo, /support. Aucune donnée utilisateur à
//     voler, et elles sont générées statiquement. Un nonce y est impossible :
//     il serait posé dans l'en-tête au moment de la requête alors que le HTML
//     mis en cache porterait celui d'une requête précédente, et tous les
//     scripts seraient bloqués. Elles gardent donc 'unsafe-inline' et
//     conservent leur mise en cache CDN.
//
// 'unsafe-eval' n'est ajouté qu'en développement : React s'en sert pour
// reconstruire les traces d'erreur serveur dans le navigateur.

const SUPABASE_ORIGIN = 'https://wjhuhaojygopjzqmdkqa.supabase.co'
// Origine d'ingestion Sentry, dérivée du DSN plutôt que recopiée : si le DSN
// change d'environnement, la CSP suit sans intervention. L'envoi passe
// normalement par le tunnel /monitoring (même origine), ceci couvre le cas où
// le tunnel échoue et où le SDK repart en direct.
const SENTRY_INGEST = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? '').origin }
  catch { return '' }
})()

function buildCsp({ nonce, isDev }) {
  const scriptSrc = nonce
    // 'strict-dynamic' laisse les scripts porteurs du nonce charger leurs
    // propres dépendances, ce dont le runtime Next.js a besoin.
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`
    : `'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Les styles restent en 'unsafe-inline' : Tailwind et les composants Radix
    // posent des styles inline calculés au runtime, qu'un nonce ne couvre pas.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${SUPABASE_ORIGIN} https://lh3.googleusercontent.com`,
    "font-src 'self'",
    `connect-src 'self' ${SUPABASE_ORIGIN} wss://wjhuhaojygopjzqmdkqa.supabase.co https://openrouter.ai https://generativelanguage.googleapis.com${SENTRY_INGEST ? ' ' + SENTRY_INGEST : ''}`,
    `frame-src 'self' ${SUPABASE_ORIGIN}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Bloque les plugins (Flash, Java…) : absent de la politique précédente.
    "object-src 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

/** Les chemins authentifiés, tous rendus à la demande, reçoivent le nonce. */
function needsNonce(pathname) {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
}

/** Pose la CSP sur une réponse — y compris les redirections, qu'on oublie facilement. */
function withCsp(response, csp) {
  response.headers.set('Content-Security-Policy', csp)
  return response
}

// ── Main proxy ─────────────────────────────────────────────────────────────────

export async function proxy(request) {
  const { pathname } = request.nextUrl

  const isDev = process.env.NODE_ENV !== 'production'
  const nonce = needsNonce(pathname)
    ? Buffer.from(crypto.randomUUID()).toString('base64')
    : null
  const csp = buildCsp({ nonce, isDev })

  // Next.js lit le nonce dans l'en-tête CSP de la *requête* pour l'appliquer
  // à ses propres balises ; l'en-tête de réponse est celui que le navigateur
  // applique. Les deux sont donc nécessaires.
  if (nonce) {
    request.headers.set('x-nonce', nonce)
    request.headers.set('Content-Security-Policy', csp)
  }

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
    const { data, error } = await supabase.auth.getUser()
    if (error?.code === 'refresh_token_not_found' || error?.code === 'bad_jwt') {
      // Stale session after project restore — supabase client already cleared cookies via setAll
      console.warn('[proxy] Stale session cleared:', error.code)
    }
    user = data.user
  } catch (err) {
    // Supabase unreachable (DNS / network error) — treat as unauthenticated
    console.error('[proxy] Supabase unreachable:', err.code ?? err.message)
  }

  // ── Admin route protection ────────────────────────────────────────────────────
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (isAdminRoute) {
    // Admin email check FIRST — if it's the real admin, let them through immediately
    if (user?.email === ADMIN_EMAIL) {
      return withCsp(supabaseResponse, csp)
    }

    // Not the admin — rate limit only non-admin IPs to avoid lockout of legitimate admin
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'
    )
    isAdminRateLimited(ip) // record the failed attempt

    // Silent redirect — no indication that /admin exists
    return withCsp(NextResponse.redirect(new URL('/', request.url)), csp)
  }

  // ── Standard auth protection ──────────────────────────────────────────────────
  const url = request.nextUrl.clone()

  if (!user && pathname.startsWith('/dashboard')) {
    url.pathname = '/login'
    return withCsp(NextResponse.redirect(url), csp)
  }

  if (user && pathname === '/login') {
    url.pathname = '/dashboard'
    return withCsp(NextResponse.redirect(url), csp)
  }

  return withCsp(supabaseResponse, csp)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
