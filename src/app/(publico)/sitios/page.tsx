import type { Metadata } from 'next'

import { SitiosExplorer } from '@/components/sitios/sitios-explorer'
import { listPublishedVenues, listVenueCities } from '@/lib/venues/queries'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Sitios que estan poniendo',
  description:
    'Bares y discotecas que ponen una parte de sus ventas en material de construccion. Busca por ciudad o por barrio.',
  canonical: '/sitios',
})

// ISR rather than a dynamic page. The list only changes when an operator
// publishes something, and the admin mutations call revalidatePath('/sitios').
export const revalidate = 300

export default async function SitiosPage() {
  const [venues, cities] = await Promise.all([listPublishedVenues(), listVenueCities()])

  return (
    <div className="flex flex-col">
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-6 sm:px-6">
        <h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
          Donde estan poniendo
        </h1>
        <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
          Cada sitio de esta lista dijo publicamente cuanto pone. Escoge uno y sal.
        </p>
      </div>

      {venues.length === 0 ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
          <div className="rounded-3xl border border-border border-dashed p-8">
            <p className="font-medium">Todavia no hay sitios publicados.</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Estamos hablando con varios. Vuelve en unos dias.
            </p>
          </div>
        </div>
      ) : (
        <SitiosExplorer venues={venues} cities={cities} />
      )}
    </div>
  )
}
