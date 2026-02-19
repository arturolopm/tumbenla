import { type NextRequest, NextResponse } from 'next/server'

export default function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
