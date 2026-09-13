import 'server-only'

import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm'

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
import { orderRedemption, productOrder, venue, venueMember, venueProduct } from '@/database/schema'
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
      buyerName: string
      orderId: string
      venueSlug: string
      quantity: number
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
  orderId: string
  orderStatus: string
  payMethod: string
  venueId: string
  venueSlug: string
  venueStatus: string
  productName: string
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
      const context = await this.#loadRedemption(transaction, input.code)
      if (!context) return { kind: 'rejected', reason: 'not_found' } as const

      const operationHash = digest({
        kind: 'redeem',
        unitId: context.unitId,
        expectedVenueId: input.expectedVenueId,
        actorUserId: input.actorUserId,
        actorIsPlatform: input.actorIsPlatform,
      })
      if (context.venueId !== input.expectedVenueId) {
        return { kind: 'rejected', reason: 'wrong_venue' } as const
      }
      if (!input.actorIsPlatform) {
        const [membership] = await transaction
          .select({ id: venueMember.id })
          .from(venueMember)
          .where(
            and(eq(venueMember.venueId, context.venueId), eq(venueMember.userId, input.actorUserId))
          )
          .limit(1)
        if (!membership) return { kind: 'rejected', reason: 'unauthorized' } as const
      }
      const existing = await this.#findLifecycleOperation(transaction, input.operationKey)
      if (existing) {
        if (
          existing.contentHash !== operationHash ||
          existing.unitId !== context.unitId ||
          existing.kind !== 'redeem'
        ) {
          return { kind: 'rejected', reason: 'operator_review' } as const
        }
        return this.#successResult(transaction, context, true)
      }
      if (
        !classification(context.fundingClassification) ||
        (context.payMethod !== 'app' && context.payMethod !== 'bar')
      ) {
        return { kind: 'rejected', reason: 'operator_review' } as const
      }
      if (
        (context.payMethod === 'app' && context.orderStatus !== 'paid') ||
        (context.payMethod === 'bar' &&
          context.orderStatus !== 'pending' &&
          context.orderStatus !== 'paid')
      ) {
        return { kind: 'rejected', reason: 'unpaid' } as const
      }

      const now = this.#now()
      if (
        context.unitExpiresAt &&
        context.unitExpiresAt <= now &&
        context.unitStatus === 'issued'
      ) {
        if (context.payMethod === 'bar') {
          await this.#expireCashUnit(transaction, context, now, 'scan')
        } else {
          await this.#expireLockedUnit(transaction, context, now, 'scan')
        }
        return { kind: 'rejected', reason: 'expired' } as const
      }
      if (context.unitStatus !== 'issued' || context.redemptionStatus !== 'issued') {
        return { kind: 'rejected', reason: rejectionForState(context) } as const
      }
      const cashReservation =
        context.payMethod === 'bar'
          ? await this.#loadCashReservation(transaction, context.unitId)
          : undefined
      if (
        context.payMethod === 'bar' &&
        (!cashReservation ||
          cashReservation.status !== 'active' ||
          cashReservation.expiresAt <= now)
      ) {
        return { kind: 'rejected', reason: 'expired' } as const
      }
      if (
        context.payMethod === 'bar' &&
        (context.venueStatus !== 'published' || cashReservation?.policyStatus !== 'active')
      ) {
        return { kind: 'rejected', reason: 'operator_review' } as const
      }

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
          detail: { venueId: context.venueId, orderId: context.orderId },
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
        return this.#successResult(transaction, context, true)
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
          and(eq(orderRedemption.id, context.redemptionId), eq(orderRedemption.status, 'issued'))
        )
        .returning({ id: orderRedemption.id })
      const [updatedUnit] = await transaction
        .update(commerceOrderUnit)
        .set({ lifecycleStatus: 'redeemed', redeemedAt: now, updatedAt: now })
        .where(
          and(
            eq(commerceOrderUnit.id, context.unitId),
            eq(commerceOrderUnit.lifecycleStatus, 'issued')
          )
        )
        .returning({ id: commerceOrderUnit.id })
      if (!updatedRedemption || !updatedUnit) {
        throw new Error('The unit and compatibility redemption diverged')
      }

      if (context.payMethod === 'bar') {
        if (!cashReservation) throw new Error('The cash reservation disappeared')
        await this.#consumeCashReservation(
          transaction,
          context,
          cashReservation,
          input.actorUserId,
          now
        )
      } else {
        await this.#postDistributionIfFinal(transaction, context, input.actorUserId, now)
      }
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'commerce_order_unit',
        entityId: context.unitId,
        action: 'redeemed',
        actorUserId: input.actorUserId,
        operationKey: input.operationKey,
        previousState: 'issued',
        nextState: 'redeemed',
        detail: { orderId: context.orderId, venueId: context.venueId },
        createdAt: now,
      })

      return this.#successResult(transaction, context, false)
    })
  }

  async expireDueUnits(input: { now?: Date; limit?: number } = {}): Promise<ExpireUnitsResult> {
    const now = input.now ?? this.#now()
    const limit = Math.min(Math.max(input.limit ?? 250, 1), 1_000)
    const candidates = await this.#database
      .select({ id: commerceOrderUnit.id })
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
        orderId: productOrder.id,
        orderStatus: productOrder.status,
        payMethod: productOrder.payMethod,
        venueId: productOrder.venueId,
        venueSlug: venue.slug,
        venueStatus: venue.status,
        productName: venueProduct.name,
        buyerName: productOrder.buyerName,
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
      .innerJoin(venue, eq(productOrder.venueId, venue.id))
      .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
      .where(eq(orderRedemption.code, code))
      .limit(1)
      .for('update')
    return row
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
        orderId: productOrder.id,
        orderStatus: productOrder.status,
        payMethod: productOrder.payMethod,
        venueId: productOrder.venueId,
        venueSlug: venue.slug,
        venueStatus: venue.status,
        productName: venueProduct.name,
        buyerName: productOrder.buyerName,
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
      .innerJoin(venue, eq(productOrder.venueId, venue.id))
      .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
      .where(eq(commerceOrderUnit.id, unitId))
      .limit(1)
      .for('update')
    return row
  }

  async #findLifecycleOperation(
    transaction: FinanceTransactionConnection,
    operationKey: string
  ): Promise<{ contentHash: string; unitId: string; kind: string } | undefined> {
    const [row] = await transaction
      .select({
        contentHash: unitLifecycleOperation.contentHash,
        unitId: unitLifecycleOperation.unitId,
        kind: unitLifecycleOperation.kind,
      })
      .from(unitLifecycleOperation)
      .where(eq(unitLifecycleOperation.operationKey, operationKey))
      .limit(1)
    return row
  }

  async #successResult(
    transaction: FinanceTransactionConnection,
    context: RedemptionContext,
    duplicate: boolean
  ): Promise<Extract<UnitRedemptionResult, { kind: 'redeemed' }>> {
    const [count] = await transaction
      .select({
        value: sql<string>`count(*) filter (where ${commerceOrderUnit.lifecycleStatus} = 'redeemed')`,
      })
      .from(commerceOrderUnit)
      .where(eq(commerceOrderUnit.orderSnapshotId, context.snapshotId))
    return {
      kind: 'redeemed',
      duplicate,
      productName: context.productName,
      buyerName: context.buyerName,
      orderId: context.orderId,
      venueSlug: context.venueSlug,
      quantity: Number(context.quantity),
      redeemedCount: Number(count?.value ?? 0),
      collectMinor: context.payMethod === 'bar' ? context.unitGrossMinor : null,
    }
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
