import { notFound } from 'next/navigation'

import { PanelShell } from '@/components/panel/panel-shell'
import { getVenueForPanel, listMyVenues, requireVenueAccess } from '@/lib/auth/venue-access'

/**
 * Aca si esta el gate, porque aca si se conoce el slug.
 *
 * requireVenueAccess no vuelve sin permiso: manda al login sin sesion, y da 404
 * a quien tiene sesion y no pertenece a este sitio. 404 y no 403, por lo mismo
 * que /admin: el panel de un sitio ajeno no le confirma a nadie que existe.
 *
 * Y COMO SIEMPRE: esto no protege las server actions. Cada una de
 * src/app/actions/equipo.ts llama assertVenueAccess por su cuenta.
 */
export const dynamic = 'force-dynamic'

export default async function PanelSitioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  const acceso = await requireVenueAccess(sitio.id, `/panel/${slug}`)

  // Un operador de la plataforma no tiene membresias: su lista de sitios propios
  // va vacia y el selector no aparece, que es lo correcto. Entra por /admin.
  const sitios = acceso.esPlataforma ? [] : await listMyVenues(acceso.userId)

  return (
    <PanelShell
      sitio={{ slug: sitio.slug, nombre: sitio.nombre, role: acceso.role ?? 'owner' }}
      sitios={sitios.map((s) => ({ slug: s.slug, nombre: s.nombre, role: s.role }))}
      email={acceso.email}
      esDueno={acceso.esPlataforma || acceso.role === 'owner'}
      esPlataforma={acceso.esPlataforma}
    >
      {children}
    </PanelShell>
  )
}
