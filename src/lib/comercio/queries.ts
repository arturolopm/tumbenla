import 'server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/database'
import { productOrder, venue, venueProduct } from '@/database/schema'
import { repartir } from '@/lib/comercio/dinero'
import type { EstadoDeProducto, KindDeProducto } from '@/lib/comercio/types'

/**
 * Lecturas de la carta.
 *
 * Todo `decimal` vuelve de postgres-js como STRING. La conversion se hace aca y
 * no en el componente: `Number()` en el borde, o los totales salen en NaN. Cada
 * consulta devuelve un DTO ya convertido, nunca la fila cruda.
 */

export type ProductoDTO = {
  id: string
  slug: string
  nombre: string
  kind: KindDeProducto
  descripcion: string | null
  precio: number
  porcentajeMaterial: number
  /** Ya repartido, para no recalcularlo en cada componente que lo pinte. */
  material: number
  sitio: number
  imagenUrl: string | null
  estado: EstadoDeProducto
  notaDeRevision: string | null
  creadoEn: Date
}

const aProductoDTO = (fila: {
  id: string
  slug: string
  name: string
  kind: string
  description: string | null
  price: string
  donationPercentage: string
  imageUrl: string | null
  status: string
  reviewNote: string | null
  createdAt: Date
}): ProductoDTO => {
  const precio = Number(fila.price)
  const porcentajeMaterial = Number(fila.donationPercentage)
  const { material, sitio } = repartir(precio, porcentajeMaterial)

  return {
    id: fila.id,
    slug: fila.slug,
    nombre: fila.name,
    kind: fila.kind as KindDeProducto,
    descripcion: fila.description,
    precio,
    porcentajeMaterial,
    material,
    sitio,
    imagenUrl: fila.imageUrl,
    estado: fila.status as EstadoDeProducto,
    notaDeRevision: fila.reviewNote,
    creadoEn: fila.createdAt,
  }
}

const COLUMNAS = {
  id: venueProduct.id,
  slug: venueProduct.slug,
  name: venueProduct.name,
  kind: venueProduct.kind,
  description: venueProduct.description,
  price: venueProduct.price,
  donationPercentage: venueProduct.donationPercentage,
  imageUrl: venueProduct.imageUrl,
  status: venueProduct.status,
  reviewNote: venueProduct.reviewNote,
  createdAt: venueProduct.createdAt,
}

/** Lo que ve el sitio en su panel: todos los estados menos lo archivado. */
export const listarCartaDelPanel = async (venueId: string): Promise<ProductoDTO[]> => {
  const filas = await db
    .select(COLUMNAS)
    .from(venueProduct)
    .where(and(eq(venueProduct.venueId, venueId), sql`${venueProduct.status} <> 'archived'`))
    .orderBy(desc(venueProduct.createdAt))

  return filas.map(aProductoDTO)
}

/**
 * Lo que ve el publico. El filtro de `published` va DENTRO de la consulta, no
 * en un `.filter()` despues: un borrador no puede llegar al cliente ni siquiera
 * para ser descartado alli.
 */
export const listarCartaPublica = async (venueId: string): Promise<ProductoDTO[]> => {
  const filas = await db
    .select(COLUMNAS)
    .from(venueProduct)
    .where(and(eq(venueProduct.venueId, venueId), eq(venueProduct.status, 'published')))
    .orderBy(asc(venueProduct.price))

  return filas.map(aProductoDTO)
}

/**
 * Un producto para la pantalla de pedir.
 *
 * Devuelve null si no esta `published`, y ese null es lo que da el 404. Sin
 * esto, esconder el boton seria toda la proteccion, y pegarle directo a la URL
 * con un borrador funcionaria.
 */
export const productoPublicoPorSlug = async (
  venueSlug: string,
  productoSlug: string
): Promise<(ProductoDTO & { venueId: string; venueNombre: string }) | null> => {
  const [fila] = await db
    .select({
      ...COLUMNAS,
      venueId: venueProduct.venueId,
      venueNombre: venue.name,
      venueStatus: venue.status,
    })
    .from(venueProduct)
    .innerJoin(venue, eq(venueProduct.venueId, venue.id))
    .where(
      and(
        eq(venue.slug, venueSlug),
        eq(venueProduct.slug, productoSlug),
        eq(venueProduct.status, 'published')
      )
    )
    .limit(1)

  // Un sitio despublicado se lleva su carta con el. Si no, quedaria vendiendo
  // desde una pagina que ya no existe.
  if (!fila || fila.venueStatus !== 'published') return null

  return { ...aProductoDTO(fila), venueId: fila.venueId, venueNombre: fila.venueNombre }
}

export type ProductoEnRevision = ProductoDTO & {
  venueId: string
  venueSlug: string
  venueNombre: string
}

/** La cola del operador: lo que espera revision primero, y lo mas viejo arriba
 *  (`asc`), que es el orden en que se atiende una cola de verdad. */
export const listarProductosParaRevisar = async (): Promise<ProductoEnRevision[]> => {
  const filas = await db
    .select({
      ...COLUMNAS,
      venueId: venueProduct.venueId,
      venueSlug: venue.slug,
      venueNombre: venue.name,
    })
    .from(venueProduct)
    .innerJoin(venue, eq(venueProduct.venueId, venue.id))
    .where(sql`${venueProduct.status} in ('pending_review', 'published', 'paused')`)
    .orderBy(
      sql`case when ${venueProduct.status} = 'pending_review' then 0 else 1 end`,
      asc(venueProduct.createdAt)
    )

  return filas.map((f) => ({
    ...aProductoDTO(f),
    venueId: f.venueId,
    venueSlug: f.venueSlug,
    venueNombre: f.venueNombre,
  }))
}

export const contarProductosPorRevisar = async (): Promise<number> => {
  const filas = await db
    .select({ id: venueProduct.id })
    .from(venueProduct)
    .where(eq(venueProduct.status, 'pending_review'))
  return filas.length
}

/** Cuantas ordenes tiene cada producto de un sitio, para la carta del panel. */
export const contarOrdenesPorProducto = async (
  venueId: string
): Promise<Record<string, number>> => {
  const filas = await db
    .select({ productId: productOrder.productId, total: sql<string>`count(*)` })
    .from(productOrder)
    .where(eq(productOrder.venueId, venueId))
    .groupBy(productOrder.productId)

  return Object.fromEntries(filas.map((f) => [f.productId, Number(f.total)]))
}
