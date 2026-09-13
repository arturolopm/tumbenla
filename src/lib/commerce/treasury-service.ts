import 'server-only'

import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  chargeDispute,
  commerceOrderSnapshot,
  financeAccount,
  financeAuditEvent,
  financeEntry,
  financeTransaction,
  financialOperation,
  paymentAttempt,
  paymentCharge,
  treasuryPolicy,
} from '@/database/commerce-schema'
import { createId } from '@/lib/utils/id'
import type { FinanceTransactionConnection } from './finance-ledger'

type CommerceDatabase = typeof db
export type FundingClassification = 'real' | 'sandbox'

export type TreasurySnapshot = Readonly<{
  cashMinor: bigint
  customerRefundCoverageMinor: bigint
  disputeCoverageMinor: bigint
  pendingPayoutMinor: bigint
  minimumOperatingReserveMinor: bigint
  availableForNewPayoutMinor: bigint
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const amount = (value: bigint | string | number | null | undefined): bigint => BigInt(value ?? 0)

const validateClassification = (value: string): FundingClassification => {
  if (value !== 'real' && value !== 'sandbox') throw new Error('Invalid funding classification')
  return value
}

export class TreasuryService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async configurePolicy(input: {
    operationKey: string
    fundingClassification: FundingClassification
    minimumOperatingReserveMinor: bigint
    approvedByUserId: string
  }): Promise<{ policyId: string; version: number; duplicate: boolean }> {
    if (!/^[A-Za-z0-9:_-]{8,180}$/.test(input.operationKey)) {
      throw new Error('A durable treasury policy operation key is required')
    }
    if (input.minimumOperatingReserveMinor < BigInt(0) || input.approvedByUserId.length === 0) {
      throw new Error('Treasury policy values are invalid')
    }
    const contentHash = digest({
      currency: 'COP',
      fundingClassification: input.fundingClassification,
      minimumOperatingReserveMinor: input.minimumOperatingReserveMinor.toString(),
    })
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({
          id: treasuryPolicy.id,
          contentHash: treasuryPolicy.contentHash,
          version: treasuryPolicy.version,
        })
        .from(treasuryPolicy)
        .where(eq(treasuryPolicy.operationKey, input.operationKey))
        .limit(1)
      if (existing) {
        if (existing.contentHash !== contentHash) {
          throw new Error('Treasury operation key was reused with different content')
        }
        return { policyId: existing.id, version: existing.version, duplicate: true }
      }

      const [latest] = await transaction
        .select({ id: treasuryPolicy.id, version: treasuryPolicy.version })
        .from(treasuryPolicy)
        .where(
          and(
            eq(treasuryPolicy.currency, 'COP'),
            eq(treasuryPolicy.fundingClassification, input.fundingClassification)
          )
        )
        .orderBy(desc(treasuryPolicy.version))
        .limit(1)
        .for('update')
      await transaction
        .update(treasuryPolicy)
        .set({ status: 'retired', retiredAt: now })
        .where(
          and(
            eq(treasuryPolicy.currency, 'COP'),
            eq(treasuryPolicy.fundingClassification, input.fundingClassification),
            eq(treasuryPolicy.status, 'active'),
            isNull(treasuryPolicy.retiredAt)
          )
        )
      const policyId = createId('tpy')
      const version = (latest?.version ?? 0) + 1
      await transaction.insert(treasuryPolicy).values({
        id: policyId,
        operationKey: input.operationKey,
        contentHash,
        version,
        currency: 'COP',
        fundingClassification: input.fundingClassification,
        minimumOperatingReserveMinor: input.minimumOperatingReserveMinor,
        status: 'active',
        approvedByUserId: input.approvedByUserId,
        effectiveAt: now,
        createdAt: now,
      })
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'treasury_policy',
        entityId: policyId,
        action: 'treasury_policy_activated',
        actorUserId: input.approvedByUserId,
        operationKey: input.operationKey,
        nextState: 'active',
        detail: {
          version,
          fundingClassification: input.fundingClassification,
          minimumOperatingReserveMinor: input.minimumOperatingReserveMinor.toString(),
        },
        createdAt: now,
      })
      return { policyId, version, duplicate: false }
    })
  }

  async snapshot(fundingClassification: FundingClassification): Promise<TreasurySnapshot> {
    return this.#database.transaction((transaction) =>
      treasurySnapshot(transaction, fundingClassification, false)
    )
  }
}

export const treasurySnapshot = async (
  transaction: FinanceTransactionConnection,
  fundingClassification: FundingClassification,
  lockPolicy: boolean
): Promise<TreasurySnapshot> => {
  const policyQuery = transaction
    .select({ minimum: treasuryPolicy.minimumOperatingReserveMinor })
    .from(treasuryPolicy)
    .where(
      and(
        eq(treasuryPolicy.currency, 'COP'),
        eq(treasuryPolicy.fundingClassification, fundingClassification),
        eq(treasuryPolicy.status, 'active'),
        isNull(treasuryPolicy.retiredAt)
      )
    )
    .limit(1)
  const [policy] = lockPolicy ? await policyQuery.for('update') : await policyQuery
  if (!policy) throw new Error('An active treasury policy is required')

  const [cash] = await transaction
    .select({ value: sql<bigint>`coalesce(sum(${financeEntry.amountMinor}), 0)` })
    .from(financeEntry)
    .innerJoin(financeTransaction, eq(financeEntry.transactionId, financeTransaction.id))
    .innerJoin(financeAccount, eq(financeEntry.accountId, financeAccount.id))
    .where(
      and(
        eq(financeTransaction.status, 'posted'),
        eq(financeAccount.kind, 'platform_cash'),
        eq(financeAccount.currency, 'COP'),
        eq(financeAccount.fundingClassification, fundingClassification)
      )
    )

  const [held] = await transaction
    .select({ value: sql<bigint>`coalesce(sum(${financeEntry.amountMinor}), 0)` })
    .from(financeEntry)
    .innerJoin(financeTransaction, eq(financeEntry.transactionId, financeTransaction.id))
    .innerJoin(financeAccount, eq(financeEntry.accountId, financeAccount.id))
    .where(
      and(
        eq(financeTransaction.status, 'posted'),
        eq(financeAccount.kind, 'customer_funds_held'),
        eq(financeAccount.currency, 'COP'),
        eq(financeAccount.fundingClassification, fundingClassification)
      )
    )

  const [disputes] = await transaction
    .select({ value: sql<bigint>`coalesce(sum(${paymentCharge.grossMinor}), 0)` })
    .from(paymentCharge)
    .innerJoin(paymentAttempt, eq(paymentCharge.attemptId, paymentAttempt.id))
    .innerJoin(commerceOrderSnapshot, eq(paymentAttempt.orderSnapshotId, commerceOrderSnapshot.id))
    .innerJoin(chargeDispute, eq(paymentCharge.id, chargeDispute.chargeId))
    .where(
      and(
        eq(paymentCharge.status, 'disputed'),
        eq(chargeDispute.status, 'open'),
        eq(commerceOrderSnapshot.fundingClassification, fundingClassification)
      )
    )

  const [pending] = await transaction
    .select({ value: sql<bigint>`coalesce(sum(${financialOperation.amountMinor}), 0)` })
    .from(financialOperation)
    .where(
      and(
        inArray(financialOperation.kind, ['venue_payout', 'foundation_payout']),
        inArray(financialOperation.status, ['prepared', 'submitted_unknown']),
        eq(financialOperation.currency, 'COP'),
        eq(financialOperation.fundingClassification, fundingClassification)
      )
    )

  const cashMinor = amount(cash?.value)
  const heldBalance = amount(held?.value)
  const customerRefundCoverageMinor = heldBalance < BigInt(0) ? -heldBalance : BigInt(0)
  const disputeCoverageMinor = amount(disputes?.value)
  const pendingPayoutMinor = amount(pending?.value)
  const minimumOperatingReserveMinor = amount(policy.minimum)

  return {
    cashMinor,
    customerRefundCoverageMinor,
    disputeCoverageMinor,
    pendingPayoutMinor,
    minimumOperatingReserveMinor,
    availableForNewPayoutMinor:
      cashMinor -
      customerRefundCoverageMinor -
      disputeCoverageMinor -
      pendingPayoutMinor -
      minimumOperatingReserveMinor,
  }
}

export const assertPayoutCapacity = async (
  transaction: FinanceTransactionConnection,
  input: {
    fundingClassification: FundingClassification
    additionalPayoutMinor: bigint
  }
): Promise<TreasurySnapshot> => {
  const snapshot = await treasurySnapshot(transaction, input.fundingClassification, true)
  if (snapshot.availableForNewPayoutMinor < input.additionalPayoutMinor) {
    throw new Error('Payout is blocked by refund, dispute, pending-transfer, or reserve coverage')
  }
  return snapshot
}

export const assertRefundLiquidity = async (
  transaction: FinanceTransactionConnection,
  input: { fundingClassification: FundingClassification; amountMinor: bigint }
): Promise<void> => {
  const snapshot = await treasurySnapshot(transaction, input.fundingClassification, true)
  if (snapshot.cashMinor - snapshot.pendingPayoutMinor < input.amountMinor) {
    throw new Error('Refund cannot be confirmed without cleared cash coverage')
  }
}

export const fundingClassification = validateClassification
