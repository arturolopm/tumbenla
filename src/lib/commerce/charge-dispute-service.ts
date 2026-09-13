import 'server-only'

import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'

import type { db } from '@/database'
import {
  chargeDispute,
  commerceOrderSnapshot,
  financeAuditEvent,
  paymentAttempt,
  paymentCharge,
} from '@/database/commerce-schema'
import { createId } from '@/lib/utils/id'
import { assertReviewedEvidence } from './finance-evidence-service'
import { ensureFinanceAccount, postFinanceTransaction } from './finance-ledger'
import { fundingClassification } from './treasury-service'

type CommerceDatabase = typeof db

export type ChargeDisputeResult = Readonly<{
  disputeId: string
  chargeId: string
  status: 'open' | 'won' | 'lost'
  duplicate: boolean
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const validateOperationKey = (value: string): void => {
  if (!/^[A-Za-z0-9:_-]{8,180}$/.test(value)) {
    throw new Error('A durable dispute operation key is required')
  }
}

const required = (value: string, label: string): string => {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 500) {
    throw new Error(`${label} is required`)
  }
  return normalized
}

export class ChargeDisputeService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async open(input: {
    operationKey: string
    chargeId: string
    providerCaseReference: string
    reason: string
    evidenceId: string
    openedByUserId: string
  }): Promise<ChargeDisputeResult> {
    validateOperationKey(input.operationKey)
    const providerCaseReference = required(input.providerCaseReference, 'Provider case reference')
    const reason = required(input.reason, 'Dispute reason')
    const contentHash = digest({
      chargeId: input.chargeId,
      providerCaseReference,
      reason,
      evidenceId: input.evidenceId,
    })
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({
          id: chargeDispute.id,
          chargeId: chargeDispute.chargeId,
          status: chargeDispute.status,
          contentHash: chargeDispute.contentHash,
        })
        .from(chargeDispute)
        .where(eq(chargeDispute.operationKey, input.operationKey))
        .limit(1)
      if (existing) {
        if (existing.contentHash !== contentHash) {
          throw new Error('Dispute operation key was reused with different content')
        }
        return {
          disputeId: existing.id,
          chargeId: existing.chargeId,
          status: existing.status as 'open' | 'won' | 'lost',
          duplicate: true,
        }
      }

      const [charge] = await transaction
        .select({ id: paymentCharge.id, status: paymentCharge.status })
        .from(paymentCharge)
        .where(eq(paymentCharge.id, input.chargeId))
        .limit(1)
        .for('update')
      if (!charge) throw new Error('Payment charge does not exist')
      if (charge.status !== 'approved') {
        throw new Error('Only an approved, undisputed charge can enter dispute')
      }
      await assertReviewedEvidence(transaction, {
        evidenceId: input.evidenceId,
        ownerType: 'payment_charge',
        ownerId: charge.id,
        allowedKinds: ['provider_dispute_notice'],
      })

      const disputeId = createId('cdp')
      await transaction.insert(chargeDispute).values({
        id: disputeId,
        chargeId: charge.id,
        operationKey: input.operationKey,
        contentHash,
        providerCaseReference,
        reason,
        status: 'open',
        openingEvidenceId: input.evidenceId,
        openedByUserId: input.openedByUserId,
        openedAt: now,
        createdAt: now,
      })
      await transaction
        .update(paymentCharge)
        .set({ status: 'disputed' })
        .where(eq(paymentCharge.id, charge.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'charge_dispute',
        entityId: disputeId,
        action: 'charge_dispute_opened',
        actorUserId: input.openedByUserId,
        operationKey: input.operationKey,
        previousState: 'approved',
        nextState: 'open',
        detail: {
          chargeId: charge.id,
          providerCaseReference,
          evidenceId: input.evidenceId,
          reason,
        },
        createdAt: now,
      })
      return { disputeId, chargeId: charge.id, status: 'open', duplicate: false }
    })
  }

  async resolve(input: {
    disputeId: string
    operationKey: string
    outcome: 'won' | 'lost'
    resolutionReference: string
    detail: string
    evidenceId: string
    resolvedByUserId: string
  }): Promise<ChargeDisputeResult> {
    validateOperationKey(input.operationKey)
    const resolutionReference = required(input.resolutionReference, 'Resolution reference')
    const detail = required(input.detail, 'Resolution detail')
    const contentHash = digest({
      disputeId: input.disputeId,
      outcome: input.outcome,
      resolutionReference,
      detail,
      evidenceId: input.evidenceId,
    })
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const [dispute] = await transaction
        .select({
          id: chargeDispute.id,
          chargeId: chargeDispute.chargeId,
          status: chargeDispute.status,
          resolutionOperationKey: chargeDispute.resolutionOperationKey,
          resolutionContentHash: chargeDispute.resolutionContentHash,
        })
        .from(chargeDispute)
        .where(eq(chargeDispute.id, input.disputeId))
        .limit(1)
        .for('update')
      if (!dispute) throw new Error('Charge dispute does not exist')
      if (dispute.status !== 'open') {
        if (
          dispute.resolutionOperationKey !== input.operationKey ||
          dispute.resolutionContentHash !== contentHash
        ) {
          throw new Error('Resolved dispute retry does not match the original resolution')
        }
        return {
          disputeId: dispute.id,
          chargeId: dispute.chargeId,
          status: dispute.status as 'won' | 'lost',
          duplicate: true,
        }
      }

      await assertReviewedEvidence(transaction, {
        evidenceId: input.evidenceId,
        ownerType: 'charge_dispute',
        ownerId: dispute.id,
        allowedKinds: ['provider_dispute_resolution'],
      })

      const [charge] = await transaction
        .select({
          id: paymentCharge.id,
          status: paymentCharge.status,
          grossMinor: paymentCharge.grossMinor,
          currency: paymentCharge.currency,
          fundingClassification: commerceOrderSnapshot.fundingClassification,
        })
        .from(paymentCharge)
        .innerJoin(paymentAttempt, eq(paymentCharge.attemptId, paymentAttempt.id))
        .innerJoin(
          commerceOrderSnapshot,
          eq(paymentAttempt.orderSnapshotId, commerceOrderSnapshot.id)
        )
        .where(eq(paymentCharge.id, dispute.chargeId))
        .limit(1)
        .for('update')
      if (!charge || charge.status !== 'disputed' || charge.currency !== 'COP') {
        throw new Error('Disputed charge accounting context is invalid')
      }

      if (input.outcome === 'lost') {
        const classification = fundingClassification(charge.fundingClassification)
        const cash = await ensureFinanceAccount(transaction, {
          kind: 'platform_cash',
          ownerKey: 'platform',
          currency: 'COP',
          fundingClassification: classification,
        })
        const equity = await ensureFinanceAccount(transaction, {
          kind: 'operating_equity',
          ownerKey: 'platform',
          currency: 'COP',
          fundingClassification: classification,
        })
        await postFinanceTransaction(transaction, {
          operationKey: `charge-dispute-loss:${dispute.id}`,
          kind: 'charge_dispute_loss',
          currency: 'COP',
          createdByUserId: input.resolvedByUserId,
          entries: [
            {
              accountId: cash,
              amountMinor: -charge.grossMinor,
              memo: `Pérdida por disputa ${dispute.id}`,
            },
            {
              accountId: equity,
              amountMinor: charge.grossMinor,
              memo: `Reserva operativa aplicada ${dispute.id}`,
            },
          ],
          now,
        })
      }
      await transaction
        .update(chargeDispute)
        .set({
          status: input.outcome,
          resolutionOperationKey: input.operationKey,
          resolutionContentHash: contentHash,
          resolutionEvidenceId: input.evidenceId,
          resolutionReference,
          resolutionDetail: detail,
          resolvedByUserId: input.resolvedByUserId,
          resolvedAt: now,
        })
        .where(eq(chargeDispute.id, dispute.id))
      await transaction
        .update(paymentCharge)
        .set({ status: input.outcome === 'won' ? 'approved' : 'disputed' })
        .where(eq(paymentCharge.id, dispute.chargeId))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'charge_dispute',
        entityId: dispute.id,
        action: `charge_dispute_${input.outcome}`,
        actorUserId: input.resolvedByUserId,
        operationKey: input.operationKey,
        previousState: 'open',
        nextState: input.outcome,
        detail: {
          chargeId: dispute.chargeId,
          resolutionReference,
          evidenceId: input.evidenceId,
          detail,
        },
        createdAt: now,
      })
      return {
        disputeId: dispute.id,
        chargeId: dispute.chargeId,
        status: input.outcome,
        duplicate: false,
      }
    })
  }
}
