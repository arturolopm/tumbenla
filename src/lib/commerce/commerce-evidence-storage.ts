import 'server-only'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'

import type { db } from '@/database'
import { financeAuditEvent, financeEvidence } from '@/database/commerce-schema'
import { storage, type StorageObjectMetadata } from '@/lib/storage'
import { createId } from '@/lib/utils/id'
import { FinanceEvidenceService } from './finance-evidence-service'

type CommerceDatabase = typeof db

export type EvidenceStoragePort = Readonly<{
  getSignedUploadUrl: (input: {
    key: string
    bucket: 'public' | 'private'
    expiresIn: number
    headers?: Record<string, string>
  }) => Promise<string>
  getSignedDownloadUrl: (input: {
    key: string
    bucket: 'private'
    expiresIn: number
  }) => Promise<string>
  head: (input: { key: string; bucket: 'public' | 'private' }) => Promise<StorageObjectMetadata>
  publicUrl: (key: string) => string
}>

type EvidenceFile = Readonly<{
  contentType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
  contentLength: number
  sha256: string
}>

const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024
const extension: Record<EvidenceFile['contentType'], string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const validateFile = (file: EvidenceFile): void => {
  if (
    !extension[file.contentType] ||
    !Number.isSafeInteger(file.contentLength) ||
    file.contentLength <= 0 ||
    file.contentLength > MAX_EVIDENCE_BYTES ||
    !/^[a-f0-9]{64}$/.test(file.sha256)
  ) {
    throw new Error('Evidence file metadata is invalid')
  }
}

const safeSegment = (value: string): string => {
  if (!/^[A-Za-z0-9:_-]{1,180}$/.test(value)) throw new Error('Evidence owner is invalid')
  return value.replaceAll(':', '_')
}

const assertStoredObject = (metadata: StorageObjectMetadata, expected: EvidenceFile): void => {
  if (!metadata.exists) throw new Error('Evidence object was not found in storage')
  if (metadata.contentLength !== expected.contentLength) {
    throw new Error('Stored evidence size does not match the signed upload')
  }
  if (metadata.contentType?.split(';')[0]?.trim() !== expected.contentType) {
    throw new Error('Stored evidence content type does not match the signed upload')
  }
  if (metadata.sha256 !== expected.sha256) {
    throw new Error('Stored evidence SHA-256 metadata does not match')
  }
}

export class CommerceEvidenceStorage {
  readonly #database: CommerceDatabase
  readonly #objects: EvidenceStoragePort
  readonly #now: () => Date
  readonly #nonce: () => string

  constructor(dependencies: {
    database: CommerceDatabase
    objects?: EvidenceStoragePort
    now?: () => Date
    nonce?: () => string
  }) {
    this.#database = dependencies.database
    this.#objects = dependencies.objects ?? storage
    this.#now = dependencies.now ?? (() => new Date())
    this.#nonce = dependencies.nonce ?? randomUUID
  }

  async preparePrivateUpload(input: {
    ownerType: string
    ownerId: string
    file: EvidenceFile
  }): Promise<{ key: string; uploadUrl: string; headers: Record<string, string> }> {
    validateFile(input.file)
    const ownerType = safeSegment(input.ownerType)
    const ownerId = safeSegment(input.ownerId)
    const key = `finance/private/${ownerType}/${ownerId}/${this.#nonce()}.${extension[input.file.contentType]}`
    const headers = {
      'Content-Type': input.file.contentType,
      'x-amz-meta-sha256': input.file.sha256,
    }
    const uploadUrl = await this.#objects.getSignedUploadUrl({
      key,
      bucket: 'private',
      expiresIn: 600,
      headers,
    })
    return { key, uploadUrl, headers }
  }

  async finalizePrivate(input: {
    ownerType: string
    ownerId: string
    kind: string
    key: string
    file: EvidenceFile
    actorUserId: string
  }): Promise<{ evidenceId: string; duplicate: boolean }> {
    validateFile(input.file)
    const expectedPrefix = `finance/private/${safeSegment(input.ownerType)}/${safeSegment(input.ownerId)}/`
    if (!input.key.startsWith(expectedPrefix))
      throw new Error('Private evidence key has wrong owner')
    const metadata = await this.#objects.head({ key: input.key, bucket: 'private' })
    assertStoredObject(metadata, input.file)
    return new FinanceEvidenceService({ database: this.#database, now: this.#now }).recordPrivate({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      kind: input.kind,
      retainedPrivateStorageKey: input.key,
      sha256: input.file.sha256,
      retainedPrivateSize: input.file.contentLength,
      retainedPrivateContentType: input.file.contentType,
      actorUserId: input.actorUserId,
    })
  }

  async preparePublicRedaction(input: {
    evidenceId: string
    file: EvidenceFile
  }): Promise<{ key: string; uploadUrl: string; headers: Record<string, string> }> {
    validateFile(input.file)
    const [evidence] = await this.#database
      .select({ id: financeEvidence.id, status: financeEvidence.status })
      .from(financeEvidence)
      .where(eq(financeEvidence.id, input.evidenceId))
      .limit(1)
    if (!evidence || (evidence.status !== 'reviewed' && evidence.status !== 'published')) {
      throw new Error('Only reviewed evidence can receive a public redaction')
    }
    const key = `finance/public/${safeSegment(evidence.id)}/${this.#nonce()}.${extension[input.file.contentType]}`
    const headers = {
      'Content-Type': input.file.contentType,
      'x-amz-meta-sha256': input.file.sha256,
    }
    const uploadUrl = await this.#objects.getSignedUploadUrl({
      key,
      bucket: 'public',
      expiresIn: 600,
      headers,
    })
    return { key, uploadUrl, headers }
  }

  async publishRedaction(input: {
    evidenceId: string
    key: string
    file: EvidenceFile
    reviewedByUserId: string
  }): Promise<{ publicUrl: string; duplicate: boolean }> {
    validateFile(input.file)
    if (!input.key.startsWith(`finance/public/${safeSegment(input.evidenceId)}/`)) {
      throw new Error('Public evidence key has wrong owner')
    }
    const metadata = await this.#objects.head({ key: input.key, bucket: 'public' })
    assertStoredObject(metadata, input.file)
    const now = this.#now()
    const duplicate = await this.#database.transaction(async (transaction) => {
      const [evidence] = await transaction
        .select({
          id: financeEvidence.id,
          status: financeEvidence.status,
          retainedPrivateStorageKey: financeEvidence.retainedPrivateStorageKey,
          publicRedactedStorageKey: financeEvidence.publicRedactedStorageKey,
          publicRedactedSha256: financeEvidence.publicRedactedSha256,
          publicRedactedSize: financeEvidence.publicRedactedSize,
          publicRedactedContentType: financeEvidence.publicRedactedContentType,
        })
        .from(financeEvidence)
        .where(eq(financeEvidence.id, input.evidenceId))
        .limit(1)
        .for('update')
      if (!evidence) throw new Error('Evidence does not exist')
      if (evidence.retainedPrivateStorageKey === input.key) {
        throw new Error('Private original and public redaction must use different objects')
      }
      if (evidence.status === 'published') {
        if (
          evidence.publicRedactedStorageKey !== input.key ||
          evidence.publicRedactedSha256 !== input.file.sha256 ||
          evidence.publicRedactedSize !== input.file.contentLength ||
          evidence.publicRedactedContentType !== input.file.contentType
        ) {
          throw new Error('Published evidence retry does not match the reviewed redaction')
        }
        return true
      }
      if (evidence.status !== 'reviewed')
        throw new Error('Evidence must be reviewed before publish')
      await transaction
        .update(financeEvidence)
        .set({
          status: 'published',
          publicRedactedStorageKey: input.key,
          publicRedactedSha256: input.file.sha256,
          publicRedactedSize: input.file.contentLength,
          publicRedactedContentType: input.file.contentType,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: now,
        })
        .where(eq(financeEvidence.id, evidence.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'finance_evidence',
        entityId: evidence.id,
        action: 'redaction_published',
        actorUserId: input.reviewedByUserId,
        previousState: 'reviewed',
        nextState: 'published',
        detail: {
          publicKey: input.key,
          publicSha256: input.file.sha256,
          publicSize: input.file.contentLength,
          publicContentType: input.file.contentType,
        },
        createdAt: now,
      })
      return false
    })
    return { publicUrl: this.#objects.publicUrl(input.key), duplicate }
  }

  async withdraw(input: {
    evidenceId: string
    actorUserId: string
    reason: string
  }): Promise<void> {
    if (input.reason.trim().length === 0) throw new Error('Withdrawal reason is required')
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      const [evidence] = await transaction
        .select({ id: financeEvidence.id, status: financeEvidence.status })
        .from(financeEvidence)
        .where(eq(financeEvidence.id, input.evidenceId))
        .limit(1)
        .for('update')
      if (!evidence) throw new Error('Evidence does not exist')
      if (evidence.status === 'withdrawn') return
      if (evidence.status !== 'published') throw new Error('Only published evidence can withdraw')
      await transaction
        .update(financeEvidence)
        .set({ status: 'withdrawn', withdrawnAt: now })
        .where(eq(financeEvidence.id, evidence.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'finance_evidence',
        entityId: evidence.id,
        action: 'publication_withdrawn',
        actorUserId: input.actorUserId,
        previousState: 'published',
        nextState: 'withdrawn',
        detail: { reason: input.reason.trim() },
        createdAt: now,
      })
    })
  }

  async privateDownloadUrl(evidenceId: string): Promise<string> {
    const [evidence] = await this.#database
      .select({ key: financeEvidence.retainedPrivateStorageKey })
      .from(financeEvidence)
      .where(eq(financeEvidence.id, evidenceId))
      .limit(1)
    if (!evidence) throw new Error('Evidence does not exist')
    return this.#objects.getSignedDownloadUrl({
      key: evidence.key,
      bucket: 'private',
      expiresIn: 300,
    })
  }

  async probeConfiguration(): Promise<void> {
    const key = `finance/probe/${this.#nonce()}`
    await Promise.all([
      this.#objects.head({ key, bucket: 'private' }),
      this.#objects.head({ key, bucket: 'public' }),
    ])
    this.#objects.publicUrl(key)
  }
}
