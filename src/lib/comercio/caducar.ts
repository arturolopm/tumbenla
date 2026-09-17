import 'server-only'

import { and, eq, lt } from 'drizzle-orm'

import { db } from '@/database'
import { commerceOrderSnapshot } from '@/database/commerce-schema'
import { orderRedemption, productOrder } from '@/database/schema'
import { CUENTA, cuentaDePlataforma, publicarMovimiento } from '@/lib/comercio/libro'
import { CommerceUnitService } from '@/lib/commerce/unit-lifecycle-service'

/**
 * Los 45 dias (`PRODUCT.md`, decision 32).
 *
 * Un pedido pagado aca que nadie reclamo es plata que tenemos en custodia por
 * un trago que no salio. Pasados los 45 dias se va en material —el sitio no
 * cobra lo que no entrego— y la devolucion se sigue pudiendo pedir por correo.
 *
 * SOLO CADUCA LO PAGADO AQUI. Un pedido de barra sin escanear nunca se cobro:
 * no hay plata nuestra que mover, solo un QR que dejo de servir.
 *
 * ES IDEMPOTENTE por dos lados: el `where` sobre `status = 'paid'` y la clave
 * del movimiento, que sale del id de la orden. Importa porque esto corre en un
 * cron, y los crons se disparan repetido.
 */

export type ResultadoDeCaducidad = {
  revisadas: number
  caducadas: number
  aMaterial: number
  unidadesV2Retenidas: number
  responsabilidadV2Retenida: number
  errores: string[]
}

export const caducarPedidosVencidos = async (
  ahora: Date = new Date()
): Promise<ResultadoDeCaducidad> => {
  const v2 = await new CommerceUnitService({ database: db }).expireDueUnits({ now: ahora })
  const candidatas = await db
    .select({
      id: productOrder.id,
      unitPrice: productOrder.unitPrice,
    })
    .from(productOrder)
    .innerJoin(commerceOrderSnapshot, eq(commerceOrderSnapshot.orderId, productOrder.id))
    .where(
      and(
        eq(productOrder.status, 'paid'),
        eq(productOrder.payMethod, 'app'),
        eq(commerceOrderSnapshot.fundingClassification, 'legacy_unverified'),
        lt(productOrder.expiresAt, ahora)
      )
    )

  const resultado: ResultadoDeCaducidad = {
    revisadas: candidatas.length + v2.reviewed,
    caducadas: 0,
    aMaterial: 0,
    unidadesV2Retenidas: v2.expired,
    responsabilidadV2Retenida: Number(v2.retainedMinor) / 100,
    errores: [...v2.errors],
  }

  if (candidatas.length === 0) return resultado

  const porEntregar = await cuentaDePlataforma(CUENTA.porEntregar)
  const material = await cuentaDePlataforma(CUENTA.material)

  for (const orden of candidatas) {
    try {
      await db.transaction(async (tx) => {
        // Se anulan las unidades que quedaron sin entregar y el RETURNING dice
        // CUANTAS eran.
        //
        // El conteo sale de aqui y no de un `select` previo a proposito: era una
        // subconsulta correlacionada escrita a mano, y drizzle renderizaba
        // `${productOrder.id}` como un `"id"` pelado que dentro de la subconsulta
        // resolvia contra `order_redemption.id`. La comparacion daba siempre
        // falso, el conteo siempre cero, y no caducaba nada — sin error, sin
        // nada. Asi el numero viene de la misma escritura y ademas no hay
        // ventana entre contar y anular.
        const anuladas = await tx
          .update(orderRedemption)
          .set({ status: 'void', updatedAt: ahora })
          .where(and(eq(orderRedemption.orderId, orden.id), eq(orderRedemption.status, 'issued')))
          .returning({ id: orderRedemption.id })

        // Estaba entregado completo: viejo, pero no hay nada que caducar.
        if (anuladas.length === 0) return

        const marcada = await tx
          .update(productOrder)
          .set({ status: 'expired', updatedAt: ahora })
          .where(and(eq(productOrder.id, orden.id), eq(productOrder.status, 'paid')))
          .returning({ id: productOrder.id })

        // Otra corrida gano la carrera.
        if (marcada.length === 0) throw new Error('ya la caduco otro')

        // SOLO lo que quedo sin entregar. Si de tres tragos se reclamaron dos,
        // esos dos ya se repartieron al escanearse y no se pueden mover otra vez.
        const monto = Number(orden.unitPrice) * anuladas.length

        const mov = await publicarMovimiento(
          {
            kind: 'expired',
            idempotencyKey: `caducidad:${orden.id}`,
            orderId: orden.id,
            note: `${anuladas.length} sin reclamar a los 45 dias`,
            asientos: [
              // Se extingue la custodia y la plata pasa a material.
              { accountId: porEntregar, amount: monto },
              { accountId: material, amount: -monto },
            ],
          },
          tx as unknown as typeof db
        )

        if (!mov.ok) throw new Error(mov.error)

        resultado.caducadas += 1
        resultado.aMaterial += monto
      })
    } catch (e) {
      resultado.errores.push(`${orden.id}: ${e instanceof Error ? e.message : 'falló'}`)
    }
  }

  return resultado
}
