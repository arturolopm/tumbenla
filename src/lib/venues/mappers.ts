import type {
  Pledge,
  PledgeBasis,
  Venue,
  VenueAdminRow,
  VenueRow,
  VenueStatus,
  VenueSummary,
  VenueType,
} from './types'

/**
 * The one place a database row becomes a DTO.
 *
 * postgres-js returns every `decimal` column as a STRING, coordinates and money
 * alike. Handing '4.710000' to MapLibre gives a blank map and no error at all,
 * and arithmetic on a string total silently concatenates. Funnelling every read
 * through here is what stops that from happening somewhere nobody is looking.
 *
 * Nothing outside this file should touch row.latitude or row.pledgePercentage.
 * Queries return DTOs, never raw rows.
 */

const toNumber = (value: string | null): number | null =>
  value === null ? null : Number(value)

export const toPledge = (row: VenueRow): Pledge => {
  if (row.pledgeType === 'percentage') {
    return {
      type: 'percentage',
      percentage: toNumber(row.pledgePercentage) ?? 0,
      basis: (row.pledgeBasis as PledgeBasis | null) ?? null,
      note: row.pledgeNote,
    }
  }

  return {
    type: 'fixed_per_unit',
    amount: toNumber(row.pledgeAmount) ?? 0,
    unit: row.pledgeUnit ?? 'unidad',
    currency: row.pledgeCurrency,
    note: row.pledgeNote,
  }
}

export const toVenueSummary = (row: VenueRow): VenueSummary => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  type: row.type as VenueType,
  tagline: row.tagline,
  city: row.city,
  department: row.department,
  neighborhood: row.neighborhood,
  addressLine: row.addressLine,
  lat: Number(row.latitude),
  lng: Number(row.longitude),
  coverImageUrl: row.coverImageUrl,
  pledge: toPledge(row),
  featured: row.featured,
  verified: row.verifiedAt !== null,
})

export const toVenue = (row: VenueRow): Venue => ({
  ...toVenueSummary(row),
  description: row.description,
  phone: row.phone,
  whatsapp: row.whatsapp,
  instagram: row.instagram,
  website: row.website,
  openingHours: row.openingHours,
  logoUrl: row.logoUrl,
  estimatedPerPersonNight:
    row.estimatedPerPersonNight === null ? null : Number(row.estimatedPerPersonNight),
  verifiedNote: row.verifiedNote,
  pledgeStartsAt: row.pledgeStartsAt,
  pledgeEndsAt: row.pledgeEndsAt,
})

export const toVenueAdminRow = (row: VenueRow): VenueAdminRow => ({
  ...toVenue(row),
  status: row.status as VenueStatus,
  publishedAt: row.publishedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})
