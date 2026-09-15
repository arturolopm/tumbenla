import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationPolicy,
  commerceBeneficiary,
  commerceOrderSnapshot,
  commerceOrderUnit,
  creditDebt,
  creditReservation,
  financeAuditEvent,
  unitLifecycleOperation,
  venueCreditPolicy,
} from '@/database/commerce-schema'
import { orderRedemption, productOrder, venue, venueMember, venueProduct } from '@/database/schema'
import { generarCodigo } from '@/lib/comercio/codigos'
import { createId } from '@/lib/utils/id'
import {
  DEFAULT_CASH_CREDIT_LIMIT_MINOR,
  DEFAULT_CASH_MAX_ACTIVE_PER_SHOPPER,
  DEFAULT_CASH_MAX_ACTIVE_RESERVATIONS,
  DEFAULT_CASH_REPAYMENT_TERM_SECONDS,
  DEFAULT_CASH_RESERVATION_TTL_SECONDS,
} from './credit-policy-service'
import { formatMinorUnits, multiplyBasisPoints, parseMinorUnits } from './money'

type CommerceDatabase = typeof db
type CommerceTransaction = Parameters<Parameters<CommerceDatabase['transaction']>[0]>[0]

const MAX_CASH_UNITS = 20
const MIN_DONATION_BASIS_POINTS = 4_000

export type StartCashOrderInput = Readonly<{
  submissionKey: string
  productId: string
  buyerName: string
  buyerEmail: string
  quantity: number
  userId: string | null
}>

export type StartCashOrderResult =
  | Readonly<{
      kind: 'reserved'
      orderToken: string
      orderId: string
      codes: readonly string[]
      expiresAt: Date
      duplicate: boolean
    }>
  | Readonly<{ kind: 'conflict'; reason: 'submission-key-reused' }>
  | Readonly<{
      kind: 'unavailable'
      reason:
        | 'invalid-request'
        | 'product-unavailable'
        | 'commerce-not-configured'
        | 'credit-not-configured'
        | 'credit-exhausted'
        | 'overdue-debt'
        | 'self-order-not-allowed'
        | 'shopper-limit'
        | 'venue-reservation-limit'
    }>

type ExistingCashOrder = Readonly<{
  requestHash: string
  orderId: string
  orderToken: string
  snapshotId: string
  expiresAt: Date
}>

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex')
const hashJson = (value: unknown): string => sha256(JSON.stringify(value))
const reservationOperationKey = (submissionKey: string, ordinal: number): string =>
  `cash-reservation:${submissionKey}:${ordinal}`
const shopperKey = (input: StartCashOrderInput): string =>
  sha256(
    `cash-shopper:${
      input.userId ? `user:${input.userId}` : `email:${input.buyerEmail.trim().toLowerCase()}`
    }`
  )
const generateBearerToken = (): string => randomBytes(32).toString('base64url')

const validInput = (input: StartCashOrderInput): boolean =>
  /^[A-Za-z0-9_-]{16,128}$/.test(input.submissionKey) &&
  input.productId.length > 0 &&
  input.buyerName.trim().length >= 2 &&
  input.buyerName.trim().length <= 80 &&
  input.buyerEmail.trim().length > 3 &&
  input.buyerEmail.includes('@') &&
  Number.isInteger(input.quantity) &&
  input.quantity >= 1 &&
  input.quantity <= MAX_CASH_UNITS

const requestHashFor = (input: StartCashOrderInput): string =>
  hashJson({
    buyerEmail: input.buyerEmail.trim().toLowerCase(),
    buyerName: input.buyerName.trim(),
    productId: input.productId,
    quantity: input.quantity,
    userId: input.userId,
  })

export class CashCreditService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date
  readonly #generateCode: () => string
  readonly #generateToken: () => string
  readonly #fundingClassification: 'real' | 'sandbox'

  constructor(dependencies: {
    database: CommerceDatabase
    now?: () => Date
    generateCode?: () => string
    generateToken?: () => string
    fundingClassification: 'real' | 'sandbox'
  }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
    this.#generateCode = dependencies.generateCode ?? generarCodigo
    this.#generateToken = dependencies.generateToken ?? generateBearerToken
    this.#fundingClassification = dependencies.fundingClassification
  }

  async startOrder(input: StartCashOrderInput): Promise<StartCashOrderResult> {
    if (!validInput(input)) return { kind: 'unavailable', reason: 'invalid-request' }
    const requestHash = requestHashFor(input)
    const existing = await this.#findExisting(input.submissionKey)
    if (existing) return this.#existingResult(existing, requestHash)

    try {
      return await this.#database.transaction(async (transaction) => {
        const now = this.#now()
        const [product] = await transaction
          .select({
            id: venueProduct.id,
            name: venueProduct.name,
            kind: venueProduct.kind,
            description: venueProduct.description,
            price: venueProduct.price,
            donationPercentage: venueProduct.donationPercentage,
            venueId: venue.id,
            venueName: venue.name,
            venueStatus: venue.status,
            productStatus: venueProduct.status,
          })
          .from(venueProduct)
          .innerJoin(venue, eq(venueProduct.venueId, venue.id))
          .where(eq(venueProduct.id, input.productId))
          .limit(1)
        if (
          !product ||
          product.productStatus !== 'published' ||
          product.venueStatus !== 'published'
        ) {
          return { kind: 'unavailable', reason: 'product-unavailable' } as const
        }

        if (input.userId) {
          const [membership] = await transaction
            .select({ id: venueMember.id })
            .from(venueMember)
            .where(
              and(eq(venueMember.venueId, product.venueId), eq(venueMember.userId, input.userId))
            )
            .limit(1)
          if (membership) {
            return { kind: 'unavailable', reason: 'self-order-not-allowed' } as const
          }
        }

        const [lockedVenue] = await transaction
          .select({ status: venue.status })
          .from(venue)
          .where(eq(venue.id, product.venueId))
          .limit(1)
          .for('update')
        if (!lockedVenue || lockedVenue.status !== 'published') {
          return { kind: 'unavailable', reason: 'product-unavailable' } as const
        }

        const [latestPolicy] = await transaction
          .select({ id: venueCreditPolicy.id })
          .from(venueCreditPolicy)
          .where(eq(venueCreditPolicy.venueId, product.venueId))
          .orderBy(desc(venueCreditPolicy.version))
          .limit(1)
        if (!latestPolicy) {
          const policyId = createId('vcp')
          const operationKey = `credit-policy:default-500000:${product.venueId}`
          const defaultPolicy = {
            venueId: product.venueId,
            limitMinor: DEFAULT_CASH_CREDIT_LIMIT_MINOR.toString(),
            maxActiveReservations: DEFAULT_CASH_MAX_ACTIVE_RESERVATIONS,
            maxActivePerShopper: DEFAULT_CASH_MAX_ACTIVE_PER_SHOPPER,
            reservationTtlSeconds: DEFAULT_CASH_RESERVATION_TTL_SECONDS,
            repaymentTermSeconds: DEFAULT_CASH_REPAYMENT_TERM_SECONDS,
          }
          await transaction.insert(venueCreditPolicy).values({
            id: policyId,
            operationKey,
            contentHash: hashJson(defaultPolicy),
            venueId: product.venueId,
            version: 1,
            limitMinor: DEFAULT_CASH_CREDIT_LIMIT_MINOR,
            currency: 'COP',
            reservationTtlSeconds: DEFAULT_CASH_RESERVATION_TTL_SECONDS,
            repaymentTermSeconds: DEFAULT_CASH_REPAYMENT_TERM_SECONDS,
            maxActiveReservations: DEFAULT_CASH_MAX_ACTIVE_RESERVATIONS,
            maxActivePerShopper: DEFAULT_CASH_MAX_ACTIVE_PER_SHOPPER,
            status: 'active',
            effectiveAt: now,
            createdAt: now,
          })
          await transaction.insert(financeAuditEvent).values({
            id: createId('fae'),
            entityType: 'venue_credit_policy',
            entityId: policyId,
            action: 'defaulted',
            operationKey,
            previousState: null,
            nextState: 'version:1',
            detail: { ...defaultPolicy, source: 'system_default' },
            createdAt: now,
          })
        }

        const [policy] = await transaction
          .select({
            id: venueCreditPolicy.id,
            limitMinor: venueCreditPolicy.limitMinor,
            reservationTtlSeconds: venueCreditPolicy.reservationTtlSeconds,
            repaymentTermSeconds: venueCreditPolicy.repaymentTermSeconds,
            maxActiveReservations: venueCreditPolicy.maxActiveReservations,
            maxActivePerShopper: venueCreditPolicy.maxActivePerShopper,
          })
          .from(venueCreditPolicy)
          .where(
            and(
              eq(venueCreditPolicy.venueId, product.venueId),
              eq(venueCreditPolicy.currency, 'COP'),
              eq(venueCreditPolicy.status, 'active'),
              lte(venueCreditPolicy.effectiveAt, now),
              or(isNull(venueCreditPolicy.retiredAt), gt(venueCreditPolicy.retiredAt, now))
            )
          )
          .orderBy(desc(venueCreditPolicy.version))
          .limit(1)
          .for('update')
        if (!policy || policy.limitMinor <= BigInt(0)) {
          return { kind: 'unavailable', reason: 'credit-not-configured' } as const
        }

        const raced = await this.#findExistingInTransaction(transaction, input.submissionKey)
        if (raced) return this.#existingResult(raced, requestHash)
        await this.#expireReservations(transaction, product.venueId, now)

        const [exposure] = await transaction
          .select({
            activeMinor: sql<string>`coalesce(sum(${creditReservation.amountMinor}) filter (where ${creditReservation.status} = 'active'), 0)`,
            activeCount: sql<string>`count(*) filter (where ${creditReservation.status} = 'active')`,
            shopperCount: sql<string>`count(*) filter (where ${creditReservation.status} = 'active' and ${creditReservation.shopperKey} = ${shopperKey(input)})`,
          })
          .from(creditReservation)
          .where(eq(creditReservation.venueId, product.venueId))
        const [debt] = await transaction
          .select({
            outstandingMinor: sql<string>`coalesce(sum(${creditDebt.outstandingMinor}), 0)`,
            overdueCount: sql<string>`count(*) filter (where ${creditDebt.outstandingMinor} > 0 and ${creditDebt.dueAt} < ${now.toISOString()})`,
          })
          .from(creditDebt)
          .where(eq(creditDebt.venueId, product.venueId))
        if (Number(debt?.overdueCount ?? 0) > 0) {
          return { kind: 'unavailable', reason: 'overdue-debt' } as const
        }
        if (Number(exposure?.activeCount ?? 0) + input.quantity > policy.maxActiveReservations) {
          return { kind: 'unavailable', reason: 'venue-reservation-limit' } as const
        }
        if (Number(exposure?.shopperCount ?? 0) + input.quantity > policy.maxActivePerShopper) {
          return { kind: 'unavailable', reason: 'shopper-limit' } as const
        }

        const unitGrossMinor = parseMinorUnits(product.price)
        const donationBasisPoints = Number(parseMinorUnits(product.donationPercentage))
        if (donationBasisPoints < MIN_DONATION_BASIS_POINTS || donationBasisPoints > 10_000) {
          return { kind: 'unavailable', reason: 'product-unavailable' } as const
        }
        const unitDonationMinor = multiplyBasisPoints(unitGrossMinor, donationBasisPoints)
        const requestedCredit = unitDonationMinor * BigInt(input.quantity)
        const availableCredit =
          policy.limitMinor -
          BigInt(debt?.outstandingMinor ?? 0) -
          BigInt(exposure?.activeMinor ?? 0)
        if (requestedCredit > availableCredit) {
          return { kind: 'unavailable', reason: 'credit-exhausted' } as const
        }

        const foundations = await transaction
          .select({ id: commerceBeneficiary.id, legalName: commerceBeneficiary.legalName })
          .from(commerceBeneficiary)
          .where(
            and(
              eq(commerceBeneficiary.kind, 'foundation'),
              eq(commerceBeneficiary.status, 'verified')
            )
          )
          .orderBy(commerceBeneficiary.createdAt)
          .limit(2)
        const [allocation] = await transaction
          .select({ id: allocationPolicy.id })
          .from(allocationPolicy)
          .where(
            and(
              lte(allocationPolicy.effectiveAt, now),
              or(isNull(allocationPolicy.retiredAt), gt(allocationPolicy.retiredAt, now))
            )
          )
          .orderBy(desc(allocationPolicy.version))
          .limit(1)
        if (foundations.length !== 1 || !allocation) {
          return { kind: 'unavailable', reason: 'commerce-not-configured' } as const
        }

        const expiresAt = new Date(now.getTime() + policy.reservationTtlSeconds * 1_000)
        const orderId = createId('ord')
        const snapshotId = createId('cos')
        const orderToken = this.#generateToken()
        const grossMinor = unitGrossMinor * BigInt(input.quantity)
        const unitVenueMinor = unitGrossMinor - unitDonationMinor
        await transaction.insert(productOrder).values({
          id: orderId,
          productId: product.id,
          venueId: product.venueId,
          userId: input.userId,
          buyerName: input.buyerName.trim(),
          buyerEmail: input.buyerEmail.trim().toLowerCase(),
          quantity: String(input.quantity),
          unitPrice: formatMinorUnits(unitGrossMinor),
          donationPercentage: formatMinorUnits(BigInt(donationBasisPoints)),
          unitDonationAmount: formatMinorUnits(unitDonationMinor),
          unitVenueAmount: formatMinorUnits(unitVenueMinor),
          totalAmount: formatMinorUnits(grossMinor),
          currency: 'COP',
          publicToken: orderToken,
          payMethod: 'bar',
          status: 'pending',
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        await transaction.insert(commerceOrderSnapshot).values({
          id: snapshotId,
          orderId,
          schemaVersion: 1,
          productName: product.name,
          productKind: product.kind,
          productDescription: product.description,
          venueName: product.venueName,
          currency: 'COP',
          quantity: input.quantity,
          unitGrossMinor,
          donationBasisPoints,
          allocationPolicyId: allocation.id,
          foundationBeneficiaryId: foundations[0]!.id,
          foundationLegalName: foundations[0]!.legalName,
          policyDisclosure: `El ${formatMinorUnits(BigInt(donationBasisPoints))}% se debe al confirmar la preparación en la barra.`,
          fundingClassification: this.#fundingClassification,
          createdAt: now,
        })

        const codes: string[] = []
        for (let index = 0; index < input.quantity; index += 1) {
          const ordinal = index + 1
          const code = this.#generateCode()
          const redemptionId = createId('red')
          const unitId = createId('cou')
          codes.push(code)
          await transaction.insert(orderRedemption).values({
            id: redemptionId,
            orderId,
            code,
            status: 'issued',
            createdAt: now,
            updatedAt: now,
          })
          await transaction.insert(commerceOrderUnit).values({
            id: unitId,
            orderSnapshotId: snapshotId,
            redemptionId,
            ordinal,
            grossMinor: unitGrossMinor,
            lifecycleStatus: 'issued',
            expiresAt,
            createdAt: now,
            updatedAt: now,
          })
          await transaction.insert(creditReservation).values({
            id: createId('crs'),
            operationKey: reservationOperationKey(input.submissionKey, ordinal),
            contentHash: requestHash,
            policyId: policy.id,
            venueId: product.venueId,
            unitId,
            amountMinor: unitDonationMinor,
            shopperKey: shopperKey(input),
            currency: 'COP',
            status: 'active',
            expiresAt,
            createdAt: now,
          })
        }

        return { kind: 'reserved', orderToken, orderId, codes, expiresAt, duplicate: false }
      })
    } catch (error) {
      if (
        typeof error !== 'object' ||
        error === null ||
        (error as { code?: string }).code !== '23505'
      ) {
        throw error
      }
      const raced = await this.#findExisting(input.submissionKey)
      if (!raced) throw error
      return this.#existingResult(raced, requestHash)
    }
  }

  async #findExisting(submissionKey: string): Promise<ExistingCashOrder | undefined> {
    return this.#findExistingInTransaction(this.#database, submissionKey)
  }

  async #findExistingInTransaction(
    connection: CommerceDatabase | CommerceTransaction,
    submissionKey: string
  ): Promise<ExistingCashOrder | undefined> {
    const [row] = await connection
      .select({
        requestHash: creditReservation.contentHash,
        orderId: productOrder.id,
        orderToken: productOrder.publicToken,
        snapshotId: commerceOrderSnapshot.id,
        expiresAt: creditReservation.expiresAt,
      })
      .from(creditReservation)
      .innerJoin(commerceOrderUnit, eq(creditReservation.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .where(eq(creditReservation.operationKey, reservationOperationKey(submissionKey, 1)))
      .limit(1)
    return row
  }

  async #existingResult(
    existing: ExistingCashOrder,
    requestHash: string
  ): Promise<StartCashOrderResult> {
    if (existing.requestHash !== requestHash) {
      return { kind: 'conflict', reason: 'submission-key-reused' }
    }
    const rows = await this.#database
      .select({ code: orderRedemption.code })
      .from(commerceOrderUnit)
      .innerJoin(orderRedemption, eq(commerceOrderUnit.redemptionId, orderRedemption.id))
      .where(eq(commerceOrderUnit.orderSnapshotId, existing.snapshotId))
      .orderBy(commerceOrderUnit.ordinal)
    return {
      kind: 'reserved',
      orderToken: existing.orderToken,
      orderId: existing.orderId,
      codes: rows.map((row) => row.code),
      expiresAt: existing.expiresAt,
      duplicate: true,
    }
  }

  async #expireReservations(
    transaction: CommerceTransaction,
    venueId: string,
    now: Date
  ): Promise<void> {
    const expired = await transaction
      .select({
        reservationId: creditReservation.id,
        unitId: commerceOrderUnit.id,
        redemptionId: commerceOrderUnit.redemptionId,
        snapshotId: commerceOrderUnit.orderSnapshotId,
        orderId: commerceOrderSnapshot.orderId,
      })
      .from(creditReservation)
      .innerJoin(commerceOrderUnit, eq(creditReservation.unitId, commerceOrderUnit.id))
      .innerJoin(
        commerceOrderSnapshot,
        eq(commerceOrderUnit.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .where(
        and(
          eq(creditReservation.venueId, venueId),
          eq(creditReservation.status, 'active'),
          lte(creditReservation.expiresAt, now)
        )
      )
      .for('update')
    if (expired.length === 0) return

    const reservationIds = expired.map((row) => row.reservationId)
    const unitIds = expired.map((row) => row.unitId)
    const redemptionIds = expired.flatMap((row) => (row.redemptionId ? [row.redemptionId] : []))
    await transaction
      .update(creditReservation)
      .set({ status: 'expired', releasedAt: now })
      .where(
        and(inArray(creditReservation.id, reservationIds), eq(creditReservation.status, 'active'))
      )
    await transaction
      .update(commerceOrderUnit)
      .set({ lifecycleStatus: 'expired', updatedAt: now })
      .where(
        and(inArray(commerceOrderUnit.id, unitIds), eq(commerceOrderUnit.lifecycleStatus, 'issued'))
      )
    if (redemptionIds.length > 0) {
      await transaction
        .update(orderRedemption)
        .set({ status: 'void', updatedAt: now })
        .where(
          and(inArray(orderRedemption.id, redemptionIds), eq(orderRedemption.status, 'issued'))
        )
    }
    await transaction
      .update(productOrder)
      .set({ status: 'expired', updatedAt: now })
      .where(inArray(productOrder.id, [...new Set(expired.map((row) => row.orderId))]))

    await transaction.insert(unitLifecycleOperation).values(
      expired.map((row) => ({
        id: createId('ulo'),
        operationKey: `cash-expire:${row.unitId}`,
        contentHash: hashJson({ kind: 'expire', unitId: row.unitId }),
        unitId: row.unitId,
        kind: 'expire',
        status: 'completed',
        detail: { orderId: row.orderId, source: 'cash_reservation' },
        createdAt: now,
      }))
    )
    await transaction.insert(financeAuditEvent).values(
      expired.map((row) => ({
        id: createId('fae'),
        entityType: 'credit_reservation',
        entityId: row.reservationId,
        action: 'expired_released',
        operationKey: `cash-expire:${row.unitId}`,
        previousState: 'active',
        nextState: 'expired',
        detail: { unitId: row.unitId, orderId: row.orderId },
        createdAt: now,
      }))
    )
  }
}
