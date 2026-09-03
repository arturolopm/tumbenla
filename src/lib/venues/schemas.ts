import { z } from 'zod'

import { VENUE_STATUSES, VENUE_TYPES } from './types'

/**
 * Zod v4. Always safeParse, never parse, matching the rest of the repo.
 *
 * This used to also validate the venue-level pledge as a discriminated union,
 * so that 'percentage with no percentage' was unrepresentable. That whole
 * concept was retired (decision 34): a venue promises nothing, a product
 * declares its own split, and `venue_product.donationPercentage` is validated
 * where products are.
 */

/**
 * Colombia's bounding box, give or take. A mis-click on the map should not be
 * able to publish a bar in the Pacific Ocean.
 */
export const COLOMBIA_BOUNDS = {
  minLat: -4.3,
  maxLat: 13.6,
  minLng: -79.1,
  maxLng: -66.8,
} as const

export const latitudeSchema = z.coerce
  .number()
  .min(COLOMBIA_BOUNDS.minLat, 'La latitud queda fuera de Colombia')
  .max(COLOMBIA_BOUNDS.maxLat, 'La latitud queda fuera de Colombia')

export const longitudeSchema = z.coerce
  .number()
  .min(COLOMBIA_BOUNDS.minLng, 'La longitud queda fuera de Colombia')
  .max(COLOMBIA_BOUNDS.maxLng, 'La longitud queda fuera de Colombia')

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value ? value : null))

const venueBaseSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  type: z.enum(VENUE_TYPES),
  tagline: z.string().trim().max(140).optional().transform((v) => (v ? v : null)),
  description: optionalText,

  addressLine: z.string().trim().min(4, 'La dirección es obligatoria').max(200),
  neighborhood: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  city: z.string().trim().min(2, 'La ciudad es obligatoria').max(120),
  department: z.string().trim().min(2, 'El departamento es obligatorio').max(120),
  latitude: latitudeSchema,
  longitude: longitudeSchema,

  phone: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  whatsapp: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  instagram: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  tiktok: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  email: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
  website: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
  openingHours: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),

  coverImageUrl: z.string().trim().max(600).optional().transform((v) => (v ? v : null)),
  logoUrl: z.string().trim().max(600).optional().transform((v) => (v ? v : null)),

  /**
   * El aporte estimado por persona por noche.
   *
   * NULLABLE Y NUNCA CERO. Un sitio que no ha dado la cifra muestra sus noches
   * sin pesos, que es mejor que mostrar un numero que nos inventamos; y cero no
   * es "no se", cero es "no pongo nada", que de este sitio seria falso. El
   * vacio del formulario tiene que llegar como null, no como 0.
   */
  estimatedPerPersonNight: z
    .union([z.literal(''), z.coerce.number().gt(0, 'Tiene que ser mayor que cero')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),

  verifiedNote: optionalText,
  status: z.enum(VENUE_STATUSES).default('draft'),
})

// Era una interseccion con pledgeSchema. Al retirarse el compromiso queda el
// objeto pelado, y VenueInput deja de ser un tipo interseccion.
export const venueInputSchema = venueBaseSchema

export type VenueInput = z.infer<typeof venueInputSchema>

export const venueStatusSchema = z.enum(VENUE_STATUSES)
