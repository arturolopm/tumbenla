import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationRun,
  beneficiaryBankVersion,
  commerceOrderSnapshot,
  commerceOrderUnit,
  creditDebt,
  financeEvidence,
  financialOperation,
  financialOperationAllocation,
  foundationPurchase,
  paymentCharge,
  purchaseFundingAllocation,
  unitAllocation,
} from '@/database/commerce-schema'
import { materialPurchase, productOrder } from '@/database/schema'

type CommerceDatabase = typeof db

export type FoundationTransparencyStages = Readonly<{
  allocatedMinor: bigint
  backedMinor: bigint
  transferredMinor: bigint
  verifiedPurchaseMinor: bigint
  publishedPurchaseTotalMinor: bigint
}>

const total = (value: bigint | string | number | null | undefined): bigint => BigInt(value ?? 0)

/**
 * Each value is a stage of the same real-money lifecycle. Callers must render
 * them independently and never sum them as if they were separate donations.
 */
export const getFoundationTransparencyStages = async (
  database: CommerceDatabase
): Promise<FoundationTransparencyStages> => {
  const [app, cash, transfers, verifiedPurchases, publishedPurchases] = await Promise.all([
    database
      .select({
        allocated: sql<bigint>`coalesce(sum(case when ${paymentCharge.status} in ('approved', 'disputed') then ${unitAllocation.donationMinor} else 0 end), 0)`,
        backed: sql<bigint>`coalesce(sum(case when ${paymentCharge.status} = 'approved' and ${paymentCharge.clearedAt} is not null then ${unitAllocation.donationMinor} else 0 end), 0)`,
      })
      .from(unitAllocation)
      .innerJoin(allocationRun, eq(unitAllocation.allocationRunId, allocationRun.id))
      .innerJoin(commerceOrderUnit, eq(unitAllocation.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(paymentCharge, eq(allocationRun.chargeId, paymentCharge.id))
      .where(
        and(
          eq(allocationRun.status, 'final'),
          eq(commerceOrderUnit.lifecycleStatus, 'redeemed'),
          eq(commerceOrderSnapshot.fundingClassification, 'real')
        )
      ),
    database
      .select({
        allocated: sql<bigint>`coalesce(sum(${creditDebt.principalMinor}), 0)`,
        backed: sql<bigint>`coalesce(sum(${creditDebt.principalMinor} - ${creditDebt.outstandingMinor}), 0)`,
      })
      .from(creditDebt)
      .innerJoin(commerceOrderUnit, eq(creditDebt.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .where(eq(commerceOrderSnapshot.fundingClassification, 'real')),
    database
      .select({
        value: sql<bigint>`coalesce(sum(${financialOperationAllocation.amountMinor}), 0)`,
      })
      .from(financialOperationAllocation)
      .innerJoin(
        financialOperation,
        eq(financialOperationAllocation.operationId, financialOperation.id)
      )
      .where(
        and(
          eq(financialOperation.kind, 'foundation_payout'),
          eq(financialOperation.status, 'bank_verified'),
          eq(financialOperation.fundingClassification, 'real'),
          eq(financialOperationAllocation.sourceType, 'foundation_unit_allocation')
        )
      ),
    database
      .select({
        value: sql<bigint>`coalesce(sum(${purchaseFundingAllocation.amountMinor}), 0)`,
      })
      .from(purchaseFundingAllocation)
      .innerJoin(
        foundationPurchase,
        eq(purchaseFundingAllocation.foundationPurchaseId, foundationPurchase.id)
      )
      .innerJoin(materialPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
      .innerJoin(financeEvidence, eq(foundationPurchase.receiptEvidenceId, financeEvidence.id))
      .innerJoin(
        financialOperationAllocation,
        eq(purchaseFundingAllocation.payoutAllocationId, financialOperationAllocation.id)
      )
      .innerJoin(
        financialOperation,
        eq(financialOperationAllocation.operationId, financialOperation.id)
      )
      .innerJoin(
        beneficiaryBankVersion,
        eq(financialOperation.beneficiaryBankVersionId, beneficiaryBankVersion.id)
      )
      .where(
        and(
          eq(foundationPurchase.status, 'verified'),
          eq(materialPurchase.status, 'published'),
          eq(financeEvidence.status, 'published'),
          eq(financeEvidence.kind, 'purchase_receipt'),
          eq(financialOperation.kind, 'foundation_payout'),
          eq(financialOperation.status, 'bank_verified'),
          eq(financialOperation.fundingClassification, 'real'),
          eq(financialOperationAllocation.sourceType, 'foundation_unit_allocation'),
          eq(beneficiaryBankVersion.beneficiaryId, foundationPurchase.beneficiaryId)
        )
      ),
    database
      .select({ value: sql<bigint>`coalesce(sum(${foundationPurchase.amountMinor}), 0)` })
      .from(foundationPurchase)
      .innerJoin(materialPurchase, eq(foundationPurchase.materialPurchaseId, materialPurchase.id))
      .innerJoin(financeEvidence, eq(foundationPurchase.receiptEvidenceId, financeEvidence.id))
      .where(
        and(
          eq(foundationPurchase.status, 'verified'),
          eq(materialPurchase.status, 'published'),
          eq(financeEvidence.status, 'published'),
          eq(financeEvidence.kind, 'purchase_receipt')
        )
      ),
  ])

  return {
    allocatedMinor: total(app[0]?.allocated) + total(cash[0]?.allocated),
    backedMinor: total(app[0]?.backed) + total(cash[0]?.backed),
    transferredMinor: total(transfers[0]?.value),
    verifiedPurchaseMinor: total(verifiedPurchases[0]?.value),
    publishedPurchaseTotalMinor: total(publishedPurchases[0]?.value),
  }
}

export const getCustomerContributionStages = async (
  database: CommerceDatabase,
  userId: string
): Promise<{
  pendingAllocationUnits: number
  finalDonationMinor: bigint
  transferredMinor: bigint
}> => {
  const finalAllocations = database
    .select({
      id: unitAllocation.id,
      unitId: unitAllocation.unitId,
      donationMinor: unitAllocation.donationMinor,
    })
    .from(unitAllocation)
    .innerJoin(allocationRun, eq(unitAllocation.allocationRunId, allocationRun.id))
    .where(eq(allocationRun.status, 'final'))
    .as('customer_final_allocations')

  const [app, cash, transferred] = await Promise.all([
    database
      .select({
        pending: sql<number>`count(*) filter (where ${finalAllocations.id} is null)`,
        final: sql<bigint>`coalesce(sum(${finalAllocations.donationMinor}), 0)`,
      })
      .from(commerceOrderUnit)
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .leftJoin(finalAllocations, eq(finalAllocations.unitId, commerceOrderUnit.id))
      .where(
        and(
          eq(productOrder.userId, userId),
          eq(productOrder.payMethod, 'app'),
          eq(commerceOrderSnapshot.fundingClassification, 'real'),
          eq(commerceOrderUnit.lifecycleStatus, 'redeemed')
        )
      ),
    database
      .select({ value: sql<bigint>`coalesce(sum(${creditDebt.principalMinor}), 0)` })
      .from(creditDebt)
      .innerJoin(commerceOrderUnit, eq(creditDebt.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .where(
        and(
          eq(productOrder.userId, userId),
          eq(commerceOrderSnapshot.fundingClassification, 'real')
        )
      ),
    database
      .select({
        value: sql<bigint>`coalesce(sum(${financialOperationAllocation.amountMinor}), 0)`,
      })
      .from(financialOperationAllocation)
      .innerJoin(
        financialOperation,
        eq(financialOperationAllocation.operationId, financialOperation.id)
      )
      .innerJoin(unitAllocation, eq(financialOperationAllocation.sourceId, unitAllocation.id))
      .innerJoin(commerceOrderUnit, eq(unitAllocation.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .where(
        and(
          eq(productOrder.userId, userId),
          eq(financialOperation.kind, 'foundation_payout'),
          eq(financialOperation.status, 'bank_verified'),
          eq(financialOperation.fundingClassification, 'real'),
          eq(financialOperationAllocation.sourceType, 'foundation_unit_allocation')
        )
      ),
  ])

  return {
    pendingAllocationUnits: Number(app[0]?.pending ?? 0),
    finalDonationMinor: total(app[0]?.final) + total(cash[0]?.value),
    transferredMinor: total(transferred[0]?.value),
  }
}
