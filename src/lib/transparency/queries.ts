import 'server-only'

import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/database'
import {
  materialPurchase,
  materialPurchaseItem,
  materialPurchaseMedia,
} from '@/database/schema'
import { toPurchaseDetail, toPurchaseSummary } from './mappers'
import type { PurchaseDetail, PurchaseSummary, TransparencyTotals } from './types'

export const listPublishedPurchases = async (): Promise<PurchaseSummary[]> => {
  const rows = await db
    .select()
    .from(materialPurchase)
    .where(eq(materialPurchase.status, 'published'))
    .orderBy(desc(materialPurchase.purchasedAt))

  return rows.map(toPurchaseSummary)
}

export const getPurchaseBySlug = async (slug: string): Promise<PurchaseDetail | null> => {
  const [row] = await db
    .select()
    .from(materialPurchase)
    .where(
      and(eq(materialPurchase.slug, slug), eq(materialPurchase.status, 'published'))
    )
    .limit(1)

  if (!row) return null

  const [items, media] = await Promise.all([
    db
      .select()
      .from(materialPurchaseItem)
      .where(eq(materialPurchaseItem.purchaseId, row.id)),
    // Only consented media is ever returned to a public caller. This is the
    // gate, not the admin UI: a photo without consent must not be reachable
    // even if something later renders media without checking.
    db
      .select()
      .from(materialPurchaseMedia)
      .where(
        and(
          eq(materialPurchaseMedia.purchaseId, row.id),
          eq(materialPurchaseMedia.consentGiven, true)
        )
      ),
  ])

  return toPurchaseDetail(row, items, media)
}

/**
 * The running total. This number is the whole argument the product makes, so it
 * is computed from published rows only and never from anything in draft.
 */
export const getTransparencyTotals = async (): Promise<TransparencyTotals> => {
  const rows = await db
    .select({
      totalAmount: materialPurchase.totalAmount,
      currency: materialPurchase.currency,
      municipality: materialPurchase.municipality,
      householdsHelped: materialPurchase.householdsHelped,
    })
    .from(materialPurchase)
    .where(eq(materialPurchase.status, 'published'))

  // Number() on every value: these are decimal columns, so `+` on the raw
  // strings would concatenate rather than add.
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.totalAmount), 0)
  const householdsHelped = rows.reduce(
    (sum, row) => sum + (row.householdsHelped ? Number(row.householdsHelped) : 0),
    0
  )

  return {
    totalAmount,
    currency: rows[0]?.currency ?? 'COP',
    purchaseCount: rows.length,
    municipalities: [...new Set(rows.map((row) => row.municipality))].sort(),
    householdsHelped,
  }
}

export const listPublishedPurchaseSlugs = async (): Promise<
  { slug: string; updatedAt: Date }[]
> => {
  return db
    .select({ slug: materialPurchase.slug, updatedAt: materialPurchase.updatedAt })
    .from(materialPurchase)
    .where(eq(materialPurchase.status, 'published'))
}
