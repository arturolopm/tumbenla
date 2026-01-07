import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

import { APP_COOKIE_NAME } from '@/lib/constants'

// Auth routes that authenticated users should be redirected away from
const authRoutes = ['/login', '/register', '/reset-password', '/verify']

// Public routes that do not require authentication
const publicRoutes = ['/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fast cookie-based check (Edge Runtime - no database calls)
  // This is for optimistic redirects only. Actual security validation
  // happens in the page/layout with full database checks.
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: APP_COOKIE_NAME, // Must match the cookiePrefix in auth.ts
  })

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.some((route) => pathname === route)

  if (sessionCookie && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!sessionCookie && !isPublicRoute && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Edge Runtime (default) - fastest performance, no database calls
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
