'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/database'
import { commerceOrderSnapshot, commerceOrderUnit } from '@/database/commerce-schema'
import {
  ledgerTransaction,
  orderRedemption,
  productOrder,
  venue,
  venueProduct,
} from '@/database/schema'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { type MotivoNoRedime, normalizarCodigo } from '@/lib/comercio/codigos'
import { CUENTA, cuentaDePlataforma, cuentaDeSitio, publicarMovimiento } from '@/lib/comercio/libro'
import {
  CommerceUnitService,
  type UnitRedemptionFailure,
} from '@/lib/commerce/unit-lifecycle-service'
import { CommerceRateLimitService } from '@/lib/commerce/rate-limit-service'

const commerceUnits = new CommerceUnitService({ database: db })
const commerceRateLimits = new CommerceRateLimitService({ database: db })

/**
 * Entregar un trago.
 *
 * TODA LA GARANTIA DEL PRODUCTO VIVE EN UNA SOLA SENTENCIA:
 *
 *   update order_redemption set status = 'redeemed', ...
 *    where id = $1 and status = 'issued' returning *;
 *
 * Cero filas de vuelta = ya estaba redimido. NUNCA leer-y-despues-escribir: un
 * `select` para comprobar seguido de un `update` deja ganar a los dos escaneos
 * simultaneos, y la ventana entre los dos es de milisegundos. No se reproduce
 * probando a mano; se reproduce un sabado a las once de la noche.
 *
 * Concurrencia e idempotencia son problemas DISTINTOS y hacen falta los dos. El
 * `update` condicional resuelve dos escaneos a la vez. El mismo escaneo
 * reintentado —el mesero toco dos veces, la red repitio el POST— lo resuelve la
 * clave de idempotencia del movimiento del libro.
 *
 * Y la redencion y sus asientos van en la MISMA transaccion: no puede existir un
 * trago entregado sin su movimiento en el libro.
 */

export type Entrega =
  | {
      ok: true
      /** Lo que el mesero tiene que hacer, y lo unico que decide la pantalla. */
      cobrar: number | null
      producto: string
      cantidadDeLaOrden: number
      entregadas: number
      comprador: string
      /** true cuando este mismo escaneo ya se habia procesado (reintento). */
      repetido: boolean
    }
  | { ok: false; motivo: MotivoNoRedime | 'sin_permiso'; error: string }

/**
 * Busca el codigo y trae TODO lo que hace falta para decidir, incluido el
 * venueId de la ORDEN.
 *
 * Ese venueId es el que manda. El que viene de la URL del panel sirve para
 * pintar la pantalla y para nada mas: si se comprobara contra el, el personal
 * del bar A entregaria —y cobraria— pedidos del bar B abriendo su propio panel
 * con un codigo ajeno.
 */
const buscarCodigo = async (codigo: string) => {
  const [fila] = await db
    .select({
      redencionId: orderRedemption.id,
      estadoRedencion: orderRedemption.status,
      orderId: productOrder.id,
      venueId: productOrder.venueId,
      venueSlug: venue.slug,
      estadoOrden: productOrder.status,
      payMethod: productOrder.payMethod,
      quantity: productOrder.quantity,
      unitPrice: productOrder.unitPrice,
      unitDonationAmount: productOrder.unitDonationAmount,
      unitVenueAmount: productOrder.unitVenueAmount,
      buyerName: productOrder.buyerName,
      producto: venueProduct.name,
      fundingClassification: commerceOrderSnapshot.fundingClassification,
    })
    .from(orderRedemption)
    .innerJoin(productOrder, eq(orderRedemption.orderId, productOrder.id))
    .innerJoin(venue, eq(productOrder.venueId, venue.id))
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .leftJoin(commerceOrderUnit, eq(commerceOrderUnit.redemptionId, orderRedemption.id))
    .leftJoin(
      commerceOrderSnapshot,
      eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
    )
    .where(eq(orderRedemption.code, codigo))
    .limit(1)

  return fila ?? null
}

const contarEntregadas = async (orderId: string) => {
  const [fila] = await db
    .select({ n: sql<string>`count(*) filter (where ${orderRedemption.status} = 'redeemed')` })
    .from(orderRedemption)
    .where(eq(orderRedemption.orderId, orderId))
  return Number(fila?.n ?? 0)
}

export const redimirAction = async (
  codigoCrudo: string,
  venueIdDeLaPantalla: string,
  idempotencyKey: string
): Promise<Entrega> => {
  const codigo = normalizarCodigo(codigoCrudo)
  if (codigo.length !== 8) {
    return { ok: false, motivo: 'no_existe', error: 'Ese código no existe. Revísalo.' }
  }

  // Authenticate the panel venue before looking up the code. Otherwise a
  // guessed valid code returned a different error and became an oracle.
  const acceso = await assertVenueAccess(venueIdDeLaPantalla)
  if (!acceso.ok) return { ok: false, motivo: 'sin_permiso', error: acceso.error }
  const rate = await commerceRateLimits.consume({
    scope: 'scanner',
    key: `${acceso.acceso.userId}:${venueIdDeLaPantalla}`,
    limit: 90,
    windowSeconds: 60,
  })
  if (!rate.allowed) {
    return {
      ok: false,
      motivo: 'no_existe',
      error: 'Hay demasiados intentos seguidos. Espera un minuto antes de continuar.',
    }
  }

  const fila = await buscarCodigo(codigo)
  if (!fila) {
    return { ok: false, motivo: 'no_existe', error: 'Ese código no existe. Revísalo.' }
  }

  // Y ademas el codigo tiene que ser de ESTE sitio. Sin esto, alguien con
  // permiso en dos sitios entregaria en el equivocado por error, y el saldo se
  // le anotaria al que no fue.
  if (fila.venueId !== venueIdDeLaPantalla) {
    return { ok: false, motivo: 'no_existe', error: 'Ese código no existe. Revísalo.' }
  }

  if (fila.fundingClassification === 'real' || fila.fundingClassification === 'sandbox') {
    const result = await commerceUnits.redeem({
      code: codigo,
      expectedVenueId: venueIdDeLaPantalla,
      actorUserId: acceso.acceso.userId,
      actorIsPlatform: acceso.acceso.esPlataforma,
      operationKey: `redeem:${fila.redencionId}:${idempotencyKey}`,
    })
    if (result.kind === 'rejected') return unitFailure(result.reason)

    revalidatePath(`/panel/${result.venueSlug}/cuenta`)
    return {
      ok: true,
      cobrar: result.collectMinor === null ? null : Number(result.collectMinor) / 100,
      producto: result.productName,
      cantidadDeLaOrden: result.quantity,
      entregadas: result.redeemedCount,
      comprador: result.buyerName,
      repetido: result.duplicate,
    }
  }

  // NO se corta aca cuando ya esta 'redeemed', aunque seria el atajo obvio.
  // Esa lectura no distingue "otro lo entrego" de "es mi propio reintento", y
  // cortando aca el reintento nunca llega a mirar la clave de idempotencia: el
  // mesero que acaba de escanear bien y toco dos veces se lleva un "ya se
  // entregó" en la cara. La unica que decide es la transaccion de abajo.
  if (fila.estadoRedencion === 'void') {
    return { ok: false, motivo: 'anulado', error: 'Ese código fue anulado.' }
  }
  if (fila.estadoOrden === 'expired') {
    return { ok: false, motivo: 'orden_caducada', error: 'Ese pedido ya caducó.' }
  }
  if (fila.estadoOrden === 'cancelled' || fila.estadoOrden === 'refunded') {
    return { ok: false, motivo: 'orden_sin_pagar', error: 'Ese pedido está cancelado.' }
  }

  const pagaEnBarra = fila.payMethod === 'bar'
  const unitPrice = Number(fila.unitPrice)
  const material = Number(fila.unitDonationAmount)
  const delSitio = Number(fila.unitVenueAmount)

  const cuentaMaterial = await cuentaDePlataforma(CUENTA.material)
  const cuentaPorEntregar = await cuentaDePlataforma(CUENTA.porEntregar)
  const cuentaDelSitio = await cuentaDeSitio(fila.venueId)

  let gano = false
  let esMiReintento = false

  // La clave que identifica ESTE intento de escaneo, no ese codigo en general.
  const claveDelMovimiento = `entrega:${fila.redencionId}:${idempotencyKey}`

  try {
    await db.transaction(async (tx) => {
      // LA SENTENCIA. La condicion va adentro; no hay select previo.
      const redimidas = await tx
        .update(orderRedemption)
        .set({
          status: 'redeemed',
          redeemedAt: new Date(),
          redeemedByUserId: acceso.acceso.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(orderRedemption.id, fila.redencionId), eq(orderRedemption.status, 'issued')))
        .returning({ id: orderRedemption.id })

      if (redimidas.length === 0) {
        // Cero filas dice que ya estaba redimido, pero NO dice por quien. Hay
        // dos casos distintos detras y confundirlos es el bug:
        //
        //   otro escaneo gano   → es un doble cobro y tiene que fallar.
        //   MI PROPIO REINTENTO → el mesero toco dos veces o la red repitio el
        //                         POST, y tiene que salir igual de bien, o le
        //                         pintamos "ya se entregó" a quien acaba de
        //                         escanear bien, en plena barra.
        //
        // Los separa la clave de idempotencia: si ya hay un movimiento con
        // ESTA clave, el que entrego fui yo.
        const previa = await tx
          .select({ id: ledgerTransaction.id })
          .from(ledgerTransaction)
          .where(eq(ledgerTransaction.idempotencyKey, claveDelMovimiento))
          .limit(1)

        esMiReintento = previa.length > 0
        return
      }

      gano = true

      // Los asientos, por UNIDAD.
      //
      //   pagado aca     la custodia se extingue y se reparte: parte a material
      //                  y parte queda a favor del sitio (le debemos).
      //   pagado en barra el sitio cobro todo, asi que nos queda debiendo la
      //                  parte de material. Su parte ya la tiene en la caja.
      const asientos = pagaEnBarra
        ? [
            { accountId: cuentaDelSitio, amount: material },
            { accountId: cuentaMaterial, amount: -material },
          ]
        : [
            { accountId: cuentaPorEntregar, amount: unitPrice },
            { accountId: cuentaMaterial, amount: -material },
            // Con un reparto del 100% el sitio no se queda con nada y no hay
            // tercer asiento: `material` ya vale `unitPrice`, asi que los dos
            // de arriba suman cero solos.
            ...(delSitio > 0 ? [{ accountId: cuentaDelSitio, amount: -delSitio }] : []),
          ]

      const movimiento = await publicarMovimiento(
        {
          kind: 'redeemed',
          idempotencyKey: claveDelMovimiento,
          orderId: fila.orderId,
          createdByUserId: acceso.acceso.userId,
          asientos,
        },
        tx as unknown as typeof db
      )

      if (!movimiento.ok) {
        // Revienta la transaccion entera: sin asiento no puede quedar entregado.
        throw new Error(movimiento.error)
      }

      // Pagando en la barra, la plata entra al cobrar, y cobrar es esto. La
      // orden queda pagada cuando ya no queda nada por entregar.
      if (pagaEnBarra) {
        const [{ pendientes }] = await tx
          .select({
            pendientes: sql<string>`count(*) filter (where ${orderRedemption.status} = 'issued')`,
          })
          .from(orderRedemption)
          .where(eq(orderRedemption.orderId, fila.orderId))

        if (Number(pendientes) === 0) {
          await tx
            .update(productOrder)
            .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
            .where(eq(productOrder.id, fila.orderId))
        }
      }
    })
  } catch {
    return { ok: false, motivo: 'no_existe', error: 'No se pudo entregar. Intenta otra vez.' }
  }

  if (!gano && !esMiReintento) {
    return { ok: false, motivo: 'ya_redimido', error: 'Ese trago ya se entregó.' }
  }

  revalidatePath(`/panel/${fila.venueSlug}/cuenta`)

  return {
    ok: true,
    // LO UNICO QUE LA PANTALLA TIENE QUE DECIR. Y solo se sabe DESPUES de
    // escanear: si el mesero pudiera saberlo antes, sabria cuales puede dejar
    // sin escanear, y ahi se cae el mecanismo entero (decision 26).
    cobrar: pagaEnBarra ? unitPrice : null,
    producto: fila.producto,
    cantidadDeLaOrden: Number(fila.quantity),
    entregadas: await contarEntregadas(fila.orderId),
    comprador: fila.buyerName,
    repetido: esMiReintento,
  }
}

const unitFailure = (reason: UnitRedemptionFailure): Extract<Entrega, { ok: false }> => {
  if (reason === 'unauthorized') {
    return { ok: false, motivo: 'sin_permiso', error: 'No perteneces a este sitio.' }
  }
  if (reason === 'wrong_venue') {
    return { ok: false, motivo: 'otro_sitio', error: 'Ese código no es de este sitio.' }
  }
  if (reason === 'expired') {
    return { ok: false, motivo: 'orden_caducada', error: 'Ese pedido ya caducó.' }
  }
  if (reason === 'refund_reserved' || reason === 'unpaid') {
    return { ok: false, motivo: 'orden_sin_pagar', error: 'Ese pedido está cancelado.' }
  }
  if (reason === 'void') {
    return { ok: false, motivo: 'anulado', error: 'Ese código fue anulado.' }
  }
  if (reason === 'already_redeemed') {
    return { ok: false, motivo: 'ya_redimido', error: 'Ese trago ya se entregó.' }
  }
  return { ok: false, motivo: 'no_existe', error: 'No se pudo entregar. Intenta otra vez.' }
}
