'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/admin'
import { sendApplicationDecisionEmail } from '@/lib/messaging/email/mailer'
import {
  VenueApplicationApprovalError,
  approveVenueApplication,
} from '@/lib/venues/approve-application'
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

  let row: Awaited<ReturnType<typeof createVenue>>
  let applicationDecision: { contactEmail: string; ownerIsReady: boolean } | null = null

  try {
    const applicationId = formData.get('solicitudId')

    if (typeof applicationId === 'string' && applicationId) {
      const approved = await approveVenueApplication({
        applicationId,
        adminUserId: admin.userId,
        input: parsed.data,
      })
      row = approved.venue
      applicationDecision = {
        contactEmail: approved.contactEmail,
        ownerIsReady: approved.ownerIsReady,
      }
    } else {
      row =
        typeof id === 'string' && id
          ? await updateVenue(id, parsed.data)
          : await createVenue(parsed.data)
    }
  } catch (error) {
    if (error instanceof VenueApplicationApprovalError) {
      return { status: 'error', error: error.message }
    }
    return { status: 'error', error: 'No se pudo guardar el sitio. Intenta de nuevo.' }
  }

  if (applicationDecision) {
    // A decision is durable before email is attempted. Mail is only a
    // notification; the account can still claim its approved venue at /entrar.
    try {
      await sendApplicationDecisionEmail({
        to: applicationDecision.contactEmail,
        venueName: row.name,
        approved: true,
        ownerIsReady: applicationDecision.ownerIsReady,
      })
    } catch {
      // The approval remains valid if the provider fails.
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
