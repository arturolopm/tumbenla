import type { Metadata } from 'next'
import Link from 'next/link'

import { getTransparencyTotals, listPublishedPurchases } from '@/lib/transparency/queries'
import { formatCOP, formatDate, formatNumber } from '@/lib/utils/format'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'En que se fue la plata',
  description:
    'Cada compra de material que hicimos, con su recibo, sus cantidades y su fecha.',
  canonical: '/transparencia',
})

export const revalidate = 300

export default async function TransparenciaPage() {
  const [totals, purchases] = await Promise.all([
    getTransparencyTotals(),
    listPublishedPurchases(),
  ])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance font-semibold text-4xl tracking-tight">
          En que se fue la plata
        </h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Compramos el material nosotros y publicamos el recibo. Si no hay recibo, no paso.
        </p>
      </header>

      {totals.purchaseCount === 0 ? (
        <div className="mt-10 rounded-3xl border border-border border-dashed p-8">
          <p className="font-medium">Todavia no hemos comprado nada.</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Apenas hagamos la primera compra, el recibo aparece aca.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-10 rounded-3xl border border-primary/25 bg-primary/5 p-8">
            <p className="text-muted-foreground text-sm">Van comprados</p>
            <p className="mt-1 font-display font-semibold text-5xl text-primary tracking-tight tabular-nums sm:text-6xl">
              {formatCOP(totals.totalAmount, totals.currency)}
            </p>
            <p className="mt-3 text-muted-foreground">
              en {totals.purchaseCount === 1 ? '1 compra' : `${totals.purchaseCount} compras`}
              {totals.householdsHelped > 0
                ? `, para ${formatNumber(totals.householdsHelped)} ${
                    totals.householdsHelped === 1 ? 'hogar' : 'hogares'
                  }`
                : ''}
              .
            </p>
          </section>

          <div className="mt-10 flex flex-col gap-4">
            {purchases.map((purchase) => (
              <Link
                key={purchase.id}
                href={`/transparencia/${purchase.slug}`}
                className="group flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 transition-colors hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="font-semibold text-xl">{purchase.title}</h2>
                  <p className="font-mono text-lg text-primary tabular-nums">
                    {formatCOP(purchase.totalAmount, purchase.currency)}
                  </p>
                </div>

                {purchase.summary ? (
                  <p className="text-pretty text-muted-foreground">{purchase.summary}</p>
                ) : null}

                <p className="text-muted-foreground text-sm">
                  {formatDate(purchase.purchasedAt)}
                  {' · '}
                  {purchase.municipality}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="mt-10 text-muted-foreground text-sm">
        Tumbenla no procesa pagos. Los sitios entregan su parte y nosotros compramos el
        material.
      </p>
    </div>
  )
}
