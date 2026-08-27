import type { Metadata } from 'next'
import Link from 'next/link'

import { generateMetadata as buildMetadata } from '@/lib/seo'
import { getTransparencyTotals, listPublishedPurchases } from '@/lib/transparency/queries'
import { formatCOP, formatDate, formatNumber } from '@/lib/utils/format'

export const metadata: Metadata = buildMetadata({
  title: 'A dónde va la plata',
  description:
    'Cada compra de material que hicimos, con su recibo, sus cantidades y su fecha.',
  canonical: '/transparencia',
})

export const revalidate = 300

/**
 * "A donde va la plata", con el tratamiento de Stitch: el total grande y el
 * reparto en barras porcentuales.
 *
 * Las categorias del reparto en la maqueta eran fijas (Pintura, Sonido, Olla
 * Comun, Admin) con porcentajes inventados. Aca el reparto se CALCULA sobre las
 * compras publicadas, agrupadas por municipio. Si no hay compras, no hay
 * barras: no se dibuja un grafico de cero.
 */
export default async function TransparenciaPage() {
  const [totals, purchases] = await Promise.all([
    getTransparencyTotals(),
    listPublishedPurchases(),
  ])

  // Reparto real por municipio, de mayor a menor.
  const porMunicipio = Object.entries(
    purchases.reduce<Record<string, number>>((acc, purchase) => {
      acc[purchase.municipality] = (acc[purchase.municipality] ?? 0) + purchase.totalAmount
      return acc
    }, {})
  )
    .map(([municipality, amount]) => ({
      municipality,
      amount,
      pct: totals.totalAmount > 0 ? Math.round((amount / totals.totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const TONES = ['bg-primary', 'bg-party', 'bg-lime', 'bg-destructive'] as const

  return (
    <div className="w-full px-margin-mobile py-section-gap lg:px-margin-desktop">
      <header className="mx-auto flex max-w-4xl flex-col gap-4">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2">
          <span className="size-2 animate-pulse rounded-full bg-lime" />
          <span className="font-display text-label-lg text-lime uppercase tracking-widest">
            Cuentas claras
          </span>
        </p>

        <h1 className="text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl lg:text-display">
          A donde va <span className="text-primary-text">la plata</span>
        </h1>

        <p className="max-w-2xl text-pretty text-body-lg text-muted-foreground">
          Cuentas claras, rumba larga. Compramos el material nosotros y publicamos el
          recibo. Si no hay recibo, no pasó.
        </p>
      </header>

      {totals.purchaseCount === 0 ? (
        <div className="mx-auto mt-12 max-w-4xl rounded-xl border border-border border-dashed p-8">
          <p className="font-display font-bold text-headline-md uppercase">
            Todavía no hemos comprado nada.
          </p>
          <p className="mt-1 text-body-md text-muted-foreground">
            Apenas hagamos la primera compra, el recibo aparece acá.
          </p>
        </div>
      ) : (
        <>
          <section className="mx-auto mt-12 grid max-w-4xl gap-8 rounded-xl border-2 border-primary bg-primary/5 p-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-display text-label-lg text-muted-foreground uppercase tracking-widest">
                Total gestionado
              </p>
              <p className="mt-2 font-display font-black text-5xl text-primary-text leading-none tabular-nums sm:text-6xl">
                {formatCOP(totals.totalAmount, totals.currency)}
              </p>
              <p className="mt-3 text-body-md text-muted-foreground">
                en {totals.purchaseCount === 1 ? '1 compra' : `${totals.purchaseCount} compras`}
                {totals.householdsHelped > 0
                  ? `, para ${formatNumber(totals.householdsHelped)} ${
                      totals.householdsHelped === 1 ? 'hogar' : 'hogares'
                    }`
                  : ''}
                .
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="font-display text-label-lg text-lime uppercase tracking-widest">
                Reparto por municipio
              </h2>
              {porMunicipio.map((row, index) => (
                <div key={row.municipality}>
                  <div className="mb-1 flex justify-between font-display text-label-sm uppercase">
                    <span className="text-street-white">{row.municipality}</span>
                    <span className="text-muted-foreground tabular-nums">{row.pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary">
                    <div
                      className={`h-2 rounded-full ${TONES[index % TONES.length]}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mx-auto mt-12 flex max-w-4xl flex-col gap-4">
            {purchases.map((purchase) => (
              <Link
                key={purchase.id}
                href={`/transparencia/${purchase.slug}`}
                className="group flex flex-col gap-3 rounded-xl border-2 border-border bg-card p-6 transition-colors hover:border-party focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="font-display font-bold text-xl uppercase tracking-tight transition-colors group-hover:text-party">
                    {purchase.title}
                  </h2>
                  <p className="font-mono text-lg text-primary-text tabular-nums">
                    {formatCOP(purchase.totalAmount, purchase.currency)}
                  </p>
                </div>

                {purchase.summary ? (
                  <p className="text-pretty text-body-md text-muted-foreground">
                    {purchase.summary}
                  </p>
                ) : null}

                <p className="font-display text-label-sm text-muted-foreground uppercase">
                  {formatDate(purchase.purchasedAt)}
                  {' · '}
                  {purchase.municipality}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="mx-auto mt-12 max-w-4xl text-body-md text-muted-foreground">
        Tumbenla no procesa pagos. Los sitios entregan su parte y nosotros compramos el
        material.
      </p>
    </div>
  )
}
