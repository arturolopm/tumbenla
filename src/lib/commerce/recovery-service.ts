import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  financeAuditEvent,
  commerceRateLimit,
  financeEntry,
  financeEvidence,
  financeTransaction,
  foundationPurchase,
  paymentAttempt,
  recoveryCheckpoint,
} from '@/database/commerce-schema'
import { materialPurchase } from '@/database/schema'
import { createId } from '@/lib/utils/id'
import type { PaymentReconciliationResult } from './payment-service'
import type { CommerceUnitService, ExpireUnitsResult } from './unit-lifecycle-service'

type CommerceDatabase = typeof db

type RecoveryPayments = Readonly<{
  reconcileAttempt: (input: {
    attemptId: string
    reference: string
  }) => Promise<PaymentReconciliationResult>
}>

type RecoveryUnits = Pick<CommerceUnitService, 'expireDueUnits'>

export type CommerceRecoveryResult = Readonly<{
  status: 'completed' | 'completed_with_errors' | 'overlap'
  attemptsReviewed: number
  attemptsRecovered: number
  attemptsEscalated: number
  attemptBacklog: number
  units: ExpireUnitsResult
  integrityIssues: number
  errors: readonly string[]
}>

const EMPTY_EXPIRY: ExpireUnitsResult = {
  reviewed: 0,
  expired: 0,
  retainedMinor: BigInt(0),
  errors: [],
}

export class CommerceRecoveryService {
  readonly #database: CommerceDatabase
  readonly #payments: RecoveryPayments
  readonly #units: RecoveryUnits
  readonly #now: () => Date
  readonly #owner: () => string

  constructor(dependencies: {
    database: CommerceDatabase
    payments: RecoveryPayments
    units: RecoveryUnits
    now?: () => Date
    owner?: () => string
  }) {
    this.#database = dependencies.database
    this.#payments = dependencies.payments
    this.#units = dependencies.units
    this.#now = dependencies.now ?? (() => new Date())
    this.#owner = dependencies.owner ?? randomUUID
  }

  async run(
    input: { batchSize?: number; staleAfterSeconds?: number } = {}
  ): Promise<CommerceRecoveryResult> {
    const batchSize = Math.min(Math.max(input.batchSize ?? 100, 1), 500)
    const staleAfterSeconds = Math.min(Math.max(input.staleAfterSeconds ?? 300, 60), 86_400)
    const now = this.#now()
    const owner = this.#owner()
    const leaseExpiresAt = new Date(now.getTime() + 4 * 60_000)
    const acquired = await this.#database.transaction(async (transaction) => {
      await transaction
        .insert(recoveryCheckpoint)
        .values({
          id: createId('rcp'),
          job: 'commerce_daily',
          scope: 'global',
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [recoveryCheckpoint.job, recoveryCheckpoint.scope],
        })
      return transaction
        .update(recoveryCheckpoint)
        .set({ leaseOwner: owner, leaseExpiresAt, lastStartedAt: now, updatedAt: now })
        .where(
          and(
            eq(recoveryCheckpoint.job, 'commerce_daily'),
            eq(recoveryCheckpoint.scope, 'global'),
            or(
              isNull(recoveryCheckpoint.leaseExpiresAt),
              lte(recoveryCheckpoint.leaseExpiresAt, now),
              eq(recoveryCheckpoint.leaseOwner, owner)
            )
          )
        )
        .returning({ id: recoveryCheckpoint.id })
    })
    if (acquired.length === 0) {
      return {
        status: 'overlap',
        attemptsReviewed: 0,
        attemptsRecovered: 0,
        attemptsEscalated: 0,
        attemptBacklog: 0,
        units: EMPTY_EXPIRY,
        integrityIssues: 0,
        errors: [],
      }
    }

    const errors: string[] = []
    let attemptsReviewed = 0
    let attemptsRecovered = 0
    let attemptsEscalated = 0
    let units = EMPTY_EXPIRY
    let integrityIssues = 0
    let cursor: string | null = null
    try {
      const staleBefore = new Date(now.getTime() - staleAfterSeconds * 1_000)
      const attempts = await this.#database
        .select({
          id: paymentAttempt.id,
          reference: paymentAttempt.providerAttemptReference,
          createdAt: paymentAttempt.createdAt,
        })
        .from(paymentAttempt)
        .where(
          and(
            inArray(paymentAttempt.status, ['created', 'submitted', 'pending', 'uncertain']),
            lte(paymentAttempt.updatedAt, staleBefore)
          )
        )
        .orderBy(asc(paymentAttempt.updatedAt), asc(paymentAttempt.id))
        .limit(batchSize)

      for (const attempt of attempts) {
        cursor = attempt.id
        attemptsReviewed += 1
        if (!attempt.reference) {
          await this.#escalateMissingReference(attempt.id, now)
          attemptsEscalated += 1
          continue
        }
        try {
          const outcome = await this.#payments.reconcileAttempt({
            attemptId: attempt.id,
            reference: attempt.reference,
          })
          if (outcome.kind === 'applied') attemptsRecovered += 1
          if (outcome.kind === 'retryable') {
            errors.push(`${attempt.id}: ${outcome.reason ?? 'provider lookup retryable'}`)
          }
        } catch (error) {
          errors.push(
            `${attempt.id}: ${error instanceof Error ? error.message : 'recovery failed'}`
          )
        }
      }

      units = await this.#units.expireDueUnits({ now, limit: batchSize })
      errors.push(...units.errors.map((error) => `unit: ${error}`))
      await this.#database.delete(commerceRateLimit).where(lte(commerceRateLimit.expiresAt, now))
      const integrity = await this.#integrityIssues()
      integrityIssues = integrity.length
      errors.push(...integrity.map((issue) => `integrity: ${issue}`))

      const [backlog] = await this.#database
        .select({ value: sql<number>`count(*)` })
        .from(paymentAttempt)
        .where(
          and(
            inArray(paymentAttempt.status, ['created', 'submitted', 'pending', 'uncertain']),
            lte(paymentAttempt.updatedAt, staleBefore)
          )
        )
      const attemptBacklog = Number(backlog?.value ?? 0)
      await this.#database
        .update(recoveryCheckpoint)
        .set({
          cursor,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastSucceededAt: errors.length === 0 ? now : undefined,
          lastError: errors.length === 0 ? null : errors.slice(0, 10).join('\n'),
          updatedAt: now,
        })
        .where(
          and(
            eq(recoveryCheckpoint.job, 'commerce_daily'),
            eq(recoveryCheckpoint.scope, 'global'),
            eq(recoveryCheckpoint.leaseOwner, owner)
          )
        )
      return {
        status: errors.length === 0 ? 'completed' : 'completed_with_errors',
        attemptsReviewed,
        attemptsRecovered,
        attemptsEscalated,
        attemptBacklog,
        units,
        integrityIssues,
        errors,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'commerce recovery failed'
      errors.push(message)
      await this.#database
        .update(recoveryCheckpoint)
        .set({
          cursor,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: errors.slice(0, 10).join('\n'),
          updatedAt: now,
        })
        .where(
          and(
            eq(recoveryCheckpoint.job, 'commerce_daily'),
            eq(recoveryCheckpoint.scope, 'global'),
            eq(recoveryCheckpoint.leaseOwner, owner)
          )
        )
      return {
        status: 'completed_with_errors',
        attemptsReviewed,
        attemptsRecovered,
        attemptsEscalated,
        attemptBacklog: 0,
        units,
        integrityIssues,
        errors,
      }
    }
  }

  async #escalateMissingReference(attemptId: string, now: Date): Promise<void> {
    await this.#database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(paymentAttempt)
        .set({
          status: 'operator_review',
          outcomeDetail: 'missing-provider-reference',
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(paymentAttempt.id, attemptId),
            inArray(paymentAttempt.status, ['created', 'submitted', 'pending', 'uncertain']),
            isNull(paymentAttempt.providerAttemptReference)
          )
        )
        .returning({ id: paymentAttempt.id })
      if (!updated) return
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'payment_attempt',
        entityId: attemptId,
        action: 'operator_review_required',
        previousState: 'non_terminal',
        nextState: 'operator_review',
        detail: { reason: 'missing-provider-reference' },
        createdAt: now,
      })
    })
  }

  async #integrityIssues(): Promise<string[]> {
    const [unbalanced, unsafeEvidence, unsafePurchases] = await Promise.all([
      this.#database
        .select({
          id: financeTransaction.id,
          balance: sql<bigint>`coalesce(sum(${financeEntry.amountMinor}), 0)`,
          entries: sql<number>`count(${financeEntry.id})`,
        })
        .from(financeTransaction)
        .leftJoin(financeEntry, eq(financeTransaction.id, financeEntry.transactionId))
        .where(eq(financeTransaction.status, 'posted'))
        .groupBy(financeTransaction.id)
        .having(
          sql`count(${financeEntry.id}) < 2 or coalesce(sum(${financeEntry.amountMinor}), 0) <> 0`
        )
        .limit(20),
      this.#database
        .select({ id: financeEvidence.id })
        .from(financeEvidence)
        .where(
          and(
            inArray(financeEvidence.status, ['published', 'withdrawn']),
            or(
              isNull(financeEvidence.publicRedactedStorageKey),
              isNull(financeEvidence.publicRedactedSha256),
              isNull(financeEvidence.publicRedactedSize),
              isNull(financeEvidence.publicRedactedContentType),
              eq(
                financeEvidence.publicRedactedStorageKey,
                financeEvidence.retainedPrivateStorageKey
              )
            )
          )
        )
        .limit(20),
      this.#database
        .select({ id: foundationPurchase.id })
        .from(foundationPurchase)
        .innerJoin(materialPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
        .leftJoin(financeEvidence, eq(foundationPurchase.receiptEvidenceId, financeEvidence.id))
        .where(
          and(
            eq(materialPurchase.status, 'published'),
            or(
              sql`${foundationPurchase.status} <> 'verified'`,
              sql`${financeEvidence.status} is distinct from 'published'`,
              sql`${financeEvidence.ownerType} is distinct from 'foundation_purchase'`,
              sql`${financeEvidence.ownerId} is distinct from ${foundationPurchase.id}`,
              sql`${financeEvidence.kind} is distinct from 'purchase_receipt'`
            )
          )
        )
        .limit(20),
    ])
    return [
      ...unbalanced.map((row) => `unbalanced posted transaction ${row.id}`),
      ...unsafeEvidence.map((row) => `unsafe public evidence ${row.id}`),
      ...unsafePurchases.map((row) => `unverified public purchase ${row.id}`),
    ]
  }
}
