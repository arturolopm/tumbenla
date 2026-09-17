import 'server-only'

import { createHash } from 'node:crypto'
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationRun,
  commerceOrderSnapshot,
  commerceOrderUnit,
  creditDebt,
  creditReservation,
  financeAuditEvent,
  unitAllocation,
  unitLifecycleOperation,
  venueCreditPolicy,
} from '@/database/commerce-schema'
import {
  customerOrder,
  orderRedemption,
  productOrder,
  venue,
  venueMember,
  venueProduct,
} from '@/database/schema'
import { createId } from '@/lib/utils/id'
import { postUnitDistribution } from './allocation-service'
import {
  ensureFinanceAccount,
  type FinanceTransactionConnection,
  postFinanceTransaction,
} from './finance-ledger'
import type { MinorUnits } from './money'

type CommerceDatabase = typeof db
type FundingClassification = 'real' | 'sandbox'

export type UnitRedemptionFailure =
  | 'not_found'
  | 'unauthorized'
  | 'wrong_venue'
  | 'unpaid'
  | 'expired'
  | 'void'
  | 'refund_reserved'
  | 'already_redeemed'
  | 'operator_review'

export type UnitRedemptionResult =
  | Readonly<{
      kind: 'redeemed'
      duplicate: boolean
      productName: string
      lines: readonly {
        productOrderId: string
        productName: string
        productKind: string
        quantity: number
      }[]
      buyerName: string
      orderId: string
      venueSlug: string
      quantity: number
      fulfilledCount: number
      redeemedCount: number
      collectMinor: bigint | null
    }>
  | Readonly<{ kind: 'rejected'; reason: UnitRedemptionFailure }>

export type ExpireUnitsResult = Readonly<{
  reviewed: number
  expired: number
  retainedMinor: bigint
  errors: readonly string[]
}>

type RedemptionContext = Readonly<{
  unitId: string
  unitGrossMinor: bigint
  unitStatus: string
  unitExpiresAt: Date | null
  redemptionId: string
  redemptionStatus: string
  customerOrderId: string | null
  customerOrderStatus: string | null
  customerOrderTotalUnits: number | null
  orderId: string
  orderStatus: string
  payMethod: string
  venueId: string
  venueSlug: string
  venueStatus: string
  productName: string
  productKind: string
  lineOrdinal: number | null
  buyerName: string
  quantity: string
  snapshotId: string
  fundingClassification: string
  foundationBeneficiaryId: string | null
}>

type CashReservationContext = Readonly<{
  id: string
  status: string
  amountMinor: bigint
  expiresAt: Date
  policyStatus: string
  repaymentTermSeconds: number
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const classification = (value: string): FundingClassification | undefined =>
  value === 'real' || value === 'sandbox' ? value : undefined

const validOperationKey = (value: string): boolean => /^[A-Za-z0-9:_-]{8,180}$/.test(value)

const rejectionForState = (context: RedemptionContext): UnitRedemptionFailure => {
  if (context.unitStatus === 'redeemed') return 'already_redeemed'
  if (context.unitStatus === 'refund_reserved' || context.unitStatus === 'refunded') {
    return 'refund_reserved'
  }
  if (context.unitStatus === 'expired') return 'expired'
  if (context.unitStatus === 'void' || context.redemptionStatus === 'void') return 'void'
  return 'operator_review'
}

export class CommerceUnitService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async redeem(input: {
    code: string
    expectedVenueId: string
    actorUserId: string
    actorIsPlatform: boolean
    operationKey: string
  }): Promise<UnitRedemptionResult> {
    if (!validOperationKey(input.operationKey)) {
      return { kind: 'rejected', reason: 'operator_review' }
    }

    return this.#database.transaction(async (transaction) => {
      const found = await this.#loadRedemption(transaction, input.code)
      if (!found) return { kind: 'rejected', reason: 'not_found' } as const

      if (found.venueId !== input.expectedVenueId) {
        return { kind: 'rejected', reason: 'wrong_venue' } as const
      }
      if (!input.actorIsPlatform) {
        const [membership] = await transaction
          .select({ id: venueMember.id })
          .from(venueMember)
          .where(
            and(eq(venueMember.venueId, found.venueId), eq(venueMember.userId, input.actorUserId))
          )
          .limit(1)
        if (!membership) return { kind: 'rejected', reason: 'unauthorized' } as const
      }

      // One scan owns the parent before any line or unit. Stable line/unit order
      // prevents two still-open QR screens from deadlocking on different codes.
      if (found.customerOrderId) {
        await this.#lockCustomerOrder(transaction, found.customerOrderId)
      } else {
        await this.#lockOrder(transaction, found.orderId)
      }
      const orderUnits = await this.#loadOrderRedemptions(
        transaction,
        found.customerOrderId,
        found.snapshotId
      )
      const context = orderUnits.find((unit) => unit.redemptionId === found.redemptionId)
      if (!context) return { kind: 'rejected', reason: 'operator_review' } as const
      const expectedUnitCount = context.customerOrderTotalUnits ?? Number(context.quantity)
      if (orderUnits.length !== expectedUnitCount) {
        return { kind: 'rejected', reason: 'operator_review' } as const
      }
      if (
        orderUnits.some(
          (unit) =>
            unit.customerOrderId !== context.customerOrderId ||
            unit.venueId !== context.venueId ||
            unit.payMethod !== context.payMethod ||
            unit.fundingClassification !== context.fundingClassification
        )
      ) {
        return { kind: 'rejected', reason: 'operator_review' } as const
      }

      const operationHash = digest({
        kind: 'redeem_order',
        orderId: context.customerOrderId ?? context.orderId,
        expectedVenueId: input.expectedVenueId,
        actorUserId: input.actorUserId,
        actorIsPlatform: input.actorIsPlatform,
      })
      const existing = await this.#findLifecycleOperation(transaction, input.operationKey)
      if (existing) {
        if (
          existing.contentHash !== operationHash ||
          existing.unitId !== context.unitId ||
          existing.kind !== 'redeem'
        ) {
          return { kind: 'rejected', reason: 'operator_review' } as const
        }
        return this.#successResult(
          transaction,
          context,
          true,
          this.#collectMinorFromOperation(existing, context),
          this.#fulfilledCountFromOperation(existing)
        )
      }
      if (
        !classification(context.fundingClassification) ||
        (context.payMethod !== 'app' && context.payMethod !== 'bar')
      ) {
        return { kind: 'rejected', reason: 'operator_review' } as const
      }
      const orderStatus = context.customerOrderStatus ?? context.orderStatus
      if (
        (context.payMethod === 'app' && orderStatus !== 'paid') ||
        (context.payMethod === 'bar' && orderStatus !== 'pending' && orderStatus !== 'paid')
      ) {
        return { kind: 'rejected', reason: 'unpaid' } as const
      }

      const now = this.#now()
      const issuedUnits = orderUnits.filter(
        (unit) => unit.unitStatus === 'issued' && unit.redemptionStatus === 'issued'
      )
      if (issuedUnits.some((unit) => unit.unitExpiresAt && unit.unitExpiresAt <= now)) {
        for (const unit of issuedUnits) {
          if (unit.payMethod === 'bar') {
            await this.#expireCashUnit(transaction, unit, now, 'scan')
          } else {
            await this.#expireLockedUnit(transaction, unit, now, 'scan')
          }
        }
        return { kind: 'rejected', reason: 'expired' } as const
      }
      if (context.unitStatus !== 'issued' || context.redemptionStatus !== 'issued') {
        return { kind: 'rejected', reason: rejectionForState(context) } as const
      }
      const incompatible = orderUnits.find(
        (unit) =>
          !(
            (unit.unitStatus === 'issued' && unit.redemptionStatus === 'issued') ||
            (unit.unitStatus === 'redeemed' && unit.redemptionStatus === 'redeemed')
          )
      )
      if (incompatible) {
        return { kind: 'rejected', reason: rejectionForState(incompatible) } as const
      }
      if (issuedUnits.length === 0) {
        return { kind: 'rejected', reason: 'already_redeemed' } as const
      }

      const cashReservations = new Map<string, CashReservationContext>()
      if (context.payMethod === 'bar') {
        for (const unit of issuedUnits) {
          const reservation = await this.#loadCashReservation(transaction, unit.unitId)
          if (!reservation || reservation.status !== 'active') {
            return { kind: 'rejected', reason: 'operator_review' } as const
          }
          if (reservation.expiresAt <= now) {
            for (const expirable of issuedUnits) {
              await this.#expireCashUnit(transaction, expirable, now, 'scan')
            }
            return { kind: 'rejected', reason: 'expired' } as const
          }
          cashReservations.set(unit.unitId, reservation)
        }
      }
      if (
        context.payMethod === 'bar' &&
        (context.venueStatus !== 'published' ||
          [...cashReservations.values()].some(
            (reservation) => reservation.policyStatus !== 'active'
          ))
      ) {
        return { kind: 'rejected', reason: 'operator_review' } as const
      }

      const collectMinor =
        context.payMethod === 'bar'
          ? issuedUnits.reduce((sum, unit) => sum + unit.unitGrossMinor, BigInt(0))
          : null

      const claimed = await transaction
        .insert(unitLifecycleOperation)
        .values({
          id: createId('ulo'),
          operationKey: input.operationKey,
          contentHash: operationHash,
          unitId: context.unitId,
          kind: 'redeem',
          status: 'completed',
          actorUserId: input.actorUserId,
          detail: {
            venueId: context.venueId,
            orderId: context.customerOrderId ?? context.orderId,
            unitCount: issuedUnits.length,
            collectMinor: collectMinor?.toString() ?? null,
          },
          createdAt: now,
        })
        .onConflictDoNothing({ target: unitLifecycleOperation.operationKey })
        .returning({ id: unitLifecycleOperation.id })

      if (claimed.length === 0) {
        const raced = await this.#findLifecycleOperation(transaction, input.operationKey)
        if (
          !raced ||
          raced.contentHash !== operationHash ||
          raced.unitId !== context.unitId ||
          raced.kind !== 'redeem'
        ) {
          return { kind: 'rejected', reason: 'operator_review' } as const
        }
        return this.#successResult(
          transaction,
          context,
          true,
          this.#collectMinorFromOperation(raced, context),
          this.#fulfilledCountFromOperation(raced)
        )
      }

      for (const unit of issuedUnits) {
        const unitOperationKey =
          unit.unitId === context.unitId
            ? input.operationKey
            : `redeem-unit:${digest(`${input.operationKey}:${unit.unitId}`).slice(0, 48)}`
        if (unit.unitId !== context.unitId) {
          const inserted = await transaction
            .insert(unitLifecycleOperation)
            .values({
              id: createId('ulo'),
              operationKey: unitOperationKey,
              contentHash: digest({
                kind: 'redeem_order_unit',
                orderId: context.customerOrderId ?? context.orderId,
                unitId: unit.unitId,
                parentOperationKey: input.operationKey,
              }),
              unitId: unit.unitId,
              kind: 'redeem',
              status: 'completed',
              actorUserId: input.actorUserId,
              detail: {
                venueId: context.venueId,
                orderId: context.customerOrderId ?? context.orderId,
                parentOperationKey: input.operationKey,
              },
              createdAt: now,
            })
            .onConflictDoNothing({ target: unitLifecycleOperation.operationKey })
            .returning({ id: unitLifecycleOperation.id })
          if (inserted.length === 0) throw new Error('The order-unit operation already exists')
        }

        const [updatedRedemption] = await transaction
          .update(orderRedemption)
          .set({
            status: 'redeemed',
            redeemedAt: now,
            redeemedByUserId: input.actorUserId,
            updatedAt: now,
          })
          .where(
            and(eq(orderRedemption.id, unit.redemptionId), eq(orderRedemption.status, 'issued'))
          )
          .returning({ id: orderRedemption.id })
        const [updatedUnit] = await transaction
          .update(commerceOrderUnit)
          .set({ lifecycleStatus: 'redeemed', redeemedAt: now, updatedAt: now })
          .where(
            and(
              eq(commerceOrderUnit.id, unit.unitId),
              eq(commerceOrderUnit.lifecycleStatus, 'issued')
            )
          )
          .returning({ id: commerceOrderUnit.id })
        if (!updatedRedemption || !updatedUnit) {
          throw new Error('The order unit and compatibility redemption diverged')
        }

        if (unit.payMethod === 'bar') {
          const reservation = cashReservations.get(unit.unitId)
          if (!reservation) throw new Error('The cash reservation disappeared')
          await this.#consumeCashReservation(transaction, unit, reservation, input.actorUserId, now)
        } else {
          await this.#postDistributionIfFinal(transaction, unit, input.actorUserId, now)
        }
        await transaction.insert(financeAuditEvent).values({
          id: createId('fae'),
          entityType: 'commerce_order_unit',
          entityId: unit.unitId,
          action: 'redeemed',
          actorUserId: input.actorUserId,
          operationKey: unitOperationKey,
          previousState: 'issued',
          nextState: 'redeemed',
          detail: { orderId: unit.orderId, venueId: unit.venueId },
          createdAt: now,
        })
      }

      return this.#successResult(transaction, context, false, collectMinor, issuedUnits.length)
    })
  }

  async expireDueUnits(input: { now?: Date; limit?: number } = {}): Promise<ExpireUnitsResult> {
    const now = input.now ?? this.#now()
    const limit = Math.min(Math.max(input.limit ?? 250, 1), 1_000)
    const candidates = await this.#database
      .select({
        id: commerceOrderUnit.id,
        orderId: productOrder.id,
        customerOrderId: productOrder.customerOrderId,
      })
      .from(commerceOrderUnit)
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .where(
        and(
          eq(commerceOrderUnit.lifecycleStatus, 'issued'),
          lte(commerceOrderUnit.expiresAt, now),
          inArray(commerceOrderSnapshot.fundingClassification, ['real', 'sandbox'])
        )
      )
      .limit(limit)

    let expired = 0
    let retainedMinor = BigInt(0)
    const errors: string[] = []
    for (const candidate of candidates) {
      try {
        const result = await this.#database.transaction(async (transaction) => {
          if (candidate.customerOrderId) {
            await this.#lockCustomerOrder(transaction, candidate.customerOrderId)
          } else {
            await this.#lockOrder(transaction, candidate.orderId)
          }
          const context = await this.#loadUnitForExpiry(transaction, candidate.id)
          if (
            !context ||
            context.unitStatus !== 'issued' ||
            !context.unitExpiresAt ||
            context.unitExpiresAt > now
          ) {
            return { expired: false, retainedMinor: BigInt(0) }
          }
          if (context.payMethod === 'bar') {
            await this.#expireCashUnit(transaction, context, now, 'job')
            return { expired: true, retainedMinor: BigInt(0) }
          }
          await this.#expireLockedUnit(transaction, context, now, 'job')
          return { expired: true, retainedMinor: context.grossMinor }
        })
        if (result.expired) {
          expired += 1
          retainedMinor += result.retainedMinor
        }
      } catch (error) {
        errors.push(`${candidate.id}: ${error instanceof Error ? error.message : 'failed'}`)
      }
    }

    return { reviewed: candidates.length, expired, retainedMinor, errors }
  }

  async #loadRedemption(
    transaction: FinanceTransactionConnection,
    code: string
  ): Promise<RedemptionContext | undefined> {
    const [row] = await transaction
      .select({
        unitId: commerceOrderUnit.id,
        unitGrossMinor: commerceOrderUnit.grossMinor,
        unitStatus: commerceOrderUnit.lifecycleStatus,
        unitExpiresAt: commerceOrderUnit.expiresAt,
        redemptionId: orderRedemption.id,
        redemptionStatus: orderRedemption.status,
        customerOrderId: productOrder.customerOrderId,
        customerOrderStatus: customerOrder.status,
        customerOrderTotalUnits: customerOrder.totalUnits,
        orderId: productOrder.id,
        orderStatus: productOrder.status,
        payMethod: productOrder.payMethod,
        venueId: productOrder.venueId,
        venueSlug: venue.slug,
        venueStatus: venue.status,
        productName: venueProduct.name,
        productKind: venueProduct.kind,
        lineOrdinal: productOrder.lineOrdinal,
        buyerName: sql<string>`coalesce(${customerOrder.buyerName}, ${productOrder.buyerName})`,
        quantity: productOrder.quantity,
        snapshotId: commerceOrderSnapshot.id,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        foundationBeneficiaryId: commerceOrderSnapshot.foundationBeneficiaryId,
      })
      .from(orderRedemption)
      .innerJoin(commerceOrderUnit, eq(commerceOrderUnit.redemptionId, orderRedemption.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .leftJoin(customerOrder, eq(productOrder.customerOrderId, customerOrder.id))
      .innerJoin(venue, eq(productOrder.venueId, venue.id))
      .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
      .where(eq(orderRedemption.code, code))
      .limit(1)
    return row
  }

  async #lockOrder(transaction: FinanceTransactionConnection, orderId: string): Promise<void> {
    const [locked] = await transaction
      .select({ id: productOrder.id })
      .from(productOrder)
      .where(eq(productOrder.id, orderId))
      .limit(1)
      .for('update')
    if (!locked) throw new Error('The redemption order disappeared')
  }

  async #lockCustomerOrder(
    transaction: FinanceTransactionConnection,
    customerOrderId: string
  ): Promise<void> {
    const [locked] = await transaction
      .select({ id: customerOrder.id })
      .from(customerOrder)
      .where(eq(customerOrder.id, customerOrderId))
      .limit(1)
      .for('update')
    if (!locked) throw new Error('The customer order disappeared during redemption')
  }

  async #loadOrderRedemptions(
    transaction: FinanceTransactionConnection,
    customerOrderId: string | null,
    snapshotId: string
  ): Promise<RedemptionContext[]> {
    return transaction
      .select({
        unitId: commerceOrderUnit.id,
        unitGrossMinor: commerceOrderUnit.grossMinor,
        unitStatus: commerceOrderUnit.lifecycleStatus,
        unitExpiresAt: commerceOrderUnit.expiresAt,
        redemptionId: orderRedemption.id,
        redemptionStatus: orderRedemption.status,
        customerOrderId: productOrder.customerOrderId,
        customerOrderStatus: customerOrder.status,
        customerOrderTotalUnits: customerOrder.totalUnits,
        orderId: productOrder.id,
        orderStatus: productOrder.status,
        payMethod: productOrder.payMethod,
        venueId: productOrder.venueId,
        venueSlug: venue.slug,
        venueStatus: venue.status,
        productName: venueProduct.name,
        productKind: venueProduct.kind,
        lineOrdinal: productOrder.lineOrdinal,
        buyerName: sql<string>`coalesce(${customerOrder.buyerName}, ${productOrder.buyerName})`,
        quantity: productOrder.quantity,
        snapshotId: commerceOrderSnapshot.id,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        foundationBeneficiaryId: commerceOrderSnapshot.foundationBeneficiaryId,
      })
      .from(commerceOrderUnit)
      .innerJoin(orderRedemption, eq(commerceOrderUnit.redemptionId, orderRedemption.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .leftJoin(customerOrder, eq(productOrder.customerOrderId, customerOrder.id))
      .innerJoin(venue, eq(productOrder.venueId, venue.id))
      .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
      .where(
        customerOrderId
          ? eq(productOrder.customerOrderId, customerOrderId)
          : eq(commerceOrderUnit.orderSnapshotId, snapshotId)
      )
      .orderBy(asc(productOrder.lineOrdinal), asc(commerceOrderUnit.ordinal))
      .for('update', { of: commerceOrderUnit })
  }

  async #loadUnitForExpiry(
    transaction: FinanceTransactionConnection,
    unitId: string
  ): Promise<(RedemptionContext & Readonly<{ grossMinor: bigint }>) | undefined> {
    const [row] = await transaction
      .select({
        unitId: commerceOrderUnit.id,
        unitGrossMinor: commerceOrderUnit.grossMinor,
        unitStatus: commerceOrderUnit.lifecycleStatus,
        unitExpiresAt: commerceOrderUnit.expiresAt,
        grossMinor: commerceOrderUnit.grossMinor,
        redemptionId: orderRedemption.id,
        redemptionStatus: orderRedemption.status,
        customerOrderId: productOrder.customerOrderId,
        customerOrderStatus: customerOrder.status,
        customerOrderTotalUnits: customerOrder.totalUnits,
        orderId: productOrder.id,
        orderStatus: productOrder.status,
        payMethod: productOrder.payMethod,
        venueId: productOrder.venueId,
        venueSlug: venue.slug,
        venueStatus: venue.status,
        productName: venueProduct.name,
        productKind: venueProduct.kind,
        lineOrdinal: productOrder.lineOrdinal,
        buyerName: sql<string>`coalesce(${customerOrder.buyerName}, ${productOrder.buyerName})`,
        quantity: productOrder.quantity,
        snapshotId: commerceOrderSnapshot.id,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        foundationBeneficiaryId: commerceOrderSnapshot.foundationBeneficiaryId,
      })
      .from(commerceOrderUnit)
      .innerJoin(orderRedemption, eq(commerceOrderUnit.redemptionId, orderRedemption.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .leftJoin(customerOrder, eq(productOrder.customerOrderId, customerOrder.id))
      .innerJoin(venue, eq(productOrder.venueId, venue.id))
      .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
      .where(eq(commerceOrderUnit.id, unitId))
      .limit(1)
      .for('update', { of: commerceOrderUnit })
    return row
  }

  async #findLifecycleOperation(
    transaction: FinanceTransactionConnection,
    operationKey: string
  ): Promise<
    | {
        contentHash: string
        unitId: string
        kind: string
        detail: Record<string, string | number | boolean | null>
      }
    | undefined
  > {
    const [row] = await transaction
      .select({
        contentHash: unitLifecycleOperation.contentHash,
        unitId: unitLifecycleOperation.unitId,
        kind: unitLifecycleOperation.kind,
        detail: unitLifecycleOperation.detail,
      })
      .from(unitLifecycleOperation)
      .where(eq(unitLifecycleOperation.operationKey, operationKey))
      .limit(1)
    return row
  }

  async #successResult(
    transaction: FinanceTransactionConnection,
    context: RedemptionContext,
    duplicate: boolean,
    collectMinor: bigint | null,
    fulfilledCount: number
  ): Promise<Extract<UnitRedemptionResult, { kind: 'redeemed' }>> {
    const units = await this.#loadOrderRedemptions(
      transaction,
      context.customerOrderId,
      context.snapshotId
    )
    const lines = new Map<
      string,
      { productOrderId: string; productName: string; productKind: string; quantity: number }
    >()
    for (const unit of units) {
      const current = lines.get(unit.orderId)
      if (current) {
        current.quantity += 1
      } else {
        lines.set(unit.orderId, {
          productOrderId: unit.orderId,
          productName: unit.productName,
          productKind: unit.productKind,
          quantity: 1,
        })
      }
    }
    const orderedLines = [...lines.values()]
    return {
      kind: 'redeemed',
      duplicate,
      productName:
        orderedLines.length === 1 ? context.productName : `${orderedLines.length} productos`,
      lines: orderedLines,
      buyerName: context.buyerName,
      orderId: context.customerOrderId ?? context.orderId,
      venueSlug: context.venueSlug,
      quantity: units.length,
      fulfilledCount,
      redeemedCount: units.filter((unit) => unit.unitStatus === 'redeemed').length,
      collectMinor,
    }
  }

  #collectMinorFromOperation(
    operation: { detail: Record<string, string | number | boolean | null> },
    context: RedemptionContext
  ): bigint | null {
    if (context.payMethod !== 'bar') return null
    const value = operation.detail.collectMinor
    return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : context.unitGrossMinor
  }

  #fulfilledCountFromOperation(operation: {
    detail: Record<string, string | number | boolean | null>
  }): number {
    const value = operation.detail.unitCount
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1
  }

  async #loadCashReservation(
    transaction: FinanceTransactionConnection,
    unitId: string
  ): Promise<CashReservationContext | undefined> {
    const [row] = await transaction
      .select({
        id: creditReservation.id,
        status: creditReservation.status,
        amountMinor: creditReservation.amountMinor,
        expiresAt: creditReservation.expiresAt,
        policyStatus: venueCreditPolicy.status,
        repaymentTermSeconds: venueCreditPolicy.repaymentTermSeconds,
      })
      .from(creditReservation)
      .innerJoin(venueCreditPolicy, eq(creditReservation.policyId, venueCreditPolicy.id))
      .where(eq(creditReservation.unitId, unitId))
      .limit(1)
      .for('update')
    return row
  }

  async #consumeCashReservation(
    transaction: FinanceTransactionConnection,
    context: RedemptionContext,
    reservation: CashReservationContext,
    actorUserId: string,
    now: Date
  ): Promise<void> {
    if (!context.foundationBeneficiaryId) {
      throw new Error('The cash unit lacks its foundation beneficiary')
    }
    const funding = classification(context.fundingClassification)
    if (!funding) throw new Error('The cash unit has an invalid financial classification')
    const [consumed] = await transaction
      .update(creditReservation)
      .set({ status: 'consumed', consumedAt: now })
      .where(and(eq(creditReservation.id, reservation.id), eq(creditReservation.status, 'active')))
      .returning({ id: creditReservation.id })
    if (!consumed) throw new Error('The cash reservation changed concurrently')

    const dueAt = new Date(now.getTime() + reservation.repaymentTermSeconds * 1_000)
    await transaction.insert(creditDebt).values({
      id: createId('cdt'),
      venueId: context.venueId,
      unitId: context.unitId,
      reservationId: reservation.id,
      principalMinor: reservation.amountMinor,
      outstandingMinor: reservation.amountMinor,
      currency: 'COP',
      incurredAt: now,
      dueAt,
      createdAt: now,
      updatedAt: now,
    })

    const venueReceivable = await ensureFinanceAccount(transaction, {
      kind: 'venue_receivable',
      ownerKey: context.venueId,
      venueId: context.venueId,
      currency: 'COP',
      fundingClassification: funding,
    })
    const foundation = await ensureFinanceAccount(transaction, {
      kind: 'foundation_payable',
      ownerKey: context.foundationBeneficiaryId,
      currency: 'COP',
      fundingClassification: funding,
    })
    await postFinanceTransaction(transaction, {
      operationKey: `cash-debt:${context.unitId}`,
      kind: 'cash_debt_incurred',
      currency: 'COP',
      orderSnapshotId: context.snapshotId,
      customerOrderId: context.customerOrderId ?? undefined,
      createdByUserId: actorUserId,
      entries: [
        { accountId: venueReceivable, amountMinor: reservation.amountMinor },
        { accountId: foundation, amountMinor: -reservation.amountMinor },
      ],
      now,
    })

    const [remaining] = await transaction
      .select({
        count: sql<string>`count(*) filter (where ${commerceOrderUnit.lifecycleStatus} = 'issued')`,
      })
      .from(commerceOrderUnit)
      .where(eq(commerceOrderUnit.orderSnapshotId, context.snapshotId))
    if (Number(remaining?.count ?? 0) === 0) {
      await transaction
        .update(productOrder)
        .set({ status: 'paid', paidAt: now, updatedAt: now })
        .where(and(eq(productOrder.id, context.orderId), eq(productOrder.status, 'pending')))
    }
    if (context.customerOrderId) {
      const [remainingInParent] = await transaction
        .select({
          count: sql<string>`count(*) filter (where ${commerceOrderUnit.lifecycleStatus} = 'issued')`,
        })
        .from(commerceOrderUnit)
        .innerJoin(
          commerceOrderSnapshot,
          eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
        )
        .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
        .where(eq(productOrder.customerOrderId, context.customerOrderId))
      if (Number(remainingInParent?.count ?? 0) === 0) {
        await transaction
          .update(customerOrder)
          .set({ status: 'paid', paidAt: now, updatedAt: now })
          .where(
            and(eq(customerOrder.id, context.customerOrderId), eq(customerOrder.status, 'pending'))
          )
      }
    }
  }

  async #expireCashUnit(
    transaction: FinanceTransactionConnection,
    context: RedemptionContext,
    now: Date,
    source: 'scan' | 'job'
  ): Promise<void> {
    const reservation = await this.#loadCashReservation(transaction, context.unitId)
    if (!reservation || reservation.status !== 'active') return
    const operationKey = `cash-expire:${context.unitId}`
    const inserted = await transaction
      .insert(unitLifecycleOperation)
      .values({
        id: createId('ulo'),
        operationKey,
        contentHash: digest({ kind: 'expire', unitId: context.unitId }),
        unitId: context.unitId,
        kind: 'expire',
        status: 'completed',
        detail: { orderId: context.orderId, source: `cash_${source}` },
        createdAt: now,
      })
      .onConflictDoNothing({ target: unitLifecycleOperation.operationKey })
      .returning({ id: unitLifecycleOperation.id })
    if (inserted.length === 0) return

    await transaction
      .update(creditReservation)
      .set({ status: 'expired', releasedAt: now })
      .where(and(eq(creditReservation.id, reservation.id), eq(creditReservation.status, 'active')))
    const updated = await transaction
      .update(commerceOrderUnit)
      .set({ lifecycleStatus: 'expired', updatedAt: now })
      .where(
        and(
          eq(commerceOrderUnit.id, context.unitId),
          eq(commerceOrderUnit.lifecycleStatus, 'issued')
        )
      )
      .returning({ id: commerceOrderUnit.id })
    if (updated.length === 0) throw new Error('The cash unit changed concurrently')
    await transaction
      .update(orderRedemption)
      .set({ status: 'void', updatedAt: now })
      .where(
        and(eq(orderRedemption.id, context.redemptionId), eq(orderRedemption.status, 'issued'))
      )
    await transaction
      .update(productOrder)
      .set({ status: 'expired', updatedAt: now })
      .where(and(eq(productOrder.id, context.orderId), eq(productOrder.status, 'pending')))
    if (context.customerOrderId) {
      await transaction
        .update(customerOrder)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(eq(customerOrder.id, context.customerOrderId), eq(customerOrder.status, 'pending'))
        )
    }
    await transaction.insert(financeAuditEvent).values({
      id: createId('fae'),
      entityType: 'credit_reservation',
      entityId: reservation.id,
      action: 'expired_released',
      operationKey,
      previousState: 'active',
      nextState: 'expired',
      detail: { unitId: context.unitId, orderId: context.orderId, source },
      createdAt: now,
    })
  }

  async #postDistributionIfFinal(
    transaction: FinanceTransactionConnection,
    context: RedemptionContext,
    actorUserId: string,
    now: Date
  ): Promise<void> {
    const funding = classification(context.fundingClassification)
    if (!funding || !context.foundationBeneficiaryId) {
      throw new Error('The unit lacks a valid financial classification')
    }
    const [row] = await transaction
      .select({
        runId: allocationRun.id,
        chargeId: allocationRun.chargeId,
        grossMinor: unitAllocation.grossMinor,
        deductionMinor: unitAllocation.deductionMinor,
        netMinor: unitAllocation.netMinor,
        donationMinor: unitAllocation.donationMinor,
        venueMinor: unitAllocation.venueMinor,
        ordinal: commerceOrderUnit.ordinal,
      })
      .from(unitAllocation)
      .innerJoin(allocationRun, eq(unitAllocation.allocationRunId, allocationRun.id))
      .innerJoin(commerceOrderUnit, eq(unitAllocation.unitId, commerceOrderUnit.id))
      .where(and(eq(unitAllocation.unitId, context.unitId), eq(allocationRun.status, 'final')))
      .orderBy(desc(allocationRun.revision))
      .limit(1)
    if (!row) return

    await postUnitDistribution(transaction, {
      runId: row.runId,
      allocation: {
        unitId: context.unitId,
        ordinal: row.ordinal,
        grossMinor: row.grossMinor as MinorUnits,
        deductionMinor: row.deductionMinor as MinorUnits,
        netMinor: row.netMinor as MinorUnits,
        donationMinor: row.donationMinor as MinorUnits,
        venueMinor: row.venueMinor as MinorUnits,
      },
      snapshotId: context.snapshotId,
      customerOrderId: context.customerOrderId,
      foundationBeneficiaryId: context.foundationBeneficiaryId,
      venueId: context.venueId,
      chargeId: row.chargeId,
      classification: funding,
      createdByUserId: actorUserId,
      now,
    })
  }

  async #expireLockedUnit(
    transaction: FinanceTransactionConnection,
    context: RedemptionContext,
    now: Date,
    source: 'scan' | 'job'
  ): Promise<void> {
    const operationKey = `unit-expire:${context.unitId}`
    const contentHash = digest({ kind: 'expire', unitId: context.unitId })
    const inserted = await transaction
      .insert(unitLifecycleOperation)
      .values({
        id: createId('ulo'),
        operationKey,
        contentHash,
        unitId: context.unitId,
        kind: 'expire',
        status: 'completed',
        detail: { orderId: context.orderId, source },
        createdAt: now,
      })
      .onConflictDoNothing({ target: unitLifecycleOperation.operationKey })
      .returning({ id: unitLifecycleOperation.id })
    if (inserted.length === 0) return

    const updated = await transaction
      .update(commerceOrderUnit)
      .set({ lifecycleStatus: 'expired', updatedAt: now })
      .where(
        and(
          eq(commerceOrderUnit.id, context.unitId),
          eq(commerceOrderUnit.lifecycleStatus, 'issued')
        )
      )
      .returning({ id: commerceOrderUnit.id })
    if (updated.length === 0) throw new Error('The expirable unit changed concurrently')
    await transaction
      .update(orderRedemption)
      .set({ status: 'void', updatedAt: now })
      .where(
        and(eq(orderRedemption.id, context.redemptionId), eq(orderRedemption.status, 'issued'))
      )
    await transaction
      .update(productOrder)
      .set({ status: 'expired', updatedAt: now })
      .where(and(eq(productOrder.id, context.orderId), eq(productOrder.status, 'paid')))
    if (context.customerOrderId) {
      await transaction
        .update(customerOrder)
        .set({ status: 'expired', updatedAt: now })
        .where(and(eq(customerOrder.id, context.customerOrderId), eq(customerOrder.status, 'paid')))
    }
    await transaction.insert(financeAuditEvent).values({
      id: createId('fae'),
      entityType: 'commerce_order_unit',
      entityId: context.unitId,
      action: 'expired_refund_retained',
      operationKey,
      previousState: 'issued',
      nextState: 'expired',
      detail: { orderId: context.orderId, source },
      createdAt: now,
    })
  }
}
