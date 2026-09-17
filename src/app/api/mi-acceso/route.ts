import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { isAdminEmail } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'
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

  const venues = await listMyVenues(session.user.id)

  return NextResponse.json(
    {
      admin: isAdminEmail(session.user.email, session.user.emailVerified),
      venues: venues.map((venue) => ({ slug: venue.slug, name: venue.nombre })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
