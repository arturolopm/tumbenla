import 'server-only'

import { asc, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/database'
import {
  materialPurchase,
  user,
  venue,
  venueContribution,
  venueContributionMedia,
} from '@/database/schema'

/**
 * Lecturas de aportes.
 *
 * REGLA DE ESTE ARCHIVO, igual que en fiestas/queries.ts: lo publico filtra por
 * 'verified' dentro de la consulta, no en quien la llama. Una funcion que
 * devuelva todo y confie en que arriba la filtren es una funcion a la que
 * alguien le va a olvidar el filtro, y el error se veria como una cifra sin
 * verificar publicada bajo nuestro nombre.
 */

/** Los aportes de un sitio, para SU panel. Todos los estados: el sitio tiene
 *  que ver lo que mando y en que va. */
export const listContributionsForPanel = async (venueId: string) => {
  return db
    .select({
      id: venueContribution.id,
      periodStart: venueContribution.periodStart,
      periodEnd: venueContribution.periodEnd,
      amount: venueContribution.amount,
      currency: venueContribution.currency,
      note: venueContribution.note,
      status: venueContribution.status,
      verifiedAt: venueContribution.verifiedAt,
      verifiedNote: venueContribution.verifiedNote,
      recibos: sql<number>`(select count(*) from ${venueContributionMedia} where ${venueContributionMedia.contributionId} = ${venueContribution.id})::int`,
    })
    .from(venueContribution)
    .where(eq(venueContribution.venueId, venueId))
    .orderBy(desc(venueContribution.periodStart))
}

/** La cola del operador. Lo pendiente primero y lo mas viejo arriba. */
export const listContributionsForAdmin = async () => {
  return db
    .select({
      id: venueContribution.id,
      periodStart: venueContribution.periodStart,
      periodEnd: venueContribution.periodEnd,
      amount: venueContribution.amount,
      currency: venueContribution.currency,
      note: venueContribution.note,
      status: venueContribution.status,
      verifiedNote: venueContribution.verifiedNote,
      purchaseId: venueContribution.purchaseId,
      createdAt: venueContribution.createdAt,
      venueId: venue.id,
      venueSlug: venue.slug,
      venueNombre: venue.name,
      quienMando: user.email,
    })
    .from(venueContribution)
    .innerJoin(venue, eq(venueContribution.venueId, venue.id))
    .leftJoin(user, eq(venueContribution.submittedByUserId, user.id))
    .orderBy(asc(venueContribution.createdAt))
}

/** Los recibos de un aporte. */
export const listContributionMedia = async (contributionId: string) => {
  return db
    .select({
      id: venueContributionMedia.id,
      kind: venueContributionMedia.kind,
      url: venueContributionMedia.url,
      caption: venueContributionMedia.caption,
    })
    .from(venueContributionMedia)
    .where(eq(venueContributionMedia.contributionId, contributionId))
    .orderBy(asc(venueContributionMedia.createdAt))
}

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

/** Las compras a las que un operador puede atar un aporte. */
export const listPurchasesForLinking = async () => {
  return db
    .select({
      id: materialPurchase.id,
      title: materialPurchase.title,
      purchasedAt: materialPurchase.purchasedAt,
    })
    .from(materialPurchase)
    .orderBy(desc(materialPurchase.purchasedAt))
    .limit(50)
}
