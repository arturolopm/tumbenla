import 'server-only'

import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationRun,
  commerceOrderSnapshot,
  commerceOrderUnit,
  creditDebt,
  creditReservation,
  financialOperation,
  paymentCharge,
  unitAllocation,
  venueCreditPolicy,
} from '@/database/commerce-schema'
import { productOrder } from '@/database/schema'
import { DEFAULT_CASH_CREDIT_LIMIT_MINOR } from './credit-policy-service'

type CommerceDatabase = typeof db

export type VenueFinanceView = Readonly<{
  earnedMinor: bigint
  pendingMinor: bigint
  payoutReservedMinor: bigint
  paidMinor: bigint
  debtMinor: bigint
  creditLimitMinor: bigint
  creditAvailableMinor: bigint
  oldestDebtDueAt: Date | null
}>

const total = (value: bigint | string | number | null | undefined): bigint => BigInt(value ?? 0)

export const getVenueFinanceView = async (
  database: CommerceDatabase,
  venueId: string,
  now = new Date()
): Promise<VenueFinanceView> => {
  const finalAllocations = database
    .select({
      id: unitAllocation.id,
      unitId: unitAllocation.unitId,
      venueMinor: unitAllocation.venueMinor,
      chargeStatus: paymentCharge.status,
    })
    .from(unitAllocation)
    .innerJoin(allocationRun, eq(unitAllocation.allocationRunId, allocationRun.id))
    .innerJoin(paymentCharge, eq(allocationRun.chargeId, paymentCharge.id))
    .where(eq(allocationRun.status, 'final'))
    .as('venue_final_allocations')

  const [app, cash, payouts, debts, policy, reservations] = await Promise.all([
    database
      .select({
        earned: sql<bigint>`coalesce(sum(case when ${finalAllocations.chargeStatus} = 'approved' then ${finalAllocations.venueMinor} else 0 end), 0)`,
        pending: sql<bigint>`coalesce(sum(case when ${finalAllocations.id} is null then (${commerceOrderUnit.grossMinor} * (10000 - ${commerceOrderSnapshot.donationBasisPoints})) / 10000 when ${finalAllocations.chargeStatus} <> 'approved' then ${finalAllocations.venueMinor} else 0 end), 0)`,
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
          eq(productOrder.venueId, venueId),
          eq(productOrder.payMethod, 'app'),
          eq(commerceOrderSnapshot.fundingClassification, 'real'),
          eq(commerceOrderUnit.lifecycleStatus, 'redeemed')
        )
      ),
    database
      .select({
        earned: sql<bigint>`coalesce(sum(${commerceOrderUnit.grossMinor} - ${creditDebt.principalMinor}), 0)`,
      })
      .from(creditDebt)
      .innerJoin(commerceOrderUnit, eq(creditDebt.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .where(
        and(
          eq(creditDebt.venueId, venueId),
          eq(commerceOrderSnapshot.fundingClassification, 'real')
        )
      ),
    database
      .select({
        reserved: sql<bigint>`coalesce(sum(case when ${financialOperation.status} in ('prepared', 'submitted_unknown') then ${financialOperation.amountMinor} else 0 end), 0)`,
        paid: sql<bigint>`coalesce(sum(case when ${financialOperation.status} = 'bank_verified' then ${financialOperation.amountMinor} else 0 end), 0)`,
      })
      .from(financialOperation)
      .where(
        and(
          eq(financialOperation.kind, 'venue_payout'),
          eq(financialOperation.venueId, venueId),
          eq(financialOperation.fundingClassification, 'real'),
          inArray(financialOperation.status, ['prepared', 'submitted_unknown', 'bank_verified'])
        )
      ),
    database
      .select({
        outstanding: sql<bigint>`coalesce(sum(${creditDebt.outstandingMinor}), 0)`,
        oldestDueAt: sql<Date | null>`min(${creditDebt.dueAt}) filter (where ${creditDebt.outstandingMinor} > 0)`,
      })
      .from(creditDebt)
      .where(eq(creditDebt.venueId, venueId)),
    database
      .select({
        limitMinor: venueCreditPolicy.limitMinor,
        status: venueCreditPolicy.status,
        effectiveAt: venueCreditPolicy.effectiveAt,
        retiredAt: venueCreditPolicy.retiredAt,
      })
      .from(venueCreditPolicy)
      .where(and(eq(venueCreditPolicy.venueId, venueId), eq(venueCreditPolicy.currency, 'COP')))
      .orderBy(desc(venueCreditPolicy.version))
      .limit(1),
    database
      .select({ value: sql<bigint>`coalesce(sum(${creditReservation.amountMinor}), 0)` })
      .from(creditReservation)
      .where(
        and(
          eq(creditReservation.venueId, venueId),
          eq(creditReservation.status, 'active'),
          gt(creditReservation.expiresAt, now)
        )
      ),
  ])

  const debtMinor = total(debts[0]?.outstanding)
  const latestPolicy = policy[0]
  const policyIsActive =
    latestPolicy?.status === 'active' &&
    latestPolicy.effectiveAt <= now &&
    (!latestPolicy.retiredAt || latestPolicy.retiredAt > now)
  const creditLimitMinor = latestPolicy
    ? policyIsActive
      ? total(latestPolicy.limitMinor)
      : BigInt(0)
    : DEFAULT_CASH_CREDIT_LIMIT_MINOR
  const reservedCreditMinor = total(reservations[0]?.value)
  const creditAvailableMinor = creditLimitMinor - debtMinor - reservedCreditMinor
  const oldestDebtDueAt = debts[0]?.oldestDueAt
  return {
    earnedMinor: total(app[0]?.earned) + total(cash[0]?.earned),
    pendingMinor: total(app[0]?.pending),
    payoutReservedMinor: total(payouts[0]?.reserved),
    paidMinor: total(payouts[0]?.paid),
    debtMinor,
    creditLimitMinor,
    creditAvailableMinor: creditAvailableMinor > BigInt(0) ? creditAvailableMinor : BigInt(0),
    oldestDebtDueAt:
      oldestDebtDueAt instanceof Date
        ? oldestDebtDueAt
        : oldestDebtDueAt
          ? new Date(String(oldestDebtDueAt))
          : null,
  }
}
