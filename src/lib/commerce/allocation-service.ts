import 'server-only'

import { createHash } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationRun,
  chargeDeduction,
  commerceOrderSnapshot,
  commerceOrderUnit,
  paymentAttempt,
  paymentCharge,
  unitAllocation,
} from '@/database/commerce-schema'
import { productOrder } from '@/database/schema'
import { createId } from '@/lib/utils/id'
import { allocateNetProceeds, type DeductionInput, type UnitAllocation } from './allocation'
import { assertReviewedEvidence } from './finance-evidence-service'
import {
  ensureFinanceAccount,
  type FinanceTransactionConnection,
  postFinanceTransaction,
} from './finance-ledger'
import { decimalString, type MinorUnits } from './money'

type CommerceDatabase = typeof db
type FundingClassification = 'real' | 'sandbox'

export type ReconciledDeduction = Readonly<{
  externalKey: string
  kind: DeductionInput['kind']
  amount: string
  finality: DeductionInput['finality']
  evidenceId?: string
}>

export type ReconcileChargeInput = Readonly<{
  chargeId: string
  operationKey: string
  deductions: readonly ReconciledDeduction[]
  createdByUserId?: string
}>

export type ReconcileChargeResult = Readonly<{
  allocationRunId: string
  revision: number
  grossMinor: bigint
  deductionMinor: bigint
  netMinor: bigint
  duplicate: boolean
  units: readonly UnitAllocation[]
}>

type AllocationContext = Readonly<{
  chargeId: string
  provider: string
  merchantAccountKey: string
  environment: string
  chargeStatus: string
  chargeGrossMinor: bigint
  chargeCurrency: string
  snapshotId: string
  policyId: string | null
  foundationBeneficiaryId: string | null
  donationBasisPoints: number
  venueId: string
  fundingClassification: string
}>

type PersistedUnitAllocation = Readonly<{
  unitId: string
  ordinal: number
  grossMinor: bigint
  deductionMinor: bigint
  netMinor: bigint
  donationMinor: bigint
  venueMinor: bigint
  lifecycleStatus: string
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const fundingClassification = (value: string): FundingClassification => {
  if (value !== 'real' && value !== 'sandbox') {
    throw new Error('Legacy or unknown funds cannot enter a new allocation run')
  }
  return value
}

const validateInput = (input: ReconcileChargeInput): readonly ReconciledDeduction[] => {
  if (!/^[A-Za-z0-9:_-]{8,180}$/.test(input.operationKey)) {
    throw new Error('A durable allocation operation key is required')
  }
  if (input.chargeId.length === 0) throw new Error('A charge is required')
  if (input.deductions.length > 64) throw new Error('Too many deduction lines')

  const deductions = [...input.deductions].sort((left, right) =>
    left.externalKey.localeCompare(right.externalKey)
  )
  if (
    deductions.some(
      (line) => !/^[A-Za-z0-9:_.-]{1,120}$/.test(line.externalKey) || line.evidenceId?.length === 0
    )
  ) {
    throw new Error('Every deduction requires a stable external key')
  }
  if (new Set(deductions.map((line) => line.externalKey)).size !== deductions.length) {
    throw new Error('Deduction external keys must be unique within a report')
  }
  for (const line of deductions) decimalString(line.amount)
  return deductions
}

const inputDigest = (input: ReconcileChargeInput, deductions: readonly ReconciledDeduction[]) =>
  digest({
    chargeId: input.chargeId,
    deductions: deductions.map((line) => ({
      externalKey: line.externalKey,
      kind: line.kind,
      amount: line.amount,
      finality: line.finality,
      evidenceId: line.evidenceId ?? null,
    })),
  })

const toUnitAllocation = (row: PersistedUnitAllocation): UnitAllocation => ({
  unitId: row.unitId,
  ordinal: row.ordinal,
  grossMinor: row.grossMinor as MinorUnits,
  deductionMinor: row.deductionMinor as MinorUnits,
  netMinor: row.netMinor as MinorUnits,
  donationMinor: row.donationMinor as MinorUnits,
  venueMinor: row.venueMinor as MinorUnits,
})

export class AllocationService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async reconcileCharge(input: ReconcileChargeInput): Promise<ReconcileChargeResult> {
    const deductions = validateInput(input)
    const reportDigest = inputDigest(input, deductions)
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const context = await this.#loadContext(transaction, input.chargeId)
      if (!context) throw new Error('The approved charge does not exist')
      if (context.chargeStatus !== 'approved')
        throw new Error('Only approved charges can reconcile')
      if (context.chargeCurrency !== 'COP') throw new Error('Only COP charges can reconcile')
      if (!context.policyId || !context.foundationBeneficiaryId) {
        throw new Error('The immutable order is missing its allocation bindings')
      }
      for (const line of deductions) {
        if (line.finality === 'estimated') continue
        if (!line.evidenceId) {
          throw new Error('Final deduction lines require reviewed provider evidence')
        }
        await assertReviewedEvidence(transaction, {
          evidenceId: line.evidenceId,
          ownerType: 'payment_charge',
          ownerId: context.chargeId,
          allowedKinds: ['deduction_report', 'provider_settlement_report'],
        })
      }

      const [sameOperation] = await transaction
        .select({
          id: allocationRun.id,
          inputDigest: allocationRun.inputDigest,
          revision: allocationRun.revision,
          grossMinor: allocationRun.grossMinor,
          deductionMinor: allocationRun.deductionMinor,
          netMinor: allocationRun.netMinor,
        })
        .from(allocationRun)
        .where(eq(allocationRun.operationKey, input.operationKey))
        .limit(1)

      if (sameOperation) {
        if (sameOperation.inputDigest !== reportDigest) {
          throw new Error('Allocation operation key was reused with different content')
        }
        return {
          allocationRunId: sameOperation.id,
          revision: sameOperation.revision,
          grossMinor: sameOperation.grossMinor,
          deductionMinor: sameOperation.deductionMinor,
          netMinor: sameOperation.netMinor,
          duplicate: true,
          units: await this.#loadRunAllocations(transaction, sameOperation.id),
        }
      }

      const units = await transaction
        .select({
          id: commerceOrderUnit.id,
          ordinal: commerceOrderUnit.ordinal,
          grossMinor: commerceOrderUnit.grossMinor,
          lifecycleStatus: commerceOrderUnit.lifecycleStatus,
        })
        .from(commerceOrderUnit)
        .where(eq(commerceOrderUnit.orderSnapshotId, context.snapshotId))
        .orderBy(commerceOrderUnit.ordinal)
        .for('update')
      if (units.length === 0) throw new Error('The immutable order has no units')

      const [previousRun] = await transaction
        .select({
          id: allocationRun.id,
          revision: allocationRun.revision,
          grossMinor: allocationRun.grossMinor,
          deductionMinor: allocationRun.deductionMinor,
          netMinor: allocationRun.netMinor,
        })
        .from(allocationRun)
        .where(
          and(
            eq(allocationRun.orderSnapshotId, context.snapshotId),
            eq(allocationRun.status, 'final')
          )
        )
        .orderBy(desc(allocationRun.revision))
        .limit(1)
        .for('update')

      const previousAllocations = previousRun
        ? await this.#loadRunAllocations(transaction, previousRun.id)
        : []
      const allocations = allocateNetProceeds({
        units: units.map((unit) => ({
          id: unit.id,
          ordinal: unit.ordinal,
          grossMinor: unit.grossMinor as MinorUnits,
        })),
        deductions: deductions.map((line) => ({
          amount: decimalString(line.amount),
          kind: line.kind,
          finality: line.finality,
        })),
        donationBasisPoints: context.donationBasisPoints,
      })
      const grossMinor = allocations.reduce((sum, unit) => sum + unit.grossMinor, BigInt(0))
      const deductionMinor = allocations.reduce((sum, unit) => sum + unit.deductionMinor, BigInt(0))
      const netMinor = grossMinor - deductionMinor
      if (grossMinor !== context.chargeGrossMinor) {
        throw new Error('Charge gross does not match immutable order units')
      }

      const revision = (previousRun?.revision ?? 0) + 1
      const runId = createId('alr')
      await transaction.insert(allocationRun).values({
        id: runId,
        orderSnapshotId: context.snapshotId,
        chargeId: context.chargeId,
        policyId: context.policyId,
        revision,
        operationKey: input.operationKey,
        inputDigest: reportDigest,
        grossMinor,
        deductionMinor,
        netMinor,
        status: 'final',
        supersedesId: previousRun?.id,
        createdAt: now,
      })
      if (previousRun) {
        await transaction
          .update(allocationRun)
          .set({ status: 'superseded' })
          .where(eq(allocationRun.id, previousRun.id))
      }

      if (deductions.length > 0) {
        await transaction.insert(chargeDeduction).values(
          deductions.map((line) => ({
            id: createId('cdd'),
            chargeId: context.chargeId,
            externalKey: line.externalKey,
            revision,
            kind: line.kind,
            reportedAmount: line.amount,
            currency: 'COP',
            finality: line.finality,
            evidenceId: line.evidenceId,
            createdAt: now,
          }))
        )
      }
      await transaction.insert(unitAllocation).values(
        allocations.map((unit) => ({
          id: createId('ual'),
          allocationRunId: runId,
          unitId: unit.unitId,
          grossMinor: unit.grossMinor,
          deductionMinor: unit.deductionMinor,
          netMinor: unit.netMinor,
          donationMinor: unit.donationMinor,
          venueMinor: unit.venueMinor,
          createdAt: now,
        }))
      )

      const classification = fundingClassification(context.fundingClassification)
      await this.#postClearing(transaction, {
        context,
        runId,
        grossMinor,
        deductionMinor,
        netMinor,
        previousRun,
        classification,
        createdByUserId: input.createdByUserId,
        now,
      })

      const previousByUnit = new Map(previousAllocations.map((unit) => [unit.unitId, unit]))
      for (const unit of units) {
        if (unit.lifecycleStatus !== 'redeemed') continue
        const allocation = allocations.find((current) => current.unitId === unit.id)
        if (!allocation) throw new Error('The final allocation is missing a redeemed unit')
        await postUnitDistribution(transaction, {
          runId,
          allocation,
          previous: previousByUnit.get(unit.id),
          snapshotId: context.snapshotId,
          foundationBeneficiaryId: context.foundationBeneficiaryId,
          venueId: context.venueId,
          chargeId: context.chargeId,
          classification,
          createdByUserId: input.createdByUserId,
          now,
        })
      }

      await transaction
        .update(paymentCharge)
        .set({ clearedAt: now })
        .where(eq(paymentCharge.id, context.chargeId))

      return {
        allocationRunId: runId,
        revision,
        grossMinor,
        deductionMinor,
        netMinor,
        duplicate: false,
        units: allocations,
      }
    })
  }

  async #loadContext(
    transaction: FinanceTransactionConnection,
    chargeId: string
  ): Promise<AllocationContext | undefined> {
    const [row] = await transaction
      .select({
        chargeId: paymentCharge.id,
        provider: paymentCharge.provider,
        merchantAccountKey: paymentCharge.merchantAccountKey,
        environment: paymentCharge.environment,
        chargeStatus: paymentCharge.status,
        chargeGrossMinor: paymentCharge.grossMinor,
        chargeCurrency: paymentCharge.currency,
        snapshotId: commerceOrderSnapshot.id,
        policyId: commerceOrderSnapshot.allocationPolicyId,
        foundationBeneficiaryId: commerceOrderSnapshot.foundationBeneficiaryId,
        donationBasisPoints: commerceOrderSnapshot.donationBasisPoints,
        venueId: productOrder.venueId,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
      })
      .from(paymentCharge)
      .innerJoin(paymentAttempt, eq(paymentCharge.attemptId, paymentAttempt.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(paymentAttempt.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .where(eq(paymentCharge.id, chargeId))
      .limit(1)
      .for('update')
    return row
  }

  async #loadRunAllocations(
    transaction: FinanceTransactionConnection,
    runId: string
  ): Promise<UnitAllocation[]> {
    const rows = await transaction
      .select({
        unitId: unitAllocation.unitId,
        ordinal: commerceOrderUnit.ordinal,
        grossMinor: unitAllocation.grossMinor,
        deductionMinor: unitAllocation.deductionMinor,
        netMinor: unitAllocation.netMinor,
        donationMinor: unitAllocation.donationMinor,
        venueMinor: unitAllocation.venueMinor,
        lifecycleStatus: commerceOrderUnit.lifecycleStatus,
      })
      .from(unitAllocation)
      .innerJoin(commerceOrderUnit, eq(unitAllocation.unitId, commerceOrderUnit.id))
      .where(eq(unitAllocation.allocationRunId, runId))
      .orderBy(commerceOrderUnit.ordinal)
    return rows.map(toUnitAllocation)
  }

  async #postClearing(
    transaction: FinanceTransactionConnection,
    input: {
      context: AllocationContext
      runId: string
      grossMinor: bigint
      deductionMinor: bigint
      netMinor: bigint
      previousRun?: {
        id: string
        grossMinor: bigint
        deductionMinor: bigint
        netMinor: bigint
      }
      classification: FundingClassification
      createdByUserId?: string
      now: Date
    }
  ): Promise<void> {
    const cash = await ensureFinanceAccount(transaction, {
      kind: 'platform_cash',
      ownerKey: 'platform',
      currency: 'COP',
      fundingClassification: input.classification,
    })
    const deductions = await ensureFinanceAccount(transaction, {
      kind: 'gateway_deductions',
      ownerKey: input.context.chargeId,
      currency: 'COP',
      fundingClassification: input.classification,
    })

    if (!input.previousRun) {
      const receivable = await ensureFinanceAccount(transaction, {
        kind: 'gateway_receivable',
        ownerKey: `${input.context.provider}:${input.context.merchantAccountKey}:${input.context.environment}`,
        currency: 'COP',
        fundingClassification: input.classification,
      })
      await postFinanceTransaction(transaction, {
        operationKey: `charge-clearing:${input.runId}`,
        kind: 'charge_cleared',
        currency: 'COP',
        orderSnapshotId: input.context.snapshotId,
        createdByUserId: input.createdByUserId,
        entries: [
          { accountId: receivable, amountMinor: -input.grossMinor },
          { accountId: cash, amountMinor: input.netMinor },
          { accountId: deductions, amountMinor: input.deductionMinor },
        ],
        now: input.now,
      })
      return
    }

    const cashDelta = input.netMinor - input.previousRun.netMinor
    const deductionDelta = input.deductionMinor - input.previousRun.deductionMinor
    if (cashDelta === BigInt(0) && deductionDelta === BigInt(0)) return
    await postFinanceTransaction(transaction, {
      operationKey: `charge-clearing-adjustment:${input.runId}`,
      kind: 'charge_clearing_adjustment',
      currency: 'COP',
      orderSnapshotId: input.context.snapshotId,
      createdByUserId: input.createdByUserId,
      entries: [
        { accountId: cash, amountMinor: cashDelta },
        { accountId: deductions, amountMinor: deductionDelta },
      ],
      now: input.now,
    })
  }
}

export const postUnitDistribution = async (
  transaction: FinanceTransactionConnection,
  input: {
    runId: string
    allocation: UnitAllocation
    previous?: UnitAllocation
    snapshotId: string
    foundationBeneficiaryId: string
    venueId: string
    chargeId: string
    classification: FundingClassification
    createdByUserId?: string
    now: Date
  }
): Promise<void> => {
  const foundation = await ensureFinanceAccount(transaction, {
    kind: 'foundation_payable',
    ownerKey: input.foundationBeneficiaryId,
    currency: 'COP',
    fundingClassification: input.classification,
  })
  const venue = await ensureFinanceAccount(transaction, {
    kind: 'venue_payable',
    ownerKey: input.venueId,
    venueId: input.venueId,
    currency: 'COP',
    fundingClassification: input.classification,
  })
  const deductions = await ensureFinanceAccount(transaction, {
    kind: 'gateway_deductions',
    ownerKey: input.chargeId,
    currency: 'COP',
    fundingClassification: input.classification,
  })

  if (!input.previous) {
    const held = await ensureFinanceAccount(transaction, {
      kind: 'customer_funds_held',
      ownerKey: input.snapshotId,
      currency: 'COP',
      fundingClassification: input.classification,
    })
    await postFinanceTransaction(transaction, {
      operationKey: `unit-distribution:${input.allocation.unitId}`,
      kind: 'unit_distribution',
      currency: 'COP',
      orderSnapshotId: input.snapshotId,
      createdByUserId: input.createdByUserId,
      entries: [
        { accountId: held, amountMinor: input.allocation.grossMinor },
        { accountId: foundation, amountMinor: -input.allocation.donationMinor },
        { accountId: venue, amountMinor: -input.allocation.venueMinor },
        { accountId: deductions, amountMinor: -input.allocation.deductionMinor },
      ],
      now: input.now,
    })
    return
  }

  const foundationDelta = input.allocation.donationMinor - input.previous.donationMinor
  const venueDelta = input.allocation.venueMinor - input.previous.venueMinor
  const deductionDelta = input.allocation.deductionMinor - input.previous.deductionMinor
  if (foundationDelta === BigInt(0) && venueDelta === BigInt(0) && deductionDelta === BigInt(0)) {
    return
  }
  await postFinanceTransaction(transaction, {
    operationKey: `unit-distribution-adjustment:${input.allocation.unitId}:${input.runId}`,
    kind: 'unit_distribution_adjustment',
    currency: 'COP',
    orderSnapshotId: input.snapshotId,
    createdByUserId: input.createdByUserId,
    entries: [
      { accountId: foundation, amountMinor: -foundationDelta },
      { accountId: venue, amountMinor: -venueDelta },
      { accountId: deductions, amountMinor: -deductionDelta },
    ],
    now: input.now,
  })
}
