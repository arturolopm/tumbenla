import { HandshakeIcon, HardHatIcon, MapIcon, MegaphoneIcon, PartyPopperIcon } from 'lucide-react'
import Link from 'next/link'

import { LeEntro } from '@/components/layout/le-entro'

import { getTransparencyTotals } from '@/lib/transparency/queries'
import { listPublishedPurchases } from '@/lib/transparency/queries'
import { formatCOP, formatNumber } from '@/lib/utils/format'
import { countPublishedVenues } from '@/lib/venues/queries'

export const revalidate = 300

/**
 * Public landing page for people going out in an active Tumbenla city.
 *
 * Every number comes from the database. Missing evidence is shown as an empty state instead of
 * being replaced with a placeholder.
 */

const PASOS = [
  {
    titulo: 'Encuentra un sitio',
    body: 'Abre el mapa y escoge uno de los sitios publicados cerca de ti.',
    Icon: MapIcon,
    card: 'bg-primary text-primary-foreground',
    halo: 'bg-street-white/10',
    icono: 'bg-background text-lime',
  },
  {
    titulo: 'Pide el trago',
    body: 'Escoge el producto de Tumbenla. Antes de pedirlo ves su precio y el reparto en pesos.',
    Icon: PartyPopperIcon,
    card: 'bg-party text-party-foreground',
    halo: 'bg-background/10',
    icono: 'bg-background text-primary-text',
  },
  {
    titulo: 'Guarda tu noche',
    body: 'El QR confirma la entrega. Si creas una cuenta, el pedido y las fotos que reclames quedan en tu historia.',
    Icon: HandshakeIcon,
    card: 'bg-card text-foreground',
    halo: 'bg-lime/5',
    icono: 'bg-lime text-background',
  },
  {
    titulo: 'Comprueba las facturas',
    body: 'Cuando compramos material, publicamos la compra y su recibo para que cualquiera pueda revisarlos.',
    Icon: HardHatIcon,
    card: 'bg-popover text-foreground',
    halo: 'bg-lime/5',
    icono: 'bg-lime text-background',
  },
]

export default async function HomePage() {
  const [totals, venueCount, purchases] = await Promise.all([
    getTransparencyTotals(),
    countPublishedVenues(),
    listPublishedPurchases(),
  ])

  const ultima = purchases[0] ?? null

  return (
    <>
      {/* The background keeps the visual energy without using an unowned stock party photo. */}
      <section className='texture-grain relative flex min-h-[720px] w-full items-center justify-center overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-b from-primary/20 via-background/60 to-background' />
        <div className='halftone-overlay absolute inset-0 mix-blend-overlay' />
        <div className='pointer-events-none absolute top-0 right-0 h-[50vw] w-[50vw] rounded-full bg-primary/10 blur-[100px]' />

        <div className='relative z-10 flex w-full flex-col items-center px-margin-mobile text-center lg:px-margin-desktop'>
          <p className='mb-8 animate-pulse rounded-full bg-lime px-4 py-2 font-display text-background text-label-lg uppercase shadow-lg shadow-lime/20'>
            El ritmo nos levanta
          </p>

          <h1 className='max-w-6xl text-balance font-display font-black text-4xl text-street-white uppercase leading-none tracking-tighter drop-shadow-2xl sm:text-6xl lg:text-display'>
            Tumbenla
            <br />
            <span className='text-lime'>y volvamosla a parar</span>
          </h1>

          <p className='mt-8 max-w-2xl text-pretty rounded-xl bg-background/80 p-6 text-body-lg shadow-2xl backdrop-blur-md'>
            Salir sigue siendo salir. En los sitios de Tumbenla, una parte del trago se vuelve
            material para volver a levantar, y la factura queda a la vista.
          </p>

          <div className='mt-12 flex flex-col gap-6 sm:flex-row'>
            <Link
              href='/sitios'
              className='flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 font-display text-label-lg text-primary-foreground uppercase shadow-xl transition-all hover:-translate-y-1 hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'
            >
              <MapIcon className='size-5' />
              Ver dónde salir
            </Link>
            <Link
              href='#como-me-uno'
              className='flex items-center justify-center gap-2 rounded-xl bg-party px-8 py-4 font-display text-label-lg text-party-foreground uppercase shadow-xl transition-all hover:-translate-y-1 hover:shadow-party/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'
            >
              <HandshakeIcon className='size-5' />
              Cómo me uno
            </Link>
          </div>
        </div>
      </section>

      <section
        id='como-me-uno'
        className='relative w-full scroll-mt-24 overflow-hidden bg-background px-margin-mobile py-section-gap lg:px-margin-desktop'
      >
        <div className='pointer-events-none absolute top-0 right-0 h-[50vw] w-[50vw] rounded-full bg-primary/5 blur-[100px]' />

        <div className='relative z-10 mb-16 max-w-2xl'>
          <h2 className='font-display font-extrabold text-3xl text-party uppercase tracking-tight sm:text-headline-lg'>
            Tu noche, paso a paso
          </h2>
          <p className='mt-4 text-body-lg text-muted-foreground'>
            Tú escoges dónde salir y qué pedir. La entrega queda registrada y las compras de
            material quedan abiertas para todos.
          </p>
        </div>

        <div className='relative z-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
          {PASOS.map((paso, index) => (
            <article
              key={paso.titulo}
              className={`group relative overflow-hidden rounded-xl p-8 shadow-xl transition-transform duration-300 hover:-translate-y-2 ${paso.card}`}
            >
              <div
                className={`-right-8 -top-8 absolute size-40 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-150 ${paso.halo}`}
              />
              <span
                aria-hidden
                className='-bottom-4 -right-4 absolute font-display font-black text-[120px] leading-none opacity-20'
              >
                {index + 1}
              </span>

              <div
                className={`mb-8 flex size-16 items-center justify-center rounded-full shadow-lg ${paso.icono}`}
              >
                <paso.Icon className='size-8' />
              </div>
              <h3 className='mb-4 font-display font-bold text-headline-md uppercase'>
                {paso.titulo}
              </h3>
              <p className='text-body-md opacity-90'>{paso.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className='texture-grain relative w-full bg-surface-container-lowest px-margin-mobile py-section-gap lg:px-margin-desktop'>
        <div className='relative z-10 grid grid-cols-1 items-center gap-16 lg:grid-cols-2'>
          <div className='rounded-xl bg-background p-8 shadow-2xl'>
            <h3 className='mb-8 font-display font-bold text-headline-md text-street-white uppercase'>
              Lo que ya se puede comprobar
            </h3>

            <div className='grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3'>
              <Dato label='Sitios publicados' value={formatNumber(venueCount)} />
              <Dato label='Compras publicadas' value={formatNumber(totals.purchaseCount)} />
              <Dato label='Ya en material' value={formatCOP(totals.totalAmount, totals.currency)} />
            </div>
            <p className='mt-6 text-body-md text-muted-foreground'>
              Son cifras reales de sitios y compras publicadas. Si todavía no hay una compra, el
              estado vacío también queda a la vista.
            </p>
          </div>

          <div className='flex flex-col gap-6'>
            <h2 className='font-display font-black text-4xl text-street-white uppercase leading-none tracking-tighter sm:text-[64px]'>
              El impacto
              <br />
              <span className='text-party'>se siente</span>
            </h2>
            <p className='text-body-lg text-muted-foreground'>
              Cada compra muestra qué material se compró, cuánto costó y cuál es su factura. Sin
              respaldo publicado, no contamos la compra como hecha.
            </p>

            {ultima ? (
              <Link
                href={`/transparencia/${ultima.slug}`}
                className='mt-8 flex items-center gap-4 rounded-xl bg-primary/10 p-6 transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'
              >
                <MegaphoneIcon className='size-10 shrink-0 text-primary-text' />
                <p className='text-body-md'>
                  Última compra publicada:{' '}
                  <strong className='text-primary-text'>{ultima.title}</strong>, en{' '}
                  {ultima.municipality}.
                </p>
              </Link>
            ) : (
              <p className='mt-8 rounded-xl border border-border border-dashed p-6 text-body-md text-muted-foreground'>
                Todavía no hay compras publicadas. Cuando haya la primera, la factura aparece acá.
              </p>
            )}
          </div>
        </div>
      </section>

      <LeEntro />
    </>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-xl border border-border bg-card p-4'>
      <p className='font-display text-label-sm text-muted-foreground uppercase tracking-widest'>
        {label}
      </p>
      <p className='mt-2 font-display font-black text-2xl text-primary-text tabular-nums'>
        {value}
      </p>
    </div>
  )
}
