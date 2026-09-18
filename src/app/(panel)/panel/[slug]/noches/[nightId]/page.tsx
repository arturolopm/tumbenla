import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FotosDeLaNoche } from '@/components/panel/fotos-de-la-noche'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { listPhotosForPanel } from '@/lib/fiestas/queries'
import { db } from '@/database'
import { partyNight } from '@/database/schema'
import { and, eq } from 'drizzle-orm'
import { formatDate } from '@/lib/utils/format'

export const dynamic = 'force-dynamic'

export default async function NochePanelPage({
  params,
}: {
  params: Promise<{ slug: string; nightId: string }>
}) {
  const { slug, nightId } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  await requireVenueAccess(sitio.id, `/panel/${slug}/noches/${nightId}`, ['owner', 'staff'])

  // La noche tiene que ser DE ESTE SITIO. Sin el eq(venueId), poner el id de la
  // noche de otro bar en la URL abriria sus fotos desde un panel propio.
  const [noche] = await db
    .select({
      id: partyNight.id,
      happenedAt: partyNight.happenedAt,
      title: partyNight.title,
      status: partyNight.status,
    })
    .from(partyNight)
    .where(and(eq(partyNight.id, nightId), eq(partyNight.venueId, sitio.id)))
    .limit(1)

  if (!noche) notFound()

  const fotos = await listPhotosForPanel(noche.id)

  return (
    <div className='flex max-w-4xl flex-col gap-8'>
      <header>
        <Link
          href={`/panel/${slug}/noches`}
          className='text-muted-foreground text-sm hover:text-primary-text'
        >
          ← Todas las noches
        </Link>
        <h1 className='mt-2 font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          {noche.title || formatDate(noche.happenedAt)}
        </h1>
        <p className='mt-2 text-body-md text-muted-foreground'>
          {formatDate(noche.happenedAt)} ·{' '}
          {noche.status === 'published' ? 'Publicada' : 'En borrador'}
        </p>
      </header>

      <FotosDeLaNoche
        nightId={noche.id}
        fotos={fotos.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
      />
    </div>
  )
}
