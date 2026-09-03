import 'server-only'

import { and, asc, desc, eq, sql, sum } from 'drizzle-orm'

import { db } from '@/database'
import { venue, venueContribution, venueProduct } from '@/database/schema'
import { toVenue, toVenueAdminRow, toVenueChip, toVenueSummary } from './mappers'
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
  /**
   * Lo entregado y verificado, por sitio.
   *
   * Agregado aca y NO llamando getVerifiedTotal() por tarjeta: eso seria una
   * consulta por sitio en una pagina que las lista todas, y ademas corre en
   * cada revalidacion del ISR de /sitios y de la portada.
   */
  const entregado = db
    .select({
      venueId: venueContribution.venueId,
      total: sum(venueContribution.amount).as('total'),
    })
    .from(venueContribution)
    .where(eq(venueContribution.status, 'verified'))
    .groupBy(venueContribution.venueId)
    .as('entregado')

  /**
   * El trago que MENOS material pone, de los publicados.
   *
   * Ordena por `price * donation_percentage` y no por precio: "desde $X en
   * material" es una afirmacion de piso, y un trago mas caro con un porcentaje
   * mas alto puede poner menos que uno barato con uno bajo. Si se ordenara por
   * precio, la tarjeta podria decir "desde $4.000" mientras existe uno que pone
   * $3.000, y eso seria falso.
   *
   * Puede no coincidir con la primera fila de la carta publica, que va ordenada
   * por precio. Es correcto: son dos preguntas distintas.
   */
  const barato = db
    .selectDistinctOn([venueProduct.venueId], {
      venueId: venueProduct.venueId,
      precio: venueProduct.price,
      pct: venueProduct.donationPercentage,
    })
    .from(venueProduct)
    .where(eq(venueProduct.status, 'published'))
    // DISTINCT ON y no tres min(): el precio y el porcentaje tienen que salir
    // de LA MISMA fila. Con `min(precio)` y `min(pct)` por separado se mezclan
    // dos productos distintos — con (10.000, 90%) y (20.000, 20%) daria
    // 10.000 * 20% = $2.000 cuando el piso real es $4.000, y la tarjeta diria
    // "desde $2.000" de algo que no existe.
    .orderBy(
      asc(venueProduct.venueId),
      asc(sql`${venueProduct.price} * ${venueProduct.donationPercentage}`),
      asc(venueProduct.price)
    )
    .as('barato')

  const rows = await db
    .select({ venue: venue, entregado: entregado.total, precio: barato.precio, pct: barato.pct })
    .from(venue)
    .leftJoin(entregado, eq(entregado.venueId, venue.id))
    .leftJoin(barato, eq(barato.venueId, venue.id))
    .where(eq(venue.status, 'published'))
    .orderBy(desc(venue.featured), asc(venue.name))

  return rows.map((row) =>
    toVenueSummary(
      row.venue,
      toVenueChip({
        entregado: row.entregado,
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
export const listPublishedVenueSlugs = async (): Promise<
  { slug: string; updatedAt: Date }[]
> => {
  return db
    .select({ slug: venue.slug, updatedAt: venue.updatedAt })
    .from(venue)
    .where(eq(venue.status, 'published'))
}
