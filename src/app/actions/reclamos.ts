'use server'

import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { normalizarHandle } from '@/config/contacto'
import { generarToken } from '@/lib/venues/invitations'
import { db } from '@/database'
import { venue, venueApplication } from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'
import {
  sendApplicationDecisionEmail,
  sendApplicationDmRequestEmail,
} from '@/lib/messaging/email/mailer'
import { tieneDueno } from '@/lib/venues/claims'

/**
 * El alta de un sitio.
 *
 * SON CUATRO CAMPOS (decision 35): nombre, Instagram, correo y WhatsApp. Cada
 * uno hace falta para verificar a quien escribe o para contestarle, y nada mas
 * entra por aca.
 *
 * UNA SOLICITUD NO CREA EL SITIO. `latitude` y `longitude` son NOT NULL y el
 * formulario no las pide, asi que no hay fila que insertar todavia. El sitio
 * nace cuando un operador aprueba y completa lo que falta.
 *
 * Y NO SE PIDE CUENTA PARA MANDARLA. Antes habia que registrarse y verificar el
 * correo antes de VER el formulario, o sea el paso mas caro primero. La
 * solicitud nace sin dueno y se amarra cuando esa persona entra con el correo
 * verificado, con el mismo mecanismo de los pedidos de invitado (decision 29b).
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
  | { status: 'success'; mensaje: string; id: string; token: string }

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
/**
 * Si el error que reboto es la violacion de ESTA restriccion.
 *
 * SE RECORRE LA CADENA DE `cause`: drizzle envuelve el error del driver en un
 * DrizzleQueryError cuyo message es "Failed query: insert into ...", y el
 * nombre de la restriccion solo aparece en el error de postgres-js que va
 * adentro. Mirar solo el primer nivel deja caer el caso en el mensaje generico
 * de "intenta de nuevo", que aqui es justo el consejo equivocado: volver a
 * intentar no lo va a arreglar.
 */
const violaRestriccion = (error: unknown, nombre: string): boolean => {
  let actual: unknown = error
  for (let i = 0; i < 5 && actual; i++) {
    const e = actual as { message?: string; constraint_name?: string; cause?: unknown }
    if (e.constraint_name === nombre) return true
    if (e.message?.includes(nombre)) return true
    actual = e.cause
  }
  return false
}

const solicitudSchema = z.object({
  // Los cuatro, y nada mas. Cada uno se gana el puesto: el nombre para buscar
  // el sitio, el Instagram porque es el instrumento de verificacion, el correo
  // porque es lo que el DM tiene que citar Y por donde la solicitud se amarra a
  // una cuenta, y el WhatsApp porque es por donde de verdad contesta un bar en
  // Manizales cuando la solicitud se queda quieta.
  name: z.string().trim().min(2, 'El nombre del sitio es obligatorio').max(120),
  instagram: handleSchema('El Instagram'),
  contactEmail: z.email('Ese correo no parece válido').transform((v) => v.trim().toLowerCase()),
  // Se pide, pero no bloquea: un bar que solo atiende por DM de Instagram no
  // tiene por que quedarse afuera, y el DM es el filtro de verdad.
  whatsapp: opcional(40),

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
  // La sesion se lee, pero NO se exige (decision 35). Si la hay, la solicitud
  // nace amarrada y esa persona nunca pasa por el amarre diferido. Si no, nace
  // sin dueno y se amarra despues, al entrar con el correo verificado.
  const session = await auth.api.getSession({ headers: await headers() })

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

  /**
   * Su propia solicitud viva: volver a mandar el formulario la actualiza en vez
   * de chocar contra el indice unico consigo misma.
   *
   * SOLO CON SESION, y esto no es una limitacion que sobro: es un hueco de
   * apropiacion si se hiciera por correo. Sin cuenta de por medio, cualquiera
   * que sepa el correo de contacto de un bar podria volver a mandar el
   * formulario y reescribirle el Instagram a una solicitud viva ajena. Con
   * sesion se busca por userId, que no se puede escribir desde el formulario.
   * Sin sesion, solo se inserta.
   */
  const [propia] = session
    ? await db
        .select({ id: venueApplication.id })
        .from(venueApplication)
        .where(
          and(
            eq(venueApplication.userId, session.user.id),
            sql`${venueApplication.status} in ('pending', 'verifying')`
          )
        )
        .limit(1)
    : []

  const valores = {
    userId: session?.user.id ?? null,
    venueId: datos.venueId,
    name: datos.name,
    instagram: datos.instagram,
    contactEmail: datos.contactEmail,
    whatsapp: datos.whatsapp,
    // Por donde vuelve a su solicitud quien la mando sin cuenta. Se genera
    // siempre, no solo para los invitados: una sola forma de enlazar es una
    // rama menos que mantener.
    publicToken: generarToken(),
  }

  try {
    if (propia) {
      await db
        .update(venueApplication)
        .set({ ...valores, updatedAt: new Date() })
        .where(eq(venueApplication.id, propia.id))

      revalidatePath('/registrar-sitio')
      revalidatePath('/admin/solicitudes')
      return {
        status: 'success',
        mensaje: 'Solicitud actualizada.',
        id: propia.id,
        token: valores.publicToken,
      }
    }

    const [fila] = await db.insert(venueApplication).values(valores).returning({
      id: venueApplication.id,
      publicToken: venueApplication.publicToken,
    })

    revalidatePath('/registrar-sitio')
    revalidatePath('/admin/solicitudes')
    return {
      status: 'success',
      mensaje: 'Solicitud enviada.',
      id: fila.id,
      token: fila.publicToken ?? valores.publicToken,
    }
  } catch (error) {
    // Los dos indices unicos parciales son lo unico que puede fallar aca de
    // forma esperable. El del correo es nuevo y hace el trabajo que antes hacia
    // gratis la sesion: una sola solicitud viva por persona.
    if (violaRestriccion(error, 'venue_application_email_vivas_key')) {
      return {
        status: 'error',
        error: 'Ya hay una solicitud en curso con ese correo. Revísala, o escríbenos.',
        fieldErrors: { contactEmail: ['Ya hay una solicitud en curso con este correo'] },
      }
    }

    if (violaRestriccion(error, 'venue_application_instagram_vivas_key')) {
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
