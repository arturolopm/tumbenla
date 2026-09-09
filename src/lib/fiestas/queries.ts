import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/database'
import { partyNight, partyPhoto, photoClaim, photoReport, venue } from '@/database/schema'
import type { ClaimedPhoto, HistorySummary, PartyNight, PartyPhoto } from './types'

/**
 * Lecturas de fiestas, fotos y reclamos. Server-only.
 *
 * REGLA QUE ATRAVIESA TODO ESTE ARCHIVO: una foto de gente en un bar no sale de
 * aca sin que alguien la haya habilitado. Las consultas publicas filtran por
 * status y por showPublicly; las consultas privadas piden userId. No hay una
 * funcion que devuelva "todas las fotos" sin filtro, a proposito: si no existe,
 * nadie la llama por descuido.
 */

/** Noches publicadas de un sitio, para que la gente busque la suya. */
export const listNightsForVenue = async (venueId: string): Promise<PartyNight[]> => {
  const rows = await db
    .select({
      id: partyNight.id,
      venueId: partyNight.venueId,
      venueName: venue.name,
      venueSlug: venue.slug,
      city: venue.city,
      happenedAt: partyNight.happenedAt,
      title: partyNight.title,
      status: partyNight.status,
      photoCount: sql<number>`count(${partyPhoto.id})::int`,
    })
    .from(partyNight)
    .innerJoin(venue, eq(partyNight.venueId, venue.id))
    .leftJoin(
      partyPhoto,
      and(eq(partyPhoto.nightId, partyNight.id), eq(partyPhoto.status, 'available'))
    )
    .where(and(eq(partyNight.venueId, venueId), eq(partyNight.status, 'published')))
    .groupBy(partyNight.id, venue.name, venue.slug, venue.city)
    .orderBy(desc(partyNight.happenedAt))

  return rows.map((row) => ({ ...row, status: row.status as PartyNight['status'] }))
}

/**
 * Las fotos habilitadas de una noche, para que alguien se reconozca.
 *
 * Solo 'available'. Las 'pending' todavia no las reviso nadie y las 'hidden'
 * las retiraron; ninguna de las dos puede filtrarse a una pantalla publica.
 */
export const listAvailablePhotos = async (nightId: string): Promise<PartyPhoto[]> => {
  const rows = await db
    .select({
      id: partyPhoto.id,
      url: partyPhoto.url,
      caption: partyPhoto.caption,
      status: partyPhoto.status,
    })
    .from(partyPhoto)
    .where(and(eq(partyPhoto.nightId, nightId), eq(partyPhoto.status, 'available')))
    .orderBy(desc(partyPhoto.createdAt))

  return rows.map((row) => ({ ...row, status: row.status as PartyPhoto['status'] }))
}

/** Que fotos de esta lista ya reclamo esta persona. Para pintar el estado. */
export const listClaimedPhotoIds = async (
  userId: string,
  photoIds: string[]
): Promise<Set<string>> => {
  if (photoIds.length === 0) return new Set()

  const rows = await db
    .select({ photoId: photoClaim.photoId })
    .from(photoClaim)
    .where(and(eq(photoClaim.userId, userId), inArray(photoClaim.photoId, photoIds)))

  return new Set(rows.map((row) => row.photoId))
}

/** El historial de una persona: sus fotos reclamadas, mas recientes primero. */
export const listMyClaimedPhotos = async (userId: string): Promise<ClaimedPhoto[]> => {
  return db
    .select({
      claimId: photoClaim.id,
      photoId: partyPhoto.id,
      url: partyPhoto.url,
      caption: partyPhoto.caption,
      showPublicly: photoClaim.showPublicly,
      nightId: partyNight.id,
      happenedAt: partyNight.happenedAt,
      venueName: venue.name,
      venueSlug: venue.slug,
    })
    .from(photoClaim)
    .innerJoin(partyPhoto, eq(photoClaim.photoId, partyPhoto.id))
    .innerJoin(partyNight, eq(partyPhoto.nightId, partyNight.id))
    .innerJoin(venue, eq(partyNight.venueId, venue.id))
    // Una foto retirada desaparece tambien del historial de quien la reclamo.
    // Si alguien pidio que no se muestre, "no se muestra" no admite excepciones.
    .where(and(eq(photoClaim.userId, userId), eq(partyPhoto.status, 'available')))
    .orderBy(desc(partyNight.happenedAt))
}

/** Las noches y fotos de una persona. Los aportes vienen de sus pedidos pagados. */
export const getHistorySummary = async (userId: string): Promise<HistorySummary> => {
  const rows = await db
    .selectDistinct({
      nightId: partyNight.id,
      venueId: venue.id,
    })
    .from(photoClaim)
    .innerJoin(partyPhoto, eq(photoClaim.photoId, partyPhoto.id))
    .innerJoin(partyNight, eq(partyPhoto.nightId, partyNight.id))
    .innerJoin(venue, eq(partyNight.venueId, venue.id))
    .where(and(eq(photoClaim.userId, userId), eq(partyPhoto.status, 'available')))

  const [{ count: photos } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(photoClaim)
    .innerJoin(partyPhoto, eq(photoClaim.photoId, partyPhoto.id))
    .where(and(eq(photoClaim.userId, userId), eq(partyPhoto.status, 'available')))

  const venues = new Set<string>()

  for (const row of rows) {
    venues.add(row.venueId)
  }

  return {
    nights: rows.length,
    venues: venues.size,
    photos,
  }
}

/**
 * Las noches de un sitio para SU PROPIO panel: todas, incluidas las de
 * borrador, y con el conteo por estado para que el operador del bar sepa que
 * tiene sin revisar sin abrir cada noche.
 *
 * Es la contraparte privada de listNightsForVenue, que solo devuelve lo
 * publicado. Estan separadas a proposito: una consulta con una bandera
 * "incluirBorradores" es una consulta a la que se le olvida la bandera.
 */
export const listNightsForPanel = async (venueId: string) => {
  return db
    .select({
      id: partyNight.id,
      happenedAt: partyNight.happenedAt,
      title: partyNight.title,
      status: partyNight.status,
      fotos: sql<number>`count(${partyPhoto.id})::int`,
      pendientes: sql<number>`count(${partyPhoto.id}) filter (where ${partyPhoto.status} = 'pending')::int`,
      disponibles: sql<number>`count(${partyPhoto.id}) filter (where ${partyPhoto.status} = 'available')::int`,
    })
    .from(partyNight)
    .leftJoin(partyPhoto, eq(partyPhoto.nightId, partyNight.id))
    .where(eq(partyNight.venueId, venueId))
    .groupBy(partyNight.id)
    .orderBy(desc(partyNight.happenedAt))
}

/** Todas las fotos de una noche, para el panel del sitio. Incluye 'pending' y
 *  'hidden', que es justamente lo que el sitio tiene que poder ver. */
export const listPhotosForPanel = async (nightId: string) => {
  return db
    .select({
      id: partyPhoto.id,
      url: partyPhoto.url,
      caption: partyPhoto.caption,
      status: partyPhoto.status,
      source: partyPhoto.source,
      createdAt: partyPhoto.createdAt,
      reclamos: sql<number>`(select count(*) from ${photoClaim} where ${photoClaim.photoId} = ${partyPhoto.id})::int`,
    })
    .from(partyPhoto)
    .where(eq(partyPhoto.nightId, nightId))
    .orderBy(desc(partyPhoto.createdAt))
}

/** Lo que le falta por revisar a un sitio: fotos de la calle sin habilitar. */
export const listPendingPhotosForVenue = async (venueId: string) => {
  return db
    .select({
      id: partyPhoto.id,
      url: partyPhoto.url,
      caption: partyPhoto.caption,
      source: partyPhoto.source,
      createdAt: partyPhoto.createdAt,
      nightId: partyNight.id,
      happenedAt: partyNight.happenedAt,
      nightTitle: partyNight.title,
    })
    .from(partyPhoto)
    .innerJoin(partyNight, eq(partyPhoto.nightId, partyNight.id))
    .where(and(eq(partyNight.venueId, venueId), eq(partyPhoto.status, 'pending')))
    .orderBy(desc(partyPhoto.createdAt))
}

/** Los reportes abiertos de un sitio. Una peticion de privacidad se atiende, no
 *  se archiva: por eso tiene su propia lista y no vive escondida en una foto. */
export const listOpenReportsForVenue = async (venueId: string) => {
  return db
    .select({
      id: photoReport.id,
      reason: photoReport.reason,
      createdAt: photoReport.createdAt,
      photoId: partyPhoto.id,
      url: partyPhoto.url,
      photoStatus: partyPhoto.status,
      nightId: partyNight.id,
    })
    .from(photoReport)
    .innerJoin(partyPhoto, eq(photoReport.photoId, partyPhoto.id))
    .innerJoin(partyNight, eq(partyPhoto.nightId, partyNight.id))
    .where(and(eq(partyNight.venueId, venueId), eq(photoReport.status, 'open')))
    .orderBy(desc(photoReport.createdAt))
}

/** Una noche publicada, para la pagina publica. Devuelve null si no lo esta:
 *  adivinar el id de una noche en borrador no debe mostrarla. */
export const getPublishedNight = async (nightId: string) => {
  const [fila] = await db
    .select({
      id: partyNight.id,
      happenedAt: partyNight.happenedAt,
      title: partyNight.title,
      venueId: venue.id,
      venueSlug: venue.slug,
      venueNombre: venue.name,
    })
    .from(partyNight)
    .innerJoin(venue, eq(partyNight.venueId, venue.id))
    .where(and(eq(partyNight.id, nightId), eq(partyNight.status, 'published')))
    .limit(1)

  return fila ?? null
}
