'use server'

import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import { productOrder, venue, venueProduct } from '@/database/schema'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { env } from '@/config/env'
import { KINDS_DE_PRODUCTO, PORCENTAJE_MINIMO_DE_RECONSTRUCCION } from '@/lib/comercio/types'
import { storage } from '@/lib/storage'
import { createId } from '@/lib/utils/id'

/**
 * La carta de un sitio: los productos que vende con su reparto.
 *
 * Venue owners decide when a complete product is public. The server owns the
 * non-negotiable minimum, rather than trusting the form's range control.
 *
 * The venueId used for permissions always comes from the saved product when
 * editing, never from a hidden form field.
 */

export type CartaState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string[]> }
  | { status: 'success'; mensaje: string; id?: string }

const RESERVADOS = new Set(['nuevo', 'editar', 'pedir', 'admin', 'panel', 'api'])
const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
const PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

const httpsImageUrl = z
  .string()
  .trim()
  .url('Pega una URL válida.')
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === 'https:'
      } catch {
        return false
      }
    },
    'La imagen debe usar https.'
  )
  .max(600)

const productoSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().trim().min(2, 'Ponle un nombre').max(120),
  kind: z.enum(KINDS_DE_PRODUCTO),
  description: z.string().trim().max(600).optional(),
  // Pesos enteros: el peso colombiano no usa centavos, y aceptar decimales aca
  // solo abre la puerta a un reparto con centavos que despues no cuadra.
  price: z.coerce
    .number()
    .int('El precio va en pesos enteros')
    .positive('El precio tiene que ser mayor que cero')
    .max(100_000_000),
  donationPercentage: z.coerce
    .number()
    .min(
      PORCENTAJE_MINIMO_DE_RECONSTRUCCION,
      `El mínimo es ${PORCENTAJE_MINIMO_DE_RECONSTRUCCION}% para reconstruir`
    )
    .max(100, 'El porcentaje va de 0 a 100'),
  imageUrl: httpsImageUrl.optional(),
  storageKey: z.string().trim().max(600).optional(),
})

type ProductImageSignature =
  | { ok: true; uploadUrl: string; key: string; publicUrl: string }
  | { ok: false; error: string }

/** Signs a single menu image for direct browser-to-R2 upload. */
export const firmarImagenProductoAction = async (
  venueId: string,
  contentType: string,
  bytes: number
): Promise<ProductImageSignature> => {
  const access = await assertVenueAccess(venueId, ['owner'])
  if (!access.ok) return { ok: false, error: access.error }

  if (!PRODUCT_IMAGE_TYPES.includes(contentType as (typeof PRODUCT_IMAGE_TYPES)[number])) {
    return { ok: false, error: 'Solo imágenes JPG, PNG, WEBP o AVIF.' }
  }

  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_PRODUCT_IMAGE_BYTES) {
    return { ok: false, error: 'La imagen puede pesar máximo 5 MB.' }
  }

  const publicBaseUrl = env.R2_BUCKET_URL?.replace(/\/$/, '')
  if (!publicBaseUrl) {
    return { ok: false, error: 'El almacenamiento de imágenes no está configurado.' }
  }

  const key = `carta/${venueId}/${createId('vpi')}.${PRODUCT_IMAGE_EXTENSIONS[contentType]}`

  try {
    const uploadUrl = await storage.getSignedUploadUrl({ key, expiresIn: 600 })
    return { ok: true, uploadUrl, key, publicUrl: `${publicBaseUrl}/${key}` }
  } catch {
    return { ok: false, error: 'No se pudo preparar la subida de la imagen.' }
  }
}

const imageForProduct = ({
  imageUrl,
  storageKey,
  venueId,
  current,
}: {
  imageUrl?: string
  storageKey?: string
  venueId: string
  current: { imageUrl: string | null; storageKey: string | null } | null
}) => {
  if (!imageUrl) return { imageUrl: null, storageKey: null }

  if (!storageKey) {
    if (current?.imageUrl === imageUrl) {
      return { imageUrl: current.imageUrl, storageKey: current.storageKey }
    }
    return { imageUrl, storageKey: null }
  }

  const publicBaseUrl = env.R2_BUCKET_URL?.replace(/\/$/, '')
  const expectedUrl = publicBaseUrl ? `${publicBaseUrl}/${storageKey}` : null
  if (!storageKey.startsWith(`carta/${venueId}/`) || imageUrl !== expectedUrl) {
    return null
  }

  return { imageUrl, storageKey }
}

/** Un slug estable a partir del nombre. Sin tildes, que nunca llegan a una URL
 *  (decision 25). */
const slugificar = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

/** El contexto de un producto, leido de la base. El venueId nunca viene del
 *  formulario cuando se toca una fila que ya existe. */
const contextoDeProducto = async (id: string) => {
  const [fila] = await db
    .select({
      id: venueProduct.id,
      venueId: venueProduct.venueId,
      slug: venue.slug,
      status: venueProduct.status,
      donationPercentage: venueProduct.donationPercentage,
      nombre: venueProduct.name,
    })
    .from(venueProduct)
    .innerJoin(venue, eq(venueProduct.venueId, venue.id))
    .where(eq(venueProduct.id, id))
    .limit(1)
  return fila ?? null
}

const revalidarCarta = (slug: string) => {
  revalidatePath(`/panel/${slug}/carta`)
  revalidatePath('/admin/productos')
  revalidatePath(`/sitios/${slug}`)
}

const slugLibre = async (venueId: string, base: string, exceptoId?: string) => {
  let candidato = base || 'producto'
  if (RESERVADOS.has(candidato)) candidato = `${candidato}-1`

  for (let intento = 0; intento < 50; intento++) {
    const sufijo = intento === 0 ? '' : `-${intento + 1}`
    const prueba = `${candidato}${sufijo}`
    const filas = await db
      .select({ id: venueProduct.id })
      .from(venueProduct)
      .where(
        exceptoId
          ? and(
              eq(venueProduct.venueId, venueId),
              eq(venueProduct.slug, prueba),
              ne(venueProduct.id, exceptoId)
            )
          : and(eq(venueProduct.venueId, venueId), eq(venueProduct.slug, prueba))
      )
      .limit(1)
    if (filas.length === 0) return prueba
  }
  return `${candidato}-${Date.now()}`
}

export const guardarProductoAction = async (
  _previous: CartaState,
  formData: FormData
): Promise<CartaState> => {
  const parsed = productoSchema.safeParse({
    venueId: formData.get('venueId'),
    name: formData.get('name'),
    kind: formData.get('kind'),
    description: formData.get('description') || undefined,
    price: formData.get('price'),
    donationPercentage: formData.get('donationPercentage'),
    imageUrl: formData.get('imageUrl') || undefined,
    storageKey: formData.get('storageKey') || undefined,
  })

  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }

  const idExistente = formData.get('id')
  const editando = typeof idExistente === 'string' && idExistente.length > 0

  // El sitio contra el que se comprueba el permiso sale de la BASE. Al editar,
  // de la fila del producto; al crear, de la fila del sitio.
  const productoExistente = editando ? await contextoDeProducto(idExistente) : null
  const venueId = editando ? productoExistente?.venueId ?? null : parsed.data.venueId

  if (!venueId) return { status: 'error', error: 'Ese producto ya no existe.' }

  const [sitio] = await db
    .select({ id: venue.id, slug: venue.slug })
    .from(venue)
    .where(eq(venue.id, venueId))
    .limit(1)

  if (!sitio) return { status: 'error', error: 'Ese sitio ya no existe.' }

  const acceso = await assertVenueAccess(sitio.id, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  const currentImage = editando
    ? ((
        await db
          .select({ imageUrl: venueProduct.imageUrl, storageKey: venueProduct.storageKey })
          .from(venueProduct)
          .where(eq(venueProduct.id, idExistente))
          .limit(1)
      )[0] ?? null)
    : null
  const image = imageForProduct({
    imageUrl: parsed.data.imageUrl,
    storageKey: parsed.data.storageKey,
    venueId: sitio.id,
    current: currentImage,
  })
  if (!image) {
    return {
      status: 'error',
      error: 'Revisa la imagen.',
      fieldErrors: { imageUrl: ['Esa imagen no corresponde a este sitio.'] },
    }
  }

  const datos = {
    name: parsed.data.name,
    kind: parsed.data.kind,
    description: parsed.data.description ?? null,
    price: parsed.data.price.toFixed(2),
    donationPercentage: parsed.data.donationPercentage.toFixed(2),
    ...image,
  }

  try {
    if (editando) {
      const slug = await slugLibre(sitio.id, slugificar(parsed.data.name), idExistente)
      await db
        .update(venueProduct)
        .set({
          ...datos,
          slug,
          updatedAt: new Date(),
        })
        .where(eq(venueProduct.id, idExistente))

      revalidarCarta(sitio.slug)
      return {
        status: 'success',
        mensaje:
          productoExistente?.status === 'published'
            ? 'Guardado. Los cambios ya se ven en la carta.'
            : productoExistente?.status === 'paused'
              ? 'Guardado. Sigue pausado hasta que decidas volver a venderlo.'
              : 'Guardado como borrador. Publícalo cuando esté listo.',
        id: idExistente,
      }
    }

    const slug = await slugLibre(sitio.id, slugificar(parsed.data.name))
    const [fila] = await db
      .insert(venueProduct)
      .values({
        ...datos,
        venueId: sitio.id,
        slug,
      })
      .returning({ id: venueProduct.id })

    revalidarCarta(sitio.slug)
    return { status: 'success', mensaje: 'Producto creado como borrador.', id: fila.id }
  } catch {
    return { status: 'error', error: 'No se pudo guardar el producto.' }
  }
}

/**
 * Kept under its old export name so existing client bundles do not break while
 * the retired review flow is rolled out. It now publishes directly for owners.
 */
export const mandarARevisionAction = async (id: string): Promise<CartaState> => {
  const contexto = await contextoDeProducto(id)
  if (!contexto) return { status: 'error', error: 'Ese producto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  if (contexto.status === 'published') {
    return { status: 'error', error: 'Ese producto ya está publicado.' }
  }
  if (contexto.status === 'archived') {
    return { status: 'error', error: 'Un producto archivado no se puede publicar.' }
  }
  if (Number(contexto.donationPercentage) < PORCENTAJE_MINIMO_DE_RECONSTRUCCION) {
    return {
      status: 'error',
      error: `El mínimo para publicar es ${PORCENTAJE_MINIMO_DE_RECONSTRUCCION}% para reconstruir.`,
    }
  }

  try {
    await db
      .update(venueProduct)
      .set({
        status: 'published',
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(venueProduct.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo publicar el producto.' }
  }

  revalidarCarta(contexto.slug)
  return { status: 'success', mensaje: 'Publicado. Ya se puede pedir.' }
}

/**
 * Owners can pause or resume their own published products. Resuming repeats the
 * minimum check so a legacy paused product cannot bypass it.
 */
export const pausarProductoAction = async (id: string, pausar: boolean): Promise<CartaState> => {
  const contexto = await contextoDeProducto(id)
  if (!contexto) return { status: 'error', error: 'Ese producto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  if (pausar && contexto.status !== 'published') {
    return { status: 'error', error: 'Solo se puede pausar algo que esté publicado.' }
  }
  if (!pausar && contexto.status !== 'paused') {
    return { status: 'error', error: 'Ese producto no está pausado.' }
  }
  if (!pausar && Number(contexto.donationPercentage) < PORCENTAJE_MINIMO_DE_RECONSTRUCCION) {
    return {
      status: 'error',
      error: `El mínimo para volver a vender es ${PORCENTAJE_MINIMO_DE_RECONSTRUCCION}% para reconstruir.`,
    }
  }

  try {
    await db
      .update(venueProduct)
      .set({ status: pausar ? 'paused' : 'published', updatedAt: new Date() })
      .where(eq(venueProduct.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo cambiar el producto.' }
  }

  revalidarCarta(contexto.slug)
  return {
    status: 'success',
    mensaje: pausar ? 'Pausado. Ya no se puede pedir.' : 'Otra vez a la venta.',
  }
}

/**
 * Archivar, que es lo mas parecido a borrar que puede existir aca.
 *
 * NO SE BORRA NUNCA si ya tiene ordenes: las referencias son `restrict` a
 * proposito, porque borrar un producto no puede llevarse por delante la orden
 * que alguien pago. Archivado sale de la carta y no se puede pedir.
 */
export const archivarProductoAction = async (id: string): Promise<CartaState> => {
  const contexto = await contextoDeProducto(id)
  if (!contexto) return { status: 'error', error: 'Ese producto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId, ['owner'])
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  try {
    await db
      .update(venueProduct)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(venueProduct.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo archivar el producto.' }
  }

  revalidarCarta(contexto.slug)
  return { status: 'success', mensaje: 'Archivado. Ya no sale en la carta.' }
}

/** Cuantas ordenes tiene un producto. Para no dejar archivar a ciegas algo que
 *  la gente esta pidiendo. */
export const contarOrdenesDeProducto = async (productId: string): Promise<number> => {
  const context = await contextoDeProducto(productId)
  if (!context) return 0

  const access = await assertVenueAccess(context.venueId, ['owner'])
  if (!access.ok) return 0

  const filas = await db
    .select({ id: productOrder.id })
    .from(productOrder)
    .where(eq(productOrder.productId, productId))
  return filas.length
}
