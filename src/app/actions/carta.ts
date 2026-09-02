'use server'

import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import { productOrder, venue, venueProduct } from '@/database/schema'
import { assertAdmin } from '@/lib/auth/admin'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { KINDS_DE_PRODUCTO } from '@/lib/comercio/types'

/**
 * La carta de un sitio: los productos que vende con su reparto.
 *
 * EL SITIO PROPONE, UN OPERADOR PUBLICA (`PRODUCT.md`, decision 31). El
 * porcentaje que se va en material es una afirmacion publica sobre plata hecha
 * bajo nuestro dominio; si un sitio pudiera publicar solo, estariamos firmando
 * con nuestro nombre un numero que nadie miro. Es la misma forma de la decision
 * 19, donde el sitio reporta y nosotros verificamos.
 *
 * EL SITIO NO PUEDE TOCAR status, reviewedAt, reviewNote NI publishedAt. No
 * porque el formulario no los pinte, sino porque estas acciones no los leen del
 * formulario en ningun caso.
 *
 * Y el venueId con el que se comprueba el permiso SIEMPRE sale de la fila leida
 * de la base, nunca del formulario. Un id de otro sitio en un input escondido
 * no da acceso a ese otro sitio: da un rechazo.
 */

export type CartaState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string[]> }
  | { status: 'success'; mensaje: string; id?: string }

const RESERVADOS = new Set(['nuevo', 'editar', 'pedir', 'admin', 'panel', 'api'])

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
    .min(0, 'El porcentaje va de 0 a 100')
    .max(100, 'El porcentaje va de 0 a 100'),
})

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
  const venueId = editando
    ? ((await contextoDeProducto(idExistente))?.venueId ?? null)
    : parsed.data.venueId

  if (!venueId) return { status: 'error', error: 'Ese producto ya no existe.' }

  const [sitio] = await db
    .select({ id: venue.id, slug: venue.slug })
    .from(venue)
    .where(eq(venue.id, venueId))
    .limit(1)

  if (!sitio) return { status: 'error', error: 'Ese sitio ya no existe.' }

  const acceso = await assertVenueAccess(sitio.id)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  const datos = {
    name: parsed.data.name,
    kind: parsed.data.kind,
    description: parsed.data.description ?? null,
    price: parsed.data.price.toFixed(2),
    donationPercentage: parsed.data.donationPercentage.toFixed(2),
  }

  try {
    if (editando) {
      const slug = await slugLibre(sitio.id, slugificar(parsed.data.name), idExistente)
      await db
        .update(venueProduct)
        .set({
          ...datos,
          slug,
          // Cambiar un producto lo devuelve a revision. El reparto es lo que
          // respaldamos: si se pudiera editar despues de aprobado, aprobar no
          // querria decir nada (decision 30).
          status: 'pending_review',
          reviewedAt: null,
          reviewNote: null,
          publishedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(venueProduct.id, idExistente))

      revalidarCarta(sitio.slug)
      return {
        status: 'success',
        mensaje: 'Guardado. Vuelve a revisión antes de salir a la carta.',
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
        // status se queda en su default 'draft'. No se lee del formulario.
      })
      .returning({ id: venueProduct.id })

    revalidarCarta(sitio.slug)
    return { status: 'success', mensaje: 'Producto creado como borrador.', id: fila.id }
  } catch {
    return { status: 'error', error: 'No se pudo guardar el producto.' }
  }
}

/**
 * El sitio lo manda a revision. No lo publica: eso es de la plataforma.
 */
export const mandarARevisionAction = async (id: string): Promise<CartaState> => {
  const contexto = await contextoDeProducto(id)
  if (!contexto) return { status: 'error', error: 'Ese producto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  if (contexto.status === 'published') {
    return { status: 'error', error: 'Ese producto ya está publicado.' }
  }

  try {
    await db
      .update(venueProduct)
      .set({ status: 'pending_review', updatedAt: new Date() })
      .where(eq(venueProduct.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo mandar a revisión.' }
  }

  revalidarCarta(contexto.slug)
  return { status: 'success', mensaje: 'Mandado a revisión. Te avisamos.' }
}

/**
 * Pausar y reactivar SI son del sitio: es dejar de vender algo que ya se
 * aprobo, no cambiar lo que se afirma. Reactivar no vuelve a pedir revision
 * porque el reparto es el mismo que ya se aprobo.
 */
export const pausarProductoAction = async (id: string, pausar: boolean): Promise<CartaState> => {
  const contexto = await contextoDeProducto(id)
  if (!contexto) return { status: 'error', error: 'Ese producto ya no existe.' }

  const acceso = await assertVenueAccess(contexto.venueId)
  if (!acceso.ok) return { status: 'error', error: acceso.error }

  if (pausar && contexto.status !== 'published') {
    return { status: 'error', error: 'Solo se puede pausar algo que esté publicado.' }
  }
  if (!pausar && contexto.status !== 'paused') {
    return { status: 'error', error: 'Ese producto no está pausado.' }
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

  const acceso = await assertVenueAccess(contexto.venueId)
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

// -------------------------------------------------------- revision (plataforma)

/**
 * Publicar o rechazar. Solo la plataforma, y es lo unico que pone un producto
 * a la venta.
 */
export const revisarProductoAction = async (
  id: string,
  decision: 'published' | 'rejected',
  nota?: string
): Promise<CartaState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }

  const contexto = await contextoDeProducto(id)
  if (!contexto) return { status: 'error', error: 'Ese producto ya no existe.' }

  try {
    await db
      .update(venueProduct)
      .set({
        // Un rechazo vuelve a borrador, no a un estado muerto: el sitio corrige
        // y lo vuelve a mandar. Con la nota puesta, que es lo que le dice que
        // corregir.
        status: decision === 'published' ? 'published' : 'draft',
        reviewedByUserId: admin.userId,
        reviewedAt: new Date(),
        reviewNote: nota?.trim() || null,
        publishedAt: decision === 'published' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(venueProduct.id, id))
  } catch {
    return { status: 'error', error: 'No se pudo revisar el producto.' }
  }

  revalidarCarta(contexto.slug)
  return {
    status: 'success',
    mensaje: decision === 'published' ? 'Publicado. Ya se puede pedir.' : 'Devuelto al sitio.',
  }
}

/** Cuantas ordenes tiene un producto. Para no dejar archivar a ciegas algo que
 *  la gente esta pidiendo. */
export const contarOrdenesDeProducto = async (productId: string): Promise<number> => {
  const filas = await db
    .select({ id: productOrder.id })
    .from(productOrder)
    .where(eq(productOrder.productId, productId))
  return filas.length
}
