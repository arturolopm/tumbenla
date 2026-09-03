import 'server-only'

import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { user, venue, venueApplication, venueMember } from '@/database/schema'

/**
 * Buscar un sitio para reclamarlo.
 *
 * Busca entre TODOS los estados, no solo los publicados: los sitios que
 * cargamos nosotros nacen en borrador, y son precisamente esos los que un dueno
 * llega buscando. Filtrar por publicados le diria "tu bar no existe" cuando lo
 * que pasa es que todavia no lo hemos publicado.
 *
 * Se devuelve si ya tiene dueno para poder decirlo en la lista en vez de dejar
 * que alguien mande una solicitud que nace rechazada.
 */
export const buscarSitiosParaReclamar = async (termino: string) => {
  const q = `%${termino.trim()}%`

  return db
    .select({
      id: venue.id,
      slug: venue.slug,
      nombre: venue.name,
      city: venue.city,
      addressLine: venue.addressLine,
      type: venue.type,
      instagram: venue.instagram,
      status: venue.status,
      duenos: sql<number>`count(distinct ${venueMember.userId}) filter (where ${venueMember.role} = 'owner')::int`,
    })
    .from(venue)
    .leftJoin(venueMember, eq(venueMember.venueId, venue.id))
    .where(or(ilike(venue.name, q), ilike(venue.addressLine, q), ilike(venue.city, q)))
    .groupBy(venue.id)
    .orderBy(asc(venue.name))
    .limit(20)
}

/** Las solicitudes de una persona, para no dejarla mandando la misma dos veces
 *  y para que pueda ver en que va la suya. */
export const listMyApplications = async (userId: string) => {
  return db
    .select({
      id: venueApplication.id,
      status: venueApplication.status,
      reviewNote: venueApplication.reviewNote,
      name: venueApplication.name,
      instagram: venueApplication.instagram,
      contactEmail: venueApplication.contactEmail,
      createdAt: venueApplication.createdAt,
      venueSlug: venue.slug,
    })
    .from(venueApplication)
    .leftJoin(venue, eq(venueApplication.venueId, venue.id))
    .where(eq(venueApplication.userId, userId))
    .orderBy(desc(venueApplication.createdAt))
}

/** La solicitud viva de una persona, si tiene. Es la que la pantalla de
 *  "que sigue" vuelve a mostrar cuando regresa. */
export const getLiveApplication = async (userId: string, id?: string) => {
  const vivas = sql`${venueApplication.status} in ('pending', 'verifying')`

  const [fila] = await db
    .select({
      id: venueApplication.id,
      status: venueApplication.status,
      name: venueApplication.name,
      instagram: venueApplication.instagram,
      contactEmail: venueApplication.contactEmail,
      city: venueApplication.city,
    })
    .from(venueApplication)
    .where(
      id
        ? and(eq(venueApplication.id, id), eq(venueApplication.userId, userId))
        : and(eq(venueApplication.userId, userId), vivas)
    )
    .orderBy(desc(venueApplication.createdAt))
    .limit(1)

  return fila ?? null
}

/**
 * Una solicitud por su token publico, para quien la mando SIN cuenta.
 *
 * VA APARTE de getLiveApplication a proposito. La propiedad de seguridad de esa
 * funcion es que SIEMPRE filtra por userId; meterle una rama "o por token" la
 * volveria condicional, y una condicion de seguridad que a veces aplica es la
 * clase de cosa que alguien borra sin darse cuenta seis meses despues.
 *
 * El token es un enlace al portador, mismo modelo que /orden/[token]: quien
 * tiene la URL ve la solicitud. Por eso la pantalla que lo usa va noindex y NO
 * DEJA EDITAR NADA — corregir datos sigue pidiendo sesion, porque un token que
 * ademas reescribe es un hueco mas grande que un barrio mal escrito.
 */
export const getApplicationByToken = async (token: string) => {
  const [fila] = await db
    .select({
      id: venueApplication.id,
      status: venueApplication.status,
      name: venueApplication.name,
      instagram: venueApplication.instagram,
      contactEmail: venueApplication.contactEmail,
      city: venueApplication.city,
      userId: venueApplication.userId,
    })
    .from(venueApplication)
    .where(eq(venueApplication.publicToken, token))
    .limit(1)

  return fila ?? null
}

/**
 * La cola del operador. Lo mas viejo arriba: una solicitud vieja es alguien
 * esperando hace mas tiempo.
 *
 * Trae el sitio que ya calza, si lo hay, para que aprobar no duplique un bar
 * que ya esta en el directorio.
 */
export const listApplications = async () => {
  return (
    db
      .select({
        id: venueApplication.id,
        status: venueApplication.status,
        name: venueApplication.name,
        type: venueApplication.type,
        city: venueApplication.city,
        addressLine: venueApplication.addressLine,
        neighborhood: venueApplication.neighborhood,
        instagram: venueApplication.instagram,
        contactEmail: venueApplication.contactEmail,
        tiktok: venueApplication.tiktok,
        whatsapp: venueApplication.whatsapp,
        phone: venueApplication.phone,
        website: venueApplication.website,
        openingHours: venueApplication.openingHours,
        description: venueApplication.description,
        pledgeIdea: venueApplication.pledgeIdea,
        reviewNote: venueApplication.reviewNote,
        createdAt: venueApplication.createdAt,
        venueId: venueApplication.venueId,
        venueSlug: venue.slug,
        venueNombre: venue.name,
        // Si ya hay cuenta amarrada. El operador la necesita para saber si puede
        // aprobar: sin cuenta no hay a quien darle la propiedad.
        userId: venueApplication.userId,
        // La cuenta que aplica: quien queda de dueno si se aprueba. Va aparte del
        // contactEmail a proposito, porque son dos cosas distintas y el operador
        // tiene que poder compararlas. NULL mientras la solicitud no tenga dueno.
        solicitante: user.name,
        solicitanteEmail: user.email,
      })
      .from(venueApplication)
      /**
       * leftJoin, y NO innerJoin.
       *
       * Desde la decision 35 una solicitud puede no tener cuenta todavia. Con el
       * innerJoin que habia aca, esas filas DESAPARECIAN de /admin/solicitudes
       * sin ruido: alguien manda la solicitud, no vuelve a saber de nosotros, y
       * del lado de operacion no existe. Es el peor modo de falla de esta
       * pantalla, porque no se ve — la cola simplemente se ve corta.
       */
      .leftJoin(user, eq(venueApplication.userId, user.id))
      .leftJoin(venue, eq(venueApplication.venueId, venue.id))
      .orderBy(asc(venueApplication.createdAt))
  )
}

/** Una solicitud, para prellenar el formulario de creacion del sitio. */
export const getApplication = async (id: string) => {
  const [fila] = await db
    .select()
    .from(venueApplication)
    .where(eq(venueApplication.id, id))
    .limit(1)

  return fila ?? null
}

/** Cuantas esperan respuesta. Va en la barra del panel de operacion. */
export const countOpenApplications = async () => {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(venueApplication)
    .where(sql`${venueApplication.status} in ('pending', 'verifying')`)

  return fila?.n ?? 0
}

/** Si el sitio ya tiene dueno. Lo mira el operador antes de aprobar y tambien
 *  la accion, porque entre lo uno y lo otro pueden pasar dias. */
export const tieneDueno = async (venueId: string) => {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(venueMember)
    .where(and(eq(venueMember.venueId, venueId), eq(venueMember.role, 'owner')))

  return (fila?.n ?? 0) > 0
}
