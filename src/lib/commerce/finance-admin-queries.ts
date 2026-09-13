import 'server-only'

import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationRun,
  beneficiaryBankVersion,
  chargeDispute,
  commerceBeneficiary,
  commerceOrderSnapshot,
  commerceOrderUnit,
  financeEvidence,
  financialOperation,
  financialOperationAllocation,
  paymentAttempt,
  paymentCharge,
  purchaseFundingAllocation,
  recoveryCheckpoint,
  foundationPurchase,
  unitAllocation,
} from '@/database/commerce-schema'
import { materialPurchase, productOrder, venue } from '@/database/schema'
import { TreasuryService, type TreasurySnapshot } from './treasury-service'

type CommerceDatabase = typeof db

export type AdminFinanceOverview = Readonly<{
  treasury: Readonly<Record<'real' | 'sandbox', TreasurySnapshot | null>>
  operations: readonly Readonly<{
    id: string
    kind: string
    status: string
    amountMinor: bigint
    fundingClassification: string | null
    externalReference: string | null
    destinationFingerprint: string | null
    bankEvidenceId: string | null
    statusDetail: string | null
    createdAt: Date
  }>[]
  beneficiaries: readonly Readonly<{
    id: string
    kind: string
    legalName: string
    status: string
    venueName: string | null
    bankVersionId: string | null
    bankVersion: number | null
    bankStatus: string | null
    destinationFingerprint: string | null
  }>[]
  evidence: readonly Readonly<{
    id: string
    ownerType: string
    ownerId: string
    kind: string
    status: string
    sha256: string
    createdAt: Date
  }>[]
  charges: readonly Readonly<{
    id: string
    orderId: string
    venueName: string
    grossMinor: bigint
    fundingClassification: string
    clearedAt: Date | null
    allocationRevision: number | null
  }>[]
  disputes: readonly Readonly<{
    id: string
    chargeId: string
    providerCaseReference: string
    reason: string
    status: string
    grossMinor: bigint
    venueName: string
    openedAt: Date
    resolvedAt: Date | null
  }>[]
  payoutSources: readonly Readonly<{
    id: string
    venueName: string
    venueId: string
    foundationBeneficiaryId: string | null
    fundingClassification: string
    venueAvailableMinor: bigint
    foundationAvailableMinor: bigint
  }>[]
  purchases: readonly Readonly<{
    id: string
    title: string
    status: string
    amountMinor: bigint
    beneficiaryId: string
    receiptEvidenceId: string | null
    publicStatus: string
  }>[]
  purchaseFundingSources: readonly Readonly<{
    id: string
    externalReference: string | null
    beneficiaryName: string
    amountMinor: bigint
    availableMinor: bigint
  }>[]
  recoveryAttempts: readonly Readonly<{
    id: string
    status: string
    provider: string
    reference: string | null
    outcomeDetail: string | null
    lastCheckedAt: Date | null
    createdAt: Date
  }>[]
  recovery: Readonly<{
    lastStartedAt: Date | null
    lastSucceededAt: Date | null
    lastError: string | null
    leaseExpiresAt: Date | null
  }> | null
}>

const treasuryOrNull = async (
  database: CommerceDatabase,
  classification: 'real' | 'sandbox'
): Promise<TreasurySnapshot | null> => {
  try {
    return await new TreasuryService({ database }).snapshot(classification)
  } catch (error) {
    if (error instanceof Error && error.message === 'An active treasury policy is required') {
      return null
    }
    throw error
  }
}

export const loadAdminFinanceOverview = async (
  database: CommerceDatabase
): Promise<AdminFinanceOverview> => {
  const usedVenueSources = database
    .select({
      sourceId: financialOperationAllocation.sourceId,
      usedMinor: sql<bigint>`coalesce(sum(${financialOperationAllocation.amountMinor}), 0)`.as(
        'venue_used_minor'
      ),
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
        notInArray(financialOperation.status, ['failed', 'cancelled', 'reversed'])
      )
    )
    .groupBy(financialOperationAllocation.sourceId)
    .as('used_venue_sources')

  const usedFoundationSources = database
    .select({
      sourceId: financialOperationAllocation.sourceId,
      usedMinor: sql<bigint>`coalesce(sum(${financialOperationAllocation.amountMinor}), 0)`.as(
        'foundation_used_minor'
      ),
    })
    .from(financialOperationAllocation)
    .innerJoin(
      financialOperation,
      eq(financialOperationAllocation.operationId, financialOperation.id)
    )
    .where(
      and(
        eq(financialOperationAllocation.sourceType, 'foundation_unit_allocation'),
        notInArray(financialOperation.status, ['failed', 'cancelled', 'reversed'])
      )
    )
    .groupBy(financialOperationAllocation.sourceId)
    .as('used_foundation_sources')

  const usedPurchaseFunding = database
    .select({
      payoutAllocationId: purchaseFundingAllocation.payoutAllocationId,
      usedMinor: sql<bigint>`coalesce(sum(${purchaseFundingAllocation.amountMinor}), 0)`.as(
        'purchase_used_minor'
      ),
    })
    .from(purchaseFundingAllocation)
    .groupBy(purchaseFundingAllocation.payoutAllocationId)
    .as('used_purchase_funding')

  const [
    real,
    sandbox,
    operations,
    beneficiaries,
    evidence,
    charges,
    disputes,
    payoutSources,
    purchases,
    purchaseFundingSources,
    recoveryAttempts,
    recoveryRows,
  ] = await Promise.all([
    treasuryOrNull(database, 'real'),
    treasuryOrNull(database, 'sandbox'),
    database
      .select({
        id: financialOperation.id,
        kind: financialOperation.kind,
        status: financialOperation.status,
        amountMinor: financialOperation.amountMinor,
        fundingClassification: financialOperation.fundingClassification,
        externalReference: financialOperation.externalReference,
        destinationFingerprint: financialOperation.destinationFingerprint,
        bankEvidenceId: financialOperation.bankEvidenceId,
        statusDetail: financialOperation.statusDetail,
        createdAt: financialOperation.createdAt,
      })
      .from(financialOperation)
      .where(inArray(financialOperation.kind, ['refund', 'venue_payout', 'foundation_payout']))
      .orderBy(desc(financialOperation.createdAt))
      .limit(50),
    database
      .select({
        id: commerceBeneficiary.id,
        kind: commerceBeneficiary.kind,
        legalName: commerceBeneficiary.legalName,
        status: commerceBeneficiary.status,
        venueName: venue.name,
        bankVersionId: beneficiaryBankVersion.id,
        bankVersion: beneficiaryBankVersion.version,
        bankStatus: beneficiaryBankVersion.status,
        destinationFingerprint: beneficiaryBankVersion.destinationFingerprint,
      })
      .from(commerceBeneficiary)
      .leftJoin(venue, eq(commerceBeneficiary.venueId, venue.id))
      .leftJoin(
        beneficiaryBankVersion,
        eq(commerceBeneficiary.id, beneficiaryBankVersion.beneficiaryId)
      )
      .orderBy(commerceBeneficiary.legalName, desc(beneficiaryBankVersion.version)),
    database
      .select({
        id: financeEvidence.id,
        ownerType: financeEvidence.ownerType,
        ownerId: financeEvidence.ownerId,
        kind: financeEvidence.kind,
        status: financeEvidence.status,
        sha256: financeEvidence.sha256,
        createdAt: financeEvidence.createdAt,
      })
      .from(financeEvidence)
      .orderBy(desc(financeEvidence.createdAt))
      .limit(50),
    database
      .select({
        id: paymentCharge.id,
        orderId: commerceOrderSnapshot.orderId,
        venueName: commerceOrderSnapshot.venueName,
        grossMinor: paymentCharge.grossMinor,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        clearedAt: paymentCharge.clearedAt,
        allocationRevision: allocationRun.revision,
      })
      .from(paymentCharge)
      .innerJoin(paymentAttempt, eq(paymentCharge.attemptId, paymentAttempt.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(paymentAttempt.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .leftJoin(
        allocationRun,
        and(eq(paymentCharge.id, allocationRun.chargeId), eq(allocationRun.status, 'final'))
      )
      .where(eq(paymentCharge.status, 'approved'))
      .orderBy(desc(paymentCharge.createdAt))
      .limit(100),
    database
      .select({
        id: chargeDispute.id,
        chargeId: chargeDispute.chargeId,
        providerCaseReference: chargeDispute.providerCaseReference,
        reason: chargeDispute.reason,
        status: chargeDispute.status,
        grossMinor: paymentCharge.grossMinor,
        venueName: commerceOrderSnapshot.venueName,
        openedAt: chargeDispute.openedAt,
        resolvedAt: chargeDispute.resolvedAt,
      })
      .from(chargeDispute)
      .innerJoin(paymentCharge, eq(chargeDispute.chargeId, paymentCharge.id))
      .innerJoin(paymentAttempt, eq(paymentCharge.attemptId, paymentAttempt.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(paymentAttempt.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .orderBy(desc(chargeDispute.createdAt))
      .limit(100),
    database
      .select({
        id: unitAllocation.id,
        venueName: commerceOrderSnapshot.venueName,
        venueId: productOrder.venueId,
        foundationBeneficiaryId: commerceOrderSnapshot.foundationBeneficiaryId,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
        venueAvailableMinor: sql<bigint>`greatest(${unitAllocation.venueMinor} - coalesce(${usedVenueSources.usedMinor}, 0), 0)`,
        foundationAvailableMinor: sql<bigint>`greatest(${unitAllocation.donationMinor} - coalesce(${usedFoundationSources.usedMinor}, 0), 0)`,
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
      .leftJoin(usedVenueSources, eq(unitAllocation.id, usedVenueSources.sourceId))
      .leftJoin(usedFoundationSources, eq(unitAllocation.id, usedFoundationSources.sourceId))
      .where(
        and(
          eq(allocationRun.status, 'final'),
          eq(commerceOrderUnit.lifecycleStatus, 'redeemed'),
          eq(paymentCharge.status, 'approved'),
          sql`${paymentCharge.clearedAt} is not null`,
          inArray(commerceOrderSnapshot.fundingClassification, ['real', 'sandbox'])
        )
      )
      .orderBy(unitAllocation.createdAt)
      .limit(500),
    database
      .select({
        id: foundationPurchase.id,
        title: materialPurchase.title,
        status: foundationPurchase.status,
        amountMinor: foundationPurchase.amountMinor,
        beneficiaryId: foundationPurchase.beneficiaryId,
        receiptEvidenceId: foundationPurchase.receiptEvidenceId,
        publicStatus: materialPurchase.status,
      })
      .from(foundationPurchase)
      .innerJoin(materialPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
      .orderBy(desc(foundationPurchase.createdAt))
      .limit(100),
    database
      .select({
        id: financialOperationAllocation.id,
        externalReference: financialOperation.externalReference,
        beneficiaryName: commerceBeneficiary.legalName,
        amountMinor: financialOperationAllocation.amountMinor,
        availableMinor: sql<bigint>`greatest(${financialOperationAllocation.amountMinor} - coalesce(${usedPurchaseFunding.usedMinor}, 0), 0)`,
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
      .innerJoin(
        commerceBeneficiary,
        eq(beneficiaryBankVersion.beneficiaryId, commerceBeneficiary.id)
      )
      .leftJoin(
        usedPurchaseFunding,
        eq(financialOperationAllocation.id, usedPurchaseFunding.payoutAllocationId)
      )
      .where(
        and(
          eq(financialOperation.kind, 'foundation_payout'),
          eq(financialOperation.status, 'bank_verified'),
          eq(financialOperation.fundingClassification, 'real'),
          eq(financialOperationAllocation.sourceType, 'foundation_unit_allocation')
        )
      )
      .orderBy(financialOperationAllocation.createdAt)
      .limit(500),
    database
      .select({
        id: paymentAttempt.id,
        status: paymentAttempt.status,
        provider: paymentAttempt.provider,
        reference: paymentAttempt.providerAttemptReference,
        outcomeDetail: paymentAttempt.outcomeDetail,
        lastCheckedAt: paymentAttempt.lastCheckedAt,
        createdAt: paymentAttempt.createdAt,
      })
      .from(paymentAttempt)
      .where(
        inArray(paymentAttempt.status, [
          'created',
          'submitted',
          'pending',
          'uncertain',
          'operator_review',
        ])
      )
      .orderBy(paymentAttempt.updatedAt)
      .limit(100),
    database
      .select({
        lastStartedAt: recoveryCheckpoint.lastStartedAt,
        lastSucceededAt: recoveryCheckpoint.lastSucceededAt,
        lastError: recoveryCheckpoint.lastError,
        leaseExpiresAt: recoveryCheckpoint.leaseExpiresAt,
      })
      .from(recoveryCheckpoint)
      .where(
        and(eq(recoveryCheckpoint.job, 'commerce_daily'), eq(recoveryCheckpoint.scope, 'global'))
      )
      .limit(1),
  ])

  return {
    treasury: { real, sandbox },
    operations,
    beneficiaries,
    evidence,
    charges,
    disputes,
    payoutSources: payoutSources
      .map((source) => ({
        ...source,
        venueAvailableMinor: BigInt(source.venueAvailableMinor),
        foundationAvailableMinor: BigInt(source.foundationAvailableMinor),
      }))
      .filter(
        (source) =>
          source.venueAvailableMinor > BigInt(0) || source.foundationAvailableMinor > BigInt(0)
      ),
    purchases: purchases.map((purchase) => ({
      ...purchase,
      amountMinor: BigInt(purchase.amountMinor),
    })),
    purchaseFundingSources: purchaseFundingSources
      .map((source) => ({
        ...source,
        amountMinor: BigInt(source.amountMinor),
        availableMinor: BigInt(source.availableMinor),
      }))
      .filter((source) => source.availableMinor > BigInt(0)),
    recoveryAttempts,
    recovery: recoveryRows[0] ?? null,
  }
}
