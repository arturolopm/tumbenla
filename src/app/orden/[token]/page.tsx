import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PantallaDeOrden } from '@/components/comercio/pantalla-de-orden'
import { ordenPorToken } from '@/lib/comercio/queries'
import { svgDelCodigo } from '@/lib/comercio/qr'
import { getBaseUrl } from '@/lib/utils/urls'

/**
 * El QR. La unica pantalla del producto que se abre de pie, en un bar, con
 * gente esperando.
 *
 * `noindex` y dinamica: es un enlace al portador. Quien tenga la URL puede leer
 * los codigos, asi que no puede quedar en cache compartida ni en un buscador.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tu pedido',
  robots: { index: false, follow: false },
}

export default async function OrdenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const orden = await ordenPorToken(token)
  if (!orden) notFound()

  // El QR lleva una URL y no el codigo pelado: asi un lector cualquiera —el de
  // la camara del telefono, que es lo que va a usar medio mundo— abre la
  // pantalla del escaner con el codigo ya puesto, en vez de mostrar ocho
  // caracteres sueltos que nadie sabe donde meter.
  //
  // getBaseUrl() y no window.location.origin: este enlace se abre desde AFUERA
  // de la app, como los de los correos, asi que va la URL canonica.
  const base = getBaseUrl()
  const codigos = await Promise.all(
    orden.redenciones.map(async (r) => ({
      id: r.id,
      estado: r.estado,
      redimidaEn: r.redimidaEn?.toISOString() ?? null,
      codigo: r.codigo,
      svg: await svgDelCodigo(`${base}/panel/${orden.venueSlug}/escanear?c=${r.codigo}`),
    }))
  )

  // Se le pasa al cliente SOLO lo que pinta. El correo del comprador, los ids
  // internos y las fechas que no se muestran se quedan en el servidor: todo lo
  // que cruce va al HTML, y esta pagina es un enlace al portador.
  return (
    <PantallaDeOrden
      orden={{
        publicToken: orden.publicToken,
        compradorNombre: orden.compradorNombre,
        cantidad: orden.cantidad,
        precioUnitario: orden.precioUnitario,
        materialPorUnidad: orden.materialPorUnidad,
        sitioPorUnidad: orden.sitioPorUnidad,
        total: orden.total,
        payMethod: orden.payMethod,
        estado: orden.estado,
        productoNombre: orden.productoNombre,
        productoDescripcion: orden.productoDescripcion,
        venueSlug: orden.venueSlug,
        venueNombre: orden.venueNombre,
      }}
      codigos={codigos}
    />
  )
}
