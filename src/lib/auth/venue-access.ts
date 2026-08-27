import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { db } from '@/database'
import { venue, venueMember } from '@/database/schema'
import { auth } from './auth'
import { isAdminEmail } from './admin'

/**
 * Quien puede tocar que sitio.
 *
 * Hermano de admin.ts y con la misma forma a proposito: `require*` para
 * paginas y layouts (nunca vuelve si no hay permiso), `assert*` para server
 * actions (nunca lanza, devuelve un resultado). Que las dos familias se
 * parezcan es lo que hace que no se confundan al escribir una accion nueva.
 *
 * ===================================================================
 * LA REGLA QUE SOSTIENE TODO ESTO
 *
 *   El venueId con el que se comprueba el permiso tiene que salir de la FILA
 *   que se va a mutar, leida de la base, y NUNCA de un campo del formulario.
 *
 * Una accion que recibe `venueId` en el FormData y lo comprueba tal cual esta
 * dejando que quien manda el formulario elija contra que se lo comparan: el
 * personal del sitio A edita el sitio B cambiando un input oculto en las
 * herramientas del navegador. Para mutar una noche, una foto o un aporte, hay
 * que leer primero esa fila, sacarle su venueId, y comprobar ESE. No lo atrapa
 * ningun tipo de TypeScript y no lo detecta ninguna prueba de tipos.
 * ===================================================================
 */

export type VenueRole = 'owner' | 'staff'

/** El operador de la plataforma pasa por encima de todo esto. */
export type Acceso = {
  userId: string
  email: string
  /** null cuando entra por ser operador de la plataforma y no por membresia. */
  role: VenueRole | null
  esPlataforma: boolean
}

const cumple = (role: VenueRole | null, exigidos?: VenueRole[]) => {
  if (!exigidos || exigidos.length === 0) return true
  return role !== null && exigidos.includes(role)
}

/** El rol de alguien en un sitio, o null si no pertenece. */
export const getVenueRole = async (
  userId: string,
  venueId: string
): Promise<VenueRole | null> => {
  const [fila] = await db
    .select({ role: venueMember.role })
    .from(venueMember)
    .where(and(eq(venueMember.userId, userId), eq(venueMember.venueId, venueId)))
    .limit(1)

  if (!fila) return null
  return fila.role === 'owner' ? 'owner' : 'staff'
}

/**
 * Los sitios de una persona, para el selector del panel.
 *
 * No incluye los de la plataforma: un operador tiene acceso a todos, y
 * listarle 300 sitios en un menu no le sirve de nada. Entra por /admin.
 */
export const listMyVenues = async (userId: string) => {
  return db
    .select({
      id: venue.id,
      slug: venue.slug,
      nombre: venue.name,
      status: venue.status,
      role: venueMember.role,
    })
    .from(venueMember)
    .innerJoin(venue, eq(venueMember.venueId, venue.id))
    .where(eq(venueMember.userId, userId))
    .orderBy(asc(venue.name))
}

/**
 * Para paginas y layouts. No vuelve nunca sin permiso.
 *
 * Quien no ha entrado va al login pidiendo volver aca. Quien tiene sesion y no
 * pertenece recibe un 404, no un 403, por lo mismo que requireAdmin: el panel
 * de un sitio ajeno no tiene por que confirmarle a nadie que existe.
 */
export const requireVenueAccess = async (
  venueId: string,
  destino: string,
  roles?: VenueRole[]
): Promise<Acceso> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?redirectAfter=${encodeURIComponent(destino)}`)

  if (isAdminEmail(session.user.email, session.user.emailVerified)) {
    return {
      userId: session.user.id,
      email: session.user.email,
      role: null,
      esPlataforma: true,
    }
  }

  const role = await getVenueRole(session.user.id, venueId)
  if (!role || !cumple(role, roles)) notFound()

  return {
    userId: session.user.id,
    email: session.user.email,
    role,
    esPlataforma: false,
  }
}

export type VenueCheck = { ok: true; acceso: Acceso } | { ok: false; error: string }

/**
 * Para server actions, que no pueden lanzar.
 *
 * Un layout no protege una server action: es un endpoint POST con su propio
 * identificador, al que se puede llegar sin haber pasado nunca por la pagina.
 * Cada accion llama esto por su cuenta.
 */
export const assertVenueAccess = async (
  venueId: string,
  roles?: VenueRole[]
): Promise<VenueCheck> => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) return { ok: false, error: 'No has iniciado sesión.' }
  if (!session.user.emailVerified) {
    return { ok: false, error: 'Tu correo no esta verificado.' }
  }

  if (isAdminEmail(session.user.email, session.user.emailVerified)) {
    return {
      ok: true,
      acceso: {
        userId: session.user.id,
        email: session.user.email,
        role: null,
        esPlataforma: true,
      },
    }
  }

  const role = await getVenueRole(session.user.id, venueId)
  if (!role) return { ok: false, error: 'No perteneces a este sitio.' }

  if (!cumple(role, roles)) {
    return { ok: false, error: 'Solo el dueño del sitio puede hacer esto.' }
  }

  return {
    ok: true,
    acceso: {
      userId: session.user.id,
      email: session.user.email,
      role,
      esPlataforma: false,
    },
  }
}

/** El sitio de un slug, con lo justo para decidir permisos y pintar la cabecera. */
export const getVenueForPanel = async (slug: string) => {
  const [fila] = await db
    .select({
      id: venue.id,
      slug: venue.slug,
      nombre: venue.name,
      status: venue.status,
      city: venue.city,
    })
    .from(venue)
    .where(eq(venue.slug, slug))
    .limit(1)

  return fila ?? null
}
