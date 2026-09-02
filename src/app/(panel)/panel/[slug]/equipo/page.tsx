import { notFound } from 'next/navigation'

import { EquipoManager } from '@/components/panel/equipo-manager'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { listPendingInvitations, listTeam } from '@/lib/venues/team'

/**
 * Solo el dueno. Se pasa ['owner'] a requireVenueAccess, que le da 404 al
 * personal: la pagina de equipo no le anuncia a un mesero que existe un lugar
 * donde se reparte el acceso.
 */
export const dynamic = 'force-dynamic'

export default async function EquipoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  const acceso = await requireVenueAccess(sitio.id, `/panel/${slug}/equipo`, ['owner'])

  const [equipo, invitaciones] = await Promise.all([
    listTeam(sitio.id),
    listPendingInvitations(sitio.id),
  ])

  return (
    <div className='flex max-w-3xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          Equipo
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Invita a tu gente por correo para que no tengas que subir tú todas las fotos. El equipo
          sube noches y aprueba fotos; solo tú manejas quién entra.
        </p>
      </header>

      <EquipoManager
        venueId={sitio.id}
        miUserId={acceso.userId}
        equipo={equipo.map((m) => ({ ...m, desde: m.desde.toISOString() }))}
        invitaciones={invitaciones.map((i) => ({
          ...i,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  )
}
