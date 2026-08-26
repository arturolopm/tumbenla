import { notFound } from 'next/navigation'

import { AportesPanel } from '@/components/panel/aportes-panel'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { listContributionsForPanel } from '@/lib/venues/contributions'

export const dynamic = 'force-dynamic'

export default async function AportesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  await requireVenueAccess(sitio.id, `/panel/${slug}/aportes`)
  const aportes = await listContributionsForPanel(sitio.id)

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header>
        <h1 className="font-display font-black text-3xl uppercase leading-none tracking-tighter">
          Lo que has entregado
        </h1>
        <p className="mt-2 max-w-prose text-body-md text-muted-foreground">
          Reporta cuánto entregaste y de qué periodo, y adjunta el recibo. Nosotros lo
          confirmamos antes de que salga publicado, y después lo amarramos a la compra que
          financió.
        </p>
      </header>

      <AportesPanel
        venueId={sitio.id}
        aportes={aportes.map((a) => ({
          ...a,
          periodStart: a.periodStart.toISOString(),
          periodEnd: a.periodEnd.toISOString(),
          verifiedAt: a.verifiedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}
