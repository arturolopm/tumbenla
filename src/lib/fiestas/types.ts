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

/** El resumen de noches y fotos de una persona. */
export type HistorySummary = {
  nights: number
  venues: number
  photos: number
}
