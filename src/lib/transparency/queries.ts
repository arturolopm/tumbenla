import 'server-only'

import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/database'
import { financeEvidence, foundationPurchase } from '@/database/commerce-schema'
import { materialPurchase, materialPurchaseItem, materialPurchaseMedia } from '@/database/schema'
import { toPurchaseDetail, toPurchaseSummary } from './mappers'
import type { PurchaseDetail, PurchaseSummary, TransparencyTotals } from './types'

type TransparencyDatabase = typeof db

export const listPublishedPurchasesFrom = async (
  database: TransparencyDatabase
): Promise<PurchaseSummary[]> => {
  const rows = await database
    .select({ purchase: materialPurchase })
    .from(materialPurchase)
    .innerJoin(foundationPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
    .innerJoin(financeEvidence, eq(foundationPurchase.receiptEvidenceId, financeEvidence.id))
    .where(
      and(
        eq(materialPurchase.status, 'published'),
        eq(foundationPurchase.status, 'verified'),
        eq(financeEvidence.ownerType, 'foundation_purchase'),
        eq(financeEvidence.ownerId, foundationPurchase.id),
        eq(financeEvidence.kind, 'purchase_receipt'),
        eq(financeEvidence.status, 'published')
      )
    )
    .orderBy(desc(materialPurchase.purchasedAt))

  return rows.map((row) => toPurchaseSummary(row.purchase))
}

export const listPublishedPurchases = async (): Promise<PurchaseSummary[]> =>
  listPublishedPurchasesFrom(db)

export const getPurchaseBySlugFrom = async (
  database: TransparencyDatabase,
  slug: string
): Promise<PurchaseDetail | null> => {
  const [row] = await database
    .select({ purchase: materialPurchase })
    .from(materialPurchase)
    .innerJoin(foundationPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
    .innerJoin(financeEvidence, eq(foundationPurchase.receiptEvidenceId, financeEvidence.id))
    .where(
      and(
        eq(materialPurchase.slug, slug),
        eq(materialPurchase.status, 'published'),
        eq(foundationPurchase.status, 'verified'),
        eq(financeEvidence.ownerType, 'foundation_purchase'),
        eq(financeEvidence.ownerId, foundationPurchase.id),
        eq(financeEvidence.kind, 'purchase_receipt'),
        eq(financeEvidence.status, 'published')
      )
    )
    .limit(1)

  if (!row) return null

  const [items, media] = await Promise.all([
    database
      .select()
      .from(materialPurchaseItem)
      .where(eq(materialPurchaseItem.purchaseId, row.purchase.id)),
    // Only consented media is ever returned to a public caller. This is the
    // gate, not the admin UI: a photo without consent must not be reachable
    // even if something later renders media without checking.
    database
      .select()
      .from(materialPurchaseMedia)
      .where(
        and(
          eq(materialPurchaseMedia.purchaseId, row.purchase.id),
          eq(materialPurchaseMedia.consentGiven, true)
        )
      ),
  ])

  return toPurchaseDetail(row.purchase, items, media)
}

export const getPurchaseBySlug = async (slug: string): Promise<PurchaseDetail | null> =>
  getPurchaseBySlugFrom(db, slug)

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
    .innerJoin(foundationPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
    .innerJoin(financeEvidence, eq(foundationPurchase.receiptEvidenceId, financeEvidence.id))
    .where(
      and(
        eq(materialPurchase.status, 'published'),
        eq(foundationPurchase.status, 'verified'),
        eq(financeEvidence.ownerType, 'foundation_purchase'),
        eq(financeEvidence.ownerId, foundationPurchase.id),
        eq(financeEvidence.kind, 'purchase_receipt'),
        eq(financeEvidence.status, 'published')
      )
    )

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
    .innerJoin(foundationPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
    .innerJoin(financeEvidence, eq(foundationPurchase.receiptEvidenceId, financeEvidence.id))
    .where(
      and(
        eq(materialPurchase.status, 'published'),
        eq(foundationPurchase.status, 'verified'),
        eq(financeEvidence.ownerType, 'foundation_purchase'),
        eq(financeEvidence.ownerId, foundationPurchase.id),
        eq(financeEvidence.kind, 'purchase_receipt'),
        eq(financeEvidence.status, 'published')
      )
    )
}
