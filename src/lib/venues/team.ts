import 'server-only'

import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { user, venueInvitation, venueMember } from '@/database/schema'

/** El equipo de un sitio, duenos primero. */
export const listTeam = async (venueId: string) => {
  return db
    .select({
      memberId: venueMember.id,
      userId: venueMember.userId,
      nombre: user.name,
      email: user.email,
      role: venueMember.role,
      desde: venueMember.createdAt,
    })
    .from(venueMember)
    .innerJoin(user, eq(venueMember.userId, user.id))
    .where(eq(venueMember.venueId, venueId))
    // 'owner' < 'staff' alfabeticamente, asi que asc deja a los duenos arriba.
    .orderBy(asc(venueMember.role), asc(user.name))
}

/**
 * Las invitaciones que todavia estan abiertas.
 *
 * Las aceptadas y las revocadas no se listan: la aceptada ya es una fila del
 * equipo y mostrarla dos veces confunde, y la revocada ya no existe para nadie.
 * Las vencidas SI aparecen, marcadas, porque el dueno tiene que poder ver que
 * esa persona nunca entro y volver a invitarla.
 */
export const listPendingInvitations = async (venueId: string) => {
  return db
    .select({
      id: venueInvitation.id,
      email: venueInvitation.email,
      role: venueInvitation.role,
      expiresAt: venueInvitation.expiresAt,
      createdAt: venueInvitation.createdAt,
    })
    .from(venueInvitation)
    .where(
      and(
        eq(venueInvitation.venueId, venueId),
        isNull(venueInvitation.acceptedAt),
        isNull(venueInvitation.revokedAt)
      )
    )
    .orderBy(desc(venueInvitation.createdAt))
}
