import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CustomerOrders } from '@/components/commerce/customer-orders'
import { MiHistoriaGaleria as CustomerHistoryGallery } from '@/components/fiestas/mi-historia-galeria'
import { db } from '@/database'
import { auth } from '@/lib/auth/auth'
import { listCustomerOrders, summarizeNonRealOrders } from '@/lib/commerce/customer-history'
import { getCustomerContributionStages } from '@/lib/commerce/transparency-service'
import { vincularPedidosDeInvitado as linkGuestOrders } from '@/lib/comercio/vincular'
import { getHistorySummary, listMyClaimedPhotos } from '@/lib/fiestas/queries'
import { generateMetadata as buildMetadata } from '@/lib/seo'
import { formatCOP, formatNumber } from '@/lib/utils/format'

export const metadata: Metadata = {
  ...buildMetadata({
    title: 'Mi historia',
    description: 'Tus noches, tus fotos y lo que has puesto para reconstruir.',
    canonical: '/mi-historia',
  }),
  // Personal history must never appear in a search index.
  robots: { index: false, follow: false },
}

export default async function CustomerHistoryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?redirectAfter=/mi-historia')

  // Link guest orders before reading the history. A verified email is required because anyone can
  // type somebody else's address into the public checkout form.
  await linkGuestOrders({
    id: session.user.id,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  })

  const [historySummary, photos, orders, contribution] = await Promise.all([
    getHistorySummary(session.user.id),
    listMyClaimedPhotos(session.user.id),
    listCustomerOrders(db, session.user.id),
    getCustomerContributionStages(db, session.user.id),
  ])
  const nonRealSummary = summarizeNonRealOrders(orders)

  return (
    <div className='w-full px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <header className='mx-auto flex max-w-5xl flex-col gap-4'>
        <p className='inline-flex w-fit items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2'>
          <span className='size-2 animate-pulse rounded-full bg-lime' />
          <span className='font-display text-label-lg text-lime uppercase tracking-widest'>
            Le entraste
          </span>
        </p>

        <h1 className='text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl'>
          Mi <span className='text-primary-text'>historia</span>
        </h1>

        <p className='max-w-2xl text-pretty text-body-lg text-muted-foreground'>
          Las noches que has salido en la red y lo que tus pedidos han puesto para reconstruir.
        </p>
      </header>

      {/* Orders also make a history: a customer who just created an account after checkout must not
          land on an empty state while their order is already linked. */}
      {historySummary.nights === 0 && orders.length === 0 ? (
        <div className='mx-auto mt-12 max-w-5xl rounded-xl border border-border border-dashed p-8'>
          <p className='font-display font-bold text-headline-md uppercase'>
            Todavía no tienes noches guardadas.
          </p>
          <p className='mt-2 text-body-md text-muted-foreground'>
            Pide algo de la carta de un sitio, o busca tus fotos cuando subamos las de esa noche.
            Las dos cosas suman a tu historia.
          </p>
          <Link
            href='/sitios'
            className='mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
          >
            Ver el mapa
          </Link>
        </div>
      ) : (
        <>
          <section className='mx-auto mt-12 max-w-5xl' aria-labelledby='memory-title'>
            <div className='mb-4'>
              <h2
                id='memory-title'
                className='font-display text-label-lg uppercase tracking-widest'
              >
                Tus recuerdos
              </h2>
              <p className='mt-1 text-body-md text-muted-foreground'>
                Estas cifras salen de las fotos que guardaste, no de tus pedidos.
              </p>
            </div>
            <div className='grid gap-4 sm:grid-cols-3'>
              <MetricCard label='Noches' value={formatNumber(historySummary.nights)} />
              <MetricCard label='Sitios' value={formatNumber(historySummary.venues)} />
              <MetricCard label='Fotos guardadas' value={formatNumber(historySummary.photos)} />
            </div>
          </section>

          <section className='mx-auto mt-4 max-w-5xl rounded-xl border-2 border-primary bg-primary/5 p-8'>
            <p className='font-display text-label-lg text-muted-foreground uppercase tracking-widest'>
              Tus pedidos reales
            </p>
            <div className='mt-3 grid gap-4 sm:grid-cols-2'>
              <ContributionMetric
                label='Total gastado'
                value={formatCOP(Number(contribution.spentMinor) / 100)}
              />
              <ContributionMetric
                label='Para reconstruir'
                value={formatCOP(Number(contribution.donatedMinor) / 100)}
              />
            </div>

            <p className='mt-4 max-w-prose text-pretty text-body-md text-muted-foreground'>
              El total gastado cuenta las unidades reales pagadas y aún no devueltas. Para
              reconstruir suma únicamente el reparto final de las unidades entregadas; por eso puede
              actualizarse después de tu pedido.
            </p>

            {contribution.pendingAllocationUnits > 0 ? (
              <p className='mt-3 rounded-lg border border-border bg-card px-3 py-2 text-body-md'>
                {contribution.pendingAllocationUnits === 1
                  ? 'Tienes 1 entrega esperando reparto final.'
                  : `Tienes ${contribution.pendingAllocationUnits} entregas esperando reparto final.`}
              </p>
            ) : null}

            <Link
              href='/transparencia'
              className='mt-6 inline-block font-display text-label-lg text-primary-text uppercase tracking-widest hover:underline'
            >
              Ver en qué se fue la plata →
            </Link>
          </section>

          {nonRealSummary.orderCount > 0 ? (
            <section className='mx-auto mt-4 max-w-5xl rounded-xl border border-warning/40 bg-warning/5 p-6'>
              <p className='font-display text-label-lg text-warning uppercase tracking-widest'>
                Pedidos que no cuentan en los totales reales
              </p>
              <div className='mt-3 grid gap-4 sm:grid-cols-2'>
                <ContributionMetric
                  label='Gastado en pruebas o históricos'
                  value={formatCOP(Number(nonRealSummary.spentMinor) / 100)}
                  muted
                />
                <ContributionMetric
                  label='Reparto mostrado al pedir'
                  value={formatCOP(Number(nonRealSummary.promisedDonationMinor) / 100)}
                  muted
                />
              </div>
              <p className='mt-4 max-w-prose text-pretty text-body-md text-muted-foreground'>
                Sirven para comprobar el recorrido completo, pero no representan plata real ni se
                mezclan con las cifras públicas de Tumbenla.
              </p>
            </section>
          ) : null}

          <CustomerOrders orders={orders} />

          <CustomerHistoryGallery fotos={photos} />
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-xl border border-border bg-card p-6'>
      <p className='font-display text-label-sm text-muted-foreground uppercase tracking-widest'>
        {label}
      </p>
      <p className='mt-1 font-display font-black text-4xl tabular-nums'>{value}</p>
    </div>
  )
}

function ContributionMetric({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div>
      <p className='font-display text-label-sm text-muted-foreground uppercase tracking-widest'>
        {label}
      </p>
      <p
        className={`mt-1 font-display font-black text-3xl tabular-nums ${
          muted ? 'text-foreground' : 'text-primary-text'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
