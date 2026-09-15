import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { headers } from 'next/headers'

import { PantallaDeOrden } from '@/components/comercio/pantalla-de-orden'
import { auth } from '@/lib/auth/auth'
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

export default async function OrdenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ cuenta?: string }>
}) {
  const { token } = await params
  const { cuenta } = await searchParams
  const orden = await ordenPorToken(token)
  if (!orden) notFound()

  // Si ya entro, no hay nada que ofrecerle.
  const sesion = await auth.api.getSession({ headers: await headers() })

  // El QR lleva una URL y no el codigo pelado: asi un lector cualquiera —el de
  // la camara del telefono, que es lo que va a usar medio mundo— abre la
  // pantalla del escaner con el codigo ya puesto, en vez de mostrar ocho
  // caracteres sueltos que nadie sabe donde meter.
  //
  // getBaseUrl() y no window.location.origin: este enlace se abre desde AFUERA
  // de la app, como los de los correos, asi que va la URL canonica.
  const base = getBaseUrl()
  // Internally there is still one immutable lifecycle unit per drink, but the
  // bar interaction is one order and therefore exposes one code. For an old
  // partially redeemed order, show the first code that is still usable.
  const redencionVisible =
    orden.redenciones.find((redencion) => redencion.estado === 'issued') ?? orden.redenciones[0]
  const codigos = await Promise.all(
    (redencionVisible ? [redencionVisible] : []).map(async (r) => ({
      id: r.id,
      unidadId: r.unidadId,
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
        entregadasIniciales: orden.redenciones.filter(
          (redencion) => redencion.estado === 'redeemed'
        ).length,
        precioUnitario: orden.precioUnitario,
        materialPorUnidad: orden.materialPorUnidad,
        sitioPorUnidad: orden.sitioPorUnidad,
        total: orden.total,
        payMethod: orden.payMethod,
        estado: orden.estado,
        productoNombre: orden.productoNombre,
        productoDescripcion: orden.productoDescripcion,
        porcentajeMaterial: orden.porcentajeMaterial,
        repartoFinal: orden.repartoFinal,
        explicacionDelReparto: orden.explicacionDelReparto,
        venueSlug: orden.venueSlug,
        venueNombre: orden.venueNombre,
      }}
      codigos={codigos}
      ofrecerCuenta={cuenta === '1' && !sesion}
      correo={orden.compradorEmail}
    />
  )
}
