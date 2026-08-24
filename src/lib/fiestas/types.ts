import type { partyNight, partyPhoto, photoClaim } from '@/database/schema'

export type PartyNightRow = typeof partyNight.$inferSelect
export type PartyPhotoRow = typeof partyPhoto.$inferSelect
export type PhotoClaimRow = typeof photoClaim.$inferSelect

export const NIGHT_STATUSES = ['draft', 'published'] as const
export type NightStatus = (typeof NIGHT_STATUSES)[number]

/**
 * 'pending'   recien subida, solo la ve el operador
 * 'available' el operador la habilito para que la gente se reconozca en ella
 * 'hidden'    retirada; alguien pidio que no se muestre
 *
 * 'available' NO significa publica. Que una foto se vea fuera de la cuenta de
 * quien la reclamo depende ademas de photoClaim.showPublicly.
 */
export const PHOTO_STATUSES = ['pending', 'available', 'hidden'] as const
export type PhotoStatus = (typeof PHOTO_STATUSES)[number]

export type PartyPhoto = {
  id: string
  url: string
  caption: string | null
  status: PhotoStatus
}

/** Una noche con su sitio, para pintarla en la galeria y en el historial. */
export type PartyNight = {
  id: string
  venueId: string
  venueName: string
  venueSlug: string
  city: string
  happenedAt: Date
  title: string | null
  status: NightStatus
  photoCount: number
}

/** Una foto que esta persona reclamo, con la noche a la que pertenece. */
export type ClaimedPhoto = {
  claimId: string
  photoId: string
  url: string
  caption: string | null
  showPublicly: boolean
  nightId: string
  happenedAt: Date
  venueName: string
  venueSlug: string
}

/**
 * El resumen de una persona.
 *
 * `estimatedAmount` ES UN ESTIMADO y viene con `estimateIsPartial` para que la
 * interfaz pueda decir la verdad completa: si algun sitio visitado no declaro
 * su estimado por noche, el total se queda corto y hay que decirlo en vez de
 * presentar una cifra redonda que no incluye todo.
 */
export type HistorySummary = {
  nights: number
  venues: number
  photos: number
  estimatedAmount: number
  currency: string
  /** true si al menos una noche fue en un sitio sin estimado declarado. */
  estimateIsPartial: boolean
  /** Cuantas noches no pudieron sumarse al estimado. */
  nightsWithoutEstimate: number
}
