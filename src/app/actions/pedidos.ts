'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { z } from 'zod'

import { db } from '@/database'
import { orderRedemption, productOrder, venue, venueProduct } from '@/database/schema'
import { auth } from '@/lib/auth/auth'
import { sendPedidoEmail } from '@/lib/messaging/email/mailer'
import { generarCodigo } from '@/lib/comercio/codigos'
import { montosDeOrden } from '@/lib/comercio/dinero'
import { CUENTA, cuentaDePlataforma, publicarMovimiento } from '@/lib/comercio/libro'
import { obtenerPasarela } from '@/lib/comercio/pasarela'
import { productoPublicoPorSlug } from '@/lib/comercio/queries'
import { PAY_METHODS, fechaDeCaducidad } from '@/lib/comercio/types'
import { generarToken } from '@/lib/venues/invitations'

/**
 * Pedir un trago.
 *
 * SE COMPRA SIN CUENTA (decision 29). Nombre y correo, nada mas. Si hay sesion
 * la orden se amarra a ella y sale en /mi-historia, pero un registro con
 * verificacion por correo entre la persona y el trago —parada en una barra, con
 * mala senal y gente esperando— es donde se pierde la venta.
 *
 * TODA ORDEN LLEVA QR, pagada aca o pagada en la barra, y el mesero no puede
 * distinguirlas hasta despues de escanear (decision 26). De ahi sale la unica
 * diferencia real entre los dos caminos en este archivo: cuando se emiten los
 * codigos.
 *
 *   pago en la barra  →  los codigos existen YA, porque el QR tiene que poder
 *                        escanearse para que el mesero sepa que preparar y
 *                        cuanto cobrar. El escaneo es lo que cobra.
 *   pago aca          →  los codigos se emiten cuando el pago confirma. Antes
 *                        de eso no hay nada que entregar.
 */

export type PedidoState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string[]> }
  | { status: 'success'; token: string; url: string }

const MAX_UNIDADES = 20

const pedidoSchema = z.object({
  venueSlug: z.string().min(1),
  productoSlug: z.string().min(1),
  buyerName: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  buyerEmail: z.email('Ese correo no se ve bien'),
  quantity: z.coerce
    .number()
    .int()
    .min(1, 'Al menos uno')
    .max(MAX_UNIDADES, `Máximo ${MAX_UNIDADES} de una`),
  payMethod: z.enum(PAY_METHODS),
  // Solo dice si le OFRECEMOS terminar la cuenta al llegar al QR. No cambia
  // nada del pedido: el pedido se crea igual, con cuenta o sin ella.
  quiereCuenta: z.enum(['0', '1']).optional(),
})

/** Emite una redencion POR UNIDAD y devuelve los codigos en claro.
 *
 *  Una fila por unidad es lo que vuelve estructural el limite: cantidad 3 son 3
 *  codigos, y no existe una cuarta fila que redimir. No es una validacion que
 *  alguien pueda olvidar mas adelante. */
const emitirCodigos = async (orderId: string, cantidad: number, conexion = db) => {
  const codigos = Array.from({ length: cantidad }, () => generarCodigo())

  await conexion.insert(orderRedemption).values(codigos.map((code) => ({ orderId, code })))

  return codigos
}

/**
 * Manda el correo con los codigos, y NUNCA tumba el pedido si falla.
 *
 * Es la diferencia con la invitacion de equipo, donde el correo ES el flujo:
 * aca la persona ya tiene su QR en pantalla y esta parada en la barra. Perder
 * la venta porque el proveedor de correo esta caido seria cambiar un
 * inconveniente por una venta perdida.
 */
const avisarPorCorreo = async (orderId: string, codigos: string[]) => {
  try {
    const [d] = await db
      .select({
        buyerName: productOrder.buyerName,
        buyerEmail: productOrder.buyerEmail,
        quantity: productOrder.quantity,
        totalAmount: productOrder.totalAmount,
        unitDonationAmount: productOrder.unitDonationAmount,
        payMethod: productOrder.payMethod,
        publicToken: productOrder.publicToken,
        producto: venueProduct.name,
        sitio: venue.name,
      })
      .from(productOrder)
      .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
      .innerJoin(venue, eq(productOrder.venueId, venue.id))
      .where(eq(productOrder.id, orderId))
      .limit(1)

    if (!d) return

    const cantidad = Number(d.quantity)
    await sendPedidoEmail({
      to: d.buyerEmail,
      compradorNombre: d.buyerName,
      productoNombre: d.producto,
      venueNombre: d.sitio,
      cantidad,
      total: Number(d.totalAmount),
      material: Number(d.unitDonationAmount) * cantidad,
      pagaEnBarra: d.payMethod === 'bar',
      token: d.publicToken,
      codigos,
    })
  } catch {
    // Se pierde el correo, no el pedido.
  }
}

export const crearPedidoAction = async (
  _previous: PedidoState,
  formData: FormData
): Promise<PedidoState> => {
  const parsed = pedidoSchema.safeParse({
    venueSlug: formData.get('venueSlug'),
    productoSlug: formData.get('productoSlug'),
    buyerName: formData.get('buyerName'),
    buyerEmail: formData.get('buyerEmail'),
    quantity: formData.get('quantity'),
    payMethod: formData.get('payMethod'),
    quiereCuenta: formData.get('quiereCuenta') ?? undefined,
  })

  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }

  // EL PRECIO Y EL REPARTO SALEN DE LA BASE, NUNCA DEL FORMULARIO. Es la misma
  // familia que el venueId de multi-tenencia: si el monto viniera del cliente,
  // cualquiera pediria un trago de treinta mil por mil.
  const producto = await productoPublicoPorSlug(parsed.data.venueSlug, parsed.data.productoSlug)

  // null tambien cuando esta en borrador, en revision, pausado o archivado, o
  // cuando el sitio no esta publicado. Pegarle directo a la URL no sirve de
  // nada: esconder el boton no es la proteccion (decision 31).
  if (!producto) {
    return { status: 'error', error: 'Ese producto ya no se puede pedir.' }
  }

  const montos = montosDeOrden(producto.precio, producto.porcentajeMaterial, parsed.data.quantity)

  // La sesion AGREGA: amarra la orden a la cuenta para que salga en
  // /mi-historia. No hace falta para comprar (decision 2).
  const sesion = await auth.api.getSession({ headers: await headers() })

  const publicToken = generarToken()

  // Se ofrece la cuenta solo si la pidio Y no tiene sesion ya.
  const sufijoDeCuenta = parsed.data.quiereCuenta === '1' && !sesion ? '?cuenta=1' : ''

  try {
    const [orden] = await db
      .insert(productOrder)
      .values({
        productId: producto.id,
        venueId: producto.venueId,
        userId: sesion?.user?.id ?? null,
        buyerName: parsed.data.buyerName,
        buyerEmail: parsed.data.buyerEmail.toLowerCase(),
        quantity: String(parsed.data.quantity),
        unitPrice: montos.unitPrice.toFixed(2),
        donationPercentage: producto.porcentajeMaterial.toFixed(2),
        unitDonationAmount: montos.unitDonationAmount.toFixed(2),
        unitVenueAmount: montos.unitVenueAmount.toFixed(2),
        totalAmount: montos.totalAmount.toFixed(2),
        publicToken,
        payMethod: parsed.data.payMethod,
        expiresAt: fechaDeCaducidad(),
        // status se queda en 'pending'. No se lee del formulario.
      })
      .returning({ id: productOrder.id })

    if (parsed.data.payMethod === 'bar') {
      // El QR tiene que existir ANTES de que se pague: es la comanda, y el
      // escaneo es lo que le dice al mesero cuanto cobrar.
      const codigos = await emitirCodigos(orden.id, parsed.data.quantity)
      await avisarPorCorreo(orden.id, codigos)
      return {
        status: 'success',
        token: publicToken,
        url: `/orden/${publicToken}${sufijoDeCuenta}`,
      }
    }

    const pasarela = obtenerPasarela()
    const intento = await pasarela.crearIntento({
      orderId: orden.id,
      publicToken,
      total: montos.totalAmount,
      currency: 'COP',
      descripcion: `${producto.nombre} · ${producto.venueNombre}`,
      correo: parsed.data.buyerEmail,
      nombre: parsed.data.buyerName,
    })

    if (!intento.ok) {
      return { status: 'error', error: intento.error }
    }

    if (intento.pagadoDeInmediato) {
      await confirmarPago(orden.id, pasarela.nombre, intento.referencia)
    }

    // El proveedor de mentira devuelve a la propia pagina del pedido; una
    // pasarela de verdad devolveria a la suya y volveria despues. En los dos
    // casos la invitacion a terminar la cuenta viaja en la URL de vuelta.
    const destino = intento.url.startsWith('/orden/')
      ? `${intento.url}${sufijoDeCuenta}`
      : intento.url

    return { status: 'success', token: publicToken, url: destino }
  } catch {
    return { status: 'error', error: 'No se pudo crear el pedido. Intenta otra vez.' }
  }
}

/**
 * El pago quedo confirmado: se emiten los codigos y se anota en el libro.
 *
 * Lo llama el proveedor de mentira en el acto y, cuando exista, el webhook de
 * la pasarela de verdad. Es idempotente por dos lados: el `where` sobre
 * `status = 'pending'` y la clave de idempotencia del movimiento. Un webhook
 * que llega dos veces —que llegan— no puede emitir seis codigos para tres
 * tragos ni publicar los asientos dos veces.
 */
export const confirmarPago = async (
  orderId: string,
  provider: string,
  providerReference: string
): Promise<{ ok: boolean; error?: string }> => {
  const [orden] = await db
    .select({
      id: productOrder.id,
      status: productOrder.status,
      quantity: productOrder.quantity,
      totalAmount: productOrder.totalAmount,
    })
    .from(productOrder)
    .where(eq(productOrder.id, orderId))
    .limit(1)

  if (!orden) return { ok: false, error: 'Esa orden no existe.' }
  // Ya estaba pagada: es un reintento del webhook, no un pago nuevo.
  if (orden.status !== 'pending') return { ok: true }

  const cantidad = Number(orden.quantity)
  const total = Number(orden.totalAmount)

  const efectivo = await cuentaDePlataforma(CUENTA.efectivo)
  const porEntregar = await cuentaDePlataforma(CUENTA.porEntregar)

  let codigosEmitidos: string[] = []

  try {
    await db.transaction(async (tx) => {
      const marcada = await tx
        .update(productOrder)
        .set({
          status: 'paid',
          provider,
          providerReference,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        // The status condition is the concurrency gate. Two webhooks can both
        // read `pending` before either transaction writes; without it the
        // second one updates the already-paid row and emits a second batch of
        // redemption codes. Keeping this condition in the SQL statement means
        // exactly one transaction wins after PostgreSQL resolves the row lock.
        .where(and(eq(productOrder.id, orderId), eq(productOrder.status, 'pending')))
        .returning({ id: productOrder.id })

      // Otro proceso la marco entre el select y el update.
      if (marcada.length === 0) return

      codigosEmitidos = await emitirCodigos(orderId, cantidad, tx as unknown as typeof db)

      // Entra plata que TODAVIA NO ES NUESTRA: se reconoce el efectivo y un
      // pasivo igual. Lo pagado y no entregado es custodia, y no se reparte
      // hasta que el trago salga por la barra.
      await publicarMovimiento(
        {
          kind: 'order_paid',
          idempotencyKey: `pago:${orderId}`,
          orderId,
          asientos: [
            { accountId: efectivo, amount: total },
            { accountId: porEntregar, amount: -total },
          ],
        },
        tx as unknown as typeof db
      )
    })

    // Fuera de la transaccion: mandar un correo no puede alargar un bloqueo de
    // base ni deshacer un pago si el proveedor de correo tarda.
    if (codigosEmitidos.length > 0) await avisarPorCorreo(orderId, codigosEmitidos)

    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo confirmar el pago.' }
  }
}
