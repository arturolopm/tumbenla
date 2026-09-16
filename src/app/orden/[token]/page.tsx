import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { headers } from 'next/headers'

import { CustomerOrderScreen } from '@/components/commerce/customer-order-screen'
import { auth } from '@/lib/auth/auth'
import { svgDelCodigo as generateQrSvg } from '@/lib/comercio/qr'
import { getCustomerOrderByToken } from '@/lib/commerce/customer-order-view'
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

export default async function CustomerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ cuenta?: string }>
}) {
  const { token } = await params
  const { cuenta } = await searchParams
  const order = await getCustomerOrderByToken(token)
  if (!order) notFound()

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
  const visibleUnit =
    order.units.find((unit) => unit.status === 'issued' && unit.redemptionCode) ??
    order.units.find((unit) => unit.redemptionCode)
  const displayCode = visibleUnit?.redemptionCode
    ? {
        redemptionId: visibleUnit.redemptionId ?? visibleUnit.id,
        unitId: visibleUnit.id,
        status: visibleUnit.status,
        redeemedAt: visibleUnit.redeemedAt?.toISOString() ?? null,
        code: visibleUnit.redemptionCode,
        svg: await generateQrSvg(
          `${base}/panel/${order.venueSlug}/escanear?c=${visibleUnit.redemptionCode}`
        ),
      }
    : null

  // Se le pasa al cliente SOLO lo que pinta. El correo del comprador, los ids
  // internos y las fechas que no se muestran se quedan en el servidor: todo lo
  // que cruce va al HTML, y esta pagina es un enlace al portador.
  return (
    <CustomerOrderScreen
      order={{
        publicToken: order.publicToken,
        buyerName: order.buyerName,
        totalUnits: order.totalUnits,
        totalAmount: order.totalAmount,
        donationAmount: order.donationAmount,
        venueAmount: order.venueAmount,
        payMethod: order.payMethod,
        status: order.status,
        lines: order.lines.map((line) => ({
          productOrderId: line.productOrderId,
          productName: line.productName,
          productKind: line.productKind,
          quantity: line.quantity,
          donationPercentage: line.donationPercentage,
        })),
        units: order.units.map((unit) => ({
          id: unit.id,
          redemptionId: unit.redemptionId,
          status: unit.status,
          expiresAt: unit.expiresAt?.toISOString() ?? null,
          redeemedAt: unit.redeemedAt?.toISOString() ?? null,
        })),
        allocationFinal: order.allocationFinal,
        allocationExplanation: order.allocationExplanation,
        venueSlug: order.venueSlug,
        venueName: order.venueName,
      }}
      displayCode={displayCode}
      offerAccount={cuenta === '1' && !sesion}
      email={order.buyerEmail}
    />
  )
}
