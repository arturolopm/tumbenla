'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { BackToVenueLink } from '@/components/comercio/back-to-venue-link'
import { formatearCodigo } from '@/lib/comercio/codigos-cliente'
import { PAY_METHOD_LABEL, type PayMethod } from '@/lib/comercio/types'
import { formatCOP } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

/**
 * La pantalla del QR.
 *
 * LO UNICO QUE SE LE PIDE A LA PERSONA ES MOSTRAR ESTO (decision 28). No hay
 * boton de confirmar, ni de calificar, ni de "ya me lo dieron". La pantalla
 * cambia sola cuando el mesero escanea, y eso convierte al comprador en un
 * sensor sin pedirle trabajo: levanta el telefono, mira, y si no cambio dice
 * "no me salio" ahi mismo. Es la auditoria mas barata que hay.
 */

type Codigo = {
  id: string
  unidadId: string
  codigo: string
  estado: string
  redimidaEn: string | null
  svg: string
}

type Orden = {
  publicToken: string
  compradorNombre: string
  cantidad: number
  entregadasIniciales: number
  precioUnitario: number
  materialPorUnidad: number
  sitioPorUnidad: number
  total: number
  payMethod: PayMethod
  estado: string
  productoNombre: string
  productoDescripcion: string | null
  porcentajeMaterial: number
  repartoFinal: boolean
  explicacionDelReparto: string | null
  venueSlug: string
  venueNombre: string
}

/**
 * Polling cadence.
 *
 * The scan almost always happens in the first minute — the person is already
 * standing at the bar — and after that the screen is just waiting. A flat
 * 1s for fifteen minutes would be a thousand requests for the one that matters;
 * a slow tick feels broken at the exact moment that decides everything.
 */
const FAST_WINDOW_MS = 90_000
const SLOW_WINDOW_MS = 300_000
const GIVE_UP_MS = 900_000

type OrderStatus = {
  estado: string
  estadoDelPago: string
  entregadas: number
  total: number
  venceEn: string | null
  estadoDelReembolso: 'none' | 'reserved' | 'refunded'
  reparto: 'pending' | 'final'
  unidades: {
    id: string
    redencionId: string | null
    estado: string
    venceEn: string | null
    redimidaEn: string | null
  }[]
}

export function PantallaDeOrden({
  orden,
  codigos,
  ofrecerCuenta = false,
  correo = '',
}: {
  orden: Orden
  codigos: Codigo[]
  ofrecerCuenta?: boolean
  correo?: string
}) {
  const [startedAt] = useState(() => Date.now())

  /**
   * React Query owns the polling.
   *
   * This used to be a hand-rolled setTimeout chain with its own cadence table,
   * its own `visibilitychange` listener, its own "stopped" flag and its own
   * try/catch. All of that is `refetchInterval` plus the defaults: Query
   * already pauses when the tab is hidden and refetches on focus, which is
   * exactly the behaviour that matters here — a phone that dimmed while the
   * bartender scanned shows "Listo" the instant it wakes, without waiting for
   * the next tick.
   */
  const { data, refetch } = useQuery<OrderStatus>({
    queryKey: ['order-status', orden.publicToken],
    queryFn: async () => {
      const response = await fetch(`/api/orden/${orden.publicToken}/estado`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('no se pudo consultar el pedido')
      return response.json()
    },
    initialData: {
      estado: orden.estado,
      estadoDelPago: orden.payMethod === 'bar' ? 'cash' : orden.estado,
      entregadas: orden.entregadasIniciales,
      total: orden.cantidad,
      venceEn: null,
      estadoDelReembolso: 'none',
      reparto: orden.repartoFinal ? 'final' : 'pending',
      unidades: codigos.map((code) => ({
        id: code.unidadId,
        redencionId: code.id,
        estado: code.estado,
        venceEn: null,
        redimidaEn: code.redimidaEn,
      })),
    },
    refetchInterval: (query) => {
      const delivered = query.state.data?.entregadas ?? 0
      if (delivered >= orden.cantidad) return false

      const elapsed = Date.now() - startedAt
      if (elapsed < FAST_WINDOW_MS) return 1_000
      if (elapsed < SLOW_WINDOW_MS) return 3_000
      if (elapsed < GIVE_UP_MS) return 10_000
      return false
    },
    // The app-wide provider disables focus refetching. This screen explicitly
    // needs it so a buyer who returns after staff scans sees the result at once.
    refetchOnWindowFocus: true,
    // No noise on a dead spot in a basement: it retries on the next tick and
    // the person could not act on the error anyway.
    retry: false,
  })

  const entregadas = data?.entregadas ?? 0
  const todasEntregadas = entregadas >= orden.cantidad
  const detenido = !todasEntregadas && Date.now() - startedAt >= GIVE_UP_MS

  const estadoPorUnidad = new Map(data?.unidades.map((unit) => [unit.id, unit.estado]) ?? [])
  const estado = codigos.map((code) => ({
    ...code,
    estado: estadoPorUnidad.get(code.unidadId) ?? code.estado,
  }))

  const pagaEnBarra = orden.payMethod === 'bar'
  const totalMaterialAmount = orden.materialPorUnidad * orden.cantidad
  const totalVenueAmount = orden.sitioPorUnidad * orden.cantidad

  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-margin-mobile py-10'>
      <header>
        <BackToVenueLink venueName={orden.venueNombre} venueSlug={orden.venueSlug} />
        <h1 className='mt-1 font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          {orden.productoNombre}
        </h1>
        <p className='mt-2 text-body-md text-muted-foreground'>
          {orden.cantidad > 1 ? `${orden.cantidad} · ` : null}
          {formatCOP(orden.total)} · {PAY_METHOD_LABEL[orden.payMethod]}
        </p>
      </header>

      {todasEntregadas ? (
        <>
          <div className='rounded-xl border-2 border-lime bg-lime/10 p-5 text-center'>
            <p className='font-display font-black text-2xl uppercase text-lime'>Confirmado</p>
            <p className='mt-1 text-body-md'>
              El mesero preparará y te entregará {orden.cantidad > 1 ? 'tus pedidos' : 'tu pedido'}.
            </p>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <Link
              href={`/sitios/${orden.venueSlug}`}
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
            pagaEnBarra ? 'border-party bg-party/10' : 'border-primary bg-primary/5'
          )}
        >
          <p className='font-display text-label-lg uppercase'>
            {pagaEnBarra ? 'Muestra esto ANTES de pagar' : 'Muestra esto en la barra'}
          </p>
          <p className='mt-1 text-body-md'>
            {pagaEnBarra
              ? `Que lo escaneen primero: ahí les sale qué preparar y que tienen que cobrarte ${formatCOP(orden.total)}.`
              : 'Ya está pagado. Que lo escaneen para entregártelo.'}
          </p>
          <p className='mt-2 text-body-md text-muted-foreground'>
            Cuando lo escaneen, esta pantalla cambia sola. Si no cambia, avísales.
          </p>
        </div>
      )}

      <ul className='flex flex-col gap-4'>
        {estado.map((c) => {
          const entregada = c.estado === 'redeemed'
          return (
            <li
              key={c.id}
              className={cn(
                'rounded-xl border p-5 text-center transition-colors',
                entregada ? 'border-lime bg-lime/5' : 'border-border bg-card'
              )}
            >
              <div
                className={cn('relative mx-auto w-full max-w-[260px]', entregada && 'opacity-25')}
              >
                {/* El SVG viene armado del servidor: son ~40 KB de JavaScript
                    menos en la unica pantalla que se abre de pie y con la señal
                    que haya. */}
                {/* El SVG lo genera el servidor con la libreria de QR a partir
                    de un codigo que generamos nosotros. No hay entrada de
                    usuario en ese string, que es lo unico que haria peligroso
                    inyectarlo. */}
                <div
                  className='overflow-hidden rounded-lg bg-white p-3 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full'
                  dangerouslySetInnerHTML={{ __html: c.svg }}
                />
              </div>

              {entregada ? (
                <>
                  <p className='mt-3 font-display font-bold text-lg uppercase text-lime'>
                    Pedido confirmado
                  </p>
                  <p className='mt-1 text-muted-foreground text-sm'>
                    Disfruta, baila y celebra. Con este trago ayudas a reconstruir.
                  </p>
                </>
              ) : (
                <>
                  {/* El codigo tecleable no es un adorno: es el respaldo cuando
                      la camara no enfoca, que en un bar oscuro con la pantalla
                      rayada pasa mas de lo que uno cree. */}
                  <p className='mt-3 font-mono text-2xl tracking-[0.2em]'>
                    {formatearCodigo(c.codigo)}
                  </p>
                  <p className='mt-1 text-muted-foreground text-sm'>
                    Si la cámara no lee, que lo escriban.
                  </p>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {detenido ? (
        <button
          type='button'
          onClick={() => void refetch()}
          className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase'
        >
          Revisar otra vez
        </button>
      ) : null}

      {/* VA DESPUES DEL QR, NO ANTES. Lo que la persona necesita en los
          proximos treinta segundos es el codigo; la cuenta se termina mientras
          espera el trago. Ponerlo arriba seria tapar lo unico urgente con lo
          unico que puede esperar. */}
      {ofrecerCuenta ? (
        <section className='rounded-xl border-2 border-primary bg-primary/5 p-5'>
          <p className='font-display font-bold text-lg'>Termina tu cuenta</p>
          <p className='mt-1 text-body-md text-muted-foreground'>
            Con la cuenta te quedan las fotos de la noche, tus pedidos y la factura del material que
            compramos con esto. Todo en un solo lugar.
          </p>
          <Link
            href={`/register?correo=${encodeURIComponent(correo)}&redirectAfter=${encodeURIComponent(`/orden/${orden.publicToken}`)}`}
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
          {pagaEnBarra ? (
            <>
              Del total de {formatCOP(orden.total)} del pedido:{' '}
              <span className='text-lime'>{formatCOP(totalMaterialAmount)} se van en material</span>
              {totalVenueAmount > 0
                ? `. ${formatCOP(totalVenueAmount)} se quedan en el sitio.`
                : '.'}
            </>
          ) : (
            <>
              <span className='text-lime'>{orden.porcentajeMaterial}% del valor neto</span> se va en
              material después de las deducciones verificadas de la pasarela.{' '}
              {data?.reparto === 'final' || orden.repartoFinal
                ? 'El reparto ya fue reconciliado.'
                : 'El monto exacto sigue pendiente de reconciliación.'}
            </>
          )}
        </p>
        <p className='mt-2 text-muted-foreground text-sm'>
          Guarda este enlace: es tu pedido. También te llegó al correo.
        </p>
        {/* Los 45 dias se dicen ANTES, no cuando ya pasaron (decision 32).
            Enterarse despues de que la plata ya se fue es exactamente la
            sorpresa que este producto no se puede permitir. Y la devolucion
            cuesta escribir un correo a proposito: es la unica parte del
            producto donde la friccion es la funcion. */}
        {pagaEnBarra ? null : (
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
