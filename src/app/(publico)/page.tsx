import { HandshakeIcon, HardHatIcon, MapIcon, MegaphoneIcon, PartyPopperIcon } from 'lucide-react'
import Link from 'next/link'

import { LeEntro } from '@/components/layout/le-entro'

import { getTransparencyTotals } from '@/lib/transparency/queries'
import { listPublishedPurchases } from '@/lib/transparency/queries'
import { formatCOP } from '@/lib/utils/format'
import { countPublishedVenues, listPublishedVenues } from '@/lib/venues/queries'

export const revalidate = 300

/**
 * Inicio, siguiendo la pantalla de Stitch: hero a sangre, "El Combo" en tres
 * tarjetas escalonadas, y el bloque de impacto con la visualizacion.
 *
 * NINGUNA CIFRA ES INVENTADA. La maqueta traia 85%, 124 aliados y 48 eventos;
 * eso son placeholders de diseno. Aca cada numero sale de la base de datos, y
 * los que no existen todavia no se renderizan.
 */

const PASOS = [
  {
    titulo: 'Sal de Fiesta',
    body: 'No dejamos de bailar. Salir de rumba es el primer paso para activar la economía de la noche y de la gente que vive de ella.',
    Icon: PartyPopperIcon,
    card: 'bg-primary text-primary-foreground',
    halo: 'bg-street-white/10',
    icono: 'bg-background text-lime',
    offset: '',
  },
  {
    titulo: 'Pide el trago',
    body: 'Escoge un producto de la carta. Antes de pedirlo ves el precio y el reparto en pesos: cuánto va a material y cuánto se queda en el sitio.',
    Icon: HandshakeIcon,
    card: 'bg-party text-party-foreground',
    halo: 'bg-background/10',
    icono: 'bg-background text-primary-text',
    offset: 'md:mt-12',
  },
  {
    titulo: 'Reconstruye',
    body: 'Con esa plata compramos cemento, bloques y tejas, y publicamos la factura de cada compra.',
    Icon: HardHatIcon,
    card: 'bg-popover text-foreground',
    halo: 'bg-lime/5',
    icono: 'bg-lime text-background',
    offset: 'md:mt-24',
  },
]

export default async function HomePage() {
  const [totals, venueCount, venues, purchases] = await Promise.all([
    getTransparencyTotals(),
    countPublishedVenues(),
    listPublishedVenues(),
    listPublishedPurchases(),
  ])

  const verified = venues.filter((venue) => venue.verified).length
  const verifiedPct = venues.length > 0 ? Math.round((verified / venues.length) * 100) : 0
  const ultima = purchases[0] ?? null

  return (
    <>
      {/* Hero. La maqueta usaba una foto de archivo de fiesta; aca el fondo es
          el mismo tratamiento (degradado + trama + grano) sin la foto. En un
          sitio sobre un sismo, una imagen de stock de rumba seria a la vez
          generica y un poco deshonesta, y no tenemos foto propia todavia. */}
      <section className="texture-grain relative flex min-h-[720px] w-full items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background/60 to-background" />
        <div className="halftone-overlay absolute inset-0 mix-blend-overlay" />
        <div className="pointer-events-none absolute top-0 right-0 h-[50vw] w-[50vw] rounded-full bg-primary/10 blur-[100px]" />

        <div className="relative z-10 flex w-full flex-col items-center px-margin-mobile text-center lg:px-margin-desktop">
          <p className="mb-8 animate-pulse rounded-full bg-lime px-4 py-2 font-display text-background text-label-lg uppercase shadow-lg shadow-lime/20">
            El ritmo nos levanta
          </p>

          <h1 className="max-w-6xl text-balance font-display font-black text-4xl text-street-white uppercase leading-none tracking-tighter drop-shadow-2xl sm:text-6xl lg:text-display">
            Tumbenla
            <br />
            <span className="text-lime">y volvamosla a parar</span>
          </h1>

          <p className="mt-8 max-w-2xl text-pretty rounded-xl bg-background/80 p-6 text-body-lg shadow-2xl backdrop-blur-md">
            Un trago de la carta, con su precio y su reparto en pesos: cuánto va a material y
            cuánto se queda en el sitio. Escoge dónde pedirlo y mira las facturas del material
            que compramos.
          </p>

          <div className="mt-12 flex flex-col gap-6 sm:flex-row">
            <Link
              href="/sitios"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 font-display text-label-lg text-primary-foreground uppercase shadow-xl transition-all hover:-translate-y-1 hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              <MapIcon className="size-5" />
              Ver el mapa del parche
            </Link>
            <Link
              href="#le-entro"
              className="flex items-center justify-center gap-2 rounded-xl bg-party px-8 py-4 font-display text-label-lg text-party-foreground uppercase shadow-xl transition-all hover:-translate-y-1 hover:shadow-party/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              <HandshakeIcon className="size-5" />
              Como me uno
            </Link>
          </div>
        </div>
      </section>

      {/* El Combo */}
      <section className="relative w-full overflow-hidden bg-background px-margin-mobile py-section-gap lg:px-margin-desktop">
        <div className="pointer-events-none absolute top-0 right-0 h-[50vw] w-[50vw] rounded-full bg-primary/5 blur-[100px]" />

        <div className="relative z-10 mb-16 max-w-2xl">
          <h2 className="font-display font-extrabold text-3xl text-party uppercase tracking-tight sm:text-headline-lg">
            El Combo
          </h2>
          <p className="mt-4 text-body-lg text-muted-foreground">
            Tres pasos para transformar el goce en impacto real. Así es como movemos la aguja
            mientras movemos el cuerpo.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {PASOS.map((paso, index) => (
            <article
              key={paso.titulo}
              className={`group relative overflow-hidden rounded-xl p-10 shadow-xl transition-transform duration-300 hover:-translate-y-2 ${paso.card} ${paso.offset}`}
            >
              <div
                className={`-right-8 -top-8 absolute size-40 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-150 ${paso.halo}`}
              />
              <span
                aria-hidden
                className="-bottom-4 -right-4 absolute font-display font-black text-[120px] leading-none opacity-20"
              >
                {index + 1}
              </span>

              <div
                className={`mb-8 flex size-16 items-center justify-center rounded-full shadow-lg ${paso.icono}`}
              >
                <paso.Icon className="size-8" />
              </div>
              <h3 className="mb-4 font-display font-bold text-headline-md uppercase">
                {paso.titulo}
              </h3>
              <p className="text-body-md opacity-90">{paso.body}</p>
            </article>
          ))}
        </div>
      </section>

      <LeEntro />

      {/* Energia Colectiva / El impacto se siente */}
      <section className="texture-grain relative w-full bg-surface-container-lowest px-margin-mobile py-section-gap lg:px-margin-desktop">
        <div className="relative z-10 grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div className="rounded-xl bg-background p-8 shadow-2xl">
            <h3 className="mb-8 font-display font-bold text-headline-md text-street-white uppercase">
              Energía Colectiva
            </h3>

            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-6">
                <svg
                  className="-rotate-90 size-24"
                  viewBox="0 0 36 36"
                  role="img"
                  aria-label={`${verifiedPct}% de los sitios verificados`}
                >
                  <title>{`${verifiedPct}% de los sitios verificados`}</title>
                  <path
                    className="text-secondary"
                    d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="text-primary"
                    d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${verifiedPct}, 100`}
                    strokeWidth="3"
                  />
                </svg>
                <div>
                  <p className="font-display font-black text-5xl text-primary-text leading-none tabular-nums">
                    {verifiedPct}%
                  </p>
                  <p className="mt-1 text-body-md text-muted-foreground">
                    De los sitios ya visitados y verificados
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Barra
                  label="Sitios poniendo"
                  value={venueCount}
                  max={Math.max(venueCount, 10)}
                  tone="lime"
                />
                <Barra
                  label="Compras publicadas"
                  value={totals.purchaseCount}
                  max={Math.max(totals.purchaseCount, 10)}
                  tone="party"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h2 className="font-display font-black text-4xl text-street-white uppercase leading-none tracking-tighter sm:text-[64px]">
              El impacto
              <br />
              <span className="text-party">se siente</span>
            </h2>
            <p className="text-body-lg text-muted-foreground">
              Cada botella y cada cover de esta red se vuelve un bulto de cemento con factura.
              Van {formatCOP(totals.totalAmount, totals.currency)} comprados en material.
            </p>

            {ultima ? (
              <Link
                href={`/transparencia/${ultima.slug}`}
                className="mt-8 flex items-center gap-4 rounded-xl bg-primary/10 p-6 transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                <MegaphoneIcon className="size-10 shrink-0 text-primary-text" />
                <p className="text-body-md">
                  Última compra publicada:{' '}
                  <strong className="text-primary-text">{ultima.title}</strong>, en{' '}
                  {ultima.municipality}.
                </p>
              </Link>
            ) : (
              <p className="mt-8 rounded-xl border border-border border-dashed p-6 text-body-md text-muted-foreground">
                Todavía no hay compras publicadas. Cuando haya la primera, la factura aparece
                acá.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function Barra({
  label,
  value,
  max,
  tone,
}: {
  label: string
  value: number
  max: number
  tone: 'lime' | 'party'
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div>
      <div className="mb-1 flex justify-between font-display text-label-sm uppercase">
        <span className={tone === 'lime' ? 'text-lime' : 'text-party'}>{label}</span>
        <span className="text-street-white tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary">
        <div
          className={`h-2 rounded-full ${tone === 'lime' ? 'bg-lime' : 'bg-party'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
