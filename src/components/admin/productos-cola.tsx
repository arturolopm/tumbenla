import Link from 'next/link'

import {
  ESTADO_LABEL,
  type EstadoDeProducto,
  KIND_LABEL,
  type KindDeProducto,
} from '@/lib/comercio/types'
import { formatCOP, formatDate } from '@/lib/utils/format'

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
  imagenUrl: string | null
  estado: EstadoDeProducto
  creadoEn: string
  venueSlug: string
  venueNombre: string
}

export function ProductosCola({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) {
    return (
      <p className='rounded-xl border border-border border-dashed p-6 text-center text-body-md text-muted-foreground'>
        Todavía no hay productos publicados ni pausados.
      </p>
    )
  }

  return (
    <ul className='flex flex-col gap-4'>
      {productos.map((producto) => (
        <Fila key={producto.id} producto={producto} />
      ))}
    </ul>
  )
}

function Fila({ producto }: { producto: Producto }) {
  return (
    <li className='rounded-xl border border-border bg-card p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex min-w-0 items-start gap-3'>
          {producto.imagenUrl ? (
            <img
              src={producto.imagenUrl}
              alt={`Foto de ${producto.nombre}`}
              className='size-14 shrink-0 rounded-lg border border-border object-cover'
            />
          ) : null}
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
              <span
                className={
                  producto.estado === 'published'
                    ? 'rounded-full border border-lime px-2 py-0.5 text-label-sm text-lime uppercase'
                    : 'rounded-full border border-border px-2 py-0.5 text-label-sm text-muted-foreground uppercase'
                }
              >
                {ESTADO_LABEL[producto.estado]}
              </span>
            </div>
          </div>
        </div>
        <p className='font-display font-black text-2xl'>{formatCOP(producto.precio)}</p>
      </div>

      {producto.descripcion ? (
        <p className='mt-3 text-body-md text-muted-foreground'>{producto.descripcion}</p>
      ) : null}

      <div className='mt-4 rounded-lg border border-lime bg-lime/5 p-4'>
        <p className='font-display text-label-lg uppercase'>Reparto declarado</p>
        <p className='mt-1 text-body-lg'>
          De {formatCOP(producto.precio)}:{' '}
          <strong className='text-lime'>
            {producto.porcentajeMaterial}% ({formatCOP(producto.material)}) van para reconstruir.
          </strong>{' '}
          <span className='text-muted-foreground'>
            {100 - producto.porcentajeMaterial}% ({formatCOP(producto.sitio)}) se quedan en el
            establecimiento.
          </span>
        </p>
        <p className='mt-1 text-muted-foreground text-sm'>
          Creado el {formatDate(new Date(producto.creadoEn))}
        </p>
      </div>
    </li>
  )
}
