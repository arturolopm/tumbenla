import 'server-only'

import { asc, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/database'
import {
  allocationRun,
  commerceOrderSnapshot,
  commerceOrderUnit,
  paymentAttempt,
} from '@/database/commerce-schema'
import {
  customerOrder,
  orderRedemption,
  productOrder,
  venue,
  venueProduct,
} from '@/database/schema'

type CommerceDatabase = typeof db

export type CustomerOrderLine = Readonly<{
  productOrderId: string
  productName: string
  productKind: string
  productDescription: string | null
  quantity: number
  unitPrice: number
  donationPercentage: number
  unitDonationAmount: number
  unitVenueAmount: number
  lineTotal: number
}>

export type CustomerOrderUnitView = Readonly<{
  id: string
  redemptionId: string | null
  redemptionCode: string | null
  status: string
  expiresAt: Date | null
  redeemedAt: Date | null
}>

export type CustomerOrderView = Readonly<{
  publicToken: string
  buyerName: string
  buyerEmail: string
  lines: readonly CustomerOrderLine[]
  totalUnits: number
  totalAmount: number
  donationAmount: number
  venueAmount: number
  payMethod: 'app' | 'bar'
  status: string
  createdAt: Date
  expiresAt: Date | null
  venueId: string
  venueSlug: string
  venueName: string
  units: readonly CustomerOrderUnitView[]
  allocationFinal: boolean
  allocationExplanation: string | null
}>

export type CustomerOrderStatusView = Readonly<{
  status: string
  paymentStatus: string
  deliveredUnits: number
  totalUnits: number
  expiresAt: Date | null
  refundStatus: 'none' | 'reserved' | 'refunded'
  allocationStatus: 'pending' | 'final'
  units: readonly Omit<CustomerOrderUnitView, 'redemptionCode'>[]
}>

type OrderIdentity = Readonly<{
  customerOrderId: string | null
  legacyOrderId: string | null
  publicToken: string
  buyerName: string
  buyerEmail: string
  totalUnits: number
  totalAmount: number
  payMethod: 'app' | 'bar'
  status: string
  createdAt: Date
  expiresAt: Date | null
  venueId: string
  venueSlug: string
  venueName: string
}>

const resolveOrderIdentity = async (
  database: CommerceDatabase,
  token: string
): Promise<OrderIdentity | null> => {
  const [parent] = await database
    .select({
      id: customerOrder.id,
      publicToken: customerOrder.publicToken,
      buyerName: customerOrder.buyerName,
      buyerEmail: customerOrder.buyerEmail,
      totalUnits: customerOrder.totalUnits,
      totalAmount: customerOrder.totalAmount,
      payMethod: customerOrder.payMethod,
      status: customerOrder.status,
      createdAt: customerOrder.createdAt,
      expiresAt: customerOrder.expiresAt,
      venueId: customerOrder.venueId,
      venueSlug: venue.slug,
      venueName: venue.name,
    })
    .from(customerOrder)
    .innerJoin(venue, eq(customerOrder.venueId, venue.id))
    .where(eq(customerOrder.publicToken, token))
    .limit(1)

  if (parent) {
    return {
      customerOrderId: parent.id,
      legacyOrderId: null,
      publicToken: parent.publicToken,
      buyerName: parent.buyerName,
      buyerEmail: parent.buyerEmail,
      totalUnits: parent.totalUnits,
      totalAmount: Number(parent.totalAmount),
      payMethod: parent.payMethod as 'app' | 'bar',
      status: parent.status,
      createdAt: parent.createdAt,
      expiresAt: parent.expiresAt,
      venueId: parent.venueId,
      venueSlug: parent.venueSlug,
      venueName: parent.venueName,
    }
  }

  // Rolling compatibility for a line written before the parent migration, and
  // for old bearer links that still carry a line token.
  const [legacy] = await database
    .select({
      id: productOrder.id,
      publicToken: productOrder.publicToken,
      buyerName: productOrder.buyerName,
      buyerEmail: productOrder.buyerEmail,
      quantity: productOrder.quantity,
      totalAmount: productOrder.totalAmount,
      payMethod: productOrder.payMethod,
      status: productOrder.status,
      createdAt: productOrder.createdAt,
      expiresAt: productOrder.expiresAt,
      venueId: productOrder.venueId,
      venueSlug: venue.slug,
      venueName: venue.name,
    })
    .from(productOrder)
    .innerJoin(venue, eq(productOrder.venueId, venue.id))
    .where(eq(productOrder.publicToken, token))
    .limit(1)

  if (!legacy) return null
  return {
    customerOrderId: null,
    legacyOrderId: legacy.id,
    publicToken: legacy.publicToken,
    buyerName: legacy.buyerName,
    buyerEmail: legacy.buyerEmail,
    totalUnits: Number(legacy.quantity),
    totalAmount: Number(legacy.totalAmount),
    payMethod: legacy.payMethod as 'app' | 'bar',
    status: legacy.status,
    createdAt: legacy.createdAt,
    expiresAt: legacy.expiresAt,
    venueId: legacy.venueId,
    venueSlug: legacy.venueSlug,
    venueName: legacy.venueName,
  }
}

const loadLines = async (
  database: CommerceDatabase,
  identity: OrderIdentity
): Promise<
  readonly (CustomerOrderLine &
    Readonly<{ snapshotId: string | null; allocationExplanation: string | null }>)[]
> => {
  const rows = await database
    .select({
      productOrderId: productOrder.id,
      productName: venueProduct.name,
      productKind: venueProduct.kind,
      productDescription: venueProduct.description,
      quantity: productOrder.quantity,
      unitPrice: productOrder.unitPrice,
      donationPercentage: productOrder.donationPercentage,
      unitDonationAmount: productOrder.unitDonationAmount,
      unitVenueAmount: productOrder.unitVenueAmount,
      lineTotal: productOrder.totalAmount,
      snapshotId: commerceOrderSnapshot.id,
      allocationExplanation: commerceOrderSnapshot.policyDisclosure,
    })
    .from(productOrder)
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .leftJoin(commerceOrderSnapshot, eq(commerceOrderSnapshot.orderId, productOrder.id))
    .where(
      identity.customerOrderId
        ? eq(productOrder.customerOrderId, identity.customerOrderId)
        : eq(productOrder.id, identity.legacyOrderId ?? '')
    )
    .orderBy(asc(productOrder.lineOrdinal), asc(productOrder.createdAt))

  return rows.map((row) => ({
    productOrderId: row.productOrderId,
    productName: row.productName,
    productKind: row.productKind,
    productDescription: row.productDescription,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unitPrice),
    donationPercentage: Number(row.donationPercentage),
    unitDonationAmount: Number(row.unitDonationAmount),
    unitVenueAmount: Number(row.unitVenueAmount),
    lineTotal: Number(row.lineTotal),
    snapshotId: row.snapshotId,
    allocationExplanation: row.allocationExplanation,
  }))
}

const loadUnits = async (
  database: CommerceDatabase,
  identity: OrderIdentity,
  lineIds: readonly string[]
): Promise<CustomerOrderUnitView[]> => {
  const rows = await database
    .select({
      id: commerceOrderUnit.id,
      redemptionId: commerceOrderUnit.redemptionId,
      redemptionCode: orderRedemption.code,
      status: commerceOrderUnit.lifecycleStatus,
      expiresAt: commerceOrderUnit.expiresAt,
      redeemedAt: commerceOrderUnit.redeemedAt,
    })
    .from(commerceOrderUnit)
    .innerJoin(
      commerceOrderSnapshot,
      eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
    )
    .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
    .leftJoin(orderRedemption, eq(commerceOrderUnit.redemptionId, orderRedemption.id))
    .where(
      identity.customerOrderId
        ? eq(productOrder.customerOrderId, identity.customerOrderId)
        : eq(productOrder.id, identity.legacyOrderId ?? '')
    )
    .orderBy(asc(productOrder.lineOrdinal), asc(commerceOrderUnit.ordinal))

  if (rows.length > 0) return rows
  if (lineIds.length === 0) return []

  // Pre-lifecycle compatibility: these orders have redemptions but no unit
  // table rows. Their redemption ID remains a stable UI unit key.
  const legacyRows = await database
    .select({
      id: orderRedemption.id,
      code: orderRedemption.code,
      status: orderRedemption.status,
      redeemedAt: orderRedemption.redeemedAt,
    })
    .from(orderRedemption)
    .where(inArray(orderRedemption.orderId, [...lineIds]))
    .orderBy(asc(orderRedemption.createdAt))

  return legacyRows.map((row) => ({
    id: row.id,
    redemptionId: row.id,
    redemptionCode: row.code,
    status: row.status,
    expiresAt: identity.expiresAt,
    redeemedAt: row.redeemedAt,
  }))
}

const loadAllocationStatus = async (
  database: CommerceDatabase,
  identity: OrderIdentity,
  snapshotId: string | null
): Promise<'pending' | 'final'> => {
  const [allocation] = await database
    .select({ status: allocationRun.status })
    .from(allocationRun)
    .where(
      identity.customerOrderId
        ? eq(allocationRun.customerOrderId, identity.customerOrderId)
        : eq(allocationRun.orderSnapshotId, snapshotId ?? '')
    )
    .orderBy(desc(allocationRun.revision))
    .limit(1)
  return allocation?.status === 'final' ? 'final' : 'pending'
}

export const loadCustomerOrderByToken = async (
  database: CommerceDatabase,
  token: string
): Promise<CustomerOrderView | null> => {
  const identity = await resolveOrderIdentity(database, token)
  if (!identity) return null
  const lines = await loadLines(database, identity)
  if (lines.length === 0) return null
  const units = await loadUnits(
    database,
    identity,
    lines.map((line) => line.productOrderId)
  )
  const allocationStatus = await loadAllocationStatus(
    database,
    identity,
    lines[0]?.snapshotId ?? null
  )

  return {
    publicToken: identity.publicToken,
    buyerName: identity.buyerName,
    buyerEmail: identity.buyerEmail,
    lines: lines.map(
      ({ snapshotId: _snapshotId, allocationExplanation: _explanation, ...line }) => line
    ),
    totalUnits: identity.totalUnits,
    totalAmount: identity.totalAmount,
    donationAmount: lines.reduce(
      (total, line) => total + line.unitDonationAmount * line.quantity,
      0
    ),
    venueAmount: lines.reduce((total, line) => total + line.unitVenueAmount * line.quantity, 0),
    payMethod: identity.payMethod,
    status: identity.status,
    createdAt: identity.createdAt,
    expiresAt: identity.expiresAt,
    venueId: identity.venueId,
    venueSlug: identity.venueSlug,
    venueName: identity.venueName,
    units,
    allocationFinal: allocationStatus === 'final',
    allocationExplanation: lines[0]?.allocationExplanation ?? null,
  }
}

export const getCustomerOrderByToken = async (token: string): Promise<CustomerOrderView | null> =>
  loadCustomerOrderByToken(db, token)

export const loadCustomerOrderStatusByToken = async (
  database: CommerceDatabase,
  token: string
): Promise<CustomerOrderStatusView | null> => {
  const identity = await resolveOrderIdentity(database, token)
  if (!identity) return null
  const lines = await loadLines(database, identity)
  if (lines.length === 0) return null
  const units = await loadUnits(
    database,
    identity,
    lines.map((line) => line.productOrderId)
  )
  const [payment] = await database
    .select({ status: paymentAttempt.status })
    .from(paymentAttempt)
    .where(
      identity.customerOrderId
        ? eq(paymentAttempt.customerOrderId, identity.customerOrderId)
        : eq(paymentAttempt.orderSnapshotId, lines[0]?.snapshotId ?? '')
    )
    .orderBy(desc(paymentAttempt.createdAt))
    .limit(1)
  const allocationStatus = await loadAllocationStatus(
    database,
    identity,
    lines[0]?.snapshotId ?? null
  )
  const refunded = units.some((unit) => unit.status === 'refunded')
  const refundReserved = units.some((unit) => unit.status === 'refund_reserved')

  return {
    status: identity.status,
    paymentStatus:
      payment?.status ??
      (identity.payMethod === 'bar' ? 'cash' : identity.status === 'paid' ? 'paid' : 'legacy'),
    deliveredUnits: units.filter((unit) => unit.status === 'redeemed').length,
    totalUnits: identity.totalUnits,
    expiresAt: identity.expiresAt,
    refundStatus: refunded ? 'refunded' : refundReserved ? 'reserved' : 'none',
    allocationStatus,
    units: units.map(({ redemptionCode: _code, ...unit }) => unit),
  }
}

export const getCustomerOrderStatusByToken = async (
  token: string
): Promise<CustomerOrderStatusView | null> => loadCustomerOrderStatusByToken(db, token)
