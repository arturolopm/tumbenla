import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  beneficiaryBankVersion,
  commerceBeneficiary,
  financeAuditEvent,
  financeEvidence,
  financialOperation,
  financialOperationAllocation,
  foundationPurchase,
  purchaseFundingAllocation,
} from '@/database/commerce-schema'
import { materialPurchase, materialPurchaseItem, materialPurchaseMedia } from '@/database/schema'
import { storage } from '@/lib/storage'
import { createId } from '@/lib/utils/id'

type CommerceDatabase = typeof db

export type PurchaseItemInput = Readonly<{
  name: string
  quantity: string
  unit: 'bulto' | 'unidad' | 'm3' | 'lamina' | 'metro' | 'galon'
  unitCostMinor?: bigint
  subtotalMinor: bigint
}>

type PurchaseDetails = Readonly<{
  slug: string
  title: string
  summary?: string
  story?: string
  municipality: string
  department: string
  beneficiaryLabel?: string
  householdsHelped?: number
  supplierName?: string
  receiptNumber?: string
  purchasedAt: Date
  items: readonly PurchaseItemInput[]
}>

const operationKeyPattern = /^[A-Za-z0-9:_-]{8,180}$/
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const quantityPattern = /^\d{1,8}(?:\.\d{1,2})?$/

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

const minorToDecimal = (value: bigint): string => {
  const whole = value / BigInt(100)
  const fraction = (value % BigInt(100)).toString().padStart(2, '0')
  return `${whole}.${fraction}`
}

const optionalText = (value: string | undefined, max: number): string | null => {
  const normalized = value?.trim()
  if (!normalized) return null
  if (normalized.length > max) throw new Error('Purchase text is too long')
  return normalized
}

const normalizeDetails = (details: PurchaseDetails): PurchaseDetails => {
  const slug = details.slug.trim().toLowerCase()
  const title = details.title.trim()
  const municipality = details.municipality.trim()
  const department = details.department.trim()
  if (
    !slugPattern.test(slug) ||
    slug.length > 160 ||
    title.length < 2 ||
    title.length > 180 ||
    municipality.length < 2 ||
    municipality.length > 120 ||
    department.length < 2 ||
    department.length > 120 ||
    Number.isNaN(details.purchasedAt.getTime()) ||
    details.items.length === 0 ||
    details.items.length > 100
  ) {
    throw new Error('Purchase details are invalid')
  }
  if (
    details.householdsHelped !== undefined &&
    (!Number.isSafeInteger(details.householdsHelped) || details.householdsHelped <= 0)
  ) {
    throw new Error('Households helped must be a positive integer')
  }
  const items = details.items.map((item) => {
    const name = item.name.trim()
    if (
      name.length === 0 ||
      name.length > 180 ||
      !quantityPattern.test(item.quantity) ||
      Number(item.quantity) <= 0 ||
      item.subtotalMinor <= BigInt(0) ||
      (item.unitCostMinor !== undefined && item.unitCostMinor <= BigInt(0))
    ) {
      throw new Error('Purchase item is invalid')
    }
    return { ...item, name }
  })
  return {
    ...details,
    slug,
    title,
    summary: optionalText(details.summary, 500) ?? undefined,
    story: optionalText(details.story, 10_000) ?? undefined,
    municipality,
    department,
    beneficiaryLabel: optionalText(details.beneficiaryLabel, 180) ?? undefined,
    supplierName: optionalText(details.supplierName, 180) ?? undefined,
    receiptNumber: optionalText(details.receiptNumber, 180) ?? undefined,
    items,
  }
}

export class FoundationPurchaseService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date
  readonly #publicUrl: (key: string) => string

  constructor(dependencies: {
    database: CommerceDatabase
    now?: () => Date
    publicUrl?: (key: string) => string
  }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
    this.#publicUrl = dependencies.publicUrl ?? ((key) => storage.publicUrl(key))
  }

  async record(input: {
    operationKey: string
    beneficiaryId: string
    amountMinor: bigint
    currency: 'COP'
    correctionOfId?: string
    details: PurchaseDetails
    actorUserId: string
  }): Promise<{ purchaseId: string; materialPurchaseId: string; duplicate: boolean }> {
    if (
      !operationKeyPattern.test(input.operationKey) ||
      input.beneficiaryId.trim().length === 0 ||
      input.amountMinor <= BigInt(0) ||
      input.currency !== 'COP' ||
      input.actorUserId.trim().length === 0
    ) {
      throw new Error('Purchase operation is invalid')
    }
    const details = normalizeDetails(input.details)
    const itemTotal = details.items.reduce((sum, item) => sum + item.subtotalMinor, BigInt(0))
    if (itemTotal !== input.amountMinor) {
      throw new Error('Purchase item subtotals must equal the purchase total')
    }
    const contentHash = digest({
      beneficiaryId: input.beneficiaryId,
      amountMinor: input.amountMinor.toString(),
      currency: input.currency,
      correctionOfId: input.correctionOfId ?? null,
      details: {
        ...details,
        purchasedAt: details.purchasedAt.toISOString(),
        items: details.items.map((item) => ({
          ...item,
          unitCostMinor: item.unitCostMinor?.toString() ?? null,
          subtotalMinor: item.subtotalMinor.toString(),
        })),
      },
    })
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({
          id: foundationPurchase.id,
          materialPurchaseId: foundationPurchase.materialPurchaseId,
          contentHash: foundationPurchase.contentHash,
        })
        .from(foundationPurchase)
        .where(eq(foundationPurchase.operationKey, input.operationKey))
        .limit(1)
      if (existing) {
        if (existing.contentHash !== contentHash) {
          throw new Error('Purchase operation key was reused with different content')
        }
        return {
          purchaseId: existing.id,
          materialPurchaseId: existing.materialPurchaseId,
          duplicate: true,
        }
      }

      const [beneficiary] = await transaction
        .select({ id: commerceBeneficiary.id, status: commerceBeneficiary.status })
        .from(commerceBeneficiary)
        .where(
          and(
            eq(commerceBeneficiary.id, input.beneficiaryId),
            eq(commerceBeneficiary.kind, 'foundation')
          )
        )
        .limit(1)
      if (!beneficiary || beneficiary.status !== 'verified') {
        throw new Error('A verified foundation beneficiary is required')
      }

      let correctionOfMaterialPurchaseId: string | null = null
      if (input.correctionOfId) {
        const [prior] = await transaction
          .select({
            id: foundationPurchase.id,
            status: foundationPurchase.status,
            materialPurchaseId: foundationPurchase.materialPurchaseId,
          })
          .from(foundationPurchase)
          .where(eq(foundationPurchase.id, input.correctionOfId))
          .limit(1)
          .for('update')
        if (!prior) throw new Error('Purchase to correct does not exist')
        if (prior.status === 'corrected') throw new Error('Purchase was already corrected')
        correctionOfMaterialPurchaseId = prior.materialPurchaseId
      }

      const materialPurchaseId = createId('mpu')
      const purchaseId = createId('fpu')
      await transaction.insert(materialPurchase).values({
        id: materialPurchaseId,
        slug: details.slug,
        title: details.title,
        summary: details.summary,
        story: details.story,
        municipality: details.municipality,
        department: details.department,
        beneficiaryLabel: details.beneficiaryLabel,
        householdsHelped: details.householdsHelped?.toString(),
        totalAmount: minorToDecimal(input.amountMinor),
        currency: input.currency,
        purchasedAt: details.purchasedAt,
        supplierName: details.supplierName,
        receiptNumber: details.receiptNumber,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
      await transaction.insert(materialPurchaseItem).values(
        details.items.map((item, index) => ({
          id: createId('mpi'),
          purchaseId: materialPurchaseId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitCost:
            item.unitCostMinor === undefined ? undefined : minorToDecimal(item.unitCostMinor),
          subtotal: minorToDecimal(item.subtotalMinor),
          position: String(index + 1),
          createdAt: now,
          updatedAt: now,
        }))
      )
      await transaction.insert(foundationPurchase).values({
        id: purchaseId,
        materialPurchaseId,
        beneficiaryId: input.beneficiaryId,
        operationKey: input.operationKey,
        contentHash,
        correctionOfId: input.correctionOfId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: 'recorded',
        createdAt: now,
      })

      if (input.correctionOfId && correctionOfMaterialPurchaseId) {
        await transaction
          .update(foundationPurchase)
          .set({ status: 'corrected' })
          .where(eq(foundationPurchase.id, input.correctionOfId))
        await transaction
          .update(materialPurchase)
          .set({ status: 'draft', publishedAt: null, updatedAt: now })
          .where(eq(materialPurchase.id, correctionOfMaterialPurchaseId))
        await transaction.insert(financeAuditEvent).values({
          id: createId('fae'),
          entityType: 'foundation_purchase',
          entityId: input.correctionOfId,
          action: 'purchase_corrected',
          actorUserId: input.actorUserId,
          operationKey: input.operationKey,
          previousState: 'recorded_or_verified',
          nextState: 'corrected',
          detail: { replacementPurchaseId: purchaseId },
          createdAt: now,
        })
      }
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'foundation_purchase',
        entityId: purchaseId,
        action: 'purchase_recorded',
        actorUserId: input.actorUserId,
        operationKey: input.operationKey,
        nextState: 'recorded',
        detail: {
          materialPurchaseId,
          amountMinor: input.amountMinor.toString(),
          correctionOfId: input.correctionOfId ?? null,
        },
        createdAt: now,
      })
      return { purchaseId, materialPurchaseId, duplicate: false }
    })
  }

  async verify(input: {
    purchaseId: string
    receiptEvidenceId: string
    verifiedByUserId: string
  }): Promise<{ duplicate: boolean }> {
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const [purchase] = await transaction
        .select({
          id: foundationPurchase.id,
          beneficiaryId: foundationPurchase.beneficiaryId,
          status: foundationPurchase.status,
          receiptEvidenceId: foundationPurchase.receiptEvidenceId,
        })
        .from(foundationPurchase)
        .where(eq(foundationPurchase.id, input.purchaseId))
        .limit(1)
        .for('update')
      if (!purchase) throw new Error('Purchase does not exist')
      if (purchase.status === 'verified') {
        if (purchase.receiptEvidenceId !== input.receiptEvidenceId) {
          throw new Error('Verified purchase retry used different evidence')
        }
        return { duplicate: true }
      }
      if (purchase.status !== 'recorded')
        throw new Error('Purchase cannot be verified in its state')
      const [beneficiary] = await transaction
        .select({ id: commerceBeneficiary.id })
        .from(commerceBeneficiary)
        .where(
          and(
            eq(commerceBeneficiary.id, purchase.beneficiaryId),
            eq(commerceBeneficiary.kind, 'foundation'),
            eq(commerceBeneficiary.status, 'verified')
          )
        )
        .limit(1)
      if (!beneficiary) throw new Error('Purchase beneficiary is not verified')
      const [evidence] = await transaction
        .select({ id: financeEvidence.id })
        .from(financeEvidence)
        .where(
          and(
            eq(financeEvidence.id, input.receiptEvidenceId),
            eq(financeEvidence.ownerType, 'foundation_purchase'),
            eq(financeEvidence.ownerId, purchase.id),
            eq(financeEvidence.kind, 'purchase_receipt'),
            sql`${financeEvidence.status} in ('reviewed', 'published')`
          )
        )
        .limit(1)
      if (!evidence) throw new Error('Reviewed receipt evidence bound to this purchase is required')
      await transaction
        .update(foundationPurchase)
        .set({
          status: 'verified',
          receiptEvidenceId: evidence.id,
          verifiedByUserId: input.verifiedByUserId,
          verifiedAt: now,
        })
        .where(eq(foundationPurchase.id, purchase.id))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'foundation_purchase',
        entityId: purchase.id,
        action: 'purchase_verified',
        actorUserId: input.verifiedByUserId,
        previousState: 'recorded',
        nextState: 'verified',
        detail: { receiptEvidenceId: evidence.id },
        createdAt: now,
      })
      return { duplicate: false }
    })
  }

  async allocateFunding(input: {
    purchaseId: string
    allocations: readonly Readonly<{ payoutAllocationId: string; amountMinor: bigint }>[]
    actorUserId: string
  }): Promise<{ allocatedMinor: bigint; duplicate: boolean }> {
    const allocations = [...input.allocations].sort((a, b) =>
      a.payoutAllocationId.localeCompare(b.payoutAllocationId)
    )
    if (
      allocations.length === 0 ||
      allocations.some(
        (item, index) =>
          item.amountMinor <= BigInt(0) ||
          (index > 0 && allocations[index - 1]?.payoutAllocationId === item.payoutAllocationId)
      )
    ) {
      throw new Error('Purchase funding allocations must be unique and positive')
    }
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const [purchase] = await transaction
        .select({
          id: foundationPurchase.id,
          beneficiaryId: foundationPurchase.beneficiaryId,
          amountMinor: foundationPurchase.amountMinor,
          currency: foundationPurchase.currency,
          status: foundationPurchase.status,
        })
        .from(foundationPurchase)
        .where(eq(foundationPurchase.id, input.purchaseId))
        .limit(1)
        .for('update')
      if (!purchase || purchase.status !== 'verified') {
        throw new Error('Only a verified purchase can receive funding attribution')
      }

      const pending: typeof allocations = []
      for (const requested of allocations) {
        const [source] = await transaction
          .select({
            id: financialOperationAllocation.id,
            amountMinor: financialOperationAllocation.amountMinor,
            sourceType: financialOperationAllocation.sourceType,
            kind: financialOperation.kind,
            status: financialOperation.status,
            currency: financialOperation.currency,
            fundingClassification: financialOperation.fundingClassification,
            beneficiaryId: beneficiaryBankVersion.beneficiaryId,
          })
          .from(financialOperationAllocation)
          .innerJoin(
            financialOperation,
            eq(financialOperationAllocation.operationId, financialOperation.id)
          )
          .innerJoin(
            beneficiaryBankVersion,
            eq(financialOperation.beneficiaryBankVersionId, beneficiaryBankVersion.id)
          )
          .where(eq(financialOperationAllocation.id, requested.payoutAllocationId))
          .limit(1)
          .for('update')
        if (
          !source ||
          source.kind !== 'foundation_payout' ||
          source.status !== 'bank_verified' ||
          source.fundingClassification !== 'real' ||
          source.sourceType !== 'foundation_unit_allocation' ||
          source.currency !== purchase.currency ||
          source.beneficiaryId !== purchase.beneficiaryId
        ) {
          throw new Error('Funding source is not a confirmed real foundation transfer')
        }
        const [existing] = await transaction
          .select({ amountMinor: purchaseFundingAllocation.amountMinor })
          .from(purchaseFundingAllocation)
          .where(
            and(
              eq(purchaseFundingAllocation.foundationPurchaseId, purchase.id),
              eq(purchaseFundingAllocation.payoutAllocationId, source.id)
            )
          )
          .limit(1)
        if (existing) {
          if (existing.amountMinor !== requested.amountMinor) {
            throw new Error('Purchase funding retry used a different amount')
          }
          continue
        }
        const [used] = await transaction
          .select({
            total: sql<bigint>`coalesce(sum(${purchaseFundingAllocation.amountMinor}), 0)`,
          })
          .from(purchaseFundingAllocation)
          .where(eq(purchaseFundingAllocation.payoutAllocationId, source.id))
        const pendingForSource = pending
          .filter((item) => item.payoutAllocationId === source.id)
          .reduce((sum, item) => sum + item.amountMinor, BigInt(0))
        if (
          BigInt(used?.total ?? 0) + pendingForSource + requested.amountMinor >
          source.amountMinor
        ) {
          throw new Error('Funding attribution exceeds the confirmed transfer source')
        }
        pending.push(requested)
      }

      const [purchaseUsed] = await transaction
        .select({ total: sql<bigint>`coalesce(sum(${purchaseFundingAllocation.amountMinor}), 0)` })
        .from(purchaseFundingAllocation)
        .where(eq(purchaseFundingAllocation.foundationPurchaseId, purchase.id))
      const newTotal = pending.reduce((sum, item) => sum + item.amountMinor, BigInt(0))
      if (BigInt(purchaseUsed?.total ?? 0) + newTotal > purchase.amountMinor) {
        throw new Error('Funding attribution exceeds the verified purchase amount')
      }
      if (pending.length > 0) {
        await transaction.insert(purchaseFundingAllocation).values(
          pending.map((item) => ({
            id: createId('pfa'),
            foundationPurchaseId: purchase.id,
            payoutAllocationId: item.payoutAllocationId,
            amountMinor: item.amountMinor,
            createdAt: now,
          }))
        )
        await transaction.insert(financeAuditEvent).values({
          id: createId('fae'),
          entityType: 'foundation_purchase',
          entityId: purchase.id,
          action: 'purchase_funding_attributed',
          actorUserId: input.actorUserId,
          detail: {
            allocatedMinor: newTotal.toString(),
            sourceCount: pending.length,
          },
          createdAt: now,
        })
      }
      return { allocatedMinor: newTotal, duplicate: pending.length === 0 }
    })
  }

  async publish(input: {
    purchaseId: string
    actorUserId: string
  }): Promise<{ publicUrl: string; duplicate: boolean }> {
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const [purchase] = await transaction
        .select({
          id: foundationPurchase.id,
          status: foundationPurchase.status,
          materialPurchaseId: foundationPurchase.materialPurchaseId,
          receiptEvidenceId: foundationPurchase.receiptEvidenceId,
          materialStatus: materialPurchase.status,
        })
        .from(foundationPurchase)
        .innerJoin(materialPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
        .where(eq(foundationPurchase.id, input.purchaseId))
        .limit(1)
        .for('update')
      if (!purchase || purchase.status !== 'verified' || !purchase.receiptEvidenceId) {
        throw new Error('Only a verified purchase can be published')
      }
      const [evidence] = await transaction
        .select({ key: financeEvidence.publicRedactedStorageKey })
        .from(financeEvidence)
        .where(
          and(
            eq(financeEvidence.id, purchase.receiptEvidenceId),
            eq(financeEvidence.ownerType, 'foundation_purchase'),
            eq(financeEvidence.ownerId, purchase.id),
            eq(financeEvidence.kind, 'purchase_receipt'),
            eq(financeEvidence.status, 'published')
          )
        )
        .limit(1)
      if (!evidence?.key) throw new Error('A published redacted receipt is required')
      const publicUrl = this.#publicUrl(evidence.key)
      if (purchase.materialStatus === 'published') return { publicUrl, duplicate: true }
      await transaction.insert(materialPurchaseMedia).values({
        id: createId('mpm'),
        purchaseId: purchase.materialPurchaseId,
        kind: 'receipt',
        url: publicUrl,
        storageKey: evidence.key,
        caption: 'Recibo revisado y redactado',
        consentGiven: true,
        position: '1',
        createdAt: now,
        updatedAt: now,
      })
      await transaction
        .update(materialPurchase)
        .set({ status: 'published', publishedAt: now, updatedAt: now })
        .where(eq(materialPurchase.id, purchase.materialPurchaseId))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'foundation_purchase',
        entityId: purchase.id,
        action: 'purchase_published',
        actorUserId: input.actorUserId,
        previousState: 'verified_private',
        nextState: 'verified_public',
        detail: { receiptEvidenceId: purchase.receiptEvidenceId, publicStorageKey: evidence.key },
        createdAt: now,
      })
      return { publicUrl, duplicate: false }
    })
  }

  async reject(input: { purchaseId: string; actorUserId: string; reason: string }): Promise<void> {
    const reason = input.reason.trim()
    if (!reason) throw new Error('Purchase rejection reason is required')
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      const [purchase] = await transaction
        .select({
          id: foundationPurchase.id,
          status: foundationPurchase.status,
          materialPurchaseId: foundationPurchase.materialPurchaseId,
        })
        .from(foundationPurchase)
        .where(eq(foundationPurchase.id, input.purchaseId))
        .limit(1)
        .for('update')
      if (!purchase) throw new Error('Purchase does not exist')
      if (purchase.status === 'rejected') return
      if (purchase.status === 'corrected') throw new Error('Corrected purchase cannot be rejected')
      await transaction
        .update(foundationPurchase)
        .set({ status: 'rejected' })
        .where(eq(foundationPurchase.id, purchase.id))
      await transaction
        .update(materialPurchase)
        .set({ status: 'draft', publishedAt: null, updatedAt: now })
        .where(eq(materialPurchase.id, purchase.materialPurchaseId))
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'foundation_purchase',
        entityId: purchase.id,
        action: 'purchase_rejected',
        actorUserId: input.actorUserId,
        previousState: purchase.status,
        nextState: 'rejected',
        detail: { reason },
        createdAt: now,
      })
    })
  }
}
