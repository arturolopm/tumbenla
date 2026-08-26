'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/database'
import { venue, venueClaimRequest, venueMember } from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'
import { tieneDueno } from '@/lib/venues/claims'
import { createVenue } from '@/lib/venues/mutations'
import { venueInputSchema } from '@/lib/venues/schemas'
import type { ActionState } from './venues'

/**
 * Registrar un sitio y reclamarlo.
 *
 * DOS CAMINOS, Y NO SE COMPORTAN IGUAL A PROPOSITO:
 *
 *   Sitio que NO existe todavia -> lo crea quien lo registra, y queda de dueno
 *   en el acto. No hay nada que verificar sobre la propiedad: acaba de escribir
 *   el sitio entero. Nace en 'draft', invisible, hasta que la plataforma lo
 *   publique.
 *
 *   Sitio que YA existe -> solicitud, y la revisa un operador. Aca la propiedad
 *   SI esta en duda: cualquiera podria decir que el bar de la esquina es suyo.
 *
 * En los dos casos publicar sigue siendo de la plataforma. Es lo unico que
 * respalda lo que el mapa afirma de un sitio, y por eso no se delega.
 */

export type ReclamoState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; mensaje: string }

const solicitudSchema = z.object({
  venueId: z.string().min(1),
  message: z.string().trim().max(1000).optional(),
  evidenceUrl: z.string().trim().max(600).optional(),
})

export const solicitarSitioAction = async (
  _previous: ReclamoState,
  formData: FormData
): Promise<ReclamoState> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { status: 'error', error: 'Inicia sesión para reclamar un sitio.' }
  if (!session.user.emailVerified) {
    return { status: 'error', error: 'Verifica tu correo antes de reclamar un sitio.' }
  }

  const parsed = solicitudSchema.safeParse({
    venueId: formData.get('venueId'),
    message: formData.get('message') ?? undefined,
    evidenceUrl: formData.get('evidenceUrl') ?? undefined,
  })

  if (!parsed.success) return { status: 'error', error: 'Revisa los datos.' }

  const [sitio] = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.id, parsed.data.venueId))
    .limit(1)

  if (!sitio) return { status: 'error', error: 'Ese sitio ya no existe.' }

  // Un sitio con dueno no admite otra solicitud. Aceptarla solo generaria una
  // cola de reclamos que el operador tendria que rechazar de a uno.
  if (await tieneDueno(sitio.id)) {
    return {
      status: 'error',
      error: 'Ese sitio ya tiene dueño. Si crees que hay un error, escríbenos.',
    }
  }

  try {
    await db
      .insert(venueClaimRequest)
      .values({
        venueId: sitio.id,
        userId: session.user.id,
        message: parsed.data.message ?? null,
        evidenceUrl: parsed.data.evidenceUrl ?? null,
      })
      // El indice unico (venue_id, user_id) hace que volver a pedir el mismo
      // sitio actualice en vez de llenar la cola de copias.
      .onConflictDoUpdate({
        target: [venueClaimRequest.venueId, venueClaimRequest.userId],
        set: {
          message: parsed.data.message ?? null,
          evidenceUrl: parsed.data.evidenceUrl ?? null,
          status: 'pending',
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNote: null,
          updatedAt: new Date(),
        },
      })
  } catch {
    return { status: 'error', error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  revalidatePath('/registrar-sitio')
  revalidatePath('/admin/solicitudes')

  return {
    status: 'success',
    mensaje: 'Solicitud enviada. Te escribimos cuando la revisemos.',
  }
}

/**
 * Registrar un sitio nuevo.
 *
 * El estado se fuerza a 'draft' pase lo que pase en el formulario: el
 * formulario de registro no pinta el selector, pero eso es cortesia, no
 * seguridad. Sin este override, agregar un input oculto publicaria un sitio
 * saltandose la verificacion.
 */
export const registrarSitioAction = async (
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { status: 'error', error: 'Inicia sesión para registrar tu sitio.' }
  if (!session.user.emailVerified) {
    return { status: 'error', error: 'Verifica tu correo antes de registrar tu sitio.' }
  }

  const raw: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed !== '') raw[key] = trimmed
  }

  const parsed = venueInputSchema.safeParse({
    ...raw,
    status: 'draft',
    // La nota de verificacion es NUESTRA constancia de como confirmamos el
    // compromiso. No la escribe quien se registra.
    verifiedNote: undefined,
  })

  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  let slug: string
  try {
    const row = await createVenue(parsed.data)
    slug = row.slug

    // Queda de dueno de una vez: acaba de escribir el sitio entero, no hay
    // propiedad en disputa. Lo que falta verificar es el compromiso, y eso se
    // resuelve publicando, que sigue siendo nuestro.
    await db.insert(venueMember).values({
      venueId: row.id,
      userId: session.user.id,
      role: 'owner',
    })
  } catch {
    return { status: 'error', error: 'No se pudo registrar el sitio. Intenta de nuevo.' }
  }

  revalidatePath('/admin/sitios')
  redirect(`/panel/${slug}`)
}

/** El operador resolviendo la cola. */
export const resolverSolicitudAction = async (
  requestId: string,
  decision: 'approved' | 'rejected',
  nota?: string
): Promise<ReclamoState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const [solicitud] = await db
    .select({
      id: venueClaimRequest.id,
      venueId: venueClaimRequest.venueId,
      userId: venueClaimRequest.userId,
      status: venueClaimRequest.status,
    })
    .from(venueClaimRequest)
    .where(eq(venueClaimRequest.id, requestId))
    .limit(1)

  if (!solicitud) return { status: 'error', error: 'Esa solicitud ya no existe.' }
  if (solicitud.status !== 'pending') {
    return { status: 'error', error: 'Esa solicitud ya estaba resuelta.' }
  }

  // Se vuelve a mirar aca y no solo al pintar la cola: entre que el operador
  // abrio la pagina y toco el boton, otro operador pudo aprobar otra solicitud
  // del mismo sitio.
  if (decision === 'approved' && (await tieneDueno(solicitud.venueId))) {
    return { status: 'error', error: 'Ese sitio ya tiene dueño. Quítalo antes de aprobar.' }
  }

  try {
    if (decision === 'approved') {
      await db
        .insert(venueMember)
        .values({
          venueId: solicitud.venueId,
          userId: solicitud.userId,
          role: 'owner',
        })
        .onConflictDoNothing()
    }

    await db
      .update(venueClaimRequest)
      .set({
        status: decision,
        reviewedAt: new Date(),
        reviewedByUserId: admin.userId,
        reviewNote: nota?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(venueClaimRequest.id, requestId))
  } catch {
    return { status: 'error', error: 'No se pudo resolver la solicitud.' }
  }

  revalidatePath('/admin/solicitudes')

  return {
    status: 'success',
    mensaje:
      decision === 'approved'
        ? 'Aprobada. Ya puede administrar su sitio; publícalo cuando confirmes el compromiso.'
        : 'Rechazada.',
  }
}
