'use server'

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import {
  ledgerAccount,
  ledgerEntry,
  ledgerTransaction,
  orderRedemption,
  productOrder,
  venue,
  venueContribution,
  venueSettlement,
} from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { CUENTA, cuentaDePlataforma, cuentaDeSitio, publicarMovimiento } from '@/lib/comercio/libro'

/**
 * Liquidar: mover de verdad la diferencia.
 *
 * ACUMULAR Y PAGAR SON ACTOS DISTINTOS. El libro acumula solo, trago a trago,
 * en la cuenta `venue_current` del sitio; liquidar es el acto aparte que lo
 * salda. Por eso esto escribe una transaccion NUEVA y no toca ni un asiento de
 * los que ya estaban: una correccion en un libro es siempre un asiento que
 * compensa, nunca una edicion.
 *
 * SOLO LA PLATAFORMA. Un sitio no declara que ya le pagamos ni que ya nos pago.
 *
 * Y AQUI SE CIERRA EL CIRCULO CON LO QUE YA EXISTIA: la parte de material que
 * se salda se convierte en un `venue_contribution` verificado, para que
 * /transparencia, getVerifiedTotal() y la pagina del sitio sigan respondiendo
 * la misma pregunta —cuanto ha puesto este sitio en material— sin enterarse de
 * que hay maquinaria nueva detras. Liquidar ES el acto de verificacion, con lo
 * que la decision 19 se conserva en vez de esquivarse.
 */

export type LiquidacionState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; mensaje: string }

const liquidarSchema = z.object({
  venueId: z.string().min(1),
  // En pesos enteros y siempre positivo: la direccion la decide el saldo, no un
  // signo que alguien pueda escribir al reves.
  monto: z.coerce.number().int().positive('El monto tiene que ser mayor que cero'),
  metodo: z.enum(['transferencia', 'efectivo', 'otro']).optional(),
  referencia: z.string().trim().max(120).optional(),
  nota: z.string().trim().max(500).optional(),
})

const saldoActual = async (venueId: string) => {
  const [fila] = await db
    .select({ saldo: sql<string>`coalesce(sum(${ledgerEntry.amount}), 0)` })
    .from(ledgerEntry)
    .innerJoin(ledgerAccount, eq(ledgerAccount.id, ledgerEntry.accountId))
    .where(and(eq(ledgerAccount.kind, CUENTA.sitio), eq(ledgerAccount.venueId, venueId)))
  return Number(fila?.saldo ?? 0)
}

export const liquidarAction = async (
  _previous: LiquidacionState,
  formData: FormData
): Promise<LiquidacionState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const parsed = liquidarSchema.safeParse({
    venueId: formData.get('venueId'),
    monto: formData.get('monto'),
    metodo: formData.get('metodo') || undefined,
    referencia: formData.get('referencia') || undefined,
    nota: formData.get('nota') || undefined,
  })

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const [sitio] = await db
    .select({ id: venue.id, slug: venue.slug })
    .from(venue)
    .where(eq(venue.id, parsed.data.venueId))
    .limit(1)

  if (!sitio) return { status: 'error', error: 'Ese sitio ya no existe.' }

  const saldo = await saldoActual(sitio.id)
  if (saldo === 0) return { status: 'error', error: 'Ese sitio no debe ni se le debe nada.' }

  const monto = parsed.data.monto
  if (monto > Math.abs(saldo)) {
    return {
      status: 'error',
      error: `El saldo es de ${Math.abs(saldo)}. No se puede liquidar mas que eso.`,
    }
  }

  // La direccion sale del SIGNO DEL SALDO, no de lo que se escriba: positivo
  // quiere decir que el sitio nos debe, asi que la plata viene de alla.
  const direccion = saldo > 0 ? 'from_venue' : 'to_venue'

  const cuentaEfectivo = await cuentaDePlataforma(CUENTA.efectivo)
  const cuentaDelSitio = await cuentaDeSitio(sitio.id)

  try {
    await db.transaction(async (tx) => {
      const [liq] = await tx
        .insert(venueSettlement)
        .values({
          venueId: sitio.id,
          amount: monto.toFixed(2),
          direction: direccion,
          method: parsed.data.metodo ?? null,
          reference: parsed.data.referencia ?? null,
          note: parsed.data.nota ?? null,
          settledByUserId: admin.userId,
        })
        .returning({ id: venueSettlement.id })

      //   from_venue  el sitio nos gira: entra efectivo y su deuda baja.
      //   to_venue    le giramos: sale efectivo y lo que le debiamos sube a cero.
      const asientos =
        direccion === 'from_venue'
          ? [
              { accountId: cuentaEfectivo, amount: monto },
              { accountId: cuentaDelSitio, amount: -monto },
            ]
          : [
              { accountId: cuentaDelSitio, amount: monto },
              { accountId: cuentaEfectivo, amount: -monto },
            ]

      const mov = await publicarMovimiento(
        {
          kind: 'settlement',
          idempotencyKey: `liquidacion:${liq.id}`,
          settlementId: liq.id,
          createdByUserId: admin.userId,
          note: parsed.data.nota,
          asientos,
        },
        tx as unknown as typeof db
      )

      if (!mov.ok) throw new Error(mov.error)

      // Se marcan como cerrados los movimientos del sitio que aun no lo
      // estaban. Es lo que deja ver, mirando la cuenta, que quedo saldado y que
      // no.
      //
      // En dos pasos —leer los ids y despues actualizar— y no con un `exists`
      // escrito a mano dentro del `where`. La version con SQL crudo generaba
      // una consulta invalida que tumbaba la conexion ("Connection closed") sin
      // decir en donde. Esto es mas largo de leer y no se rompe.
      const cerrables = await tx
        .select({ id: ledgerTransaction.id })
        .from(ledgerTransaction)
        .innerJoin(ledgerEntry, eq(ledgerEntry.transactionId, ledgerTransaction.id))
        .where(
          and(isNull(ledgerTransaction.settlementId), eq(ledgerEntry.accountId, cuentaDelSitio))
        )

      const porCerrar = [...new Set(cerrables.map((c) => c.id))]

      if (porCerrar.length > 0) {
        await tx
          .update(ledgerTransaction)
          .set({ settlementId: liq.id })
          .where(
            and(
              isNull(ledgerTransaction.settlementId),
              eq(ledgerTransaction.kind, 'redeemed'),
              inArray(ledgerTransaction.id, porCerrar)
            )
          )
      }

      // El puente con /transparencia. Solo cuando la plata viene DEL SITIO:
      // ahi es cuando hay material nuevo respaldado. Cuando le giramos a el es
      // su parte de la venta y no es un aporte suyo.
      if (direccion === 'from_venue') {
        const ahora = new Date()
        await tx.insert(venueContribution).values({
          venueId: sitio.id,
          periodStart: ahora,
          periodEnd: ahora,
          amount: monto.toFixed(2),
          note: 'Generado al liquidar lo vendido por la carta.',
          source: 'productos',
          // Liquidar ES la verificacion: un operador confirmo que la plata se
          // movio. Por eso entra 'verified' y no 'submitted'.
          status: 'verified',
          verifiedByUserId: admin.userId,
          verifiedAt: ahora,
          verifiedNote: parsed.data.referencia
            ? `Liquidacion ${parsed.data.referencia}`
            : 'Liquidacion de la carta',
        })
      }
    })
  } catch {
    return { status: 'error', error: 'No se pudo liquidar.' }
  }

  revalidatePath('/admin/cuentas')
  revalidatePath(`/panel/${sitio.slug}/cuenta`)
  revalidatePath(`/sitios/${sitio.slug}`)
  revalidatePath('/transparencia')

  return {
    status: 'success',
    mensaje:
      direccion === 'from_venue'
        ? 'Registrado. Ya cuenta como material del sitio.'
        : 'Registrado. Quedó al día con el sitio.',
  }
}

/**
 * Devolverle la plata a alguien que no reclamo su trago.
 *
 * SOLO LA PLATAFORMA, y a mano. La decision 32 dice que a los 45 dias lo no
 * reclamado se va en material, con un apartado para pedir la devolucion — y ese
 * paso extra es a proposito: es la unica parte del producto donde la friccion
 * es la funcion. Alguien escribe, un operador mira y devuelve.
 *
 * NO EDITA NADA. La devolucion es un movimiento NUEVO que compensa al de la
 * caducidad; el asiento viejo se queda donde esta, que es lo que hace que el
 * libro se pueda auditar. Un trigger en la base lo impone, no la disciplina.
 */
export const devolverAction = async (orderId: string, nota?: string): Promise<LiquidacionState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const [orden] = await db
    .select({
      id: productOrder.id,
      status: productOrder.status,
      totalAmount: productOrder.totalAmount,
      unitPrice: productOrder.unitPrice,
      slug: venue.slug,
    })
    .from(productOrder)
    .innerJoin(venue, eq(venue.id, productOrder.venueId))
    .where(eq(productOrder.id, orderId))
    .limit(1)

  if (!orden) return { status: 'error', error: 'Ese pedido no existe.' }

  if (orden.status !== 'expired' && orden.status !== 'paid') {
    return { status: 'error', error: 'Ese pedido no se puede devolver.' }
  }

  // Cuantas unidades quedaron sin entregar. De un pedido a medias solo se
  // devuelve lo que no salio por la barra.
  const sinEntregar = await db
    .select({ id: orderRedemption.id })
    .from(orderRedemption)
    .where(
      and(
        eq(orderRedemption.orderId, orden.id),
        inArray(orderRedemption.status, ['issued', 'void'])
      )
    )

  if (sinEntregar.length === 0) {
    return { status: 'error', error: 'Ese pedido se entregó completo. No hay qué devolver.' }
  }

  const monto = Number(orden.unitPrice) * sinEntregar.length
  const efectivo = await cuentaDePlataforma(CUENTA.efectivo)
  const material = await cuentaDePlataforma(CUENTA.material)
  const porEntregar = await cuentaDePlataforma(CUENTA.porEntregar)
  const yaCaducado = orden.status === 'expired'

  try {
    await db.transaction(async (tx) => {
      const marcada = await tx
        .update(productOrder)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(and(eq(productOrder.id, orden.id), eq(productOrder.status, orden.status)))
        .returning({ id: productOrder.id })

      if (marcada.length === 0) throw new Error('cambio de estado mientras tanto')

      await tx
        .update(orderRedemption)
        .set({ status: 'void', updatedAt: new Date() })
        .where(and(eq(orderRedemption.orderId, orden.id), eq(orderRedemption.status, 'issued')))

      // De donde sale la plata depende de donde estaba parqueada:
      //   ya caducado  → se habia comprometido a material; se devuelve de ahi.
      //   sin caducar  → seguia en custodia; se devuelve de la custodia.
      const asientos = yaCaducado
        ? [
            { accountId: material, amount: monto },
            { accountId: efectivo, amount: -monto },
          ]
        : [
            { accountId: porEntregar, amount: monto },
            { accountId: efectivo, amount: -monto },
          ]

      const mov = await publicarMovimiento(
        {
          kind: 'refund',
          idempotencyKey: `devolucion:${orden.id}`,
          orderId: orden.id,
          createdByUserId: admin.userId,
          note: nota,
          asientos,
        },
        tx as unknown as typeof db
      )

      if (!mov.ok) throw new Error(mov.error)
    })
  } catch {
    return { status: 'error', error: 'No se pudo devolver.' }
  }

  revalidatePath('/admin/cuentas')
  revalidatePath('/transparencia')

  return { status: 'success', mensaje: `Devuelto. Sale ${monto} de la cuenta.` }
}
