'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { BackToVenueLink } from '@/components/comercio/back-to-venue-link'
import { formatearCodigo as formatRedemptionCode } from '@/lib/comercio/codigos-cliente'
import { PAY_METHOD_LABEL } from '@/lib/comercio/types'
import { cn } from '@/lib/utils/css'
import { formatCOP } from '@/lib/utils/format'

type DisplayCode = Readonly<{
  redemptionId: string
  unitId: string
  code: string
  status: string
  redeemedAt: string | null
  svg: string
}>

type ScreenOrder = Readonly<{
  publicToken: string
  buyerName: string
  totalUnits: number
  totalAmount: number
  donationAmount: number
  venueAmount: number
  payMethod: 'app' | 'bar'
  status: string
  lines: readonly Readonly<{
    productOrderId: string
    productName: string
    productKind: string
    quantity: number
    donationPercentage: number
  }>[]
  units: readonly Readonly<{
    id: string
    redemptionId: string | null
    status: string
    expiresAt: string | null
    redeemedAt: string | null
  }>[]
  allocationFinal: boolean
  allocationExplanation: string | null
  venueSlug: string
  venueName: string
}>

type OrderStatus = Readonly<{
  status: string
  paymentStatus: string
  deliveredUnits: number
  totalUnits: number
  expiresAt: string | null
  refundStatus: 'none' | 'reserved' | 'refunded'
  allocationStatus: 'pending' | 'final'
  units: readonly Readonly<{
    id: string
    redemptionId: string | null
    status: string
    expiresAt: string | null
    redeemedAt: string | null
  }>[]
}>

const FAST_WINDOW_MS = 90_000
const SLOW_WINDOW_MS = 300_000
const GIVE_UP_MS = 900_000

export function CustomerOrderScreen({
  order,
  displayCode,
  offerAccount = false,
  email = '',
}: {
  order: ScreenOrder
  displayCode: DisplayCode | null
  offerAccount?: boolean
  email?: string
}) {
  const [startedAt] = useState(() => Date.now())
  const initialDelivered = order.units.filter((unit) => unit.status === 'redeemed').length
  const { data, refetch } = useQuery<OrderStatus>({
    queryKey: ['order-status', order.publicToken],
    queryFn: async () => {
      const response = await fetch(`/api/orden/${order.publicToken}/estado`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('No se pudo consultar el pedido')
      return response.json()
    },
    initialData: {
      status: order.status,
      paymentStatus: order.payMethod === 'bar' ? 'cash' : order.status,
      deliveredUnits: initialDelivered,
      totalUnits: order.totalUnits,
      expiresAt: null,
      refundStatus: 'none',
      allocationStatus: order.allocationFinal ? 'final' : 'pending',
      units: order.units,
    },
    refetchInterval: (query) => {
      const delivered = query.state.data?.deliveredUnits ?? 0
      if (delivered >= order.totalUnits) return false
      const elapsed = Date.now() - startedAt
      if (elapsed < FAST_WINDOW_MS) return 1_000
      if (elapsed < SLOW_WINDOW_MS) return 3_000
      if (elapsed < GIVE_UP_MS) return 10_000
      return false
    },
    refetchOnWindowFocus: true,
    retry: false,
  })

  const deliveredUnits = data?.deliveredUnits ?? initialDelivered
  const fullyDelivered = deliveredUnits >= order.totalUnits
  const stopped = !fullyDelivered && Date.now() - startedAt >= GIVE_UP_MS
  const displayedUnitStatus = displayCode
    ? (data?.units.find((unit) => unit.id === displayCode.unitId)?.status ?? displayCode.status)
    : null
  const displayedCodeRedeemed = displayedUnitStatus === 'redeemed'
  const payAtBar = order.payMethod === 'bar'

  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-margin-mobile py-10'>
      <header>
        <BackToVenueLink venueName={order.venueName} venueSlug={order.venueSlug} />
        <h1 className='mt-1 font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          Tu pedido
        </h1>
        <p className='mt-2 text-body-md text-muted-foreground'>
          {order.totalUnits} {order.totalUnits === 1 ? 'unidad' : 'unidades'} ·{' '}
          {formatCOP(order.totalAmount)} · {PAY_METHOD_LABEL[order.payMethod]}
        </p>
      </header>

      <section
        className='rounded-xl border border-border bg-card p-4'
        aria-labelledby='order-lines'
      >
        <h2 id='order-lines' className='font-display text-label-lg uppercase'>
          Lo que van a preparar
        </h2>
        <ul className='mt-3 space-y-2'>
          {order.lines.map((line) => (
            <li key={line.productOrderId} className='flex items-baseline justify-between gap-4'>
              <span>
                {line.quantity > 1 ? `${line.quantity} × ` : null}
                {line.productName}
              </span>
              <span className='shrink-0 text-muted-foreground text-sm'>
                {line.donationPercentage}% material
              </span>
            </li>
          ))}
        </ul>
      </section>

      {fullyDelivered ? (
        <>
          <div className='rounded-xl border-2 border-lime bg-lime/10 p-5 text-center'>
            <p className='font-display font-black text-2xl uppercase text-lime'>Confirmado</p>
            <p className='mt-1 text-body-md'>El bar ya recibió el pedido completo.</p>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Link
              href={`/sitios/${order.venueSlug}`}
              className='rounded-xl bg-primary px-5 py-3 text-center font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
            >
              Pedir otra cosa
            </Link>
            <Link
              href='/mi-historia'
              className='rounded-xl border border-border px-5 py-3 text-center font-display text-label-lg uppercase transition-colors hover:border-party'
            >
              Ver mis pedidos
            </Link>
          </div>
        </>
      ) : (
        <div
          className={cn(
            'rounded-xl border-2 p-5',
            payAtBar ? 'border-party bg-party/10' : 'border-primary bg-primary/5'
          )}
        >
          <p className='font-display text-label-lg uppercase'>
            {payAtBar ? 'Muestra esto antes de pagar' : 'Muestra esto en la barra'}
          </p>
          <p className='mt-1 text-body-md'>
            {payAtBar
              ? `Que lo escaneen primero: ahí ven todo lo que deben preparar y que tienen que cobrarte ${formatCOP(order.totalAmount)}.`
              : 'Ya está pagado. Un solo escaneo entrega todo el pedido.'}
          </p>
          <p className='mt-2 text-body-md text-muted-foreground'>
            Cuando lo escaneen, esta pantalla cambia sola. Si no cambia, avísales.
          </p>
        </div>
      )}

      {displayCode ? (
        <section
          className={cn(
            'rounded-xl border p-5 text-center transition-colors',
            fullyDelivered ? 'border-lime bg-lime/5' : 'border-border bg-card'
          )}
          aria-label='Código único del pedido'
        >
          <div
            className={cn('relative mx-auto w-full max-w-[260px]', fullyDelivered && 'opacity-25')}
          >
            <div
              className='overflow-hidden rounded-lg bg-white p-3 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full'
              // The server generates this SVG from our own redemption code.
              dangerouslySetInnerHTML={{ __html: displayCode.svg }}
            />
          </div>
          {fullyDelivered || displayedCodeRedeemed ? (
            <p className='mt-3 font-display font-bold text-lg uppercase text-lime'>
              Pedido confirmado
            </p>
          ) : (
            <>
              <p className='mt-3 font-mono text-2xl tracking-[0.2em]'>
                {formatRedemptionCode(displayCode.code)}
              </p>
              <p className='mt-1 text-muted-foreground text-sm'>
                Si la cámara no lee, que lo escriban.
              </p>
            </>
          )}
        </section>
      ) : null}

      {stopped ? (
        <button
          type='button'
          onClick={() => void refetch()}
          className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase'
        >
          Revisar otra vez
        </button>
      ) : null}

      {offerAccount ? (
        <section className='rounded-xl border-2 border-primary bg-primary/5 p-5'>
          <p className='font-display font-bold text-lg'>Termina tu cuenta</p>
          <p className='mt-1 text-body-md text-muted-foreground'>
            Con la cuenta te quedan las fotos de la noche, tus pedidos y la factura del material que
            compramos con esto. Todo en un solo lugar.
          </p>
          <Link
            href={`/register?correo=${encodeURIComponent(email)}&redirectAfter=${encodeURIComponent(`/orden/${order.publicToken}`)}`}
            className='mt-4 inline-block rounded-xl bg-primary px-6 py-3 font-display text-label-lg text-primary-foreground uppercase'
          >
            Crear mi cuenta
          </Link>
          <p className='mt-3 text-muted-foreground text-sm'>
            Este pedido se amarra solo, sin que tengas que hacer nada más.
          </p>
        </section>
      ) : null}

      <footer className='mt-2 rounded-xl border border-border p-5'>
        <p className='font-display text-label-lg uppercase'>A dónde va</p>
        <p className='mt-1 text-body-md'>
          {payAtBar ? (
            <>
              Del total de {formatCOP(order.totalAmount)}:{' '}
              <span className='text-lime'>
                {formatCOP(order.donationAmount)} se van en material
              </span>
              {order.venueAmount > 0
                ? `. ${formatCOP(order.venueAmount)} se quedan en el sitio.`
                : '.'}
            </>
          ) : (
            <>
              <span className='text-lime'>El porcentaje indicado en cada producto</span> se aplica
              al valor neto de esa unidad después de las deducciones verificadas de la pasarela.{' '}
              {data?.allocationStatus === 'final' || order.allocationFinal
                ? 'El reparto ya fue reconciliado.'
                : 'El monto exacto sigue pendiente de reconciliación.'}
            </>
          )}
        </p>
        {order.allocationExplanation ? (
          <p className='mt-2 text-muted-foreground text-sm'>{order.allocationExplanation}</p>
        ) : null}
        <p className='mt-2 text-muted-foreground text-sm'>
          Guarda este enlace: es todo tu pedido. También te llegó al correo.
        </p>
        {payAtBar ? null : (
          <p className='mt-2 text-muted-foreground text-sm'>
            Si no lo reclamas en 45 días, el código vence y conservamos el valor disponible para
            devolvértelo completo. Escríbenos a{' '}
            <a href='mailto:hola@tumbenla.com' className='text-primary-text underline'>
              hola@tumbenla.com
            </a>{' '}
            para solicitarlo.
          </p>
        )}
      </footer>
    </main>
  )
}
