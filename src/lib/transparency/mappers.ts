import type {
  MediaKind,
  PurchaseDetail,
  PurchaseItem,
  PurchaseItemRow,
  PurchaseMedia,
  PurchaseMediaRow,
  PurchaseRow,
  PurchaseSummary,
} from './types'

/**
 * Same rule as src/lib/venues/mappers.ts: every decimal comes back from
 * postgres-js as a string, so this is the only place money and quantities
 * become numbers. Summing raw rows would concatenate strings instead of adding.
 */

const toNumber = (value: string | null): number | null =>
  value === null ? null : Number(value)

export const toPurchaseSummary = (row: PurchaseRow): PurchaseSummary => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  municipality: row.municipality,
  department: row.department,
  beneficiaryLabel: row.beneficiaryLabel,
  householdsHelped: toNumber(row.householdsHelped),
  totalAmount: Number(row.totalAmount),
  currency: row.currency,
  purchasedAt: row.purchasedAt,
  coverImageUrl: row.coverImageUrl,
})

export const toPurchaseItem = (row: PurchaseItemRow): PurchaseItem => ({
  id: row.id,
  name: row.name,
  quantity: Number(row.quantity),
  unit: row.unit,
  unitCost: toNumber(row.unitCost),
  subtotal: toNumber(row.subtotal),
})

export const toPurchaseMedia = (row: PurchaseMediaRow): PurchaseMedia => ({
  id: row.id,
  kind: row.kind as MediaKind,
  url: row.url,
  caption: row.caption,
})

export const toPurchaseDetail = (
  row: PurchaseRow,
  items: PurchaseItemRow[],
  media: PurchaseMediaRow[]
): PurchaseDetail => ({
  ...toPurchaseSummary(row),
  story: row.story,
  supplierName: row.supplierName,
  receiptNumber: row.receiptNumber,
  items: [...items]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map(toPurchaseItem),
  media: [...media]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map(toPurchaseMedia),
})
