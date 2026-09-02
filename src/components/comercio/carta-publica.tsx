import Link from 'next/link'

import { KIND_LABEL, type KindDeProducto } from '@/lib/comercio/types'
import { formatCOP } from '@/lib/utils/format'

/**
 * La carta, en la pagina publica del sitio.
 *
 * COMPONENTE DE SERVIDOR, sin `use client`: no tiene estado y el boton de pedir
 * es un enlace de verdad a una ruta dinamica. Asi la pagina del sitio conserva
 * su ISR, que es de lo que depende que la base duerma.
 *
 * El reparto va EN PESOS y no en porcentaje (VOZ.md, decisiones 16 y 30): el
 * porcentaje es abstracto y los pesos se verifican despues contra la factura
 * que se publica en /transparencia. Y no se dice "dona" en ninguna parte.
 */

type Producto = {
  id: string
  slug: string
  nombre: string
  kind: KindDeProducto
  descripcion: string | null
  precio: number
  material: number
  sitio: number
}

export function CartaPublica({ slug, productos }: { slug: string; productos: Producto[] }) {
  return (
    <section className='mt-10'>
      <h2 className='font-display font-extrabold text-headline-md uppercase'>Pide y suma</h2>
      <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
        Sale como cualquier trago de la carta. La diferencia está escrita abajo de cada uno.
      </p>

      <ul className='mt-6 grid gap-4 sm:grid-cols-2'>
        {productos.map((p) => (
          <li key={p.id}>
            <Link
              href={`/sitios/${slug}/pedir/${p.slug}`}
              className='group flex h-full flex-col rounded-xl border-2 border-border bg-card p-5 transition-colors hover:border-party'
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <h3 className='font-display font-bold text-lg'>{p.nombre}</h3>
                  <p className='mt-0.5 text-label-sm text-muted-foreground uppercase'>
                    {KIND_LABEL[p.kind]}
                  </p>
                </div>
                <p className='whitespace-nowrap font-display font-black text-xl'>
                  {formatCOP(p.precio)}
                </p>
              </div>

              {p.descripcion ? (
                <p className='mt-3 text-body-md text-muted-foreground'>{p.descripcion}</p>
              ) : null}

              <p className='mt-4 border-border border-t pt-3 text-body-md'>
                <span className='text-lime'>{formatCOP(p.material)} se van en material</span>
                {p.sitio > 0 ? (
                  <span className='text-muted-foreground'>
                    {' · '}
                    {formatCOP(p.sitio)} se quedan acá
                  </span>
                ) : null}
              </p>

              <span className='mt-4 font-display text-label-lg text-primary-text uppercase group-hover:underline'>
                Pedirlo →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
