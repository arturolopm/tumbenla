import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/database'
import { customerOrder, orderRedemption, productOrder, venueProduct } from '@/database/schema'
import type { RecentVenueOrder } from './redemption-history-types'

/** The most recent completed orders for a venue's quick scanner recall. */
export const listRecentVenueOrders = async (
  venueId: string,
  limit = 10
): Promise<RecentVenueOrder[]> => {
  const redeemedAt = sql<Date>`max(${orderRedemption.redeemedAt})`.as('redeemed_at')

  const boundedLimit = Math.min(Math.max(limit, 1), 25)
  const rows = await db
    .select({
      id: sql<string>`coalesce(${productOrder.customerOrderId}, ${productOrder.id})`,
      productOrderId: productOrder.id,
      productName: venueProduct.name,
      buyerName: sql<string>`coalesce(${customerOrder.buyerName}, ${productOrder.buyerName})`,
      quantity: productOrder.quantity,
      lineOrdinal: productOrder.lineOrdinal,
      payMethod: sql<string>`coalesce(${customerOrder.payMethod}, ${productOrder.payMethod})`,
      totalAmount: sql<string>`coalesce(${customerOrder.totalAmount}, ${productOrder.totalAmount})`,
      totalUnits: sql<string>`coalesce(${customerOrder.totalUnits}, ${productOrder.quantity})`,
      redeemedAt,
    })
    .from(orderRedemption)
    .innerJoin(productOrder, eq(orderRedemption.orderId, productOrder.id))
    .leftJoin(customerOrder, eq(productOrder.customerOrderId, customerOrder.id))
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .where(and(eq(productOrder.venueId, venueId), eq(orderRedemption.status, 'redeemed')))
    .groupBy(
      productOrder.customerOrderId,
      productOrder.id,
      venueProduct.name,
      customerOrder.buyerName,
      productOrder.buyerName,
      productOrder.quantity,
      productOrder.lineOrdinal,
      customerOrder.payMethod,
      productOrder.payMethod,
      customerOrder.totalAmount,
      productOrder.totalAmount,
      customerOrder.totalUnits
    )
    .orderBy(desc(redeemedAt))
    .limit(boundedLimit * 20)

  const orders = new Map<
    string,
    Omit<RecentVenueOrder, 'lines'> & {
      lines: Array<{ productName: string; quantity: number; lineOrdinal: number }>
    }
  >()
  for (const row of rows) {
    const existing = orders.get(row.id)
    if (existing) {
      existing.lines.push({
        productName: row.productName,
        quantity: Number(row.quantity),
        lineOrdinal: row.lineOrdinal ?? 1,
      })
      continue
    }
    orders.set(row.id, {
      id: row.id,
      lines: [
        {
          productName: row.productName,
          quantity: Number(row.quantity),
          lineOrdinal: row.lineOrdinal ?? 1,
        },
      ],
      buyerName: row.buyerName,
      totalUnits: Number(row.totalUnits),
      chargeAtBar: row.payMethod === 'bar' ? Number(row.totalAmount) : null,
      redeemedAt: new Date(row.redeemedAt).toISOString(),
    })
  }
  return [...orders.values()]
    .map((order) => ({
      ...order,
      lines: [...order.lines]
        .sort((left, right) => left.lineOrdinal - right.lineOrdinal)
        .map(({ lineOrdinal: _lineOrdinal, ...line }) => line),
    }))
    .sort((left, right) => right.redeemedAt.localeCompare(left.redeemedAt))
    .slice(0, boundedLimit)
}
