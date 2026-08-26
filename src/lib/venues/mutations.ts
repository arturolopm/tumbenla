import 'server-only'

import { and, eq, ne } from 'drizzle-orm'

import { db } from '@/database'
import { venue } from '@/database/schema'
import { slugify } from '@/lib/utils/slug'
import { toVenueAdminRow } from './mappers'
import type { VenueInput } from './schemas'
import type { VenueAdminRow, VenueStatus } from './types'

/**
 * Writes. Callers must have passed requireAdmin() or assertAdmin() first;
 * nothing here checks permissions.
 */

/**
 * Slugs are derived from the name, so two 'Bar La Esquina' in different cities
 * collide on a UNIQUE constraint. Suffix rather than fail, and exclude the row
 * being edited so renaming a venue to its own current name is a no-op.
 */
export const ensureUniqueSlug = async (base: string, excludeId?: string): Promise<string> => {
  const root = slugify(base) || 'sitio'

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`

    const clash = await db
      .select({ id: venue.id })
      .from(venue)
      .where(
        excludeId
          ? and(eq(venue.slug, candidate), ne(venue.id, excludeId))
          : eq(venue.slug, candidate)
      )
      .limit(1)

    if (clash.length === 0) return candidate
  }

  // Astronomically unlikely, but silently returning a colliding slug would
  // surface as an opaque constraint violation.
  return `${root}-${Date.now()}`
}

/**
 * Drizzle wants decimal columns as strings on the way in, the same way it hands
 * them back. Passing a number here throws at runtime.
 */
const toPledgeColumns = (input: VenueInput) =>
  input.pledgeType === 'percentage'
    ? {
        pledgeType: 'percentage' as const,
        pledgePercentage: input.pledgePercentage.toString(),
        pledgeAmount: null,
        pledgeUnit: null,
        pledgeBasis: input.pledgeBasis ?? null,
        pledgeNote: input.pledgeNote,
      }
    : {
        pledgeType: 'fixed_per_unit' as const,
        pledgePercentage: null,
        pledgeAmount: input.pledgeAmount.toString(),
        pledgeUnit: input.pledgeUnit,
        pledgeBasis: null,
        pledgeNote: input.pledgeNote,
      }

const toColumns = (input: VenueInput, slug: string) => ({
  slug,
  name: input.name,
  type: input.type,
  tagline: input.tagline,
  description: input.description,

  addressLine: input.addressLine,
  neighborhood: input.neighborhood,
  city: input.city,
  department: input.department,
  latitude: input.latitude.toString(),
  longitude: input.longitude.toString(),

  phone: input.phone,
  whatsapp: input.whatsapp,
  instagram: input.instagram,
  tiktok: input.tiktok,
  email: input.email,
  website: input.website,
  openingHours: input.openingHours,

  coverImageUrl: input.coverImageUrl,
  logoUrl: input.logoUrl,

  // postgres-js quiere decimal como string. Ver la nota en schema.ts.
  estimatedPerPersonNight:
    input.estimatedPerPersonNight === null ? null : input.estimatedPerPersonNight.toFixed(2),

  verifiedNote: input.verifiedNote,
  status: input.status,

  ...toPledgeColumns(input),
})

export const createVenue = async (input: VenueInput): Promise<VenueAdminRow> => {
  const slug = await ensureUniqueSlug(input.name)

  const [row] = await db
    .insert(venue)
    .values({
      ...toColumns(input, slug),
      publishedAt: input.status === 'published' ? new Date() : null,
    })
    .returning()

  return toVenueAdminRow(row)
}

export const updateVenue = async (id: string, input: VenueInput): Promise<VenueAdminRow> => {
  const slug = await ensureUniqueSlug(input.name, id)

  const [current] = await db
    .select({ publishedAt: venue.publishedAt })
    .from(venue)
    .where(eq(venue.id, id))
    .limit(1)

  const [row] = await db
    .update(venue)
    .set({
      ...toColumns(input, slug),
      // publishedAt records when a venue first went public. Editing a live
      // venue must not move it, or a date-sorted list reshuffles on every save.
      publishedAt:
        input.status === 'published'
          ? (current?.publishedAt ?? new Date())
          : (current?.publishedAt ?? null),
      updatedAt: new Date(),
    })
    .where(eq(venue.id, id))
    .returning()

  return toVenueAdminRow(row)
}

export const setVenueStatus = async (id: string, status: VenueStatus): Promise<void> => {
  const [current] = await db
    .select({ publishedAt: venue.publishedAt })
    .from(venue)
    .where(eq(venue.id, id))
    .limit(1)

  // Stamp the FIRST publish only. Un-pausing a venue should not move it back to
  // the top of a date-sorted list.
  const shouldStamp = status === 'published' && !current?.publishedAt

  await db
    .update(venue)
    .set({
      status,
      ...(shouldStamp ? { publishedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(venue.id, id))
}
