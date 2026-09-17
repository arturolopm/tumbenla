import 'server-only'

import { desc, eq, sql } from 'drizzle-orm'

import { db } from '@/database'
import { materialPurchase, venueContribution } from '@/database/schema'

/**
 * Lecturas de aportes.
 *
 * REGLA DE ESTE ARCHIVO, igual que en fiestas/queries.ts: lo publico filtra por
 * 'verified' dentro de la consulta, no en quien la llama. Una funcion que
 * devuelva todo y confie en que arriba la filtren es una funcion a la que
 * alguien le va a olvidar el filtro, y el error se veria como una cifra sin
 * verificar publicada bajo nuestro nombre.
 */

/**
 * Lo que un sitio ha entregado, PARA PANTALLA PUBLICA.
 *
 * Solo 'verified', filtrado aca adentro. Ver la regla de arriba.
 */
export const listVerifiedContributions = async (venueId: string) => {
  return db
    .select({
      id: venueContribution.id,
      periodStart: venueContribution.periodStart,
      periodEnd: venueContribution.periodEnd,
      amount: venueContribution.amount,
      currency: venueContribution.currency,
      verifiedAt: venueContribution.verifiedAt,
      purchaseId: venueContribution.purchaseId,
      purchaseSlug: materialPurchase.slug,
      purchaseTitle: materialPurchase.title,
    })
    .from(venueContribution)
    .leftJoin(materialPurchase, eq(venueContribution.purchaseId, materialPurchase.id))
    .where(sql`${venueContribution.venueId} = ${venueId} and ${venueContribution.status} = 'verified'`)
    .orderBy(desc(venueContribution.periodStart))
}

/** El total verificado de un sitio, para la ficha publica. */
export const getVerifiedTotal = async (venueId: string) => {
  const [fila] = await db
    .select({
      total: sql<string | null>`sum(${venueContribution.amount})`,
      currency: sql<string | null>`min(${venueContribution.currency})`,
      n: sql<number>`count(*)::int`,
    })
    .from(venueContribution)
    .where(sql`${venueContribution.venueId} = ${venueId} and ${venueContribution.status} = 'verified'`)

  // postgres-js devuelve numeric como string; sum() de cero filas da null.
  return {
    total: fila?.total ? Number.parseFloat(fila.total) : 0,
    currency: fila?.currency ?? 'COP',
    aportes: fila?.n ?? 0,
  }
}
