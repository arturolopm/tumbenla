import Link from 'next/link'

import type { CustomerOrder, CustomerOrderFunding } from '@/lib/commerce/customer-history'
import { formatCOP, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

const STATUS_TEXT: Record<CustomerOrder['status'], string> = {
  pending: 'Sin pagar',
  paid: 'Pagado',
  expired: 'Caducado',
  refunded: 'Devuelto',
  cancelled: 'Cancelado',
}

const NON_REAL_LABEL: Record<Exclude<CustomerOrderFunding, 'real'>, string> = {
  sandbox: 'Prueba',
  legacy_unverified: 'Histórico por verificar',
}

export function CustomerOrders({ orders }: { orders: readonly CustomerOrder[] }) {
  if (orders.length === 0) return null

  return (
    <section className='mx-auto mt-10 max-w-5xl' aria-labelledby='customer-orders-title'>
      <h2
        id='customer-orders-title'
        className='font-display font-extrabold text-headline-md uppercase'
      >
        Lo que pediste
      </h2>

      <ul className='mt-4 flex flex-col gap-3'>
        {orders.map((order) => {
          const delivered = order.redeemedUnits >= order.quantity
          const nonReal = order.fundingClassification !== 'real'

          return (
            <li key={order.id}>
              <Link
                href={`/orden/${order.publicToken}`}
                className='group flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-party focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='font-display font-bold transition-colors group-hover:text-party'>
                      {order.quantity > 1 ? `${order.quantity} × ` : null}
                      {order.productName}
                    </p>
                    {nonReal ? (
                      <span className='rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-display text-warning text-xs uppercase tracking-wider'>
                        {NON_REAL_LABEL[order.fundingClassification]}
                      </span>
                    ) : null}
                  </div>
                  <p className='mt-1 text-muted-foreground text-sm'>
                    {order.venueName} · {formatDate(order.createdAt)}
                  </p>
                  <p className='mt-1 text-muted-foreground text-sm'>
                    Reparto mostrado al pedir:{' '}
                    <span className='text-foreground'>
                      {formatCOP(Number(order.promisedDonationMinor) / 100)} para reconstruir
                    </span>
                  </p>
                </div>

                <div className='flex items-end justify-between gap-4 sm:block sm:text-right'>
                  <p className='font-display font-bold tabular-nums'>
                    {formatCOP(Number(order.totalMinor) / 100)}
                  </p>
                  <p
                    className={cn(
                      'text-sm',
                      delivered && !nonReal ? 'text-lime' : 'text-muted-foreground'
                    )}
                  >
                    {delivered ? 'Entregado' : STATUS_TEXT[order.status]}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <p className='mt-4 max-w-prose text-pretty text-body-md text-muted-foreground'>
        El total donado usa únicamente pedidos reales con reparto financiero terminado. Las pruebas
        y los registros históricos por verificar siguen visibles, pero nunca entran en ese total.
      </p>
    </section>
  )
}
