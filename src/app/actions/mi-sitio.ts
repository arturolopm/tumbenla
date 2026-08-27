'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/database'
import { venue } from '@/database/schema'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { updateVenue } from '@/lib/venues/mutations'
import { venueInputSchema } from '@/lib/venues/schemas'
import type { ActionState } from './venues'

/**
 * El sitio editando su propio perfil.
 *
 * ES UNA ACCION APARTE DE saveVenueAction Y NO UN PARAMETRO SUYO. Aquella
 * empieza con assertAdmin() y esta con assertVenueAccess(); si fueran la misma
 * funcion con una bandera, la bandera vendria del formulario y elegiria su
 * propia comprobacion, que es justo lo que no puede pasar.
 *
 * LO QUE EL SITIO NO PUEDE TOCAR, aunque lo mande:
 *
 *   status        - publicar es de la plataforma. Un sitio que se publica solo
 *                   se salta la verificacion del compromiso, que es lo unico
 *                   que respalda lo que el mapa afirma de el.
 *   verifiedNote  - es NUESTRA nota de como confirmamos ese compromiso. Que la
 *                   escribiera el propio sitio la vaciaria de sentido.
 *
 * No se confia en que el formulario no los pinte: se leen de la base y se
 * sobrescriben lo que haya llegado. Un input oculto agregado a mano no puede
 * publicar un sitio.
 */

const toObject = (formData: FormData) => {
  const raw: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed !== '') raw[key] = trimmed
  }
  return raw
}

export const saveMyVenueAction = async (
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) {
    return { status: 'error', error: 'Falta el sitio.' }
  }

  // El id viene del formulario, pero lo unico que se hace con el es LEER la
  // fila; el permiso se comprueba contra el venueId de esa fila. Mandar el id
  // de otro sitio no da acceso a ese otro sitio: da un rechazo.
  const [actual] = await db
    .select({
      id: venue.id,
      slug: venue.slug,
      status: venue.status,
      verifiedNote: venue.verifiedNote,
    })
    .from(venue)
    .where(eq(venue.id, id))
    .limit(1)

  if (!actual) return { status: 'error', error: 'Ese sitio ya no existe.' }

  const acceso = await assertVenueAccess(actual.id)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  const parsed = venueInputSchema.safeParse({
    ...toObject(formData),
    // Los dos campos de plataforma, tomados de la base y no del formulario.
    status: actual.status,
    verifiedNote: actual.verifiedNote ?? undefined,
  })

  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    const row = await updateVenue(actual.id, parsed.data)

    revalidatePath(`/panel/${row.slug}/sitio`)
    revalidatePath(`/panel/${row.slug}`)
    // El perfil publico solo cambia si el sitio esta publicado, pero revalidar
    // de mas no cuesta nada y olvidarlo deja el mapa mostrando datos viejos.
    revalidatePath('/sitios')
    revalidatePath(`/sitios/${row.slug}`)
    revalidatePath('/')

    return { status: 'success', venueId: row.id, slug: row.slug }
  } catch {
    return { status: 'error', error: 'No se pudo guardar. Intenta de nuevo.' }
  }
}
