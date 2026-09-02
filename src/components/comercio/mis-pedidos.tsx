import Link from 'next/link'

import { formatCOP, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

/**
 * Los pedidos de una persona, dentro de su historia.
 *
 * Aca es donde la cuenta paga lo que prometio en el checkout: las fotos de la
 * noche, los tragos que pidio y a donde fue esa plata, todo en el mismo lugar.
 * Incluye los que hizo como INVITADO antes de tener cuenta, porque al entrar se
 * amarran solos por el correo verificado.
 *
 * Cada pedido conserva su enlace al QR: sirve para volver a mostrarlo si
 * todavia no se lo entregaron, y como recibo cuando ya se lo entregaron.
 */

type Pedido = {
  id: string
  publicToken: string
  fecha: string
  productoNombre: string
  venueSlug: string
  venueNombre: string
  cantidad: number
  total: number
  material: number
  estado: string
  entregadas: number
}

const ESTADO_TEXTO: Record<string, string> = {
  pending: 'Sin pagar',
  paid: 'Pagado',
  expired: 'Caducado',
  refunded: 'Devuelto',
  cancelled: 'Cancelado',
}

export function MisPedidos({ pedidos }: { pedidos: Pedido[] }) {
  if (pedidos.length === 0) return null

  const totalMaterial = pedidos
    .filter((p) => p.estado !== 'refunded' && p.estado !== 'cancelled')
    .reduce((n, p) => n + p.material, 0)

  return (
    <section className='mx-auto mt-10 max-w-5xl'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='font-display font-extrabold text-headline-md uppercase'>Lo que pediste</h2>
        {totalMaterial > 0 ? (
          <p className='text-body-md text-muted-foreground'>
            <span className='text-lime'>{formatCOP(totalMaterial)}</span> en material
          </p>
        ) : null}
      </div>

      <ul className='mt-4 flex flex-col gap-3'>
        {pedidos.map((p) => {
          const entregado = p.entregadas >= p.cantidad
          return (
            <li key={p.id}>
              <Link
                href={`/orden/${p.publicToken}`}
                className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-party'
              >
                <div className='min-w-0'>
                  <p className='font-display font-bold'>
                    {p.cantidad > 1 ? `${p.cantidad} × ` : null}
                    {p.productoNombre}
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    {p.venueNombre} · {formatDate(new Date(p.fecha))}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='font-display font-bold'>{formatCOP(p.total)}</p>
                  <p className={cn('text-sm', entregado ? 'text-lime' : 'text-muted-foreground')}>
                    {entregado ? 'Entregado' : (ESTADO_TEXTO[p.estado] ?? p.estado)}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Lo que se puede afirmar HOY y nada mas. La plata de un pedido entra al
          fondo de material del sitio, pero todavia no se rastrea hasta la
          factura exacta que la gasto: el aporte se liquida en bloque, no pedido
          por pedido. Decirlo asi es la diferencia entre un dato y una promesa
          que no podemos cumplir (decision 5). */}
      <p className='mt-4 max-w-prose text-body-md text-muted-foreground'>
        Esa plata entra a lo que el sitio pone en material.{' '}
        <Link href='/transparencia' className='text-primary-text hover:underline'>
          En transparencia
        </Link>{' '}
        están las facturas de lo que hemos comprado. Todavía no podemos decirte cuál factura salió
        de tu trago: los aportes se liquidan en bloque, no pedido por pedido.
      </p>
    </section>
  )
}
