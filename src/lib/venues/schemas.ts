import { z } from 'zod'

import { PLEDGE_BASES, PLEDGE_UNITS, VENUE_STATUSES, VENUE_TYPES } from './types'

/**
 * Zod v4. Always safeParse, never parse, matching the rest of the repo.
 *
 * The pledge is validated as a discriminated union rather than as loose
 * optional fields, so 'percentage with no percentage' is unrepresentable rather
 * than merely discouraged. The database cannot express that constraint here
 * because this schema uses no pgEnum and no check constraints.
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

const pledgeSchema = z.discriminatedUnion('pledgeType', [
  z.object({
    pledgeType: z.literal('percentage'),
    pledgePercentage: z.coerce
      .number()
      .gt(0, 'El porcentaje tiene que ser mayor que cero')
      .max(100, 'El porcentaje no puede pasar de 100'),
    pledgeBasis: z.enum(PLEDGE_BASES).optional(),
    pledgeNote: optionalText,
  }),
  z.object({
    pledgeType: z.literal('fixed_per_unit'),
    pledgeAmount: z.coerce.number().gt(0, 'El monto tiene que ser mayor que cero'),
    pledgeUnit: z.enum(PLEDGE_UNITS),
    pledgeNote: optionalText,
  }),
])

const venueBaseSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  type: z.enum(VENUE_TYPES),
  tagline: z.string().trim().max(140).optional().transform((v) => (v ? v : null)),
  description: optionalText,

  addressLine: z.string().trim().min(4, 'La direccion es obligatoria').max(200),
  neighborhood: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  city: z.string().trim().min(2, 'La ciudad es obligatoria').max(120),
  department: z.string().trim().min(2, 'El departamento es obligatorio').max(120),
  latitude: latitudeSchema,
  longitude: longitudeSchema,

  phone: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  whatsapp: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  instagram: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  website: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
  openingHours: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),

  coverImageUrl: z.string().trim().max(600).optional().transform((v) => (v ? v : null)),
  logoUrl: z.string().trim().max(600).optional().transform((v) => (v ? v : null)),

  verifiedNote: optionalText,
  status: z.enum(VENUE_STATUSES).default('draft'),
})

export const venueInputSchema = z.intersection(venueBaseSchema, pledgeSchema)

export type VenueInput = z.infer<typeof venueInputSchema>

export const venueStatusSchema = z.enum(VENUE_STATUSES)
