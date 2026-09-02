'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState } from 'react'

import { type PedidoState, crearPedidoAction } from '@/app/actions/pedidos'
import { toastManager } from '@/components/ui/toast'
import { KIND_LABEL, type KindDeProducto } from '@/lib/comercio/types'
import { formatCOP } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

/**
 * El pedido.
 *
 * SIN CUENTA: nombre y correo (decision 29). Un registro con verificacion por
 * correo entre la persona y el trago —parada en la barra, con mala señal y
 * gente esperando— es donde se pierde la venta. Con sesion, los dos campos
 * vienen llenos y no hay nada que escribir.
 */

const input =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'

export function FormularioDePedido({
  venueSlug,
  venueNombre,
  producto,
  correoDeLaCuenta,
  nombreDeLaCuenta,
}: {
  venueSlug: string
  venueNombre: string
  producto: {
    slug: string
    nombre: string
    kind: KindDeProducto
    descripcion: string | null
    precio: number
    material: number
    sitio: number
  }
  correoDeLaCuenta: string
  nombreDeLaCuenta: string
}) {
  const router = useRouter()
  const [estado, enviar, enviando] = useActionState<PedidoState, FormData>(crearPedidoAction, {
    status: 'idle',
  })
  const [cantidad, setCantidad] = useState(1)
  const [metodo, setMetodo] = useState<'app' | 'bar'>('app')

  useEffect(() => {
    if (estado.status === 'success') router.push(estado.url)
    if (estado.status === 'error') {
      toastManager.add({ title: 'No se pudo', description: estado.error, type: 'error' })
    }
  }, [estado, router])

  const total = useMemo(() => producto.precio * cantidad, [producto.precio, cantidad])
  const materialTotal = producto.material * cantidad

  const error = (campo: string) =>
    estado.status === 'error' ? estado.fieldErrors?.[campo]?.[0] : undefined

  return (
    <form action={enviar} className='flex flex-col gap-6'>
      <input type='hidden' name='venueSlug' value={venueSlug} />
      <input type='hidden' name='productoSlug' value={producto.slug} />
      <input type='hidden' name='payMethod' value={metodo} />

      <header>
        <Link
          href={`/sitios/${venueSlug}`}
          className='font-display text-label-lg text-primary-text uppercase hover:underline'
        >
          ← {venueNombre}
        </Link>
        <h1 className='mt-2 font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          {producto.nombre}
        </h1>
        <p className='mt-2 text-body-md text-muted-foreground'>
          {KIND_LABEL[producto.kind]}
          {producto.descripcion ? ` · ${producto.descripcion}` : null}
        </p>
      </header>

      <div className='rounded-xl border border-lime bg-lime/5 p-4'>
        <p className='text-body-lg'>
          De {formatCOP(producto.precio)}:{' '}
          <strong className='text-lime'>{formatCOP(producto.material)} se van en material</strong>
          {producto.sitio > 0 ? `. ${formatCOP(producto.sitio)} se quedan en el sitio.` : '.'}
        </p>
      </div>

      <div className='flex flex-col gap-1'>
        <span className='font-display text-label-lg uppercase'>Cuántos</span>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            className='size-11 rounded-lg border border-border font-display text-xl'
            aria-label='Uno menos'
          >
            −
          </button>
          <output className='w-12 text-center font-display font-black text-2xl'>{cantidad}</output>
          <button
            type='button'
            onClick={() => setCantidad((c) => Math.min(20, c + 1))}
            className='size-11 rounded-lg border border-border font-display text-xl'
            aria-label='Uno más'
          >
            +
          </button>
          <input type='hidden' name='quantity' value={cantidad} />
          {cantidad > 1 ? (
            <p className='text-body-md text-muted-foreground'>
              {formatCOP(materialTotal)} en material
            </p>
          ) : null}
        </div>
      </div>

      <fieldset className='flex flex-col gap-1'>
        <legend className='font-display text-label-lg uppercase'>Cómo pagas</legend>
        {/* Los dos caminos llevan QR y el mesero no distingue cual es cual hasta
            despues de escanear (decision 26). Aca solo se escoge donde sale la
            plata; lo que pasa en la barra es identico. */}
        <div className='mt-1 grid gap-3 sm:grid-cols-2'>
          <OpcionDePago
            activa={metodo === 'app'}
            onClick={() => setMetodo('app')}
            titulo='Aquí'
            detalle='Pagas ahora y solo lo recoges.'
          />
          <OpcionDePago
            activa={metodo === 'bar'}
            onClick={() => setMetodo('bar')}
            titulo='En la barra'
            detalle='Pagas allá cuando lo pidas.'
          />
        </div>
      </fieldset>

      <Campo id='buyerName' etiqueta='Tu nombre' error={error('buyerName')} obligatorio>
        <input
          id='buyerName'
          name='buyerName'
          required
          defaultValue={nombreDeLaCuenta}
          autoComplete='name'
          className={input}
        />
      </Campo>

      <Campo
        id='buyerEmail'
        etiqueta='Tu correo'
        error={error('buyerEmail')}
        ayuda='Para mandarte el código, por si cierras la pestaña.'
        obligatorio
      >
        <input
          id='buyerEmail'
          name='buyerEmail'
          type='email'
          required
          defaultValue={correoDeLaCuenta}
          autoComplete='email'
          inputMode='email'
          className={input}
        />
      </Campo>

      <button
        type='submit'
        disabled={enviando}
        className='rounded-xl bg-primary px-6 py-4 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50'
      >
        {enviando
          ? 'Un momento…'
          : metodo === 'app'
            ? `Pagar ${formatCOP(total)}`
            : `Pedirlo · ${formatCOP(total)} en la barra`}
      </button>

      <p className='text-body-md text-muted-foreground'>
        No tienes que crear cuenta. Te sale un código para mostrar en la barra.
      </p>
    </form>
  )
}

function OpcionDePago({
  activa,
  onClick,
  titulo,
  detalle,
}: {
  activa: boolean
  onClick: () => void
  titulo: string
  detalle: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        'rounded-xl border-2 p-4 text-left transition-colors',
        activa ? 'border-lime bg-lime/5' : 'border-border hover:border-party'
      )}
    >
      <span className='block font-display font-bold text-lg'>{titulo}</span>
      <span className='mt-0.5 block text-body-md text-muted-foreground'>{detalle}</span>
    </button>
  )
}

function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  obligatorio,
  children,
}: {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
  obligatorio?: boolean
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1'>
      <label htmlFor={id} className='font-display text-label-lg uppercase'>
        {etiqueta}
        {obligatorio ? <span className='text-primary-text'> *</span> : null}
      </label>
      {ayuda ? <span className='text-muted-foreground text-sm'>{ayuda}</span> : null}
      {children}
      {error ? (
        <span role='alert' className='text-body-sm text-destructive-foreground'>
          {error}
        </span>
      ) : null}
    </div>
  )
}
