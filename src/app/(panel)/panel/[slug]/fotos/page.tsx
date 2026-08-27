import { notFound } from 'next/navigation'

import { ColaDeFotos } from '@/components/panel/cola-de-fotos'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { listOpenReportsForVenue, listPendingPhotosForVenue } from '@/lib/fiestas/queries'

/**
 * Lo que el sitio tiene sin resolver: fotos que subio la gente y todavia no
 * habilita nadie, y reportes de privacidad abiertos.
 *
 * Los reportes van ARRIBA. Una foto sin revisar puede esperar; alguien pidiendo
 * que baje una foto suya, no.
 */
export const dynamic = 'force-dynamic'

export default async function FotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  await requireVenueAccess(sitio.id, `/panel/${slug}/fotos`)

  const [pendientes, reportes] = await Promise.all([
    listPendingPhotosForVenue(sitio.id),
    listOpenReportsForVenue(sitio.id),
  ])

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header>
        <h1 className="font-display font-black text-3xl uppercase leading-none tracking-tighter">
          Por revisar
        </h1>
        <p className="mt-2 max-w-prose text-body-md text-muted-foreground">
          Nada de esto se ve todavía. Una foto solo sale cuando tú la habilitas, y solo puede
          guardarla quien salga en ella.
        </p>
      </header>

      <ColaDeFotos
        slug={slug}
        pendientes={pendientes.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          happenedAt: p.happenedAt.toISOString(),
        }))}
        reportes={reportes.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  )
}
