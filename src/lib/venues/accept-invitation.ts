import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { venue, venueInvitation, venueMember } from '@/database/schema'
import { type MotivoInvalida, hashDeToken } from './invitations'

/**
 * Leer y aceptar una invitacion.
 *
 * VIVE FUERA DE LA PAGINA a proposito. Pintar la invitacion y aceptarla tienen
 * que aplicar EXACTAMENTE las mismas comprobaciones, y cuando la logica estaba
 * escrita dos veces —una en el cuerpo de la pagina y otra en la server action—
 * nada garantizaba que siguieran iguales despues del primer cambio. Aca hay una
 * sola copia, y ademas se puede ejercitar sin navegador.
 *
 * LAS DOS PUERTAS, otra vez, porque son el punto entero de este archivo:
 * el token tiene que ser valido (existe, no vencida, no revocada, no usada) Y
 * el correo de la sesion tiene que ser el correo invitado. Un enlace de correo
 * no puede ser la unica prueba de identidad: se reenvia.
 */

export type InvitacionValida = {
  id: string
  venueId: string
  venueSlug: string
  venueNombre: string
  email: string
  role: 'owner' | 'staff'
}

export type LecturaInvitacion =
  | { ok: true; invitacion: InvitacionValida }
  | { ok: false; motivo: MotivoInvalida }

/**
 * @param emailSesion correo de quien esta mirando, ya en minusculas.
 */
export const leerInvitacion = async (
  token: string,
  emailSesion: string
): Promise<LecturaInvitacion> => {
  const tokenHash = await hashDeToken(token)

  const [fila] = await db
    .select({
      id: venueInvitation.id,
      venueId: venueInvitation.venueId,
      email: venueInvitation.email,
      role: venueInvitation.role,
      expiresAt: venueInvitation.expiresAt,
      acceptedAt: venueInvitation.acceptedAt,
      revokedAt: venueInvitation.revokedAt,
      venueSlug: venue.slug,
      venueNombre: venue.name,
    })
    .from(venueInvitation)
    .innerJoin(venue, eq(venueInvitation.venueId, venue.id))
    .where(eq(venueInvitation.tokenHash, tokenHash))
    .limit(1)

  if (!fila) return { ok: false, motivo: 'no_existe' }
  if (fila.revokedAt) return { ok: false, motivo: 'revocada' }
  if (fila.acceptedAt) return { ok: false, motivo: 'usada' }
  if (fila.expiresAt < new Date()) return { ok: false, motivo: 'vencida' }
  if (fila.email !== emailSesion.trim().toLowerCase()) {
    return { ok: false, motivo: 'otro_correo' }
  }

  return {
    ok: true,
    invitacion: {
      id: fila.id,
      venueId: fila.venueId,
      venueSlug: fila.venueSlug,
      venueNombre: fila.venueNombre,
      email: fila.email,
      role: fila.role === 'owner' ? 'owner' : 'staff',
    },
  }
}

export type Aceptacion = { ok: true; venueSlug: string } | { ok: false; motivo: MotivoInvalida }

/**
 * Aceptar. Vuelve a leer antes de escribir, y no es paranoia de mas: entre que
 * se pinto la pagina y llego este POST pudieron pasar dias, y la invitacion
 * pudo revocarse justo en medio.
 */
export const aceptarInvitacion = async (
  token: string,
  userId: string,
  emailSesion: string
): Promise<Aceptacion> => {
  const lectura = await leerInvitacion(token, emailSesion)
  if (!lectura.ok) return lectura

  const { invitacion } = lectura

  await db
    .insert(venueMember)
    .values({
      venueId: invitacion.venueId,
      userId,
      role: invitacion.role,
    })
    // Aceptar dos veces es un doble clic, no un error. El indice unico
    // (venue_id, user_id) lo convierte en algo inofensivo en vez de un 500.
    .onConflictDoNothing()

  await db
    .update(venueInvitation)
    .set({ acceptedAt: new Date(), updatedAt: new Date() })
    // El isNull no sobra: si dos peticiones llegan a la vez, las dos pasaron la
    // lectura de arriba, y sin el la segunda pisaria la fecha de la primera con
    // la suya. Marca cuando se acepto de verdad, no cuando se toco por ultima vez.
    .where(and(eq(venueInvitation.id, invitacion.id), isNull(venueInvitation.acceptedAt)))

  return { ok: true, venueSlug: invitacion.venueSlug }
}
