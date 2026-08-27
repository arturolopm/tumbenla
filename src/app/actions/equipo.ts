'use server'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import { user, venue, venueInvitation, venueMember } from '@/database/schema'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { sendVenueInvitationEmail } from '@/lib/messaging/email/mailer'
import {
  fechaDeVencimiento,
  generarToken,
  hashDeToken,
} from '@/lib/venues/invitations'

/**
 * El equipo de un sitio: invitar, revocar, cambiar de rol y sacar.
 *
 * TODO ESTO ES SOLO DEL DUENO. El personal hace el dia a dia —noches, fotos,
 * aportes— pero no decide quien mas entra. Se pasa ['owner'] a
 * assertVenueAccess en cada accion, y el operador de la plataforma pasa igual,
 * que es lo que permite destrabar un sitio cuyo dueno perdio el correo.
 *
 * Como en venues.ts: ninguna lanza, cada una comprueba por su cuenta, y el
 * venueId se valida contra la fila real y no contra lo que traiga el
 * formulario. Ver la regla grande en src/lib/auth/venue-access.ts.
 */

export type EquipoState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; mensaje: string }

const invitacionSchema = z.object({
  venueId: z.string().min(1),
  email: z.email('Ese correo no parece válido.').transform((v) => v.trim().toLowerCase()),
  role: z.enum(['owner', 'staff']),
})

const revalidarEquipo = (slug: string) => {
  revalidatePath(`/panel/${slug}/equipo`)
}

/** El slug del sitio, para revalidar. Se lee de la base, nunca del formulario. */
const slugDelSitio = async (venueId: string) => {
  const [fila] = await db
    .select({ slug: venue.slug })
    .from(venue)
    .where(eq(venue.id, venueId))
    .limit(1)
  return fila?.slug ?? null
}

export const invitarAlEquipoAction = async (
  _previous: EquipoState,
  formData: FormData
): Promise<EquipoState> => {
  const parsed = invitacionSchema.safeParse({
    venueId: formData.get('venueId'),
    email: formData.get('email'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const { venueId, email, role } = parsed.data

  const acceso = await assertVenueAccess(venueId, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  const slug = await slugDelSitio(venueId)
  if (!slug) return { status: 'error', error: 'Ese sitio ya no existe.' }

  // Si esa persona ya esta adentro, una invitacion no aporta nada y ademas
  // confunde: llega un correo para entrar a un sitio en el que ya se trabaja.
  const [yaEsta] = await db
    .select({ id: venueMember.id })
    .from(venueMember)
    .innerJoin(user, eq(venueMember.userId, user.id))
    .where(and(eq(venueMember.venueId, venueId), eq(sql`lower(${user.email})`, email)))
    .limit(1)

  if (yaEsta) {
    return { status: 'error', error: 'Esa persona ya está en el equipo.' }
  }

  const token = generarToken()
  const tokenHash = await hashDeToken(token)

  try {
    // Una invitacion pendiente anterior al mismo correo se revoca: si no, dos
    // enlaces distintos abren la misma puerta y revocar uno no cierra nada.
    await db
      .update(venueInvitation)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(venueInvitation.venueId, venueId),
          eq(venueInvitation.email, email),
          isNull(venueInvitation.acceptedAt),
          isNull(venueInvitation.revokedAt)
        )
      )

    await db.insert(venueInvitation).values({
      venueId,
      email,
      role,
      tokenHash,
      invitedByUserId: acceso.acceso.userId,
      expiresAt: fechaDeVencimiento(),
    })
  } catch {
    return { status: 'error', error: 'No se pudo crear la invitación. Intenta de nuevo.' }
  }

  // El correo va DESPUES de guardar y su fallo no deshace la invitacion: el
  // enlace ya es valido y el dueno puede reenviarlo. Al reves —mandar primero—
  // dejaria correos con enlaces que no existen.
  const [sitio] = await db
    .select({ nombre: venue.name })
    .from(venue)
    .where(eq(venue.id, venueId))
    .limit(1)

  try {
    await sendVenueInvitationEmail({
      to: email,
      venueName: sitio?.nombre ?? 'un sitio',
      role,
      token,
    })
  } catch {
    revalidarEquipo(slug)
    return {
      status: 'error',
      error: 'La invitación quedó creada, pero el correo no salió. Reenvíala.',
    }
  }

  revalidarEquipo(slug)
  return { status: 'success', mensaje: `Invitación enviada a ${email}.` }
}

export const revocarInvitacionAction = async (invitationId: string): Promise<EquipoState> => {
  // El venueId sale de la FILA, no de quien llama. Sin esto, mandar el id de
  // una invitacion de otro sitio la revocaria desde aca.
  const [fila] = await db
    .select({ venueId: venueInvitation.venueId })
    .from(venueInvitation)
    .where(eq(venueInvitation.id, invitationId))
    .limit(1)

  if (!fila) return { status: 'error', error: 'Esa invitación ya no existe.' }

  const acceso = await assertVenueAccess(fila.venueId, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  const slug = await slugDelSitio(fila.venueId)

  try {
    await db
      .update(venueInvitation)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(venueInvitation.id, invitationId), isNull(venueInvitation.acceptedAt)))
  } catch {
    return { status: 'error', error: 'No se pudo cancelar la invitación.' }
  }

  if (slug) revalidarEquipo(slug)
  return { status: 'success', mensaje: 'Invitación cancelada.' }
}

/**
 * Cuenta los duenos que quedarian si se toca a esta persona.
 *
 * Un sitio sin dueno es un sitio que nadie puede volver a administrar: no queda
 * quien invite, y destrabarlo exige un operador metiendo mano. Por eso quitar
 * o degradar al ultimo dueno se rechaza en vez de avisarse.
 */
const quedaOtroDueno = async (venueId: string, exceptoUserId: string) => {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(venueMember)
    .where(
      and(
        eq(venueMember.venueId, venueId),
        eq(venueMember.role, 'owner'),
        ne(venueMember.userId, exceptoUserId)
      )
    )

  return (fila?.n ?? 0) > 0
}

export const cambiarRolAction = async (
  memberId: string,
  role: 'owner' | 'staff'
): Promise<EquipoState> => {
  const [fila] = await db
    .select({
      venueId: venueMember.venueId,
      userId: venueMember.userId,
      role: venueMember.role,
    })
    .from(venueMember)
    .where(eq(venueMember.id, memberId))
    .limit(1)

  if (!fila) return { status: 'error', error: 'Esa persona ya no está en el equipo.' }

  const acceso = await assertVenueAccess(fila.venueId, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  // Misma excepcion que al sacar del equipo: ver la nota alla.
  if (fila.role === 'owner' && role !== 'owner' && !acceso.acceso.esPlataforma) {
    if (!(await quedaOtroDueno(fila.venueId, fila.userId))) {
      return {
        status: 'error',
        error: 'Es el único dueño. Nombra otro dueño antes de cambiarle el rol.',
      }
    }
  }

  const slug = await slugDelSitio(fila.venueId)

  try {
    await db
      .update(venueMember)
      .set({ role, updatedAt: new Date() })
      .where(eq(venueMember.id, memberId))
  } catch {
    return { status: 'error', error: 'No se pudo cambiar el rol.' }
  }

  if (slug) revalidarEquipo(slug)
  return { status: 'success', mensaje: 'Rol actualizado.' }
}

export const sacarDelEquipoAction = async (memberId: string): Promise<EquipoState> => {
  const [fila] = await db
    .select({
      venueId: venueMember.venueId,
      userId: venueMember.userId,
      role: venueMember.role,
    })
    .from(venueMember)
    .where(eq(venueMember.id, memberId))
    .limit(1)

  if (!fila) return { status: 'error', error: 'Esa persona ya no está en el equipo.' }

  const acceso = await assertVenueAccess(fila.venueId, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  // LA PLATAFORMA SI PUEDE, y es la unica excepcion. Sin ella, un sitio cuyo
  // dueno desaparece —cambio de correo, vendio el bar, se fue— queda congelado
  // para siempre: no queda quien invite a nadie mas, y esta misma regla impide
  // reemplazarlo. Es exactamente el caso en que hace falta un operador.
  if (
    fila.role === 'owner' &&
    !acceso.acceso.esPlataforma &&
    !(await quedaOtroDueno(fila.venueId, fila.userId))
  ) {
    return {
      status: 'error',
      error: 'Es el único dueño. El sitio no puede quedarse sin dueño.',
    }
  }

  const slug = await slugDelSitio(fila.venueId)

  try {
    await db.delete(venueMember).where(eq(venueMember.id, memberId))
  } catch {
    return { status: 'error', error: 'No se pudo sacar a esa persona.' }
  }

  if (slug) revalidarEquipo(slug)
  return { status: 'success', mensaje: 'Listo, ya no está en el equipo.' }
}
