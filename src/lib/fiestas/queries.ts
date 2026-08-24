import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/database'
import { partyNight, partyPhoto, photoClaim, venue } from '@/database/schema'
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

/**
 * El resumen de aportes.
 *
 * Las noches se cuentan como night_id DISTINTOS, no como fotos: diez fotos de
 * la misma noche son una noche. El estimado multiplica cada noche por lo que
 * ESE sitio declaro poner por persona, no por un promedio de la red, y las
 * noches en sitios sin estimado declarado se cuentan aparte para poder decir
 * que el total esta incompleto.
 */
export const getHistorySummary = async (userId: string): Promise<HistorySummary> => {
  const rows = await db
    .selectDistinct({
      nightId: partyNight.id,
      venueId: venue.id,
      estimated: venue.estimatedPerPersonNight,
      currency: venue.pledgeCurrency,
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

  let estimatedAmount = 0
  let nightsWithoutEstimate = 0
  const venues = new Set<string>()

  for (const row of rows) {
    venues.add(row.venueId)
    // postgres-js devuelve decimal como string. Ver la nota en schema.ts.
    const perNight = row.estimated === null ? null : Number.parseFloat(row.estimated)
    if (perNight === null || !Number.isFinite(perNight)) {
      nightsWithoutEstimate += 1
      continue
    }
    estimatedAmount += perNight
  }

  return {
    nights: rows.length,
    venues: venues.size,
    photos,
    estimatedAmount,
    currency: rows[0]?.currency ?? 'COP',
    estimateIsPartial: nightsWithoutEstimate > 0,
    nightsWithoutEstimate,
  }
}
