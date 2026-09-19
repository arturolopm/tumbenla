import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { isAdminEmail } from '@/lib/auth/admin'
import { SESSION_EXPIRES_IN_SECONDS, auth } from '@/lib/auth/auth'
import {
  SESSION_HINT_COOKIE,
  buildSessionHint,
  serializeSessionHint,
} from '@/lib/auth/session-hint'
import { sessionHintCookieOptions } from '@/lib/auth/session-hint-server'
import { listMyVenues } from '@/lib/auth/venue-access'

/**
 * What this person is, beyond being a regular person: platform operator, and
 * which venues they work at.
 *
 * WHY AN ENDPOINT AND NOT THE SESSION: the navbar is a client component and
 * `useSession()` gives it the email, but not whether that email is in
 * ADMIN_EMAILS — a server variable — nor which venues they belong to, which is
 * a table. Asking here avoids leaking either list to the browser.
 *
 * WHY IT IS NOT READ IN THE LAYOUT: the navbar lives in (publico)/layout.tsx,
 * which covers the landing page, /sitios and /transparencia. Reading the
 * session on the server there forces a render per request and takes down the
 * ISR of the whole public site.
 *
 * IT ALSO KEEPS THE SESSION HINT CURRENT (`session-hint.ts`). Every page with a
 * session asks this, and the answer already says what the navbar will show, so
 * refreshing the hint here costs nothing; it is how the hint catches up when
 * venue membership or a name changes without a new sign-in. The opposite case
 * — a hint with no session behind it — is expired by the auth hook that
 * `getSession` below runs through, so it needs nothing here.
 *
 * It reveals nothing the caller does not already know about themselves, and
 * with no session it answers the empty object instead of 401: for the navbar,
 * "you are nobody" and "you have not signed in" render the same.
 *
 * The URL stays Spanish on purpose — URLs are the one part of the code the
 * rule leaves in Spanish. The payload is code, and is English.
 */
export const dynamic = 'force-dynamic'

export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json(
      { admin: false, venues: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const venues = (await listMyVenues(session.user.id)).map((venue) => ({
    slug: venue.slug,
    name: venue.nombre,
  }))

  const response = NextResponse.json(
    { admin: isAdminEmail(session.user.email, session.user.emailVerified), venues },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  response.cookies.set(
    SESSION_HINT_COOKIE,
    serializeSessionHint(buildSessionHint(session.user, venues)),
    sessionHintCookieOptions(SESSION_EXPIRES_IN_SECONDS)
  )
  return response
}
