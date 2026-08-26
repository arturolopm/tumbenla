import 'server-only'

import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { user, venue, venueClaimRequest, venueMember } from '@/database/schema'

/**
 * Buscar un sitio para reclamarlo.
 *
 * Busca entre TODOS los estados, no solo los publicados: los sitios que
 * cargamos nosotros nacen en borrador, y son precisamente esos los que un dueno
 * llega buscando. Filtrar por publicados le diria "tu bar no existe" cuando lo
 * que pasa es que todavia no lo hemos publicado.
 *
 * Se devuelve si ya tiene dueno para poder decirlo en la lista en vez de dejar
 * que alguien mande una solicitud que nace rechazada.
 */
export const buscarSitiosParaReclamar = async (termino: string) => {
  const q = `%${termino.trim()}%`

  return db
    .select({
      id: venue.id,
      slug: venue.slug,
      nombre: venue.name,
      city: venue.city,
      addressLine: venue.addressLine,
      status: venue.status,
      duenos: sql<number>`count(distinct ${venueMember.userId}) filter (where ${venueMember.role} = 'owner')::int`,
    })
    .from(venue)
    .leftJoin(venueMember, eq(venueMember.venueId, venue.id))
    .where(or(ilike(venue.name, q), ilike(venue.addressLine, q), ilike(venue.city, q)))
    .groupBy(venue.id)
    .orderBy(asc(venue.name))
    .limit(20)
}

/** Las solicitudes de una persona, para no dejarla mandando la misma dos veces. */
export const listMyClaimRequests = async (userId: string) => {
  return db
    .select({
      id: venueClaimRequest.id,
      status: venueClaimRequest.status,
      reviewNote: venueClaimRequest.reviewNote,
      venueSlug: venue.slug,
      venueNombre: venue.name,
      createdAt: venueClaimRequest.createdAt,
    })
    .from(venueClaimRequest)
    .innerJoin(venue, eq(venueClaimRequest.venueId, venue.id))
    .where(eq(venueClaimRequest.userId, userId))
    .orderBy(desc(venueClaimRequest.createdAt))
}

/** La cola del operador. Las pendientes primero, y las mas viejas arriba: una
 *  solicitud vieja es alguien esperando hace mas tiempo. */
export const listClaimRequests = async (status?: string) => {
  const base = db
    .select({
      id: venueClaimRequest.id,
      status: venueClaimRequest.status,
      message: venueClaimRequest.message,
      evidenceUrl: venueClaimRequest.evidenceUrl,
      reviewNote: venueClaimRequest.reviewNote,
      createdAt: venueClaimRequest.createdAt,
      venueId: venue.id,
      venueSlug: venue.slug,
      venueNombre: venue.name,
      venueCity: venue.city,
      venueStatus: venue.status,
      solicitante: user.name,
      solicitanteEmail: user.email,
    })
    .from(venueClaimRequest)
    .innerJoin(venue, eq(venueClaimRequest.venueId, venue.id))
    .innerJoin(user, eq(venueClaimRequest.userId, user.id))
    .orderBy(asc(venueClaimRequest.createdAt))

  if (status) return base.where(eq(venueClaimRequest.status, status))
  return base
}

/** Si el sitio ya tiene dueno. Lo mira el operador antes de aprobar y tambien
 *  la accion, porque entre lo uno y lo otro pueden pasar dias. */
export const tieneDueno = async (venueId: string) => {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(venueMember)
    .where(and(eq(venueMember.venueId, venueId), eq(venueMember.role, 'owner')))

  return (fila?.n ?? 0) > 0
}
