'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { eq } from 'drizzle-orm'

import { db } from '@/database'
import { venueApplication, venueMember } from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { sendApplicationDecisionEmail } from '@/lib/messaging/email/mailer'
import { getApplication, tieneDueno } from '@/lib/venues/claims'
import { createVenue, setVenueStatus, updateVenue } from '@/lib/venues/mutations'
import { getVenueById } from '@/lib/venues/queries'
import { venueInputSchema, venueStatusSchema } from '@/lib/venues/schemas'

/**
 * Acciones del panel.
 *
 * CADA UNA EMPIEZA CON assertAdmin(). El gate del layout de (admin) no las
 * protege: una server action es un endpoint POST con su propio identificador,
 * y cualquiera que lo conozca puede invocarla sin pasar nunca por la pagina.
 *
 * Ninguna lanza. Todas devuelven el mismo resultado discriminado que el
 * formulario convierte en estado, que es la convencion del resto del repo.
 */

export type ActionState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string[]> }
  | { status: 'success'; venueId: string; slug: string }

/**
 * Las rutas publicas que dependen de la tabla venue. Se revalidan juntas porque
 * un sitio aparece en las tres y quedarian desincronizadas.
 *
 * Es el primer revalidatePath del repo, asi que hay que verificarlo contra el
 * deploy real temprano; el respaldo si fallara es el revalidate = 300 que ya
 * tienen las paginas, aceptable para un directorio.
 */
const revalidateVenue = (slug?: string) => {
  revalidatePath('/sitios')
  revalidatePath('/')
  if (slug) revalidatePath(`/sitios/${slug}`)
}

/** FormData plano -> objeto. Los vacios se quitan para que los .optional() del
 *  esquema hagan su trabajo en vez de recibir cadenas vacias. */
const toObject = (formData: FormData) => {
  const raw: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed !== '') raw[key] = trimmed
  }
  return raw
}

export const saveVenueAction = async (
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const id = formData.get('id')
  const parsed = venueInputSchema.safeParse(toObject(formData))

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: flattened.fieldErrors as Record<string, string[]>,
    }
  }

  // Si viene de aprobar una solicitud, guardar el sitio es TAMBIEN darle el
  // panel a quien la mando y cerrar la solicitud. Se hace aca y no en una
  // accion aparte para que no exista el estado intermedio "sitio creado pero
  // sin dueno", que es el que dejaria a alguien esperando para siempre.
  const solicitudId = formData.get('solicitudId')
  const solicitud =
    typeof solicitudId === 'string' && solicitudId ? await getApplication(solicitudId) : null

  if (typeof solicitudId === 'string' && solicitudId && !solicitud) {
    return { status: 'error', error: 'Esa solicitud ya no existe.' }
  }

  if (solicitud && solicitud.status === 'approved') {
    return { status: 'error', error: 'Esa solicitud ya estaba aprobada.' }
  }

  if (solicitud && solicitud.status === 'rejected') {
    return { status: 'error', error: 'Esa solicitud ya estaba rechazada.' }
  }

  // Entre que el operador abrio la pantalla y toco guardar pudieron pasar dias
  // y otro operador pudo aprobar a alguien mas para el mismo sitio.
  if (solicitud?.venueId && (await tieneDueno(solicitud.venueId))) {
    return { status: 'error', error: 'Ese sitio ya tiene dueño.' }
  }

  /**
   * Sin cuenta amarrada no se aprueba, y el orden importa.
   *
   * Desde la decision 35 una solicitud nace sin dueno y se amarra cuando esa
   * persona entra con el correo verificado. Aprobar es el acto que entrega la
   * propiedad, asi que sin cuenta no hay a quien entregarsela.
   *
   * VA ANTES DE CREAR EL SITIO, no despues. Si se revisara despues, el insert
   * de venue_member violaria su NOT NULL, caeria en el catch de mas abajo y
   * dejaria "el sitio quedo creado, pero no se pudo asignar al dueno": un sitio
   * huerfano y una solicitud todavia abierta, que es exactamente el estado
   * intermedio que el comentario de arriba dice que no puede existir.
   */
  if (solicitud && !solicitud.userId) {
    return {
      status: 'error',
      error:
        'Esa solicitud todavía no tiene cuenta. Pídele que la cree con el correo de contacto y el panel se le amarra solo al entrar.',
    }
  }

  // Se saca a una const aca, y no se lee de `solicitud` mas abajo, porque el
  // estrechamiento del guard de arriba no sobrevive a los `await` que vienen en
  // medio. Ademas deja dicho en una linea quien queda de dueno.
  const duenoId = solicitud?.userId ?? null

  let row: Awaited<ReturnType<typeof createVenue>>
  try {
    row =
      typeof id === 'string' && id
        ? await updateVenue(id, parsed.data)
        : await createVenue(parsed.data)
  } catch {
    return { status: 'error', error: 'No se pudo guardar el sitio. Intenta de nuevo.' }
  }

  if (solicitud && duenoId) {
    try {
      await db
        .insert(venueMember)
        .values({ venueId: row.id, userId: duenoId, role: 'owner' })
        .onConflictDoNothing()

      await db
        .update(venueApplication)
        .set({
          status: 'approved',
          venueId: row.id,
          reviewedAt: new Date(),
          reviewedByUserId: admin.userId,
          updatedAt: new Date(),
        })
        .where(eq(venueApplication.id, solicitud.id))
    } catch {
      // El sitio ya quedo creado. Se dice tal cual en vez de fingir que fallo
      // todo: el operador tiene que saber que existe y que falta el dueno.
      return {
        status: 'error',
        error: 'El sitio quedó creado, pero no se pudo asignar al dueño. Revísalo.',
      }
    }

    // El correo va de ultimo y su fallo no deshace nada: la aprobacion ya es
    // real y el operador puede avisarle por otro lado.
    try {
      await sendApplicationDecisionEmail({
        to: solicitud.contactEmail,
        venueName: row.name,
        aprobada: true,
      })
    } catch {
      // Sin efecto sobre la aprobacion.
    }

    revalidatePath('/admin/solicitudes')
    revalidatePath('/registrar-sitio')
  }

  revalidateVenue(row.slug)
  return { status: 'success', venueId: row.id, slug: row.slug }
}

export const setVenueStatusAction = async (
  id: string,
  status: string
): Promise<{ ok: boolean; error?: string }> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { ok: false, error: admin.error }

  const parsed = venueStatusSchema.safeParse(status)
  if (!parsed.success) return { ok: false, error: 'Estado invalido.' }

  // Se lee el slug ANTES de mutar: si el sitio se archiva, su ruta publica
  // tiene que revalidarse igual para que deje de servirse desde el cache.
  const current = await getVenueById(id)
  if (!current) return { ok: false, error: 'Ese sitio ya no existe.' }

  try {
    await setVenueStatus(id, parsed.data)
    revalidateVenue(current.slug)
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo cambiar el estado.' }
  }
}
