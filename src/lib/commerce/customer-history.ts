import 'server-only'

import { desc, eq, sql } from 'drizzle-orm'

import type { db } from '@/database'
import { commerceOrderSnapshot } from '@/database/commerce-schema'
import { orderRedemption, productOrder, venue, venueProduct } from '@/database/schema'
import { parseMinorUnits } from '@/lib/commerce/money'

type CommerceDatabase = typeof db

export type CustomerOrderFunding = 'real' | 'sandbox' | 'legacy_unverified'
export type CustomerOrderStatus = 'pending' | 'paid' | 'expired' | 'refunded' | 'cancelled'

export type CustomerOrder = Readonly<{
  id: string
  publicToken: string
  createdAt: Date
  productName: string
  venueSlug: string
  venueName: string
  quantity: number
  totalMinor: bigint
  promisedDonationMinor: bigint
  status: CustomerOrderStatus
  redeemedUnits: number
  fundingClassification: CustomerOrderFunding
}>

/**
 * Returns every order linked to the customer, including explicitly classified test and legacy
 * records. Public financial totals must only use `real`; the other rows remain visible so a test
 * purchase never appears to have vanished from the customer's history.
 */
export const listCustomerOrders = async (
  database: CommerceDatabase,
  userId: string
): Promise<CustomerOrder[]> => {
  const rows = await database
    .select({
      id: productOrder.id,
      publicToken: productOrder.publicToken,
      createdAt: productOrder.createdAt,
      productName: venueProduct.name,
      venueSlug: venue.slug,
      venueName: venue.name,
      quantity: productOrder.quantity,
      totalAmount: productOrder.totalAmount,
      unitDonationAmount: productOrder.unitDonationAmount,
      status: productOrder.status,
      fundingClassification: commerceOrderSnapshot.fundingClassification,
      redeemedUnits: sql<string>`(
        select count(*) from ${orderRedemption}
        where ${orderRedemption.orderId} = ${productOrder.id}
          and ${orderRedemption.status} = 'redeemed'
      )`,
    })
    .from(productOrder)
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .innerJoin(venue, eq(productOrder.venueId, venue.id))
    .leftJoin(commerceOrderSnapshot, eq(commerceOrderSnapshot.orderId, productOrder.id))
    .where(eq(productOrder.userId, userId))
    .orderBy(desc(productOrder.createdAt))

  return rows.map((row) => {
    const quantity = Number(row.quantity)

    return {
      id: row.id,
      publicToken: row.publicToken,
      createdAt: row.createdAt,
      productName: row.productName,
      venueSlug: row.venueSlug,
      venueName: row.venueName,
      quantity,
      totalMinor: parseMinorUnits(row.totalAmount),
      promisedDonationMinor: parseMinorUnits(row.unitDonationAmount) * BigInt(quantity),
      status: row.status as CustomerOrderStatus,
      redeemedUnits: Number(row.redeemedUnits),
      fundingClassification:
        row.fundingClassification === 'real' || row.fundingClassification === 'sandbox'
          ? row.fundingClassification
          : 'legacy_unverified',
    }
  })
}

export const summarizeNonRealOrders = (
  orders: readonly CustomerOrder[]
): { spentMinor: bigint; promisedDonationMinor: bigint; orderCount: number } =>
  orders
    .filter((order) => order.fundingClassification !== 'real' && order.status === 'paid')
    .reduce(
      (summary, order) => ({
        spentMinor: summary.spentMinor + order.totalMinor,
        promisedDonationMinor: summary.promisedDonationMinor + order.promisedDonationMinor,
        orderCount: summary.orderCount + 1,
      }),
      { spentMinor: BigInt(0), promisedDonationMinor: BigInt(0), orderCount: 0 }
    )
