'use server'

import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { normalizarHandle } from '@/config/contacto'
import { db } from '@/database'
import { venue, venueApplication } from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'
import {
  sendApplicationDecisionEmail,
  sendApplicationDmRequestEmail,
} from '@/lib/messaging/email/mailer'
import { tieneDueno } from '@/lib/venues/claims'
import { VENUE_TYPES } from '@/lib/venues/types'

/**
 * El alta de un sitio.
 *
 * UNA SOLICITUD NO CREA EL SITIO, y no es una decision de diseno suelta: es la
 * consecuencia de que el formulario ya no pida ni el compromiso ni las
 * coordenadas. `venue.pledge_type`, `latitude` y `longitude` son NOT NULL, asi
 * que no hay fila que insertar todavia. El sitio nace cuando un operador
 * aprueba y completa lo que falta.
 *
 * De paso tapa un hueco real: cuando registrar creaba el sitio y daba la
 * propiedad en el acto, cualquiera podia apartar el nombre de un bar ajeno y el
 * buscador le decia al dueno de verdad "ya tiene dueno".
 *
 * COMO SE VERIFICA. Le pedimos a la persona que nos escriba por DM desde el
 * Instagram del bar. Ese DM prueba que quien escribe controla la cuenta; NO
 * prueba que sea quien lleno el formulario. Por eso el DM tiene que citar el
 * correo de contacto de la solicitud, y el operador lo compara. Son dos
 * comprobaciones distintas y hacen falta las dos.
 */

export type ReclamoState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string[]> }
  | { status: 'success'; mensaje: string; id: string }

const handleSchema = (etiqueta: string) =>
  z
    .string()
    .trim()
    .min(2, `${etiqueta} del sitio es obligatorio`)
    .max(120)
    .transform(normalizarHandle)
    .refine((v) => /^[a-z0-9._]+$/.test(v), {
      message: `${etiqueta} sólo puede tener letras, números, puntos y guión bajo`,
    })

const opcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))

/** Recorre error.cause hasta encontrar la restriccion, o se rinde. */
const esViolacionDeInstagram = (error: unknown): boolean => {
  let actual: unknown = error
  for (let i = 0; i < 5 && actual; i++) {
    const e = actual as { message?: string; constraint_name?: string; cause?: unknown }
    if (e.constraint_name === 'venue_application_instagram_vivas_key') return true
    if (e.message?.includes('venue_application_instagram_vivas_key')) return true
    actual = e.cause
  }
  return false
}

const solicitudSchema = z.object({
  // Lo obligatorio: el minimo para poder verificar y despues publicar.
  name: z.string().trim().min(2, 'El nombre del sitio es obligatorio').max(120),
  type: z.enum(VENUE_TYPES),
  city: z.string().trim().min(2, 'La ciudad es obligatoria').max(120),
  addressLine: z.string().trim().min(4, 'La dirección es obligatoria').max(200),
  instagram: handleSchema('El Instagram'),
  contactEmail: z.email('Ese correo no parece válido').transform((v) => v.trim().toLowerCase()),

  // Lo opcional: ayuda, no bloquea.
  tiktok: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? normalizarHandle(v) : null)),
  whatsapp: opcional(40),
  phone: opcional(40),
  neighborhood: opcional(120),
  website: opcional(300),
  openingHours: opcional(200),
  description: opcional(2000),
  /** Una IDEA, no un compromiso. No toca ninguna columna pledge_*. */
  pledgeIdea: opcional(1000),

  /** Solo si escogio un sitio que ya existe en el buscador. */
  venueId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
})

export const solicitarSitioAction = async (
  _previous: ReclamoState,
  formData: FormData
): Promise<ReclamoState> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { status: 'error', error: 'Inicia sesión para registrar tu sitio.' }
  if (!session.user.emailVerified) {
    return { status: 'error', error: 'Verifica tu correo antes de registrar tu sitio.' }
  }

  // Los vacios NO se descartan, a diferencia del formulario de admin. Si un
  // campo obligatorio llegara como `undefined`, Zod falla por tipo antes de
  // mirar el .min(), y la persona ve "expected string, received undefined" en
  // ingles en vez del mensaje que si escribimos. Los opcionales reciben '' y
  // sus .transform() lo vuelven null igual.
  const crudo: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    crudo[key] = value.trim()
  }

  const parsed = solicitudSchema.safeParse(crudo)
  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const datos = parsed.data

  // Si dice reclamar un sitio que ya existe, tiene que existir de verdad y no
  // tener dueno. El id viene del formulario, asi que se comprueba contra la
  // base antes de guardarlo.
  if (datos.venueId) {
    const [sitio] = await db
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.id, datos.venueId))
      .limit(1)

    if (!sitio) return { status: 'error', error: 'Ese sitio ya no existe.' }

    if (await tieneDueno(sitio.id)) {
      return {
        status: 'error',
        error: 'Ese sitio ya tiene dueño. Si crees que hay un error, escríbenos.',
      }
    }
  }

  // Su propia solicitud viva, si la tiene: volver a mandar el formulario la
  // actualiza en vez de chocar contra el indice unico consigo misma.
  const [propia] = await db
    .select({ id: venueApplication.id })
    .from(venueApplication)
    .where(
      and(
        eq(venueApplication.userId, session.user.id),
        sql`${venueApplication.status} in ('pending', 'verifying')`
      )
    )
    .limit(1)

  const valores = {
    userId: session.user.id,
    venueId: datos.venueId,
    name: datos.name,
    type: datos.type,
    city: datos.city,
    addressLine: datos.addressLine,
    instagram: datos.instagram,
    contactEmail: datos.contactEmail,
    tiktok: datos.tiktok,
    whatsapp: datos.whatsapp,
    phone: datos.phone,
    neighborhood: datos.neighborhood,
    website: datos.website,
    openingHours: datos.openingHours,
    description: datos.description,
    pledgeIdea: datos.pledgeIdea,
  }

  try {
    if (propia) {
      await db
        .update(venueApplication)
        .set({ ...valores, updatedAt: new Date() })
        .where(eq(venueApplication.id, propia.id))

      revalidatePath('/registrar-sitio')
      revalidatePath('/admin/solicitudes')
      return { status: 'success', mensaje: 'Solicitud actualizada.', id: propia.id }
    }

    const [fila] = await db.insert(venueApplication).values(valores).returning({
      id: venueApplication.id,
    })

    revalidatePath('/registrar-sitio')
    revalidatePath('/admin/solicitudes')
    return { status: 'success', mensaje: 'Solicitud enviada.', id: fila.id }
  } catch (error) {
    // El indice unico parcial sobre lower(instagram) es lo unico que puede
    // fallar aca de forma esperable: significa que OTRA persona ya tiene una
    // solicitud viva por esa cuenta.
    //
    // SE RECORRE LA CADENA DE `cause`: drizzle envuelve el error del driver en
    // un DrizzleQueryError cuyo message es "Failed query: insert into ...", y
    // el nombre de la restriccion solo aparece en el error de postgres-js que
    // va adentro. Mirar solo el primer nivel dejaba caer este caso en el
    // mensaje generico de "intenta de nuevo", que aqui es justo el consejo
    // equivocado: volver a intentar no lo va a arreglar.
    if (esViolacionDeInstagram(error)) {
      return {
        status: 'error',
        error:
          'Ya hay una solicitud en curso para esa cuenta de Instagram. Si es tu sitio, escríbenos.',
        fieldErrors: { instagram: ['Ya hay una solicitud en curso para esta cuenta'] },
      }
    }
    return { status: 'error', error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }
}

// ------------------------------------------------------------- el operador

export type DecisionState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; mensaje: string }

/** "Escríbenos por DM": pasa a `verifying` y le manda la instruccion por correo. */
export const pedirVerificacionAction = async (id: string): Promise<DecisionState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const [solicitud] = await db
    .select({
      id: venueApplication.id,
      status: venueApplication.status,
      name: venueApplication.name,
      instagram: venueApplication.instagram,
      contactEmail: venueApplication.contactEmail,
    })
    .from(venueApplication)
    .where(eq(venueApplication.id, id))
    .limit(1)

  if (!solicitud) return { status: 'error', error: 'Esa solicitud ya no existe.' }
  if (solicitud.status === 'approved' || solicitud.status === 'rejected') {
    return { status: 'error', error: 'Esa solicitud ya estaba resuelta.' }
  }

  try {
    await db
      .update(venueApplication)
      .set({ status: 'verifying', updatedAt: new Date() })
      .where(eq(venueApplication.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo actualizar la solicitud.' }
  }

  // El correo va despues de guardar y su fallo no deshace el cambio de estado:
  // el operador puede reenviarlo, y al reves quedarian correos hablando de un
  // estado que no llego a existir.
  try {
    await sendApplicationDmRequestEmail({
      to: solicitud.contactEmail,
      venueName: solicitud.name,
      instagram: solicitud.instagram,
    })
  } catch {
    revalidatePath('/admin/solicitudes')
    return {
      status: 'error',
      error: 'Quedó marcada como "esperando DM", pero el correo no salió.',
    }
  }

  revalidatePath('/admin/solicitudes')
  revalidatePath('/registrar-sitio')
  return { status: 'success', mensaje: 'Le pedimos el DM por correo.' }
}

export const rechazarSolicitudAction = async (
  id: string,
  nota?: string
): Promise<DecisionState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const [solicitud] = await db
    .select({
      id: venueApplication.id,
      status: venueApplication.status,
      name: venueApplication.name,
      contactEmail: venueApplication.contactEmail,
    })
    .from(venueApplication)
    .where(eq(venueApplication.id, id))
    .limit(1)

  if (!solicitud) return { status: 'error', error: 'Esa solicitud ya no existe.' }
  if (solicitud.status === 'approved' || solicitud.status === 'rejected') {
    return { status: 'error', error: 'Esa solicitud ya estaba resuelta.' }
  }

  try {
    await db
      .update(venueApplication)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedByUserId: admin.userId,
        reviewNote: nota?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(venueApplication.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo rechazar la solicitud.' }
  }

  try {
    await sendApplicationDecisionEmail({
      to: solicitud.contactEmail,
      venueName: solicitud.name,
      aprobada: false,
      nota: nota?.trim() || undefined,
    })
  } catch {
    // El rechazo ya quedo guardado; que el correo falle no lo revierte.
  }

  revalidatePath('/admin/solicitudes')
  revalidatePath('/registrar-sitio')
  return { status: 'success', mensaje: 'Rechazada.' }
}
