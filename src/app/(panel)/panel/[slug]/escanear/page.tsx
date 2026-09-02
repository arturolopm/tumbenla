import { notFound } from 'next/navigation'

import { Escaner } from '@/components/panel/escaner'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'

export const dynamic = 'force-dynamic'

/**
 * La pantalla que mas se usa, y la unica que se abre de pie, de noche y con
 * gente esperando.
 *
 * Sin restriccion de rol: el mesero entrega, no solo el dueno. `requireVenueAccess`
 * sin `roles` deja pasar a cualquier miembro del sitio.
 */
export default async function EscanearPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ c?: string }>
}) {
  const { slug } = await params
  const { c } = await searchParams

  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  await requireVenueAccess(sitio.id, `/panel/${slug}/escanear`)

  return <Escaner venueId={sitio.id} nombreDelSitio={sitio.nombre} codigoDeLaUrl={c ?? null} />
}
