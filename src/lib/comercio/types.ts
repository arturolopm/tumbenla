/**
 * Los valores permitidos de las columnas `text` que hacen de enum, y sus
 * etiquetas en español.
 *
 * EL VALOR GUARDADO VA EN ASCII; LA ETIQUETA LLEVA SU TILDE (`PRODUCT.md`,
 * decision 25). Es el mismo patron que `UNIT_LABEL` en
 * `src/components/sitios/pledge-badge.tsx`: asi un acento nunca llega a una
 * URL, a una consulta ni a una migracion, y aun asi lo que la gente lee esta
 * bien escrito.
 */

export const KINDS_DE_PRODUCTO = [
  'coctel',
  'cerveza',
  'botella',
  'combo',
  'entrada',
  'otro',
] as const
export type KindDeProducto = (typeof KINDS_DE_PRODUCTO)[number]

export const KIND_LABEL: Record<KindDeProducto, string> = {
  coctel: 'Cóctel',
  cerveza: 'Cerveza',
  botella: 'Botella',
  combo: 'Combo',
  entrada: 'Entrada',
  otro: 'Otro',
}

export const ESTADOS_DE_PRODUCTO = [
  'draft',
  'pending_review',
  'published',
  'paused',
  'archived',
] as const
export type EstadoDeProducto = (typeof ESTADOS_DE_PRODUCTO)[number]

/** Lo que ve el SITIO. Dice en que va y de quien es el siguiente paso, que es
 *  lo unico que quiere saber quien esta esperando. */
export const ESTADO_LABEL: Record<EstadoDeProducto, string> = {
  draft: 'Borrador',
  pending_review: 'En revisión',
  published: 'A la venta',
  paused: 'Pausado',
  archived: 'Archivado',
}

export const ESTADO_AYUDA: Record<EstadoDeProducto, string> = {
  draft: 'Todavía no lo hemos visto. Mándalo a revisión cuando esté listo.',
  pending_review: 'Lo estamos mirando. Te avisamos apenas salga.',
  published: 'Se puede pedir. Aparece en tu página.',
  paused: 'No se puede pedir. Los pedidos que ya existen siguen valiendo.',
  archived: 'Fuera de la carta. Los pedidos que ya existen siguen valiendo.',
}

export const PAY_METHODS = ['app', 'bar'] as const
export type PayMethod = (typeof PAY_METHODS)[number]

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  app: 'Pagado aquí',
  bar: 'Paga en la barra',
}

export const ESTADOS_DE_ORDEN = ['pending', 'paid', 'expired', 'refunded', 'cancelled'] as const
export type EstadoDeOrden = (typeof ESTADOS_DE_ORDEN)[number]

export const ESTADOS_DE_REDENCION = ['issued', 'redeemed', 'void'] as const
export type EstadoDeRedencion = (typeof ESTADOS_DE_REDENCION)[number]

/** Los dias que vive un pedido sin reclamar antes de irse en material
 *  (`PRODUCT.md`, decision 32). */
export const DIAS_PARA_CADUCAR = 45

export const fechaDeCaducidad = (desde: Date = new Date()) =>
  new Date(desde.getTime() + DIAS_PARA_CADUCAR * 24 * 60 * 60 * 1000)
