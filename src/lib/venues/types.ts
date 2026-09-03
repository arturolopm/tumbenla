import type { venue } from '@/database/schema'

export type VenueRow = typeof venue.$inferSelect

export const VENUE_TYPES = ['bar', 'discoteca', 'club', 'terraza', 'restobar', 'billar'] as const
export type VenueType = (typeof VENUE_TYPES)[number]

export const VENUE_STATUSES = ['draft', 'published', 'paused', 'archived'] as const
export type VenueStatus = (typeof VENUE_STATUSES)[number]

/**
 * What the card and the map pin say about a venue, now that a venue itself
 * promises nothing (decision 34).
 *
 * Two numbers, and which one gets shown is a real product decision rather than
 * a fallback for missing data:
 *
 * `entregado` is what this venue has actually put in — verified, settled,
 * cross-checkable against a published receipt. When it is there, it is the
 * strongest thing we can say about a bar, so it wins.
 *
 * `materialDesde` is the floor of what one drink puts in right now. It is what
 * EVERY newly approved venue shows, because nobody has delivered anything on
 * day one — so it is the common case, not the edge case, and it has to read as
 * well as the other.
 *
 * Both can be absent: a published venue that has delivered nothing and has no
 * carta yet. That renders NO chip at all. "$0 puestos" reads as an accusation
 * against a bar that has simply not been invoiced yet.
 */
export type VenueChip = {
  /** Verificado y entregado. 0 = todavia nada. */
  entregado: number
  /** El material del trago mas barato publicado. null = todavia no vende. */
  materialDesde: number | null
}

/** What a card in the list and a pin on the map both need. */
export type VenueSummary = {
  id: string
  slug: string
  name: string
  type: VenueType
  tagline: string | null
  city: string
  department: string
  neighborhood: string | null
  addressLine: string
  /** Numbers, always. See the decimal-is-a-string note in mappers.ts. */
  lat: number
  lng: number
  coverImageUrl: string | null
  chip: VenueChip
  featured: boolean
  verified: boolean
}

export type Venue = VenueSummary & {
  description: string | null
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  tiktok: string | null
  email: string | null
  website: string | null
  openingHours: string | null
  logoUrl: string | null
  verifiedNote: string | null
  /** Numero o null. Nunca 0: ver el porque en schemas.ts. */
  estimatedPerPersonNight: number | null
}

/** The admin table needs the curation columns the public shape hides. */
export type VenueAdminRow = Venue & {
  status: VenueStatus
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
