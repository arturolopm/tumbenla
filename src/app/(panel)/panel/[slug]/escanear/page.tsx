import { notFound } from 'next/navigation'

import { OrderScanner } from '@/components/panel/order-scanner'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { listRecentVenueOrders } from '@/lib/commerce/redemption-history'

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
  const recentOrders = await listRecentVenueOrders(sitio.id)

  return (
    <OrderScanner
      venueId={sitio.id}
      venueName={sitio.nombre}
      codeFromUrl={c ?? null}
      recentOrders={recentOrders}
    />
  )
}
