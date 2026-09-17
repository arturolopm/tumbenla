import { repartir } from '@/lib/comercio/dinero'
import type {
  Venue,
  VenueAdminRow,
  VenueChip,
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
 * Nothing outside this file should touch row.latitude or a raw decimal.
 * Queries return DTOs, never raw rows.
 */

const toNumber = (value: string | null): number | null => (value === null ? null : Number(value))

/**
 * Lo que se pinta cuando un sitio no ha entregado nada y no tiene carta.
 *
 * Existe como valor y no como `null` suelto para que `toVenue` y
 * `toVenueAdminRow` —que no traen los agregados— sigan compilando sin
 * inventarse cifras. Que un sitio no tenga chip es un caso legitimo, no un
 * error de carga.
 */
export const CHIP_VACIO: VenueChip = { entregado: 0, materialDesde: null }

/**
 * El chip, a partir de las dos columnas agregadas que trae listPublishedVenues.
 *
 * EL REPARTO NO SE CALCULA ACA NI EN SQL: se le pide a `repartir()`, que es
 * donde vive la regla de redondeo y donde dice, por escrito, que no se
 * re-litiga. Una segunda copia de `round(precio * pct / 100)` en una consulta
 * es exactamente como se separan dos numeros que tienen que ser el mismo.
 */
export const toVenueChip = (agregados: {
  entregado: string | null
  baratoPrecio: string | null
  baratoPct: string | null
}): VenueChip => {
  const precio = toNumber(agregados.baratoPrecio)
  const pct = toNumber(agregados.baratoPct)

  return {
    entregado: toNumber(agregados.entregado) ?? 0,
    materialDesde: precio === null || pct === null ? null : repartir(precio, pct).material,
  }
}

export const toVenueSummary = (row: VenueRow, chip: VenueChip = CHIP_VACIO): VenueSummary => ({
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
  chip,
  featured: row.featured,
  verified: row.verifiedAt !== null,
})

export const toVenue = (row: VenueRow): Venue => ({
  ...toVenueSummary(row),
  description: row.description,
  phone: row.phone,
  whatsapp: row.whatsapp,
  instagram: row.instagram,
  tiktok: row.tiktok,
  email: row.email,
  website: row.website,
  openingHours: row.openingHours,
  logoUrl: row.logoUrl,
  estimatedPerPersonNight:
    row.estimatedPerPersonNight === null ? null : Number(row.estimatedPerPersonNight),
  verifiedNote: row.verifiedNote,
})

export const toVenueAdminRow = (row: VenueRow): VenueAdminRow => ({
  ...toVenue(row),
  status: row.status as VenueStatus,
  publishedAt: row.publishedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})
