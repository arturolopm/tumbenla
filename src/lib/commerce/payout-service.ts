import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationRun,
  beneficiaryBankVersion,
  commerceBeneficiary,
  commerceOrderSnapshot,
  commerceOrderUnit,
  financeAuditEvent,
  financialOperation,
  financialOperationAllocation,
  paymentCharge,
  unitAllocation,
} from '@/database/commerce-schema'
import { productOrder } from '@/database/schema'
import { createId } from '@/lib/utils/id'
import { assertReviewedEvidence } from './finance-evidence-service'
import {
  ensureFinanceAccount,
  type FinanceTransactionConnection,
  postFinanceTransaction,
} from './finance-ledger'
import {
  assertPayoutCapacity,
  fundingClassification,
  type FundingClassification,
  treasurySnapshot,
} from './treasury-service'

type CommerceDatabase = typeof db
type PayoutKind = 'venue_payout' | 'foundation_payout'

type PayoutSource = Readonly<{ unitAllocationId: string; amountMinor: bigint }>

type SourceContext = Readonly<{
  unitAllocationId: string
  venueMinor: bigint
  donationMinor: bigint
  runStatus: string
  unitStatus: string
  fundingClassification: string
  foundationBeneficiaryId: string | null
  venueId: string
  chargeStatus: string
  clearedAt: Date | null
}>

export type PayoutResult = Readonly<{
  operationId: string
  amountMinor: bigint
  status: string
  duplicate: boolean
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const validateOperationKey = (operationKey: string): void => {
  if (!/^[A-Za-z0-9:_-]{8,180}$/.test(operationKey)) {
    throw new Error('A durable payout operation key is required')
  }
}

const normalizeSources = (sources: readonly PayoutSource[]): PayoutSource[] => {
  const normalized = [...sources].sort((left, right) =>
    left.unitAllocationId.localeCompare(right.unitAllocationId)
  )
  if (
    normalized.length === 0 ||
    normalized.length > 500 ||
    new Set(normalized.map((source) => source.unitAllocationId)).size !== normalized.length ||
    normalized.some(
      (source) => source.unitAllocationId.length === 0 || source.amountMinor <= BigInt(0)
    )
  ) {
    throw new Error('Payout sources must be unique and positive')
  }
  return normalized
}

export class PayoutService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async prepare(input: {
    operationKey: string
    kind: PayoutKind
    beneficiaryBankVersionId: string
    fundingClassification: FundingClassification
    sources: readonly PayoutSource[]
    requestedByUserId: string
  }): Promise<PayoutResult> {
    validateOperationKey(input.operationKey)
    const sources = normalizeSources(input.sources)
    const amountMinor = sources.reduce((sum, source) => sum + source.amountMinor, BigInt(0))
    const contentHash = digest({
      kind: input.kind,
      beneficiaryBankVersionId: input.beneficiaryBankVersionId,
      fundingClassification: input.fundingClassification,
      currency: 'COP',
      sources: sources.map((source) => ({
        unitAllocationId: source.unitAllocationId,
        amountMinor: source.amountMinor.toString(),
      })),
    })
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const existing = await this.#existing(transaction, input.operationKey, contentHash)
      if (existing) return existing
      await assertPayoutCapacity(transaction, {
        fundingClassification: input.fundingClassification,
        additionalPayoutMinor: amountMinor,
      })
      const beneficiary = await this.#loadVerifiedBeneficiary(
        transaction,
        input.beneficiaryBankVersionId
      )
      const contexts = await this.#loadSources(
        transaction,
        sources.map((source) => source.unitAllocationId)
      )
      if (contexts.length !== sources.length)
        throw new Error('One or more payout sources do not exist')
      await this.#validateSources(transaction, input, sources, contexts, beneficiary)

      const operationId = createId('fop')
      const venueId = input.kind === 'venue_payout' ? beneficiary.venueId : null
      await transaction.insert(financialOperation).values({
        id: operationId,
        operationKey: input.operationKey,
        contentHash,
        kind: input.kind,
        venueId,
        beneficiaryBankVersionId: beneficiary.bankVersionId,
        amountMinor,
        currency: 'COP',
        fundingClassification: input.fundingClassification,
        status: 'prepared',
        destinationFingerprint: beneficiary.destinationFingerprint,
        requestedByUserId: input.requestedByUserId,
        createdAt: now,
        updatedAt: now,
      })
      await transaction.insert(financialOperationAllocation).values(
        sources.map((source, index) => ({
          id: createId('foa'),
          operationId,
          sourceType:
            input.kind === 'venue_payout' ? 'venue_unit_allocation' : 'foundation_unit_allocation',
          sourceId: source.unitAllocationId,
          amountMinor: source.amountMinor,
          ordinal: index + 1,
          createdAt: now,
        }))
      )
      await this.#audit(transaction, {
        operationId,
        operationKey: input.operationKey,
        action: 'payout_prepared',
        actorUserId: input.requestedByUserId,
        nextState: 'prepared',
        detail: {
          kind: input.kind,
          beneficiaryId: beneficiary.beneficiaryId,
          bankVersionId: beneficiary.bankVersionId,
          amountMinor: amountMinor.toString(),
          sourceCount: sources.length,
        },
        now,
      })
      return { operationId, amountMinor, status: 'prepared', duplicate: false }
    })
  }

  async markSubmittedUnknown(input: {
    operationId: string
    submittedByUserId: string
    statusDetail: string
    externalReference?: string
  }): Promise<PayoutResult> {
    if (input.statusDetail.trim().length === 0) throw new Error('Submission detail is required')
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const operation = await this.#loadPayoutOperation(transaction, input.operationId)
      if (operation.status === 'submitted_unknown') {
        return { ...operation, duplicate: true }
      }
      if (operation.status !== 'prepared')
        throw new Error('Only a prepared payout can be submitted')
      await transaction
        .update(financialOperation)
        .set({
          status: 'submitted_unknown',
          statusDetail: input.statusDetail.trim(),
          externalReference: input.externalReference?.trim() || null,
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(financialOperation.id, operation.operationId))
      await this.#audit(transaction, {
        operationId: operation.operationId,
        operationKey: operation.operationKey,
        action: 'payout_submitted_unknown',
        actorUserId: input.submittedByUserId,
        previousState: 'prepared',
        nextState: 'submitted_unknown',
        detail: { statusDetail: input.statusDetail.trim() },
        now,
      })
      return { ...operation, status: 'submitted_unknown', duplicate: false }
    })
  }

  async confirm(input: {
    operationId: string
    externalReference: string
    bankEvidenceId: string
    destinationFingerprint: string
    verifiedByUserId: string
  }): Promise<PayoutResult> {
    if (
      input.externalReference.trim().length === 0 ||
      input.bankEvidenceId.length === 0 ||
      input.verifiedByUserId.length === 0
    ) {
      throw new Error('Bank reference, evidence, and reviewer are required')
    }
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const classification = await this.#peekPayoutClassification(transaction, input.operationId)
      const capacity = await treasurySnapshot(transaction, classification, true)
      const operation = await this.#loadPayoutOperation(transaction, input.operationId)
      if (operation.status === 'bank_verified') {
        if (
          operation.externalReference !== input.externalReference.trim() ||
          operation.bankEvidenceId !== input.bankEvidenceId ||
          operation.destinationFingerprint !== input.destinationFingerprint
        ) {
          throw new Error('Confirmed payout retry does not match the original evidence')
        }
        return { ...operation, duplicate: true }
      }
      if (operation.status !== 'prepared' && operation.status !== 'submitted_unknown') {
        throw new Error('Payout cannot be confirmed in its current state')
      }
      if (operation.destinationFingerprint !== input.destinationFingerprint) {
        throw new Error('Bank destination does not match the frozen payout instruction')
      }
      await assertReviewedEvidence(transaction, {
        evidenceId: input.bankEvidenceId,
        ownerType: 'financial_operation',
        ownerId: operation.operationId,
        allowedKinds: ['bank_record'],
      })
      if (capacity.availableForNewPayoutMinor < BigInt(0)) {
        throw new Error(
          'Payout is blocked by refund, dispute, pending-transfer, or reserve coverage'
        )
      }

      const payable = await ensureFinanceAccount(transaction, {
        kind: operation.kind === 'venue_payout' ? 'venue_payable' : 'foundation_payable',
        ownerKey:
          operation.kind === 'venue_payout' ? (operation.venueId ?? '') : operation.beneficiaryId,
        venueId: operation.kind === 'venue_payout' ? operation.venueId : null,
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
        operationKey: `payout-confirm:${operation.operationId}`,
        kind: operation.kind,
        currency: 'COP',
        operationId: operation.operationId,
        createdByUserId: input.verifiedByUserId,
        entries: [
          { accountId: payable, amountMinor: operation.amountMinor },
          { accountId: cash, amountMinor: -operation.amountMinor },
        ],
        now,
      })
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
        .where(eq(financialOperation.id, operation.operationId))
      await this.#audit(transaction, {
        operationId: operation.operationId,
        operationKey: operation.operationKey,
        action: 'payout_bank_verified',
        actorUserId: input.verifiedByUserId,
        previousState: operation.status,
        nextState: 'bank_verified',
        detail: {
          bankEvidenceId: input.bankEvidenceId,
          externalReference: input.externalReference.trim(),
        },
        now,
      })
      return { ...operation, status: 'bank_verified', duplicate: false }
    })
  }

  async fail(input: {
    operationId: string
    evidenceId: string
    verifiedByUserId: string
    reason: string
  }): Promise<PayoutResult> {
    if (input.reason.trim().length === 0) throw new Error('A verified failure reason is required')
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const operation = await this.#loadPayoutOperation(transaction, input.operationId)
      if (operation.status === 'failed') return { ...operation, duplicate: true }
      if (operation.status !== 'prepared' && operation.status !== 'submitted_unknown') {
        throw new Error('Payout cannot fail in its current state')
      }
      await assertReviewedEvidence(transaction, {
        evidenceId: input.evidenceId,
        ownerType: 'financial_operation',
        ownerId: operation.operationId,
        allowedKinds: ['bank_record'],
      })
      await transaction
        .update(financialOperation)
        .set({
          status: 'failed',
          bankEvidenceId: input.evidenceId,
          statusDetail: input.reason.trim(),
          verifiedByUserId: input.verifiedByUserId,
          verifiedAt: now,
          updatedAt: now,
        })
        .where(eq(financialOperation.id, operation.operationId))
      await this.#audit(transaction, {
        operationId: operation.operationId,
        operationKey: operation.operationKey,
        action: 'payout_failed_verified',
        actorUserId: input.verifiedByUserId,
        previousState: operation.status,
        nextState: 'failed',
        detail: { evidenceId: input.evidenceId, reason: input.reason.trim() },
        now,
      })
      return { ...operation, status: 'failed', duplicate: false }
    })
  }

  async reverse(input: {
    operationId: string
    operationKey: string
    externalReference: string
    evidenceId: string
    verifiedByUserId: string
  }): Promise<PayoutResult> {
    validateOperationKey(input.operationKey)
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const original = await this.#loadPayoutOperation(transaction, input.operationId)
      if (original.status === 'reversed') {
        const [existing] = await transaction
          .select({ id: financialOperation.id })
          .from(financialOperation)
          .where(eq(financialOperation.operationKey, input.operationKey))
          .limit(1)
        if (!existing) throw new Error('Payout was reversed by another operation')
        return { ...original, status: 'reversed', duplicate: true }
      }
      if (original.status !== 'bank_verified')
        throw new Error('Only a confirmed payout can reverse')
      await assertReviewedEvidence(transaction, {
        evidenceId: input.evidenceId,
        ownerType: 'financial_operation',
        ownerId: original.operationId,
        allowedKinds: ['bank_record'],
      })

      const reversalHash = digest({
        kind: 'payout_reversal',
        reversalOfOperationId: original.operationId,
        externalReference: input.externalReference.trim(),
        evidenceId: input.evidenceId,
      })
      const reversalId = createId('fop')
      await transaction.insert(financialOperation).values({
        id: reversalId,
        operationKey: input.operationKey,
        contentHash: reversalHash,
        kind: 'reserve_adjustment',
        venueId: original.venueId,
        amountMinor: original.amountMinor,
        currency: 'COP',
        fundingClassification: original.fundingClassification,
        status: 'bank_verified',
        externalReference: input.externalReference.trim(),
        bankEvidenceId: input.evidenceId,
        destinationFingerprint: original.destinationFingerprint,
        reversalOfOperationId: original.operationId,
        requestedByUserId: input.verifiedByUserId,
        verifiedByUserId: input.verifiedByUserId,
        submittedAt: now,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      const payable = await ensureFinanceAccount(transaction, {
        kind: original.kind === 'venue_payout' ? 'venue_payable' : 'foundation_payable',
        ownerKey:
          original.kind === 'venue_payout' ? (original.venueId ?? '') : original.beneficiaryId,
        venueId: original.kind === 'venue_payout' ? original.venueId : null,
        currency: 'COP',
        fundingClassification: original.fundingClassification,
      })
      const cash = await ensureFinanceAccount(transaction, {
        kind: 'platform_cash',
        ownerKey: 'platform',
        currency: 'COP',
        fundingClassification: original.fundingClassification,
      })
      await postFinanceTransaction(transaction, {
        operationKey: `payout-reversal:${reversalId}`,
        kind: 'payout_reversal',
        currency: 'COP',
        operationId: reversalId,
        createdByUserId: input.verifiedByUserId,
        entries: [
          { accountId: cash, amountMinor: original.amountMinor },
          { accountId: payable, amountMinor: -original.amountMinor },
        ],
        now,
      })
      await transaction
        .update(financialOperation)
        .set({ status: 'reversed', statusDetail: 'bank_reversal_verified', updatedAt: now })
        .where(eq(financialOperation.id, original.operationId))
      await this.#audit(transaction, {
        operationId: original.operationId,
        operationKey: input.operationKey,
        action: 'payout_reversed',
        actorUserId: input.verifiedByUserId,
        previousState: 'bank_verified',
        nextState: 'reversed',
        detail: { reversalId, evidenceId: input.evidenceId },
        now,
      })
      return {
        operationId: original.operationId,
        amountMinor: original.amountMinor,
        status: 'reversed',
        duplicate: false,
      }
    })
  }

  async #loadVerifiedBeneficiary(
    transaction: FinanceTransactionConnection,
    bankVersionId: string
  ): Promise<{
    bankVersionId: string
    beneficiaryId: string
    beneficiaryKind: string
    venueId: string | null
    destinationFingerprint: string
  }> {
    const [row] = await transaction
      .select({
        bankVersionId: beneficiaryBankVersion.id,
        bankStatus: beneficiaryBankVersion.status,
        bankRetiredAt: beneficiaryBankVersion.retiredAt,
        destinationFingerprint: beneficiaryBankVersion.destinationFingerprint,
        beneficiaryId: commerceBeneficiary.id,
        beneficiaryKind: commerceBeneficiary.kind,
        beneficiaryStatus: commerceBeneficiary.status,
        venueId: commerceBeneficiary.venueId,
      })
      .from(beneficiaryBankVersion)
      .innerJoin(
        commerceBeneficiary,
        eq(beneficiaryBankVersion.beneficiaryId, commerceBeneficiary.id)
      )
      .where(eq(beneficiaryBankVersion.id, bankVersionId))
      .limit(1)
      .for('update')
    if (
      !row ||
      row.bankStatus !== 'verified' ||
      row.bankRetiredAt ||
      row.beneficiaryStatus !== 'verified'
    ) {
      throw new Error('A current verified beneficiary bank version is required')
    }
    return row
  }

  async #loadSources(
    transaction: FinanceTransactionConnection,
    sourceIds: readonly string[]
  ): Promise<SourceContext[]> {
    return transaction
      .select({
        unitAllocationId: unitAllocation.id,
        venueMinor: unitAllocation.venueMinor,
        donationMinor: unitAllocation.donationMinor,
        runStatus: allocationRun.status,
        unitStatus: commerceOrderUnit.lifecycleStatus,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        foundationBeneficiaryId: commerceOrderSnapshot.foundationBeneficiaryId,
        venueId: productOrder.venueId,
        chargeStatus: paymentCharge.status,
        clearedAt: paymentCharge.clearedAt,
      })
      .from(unitAllocation)
      .innerJoin(allocationRun, eq(unitAllocation.allocationRunId, allocationRun.id))
      .innerJoin(commerceOrderUnit, eq(unitAllocation.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .innerJoin(paymentCharge, eq(allocationRun.chargeId, paymentCharge.id))
      .where(inArray(unitAllocation.id, sourceIds))
      .orderBy(unitAllocation.id)
      .for('update')
  }

  async #validateSources(
    transaction: FinanceTransactionConnection,
    input: {
      kind: PayoutKind
      fundingClassification: FundingClassification
    },
    sources: readonly PayoutSource[],
    contexts: readonly SourceContext[],
    beneficiary: { beneficiaryId: string; beneficiaryKind: string; venueId: string | null }
  ): Promise<void> {
    if (
      (input.kind === 'venue_payout' && beneficiary.beneficiaryKind !== 'venue') ||
      (input.kind === 'foundation_payout' && beneficiary.beneficiaryKind !== 'foundation')
    ) {
      throw new Error('Beneficiary kind does not match the payout')
    }
    const contextById = new Map(contexts.map((context) => [context.unitAllocationId, context]))
    const usedRows = await transaction
      .select({
        sourceId: financialOperationAllocation.sourceId,
        used: sql<bigint>`coalesce(sum(${financialOperationAllocation.amountMinor}), 0)`,
      })
      .from(financialOperationAllocation)
      .innerJoin(
        financialOperation,
        eq(financialOperationAllocation.operationId, financialOperation.id)
      )
      .where(
        and(
          inArray(
            financialOperationAllocation.sourceType,
            input.kind === 'venue_payout'
              ? ['unit_allocation', 'venue_unit_allocation']
              : ['foundation_unit_allocation']
          ),
          inArray(
            financialOperationAllocation.sourceId,
            sources.map((source) => source.unitAllocationId)
          ),
          notInArray(financialOperation.status, ['failed', 'cancelled', 'reversed'])
        )
      )
      .groupBy(financialOperationAllocation.sourceId)
    const usedById = new Map(usedRows.map((row) => [row.sourceId, BigInt(row.used)]))

    for (const source of sources) {
      const context = contextById.get(source.unitAllocationId)
      if (!context) throw new Error('Payout source disappeared')
      if (
        context.runStatus !== 'final' ||
        context.unitStatus !== 'redeemed' ||
        context.chargeStatus !== 'approved' ||
        !context.clearedAt ||
        fundingClassification(context.fundingClassification) !== input.fundingClassification
      ) {
        throw new Error('Payout source is not redeemed, final, cleared, and undisputed')
      }
      if (
        (input.kind === 'venue_payout' && context.venueId !== beneficiary.venueId) ||
        (input.kind === 'foundation_payout' &&
          context.foundationBeneficiaryId !== beneficiary.beneficiaryId)
      ) {
        throw new Error('Payout source belongs to a different beneficiary')
      }
      const maximum = input.kind === 'venue_payout' ? context.venueMinor : context.donationMinor
      if ((usedById.get(source.unitAllocationId) ?? BigInt(0)) + source.amountMinor > maximum) {
        throw new Error('Payout source amount is already reserved or consumed')
      }
    }
  }

  async #existing(
    transaction: FinanceTransactionConnection,
    operationKey: string,
    contentHash: string
  ): Promise<PayoutResult | undefined> {
    const [row] = await transaction
      .select({
        operationId: financialOperation.id,
        contentHash: financialOperation.contentHash,
        amountMinor: financialOperation.amountMinor,
        status: financialOperation.status,
      })
      .from(financialOperation)
      .where(eq(financialOperation.operationKey, operationKey))
      .limit(1)
    if (!row) return undefined
    if (row.contentHash !== contentHash) {
      throw new Error('Payout operation key was reused with different content')
    }
    return { ...row, duplicate: true }
  }

  async #loadPayoutOperation(transaction: FinanceTransactionConnection, operationId: string) {
    const [row] = await transaction
      .select({
        operationId: financialOperation.id,
        operationKey: financialOperation.operationKey,
        kind: financialOperation.kind,
        venueId: financialOperation.venueId,
        amountMinor: financialOperation.amountMinor,
        status: financialOperation.status,
        externalReference: financialOperation.externalReference,
        bankEvidenceId: financialOperation.bankEvidenceId,
        destinationFingerprint: financialOperation.destinationFingerprint,
        fundingClassification: financialOperation.fundingClassification,
        beneficiaryId: commerceBeneficiary.id,
      })
      .from(financialOperation)
      .innerJoin(
        beneficiaryBankVersion,
        eq(financialOperation.beneficiaryBankVersionId, beneficiaryBankVersion.id)
      )
      .innerJoin(
        commerceBeneficiary,
        eq(beneficiaryBankVersion.beneficiaryId, commerceBeneficiary.id)
      )
      .where(eq(financialOperation.id, operationId))
      .limit(1)
      .for('update')
    if (!row || (row.kind !== 'venue_payout' && row.kind !== 'foundation_payout')) {
      throw new Error('Payout operation does not exist')
    }
    return {
      ...row,
      kind: row.kind as PayoutKind,
      fundingClassification: fundingClassification(row.fundingClassification ?? ''),
    }
  }

  async #peekPayoutClassification(
    transaction: FinanceTransactionConnection,
    operationId: string
  ): Promise<FundingClassification> {
    const [row] = await transaction
      .select({
        kind: financialOperation.kind,
        fundingClassification: financialOperation.fundingClassification,
      })
      .from(financialOperation)
      .where(eq(financialOperation.id, operationId))
      .limit(1)
    if (!row || (row.kind !== 'venue_payout' && row.kind !== 'foundation_payout')) {
      throw new Error('Payout operation does not exist')
    }
    return fundingClassification(row.fundingClassification ?? '')
  }

  async #audit(
    transaction: FinanceTransactionConnection,
    input: {
      operationId: string
      operationKey: string
      action: string
      actorUserId: string
      previousState?: string
      nextState: string
      detail: Record<string, string | number | boolean | null>
      now: Date
    }
  ): Promise<void> {
    await transaction.insert(financeAuditEvent).values({
      id: createId('fae'),
      entityType: 'financial_operation',
      entityId: input.operationId,
      action: input.action,
      actorUserId: input.actorUserId,
      operationKey: input.operationKey,
      previousState: input.previousState,
      nextState: input.nextState,
      detail: input.detail,
      createdAt: input.now,
    })
  }
}
