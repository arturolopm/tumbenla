import type { venue } from '@/database/schema'

export type VenueRow = typeof venue.$inferSelect

export const VENUE_TYPES = ['bar', 'discoteca', 'club', 'terraza', 'restobar', 'billar'] as const
export type VenueType = (typeof VENUE_TYPES)[number]

export const VENUE_STATUSES = ['draft', 'published', 'paused', 'archived'] as const
export type VenueStatus = (typeof VENUE_STATUSES)[number]

export const PLEDGE_UNITS = ['botella', 'trago', 'cerveza', 'coctel', 'entrada'] as const
export type PledgeUnit = (typeof PLEDGE_UNITS)[number]

export const PLEDGE_BASES = ['ventas_totales', 'ventas_licor', 'cover'] as const
export type PledgeBasis = (typeof PLEDGE_BASES)[number]

/**
 * A discriminated union so the UI cannot forget a case. The database stores this
 * as a `pledge_type` text column plus two nullable value columns; mappers.ts is
 * what turns that back into a shape TypeScript can check exhaustively.
 */
export type Pledge =
  | {
      type: 'percentage'
      percentage: number
      basis: PledgeBasis | null
      note: string | null
    }
  | {
      type: 'fixed_per_unit'
      amount: number
      unit: string
      currency: string
      note: string | null
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
  pledge: Pledge
  featured: boolean
  verified: boolean
}

export type Venue = VenueSummary & {
  description: string | null
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  website: string | null
  openingHours: string | null
  logoUrl: string | null
  verifiedNote: string | null
  /** Numero o null. Nunca 0: ver el porque en schemas.ts. */
  estimatedPerPersonNight: number | null
  pledgeStartsAt: Date | null
  pledgeEndsAt: Date | null
}

/** The admin table needs the curation columns the public shape hides. */
export type VenueAdminRow = Venue & {
  status: VenueStatus
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
