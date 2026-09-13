import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FormularioDePedido } from '@/components/comercio/formulario-de-pedido'
import { auth } from '@/lib/auth/auth'
import { productoPublicoPorSlug } from '@/lib/comercio/queries'
import { headers } from 'next/headers'

/**
 * Pedir un trago.
 *
 * Dinamica porque crea una orden y porque lee la sesion para rellenar el correo.
 * Es la unica pagina de (publico) que no puede ser ISR, y esta bien: solo la
 * abre quien ya decidio pedir.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PedirPage({
  params,
}: {
  params: Promise<{ slug: string; producto: string }>
}) {
  const { slug, producto: productoSlug } = await params

  // notFound() y no un mensaje: un producto en borrador, en revision, pausado o
  // archivado NO EXISTE para el publico. Esconder el boton en la carta no es la
  // proteccion; esto si (decision 31).
  const producto = await productoPublicoPorSlug(slug, productoSlug)
  if (!producto) notFound()

  // La sesion AGREGA: rellena el correo para no escribirlo de pie en un bar.
  // No hace falta para comprar (decisiones 2 y 29).
  const sesion = await auth.api.getSession({ headers: await headers() })

  return (
    <div className='mx-auto max-w-lg px-margin-mobile py-10 lg:px-margin-desktop'>
      <FormularioDePedido
        venueSlug={slug}
        venueNombre={producto.venueNombre}
        producto={{
          slug: producto.slug,
          nombre: producto.nombre,
          kind: producto.kind,
          descripcion: producto.descripcion,
          precio: producto.precio,
          porcentajeMaterial: producto.porcentajeMaterial,
          material: producto.material,
          sitio: producto.sitio,
        }}
        correoDeLaCuenta={sesion?.user?.email ?? ''}
        nombreDeLaCuenta={sesion?.user?.name ?? ''}
        sinSesion={!sesion}
        initialSubmissionKey={crypto.randomUUID()}
      />
    </div>
  )
}
