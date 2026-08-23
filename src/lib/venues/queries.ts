import 'server-only'

import { and, asc, desc, eq } from 'drizzle-orm'

import { db } from '@/database'
import { venue } from '@/database/schema'
import { toVenue, toVenueAdminRow, toVenueSummary } from './mappers'
import type { Venue, VenueAdminRow, VenueSummary } from './types'

/**
 * Reads. Server-only, and they return DTOs rather than rows so the
 * decimal-as-string problem cannot leak past mappers.ts.
 *
 * No server component in this repo had ever queried the database before this,
 * so these establish the pattern: call them directly from an async page, no
 * route handler and no React Query in between.
 */

/**
 * One query, deliberately. /sitios needs both the list and the map pins, and
 * the map island derives its pins from the same array the list renders. Split
 * this into a separate listVenuesForMap only past a few hundred published
 * venues, at which point the map should move to a viewport-bounded query using
 * venue_lat_lng_idx.
 */
export const listPublishedVenues = async (): Promise<VenueSummary[]> => {
  const rows = await db
    .select()
    .from(venue)
    .where(eq(venue.status, 'published'))
    .orderBy(desc(venue.featured), asc(venue.name))

  return rows.map(toVenueSummary)
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
export const listPublishedVenueSlugs = async (): Promise<
  { slug: string; updatedAt: Date }[]
> => {
  return db
    .select({ slug: venue.slug, updatedAt: venue.updatedAt })
    .from(venue)
    .where(eq(venue.status, 'published'))
}
