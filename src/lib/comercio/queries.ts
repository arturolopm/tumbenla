import 'server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/database'
import {
  ledgerAccount,
  ledgerEntry,
  ledgerTransaction,
  orderRedemption,
  productOrder,
  venue,
  venueProduct,
  venueSettlement,
} from '@/database/schema'
import { repartir } from '@/lib/comercio/dinero'
import type {
  EstadoDeOrden,
  EstadoDeProducto,
  EstadoDeRedencion,
  KindDeProducto,
  PayMethod,
} from '@/lib/comercio/types'

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

// -------------------------------------------------------- ordenes

export type RedencionDTO = {
  id: string
  /** El codigo en claro. Es lo que va en el QR y lo que se teclea a mano. */
  codigo: string
  estado: EstadoDeRedencion
  redimidaEn: Date | null
}

export type OrdenDTO = {
  id: string
  publicToken: string
  compradorNombre: string
  compradorEmail: string
  cantidad: number
  precioUnitario: number
  materialPorUnidad: number
  sitioPorUnidad: number
  total: number
  porcentajeMaterial: number
  payMethod: PayMethod
  estado: EstadoDeOrden
  creadaEn: Date
  caducaEn: Date | null
  productoNombre: string
  productoKind: KindDeProducto
  productoDescripcion: string | null
  venueId: string
  venueSlug: string
  venueNombre: string
  redenciones: RedencionDTO[]
}

/**
 * La orden que hay detras de /orden/[token].
 *
 * Se busca por `publicToken` y no por id: el id sale en pantallas de operacion
 * y en logs, y quien pueda abrir esta pagina puede leer los codigos.
 */
export const ordenPorToken = async (token: string): Promise<OrdenDTO | null> => {
  const [fila] = await db
    .select({
      id: productOrder.id,
      publicToken: productOrder.publicToken,
      buyerName: productOrder.buyerName,
      buyerEmail: productOrder.buyerEmail,
      quantity: productOrder.quantity,
      unitPrice: productOrder.unitPrice,
      unitDonationAmount: productOrder.unitDonationAmount,
      unitVenueAmount: productOrder.unitVenueAmount,
      totalAmount: productOrder.totalAmount,
      donationPercentage: productOrder.donationPercentage,
      payMethod: productOrder.payMethod,
      status: productOrder.status,
      createdAt: productOrder.createdAt,
      expiresAt: productOrder.expiresAt,
      productoNombre: venueProduct.name,
      productoKind: venueProduct.kind,
      productoDescripcion: venueProduct.description,
      venueId: productOrder.venueId,
      venueSlug: venue.slug,
      venueNombre: venue.name,
    })
    .from(productOrder)
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .innerJoin(venue, eq(productOrder.venueId, venue.id))
    .where(eq(productOrder.publicToken, token))
    .limit(1)

  if (!fila) return null

  const redenciones = await db
    .select({
      id: orderRedemption.id,
      code: orderRedemption.code,
      status: orderRedemption.status,
      redeemedAt: orderRedemption.redeemedAt,
    })
    .from(orderRedemption)
    .where(eq(orderRedemption.orderId, fila.id))
    .orderBy(asc(orderRedemption.createdAt))

  return {
    id: fila.id,
    publicToken: fila.publicToken,
    compradorNombre: fila.buyerName,
    compradorEmail: fila.buyerEmail,
    cantidad: Number(fila.quantity),
    precioUnitario: Number(fila.unitPrice),
    materialPorUnidad: Number(fila.unitDonationAmount),
    sitioPorUnidad: Number(fila.unitVenueAmount),
    total: Number(fila.totalAmount),
    porcentajeMaterial: Number(fila.donationPercentage),
    payMethod: fila.payMethod as PayMethod,
    estado: fila.status as EstadoDeOrden,
    creadaEn: fila.createdAt,
    caducaEn: fila.expiresAt,
    productoNombre: fila.productoNombre,
    productoKind: fila.productoKind as KindDeProducto,
    productoDescripcion: fila.productoDescripcion,
    venueId: fila.venueId,
    venueSlug: fila.venueSlug,
    venueNombre: fila.venueNombre,
    redenciones: redenciones.map((r) => ({
      id: r.id,
      codigo: r.code,
      estado: r.status as EstadoDeRedencion,
      redimidaEn: r.redeemedAt,
    })),
  }
}

/**
 * Lo minimo que sondea la pagina del QR, cada segundo.
 *
 * Un `select` por indice que devuelve unas decenas de bytes, sin sesion que
 * validar (el token de la URL ES la autenticacion) y sin tocar `venue` ni
 * `venue_product`. Se mantiene aparte de `ordenPorToken` justo por eso: la
 * consulta que corre mil veces no puede ser la que arma la pantalla entera.
 */
export const estadoDeOrdenPorToken = async (
  token: string
): Promise<{ estado: EstadoDeOrden; entregadas: number; total: number } | null> => {
  const [fila] = await db
    .select({
      id: productOrder.id,
      status: productOrder.status,
      quantity: productOrder.quantity,
    })
    .from(productOrder)
    .where(eq(productOrder.publicToken, token))
    .limit(1)

  if (!fila) return null

  const [conteo] = await db
    .select({
      entregadas: sql<string>`count(*) filter (where ${orderRedemption.status} = 'redeemed')`,
    })
    .from(orderRedemption)
    .where(eq(orderRedemption.orderId, fila.id))

  return {
    estado: fila.status as EstadoDeOrden,
    entregadas: Number(conteo?.entregadas ?? 0),
    total: Number(fila.quantity),
  }
}

// -------------------------------------------------------- saldo y liquidacion

export type MovimientoDTO = {
  id: string
  fecha: Date
  tipo: string
  monto: number
  producto: string | null
  payMethod: PayMethod | null
  liquidado: boolean
}

/**
 * El movimiento de la cuenta de un sitio, mas nuevo arriba.
 *
 * Cada fila es un asiento contra SU cuenta `venue_current`. El signo es desde
 * nuestro lado: positivo = el sitio nos debe, negativo = le debemos.
 */
export const movimientosDeSitio = async (
  venueId: string,
  limite = 100
): Promise<MovimientoDTO[]> => {
  const filas = await db
    .select({
      id: ledgerEntry.id,
      fecha: ledgerEntry.createdAt,
      monto: ledgerEntry.amount,
      tipo: ledgerTransaction.kind,
      settlementId: ledgerTransaction.settlementId,
      producto: venueProduct.name,
      payMethod: productOrder.payMethod,
    })
    .from(ledgerEntry)
    .innerJoin(ledgerAccount, eq(ledgerAccount.id, ledgerEntry.accountId))
    .innerJoin(ledgerTransaction, eq(ledgerTransaction.id, ledgerEntry.transactionId))
    .leftJoin(productOrder, eq(productOrder.id, ledgerTransaction.orderId))
    .leftJoin(venueProduct, eq(venueProduct.id, productOrder.productId))
    .where(and(eq(ledgerAccount.kind, 'venue_current'), eq(ledgerAccount.venueId, venueId)))
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(limite)

  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    tipo: f.tipo,
    monto: Number(f.monto),
    producto: f.producto,
    payMethod: (f.payMethod as PayMethod) ?? null,
    liquidado: f.settlementId !== null,
  }))
}

export type SaldoDeSitio = {
  venueId: string
  slug: string
  nombre: string
  saldo: number
  movimientos: number
}

/**
 * Los saldos de todos los sitios, para el operador.
 *
 * Solo los que tienen movimiento: un sitio que nunca vendio nada no es una fila
 * en cero que haya que leer, es un sitio que no aparece.
 */
export const saldosDeTodosLosSitios = async (): Promise<SaldoDeSitio[]> => {
  const filas = await db
    .select({
      venueId: venue.id,
      slug: venue.slug,
      nombre: venue.name,
      saldo: sql<string>`coalesce(sum(${ledgerEntry.amount}), 0)`,
      movimientos: sql<string>`count(${ledgerEntry.id})`,
    })
    .from(ledgerAccount)
    .innerJoin(venue, eq(venue.id, ledgerAccount.venueId))
    .innerJoin(ledgerEntry, eq(ledgerEntry.accountId, ledgerAccount.id))
    .where(eq(ledgerAccount.kind, 'venue_current'))
    .groupBy(venue.id, venue.slug, venue.name)
    .orderBy(desc(sql`abs(sum(${ledgerEntry.amount}))`))

  return filas.map((f) => ({
    venueId: f.venueId,
    slug: f.slug,
    nombre: f.nombre,
    saldo: Number(f.saldo),
    movimientos: Number(f.movimientos),
  }))
}

export type LiquidacionDTO = {
  id: string
  fecha: Date
  monto: number
  direccion: 'to_venue' | 'from_venue'
  metodo: string | null
  referencia: string | null
  nota: string | null
}

export const liquidacionesDeSitio = async (venueId: string): Promise<LiquidacionDTO[]> => {
  const filas = await db
    .select({
      id: venueSettlement.id,
      fecha: venueSettlement.createdAt,
      monto: venueSettlement.amount,
      direccion: venueSettlement.direction,
      metodo: venueSettlement.method,
      referencia: venueSettlement.reference,
      nota: venueSettlement.note,
    })
    .from(venueSettlement)
    .where(eq(venueSettlement.venueId, venueId))
    .orderBy(desc(venueSettlement.createdAt))

  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    monto: Number(f.monto),
    direccion: f.direccion as 'to_venue' | 'from_venue',
    metodo: f.metodo,
    referencia: f.referencia,
    nota: f.nota,
  }))
}

// -------------------------------------------------------- la historia de quien pide

export type PedidoMio = {
  id: string
  publicToken: string
  fecha: Date
  productoNombre: string
  venueSlug: string
  venueNombre: string
  cantidad: number
  total: number
  material: number
  estado: EstadoDeOrden
  entregadas: number
}

/**
 * Los pedidos de una persona, para /mi-historia.
 *
 * Incluye los que hizo como invitado y despues quedaron amarrados a su cuenta
 * (ver `vincularPedidosDeInvitado`).
 */
export const misPedidos = async (userId: string): Promise<PedidoMio[]> => {
  const filas = await db
    .select({
      id: productOrder.id,
      publicToken: productOrder.publicToken,
      fecha: productOrder.createdAt,
      productoNombre: venueProduct.name,
      venueSlug: venue.slug,
      venueNombre: venue.name,
      quantity: productOrder.quantity,
      totalAmount: productOrder.totalAmount,
      unitDonationAmount: productOrder.unitDonationAmount,
      status: productOrder.status,
      entregadas: sql<string>`(
        select count(*) from ${orderRedemption}
        where ${orderRedemption.orderId} = ${productOrder.id}
          and ${orderRedemption.status} = 'redeemed'
      )`,
    })
    .from(productOrder)
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .innerJoin(venue, eq(productOrder.venueId, venue.id))
    .where(eq(productOrder.userId, userId))
    .orderBy(desc(productOrder.createdAt))

  return filas.map((f) => {
    const cantidad = Number(f.quantity)
    return {
      id: f.id,
      publicToken: f.publicToken,
      fecha: f.fecha,
      productoNombre: f.productoNombre,
      venueSlug: f.venueSlug,
      venueNombre: f.venueNombre,
      cantidad,
      total: Number(f.totalAmount),
      material: Number(f.unitDonationAmount) * cantidad,
      estado: f.status as EstadoDeOrden,
      entregadas: Number(f.entregadas),
    }
  })
}
