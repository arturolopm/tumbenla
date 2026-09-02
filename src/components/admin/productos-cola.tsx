'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { type CartaState, revisarProductoAction } from '@/app/actions/carta'
import { toastManager } from '@/components/ui/toast'
import {
  ESTADO_LABEL,
  type EstadoDeProducto,
  KIND_LABEL,
  type KindDeProducto,
} from '@/lib/comercio/types'
import { formatCOP, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

type Producto = {
  id: string
  slug: string
  nombre: string
  kind: KindDeProducto
  descripcion: string | null
  precio: number
  porcentajeMaterial: number
  material: number
  sitio: number
  estado: EstadoDeProducto
  creadoEn: string
  venueSlug: string
  venueNombre: string
}

export function ProductosCola({ productos }: { productos: Producto[] }) {
  const porRevisar = productos.filter((p) => p.estado === 'pending_review')
  const resueltos = productos.filter((p) => p.estado !== 'pending_review')

  return (
    <div className='flex flex-col gap-10'>
      <section>
        <h2 className='font-display text-label-lg uppercase'>Esperando ({porRevisar.length})</h2>
        {porRevisar.length === 0 ? (
          <p className='mt-3 rounded-xl border border-border border-dashed p-6 text-center text-body-md text-muted-foreground'>
            No hay nada esperando.
          </p>
        ) : (
          <ul className='mt-3 flex flex-col gap-4'>
            {porRevisar.map((p) => (
              <Fila key={p.id} producto={p} revisable />
            ))}
          </ul>
        )}
      </section>

      {resueltos.length > 0 ? (
        <section>
          <h2 className='font-display text-label-lg uppercase text-muted-foreground'>
            Ya a la venta ({resueltos.length})
          </h2>
          <ul className='mt-3 flex flex-col gap-4'>
            {resueltos.map((p) => (
              <Fila key={p.id} producto={p} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Fila({ producto, revisable }: { producto: Producto; revisable?: boolean }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [nota, setNota] = useState('')

  const decidir = (decision: 'published' | 'rejected') => {
    // Rechazar sin decir por que deja al sitio adivinando que corregir, y la
    // nota es lo unico que va a leer. Publicar no la necesita.
    if (decision === 'rejected' && nota.trim().length < 3) {
      toastManager.add({
        title: 'Falta la nota',
        description: 'Escribe qué tiene que corregir el sitio; es lo único que va a leer.',
        type: 'error',
      })
      return
    }

    startTransition(async () => {
      const r: CartaState = await revisarProductoAction(producto.id, decision, nota)
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        setNota('')
        router.refresh()
      }
      if (r.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: r.error, type: 'error' })
      }
    })
  }

  return (
    <li className='rounded-xl border border-border bg-card p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <Link
            href={`/sitios/${producto.venueSlug}`}
            className='font-display text-label-lg text-primary-text uppercase hover:underline'
          >
            {producto.venueNombre}
          </Link>
          <div className='mt-1 flex flex-wrap items-center gap-2'>
            <h3 className='font-display font-bold text-lg'>{producto.nombre}</h3>
            <span className='rounded-full border border-border px-2 py-0.5 text-label-sm uppercase'>
              {KIND_LABEL[producto.kind]}
            </span>
            {!revisable ? (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-label-sm uppercase',
                  producto.estado === 'published'
                    ? 'border-lime text-lime'
                    : 'border-border text-muted-foreground'
                )}
              >
                {ESTADO_LABEL[producto.estado]}
              </span>
            ) : null}
          </div>
        </div>
        <p className='font-display font-black text-2xl'>{formatCOP(producto.precio)}</p>
      </div>

      {producto.descripcion ? (
        <p className='mt-3 text-body-md text-muted-foreground'>{producto.descripcion}</p>
      ) : null}

      {/* Lo que de verdad se esta aprobando, en pesos y grande. El porcentaje
          suelto se lee por encima; los pesos no. */}
      <div className='mt-4 rounded-lg border border-lime bg-lime/5 p-4'>
        <p className='font-display text-label-lg uppercase'>El reparto que se aprueba</p>
        <p className='mt-1 text-body-lg'>
          De {formatCOP(producto.precio)}:{' '}
          <strong className='text-lime'>{formatCOP(producto.material)} en material</strong>
          {producto.sitio > 0 ? `, ${formatCOP(producto.sitio)} se quedan en el sitio.` : '.'}
        </p>
        <p className='mt-1 text-muted-foreground text-sm'>
          {producto.porcentajeMaterial}% · creado el {formatDate(new Date(producto.creadoEn))}
        </p>
      </div>

      {revisable ? (
        <div className='mt-4 flex flex-col gap-3'>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder='Qué le decimos al sitio (obligatorio si lo devuelves)'
            className='w-full rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'
          />
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => decidir('published')}
              disabled={pendiente}
              className='rounded-lg bg-lime px-4 py-2 font-display text-label-lg text-background uppercase disabled:opacity-50'
            >
              Publicar
            </button>
            <button
              type='button'
              onClick={() => decidir('rejected')}
              disabled={pendiente}
              className='rounded-lg border border-destructive px-4 py-2 font-display text-label-lg uppercase text-destructive-foreground disabled:opacity-50'
            >
              Devolver al sitio
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
