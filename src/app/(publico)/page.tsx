import Link from 'next/link'

import { PledgeBadge } from '@/components/sitios/pledge-badge'
import { getTransparencyTotals } from '@/lib/transparency/queries'
import { countPublishedVenues, listPublishedVenues } from '@/lib/venues/queries'
import { formatCOP } from '@/lib/utils/format'

export const revalidate = 300

export default async function HomePage() {
  const [totals, venueCount, venues] = await Promise.all([
    getTransparencyTotals(),
    countPublishedVenues(),
    listPublishedVenues(),
  ])

  const featured = venues.slice(0, 3)

  return (
    <>
      {/* Asymmetric hero. The visual anchor is the real running total rather
          than a stock photo: on a site about a real disaster, a random
          nightlife image would be both generic and slightly dishonest. */}
      <section className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-24">
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-balance font-display font-semibold text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Tumbenla.
            <br />
            Y volvamosla a parar.
          </h1>

          <p className="max-w-md text-pretty text-lg text-muted-foreground">
            Bares y discotecas que ponen parte de sus ventas en material de construccion.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/sitios"
              className="rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver los sitios
            </Link>
            <Link
              href="/como-funciona#para-sitios"
              className="rounded-xl border border-border px-5 py-2.5 font-medium transition-colors hover:border-border/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Quiero poner
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-4xl border border-primary/25 bg-primary/5 p-8">
          <p className="text-muted-foreground text-sm">Van comprados en material</p>
          <p className="font-display font-semibold text-5xl text-primary tabular-nums tracking-tight">
            {formatCOP(totals.totalAmount, totals.currency)}
          </p>
          <div className="mt-2 flex flex-col gap-1 border-primary/15 border-t pt-4 text-muted-foreground text-sm">
            <p>
              {venueCount === 1 ? '1 sitio' : `${venueCount} sitios`} poniendo ahora mismo
            </p>
            <p>
              {totals.purchaseCount === 1
                ? '1 compra publicada'
                : `${totals.purchaseCount} compras publicadas`}
              , con recibo
            </p>
          </div>
        </div>
      </section>

      {/* Stepped flow rather than three equal cards. */}
      <section className="border-border border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
            Sales, tomas, y de paso se levanta una pared
          </h2>

          <ol className="mt-12 flex flex-col gap-px overflow-hidden rounded-3xl border border-border bg-border">
            {[
              {
                title: 'Escoges donde ir',
                body: 'En la lista estan los sitios que dijeron publicamente cuanto ponen. Filtra por ciudad o por barrio y sal.',
              },
              {
                title: 'El sitio pone su parte',
                body: 'Unos ponen un porcentaje de la noche, otros una plata fija por trago. Cada uno decide cuanto y lo dice de frente.',
              },
              {
                title: 'Compramos material y mostramos la factura',
                body: 'Cemento, bloques, tejas. Publicamos cuanto costo, quien lo vendio y a donde fue.',
              },
            ].map((step, index) => (
              <li
                key={step.title}
                className="grid gap-4 bg-background p-8 sm:grid-cols-[auto_1fr] sm:gap-8"
              >
                <span className="font-display font-semibold text-4xl text-primary/40 tabular-nums">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-xl">{step.title}</h3>
                  <p className="max-w-prose text-pretty text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="border-border border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
                Algunos de los que estan poniendo
              </h2>
              <Link href="/sitios" className="text-primary hover:underline">
                Ver todos
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((venue) => (
                <Link
                  key={venue.id}
                  href={`/sitios/${venue.slug}`}
                  className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 transition-colors hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-lg">{venue.name}</h3>
                    <p className="text-muted-foreground text-sm">
                      {venue.neighborhood ? `${venue.neighborhood}, ` : ''}
                      {venue.city}
                    </p>
                  </div>
                  <PledgeBadge pledge={venue.pledge} className="self-start" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-border border-t" id="para-sitios">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-start">
          <h2 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
            Si tienes un bar, esto tambien te sirve
          </h2>
          <div className="flex flex-col items-start gap-6">
            <p className="max-w-prose text-pretty text-lg text-muted-foreground">
              Ganas un poco menos por botella, pero vende mas el que tiene la gente adentro.
              Tus meseros vuelven a tener turnos y tu barrio sabe que estas poniendo.
            </p>
            <Link
              href="/como-funciona#para-sitios"
              className="rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Quiero poner
            </Link>
          </div>
        </div>
      </section>

      <section className="border-border border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 text-center sm:px-6">
          <h2 className="mx-auto max-w-3xl text-balance font-display font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
            Nos reimos primero. Ayudamos siempre.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            Si no hay factura, no paso. Todo lo que se compra queda publicado.
          </p>
          <Link
            href="/transparencia"
            className="mt-8 inline-block rounded-xl border border-border px-5 py-2.5 font-medium transition-colors hover:border-border/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver en que se fue la plata
          </Link>
        </div>
      </section>
    </>
  )
}
