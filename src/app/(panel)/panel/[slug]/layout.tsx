import { notFound } from 'next/navigation'

import { PanelShell } from '@/components/panel/panel-shell'
import { getVenueForPanel, listMyVenues, requireVenueAccess } from '@/lib/auth/venue-access'

/**
 * The gate lives here, because this is where the slug is known.
 *
 * requireVenueAccess never returns without permission: it sends you to the
 * login with no session, and 404s whoever has a session but does not belong to
 * this venue. 404 and not 403, for the same reason as /admin: someone else's
 * panel does not confirm to anyone that it exists.
 *
 * AND AS ALWAYS: this does not protect the server actions. Every one of
 * src/app/actions/equipo.ts calls assertVenueAccess on its own.
 */
export const dynamic = 'force-dynamic'

export default async function PanelVenueLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const venue = await getVenueForPanel(slug)
  if (!venue) notFound()

  const access = await requireVenueAccess(venue.id, `/panel/${slug}`)

  // A platform operator has no memberships: their own venue list comes back
  // empty and the picker does not appear, which is correct. They come in
  // through /admin.
  const venues = access.esPlataforma ? [] : await listMyVenues(access.userId)

  return (
    <PanelShell
      venue={{ slug: venue.slug, name: venue.nombre, role: access.role ?? 'owner' }}
      venues={venues.map((one) => ({ slug: one.slug, name: one.nombre, role: one.role }))}
      email={access.email}
      isOwner={access.esPlataforma || access.role === 'owner'}
      isStaff={access.role === 'staff'}
      isPlatform={access.esPlataforma}
    >
      {children}
    </PanelShell>
  )
}
