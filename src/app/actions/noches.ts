'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import { partyNight, partyPhoto, photoReport, venue } from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { storage } from '@/lib/storage'
import { createId } from '@/lib/utils/id'

/**
 * Noches y fotos, desde el panel del sitio y desde la calle.
 *
 * ARCHIVO APARTE DE fiestas.ts A PROPOSITO. Aquel es de la persona dueña de su
 * propia foto y usa un requireUser() local; este es del sitio y va con
 * assertVenueAccess. Mezclarlos invita a que una accion herede la comprobacion
 * equivocada, y aqui la comprobacion equivocada significa que el personal de un
 * bar modera las fotos de otro.
 *
 * Y COMO EN TODO EL RESTO: el venueId sale de la FILA que se va a mutar, leida
 * de la base. Nunca del formulario. Ver src/lib/auth/venue-access.ts.
 */

export type NocheState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; mensaje: string; nightId?: string }

/** Solo imagenes, y solo estas. La lista blanca no es decorativa: el
 *  content-type viaja en la URL firmada y termina siendo el que R2 sirve, asi
 *  que aceptar text/html seria dejar subir una pagina a nuestro dominio. */
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/** 15 MB. Una foto de celular cabe de sobra; un video no. */
const MAX_BYTES = 15 * 1024 * 1024

const nocheSchema = z.object({
  venueId: z.string().min(1),
  happenedAt: z.coerce.date(),
  title: z.string().trim().max(140).optional(),
})

/** El slug del sitio de una noche. Leido, no recibido. */
const contextoDeNoche = async (nightId: string) => {
  const [fila] = await db
    .select({
      nightId: partyNight.id,
      venueId: partyNight.venueId,
      slug: venue.slug,
      status: partyNight.status,
    })
    .from(partyNight)
    .innerJoin(venue, eq(partyNight.venueId, venue.id))
    .where(eq(partyNight.id, nightId))
    .limit(1)
  return fila ?? null
}

const contextoDeFoto = async (photoId: string) => {
  const [fila] = await db
    .select({
      photoId: partyPhoto.id,
      nightId: partyPhoto.nightId,
      venueId: partyNight.venueId,
      slug: venue.slug,
      status: partyPhoto.status,
      storageKey: partyPhoto.storageKey,
    })
    .from(partyPhoto)
    .innerJoin(partyNight, eq(partyPhoto.nightId, partyNight.id))
    .innerJoin(venue, eq(partyNight.venueId, venue.id))
    .where(eq(partyPhoto.id, photoId))
    .limit(1)
  return fila ?? null
}

const revalidarNoche = (slug: string, nightId: string) => {
  revalidatePath(`/panel/${slug}/noches`)
  revalidatePath(`/panel/${slug}/fotos`)
  revalidatePath(`/sitios/${slug}`)
  revalidatePath(`/sitios/${slug}/noches/${nightId}`)
  revalidatePath('/mi-historia')
}

// ---------------------------------------------------------------- noches

export const guardarNocheAction = async (
  _previous: NocheState,
  formData: FormData
): Promise<NocheState> => {
  const parsed = nocheSchema.safeParse({
    venueId: formData.get('venueId'),
    happenedAt: formData.get('happenedAt'),
    title: formData.get('title') || undefined,
  })

  if (!parsed.success) {
    return { status: 'error', error: 'Revisa la fecha de la noche.' }
  }

  const [sitio] = await db
    .select({ id: venue.id, slug: venue.slug })
    .from(venue)
    .where(eq(venue.id, parsed.data.venueId))
    .limit(1)

  if (!sitio) return { status: 'error', error: 'Ese sitio ya no existe.' }

  const acceso = await assertVenueAccess(sitio.id)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  const id = formData.get('id')

  try {
    if (typeof id === 'string' && id) {
      const contexto = await contextoDeNoche(id)
      if (!contexto || contexto.venueId !== sitio.id) {
        return { status: 'error', error: 'Esa noche no es de este sitio.' }
      }

      await db
        .update(partyNight)
        .set({
          happenedAt: parsed.data.happenedAt,
          title: parsed.data.title ?? null,
          updatedAt: new Date(),
        })
        .where(eq(partyNight.id, id))

      revalidarNoche(sitio.slug, id)
      return { status: 'success', mensaje: 'Noche actualizada.', nightId: id }
    }

    const [fila] = await db
      .insert(partyNight)
      .values({
        venueId: sitio.id,
        happenedAt: parsed.data.happenedAt,
        title: parsed.data.title ?? null,
      })
      .returning({ id: partyNight.id })

    revalidarNoche(sitio.slug, fila.id)
    return { status: 'success', mensaje: 'Noche creada.', nightId: fila.id }
  } catch {
    return { status: 'error', error: 'No se pudo guardar la noche.' }
  }
}

export const publicarNocheAction = async (
  nightId: string,
  status: 'draft' | 'published'
): Promise<NocheState> => {
  const contexto = await contextoDeNoche(nightId)
  if (!contexto) return { status: 'error', error: 'Esa noche ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  try {
    await db
      .update(partyNight)
      .set({ status, updatedAt: new Date() })
      .where(eq(partyNight.id, nightId))
  } catch {
    return { status: 'error', error: 'No se pudo cambiar el estado de la noche.' }
  }

  revalidarNoche(contexto.slug, nightId)
  return {
    status: 'success',
    mensaje: status === 'published' ? 'Noche publicada.' : 'Noche en borrador.',
  }
}

// ---------------------------------------------------------------- subida

export type Firma =
  | { ok: true; uploadUrl: string; key: string; publicUrl: string }
  | { ok: false; error: string }

/**
 * Una URL firmada para subir DIRECTO a R2 desde el navegador.
 *
 * POR QUE DIRECTO Y NO POR LA APP: una noche son decenas de fotos. Pasarlas por
 * una funcion las serializa, gasta tiempo de computo por cada byte y se acerca
 * al limite de duracion; firmando, el navegador las sube en paralelo y nosotros
 * solo escribimos la fila.
 *
 * QUIEN PUEDE PEDIR UNA FIRMA:
 *   - el sitio, para su propia noche
 *   - cualquiera con sesion verificada, para una noche PUBLICADA (sube como
 *     'guest' y su foto nace 'pending')
 * El nightId decide el sitio; no se recibe venueId por ninguna parte.
 */
export const firmarSubidaAction = async (
  nightId: string,
  contentType: string,
  bytes: number
): Promise<Firma> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: 'Inicia sesión para subir fotos.' }
  if (!session.user.emailVerified) {
    return { ok: false, error: 'Verifica tu correo antes de subir fotos.' }
  }

  if (!TIPOS_PERMITIDOS.includes(contentType as (typeof TIPOS_PERMITIDOS)[number])) {
    return { ok: false, error: 'Solo fotos: JPG, PNG, WEBP o AVIF.' }
  }

  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return { ok: false, error: 'Esa foto pesa demasiado. El máximo son 15 MB.' }
  }

  const contexto = await contextoDeNoche(nightId)
  if (!contexto) return { ok: false, error: 'Esa noche ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  const esDelSitio = acceso.ok

  // Quien no es del sitio solo puede subir a una noche publicada. A una en
  // borrador no deberia ni poder llegar, y adivinando el id tampoco.
  if (!esDelSitio && contexto.status !== 'published') {
    return { ok: false, error: 'Esa noche no está abierta.' }
  }

  const key = `fiestas/${nightId}/${createId('pph')}.${EXTENSION[contentType]}`

  try {
    const uploadUrl = await storage.getSignedUploadUrl({ key, expiresIn: 600 })
    const { R2_BUCKET_URL } = await import('@/config/env').then((m) => m.env)
    return { ok: true, uploadUrl, key, publicUrl: `${R2_BUCKET_URL}/${key}` }
  } catch {
    // Sin R2 configurado esto revienta en _getEndpoint. Se dice claro en vez de
    // dejar al operador mirando un error de AWS.
    return { ok: false, error: 'El almacenamiento de fotos no está configurado.' }
  }
}

const registroSchema = z.object({
  nightId: z.string().min(1),
  url: z.string().min(1).max(600),
  storageKey: z.string().min(1).max(600),
  caption: z.string().trim().max(280).optional(),
})

/**
 * La fila de una foto ya subida.
 *
 * EL ESTADO NO SE RECIBE, SE DECIDE AQUI. Si la sube el sitio puede quedar
 * disponible; si la sube alguien de la calle nace 'pending' pase lo que pase, y
 * solo el sitio la habilita. Ese es el porton que impide que alguien suba fotos
 * de un bar donde nunca estuvo y las reclame para inflarse las noches.
 */
export const registrarFotoAction = async (
  entrada: z.input<typeof registroSchema> & { publicar?: boolean }
): Promise<NocheState> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { status: 'error', error: 'Inicia sesión.' }
  if (!session.user.emailVerified) {
    return { status: 'error', error: 'Verifica tu correo.' }
  }

  const parsed = registroSchema.safeParse(entrada)
  if (!parsed.success) return { status: 'error', error: 'Datos de la foto inválidos.' }

  const contexto = await contextoDeNoche(parsed.data.nightId)
  if (!contexto) return { status: 'error', error: 'Esa noche ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  const esDelSitio = acceso.ok

  if (!esDelSitio && contexto.status !== 'published') {
    return { status: 'error', error: 'Esa noche no está abierta.' }
  }

  // La clave tiene que ser de ESTA noche. Sin esto se podria registrar como
  // propia una foto subida a la carpeta de otra.
  if (!parsed.data.storageKey.startsWith(`fiestas/${parsed.data.nightId}/`)) {
    return { status: 'error', error: 'Esa foto no corresponde a esta noche.' }
  }

  try {
    await db.insert(partyPhoto).values({
      nightId: parsed.data.nightId,
      url: parsed.data.url,
      storageKey: parsed.data.storageKey,
      caption: parsed.data.caption ?? null,
      uploadedByUserId: session.user.id,
      source: esDelSitio ? 'venue' : 'guest',
      status: esDelSitio && entrada.publicar ? 'available' : 'pending',
      ...(esDelSitio && entrada.publicar
        ? { reviewedByUserId: session.user.id, reviewedAt: new Date() }
        : {}),
    })
  } catch {
    return { status: 'error', error: 'No se pudo guardar la foto.' }
  }

  revalidarNoche(contexto.slug, parsed.data.nightId)

  return {
    status: 'success',
    mensaje: esDelSitio
      ? 'Foto subida.'
      : 'Foto enviada. El sitio la revisa antes de que salga.',
  }
}

// ------------------------------------------------------------ moderacion

export const moderarFotoAction = async (
  photoId: string,
  status: 'pending' | 'available' | 'hidden'
): Promise<NocheState> => {
  const contexto = await contextoDeFoto(photoId)
  if (!contexto) return { status: 'error', error: 'Esa foto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  try {
    await db
      .update(partyPhoto)
      .set({
        status,
        reviewedByUserId: acceso.acceso.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partyPhoto.id, photoId))
  } catch {
    return { status: 'error', error: 'No se pudo cambiar la foto.' }
  }

  revalidarNoche(contexto.slug, contexto.nightId)

  const texto = {
    available: 'Foto habilitada. Ya la puede guardar quien salga en ella.',
    hidden: 'Foto retirada.',
    pending: 'Foto de vuelta a pendientes.',
  }
  return { status: 'success', mensaje: texto[status] }
}

/**
 * Borrar una foto de verdad.
 *
 * PRIMERO LOS BYTES, DESPUES LA FILA. El comentario de schema.ts lo pide
 * explicitamente: quien pide que su foto desaparezca necesita que el archivo se
 * vaya, no que un flag cambie. Si se borrara la fila primero y fallara el
 * borrado en R2, quedaria un archivo publico que ya nadie sabe que existe.
 */
export const borrarFotoAction = async (photoId: string): Promise<NocheState> => {
  const contexto = await contextoDeFoto(photoId)
  if (!contexto) return { status: 'error', error: 'Esa foto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  if (contexto.storageKey) {
    try {
      await storage.delete({ key: contexto.storageKey })
    } catch {
      return {
        status: 'error',
        error: 'No se pudo borrar el archivo. La foto sigue ahí; inténtalo de nuevo.',
      }
    }
  }

  try {
    // Los reclamos se van con ella por el ON DELETE CASCADE de photo_claim.
    await db.delete(partyPhoto).where(eq(partyPhoto.id, photoId))
  } catch {
    return { status: 'error', error: 'No se pudo borrar la foto.' }
  }

  revalidarNoche(contexto.slug, contexto.nightId)
  return { status: 'success', mensaje: 'Foto borrada.' }
}

/**
 * "En esa foto salgo yo y no quiero."
 *
 * Lo puede hacer cualquiera con sesion, sin pertenecer al sitio ni haber
 * reclamado la foto: quien sale en una foto que subio otro es justamente quien
 * no tiene ninguna otra forma de pedir que la bajen.
 */
export const reportarFotoAction = async (
  photoId: string,
  reason: string
): Promise<NocheState> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { status: 'error', error: 'Inicia sesión para reportar una foto.' }

  const contexto = await contextoDeFoto(photoId)
  if (!contexto) return { status: 'error', error: 'Esa foto ya no existe.' }

  try {
    await db.insert(photoReport).values({
      photoId,
      reportedByUserId: session.user.id,
      reason: reason.trim().slice(0, 1000) || null,
    })
  } catch {
    return { status: 'error', error: 'No se pudo enviar el reporte.' }
  }

  revalidatePath(`/panel/${contexto.slug}/fotos`)
  return {
    status: 'success',
    mensaje: 'Reporte enviado. El sitio lo revisa.',
  }
}

export const resolverReporteAction = async (reportId: string): Promise<NocheState> => {
  const [reporte] = await db
    .select({ id: photoReport.id, photoId: photoReport.photoId })
    .from(photoReport)
    .where(eq(photoReport.id, reportId))
    .limit(1)

  if (!reporte) return { status: 'error', error: 'Ese reporte ya no existe.' }

  const contexto = await contextoDeFoto(reporte.photoId)
  if (!contexto) return { status: 'error', error: 'Esa foto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  try {
    await db
      .update(photoReport)
      .set({
        status: 'resolved',
        resolvedByUserId: acceso.acceso.userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(photoReport.id, reportId)))
  } catch {
    return { status: 'error', error: 'No se pudo cerrar el reporte.' }
  }

  revalidatePath(`/panel/${contexto.slug}/fotos`)
  return { status: 'success', mensaje: 'Reporte cerrado.' }
}

/** La plataforma puede retirar cualquier foto de la red, sin pedirle permiso al
 *  sitio. Una bajada por privacidad no puede depender de que el bar coopere. */
export const retirarFotoComoPlataformaAction = async (
  photoId: string
): Promise<NocheState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const contexto = await contextoDeFoto(photoId)
  if (!contexto) return { status: 'error', error: 'Esa foto ya no existe.' }

  try {
    await db
      .update(partyPhoto)
      .set({
        status: 'hidden',
        reviewedByUserId: admin.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partyPhoto.id, photoId))
  } catch {
    return { status: 'error', error: 'No se pudo retirar la foto.' }
  }

  revalidarNoche(contexto.slug, contexto.nightId)
  return { status: 'success', mensaje: 'Foto retirada de la red.' }
}
