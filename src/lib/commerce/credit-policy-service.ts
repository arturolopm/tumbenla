import 'server-only'

import { createHash } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  creditDebt,
  creditReservation,
  financeAuditEvent,
  venueCreditPolicy,
} from '@/database/commerce-schema'
import { venue } from '@/database/schema'
import { createId } from '@/lib/utils/id'

type CommerceDatabase = typeof db

export const DEFAULT_CASH_CREDIT_LIMIT_MINOR = BigInt(50_000_000)
export const DEFAULT_CASH_MAX_ACTIVE_RESERVATIONS = 100
export const DEFAULT_CASH_MAX_ACTIVE_PER_SHOPPER = 20
export const DEFAULT_CASH_RESERVATION_TTL_SECONDS = 900
export const DEFAULT_CASH_REPAYMENT_TERM_SECONDS = 604800

export type CreditOverview = Readonly<{
  venueId: string
  venueName: string
  venueSlug: string
  policyId: string | null
  policyStatus: string | null
  version: number | null
  limitMinor: bigint
  activeReservationMinor: bigint
  outstandingDebtMinor: bigint
  availableMinor: bigint
  overdueDebtCount: number
  maxActiveReservations: number
  maxActivePerShopper: number
}>

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

export class CreditPolicyService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async configurePolicy(input: {
    operationKey: string
    venueId: string
    limitMinor: bigint
    maxActiveReservations: number
    maxActivePerShopper: number
    approvedByUserId: string
    reservationTtlSeconds?: number
    repaymentTermSeconds?: number
  }): Promise<{ policyId: string; version: number; duplicate: boolean }> {
    const reservationTtlSeconds = input.reservationTtlSeconds ?? 900
    const repaymentTermSeconds = input.repaymentTermSeconds ?? 604800
    if (!/^[A-Za-z0-9:_-]{8,180}$/.test(input.operationKey)) {
      throw new Error('A durable policy operation key is required')
    }
    if (
      input.limitMinor < BigInt(0) ||
      !Number.isInteger(input.maxActiveReservations) ||
      !Number.isInteger(input.maxActivePerShopper) ||
      input.maxActiveReservations < 1 ||
      input.maxActivePerShopper < 1 ||
      input.maxActivePerShopper > input.maxActiveReservations ||
      !Number.isInteger(reservationTtlSeconds) ||
      reservationTtlSeconds < 60 ||
      !Number.isInteger(repaymentTermSeconds) ||
      repaymentTermSeconds < 3600
    ) {
      throw new Error('Invalid credit policy limits')
    }
    const contentHash = digest({
      venueId: input.venueId,
      limitMinor: input.limitMinor.toString(),
      maxActiveReservations: input.maxActiveReservations,
      maxActivePerShopper: input.maxActivePerShopper,
      reservationTtlSeconds,
      repaymentTermSeconds,
    })
    const now = this.#now()

    return this.#database.transaction(async (transaction) => {
      const [targetVenue] = await transaction
        .select({ id: venue.id })
        .from(venue)
        .where(eq(venue.id, input.venueId))
        .limit(1)
        .for('update')
      if (!targetVenue) throw new Error('The venue does not exist')

      const [existing] = await transaction
        .select({
          id: venueCreditPolicy.id,
          contentHash: venueCreditPolicy.contentHash,
          version: venueCreditPolicy.version,
        })
        .from(venueCreditPolicy)
        .where(eq(venueCreditPolicy.operationKey, input.operationKey))
        .limit(1)
      if (existing) {
        if (existing.contentHash !== contentHash) {
          throw new Error('Policy operation key was reused with different content')
        }
        return { policyId: existing.id, version: existing.version, duplicate: true }
      }

      const [latest] = await transaction
        .select({ id: venueCreditPolicy.id, version: venueCreditPolicy.version })
        .from(venueCreditPolicy)
        .where(eq(venueCreditPolicy.venueId, input.venueId))
        .orderBy(desc(venueCreditPolicy.version))
        .limit(1)
        .for('update')
      await transaction
        .update(venueCreditPolicy)
        .set({ status: 'retired', retiredAt: now })
        .where(
          and(eq(venueCreditPolicy.venueId, input.venueId), eq(venueCreditPolicy.status, 'active'))
        )

      const policyId = createId('vcp')
      const version = (latest?.version ?? 0) + 1
      await transaction.insert(venueCreditPolicy).values({
        id: policyId,
        operationKey: input.operationKey,
        contentHash,
        venueId: input.venueId,
        version,
        limitMinor: input.limitMinor,
        currency: 'COP',
        reservationTtlSeconds,
        repaymentTermSeconds,
        maxActiveReservations: input.maxActiveReservations,
        maxActivePerShopper: input.maxActivePerShopper,
        status: 'active',
        approvedByUserId: input.approvedByUserId,
        effectiveAt: now,
        createdAt: now,
      })
      await transaction.insert(financeAuditEvent).values({
        id: createId('fae'),
        entityType: 'venue_credit_policy',
        entityId: policyId,
        action: 'configured',
        actorUserId: input.approvedByUserId,
        operationKey: input.operationKey,
        previousState: latest ? `version:${latest.version}` : null,
        nextState: `version:${version}`,
        detail: {
          venueId: input.venueId,
          limitMinor: input.limitMinor.toString(),
          maxActiveReservations: input.maxActiveReservations,
          maxActivePerShopper: input.maxActivePerShopper,
        },
        createdAt: now,
      })
      return { policyId, version, duplicate: false }
    })
  }

  async listOverview(now = this.#now()): Promise<CreditOverview[]> {
    const venues = await this.#database
      .select({ id: venue.id, name: venue.name, slug: venue.slug })
      .from(venue)
      .orderBy(venue.name)
    const policies = await this.#database
      .select({
        id: venueCreditPolicy.id,
        venueId: venueCreditPolicy.venueId,
        status: venueCreditPolicy.status,
        version: venueCreditPolicy.version,
        limitMinor: venueCreditPolicy.limitMinor,
        effectiveAt: venueCreditPolicy.effectiveAt,
        retiredAt: venueCreditPolicy.retiredAt,
        maxActiveReservations: venueCreditPolicy.maxActiveReservations,
        maxActivePerShopper: venueCreditPolicy.maxActivePerShopper,
      })
      .from(venueCreditPolicy)
      .orderBy(desc(venueCreditPolicy.version))
    const reservations = await this.#database
      .select({
        venueId: creditReservation.venueId,
        amount: sql<string>`coalesce(sum(${creditReservation.amountMinor}), 0)`,
      })
      .from(creditReservation)
      .where(eq(creditReservation.status, 'active'))
      .groupBy(creditReservation.venueId)
    const debts = await this.#database
      .select({
        venueId: creditDebt.venueId,
        amount: sql<string>`coalesce(sum(${creditDebt.outstandingMinor}), 0)`,
        overdue: sql<string>`count(*) filter (where ${creditDebt.outstandingMinor} > 0 and ${creditDebt.dueAt} < ${now.toISOString()})`,
      })
      .from(creditDebt)
      .groupBy(creditDebt.venueId)

    const firstPolicy = new Map<string, (typeof policies)[number]>()
    for (const policy of policies) {
      if (!firstPolicy.has(policy.venueId)) firstPolicy.set(policy.venueId, policy)
    }
    const reservationByVenue = new Map(reservations.map((row) => [row.venueId, BigInt(row.amount)]))
    const debtByVenue = new Map(
      debts.map((row) => [
        row.venueId,
        { amount: BigInt(row.amount), overdue: Number(row.overdue) },
      ])
    )

    return venues.map((currentVenue) => {
      const policy = firstPolicy.get(currentVenue.id)
      const activeReservationMinor = reservationByVenue.get(currentVenue.id) ?? BigInt(0)
      const debt = debtByVenue.get(currentVenue.id) ?? { amount: BigInt(0), overdue: 0 }
      const policyIsActive =
        policy?.status === 'active' &&
        policy.effectiveAt <= now &&
        (!policy.retiredAt || policy.retiredAt > now)
      const limitMinor = policy
        ? policyIsActive
          ? policy.limitMinor
          : BigInt(0)
        : DEFAULT_CASH_CREDIT_LIMIT_MINOR
      return {
        venueId: currentVenue.id,
        venueName: currentVenue.name,
        venueSlug: currentVenue.slug,
        policyId: policy?.id ?? null,
        policyStatus: policy?.status ?? null,
        version: policy?.version ?? null,
        limitMinor,
        activeReservationMinor,
        outstandingDebtMinor: debt.amount,
        availableMinor: limitMinor - activeReservationMinor - debt.amount,
        overdueDebtCount: debt.overdue,
        maxActiveReservations:
          policy?.maxActiveReservations ?? DEFAULT_CASH_MAX_ACTIVE_RESERVATIONS,
        maxActivePerShopper: policy?.maxActivePerShopper ?? DEFAULT_CASH_MAX_ACTIVE_PER_SHOPPER,
      }
    })
  }
}
