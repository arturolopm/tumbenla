import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, inArray, ne } from 'drizzle-orm'

import type { db } from '@/database'
import {
  commerceOrderSnapshot,
  commerceOrderUnit,
  financeAuditEvent,
  financialOperation,
  financialOperationAllocation,
  paymentAttempt,
  paymentCharge,
  unitLifecycleOperation,
} from '@/database/commerce-schema'
import { orderRedemption, productOrder } from '@/database/schema'
import { createId } from '@/lib/utils/id'
import { assertReviewedEvidence } from './finance-evidence-service'
import {
  ensureFinanceAccount,
  type FinanceTransactionConnection,
  postFinanceTransaction,
} from './finance-ledger'
import {
  fundingClassification,
  type FundingClassification,
  treasurySnapshot,
} from './treasury-service'

type CommerceDatabase = typeof db

export type ReserveRefundResult = Readonly<{
  operationId: string
  amountMinor: bigint
  unitIds: readonly string[]
  duplicate: boolean
}>

type RefundableUnit = Readonly<{
  unitId: string
  unitStatus: string
  grossMinor: bigint
  redemptionId: string | null
  snapshotId: string
  fundingClassification: string
  orderStatus: string
  payMethod: string
  expiresAt: Date | null
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const validateInput = (input: {
  operationKey: string
  orderId: string
  unitIds: readonly string[]
  destinationFingerprint: string
}): string[] => {
  if (!/^[A-Za-z0-9:_-]{8,180}$/.test(input.operationKey)) {
    throw new Error('A durable refund operation key is required')
  }
  if (input.orderId.length === 0) throw new Error('An order is required')
  if (!/^[a-f0-9]{64}$/.test(input.destinationFingerprint)) {
    throw new Error('A verified original-payer destination fingerprint is required')
  }
  const unitIds = [...input.unitIds].sort()
  if (unitIds.length === 0 || unitIds.length > 100) {
    throw new Error('Select between 1 and 100 units to refund')
  }
  if (new Set(unitIds).size !== unitIds.length || unitIds.some((id) => id.length === 0)) {
    throw new Error('Refund unit IDs must be non-empty and unique')
  }
  return unitIds
}

export class CommerceRefundService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async reserveRefund(input: {
    operationKey: string
    orderId: string
    unitIds: readonly string[]
    destinationFingerprint: string
    requestedByUserId?: string
  }): Promise<ReserveRefundResult> {
    const unitIds = validateInput(input)
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const units = await this.#loadUnits(transaction, input.orderId, unitIds)
      if (units.length !== unitIds.length) throw new Error('One or more refund units do not exist')
      const snapshotId = units[0]?.snapshotId
      if (!snapshotId || units.some((unit) => unit.snapshotId !== snapshotId)) {
        throw new Error('Refund units must belong to one immutable order')
      }
      if (
        units.some(
          (unit) =>
            (unit.fundingClassification !== 'real' && unit.fundingClassification !== 'sandbox') ||
            unit.payMethod !== 'app'
        )
      ) {
        throw new Error('Only verified app-payment units can use the V2 refund workflow')
      }

      if (!(await this.#hasApprovedCharge(transaction, snapshotId))) {
        throw new Error('The order has no authoritative approved charge')
      }
      const classification = fundingClassification(units[0]?.fundingClassification ?? '')
      const amountMinor = units.reduce((sum, unit) => sum + unit.grossMinor, BigInt(0))
      const contentHash = digest({
        kind: 'refund',
        orderId: input.orderId,
        unitIds,
        amountMinor: amountMinor.toString(),
        currency: 'COP',
        fundingClassification: classification,
        destinationFingerprint: input.destinationFingerprint,
      })

      const [existing] = await transaction
        .select({
          id: financialOperation.id,
          contentHash: financialOperation.contentHash,
          amountMinor: financialOperation.amountMinor,
        })
        .from(financialOperation)
        .where(eq(financialOperation.operationKey, input.operationKey))
        .limit(1)
      if (existing) {
        if (existing.contentHash !== contentHash) {
          throw new Error('Refund operation key was reused with different content')
        }
        return {
          operationId: existing.id,
          amountMinor: existing.amountMinor,
          unitIds,
          duplicate: true,
        }
      }

      if (units.some((unit) => unit.unitStatus !== 'issued' && unit.unitStatus !== 'expired')) {
        throw new Error('Only unclaimed issued or expired units can be refunded')
      }
      if (units.some((unit) => unit.orderStatus !== 'paid' && unit.orderStatus !== 'expired')) {
        throw new Error('The order is not eligible for a refund')
      }

      const operationId = createId('fop')
      await transaction.insert(financialOperation).values({
        id: operationId,
        operationKey: input.operationKey,
        contentHash,
        kind: 'refund',
        amountMinor,
        currency: 'COP',
        fundingClassification: classification,
        status: 'prepared',
        destinationFingerprint: input.destinationFingerprint,
        requestedByUserId: input.requestedByUserId,
        createdAt: now,
        updatedAt: now,
      })
      await transaction.insert(financialOperationAllocation).values(
        units.map((unit, index) => ({
          id: createId('foa'),
          operationId,
          sourceType: 'order_unit',
          sourceId: unit.unitId,
          amountMinor: unit.grossMinor,
          ordinal: index + 1,
          createdAt: now,
        }))
      )

      const reserved = await transaction
        .update(commerceOrderUnit)
        .set({ lifecycleStatus: 'refund_reserved', refundOperationId: operationId, updatedAt: now })
        .where(
          and(
            inArray(commerceOrderUnit.id, unitIds),
            inArray(commerceOrderUnit.lifecycleStatus, ['issued', 'expired'])
          )
        )
        .returning({ id: commerceOrderUnit.id })
      if (reserved.length !== units.length) throw new Error('A refund unit changed concurrently')

      const redemptionIds = units.flatMap((unit) => (unit.redemptionId ? [unit.redemptionId] : []))
      if (redemptionIds.length > 0) {
        await transaction
          .update(orderRedemption)
          .set({ status: 'void', updatedAt: now })
          .where(
            and(inArray(orderRedemption.id, redemptionIds), eq(orderRedemption.status, 'issued'))
          )
      }

      await transaction.insert(unitLifecycleOperation).values(
        units.map((unit) => ({
          id: createId('ulo'),
          operationKey: `refund-reserve:${operationId}:${unit.unitId}`,
          contentHash: digest({ kind: 'refund_reserve', operationId, unitId: unit.unitId }),
          unitId: unit.unitId,
          kind: 'refund_reserve',
          status: 'completed',
          actorUserId: input.requestedByUserId,
          detail: {
            operationId,
            orderId: input.orderId,
            previousState: unit.unitStatus,
            amountMinor: unit.grossMinor.toString(),
          },
          createdAt: now,
        }))
      )
      await transaction.insert(financeAuditEvent).values(
        units.map((unit) => ({
          id: createId('fae'),
          entityType: 'commerce_order_unit',
          entityId: unit.unitId,
          action: 'refund_reserved',
          actorUserId: input.requestedByUserId,
          operationKey: input.operationKey,
          previousState: unit.unitStatus,
          nextState: 'refund_reserved',
          detail: { operationId, orderId: input.orderId },
          createdAt: now,
        }))
      )

      return { operationId, amountMinor, unitIds, duplicate: false }
    })
  }

  async markSubmittedUnknown(input: {
    operationId: string
    submittedByUserId: string
    statusDetail: string
    externalReference?: string
  }): Promise<{ operationId: string; status: string; duplicate: boolean }> {
    if (input.statusDetail.trim().length === 0) throw new Error('Submission detail is required')
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const operation = await this.#loadRefundOperation(transaction, input.operationId)
      if (operation.status === 'submitted_unknown') {
        return { operationId: operation.id, status: operation.status, duplicate: true }
      }
      if (operation.status !== 'prepared') throw new Error('Only a reserved refund can submit')
      await transaction
        .update(financialOperation)
        .set({
          status: 'submitted_unknown',
          statusDetail: input.statusDetail.trim(),
          externalReference: input.externalReference?.trim() || null,
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(financialOperation.id, operation.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'financial_operation',
        entityId: operation.id,
        action: 'refund_submitted_unknown',
        actorUserId: input.submittedByUserId,
        operationKey: operation.operationKey,
        previousState: 'prepared',
        nextState: 'submitted_unknown',
        detail: { statusDetail: input.statusDetail.trim() },
        createdAt: now,
      })
      return { operationId: operation.id, status: 'submitted_unknown', duplicate: false }
    })
  }

  async confirm(input: {
    operationId: string
    externalReference: string
    bankEvidenceId: string
    destinationFingerprint: string
    verifiedByUserId: string
  }): Promise<{ operationId: string; amountMinor: bigint; status: string; duplicate: boolean }> {
    if (
      input.externalReference.trim().length === 0 ||
      input.bankEvidenceId.length === 0 ||
      input.verifiedByUserId.length === 0
    ) {
      throw new Error('Refund confirmation requires a bank reference, evidence, and reviewer')
    }
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const classification = await this.#peekRefundClassification(transaction, input.operationId)
      const liquidity = await treasurySnapshot(transaction, classification, true)
      const operation = await this.#loadRefundOperation(transaction, input.operationId)
      if (operation.status === 'bank_verified') {
        if (
          operation.externalReference !== input.externalReference.trim() ||
          operation.bankEvidenceId !== input.bankEvidenceId ||
          operation.destinationFingerprint !== input.destinationFingerprint
        ) {
          throw new Error('Confirmed refund retry does not match the original evidence')
        }
        return {
          operationId: operation.id,
          amountMinor: operation.amountMinor,
          status: operation.status,
          duplicate: true,
        }
      }
      if (operation.status !== 'prepared' && operation.status !== 'submitted_unknown') {
        throw new Error('Refund cannot be confirmed in its current state')
      }
      if (operation.destinationFingerprint !== input.destinationFingerprint) {
        throw new Error('Refund destination does not match the verified original payer')
      }
      await assertReviewedEvidence(transaction, {
        evidenceId: input.bankEvidenceId,
        ownerType: 'financial_operation',
        ownerId: operation.id,
        allowedKinds: ['bank_record', 'provider_refund_record'],
      })
      const units = await this.#loadOperationUnits(transaction, operation.id)
      if (
        units.length === 0 ||
        units.some(
          (unit) =>
            unit.lifecycleStatus !== 'refund_reserved' || unit.refundOperationId !== operation.id
        )
      ) {
        throw new Error('Refund units are not exclusively reserved by this operation')
      }
      const snapshotId = units[0]?.snapshotId
      const orderId = units[0]?.orderId
      if (
        !snapshotId ||
        !orderId ||
        units.some((unit) => unit.snapshotId !== snapshotId || unit.orderId !== orderId)
      ) {
        throw new Error('Refund units do not belong to one immutable order')
      }
      if (liquidity.cashMinor - liquidity.pendingPayoutMinor < operation.amountMinor) {
        throw new Error('Refund cannot be confirmed without cleared cash coverage')
      }
      const held = await ensureFinanceAccount(transaction, {
        kind: 'customer_funds_held',
        ownerKey: snapshotId,
        currency: 'COP',
        fundingClassification: operation.fundingClassification,
      })
      const cash = await ensureFinanceAccount(transaction, {
        kind: 'platform_cash',
        ownerKey: 'platform',
        currency: 'COP',
        fundingClassification: operation.fundingClassification,
      })
      await postFinanceTransaction(transaction, {
        operationKey: `refund-confirm:${operation.id}`,
        kind: 'refund',
        currency: 'COP',
        orderSnapshotId: snapshotId,
        operationId: operation.id,
        createdByUserId: input.verifiedByUserId,
        entries: [
          { accountId: held, amountMinor: operation.amountMinor },
          { accountId: cash, amountMinor: -operation.amountMinor },
        ],
        now,
      })
      const unitIds = units.map((unit) => unit.id)
      const confirmed = await transaction
        .update(commerceOrderUnit)
        .set({ lifecycleStatus: 'refunded', updatedAt: now })
        .where(
          and(
            inArray(commerceOrderUnit.id, unitIds),
            eq(commerceOrderUnit.lifecycleStatus, 'refund_reserved'),
            eq(commerceOrderUnit.refundOperationId, operation.id)
          )
        )
        .returning({ id: commerceOrderUnit.id })
      if (confirmed.length !== units.length) throw new Error('A refund unit changed concurrently')
      await transaction.insert(unitLifecycleOperation).values(
        units.map((unit) => ({
          id: createId('ulo'),
          operationKey: `refund-confirm:${operation.id}:${unit.id}`,
          contentHash: digest({
            kind: 'refund_confirm',
            operationId: operation.id,
            unitId: unit.id,
          }),
          unitId: unit.id,
          kind: 'refund_confirm',
          status: 'completed',
          actorUserId: input.verifiedByUserId,
          detail: {
            operationId: operation.id,
            evidenceId: input.bankEvidenceId,
            externalReference: input.externalReference.trim(),
          },
          createdAt: now,
        }))
      )
      await transaction
        .update(financialOperation)
        .set({
          status: 'bank_verified',
          externalReference: input.externalReference.trim(),
          bankEvidenceId: input.bankEvidenceId,
          verifiedByUserId: input.verifiedByUserId,
          verifiedAt: now,
          updatedAt: now,
        })
        .where(eq(financialOperation.id, operation.id))
      const remaining = await transaction
        .select({ id: commerceOrderUnit.id })
        .from(commerceOrderUnit)
        .where(
          and(
            eq(commerceOrderUnit.orderSnapshotId, snapshotId),
            ne(commerceOrderUnit.lifecycleStatus, 'refunded')
          )
        )
        .limit(1)
      if (remaining.length === 0) {
        await transaction
          .update(productOrder)
          .set({ status: 'refunded', updatedAt: now })
          .where(eq(productOrder.id, orderId))
      }
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'financial_operation',
        entityId: operation.id,
        action: 'refund_bank_verified',
        actorUserId: input.verifiedByUserId,
        operationKey: operation.operationKey,
        previousState: operation.status,
        nextState: 'bank_verified',
        detail: {
          bankEvidenceId: input.bankEvidenceId,
          externalReference: input.externalReference.trim(),
          destinationFingerprint: input.destinationFingerprint,
          unitCount: units.length,
        },
        createdAt: now,
      })
      return {
        operationId: operation.id,
        amountMinor: operation.amountMinor,
        status: 'bank_verified',
        duplicate: false,
      }
    })
  }

  async fail(input: {
    operationId: string
    reason: string
    verifiedByUserId: string
    evidenceId?: string
  }): Promise<{ operationId: string; status: string; duplicate: boolean }> {
    if (input.reason.trim().length === 0) throw new Error('A refund failure reason is required')
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const operation = await this.#loadRefundOperation(transaction, input.operationId)
      if (operation.status === 'failed') {
        return { operationId: operation.id, status: operation.status, duplicate: true }
      }
      if (operation.status !== 'prepared' && operation.status !== 'submitted_unknown') {
        throw new Error('Refund cannot fail in its current state')
      }
      if (operation.status === 'submitted_unknown') {
        if (!input.evidenceId) throw new Error('Unknown refund outcome needs reviewed evidence')
        await assertReviewedEvidence(transaction, {
          evidenceId: input.evidenceId,
          ownerType: 'financial_operation',
          ownerId: operation.id,
          allowedKinds: ['bank_record', 'provider_refund_record'],
        })
      }
      const units = await this.#loadOperationUnits(transaction, operation.id)
      const lifecycle = await transaction
        .select({ unitId: unitLifecycleOperation.unitId, detail: unitLifecycleOperation.detail })
        .from(unitLifecycleOperation)
        .where(
          and(
            inArray(
              unitLifecycleOperation.unitId,
              units.map((unit) => unit.id)
            ),
            eq(unitLifecycleOperation.kind, 'refund_reserve')
          )
        )
      const previousByUnit = new Map(
        lifecycle
          .filter((row) => row.detail.operationId === operation.id)
          .map((row) => [row.unitId, row.detail.previousState])
      )
      for (const unit of units) {
        const previous = previousByUnit.get(unit.id)
        if (previous !== 'issued' && previous !== 'expired') {
          throw new Error('Refund reservation is missing its prior unit state')
        }
        const next =
          previous === 'issued' && (!unit.expiresAt || unit.expiresAt > now) ? 'issued' : 'expired'
        await transaction
          .update(commerceOrderUnit)
          .set({ lifecycleStatus: next, refundOperationId: null, updatedAt: now })
          .where(
            and(
              eq(commerceOrderUnit.id, unit.id),
              eq(commerceOrderUnit.lifecycleStatus, 'refund_reserved'),
              eq(commerceOrderUnit.refundOperationId, operation.id)
            )
          )
        if (unit.redemptionId && next === 'issued') {
          await transaction
            .update(orderRedemption)
            .set({ status: 'issued', updatedAt: now })
            .where(eq(orderRedemption.id, unit.redemptionId))
        }
        await transaction.insert(unitLifecycleOperation).values({
          id: createId('ulo'),
          operationKey: `refund-release:${operation.id}:${unit.id}`,
          contentHash: digest({
            kind: 'refund_release',
            operationId: operation.id,
            unitId: unit.id,
            next,
          }),
          unitId: unit.id,
          kind: 'refund_release',
          status: 'completed',
          actorUserId: input.verifiedByUserId,
          detail: { operationId: operation.id, reason: input.reason.trim(), nextState: next },
          createdAt: now,
        })
      }
      await transaction
        .update(financialOperation)
        .set({
          status: 'failed',
          statusDetail: input.reason.trim(),
          bankEvidenceId: input.evidenceId,
          verifiedByUserId: input.verifiedByUserId,
          verifiedAt: input.evidenceId ? now : null,
          updatedAt: now,
        })
        .where(eq(financialOperation.id, operation.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'financial_operation',
        entityId: operation.id,
        action: 'refund_failed',
        actorUserId: input.verifiedByUserId,
        operationKey: operation.operationKey,
        previousState: operation.status,
        nextState: 'failed',
        detail: { reason: input.reason.trim(), evidenceId: input.evidenceId ?? null },
        createdAt: now,
      })
      return { operationId: operation.id, status: 'failed', duplicate: false }
    })
  }

  async #loadUnits(
    transaction: FinanceTransactionConnection,
    orderId: string,
    unitIds: readonly string[]
  ): Promise<RefundableUnit[]> {
    return transaction
      .select({
        unitId: commerceOrderUnit.id,
        unitStatus: commerceOrderUnit.lifecycleStatus,
        grossMinor: commerceOrderUnit.grossMinor,
        redemptionId: commerceOrderUnit.redemptionId,
        snapshotId: commerceOrderSnapshot.id,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        orderStatus: productOrder.status,
        payMethod: productOrder.payMethod,
        expiresAt: commerceOrderUnit.expiresAt,
      })
      .from(commerceOrderUnit)
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .where(and(eq(productOrder.id, orderId), inArray(commerceOrderUnit.id, unitIds)))
      .orderBy(commerceOrderUnit.ordinal)
      .for('update')
  }

  async #hasApprovedCharge(
    transaction: FinanceTransactionConnection,
    snapshotId: string
  ): Promise<boolean> {
    const [row] = await transaction
      .select({ id: paymentCharge.id })
      .from(paymentCharge)
      .innerJoin(paymentAttempt, eq(paymentCharge.attemptId, paymentAttempt.id))
      .where(
        and(eq(paymentAttempt.orderSnapshotId, snapshotId), eq(paymentCharge.status, 'approved'))
      )
      .limit(1)
    return Boolean(row)
  }

  async #loadRefundOperation(transaction: FinanceTransactionConnection, operationId: string) {
    const [operation] = await transaction
      .select({
        id: financialOperation.id,
        operationKey: financialOperation.operationKey,
        kind: financialOperation.kind,
        amountMinor: financialOperation.amountMinor,
        status: financialOperation.status,
        externalReference: financialOperation.externalReference,
        bankEvidenceId: financialOperation.bankEvidenceId,
        destinationFingerprint: financialOperation.destinationFingerprint,
        fundingClassification: financialOperation.fundingClassification,
      })
      .from(financialOperation)
      .where(eq(financialOperation.id, operationId))
      .limit(1)
      .for('update')
    if (!operation || operation.kind !== 'refund')
      throw new Error('Refund operation does not exist')
    return {
      ...operation,
      fundingClassification: fundingClassification(operation.fundingClassification ?? ''),
    }
  }

  async #peekRefundClassification(
    transaction: FinanceTransactionConnection,
    operationId: string
  ): Promise<FundingClassification> {
    const [operation] = await transaction
      .select({
        kind: financialOperation.kind,
        fundingClassification: financialOperation.fundingClassification,
      })
      .from(financialOperation)
      .where(eq(financialOperation.id, operationId))
      .limit(1)
    if (!operation || operation.kind !== 'refund') {
      throw new Error('Refund operation does not exist')
    }
    return fundingClassification(operation.fundingClassification ?? '')
  }

  async #loadOperationUnits(transaction: FinanceTransactionConnection, operationId: string) {
    return transaction
      .select({
        id: commerceOrderUnit.id,
        lifecycleStatus: commerceOrderUnit.lifecycleStatus,
        refundOperationId: commerceOrderUnit.refundOperationId,
        redemptionId: commerceOrderUnit.redemptionId,
        expiresAt: commerceOrderUnit.expiresAt,
        snapshotId: commerceOrderSnapshot.id,
        orderId: commerceOrderSnapshot.orderId,
      })
      .from(financialOperationAllocation)
      .innerJoin(commerceOrderUnit, eq(financialOperationAllocation.sourceId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .where(
        and(
          eq(financialOperationAllocation.operationId, operationId),
          eq(financialOperationAllocation.sourceType, 'order_unit')
        )
      )
      .orderBy(commerceOrderUnit.ordinal)
      .for('update')
  }
}
