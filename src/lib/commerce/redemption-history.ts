import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/database'
import { orderRedemption, productOrder, venueProduct } from '@/database/schema'
import type { RecentVenueOrder } from './redemption-history-types'

/** The most recent completed orders for a venue's quick scanner recall. */
export const listRecentVenueOrders = async (
  venueId: string,
  limit = 10
): Promise<RecentVenueOrder[]> => {
  const redeemedAt = sql<Date>`max(${orderRedemption.redeemedAt})`.as('redeemed_at')

  const rows = await db
    .select({
      id: productOrder.id,
      productName: venueProduct.name,
      buyerName: productOrder.buyerName,
      quantity: productOrder.quantity,
      payMethod: productOrder.payMethod,
      unitPrice: productOrder.unitPrice,
      redeemedAt,
    })
    .from(orderRedemption)
    .innerJoin(productOrder, eq(orderRedemption.orderId, productOrder.id))
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .where(and(eq(productOrder.venueId, venueId), eq(orderRedemption.status, 'redeemed')))
    .groupBy(
      productOrder.id,
      venueProduct.name,
      productOrder.buyerName,
      productOrder.quantity,
      productOrder.payMethod,
      productOrder.unitPrice
    )
    .orderBy(desc(redeemedAt))
    .limit(Math.min(Math.max(limit, 1), 25))

  return rows.map((row) => ({
    id: row.id,
    productName: row.productName,
    buyerName: row.buyerName,
    quantity: Number(row.quantity),
    chargeAtBar: row.payMethod === 'bar' ? Number(row.unitPrice) * Number(row.quantity) : null,
    redeemedAt: new Date(row.redeemedAt).toISOString(),
  }))
}
