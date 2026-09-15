import 'server-only'

import { createHash } from 'node:crypto'
import { and, asc, desc, eq, gt, inArray, notInArray, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationRun,
  commerceOrderSnapshot,
  commerceOrderUnit,
  creditApplication,
  creditDebt,
  financeAuditEvent,
  financialOperation,
  financialOperationAllocation,
  paymentCharge,
  unitAllocation,
  venueCreditPolicy,
} from '@/database/commerce-schema'
import { productOrder, venue } from '@/database/schema'
import { createId } from '@/lib/utils/id'
import { assertReviewedEvidence } from './finance-evidence-service'
import {
  ensureFinanceAccount,
  type FinanceTransactionConnection,
  postFinanceTransaction,
} from './finance-ledger'

type CommerceDatabase = typeof db

export type CreditSettlementResult = Readonly<{
  operationId: string
  amountMinor: bigint
  applications: readonly Readonly<{ debtId: string; amountMinor: bigint }>[]
  duplicate: boolean
}>

type OpenDebt = Readonly<{
  id: string
  outstandingMinor: bigint
}>

type OffsetSource = Readonly<{
  unitAllocationId: string
  amountMinor: bigint
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const validateCommon = (input: {
  operationKey: string
  venueId: string
  amountMinor: bigint
  verifiedByUserId: string
}): void => {
  if (!/^[A-Za-z0-9:_-]{8,180}$/.test(input.operationKey)) {
    throw new Error('A durable credit operation key is required')
  }
  if (input.venueId.length === 0 || input.verifiedByUserId.length === 0) {
    throw new Error('Venue and reviewer are required')
  }
  if (input.amountMinor <= BigInt(0)) throw new Error('Credit settlement amount must be positive')
}

export class CreditSettlementService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async recordVerifiedRepayment(input: {
    operationKey: string
    venueId: string
    amountMinor: bigint
    externalReference: string
    bankEvidenceId: string
    verifiedByUserId: string
  }): Promise<CreditSettlementResult> {
    validateCommon(input)
    if (input.externalReference.trim().length === 0 || input.bankEvidenceId.trim().length === 0) {
      throw new Error('Verified bank reference and evidence are required')
    }
    const contentHash = digest({
      kind: 'credit_repayment',
      venueId: input.venueId,
      amountMinor: input.amountMinor.toString(),
      externalReference: input.externalReference.trim(),
      bankEvidenceId: input.bankEvidenceId.trim(),
    })

    return this.#database.transaction(async (transaction) => {
      await this.#lockVenue(transaction, input.venueId)
      const existing = await this.#existing(transaction, input.operationKey, contentHash)
      if (existing) return existing
      await assertReviewedEvidence(transaction, {
        evidenceId: input.bankEvidenceId.trim(),
        ownerType: 'credit_repayment_reference',
        ownerId: input.externalReference.trim(),
        allowedKinds: ['bank_record'],
      })
      const debts = await this.#loadDebts(transaction, input.venueId)
      this.#assertCoverage(debts, input.amountMinor)
      const now = this.#now()
      const operationId = createId('fop')
      await transaction.insert(financialOperation).values({
        id: operationId,
        operationKey: input.operationKey,
        contentHash,
        kind: 'credit_repayment',
        venueId: input.venueId,
        amountMinor: input.amountMinor,
        currency: 'COP',
        status: 'bank_verified',
        externalReference: input.externalReference.trim(),
        bankEvidenceId: input.bankEvidenceId.trim(),
        requestedByUserId: input.verifiedByUserId,
        verifiedByUserId: input.verifiedByUserId,
        submittedAt: now,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      const applications = await this.#applyOldestFirst(
        transaction,
        operationId,
        debts,
        input.amountMinor,
        now
      )
      const cash = await ensureFinanceAccount(transaction, {
        kind: 'platform_cash',
        ownerKey: 'platform',
        currency: 'COP',
        fundingClassification: 'real',
      })
      const receivable = await ensureFinanceAccount(transaction, {
        kind: 'venue_receivable',
        ownerKey: input.venueId,
        venueId: input.venueId,
        currency: 'COP',
        fundingClassification: 'real',
      })
      await postFinanceTransaction(transaction, {
        operationKey: `credit-repayment:${operationId}`,
        kind: 'credit_repayment',
        currency: 'COP',
        operationId,
        createdByUserId: input.verifiedByUserId,
        entries: [
          { accountId: cash, amountMinor: input.amountMinor },
          { accountId: receivable, amountMinor: -input.amountMinor },
        ],
        now,
      })
      await this.#audit(transaction, operationId, input.operationKey, input, now)
      return { operationId, amountMinor: input.amountMinor, applications, duplicate: false }
    })
  }

  async applyVerifiedOffset(input: {
    operationKey: string
    venueId: string
    amountMinor: bigint
    sources: readonly OffsetSource[]
    verifiedByUserId: string
  }): Promise<CreditSettlementResult> {
    validateCommon(input)
    const sources = [...input.sources].sort((left, right) =>
      left.unitAllocationId.localeCompare(right.unitAllocationId)
    )
    if (
      sources.length === 0 ||
      new Set(sources.map((source) => source.unitAllocationId)).size !== sources.length ||
      sources.some((source) => source.amountMinor <= BigInt(0)) ||
      sources.reduce((sum, source) => sum + source.amountMinor, BigInt(0)) !== input.amountMinor
    ) {
      throw new Error('Offset sources must be unique, positive, and equal the operation amount')
    }
    const contentHash = digest({
      kind: 'credit_offset',
      venueId: input.venueId,
      amountMinor: input.amountMinor.toString(),
      sources: sources.map((source) => ({
        unitAllocationId: source.unitAllocationId,
        amountMinor: source.amountMinor.toString(),
      })),
    })

    return this.#database.transaction(async (transaction) => {
      await this.#lockVenue(transaction, input.venueId)
      const existing = await this.#existing(transaction, input.operationKey, contentHash)
      if (existing) return existing
      await this.#validateOffsetSources(transaction, input.venueId, sources)
      const debts = await this.#loadDebts(transaction, input.venueId)
      this.#assertCoverage(debts, input.amountMinor)
      const now = this.#now()
      const operationId = createId('fop')
      await transaction.insert(financialOperation).values({
        id: operationId,
        operationKey: input.operationKey,
        contentHash,
        kind: 'credit_offset',
        venueId: input.venueId,
        amountMinor: input.amountMinor,
        currency: 'COP',
        status: 'bank_verified',
        requestedByUserId: input.verifiedByUserId,
        verifiedByUserId: input.verifiedByUserId,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await transaction.insert(financialOperationAllocation).values(
        sources.map((source, index) => ({
          id: createId('foa'),
          operationId,
          sourceType: 'unit_allocation',
          sourceId: source.unitAllocationId,
          amountMinor: source.amountMinor,
          ordinal: index + 1,
          createdAt: now,
        }))
      )
      const applications = await this.#applyOldestFirst(
        transaction,
        operationId,
        debts,
        input.amountMinor,
        now
      )
      const payable = await ensureFinanceAccount(transaction, {
        kind: 'venue_payable',
        ownerKey: input.venueId,
        venueId: input.venueId,
        currency: 'COP',
        fundingClassification: 'real',
      })
      const receivable = await ensureFinanceAccount(transaction, {
        kind: 'venue_receivable',
        ownerKey: input.venueId,
        venueId: input.venueId,
        currency: 'COP',
        fundingClassification: 'real',
      })
      await postFinanceTransaction(transaction, {
        operationKey: `credit-offset:${operationId}`,
        kind: 'credit_offset',
        currency: 'COP',
        operationId,
        createdByUserId: input.verifiedByUserId,
        entries: [
          { accountId: payable, amountMinor: input.amountMinor },
          { accountId: receivable, amountMinor: -input.amountMinor },
        ],
        now,
      })
      await this.#audit(transaction, operationId, input.operationKey, input, now)
      return { operationId, amountMinor: input.amountMinor, applications, duplicate: false }
    })
  }

  async #lockVenue(transaction: FinanceTransactionConnection, venueId: string): Promise<void> {
    const [targetVenue] = await transaction
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.id, venueId))
      .limit(1)
      .for('update')
    if (!targetVenue) throw new Error('The venue does not exist')

    const [policy] = await transaction
      .select({ id: venueCreditPolicy.id })
      .from(venueCreditPolicy)
      .where(and(eq(venueCreditPolicy.venueId, venueId), eq(venueCreditPolicy.currency, 'COP')))
      .orderBy(desc(venueCreditPolicy.version))
      .limit(1)
      .for('update')
    if (!policy) throw new Error('The venue has no credit policy to settle')
  }

  async #existing(
    transaction: FinanceTransactionConnection,
    operationKey: string,
    contentHash: string
  ): Promise<CreditSettlementResult | undefined> {
    const [operation] = await transaction
      .select({
        id: financialOperation.id,
        contentHash: financialOperation.contentHash,
        amountMinor: financialOperation.amountMinor,
      })
      .from(financialOperation)
      .where(eq(financialOperation.operationKey, operationKey))
      .limit(1)
    if (!operation) return undefined
    if (operation.contentHash !== contentHash) {
      throw new Error('Credit operation key was reused with different content')
    }
    const applications = await transaction
      .select({ debtId: creditApplication.debtId, amountMinor: creditApplication.amountMinor })
      .from(creditApplication)
      .where(eq(creditApplication.operationId, operation.id))
      .orderBy(creditApplication.ordinal)
    return {
      operationId: operation.id,
      amountMinor: operation.amountMinor,
      applications,
      duplicate: true,
    }
  }

  async #loadDebts(
    transaction: FinanceTransactionConnection,
    venueId: string
  ): Promise<OpenDebt[]> {
    return transaction
      .select({ id: creditDebt.id, outstandingMinor: creditDebt.outstandingMinor })
      .from(creditDebt)
      .where(
        and(
          eq(creditDebt.venueId, venueId),
          eq(creditDebt.currency, 'COP'),
          gt(creditDebt.outstandingMinor, BigInt(0))
        )
      )
      .orderBy(asc(creditDebt.incurredAt), asc(creditDebt.id))
      .for('update')
  }

  #assertCoverage(debts: readonly OpenDebt[], amountMinor: bigint): void {
    if (debts.reduce((sum, debt) => sum + debt.outstandingMinor, BigInt(0)) < amountMinor) {
      throw new Error('Credit settlement exceeds the venue outstanding debt')
    }
  }

  async #applyOldestFirst(
    transaction: FinanceTransactionConnection,
    operationId: string,
    debts: readonly OpenDebt[],
    amountMinor: bigint,
    now: Date
  ): Promise<readonly Readonly<{ debtId: string; amountMinor: bigint }>[]> {
    let remaining = amountMinor
    const applications: { debtId: string; amountMinor: bigint }[] = []
    for (const debt of debts) {
      if (remaining === BigInt(0)) break
      const applied = debt.outstandingMinor < remaining ? debt.outstandingMinor : remaining
      const nextOutstanding = debt.outstandingMinor - applied
      await transaction
        .update(creditDebt)
        .set({
          outstandingMinor: nextOutstanding,
          settledAt: nextOutstanding === BigInt(0) ? now : null,
          updatedAt: now,
        })
        .where(eq(creditDebt.id, debt.id))
      applications.push({ debtId: debt.id, amountMinor: applied })
      remaining -= applied
    }
    await transaction.insert(creditApplication).values(
      applications.map((application, index) => ({
        id: createId('cap'),
        operationId,
        debtId: application.debtId,
        amountMinor: application.amountMinor,
        ordinal: index + 1,
        createdAt: now,
      }))
    )
    return applications
  }

  async #validateOffsetSources(
    transaction: FinanceTransactionConnection,
    venueId: string,
    sources: readonly OffsetSource[]
  ): Promise<void> {
    const rows = await transaction
      .select({
        id: unitAllocation.id,
        venueMinor: unitAllocation.venueMinor,
        lifecycleStatus: commerceOrderUnit.lifecycleStatus,
        venueId: productOrder.venueId,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        runStatus: allocationRun.status,
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
      .where(
        inArray(
          unitAllocation.id,
          sources.map((source) => source.unitAllocationId)
        )
      )
      .for('update')
    if (rows.length !== sources.length) throw new Error('One or more offset sources do not exist')

    for (const source of sources) {
      const row = rows.find((candidate) => candidate.id === source.unitAllocationId)
      if (
        !row ||
        row.venueId !== venueId ||
        row.fundingClassification !== 'real' ||
        row.runStatus !== 'final' ||
        row.lifecycleStatus !== 'redeemed' ||
        row.chargeStatus !== 'approved' ||
        !row.clearedAt
      ) {
        throw new Error('Offset sources must be cleared, final, real, and redeemed for this venue')
      }
      const [used] = await transaction
        .select({
          amount: sql<string>`coalesce(sum(${financialOperationAllocation.amountMinor}), 0)`,
        })
        .from(financialOperationAllocation)
        .innerJoin(
          financialOperation,
          eq(financialOperationAllocation.operationId, financialOperation.id)
        )
        .where(
          and(
            inArray(financialOperationAllocation.sourceType, [
              'unit_allocation',
              'venue_unit_allocation',
            ]),
            eq(financialOperationAllocation.sourceId, source.unitAllocationId),
            notInArray(financialOperation.status, ['failed', 'cancelled', 'reversed'])
          )
        )
      if (BigInt(used?.amount ?? 0) + source.amountMinor > row.venueMinor) {
        throw new Error('An offset source amount was already consumed or exceeds cleared earnings')
      }
    }
  }

  async #audit(
    transaction: FinanceTransactionConnection,
    operationId: string,
    operationKey: string,
    input: { venueId: string; amountMinor: bigint; verifiedByUserId: string },
    now: Date
  ): Promise<void> {
    await transaction.insert(financeAuditEvent).values({
      id: createId('fae'),
      entityType: 'financial_operation',
      entityId: operationId,
      action: 'bank_verified',
      actorUserId: input.verifiedByUserId,
      operationKey,
      previousState: 'prepared',
      nextState: 'bank_verified',
      detail: { venueId: input.venueId, amountMinor: input.amountMinor.toString() },
      createdAt: now,
    })
  }
}
