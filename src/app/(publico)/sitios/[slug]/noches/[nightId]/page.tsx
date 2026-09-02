import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { GaleriaDeLaNoche } from '@/components/fiestas/galeria-de-la-noche'
import { auth } from '@/lib/auth/auth'
import { getPublishedNight, listAvailablePhotos, listClaimedPhotoIds } from '@/lib/fiestas/queries'
import { formatDate } from '@/lib/utils/format'

/**
 * La galeria de una noche: donde alguien se reconoce y guarda sus fotos.
 *
 * ES DINAMICA A PROPOSITO, y por eso no vive dentro de /sitios/[slug]. Lo que
 * se pinta aca depende de quien mira —cuales ya reclamo— y meterlo en la pagina
 * del sitio volveria dinamica una de las mas visitadas, que hoy es estatica con
 * ISR. Esta la abre solo quien salio esa noche: bajo volumen por diseno.
 *
 * PIDE SESION porque reclamar una foto es atarla a una cuenta. Sin sesion no
 * habria a quien atarla, y mostrar las caras a cualquiera que pase seria
 * exactamente lo que el modelo de privacidad evita.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Una noche',
  // Fotos de gente identificable. No van a un indice.
  robots: { index: false, follow: false },
}

export default async function NochePublicaPage({
  params,
}: {
  params: Promise<{ slug: string; nightId: string }>
}) {
  const { slug, nightId } = await params
  const destino = `/sitios/${slug}/noches/${nightId}`

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?redirectAfter=${encodeURIComponent(destino)}`)

  // Solo noches PUBLICADAS. Adivinar el id de una en borrador no la abre.
  const noche = await getPublishedNight(nightId)
  if (!noche || noche.venueSlug !== slug) notFound()

  const fotos = await listAvailablePhotos(noche.id)
  const reclamadas = await listClaimedPhotoIds(
    session.user.id,
    fotos.map((f) => f.id)
  )

  return (
    <div className='mx-auto w-full max-w-5xl px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <header>
        <Link
          href={`/sitios/${slug}`}
          className='text-muted-foreground text-sm hover:text-primary-text'
        >
          ← {noche.venueNombre}
        </Link>
        <h1 className='mt-2 text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          {noche.title || formatDate(noche.happenedAt)}
        </h1>
        <p className='mt-3 max-w-prose text-pretty text-body-lg text-muted-foreground'>
          {formatDate(noche.happenedAt)} en {noche.venueNombre}. Busca las tuyas y guárdalas: cada
          noche que guardes suma a tu historia.
        </p>
      </header>

      <GaleriaDeLaNoche
        nightId={noche.id}
        fotos={fotos.map((f) => ({
          id: f.id,
          url: f.url,
          caption: f.caption,
          reclamada: reclamadas.has(f.id),
        }))}
      />
    </div>
  )
}
