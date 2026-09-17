import 'server-only'

import { and, eq, isNull, or, sql } from 'drizzle-orm'

import type { db } from '@/database'
import { commerceOrderSnapshot } from '@/database/commerce-schema'
import {
  customerOrder,
  orderRedemption,
  productOrder,
  venue,
  venueProduct,
} from '@/database/schema'
import { parseMinorUnits } from '@/lib/commerce/money'

type CommerceDatabase = typeof db

export type CustomerOrderFunding = 'real' | 'sandbox' | 'legacy_unverified'
export type CustomerOrderStatus = 'pending' | 'paid' | 'expired' | 'refunded' | 'cancelled'

export type CustomerOrderLine = Readonly<{
  productOrderId: string
  productName: string
  quantity: number
}>

export type CustomerOrder = Readonly<{
  id: string
  publicToken: string
  createdAt: Date
  lines: readonly CustomerOrderLine[]
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

type CustomerOrderRow = {
  parentId: string | null
  parentPublicToken: string | null
  parentCreatedAt: Date | null
  parentTotalUnits: number | null
  parentTotalAmount: string | null
  parentStatus: string | null
  lineId: string
  linePublicToken: string
  lineCreatedAt: Date
  productName: string
  venueSlug: string
  venueName: string
  lineQuantity: string
  lineTotalAmount: string
  unitDonationAmount: string
  lineStatus: string
  lineOrdinal: number | null
  fundingClassification: string | null
  redeemedUnits: string
}

const normalizeStatus = (value: string): CustomerOrderStatus => {
  if (
    value === 'pending' ||
    value === 'paid' ||
    value === 'expired' ||
    value === 'refunded' ||
    value === 'cancelled'
  ) {
    return value
  }
  return 'pending'
}

const classifyFunding = (classifications: readonly (string | null)[]): CustomerOrderFunding => {
  const known = new Set(classifications)
  if (known.size === 1 && known.has('real')) return 'real'
  if (known.size === 1 && known.has('sandbox')) return 'sandbox'
  return 'legacy_unverified'
}

/**
 * Returns one visible order per customer-order parent, including explicitly classified test and
 * legacy records. Public financial totals must only use `real`; the other rows remain visible so a
 * test purchase never appears to have vanished from the customer's history.
 */
export const listCustomerOrders = async (
  database: CommerceDatabase,
  userId: string
): Promise<CustomerOrder[]> => {
  const rows = await database
    .select({
      parentId: customerOrder.id,
      parentPublicToken: customerOrder.publicToken,
      parentCreatedAt: customerOrder.createdAt,
      parentTotalUnits: customerOrder.totalUnits,
      parentTotalAmount: customerOrder.totalAmount,
      parentStatus: customerOrder.status,
      lineId: productOrder.id,
      linePublicToken: productOrder.publicToken,
      lineCreatedAt: productOrder.createdAt,
      productName: venueProduct.name,
      venueSlug: venue.slug,
      venueName: venue.name,
      lineQuantity: productOrder.quantity,
      lineTotalAmount: productOrder.totalAmount,
      unitDonationAmount: productOrder.unitDonationAmount,
      lineStatus: productOrder.status,
      lineOrdinal: productOrder.lineOrdinal,
      fundingClassification: commerceOrderSnapshot.fundingClassification,
      redeemedUnits: sql<string>`(
        select count(*) from ${orderRedemption}
        where ${orderRedemption.orderId} = ${productOrder.id}
          and ${orderRedemption.status} = 'redeemed'
      )`,
    })
    .from(productOrder)
    .leftJoin(customerOrder, eq(customerOrder.id, productOrder.customerOrderId))
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .innerJoin(venue, eq(productOrder.venueId, venue.id))
    .leftJoin(commerceOrderSnapshot, eq(commerceOrderSnapshot.orderId, productOrder.id))
    .where(
      or(
        eq(customerOrder.userId, userId),
        and(isNull(customerOrder.id), eq(productOrder.userId, userId))
      )
    )

  const grouped = new Map<string, CustomerOrderRow[]>()
  for (const row of rows) {
    const key = row.parentId ?? `legacy:${row.lineId}`
    const group = grouped.get(key)
    if (group) group.push(row)
    else grouped.set(key, [row])
  }

  return [...grouped.values()]
    .sort((left, right) => {
      const leftDate = (left[0].parentCreatedAt ?? left[0].lineCreatedAt).getTime()
      const rightDate = (right[0].parentCreatedAt ?? right[0].lineCreatedAt).getTime()
      return rightDate - leftDate
    })
    .map((group) => {
      const first = group[0]
      const orderedRows = [...group].sort((left, right) => {
        const leftOrdinal = left.lineOrdinal ?? Number.MAX_SAFE_INTEGER
        const rightOrdinal = right.lineOrdinal ?? Number.MAX_SAFE_INTEGER
        return (
          leftOrdinal - rightOrdinal ||
          left.lineCreatedAt.getTime() - right.lineCreatedAt.getTime() ||
          left.lineId.localeCompare(right.lineId)
        )
      })
      const lines = orderedRows.map((row) => ({
        productOrderId: row.lineId,
        productName: row.productName,
        quantity: Number(row.lineQuantity),
      }))
      const quantity = first.parentId
        ? (first.parentTotalUnits ??
          orderedRows.reduce((total, row) => total + Number(row.lineQuantity), 0))
        : orderedRows.reduce((total, row) => total + Number(row.lineQuantity), 0)
      const promisedDonationMinor = orderedRows.reduce(
        (total, row) =>
          total + parseMinorUnits(row.unitDonationAmount) * BigInt(Number(row.lineQuantity)),
        BigInt(0)
      )

      return {
        id: first.parentId ?? first.lineId,
        publicToken: first.parentPublicToken ?? first.linePublicToken,
        createdAt: first.parentCreatedAt ?? first.lineCreatedAt,
        lines,
        productName: lines[0].productName,
        venueSlug: first.venueSlug,
        venueName: first.venueName,
        quantity,
        totalMinor: parseMinorUnits(first.parentTotalAmount ?? first.lineTotalAmount),
        promisedDonationMinor,
        status: normalizeStatus(first.parentStatus ?? first.lineStatus),
        redeemedUnits: orderedRows.reduce((total, row) => total + Number(row.redeemedUnits), 0),
        fundingClassification: classifyFunding(orderedRows.map((row) => row.fundingClassification)),
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
