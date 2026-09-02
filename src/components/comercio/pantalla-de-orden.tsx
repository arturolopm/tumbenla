'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

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

type Codigo = { id: string; codigo: string; estado: string; redimidaEn: string | null; svg: string }

type Orden = {
  publicToken: string
  compradorNombre: string
  cantidad: number
  precioUnitario: number
  materialPorUnidad: number
  sitioPorUnidad: number
  total: number
  payMethod: PayMethod
  estado: string
  productoNombre: string
  productoDescripcion: string | null
  venueSlug: string
  venueNombre: string
}

/**
 * La cadencia del sondeo.
 *
 * El escaneo pasa casi siempre en el primer minuto —la persona ya esta parada
 * en la barra— y despues la pantalla solo espera. Un segundo fijo durante quince
 * minutos serian mil peticiones por una que importa; un tick lento se siente
 * roto justo en el momento que decide todo.
 */
const CADENCIA = [
  { hasta: 90_000, cada: 1_000 },
  { hasta: 300_000, cada: 3_000 },
  { hasta: 900_000, cada: 10_000 },
] as const

const intervaloPara = (transcurrido: number): number | null =>
  CADENCIA.find((t) => transcurrido < t.hasta)?.cada ?? null

export function PantallaDeOrden({ orden, codigos }: { orden: Orden; codigos: Codigo[] }) {
  const [estado, setEstado] = useState<Codigo[]>(codigos)
  const [entregadas, setEntregadas] = useState(
    codigos.filter((c) => c.estado === 'redeemed').length
  )
  const [parado, setParado] = useState(false)
  const desde = useRef(Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const todasEntregadas = entregadas >= orden.cantidad

  const consultar = useCallback(async () => {
    try {
      const r = await fetch(`/api/orden/${orden.publicToken}/estado`, { cache: 'no-store' })
      if (!r.ok) return
      const datos = (await r.json()) as { entregadas: number; estado: string }
      setEntregadas(datos.entregadas)
      if (datos.entregadas > 0) {
        // Se marcan en orden: la respuesta barata solo trae CUANTAS, no cuales,
        // y para lo que la pantalla tiene que decir alcanza.
        setEstado((previo) =>
          previo.map((c, i) => (i < datos.entregadas ? { ...c, estado: 'redeemed' } : c))
        )
      }
    } catch {
      // Sin senal en un sotano. Se reintenta en el siguiente tick y no se le
      // pinta un error a alguien que no puede hacer nada al respecto.
    }
  }, [orden.publicToken])

  useEffect(() => {
    if (todasEntregadas || parado) return

    const programar = () => {
      const transcurrido = Date.now() - desde.current
      const cada = intervaloPara(transcurrido)
      if (cada === null) {
        setParado(true)
        return
      }
      timer.current = setTimeout(async () => {
        // Con la pantalla apagada o la pestaña en segundo plano no se consulta:
        // nadie esta mirando y el telefono esta en un bolsillo.
        if (document.visibilityState === 'visible') await consultar()
        programar()
      }, cada)
    }

    programar()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [consultar, todasEntregadas, parado])

  // Al volver a la pantalla se consulta DE UNA. Si el telefono se atenuo
  // mientras el mesero escaneaba, al prenderlo tiene que decir "listo" sin
  // esperar el siguiente tick, que es justo cuando la persona esta mirando.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && !todasEntregadas) void consultar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [consultar, todasEntregadas])

  const pagaEnBarra = orden.payMethod === 'bar'

  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-margin-mobile py-10'>
      <header>
        <Link
          href={`/sitios/${orden.venueSlug}`}
          className='font-display text-label-lg text-primary-text uppercase hover:underline'
        >
          {orden.venueNombre}
        </Link>
        <h1 className='mt-1 font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          {orden.productoNombre}
        </h1>
        <p className='mt-2 text-body-md text-muted-foreground'>
          {orden.cantidad > 1 ? `${orden.cantidad} · ` : null}
          {formatCOP(orden.total)} · {PAY_METHOD_LABEL[orden.payMethod]}
        </p>
      </header>

      {todasEntregadas ? (
        <div className='rounded-xl border-2 border-lime bg-lime/10 p-5 text-center'>
          <p className='font-display font-black text-2xl uppercase text-lime'>Listo</p>
          <p className='mt-1 text-body-md'>
            {orden.cantidad > 1 ? 'Te los entregaron.' : 'Te lo entregaron.'} Salud.
          </p>
        </div>
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
        {estado.map((c, i) => {
          const entregada = c.estado === 'redeemed'
          return (
            <li
              key={c.id}
              className={cn(
                'rounded-xl border p-5 text-center transition-colors',
                entregada ? 'border-lime bg-lime/5' : 'border-border bg-card'
              )}
            >
              {estado.length > 1 ? (
                <p className='mb-3 font-display text-label-lg uppercase text-muted-foreground'>
                  {i + 1} de {estado.length}
                </p>
              ) : null}

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
                <p className='mt-3 font-display font-bold text-lg uppercase text-lime'>Entregado</p>
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

      {parado && !todasEntregadas ? (
        <button
          type='button'
          onClick={() => {
            desde.current = Date.now()
            setParado(false)
            void consultar()
          }}
          className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase'
        >
          Revisar otra vez
        </button>
      ) : null}

      <footer className='mt-2 rounded-xl border border-border p-5'>
        <p className='font-display text-label-lg uppercase'>A dónde va</p>
        <p className='mt-1 text-body-md'>
          De {formatCOP(orden.precioUnitario)}:{' '}
          <span className='text-lime'>{formatCOP(orden.materialPorUnidad)} se van en material</span>
          {orden.sitioPorUnidad > 0
            ? `. ${formatCOP(orden.sitioPorUnidad)} se quedan en el sitio.`
            : '.'}
        </p>
        <p className='mt-2 text-muted-foreground text-sm'>
          Guarda este enlace: es tu pedido. También te llegó al correo.
        </p>
        {/* Los 45 dias se dicen ANTES, no cuando ya pasaron (decision 32).
            Enterarse despues de que la plata ya se fue es exactamente la
            sorpresa que este producto no se puede permitir. Y la devolucion
            cuesta escribir un correo a proposito: es la unica parte del
            producto donde la friccion es la funcion. */}
        <p className='mt-2 text-muted-foreground text-sm'>
          Si no lo reclamas en 45 días, esa plata se va toda en material. Si prefieres que te la
          devolvamos, escríbenos a{' '}
          <a href='mailto:hola@tumbenla.com' className='text-primary-text underline'>
            hola@tumbenla.com
          </a>{' '}
          y lo hacemos.
        </p>
      </footer>
    </main>
  )
}
