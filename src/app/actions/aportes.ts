'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import { venue, venueContribution, venueContributionMedia } from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { storage } from '@/lib/storage'
import { createId } from '@/lib/utils/id'

/**
 * Los aportes que reporta un sitio, y su verificacion.
 *
 * EL SITIO DECLARA, NOSOTROS VERIFICAMOS, Y HASTA ENTONCES NO EXISTE PARA
 * NADIE. Un aporte 'submitted' no aparece en ninguna pantalla publica. Lo que
 * publicamos lleva nuestro nombre encima, y publicar una cifra que nos dieron
 * sin comprobarla seria afirmar algo que no comprobamos, que es exactamente lo
 * unico que este producto no puede hacer.
 *
 * El sitio NO puede tocar status, verifiedAt ni verifiedNote. No porque el
 * formulario no los pinte, sino porque estas acciones no los leen del
 * formulario en ningun caso.
 */

export type AporteState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; mensaje: string; id?: string }

const TIPOS_RECIBO = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
}
const MAX_BYTES = 15 * 1024 * 1024

const aporteSchema = z
  .object({
    venueId: z.string().min(1),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    amount: z.coerce.number().gt(0, 'El monto tiene que ser mayor que cero'),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: 'El periodo termina antes de empezar',
    path: ['periodEnd'],
  })

/** El contexto de un aporte, leido de la base. El venueId NUNCA viene del
 *  formulario cuando se toca una fila que ya existe. */
const contextoDeAporte = async (id: string) => {
  const [fila] = await db
    .select({
      id: venueContribution.id,
      venueId: venueContribution.venueId,
      slug: venue.slug,
      status: venueContribution.status,
    })
    .from(venueContribution)
    .innerJoin(venue, eq(venueContribution.venueId, venue.id))
    .where(eq(venueContribution.id, id))
    .limit(1)
  return fila ?? null
}

const revalidarAporte = (slug: string) => {
  revalidatePath(`/panel/${slug}/aportes`)
  revalidatePath('/admin/aportes')
  revalidatePath(`/sitios/${slug}`)
  revalidatePath('/transparencia')
}

export const guardarAporteAction = async (
  _previous: AporteState,
  formData: FormData
): Promise<AporteState> => {
  const parsed = aporteSchema.safeParse({
    venueId: formData.get('venueId'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
    amount: formData.get('amount'),
    note: formData.get('note') || undefined,
  })

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const [sitio] = await db
    .select({ id: venue.id, slug: venue.slug })
    .from(venue)
    .where(eq(venue.id, parsed.data.venueId))
    .limit(1)

  if (!sitio) return { status: 'error', error: 'Ese sitio ya no existe.' }

  const acceso = await assertVenueAccess(sitio.id)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  try {
    const [fila] = await db
      .insert(venueContribution)
      .values({
        venueId: sitio.id,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        amount: parsed.data.amount.toFixed(2),
        note: parsed.data.note ?? null,
        submittedByUserId: acceso.acceso.userId,
        // status se queda en su default 'submitted'. No se lee del formulario
        // ni aca ni en ninguna otra accion del sitio.
      })
      .returning({ id: venueContribution.id })

    revalidarAporte(sitio.slug)
    return { status: 'success', mensaje: 'Aporte reportado. Lo revisamos y te avisamos.', id: fila.id }
  } catch {
    return { status: 'error', error: 'No se pudo guardar el aporte.' }
  }
}

export const borrarAporteAction = async (id: string): Promise<AporteState> => {
  const contexto = await contextoDeAporte(id)
  if (!contexto) return { status: 'error', error: 'Ese aporte ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  // Un aporte ya verificado es parte del registro publico. Borrarlo desde el
  // sitio dejaria a /transparencia contando una compra financiada por algo que
  // ya no existe. Si de verdad estaba mal, lo corrige un operador.
  if (contexto.status === 'verified') {
    return {
      status: 'error',
      error: 'Ese aporte ya está verificado y publicado. Escríbenos si hay un error.',
    }
  }

  try {
    await db.delete(venueContribution).where(eq(venueContribution.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo borrar el aporte.' }
  }

  revalidarAporte(contexto.slug)
  return { status: 'success', mensaje: 'Aporte borrado.' }
}

// ------------------------------------------------------------- recibos

export type FirmaRecibo =
  | { ok: true; uploadUrl: string; key: string; publicUrl: string }
  | { ok: false; error: string }

export const firmarReciboAction = async (
  contributionId: string,
  contentType: string,
  bytes: number
): Promise<FirmaRecibo> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { ok: false, error: 'Inicia sesión.' }

  if (!TIPOS_RECIBO.includes(contentType)) {
    return { ok: false, error: 'Solo imágenes o PDF.' }
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return { ok: false, error: 'El archivo pesa demasiado. El máximo son 15 MB.' }
  }

  const contexto = await contextoDeAporte(contributionId)
  if (!contexto) return { ok: false, error: 'Ese aporte ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { ok: false, error: acceso.error }

  const key = `aportes/${contributionId}/${createId('vcm')}.${EXT[contentType]}`

  try {
    const uploadUrl = await storage.getSignedUploadUrl({ key, expiresIn: 600 })
    const { R2_BUCKET_URL } = await import('@/config/env').then((m) => m.env)
    return { ok: true, uploadUrl, key, publicUrl: `${R2_BUCKET_URL}/${key}` }
  } catch {
    return { ok: false, error: 'El almacenamiento no está configurado.' }
  }
}

export const registrarReciboAction = async (entrada: {
  contributionId: string
  url: string
  storageKey: string
  kind?: string
  caption?: string
}): Promise<AporteState> => {
  const contexto = await contextoDeAporte(entrada.contributionId)
  if (!contexto) return { status: 'error', error: 'Ese aporte ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  // La clave tiene que ser de ESTE aporte, igual que con las fotos.
  if (!entrada.storageKey.startsWith(`aportes/${entrada.contributionId}/`)) {
    return { status: 'error', error: 'Ese archivo no corresponde a este aporte.' }
  }

  try {
    await db.insert(venueContributionMedia).values({
      contributionId: entrada.contributionId,
      url: entrada.url,
      storageKey: entrada.storageKey,
      kind: entrada.kind === 'transfer' || entrada.kind === 'photo' ? entrada.kind : 'receipt',
      caption: entrada.caption?.trim() || null,
    })
  } catch {
    return { status: 'error', error: 'No se pudo guardar el recibo.' }
  }

  revalidarAporte(contexto.slug)
  return { status: 'success', mensaje: 'Recibo adjuntado.' }
}

// -------------------------------------------------------- verificacion

export const verificarAporteAction = async (
  id: string,
  decision: 'verified' | 'rejected',
  nota?: string,
  purchaseId?: string
): Promise<AporteState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const contexto = await contextoDeAporte(id)
  if (!contexto) return { status: 'error', error: 'Ese aporte ya no existe.' }

  try {
    await db
      .update(venueContribution)
      .set({
        status: decision,
        verifiedByUserId: admin.userId,
        verifiedAt: decision === 'verified' ? new Date() : null,
        verifiedNote: nota?.trim() || null,
        purchaseId: purchaseId || null,
        updatedAt: new Date(),
      })
      .where(eq(venueContribution.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo verificar el aporte.' }
  }

  revalidarAporte(contexto.slug)
  return {
    status: 'success',
    mensaje: decision === 'verified' ? 'Verificado. Ya sale publicado.' : 'Rechazado.',
  }
}
