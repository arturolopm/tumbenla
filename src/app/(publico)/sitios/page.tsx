import type { Metadata } from 'next'
import { Suspense } from 'react'

import { CityGate } from '@/components/sitios/city-gate'

import { SitiosExplorerWithMap } from '@/components/sitios/sitios-explorer-with-map'
import { generateMetadata as buildMetadata } from '@/lib/seo'
import { listPublishedVenues, listVenueCities } from '@/lib/venues/queries'

export const metadata: Metadata = buildMetadata({
  title: 'Mapa del parche',
  description:
    'Bares y discotecas que ponen una parte de sus ventas en material de construcción. Busca por ciudad o por barrio.',
  canonical: '/sitios',
})

// ISR rather than a dynamic page. The list only changes when an operator
// publishes something, and the admin mutations call revalidatePath('/sitios').
export const revalidate = 300

export default async function SitiosPage() {
  const [venues, cities] = await Promise.all([listPublishedVenues(), listVenueCities()])

  const content = (
    <div className='flex flex-col'>
      <section className='relative mx-auto flex w-full max-w-4xl flex-col items-center px-margin-mobile pt-12 pb-10 text-center lg:px-margin-desktop'>
        <div className='pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-primary/10 via-transparent to-transparent opacity-50 blur-3xl' />

        <p className='-rotate-2 mb-4 inline-block font-display text-label-lg text-lime uppercase tracking-widest'>
          Descubre la red
        </p>

        <h1 className='relative z-10 mb-6 text-balance font-display font-black text-4xl text-street-white uppercase leading-none tracking-tighter sm:text-6xl lg:text-display'>
          Mapa de los
          <br />
          <span className='halftone-overlay relative -ml-4 inline-block px-4 text-primary-text'>
            Buenos Ratos
          </span>
        </h1>

        <p className='relative z-10 max-w-2xl text-pretty rounded-xl border border-secondary bg-background/50 p-4 text-body-lg text-muted-foreground backdrop-blur-sm'>
          Una red de bares y discotecas donde la rumba levanta paredes.{' '}
          <strong className='font-bold text-party'>Donde cada trago es un ladrillo,</strong> y cada
          noche compra material.
        </p>
      </section>

      {venues.length === 0 ? (
        <div className='mx-auto w-full max-w-7xl px-margin-mobile pb-20 lg:px-margin-desktop'>
          <div className='rounded-xl border border-border border-dashed p-8'>
            <p className='font-display font-bold text-headline-md uppercase'>
              Todavía no hay sitios publicados.
            </p>
            <p className='mt-1 text-body-md text-muted-foreground'>
              Estamos hablando con varios. Vuelve en unos dias.
            </p>
          </div>
        </div>
      ) : (
        <SitiosExplorerWithMap venues={venues} cities={cities} />
      )}
    </div>
  )

  return (
    <Suspense fallback={content}>
      <CityGate>{content}</CityGate>
    </Suspense>
  )
}
