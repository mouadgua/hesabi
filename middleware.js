import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  // Refresh session — required for Server Components to read updated session
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Protect /dashboard — redirect to login if no session
  if (pathname.startsWith('/dashboard') && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Protect /api/admin — return 401 JSON if no session (API routes don't redirect)
  if (pathname.startsWith('/api/admin') && !session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
}
