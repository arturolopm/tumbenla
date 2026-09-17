import 'server-only'

import { and, asc, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/database'
import { venue, venueProduct } from '@/database/schema'
import { PORCENTAJE_MINIMO_DE_RECONSTRUCCION } from '@/lib/comercio/types'
import { toVenue, toVenueAdminRow, toVenueChip, toVenueSummary } from './mappers'
import type { Venue, VenueAdminRow, VenueSummary } from './types'

/** Server-only reads return DTOs so decimal strings never leak past mappers.ts. */

/**
 * One query, deliberately. /sitios needs both the list and the map pins, and
 * the map island derives its pins from the same array the list renders. Split
 * this into a separate listVenuesForMap only past a few hundred published
 * venues, at which point the map should move to a viewport-bounded query using
 * venue_lat_lng_idx.
 */
export const listPublishedVenues = async (): Promise<VenueSummary[]> => {
  /** Find the published product with the lowest material allocation floor. */
  const barato = db
    .selectDistinctOn([venueProduct.venueId], {
      venueId: venueProduct.venueId,
      precio: venueProduct.price,
      pct: venueProduct.donationPercentage,
    })
    .from(venueProduct)
    .where(
      and(
        eq(venueProduct.status, 'published'),
        gte(venueProduct.donationPercentage, String(PORCENTAJE_MINIMO_DE_RECONSTRUCCION))
      )
    )
    // DISTINCT ON keeps price and percentage from the same product. Independent min() calls could
    // combine two rows and display a material floor that no published product actually has.
    .orderBy(
      asc(venueProduct.venueId),
      asc(sql`${venueProduct.price} * ${venueProduct.donationPercentage}`),
      asc(venueProduct.price)
    )
    .as('barato')

  const rows = await db
    .select({ venue: venue, precio: barato.precio, pct: barato.pct })
    .from(venue)
    .leftJoin(barato, eq(barato.venueId, venue.id))
    .where(eq(venue.status, 'published'))
    .orderBy(desc(venue.featured), asc(venue.name))

  return rows.map((row) =>
    toVenueSummary(
      row.venue,
      toVenueChip({
        // Legacy contribution rows are intentionally not public map evidence.
        entregado: null,
        baratoPrecio: row.precio,
        baratoPct: row.pct,
      })
    )
  )
}

export const getVenueBySlug = async (slug: string): Promise<Venue | null> => {
  const [row] = await db
    .select()
    .from(venue)
    .where(and(eq(venue.slug, slug), eq(venue.status, 'published')))
    .limit(1)

  return row ? toVenue(row) : null
}

export const listVenueCities = async (): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ city: venue.city })
    .from(venue)
    .where(eq(venue.status, 'published'))
    .orderBy(asc(venue.city))

  return rows.map((row) => row.city)
}

export const countPublishedVenues = async (): Promise<number> => {
  const rows = await db.select({ id: venue.id }).from(venue).where(eq(venue.status, 'published'))
  return rows.length
}

/** Every status, not just published. Callers must have passed requireAdmin first. */
export const listVenuesForAdmin = async (): Promise<VenueAdminRow[]> => {
  const rows = await db.select().from(venue).orderBy(desc(venue.updatedAt))
  return rows.map(toVenueAdminRow)
}

export const getVenueById = async (id: string): Promise<VenueAdminRow | null> => {
  const [row] = await db.select().from(venue).where(eq(venue.id, id)).limit(1)
  return row ? toVenueAdminRow(row) : null
}

/** Published slugs for the sitemap. */
export const listPublishedVenueSlugs = async (): Promise<{ slug: string; updatedAt: Date }[]> => {
  return db
    .select({ slug: venue.slug, updatedAt: venue.updatedAt })
    .from(venue)
    .where(eq(venue.status, 'published'))
}
