import type { Metadata } from 'next'
import Link from 'next/link'

import { db } from '@/database'
import { getFoundationTransparencyStages } from '@/lib/commerce/transparency-service'
import { generateMetadata as buildMetadata } from '@/lib/seo'
import { getTransparencyTotals, listPublishedPurchases } from '@/lib/transparency/queries'
import { formatCOP, formatDate, formatNumber } from '@/lib/utils/format'

export const metadata: Metadata = buildMetadata({
  title: 'A dónde va la plata',
  description: 'Cada compra de material que hicimos, con su recibo, sus cantidades y su fecha.',
  canonical: '/transparencia',
})

export const revalidate = 300

/**
 * Public proof of what entered the reconstruction allocation and which amount already has a
 * verified, published material-purchase receipt.
 *
 * Municipality bars are calculated from published purchases. When there are no purchases, the
 * page does not manufacture an empty chart.
 */
export default async function TransparencyPage() {
  const [totals, purchases, stages] = await Promise.all([
    getTransparencyTotals(),
    listPublishedPurchases(),
    getFoundationTransparencyStages(db),
  ])

  const purchasesByMunicipality = Object.entries(
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

  const tones = ['bg-primary', 'bg-party', 'bg-lime', 'bg-destructive'] as const

  return (
    <div className='w-full px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <header className='mx-auto flex max-w-4xl flex-col gap-4'>
        <p className='inline-flex w-fit items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2'>
          <span className='size-2 animate-pulse rounded-full bg-lime' />
          <span className='font-display text-label-lg text-lime uppercase tracking-widest'>
            Cuentas claras
          </span>
        </p>

        <h1 className='text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl lg:text-display'>
          A donde va <span className='text-primary-text'>la plata</span>
        </h1>

        <p className='max-w-2xl text-pretty text-body-lg text-muted-foreground'>
          Cuentas claras, rumba larga. Compramos el material nosotros y publicamos el recibo. Si no
          hay recibo, no pasó.
        </p>
      </header>

      <section className='mx-auto mt-12 max-w-4xl'>
        <div className='grid gap-3 md:grid-cols-3'>
          <Stage
            label='Para reconstruir'
            amount={Number(stages.totalDonatedMinor) / 100}
            description='La suma del reparto final para reconstruir, sin incluir la parte de los sitios.'
            emphasized
          />
          <Stage
            label='Ya en material'
            amount={Number(stages.deliveredMinor) / 100}
            description='La parte que ya tiene una compra de material verificada y su recibo publicado.'
          />
          <Stage
            label='Pendiente de convertir en material'
            amount={Number(stages.pendingDeliveryMinor) / 100}
            description='Lo contabilizado para reconstruir que todavía no aparece en una compra publicada.'
          />
        </div>
        <p className='mt-4 max-w-3xl text-pretty text-body-md text-muted-foreground'>
          Pendiente de convertir en material no es una comisión ni plata que Tumbenla se quede. La
          asignación se registra antes de que podamos comprar el material en bloque y publicar la
          factura; durante ese intervalo puede seguir conciliándose, venir en camino desde el sitio
          o esperar la siguiente compra.
        </p>
      </section>

      {totals.purchaseCount === 0 ? (
        <div className='mx-auto mt-12 max-w-4xl rounded-xl border border-border border-dashed p-8'>
          <p className='font-display font-bold text-headline-md uppercase'>
            Todavía no hemos comprado nada.
          </p>
          <p className='mt-1 text-body-md text-muted-foreground'>
            Apenas hagamos la primera compra, el recibo aparece acá.
          </p>
        </div>
      ) : (
        <>
          <section className='mx-auto mt-12 grid max-w-4xl gap-8 rounded-xl border-2 border-primary bg-primary/5 p-8 lg:grid-cols-2 lg:items-center'>
            <div>
              <p className='font-display text-label-lg text-muted-foreground uppercase tracking-widest'>
                Compras verificadas publicadas
              </p>
              <p className='mt-2 font-display font-black text-5xl text-primary-text leading-none tabular-nums sm:text-6xl'>
                {formatCOP(totals.totalAmount, totals.currency)}
              </p>
              <p className='mt-3 text-body-md text-muted-foreground'>
                en {totals.purchaseCount === 1 ? '1 compra' : `${totals.purchaseCount} compras`}
                {totals.householdsHelped > 0
                  ? `, para ${formatNumber(totals.householdsHelped)} ${
                      totals.householdsHelped === 1 ? 'hogar' : 'hogares'
                    }`
                  : ''}
                .
              </p>
            </div>

            <div className='flex flex-col gap-4'>
              <h2 className='font-display text-label-lg text-lime uppercase tracking-widest'>
                Reparto por municipio
              </h2>
              {purchasesByMunicipality.map((row, index) => (
                <div key={row.municipality}>
                  <div className='mb-1 flex justify-between font-display text-label-sm uppercase'>
                    <span className='text-street-white'>{row.municipality}</span>
                    <span className='text-muted-foreground tabular-nums'>{row.pct}%</span>
                  </div>
                  <div className='h-2 w-full rounded-full bg-secondary'>
                    <div
                      className={`h-2 rounded-full ${tones[index % tones.length]}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className='mx-auto mt-12 flex max-w-4xl flex-col gap-4'>
            {purchases.map((purchase) => (
              <Link
                key={purchase.id}
                href={`/transparencia/${purchase.slug}`}
                className='group flex flex-col gap-3 rounded-xl border-2 border-border bg-card p-6 transition-colors hover:border-party focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              >
                <div className='flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1'>
                  <h2 className='font-display font-bold text-xl uppercase tracking-tight transition-colors group-hover:text-party'>
                    {purchase.title}
                  </h2>
                  <p className='font-mono text-lg text-primary-text tabular-nums'>
                    {formatCOP(purchase.totalAmount, purchase.currency)}
                  </p>
                </div>

                {purchase.summary ? (
                  <p className='text-pretty text-body-md text-muted-foreground'>
                    {purchase.summary}
                  </p>
                ) : null}

                <p className='font-display text-label-sm text-muted-foreground uppercase'>
                  {formatDate(purchase.purchasedAt)}
                  {' · '}
                  {purchase.municipality}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className='mx-auto mt-12 max-w-4xl text-body-md text-muted-foreground'>
        Los pagos de la app se cobran por una pasarela y se concilian antes de respaldar un aporte.
        Lo cobrado en barra cuenta como deuda del sitio hasta que el dinero se verifica.
      </p>
    </div>
  )
}

function Stage({
  label,
  amount,
  description,
  emphasized = false,
}: {
  label: string
  amount: number
  description: string
  emphasized?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        emphasized ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}
    >
      <p className='font-display text-label-sm text-muted-foreground uppercase tracking-widest'>
        {label}
      </p>
      <p className='mt-2 font-display font-black text-2xl text-primary-text tabular-nums'>
        {formatCOP(amount)}
      </p>
      <p className='mt-3 text-pretty text-muted-foreground text-sm'>{description}</p>
    </div>
  )
}
