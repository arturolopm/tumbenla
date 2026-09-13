import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'

import type { db } from '@/database'
import { financeAuditEvent, financeEvidence } from '@/database/commerce-schema'
import { createId } from '@/lib/utils/id'
import type { FinanceTransactionConnection } from './finance-ledger'

type CommerceDatabase = typeof db

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const validStorageKey = (value: string): boolean =>
  value.length >= 8 && value.length <= 500 && !value.startsWith('/') && !value.includes('..')

export class FinanceEvidenceService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async recordPrivate(input: {
    ownerType: string
    ownerId: string
    kind: string
    retainedPrivateStorageKey: string
    sha256: string
    retainedPrivateSize?: number
    retainedPrivateContentType?: string
    actorUserId?: string
  }): Promise<{ evidenceId: string; duplicate: boolean }> {
    if (
      input.ownerType.trim().length === 0 ||
      input.ownerId.trim().length === 0 ||
      input.kind.trim().length === 0 ||
      !validStorageKey(input.retainedPrivateStorageKey) ||
      !/^[a-f0-9]{64}$/.test(input.sha256) ||
      (input.retainedPrivateSize !== undefined &&
        (!Number.isSafeInteger(input.retainedPrivateSize) || input.retainedPrivateSize <= 0)) ||
      (input.retainedPrivateContentType !== undefined &&
        input.retainedPrivateContentType.trim().length === 0)
    ) {
      throw new Error('Evidence metadata is invalid')
    }

    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({
          id: financeEvidence.id,
          ownerType: financeEvidence.ownerType,
          ownerId: financeEvidence.ownerId,
          kind: financeEvidence.kind,
          sha256: financeEvidence.sha256,
          retainedPrivateSize: financeEvidence.retainedPrivateSize,
          retainedPrivateContentType: financeEvidence.retainedPrivateContentType,
        })
        .from(financeEvidence)
        .where(eq(financeEvidence.retainedPrivateStorageKey, input.retainedPrivateStorageKey))
        .limit(1)
      if (existing) {
        if (
          existing.ownerType !== input.ownerType ||
          existing.ownerId !== input.ownerId ||
          existing.kind !== input.kind ||
          existing.sha256 !== input.sha256 ||
          existing.retainedPrivateSize !== (input.retainedPrivateSize ?? null) ||
          existing.retainedPrivateContentType !== (input.retainedPrivateContentType ?? null)
        ) {
          throw new Error('Evidence storage key was reused with different metadata')
        }
        return { evidenceId: existing.id, duplicate: true }
      }

      const evidenceId = createId('fev')
      await transaction.insert(financeEvidence).values({
        id: evidenceId,
        ownerType: input.ownerType.trim(),
        ownerId: input.ownerId.trim(),
        kind: input.kind.trim(),
        retainedPrivateStorageKey: input.retainedPrivateStorageKey,
        sha256: input.sha256,
        retainedPrivateSize: input.retainedPrivateSize,
        retainedPrivateContentType: input.retainedPrivateContentType,
        status: 'private',
        createdAt: now,
      })
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'finance_evidence',
        entityId: evidenceId,
        action: 'evidence_recorded',
        actorUserId: input.actorUserId,
        nextState: 'private',
        detail: {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          kind: input.kind,
          metadataDigest: digest({ key: input.retainedPrivateStorageKey, sha256: input.sha256 }),
        },
        createdAt: now,
      })
      return { evidenceId, duplicate: false }
    })
  }

  async review(input: {
    evidenceId: string
    reviewedByUserId: string
  }): Promise<{ evidenceId: string; duplicate: boolean }> {
    if (input.evidenceId.length === 0 || input.reviewedByUserId.length === 0) {
      throw new Error('Evidence and reviewer are required')
    }
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const [evidence] = await transaction
        .select({ id: financeEvidence.id, status: financeEvidence.status })
        .from(financeEvidence)
        .where(eq(financeEvidence.id, input.evidenceId))
        .limit(1)
        .for('update')
      if (!evidence) throw new Error('Evidence does not exist')
      if (evidence.status === 'reviewed' || evidence.status === 'published') {
        return { evidenceId: evidence.id, duplicate: true }
      }
      if (evidence.status !== 'private') throw new Error('Evidence cannot be reviewed in its state')

      await transaction
        .update(financeEvidence)
        .set({ status: 'reviewed', reviewedByUserId: input.reviewedByUserId, reviewedAt: now })
        .where(eq(financeEvidence.id, evidence.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'finance_evidence',
        entityId: evidence.id,
        action: 'evidence_reviewed',
        actorUserId: input.reviewedByUserId,
        previousState: 'private',
        nextState: 'reviewed',
        detail: {},
        createdAt: now,
      })
      return { evidenceId: evidence.id, duplicate: false }
    })
  }
}

export const assertReviewedEvidence = async (
  transaction: FinanceTransactionConnection,
  input: {
    evidenceId: string
    ownerType: string
    ownerId: string
    allowedKinds?: readonly string[]
  }
): Promise<void> => {
  const [evidence] = await transaction
    .select({ id: financeEvidence.id, kind: financeEvidence.kind })
    .from(financeEvidence)
    .where(
      and(
        eq(financeEvidence.id, input.evidenceId),
        eq(financeEvidence.ownerType, input.ownerType),
        eq(financeEvidence.ownerId, input.ownerId),
        inArray(financeEvidence.status, ['reviewed', 'published'])
      )
    )
    .limit(1)
  if (!evidence || (input.allowedKinds && !input.allowedKinds.includes(evidence.kind))) {
    throw new Error('Reviewed evidence of an approved kind bound to this operation is required')
  }
}
