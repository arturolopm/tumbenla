import type {
  materialPurchase,
  materialPurchaseItem,
  materialPurchaseMedia,
} from '@/database/schema'

export type PurchaseRow = typeof materialPurchase.$inferSelect
export type PurchaseItemRow = typeof materialPurchaseItem.$inferSelect
export type PurchaseMediaRow = typeof materialPurchaseMedia.$inferSelect

export const PURCHASE_STATUSES = ['draft', 'published'] as const
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

export const MEDIA_KINDS = ['receipt', 'photo', 'delivery_note'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const PURCHASE_UNITS = [
  'bulto',
  'unidad',
  'm3',
  'lamina',
  'metro',
  'galon',
] as const
export type PurchaseUnit = (typeof PURCHASE_UNITS)[number]

export type PurchaseItem = {
  id: string
  name: string
  quantity: number
  unit: string
  unitCost: number | null
  subtotal: number | null
}

export type PurchaseMedia = {
  id: string
  kind: MediaKind
  url: string
  caption: string | null
}

export type PurchaseSummary = {
  id: string
  slug: string
  title: string
  summary: string | null
  municipality: string
  department: string
  beneficiaryLabel: string | null
  householdsHelped: number | null
  totalAmount: number
  currency: string
  purchasedAt: Date
  coverImageUrl: string | null
}

export type PurchaseDetail = PurchaseSummary & {
  story: string | null
  supplierName: string | null
  receiptNumber: string | null
  items: PurchaseItem[]
  media: PurchaseMedia[]
}

export type TransparencyTotals = {
  totalAmount: number
  currency: string
  purchaseCount: number
  municipalities: string[]
  householdsHelped: number
}
