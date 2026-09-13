import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'

import type { db } from '@/database'
import {
  beneficiaryBankVersion,
  commerceBeneficiary,
  financeAuditEvent,
} from '@/database/commerce-schema'
import { createId } from '@/lib/utils/id'
import { assertReviewedEvidence } from './finance-evidence-service'

type CommerceDatabase = typeof db

export class BeneficiaryService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async register(input: {
    kind: 'foundation' | 'venue'
    venueId?: string
    legalName: string
    legalIdentifierHash: string
    actorUserId: string
  }): Promise<{ beneficiaryId: string; duplicate: boolean }> {
    if (
      input.legalName.trim().length < 2 ||
      !/^[a-f0-9]{64}$/.test(input.legalIdentifierHash) ||
      input.actorUserId.length === 0 ||
      (input.kind === 'venue') !== Boolean(input.venueId)
    ) {
      throw new Error('Beneficiary identity is invalid')
    }
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({
          id: commerceBeneficiary.id,
          kind: commerceBeneficiary.kind,
          venueId: commerceBeneficiary.venueId,
          legalName: commerceBeneficiary.legalName,
        })
        .from(commerceBeneficiary)
        .where(eq(commerceBeneficiary.legalIdentifierHash, input.legalIdentifierHash))
        .limit(1)
      if (existing) {
        if (
          existing.kind !== input.kind ||
          existing.venueId !== (input.venueId ?? null) ||
          existing.legalName !== input.legalName.trim()
        ) {
          throw new Error('Legal identity hash was reused with different beneficiary data')
        }
        return { beneficiaryId: existing.id, duplicate: true }
      }

      const beneficiaryId = createId('cbn')
      await transaction.insert(commerceBeneficiary).values({
        id: beneficiaryId,
        kind: input.kind,
        venueId: input.venueId,
        legalName: input.legalName.trim(),
        legalIdentifierHash: input.legalIdentifierHash,
        status: 'pending',
        createdAt: now,
      })
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'commerce_beneficiary',
        entityId: beneficiaryId,
        action: 'beneficiary_registered',
        actorUserId: input.actorUserId,
        nextState: 'pending',
        detail: { kind: input.kind, venueId: input.venueId ?? null },
        createdAt: now,
      })
      return { beneficiaryId, duplicate: false }
    })
  }

  async verify(input: {
    beneficiaryId: string
    agreementEvidenceId: string
    verifiedByUserId: string
  }): Promise<void> {
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      const [beneficiary] = await transaction
        .select({ id: commerceBeneficiary.id, status: commerceBeneficiary.status })
        .from(commerceBeneficiary)
        .where(eq(commerceBeneficiary.id, input.beneficiaryId))
        .limit(1)
        .for('update')
      if (!beneficiary) throw new Error('Beneficiary does not exist')
      if (beneficiary.status === 'verified') return
      if (beneficiary.status !== 'pending') throw new Error('Beneficiary cannot be verified')
      await assertReviewedEvidence(transaction, {
        evidenceId: input.agreementEvidenceId,
        ownerType: 'commerce_beneficiary',
        ownerId: beneficiary.id,
        allowedKinds: ['signed_agreement'],
      })
      await transaction
        .update(commerceBeneficiary)
        .set({
          status: 'verified',
          agreementEvidenceId: input.agreementEvidenceId,
          verifiedByUserId: input.verifiedByUserId,
          verifiedAt: now,
        })
        .where(eq(commerceBeneficiary.id, beneficiary.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'commerce_beneficiary',
        entityId: beneficiary.id,
        action: 'beneficiary_verified',
        actorUserId: input.verifiedByUserId,
        previousState: 'pending',
        nextState: 'verified',
        detail: { agreementEvidenceId: input.agreementEvidenceId },
        createdAt: now,
      })
    })
  }

  async addBankVersion(input: {
    beneficiaryId: string
    destinationFingerprint: string
    encryptedDetailsStorageKey: string
    actorUserId: string
  }): Promise<{ bankVersionId: string; version: number }> {
    if (
      !/^[a-f0-9]{64}$/.test(input.destinationFingerprint) ||
      input.encryptedDetailsStorageKey.length < 8 ||
      input.encryptedDetailsStorageKey.startsWith('/') ||
      input.encryptedDetailsStorageKey.includes('..')
    ) {
      throw new Error('Bank destination metadata is invalid')
    }
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const [beneficiary] = await transaction
        .select({ id: commerceBeneficiary.id, status: commerceBeneficiary.status })
        .from(commerceBeneficiary)
        .where(eq(commerceBeneficiary.id, input.beneficiaryId))
        .limit(1)
        .for('update')
      if (!beneficiary || beneficiary.status !== 'verified') {
        throw new Error('Only a verified beneficiary can add bank details')
      }
      const [latest] = await transaction
        .select({ version: beneficiaryBankVersion.version })
        .from(beneficiaryBankVersion)
        .where(eq(beneficiaryBankVersion.beneficiaryId, beneficiary.id))
        .orderBy(desc(beneficiaryBankVersion.version))
        .limit(1)
      const version = (latest?.version ?? 0) + 1
      const bankVersionId = createId('bbv')
      await transaction.insert(beneficiaryBankVersion).values({
        id: bankVersionId,
        beneficiaryId: beneficiary.id,
        version,
        destinationFingerprint: input.destinationFingerprint,
        encryptedDetailsStorageKey: input.encryptedDetailsStorageKey,
        status: 'pending',
        createdAt: now,
      })
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'beneficiary_bank_version',
        entityId: bankVersionId,
        action: 'bank_version_registered',
        actorUserId: input.actorUserId,
        nextState: 'pending',
        detail: { beneficiaryId: beneficiary.id, version },
        createdAt: now,
      })
      return { bankVersionId, version }
    })
  }

  async verifyBankVersion(input: {
    bankVersionId: string
    evidenceId: string
    verificationMethod: string
    verificationReference: string
    verifiedByUserId: string
  }): Promise<void> {
    if (
      input.verificationMethod.trim().length === 0 ||
      input.verificationReference.trim().length === 0
    ) {
      throw new Error('Bank verification method and reference are required')
    }
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      const [bank] = await transaction
        .select({
          id: beneficiaryBankVersion.id,
          beneficiaryId: beneficiaryBankVersion.beneficiaryId,
          status: beneficiaryBankVersion.status,
        })
        .from(beneficiaryBankVersion)
        .where(eq(beneficiaryBankVersion.id, input.bankVersionId))
        .limit(1)
        .for('update')
      if (!bank) throw new Error('Bank version does not exist')
      if (bank.status === 'verified') return
      if (bank.status !== 'pending') throw new Error('Bank version cannot be verified')
      await assertReviewedEvidence(transaction, {
        evidenceId: input.evidenceId,
        ownerType: 'beneficiary_bank_version',
        ownerId: bank.id,
        allowedKinds: ['bank_ownership_record'],
      })
      await transaction
        .update(beneficiaryBankVersion)
        .set({ status: 'retired', retiredAt: now })
        .where(
          and(
            eq(beneficiaryBankVersion.beneficiaryId, bank.beneficiaryId),
            eq(beneficiaryBankVersion.status, 'verified'),
            isNull(beneficiaryBankVersion.retiredAt)
          )
        )
      await transaction
        .update(beneficiaryBankVersion)
        .set({
          status: 'verified',
          verificationMethod: input.verificationMethod.trim(),
          verificationReference: input.verificationReference.trim(),
          verifiedByUserId: input.verifiedByUserId,
          verifiedAt: now,
        })
        .where(eq(beneficiaryBankVersion.id, bank.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'beneficiary_bank_version',
        entityId: bank.id,
        action: 'bank_version_verified',
        actorUserId: input.verifiedByUserId,
        previousState: 'pending',
        nextState: 'verified',
        detail: {
          beneficiaryId: bank.beneficiaryId,
          evidenceId: input.evidenceId,
          verificationMethod: input.verificationMethod.trim(),
          verificationReference: input.verificationReference.trim(),
        },
        createdAt: now,
      })
    })
  }
}
