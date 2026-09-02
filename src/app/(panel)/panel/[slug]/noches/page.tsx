import { notFound } from 'next/navigation'

import { NochesPanel } from '@/components/panel/noches-panel'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { listNightsForPanel } from '@/lib/fiestas/queries'

export const dynamic = 'force-dynamic'

export default async function NochesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  await requireVenueAccess(sitio.id, `/panel/${slug}/noches`)
  const noches = await listNightsForPanel(sitio.id)

  return (
    <div className='flex max-w-4xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          Las noches
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Crea la noche, sube las fotos y publícala. Publicada, la gente que salió esa noche puede
          entrar a buscarse y guardar las suyas.
        </p>
      </header>

      <NochesPanel
        venueId={sitio.id}
        slug={slug}
        noches={noches.map((n) => ({ ...n, happenedAt: n.happenedAt.toISOString() }))}
      />
    </div>
  )
}
