import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { AllocationService } from '../../src/lib/commerce/allocation-service'
import { CashCreditService } from '../../src/lib/commerce/cash-credit-service'
import {
  DEFAULT_CASH_CREDIT_LIMIT_MINOR,
  CreditPolicyService,
} from '../../src/lib/commerce/credit-policy-service'
import { CreditSettlementService } from '../../src/lib/commerce/credit-settlement-service'
import { CommerceUnitService } from '../../src/lib/commerce/unit-lifecycle-service'
import { PayoutService } from '../../src/lib/commerce/payout-service'
import { getVenueFinanceView } from '../../src/lib/commerce/venue-finance-view'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined
let codeSequence = 0
const START = new Date('2026-09-12T12:00:00.000Z')
const ACTOR_ID = 'cash-credit-actor'

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into "user" (id, name, email, email_verified)
    values (${ACTOR_ID}, 'Mesero caja', 'mesero-caja@example.test', true)
  `
  await database.sql`
    insert into commerce_beneficiary
      (id, kind, legal_name, legal_identifier_hash, status, verified_at)
    values ('cash-foundation', 'foundation', 'Fundación caja', 'cash-foundation-hash',
            'verified', now())
  `
  await database.sql`
    insert into allocation_policy (id, version, name, effective_at)
    values (
      'cash-allocation-policy',
      1,
      'Política caja',
      ${new Date(START.getTime() - 60_000).toISOString()}
    )
  `
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

const seedVenue = async (
  suffix: string,
  policy?: {
    limitMinor?: bigint
    ttlSeconds?: number
    termSeconds?: number
    maxActive?: number
    maxPerShopper?: number
  }
): Promise<{ productId: string; venueId: string }> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const venueId = `cash-venue-${suffix}`
  const productId = `cash-product-${suffix}`
  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values (${venueId}, ${venueId}, ${`Venue ${suffix}`}, 'bar', 'Calle 1', 'Bogotá',
            'Bogotá D.C.', 4.710989, -74.072090, 'published')
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, price, currency, donation_percentage, status)
    values (${productId}, ${venueId}, ${productId}, ${`Product ${suffix}`}, 'coctel',
            100.00, 'COP', 50.00, 'published')
  `
  await database.sql`
    insert into venue_member (id, venue_id, user_id, role)
    values (${`cash-member-${suffix}`}, ${venueId}, ${ACTOR_ID}, 'staff')
  `
  if (policy) {
    await database.sql`
      insert into venue_credit_policy
        (id, venue_id, version, limit_minor, currency, reservation_ttl_seconds,
         repayment_term_seconds, max_active_reservations, max_active_per_shopper,
         status, effective_at)
      values (${`cash-policy-${suffix}`}, ${venueId}, 1,
              ${String(policy.limitMinor ?? BigInt(10_000))}, 'COP',
              ${policy.ttlSeconds ?? 900}, ${policy.termSeconds ?? 604800},
              ${policy.maxActive ?? 20}, ${policy.maxPerShopper ?? 20}, 'active',
              ${new Date(START.getTime() - 60_000).toISOString()})
    `
  }
  return { productId, venueId }
}

const createService = (now: Date): CashCreditService => {
  if (!database) throw new Error('Commerce test database was not initialized')
  return new CashCreditService({
    database: database.db,
    now: () => now,
    fundingClassification: 'real',
    generateCode: () => (++codeSequence).toString(32).toUpperCase().padStart(8, '0'),
    generateToken: () => `cash-token-${crypto.randomUUID()}`,
  })
}

const input = (suffix: string, productId: string, quantity = 1) => ({
  submissionKey: `cash_${suffix.padEnd(20, 'x')}`,
  productId,
  buyerName: 'Persona caja',
  buyerEmail: `${suffix}@example.test`,
  quantity,
  userId: null,
})

const seedClearedAppAllocation = async (input: {
  suffix: string
  productId: string
  venueId: string
}): Promise<string> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const orderId = `offset-order-${input.suffix}`
  const snapshotId = `offset-snapshot-${input.suffix}`
  const unitId = `offset-unit-${input.suffix}`
  const attemptId = `offset-attempt-${input.suffix}`
  const chargeId = `offset-charge-${input.suffix}`
  await database.sql`
    insert into product_order
      (id, product_id, venue_id, buyer_name, buyer_email, quantity, unit_price,
       donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
       public_token, pay_method, status, provider, provider_reference, paid_at)
    values (${orderId}, ${input.productId}, ${input.venueId}, 'Persona app',
            'persona-app@example.test', 1, 100.00, 50.00, 50.00, 50.00, 100.00,
            ${`offset-token-${input.suffix}`}, 'app', 'paid', 'epayco',
            ${`offset-reference-${input.suffix}`}, now())
  `
  await database.sql`
    insert into commerce_order_snapshot
      (id, order_id, product_name, product_kind, venue_name, currency, quantity,
       unit_gross_minor, donation_basis_points, allocation_policy_id,
       foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
       funding_classification)
    values (${snapshotId}, ${orderId}, 'Producto app', 'coctel', 'Venue app', 'COP', 1,
            10000, 5000, 'cash-allocation-policy', 'cash-foundation', 'Fundación caja',
            'Reparto app', 'real')
  `
  await database.sql`
    insert into commerce_order_unit
      (id, order_snapshot_id, ordinal, gross_minor, lifecycle_status, redeemed_at)
    values (${unitId}, ${snapshotId}, 1, 10000, 'redeemed', now())
  `
  await database.sql`
    insert into payment_attempt
      (id, order_snapshot_id, submission_key, request_hash, provider,
       provider_config_version, merchant_account_key, environment,
       provider_attempt_reference, status)
    values (${attemptId}, ${snapshotId}, ${`offset-submission-${input.suffix}`}, 'hash',
            'epayco', 'live-v1', 'merchant-offset', 'live',
            ${`offset-reference-${input.suffix}`}, 'approved')
  `
  await database.sql`
    insert into payment_charge
      (id, attempt_id, provider, merchant_account_key, environment, provider_reference,
       provider_transaction_id, gross_minor, currency, status, approved_at)
    values (${chargeId}, ${attemptId}, 'epayco', 'merchant-offset', 'live',
            ${`offset-reference-${input.suffix}`}, ${`offset-transaction-${input.suffix}`},
            10000, 'COP', 'approved', now())
  `
  await database.sql`
    insert into finance_account (id, kind, owner_key, currency, funding_classification)
    values
      ('offset-receivable', 'gateway_receivable', 'epayco:merchant-offset:live', 'COP', 'real'),
      (${`offset-held-${input.suffix}`}, 'customer_funds_held', ${snapshotId}, 'COP', 'real')
    on conflict do nothing
  `
  await database.sql.begin(async (transaction) => {
    await transaction`
      insert into finance_transaction
        (id, operation_key, content_hash, kind, currency, status, order_snapshot_id)
      values (${`offset-approval-${input.suffix}`}, ${`offset-approval-op-${input.suffix}`},
              'approval-hash', 'payment_approved', 'COP', 'draft', ${snapshotId})
    `
    await transaction`
      insert into finance_entry (id, transaction_id, account_id, amount_minor, ordinal)
      values
        (${`offset-approval-debit-${input.suffix}`}, ${`offset-approval-${input.suffix}`},
         'offset-receivable', 10000, 1),
        (${`offset-approval-credit-${input.suffix}`}, ${`offset-approval-${input.suffix}`},
         ${`offset-held-${input.suffix}`}, -10000, 2)
    `
    await transaction`
      update finance_transaction set status = 'posted', posted_at = now()
      where id = ${`offset-approval-${input.suffix}`}
    `
  })
  const allocation = await new AllocationService({
    database: database.db,
    now: () => START,
  }).reconcileCharge({
    chargeId,
    operationKey: `allocation:offset:${input.suffix}`,
    deductions: [],
  })
  const [row] = await database.sql<{ id: string }[]>`
    select id from unit_allocation where allocation_run_id = ${allocation.allocationRunId}
  `
  if (!row) throw new Error('Expected an app allocation source')
  return row.id
}

describe('CashCreditService', () => {
  test('starts every venue with an audited COP 500,000 cash credit policy', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('automatic-default')
    const policies = new CreditPolicyService({ database: database.db, now: () => START })

    const beforeOrder = (await policies.listOverview()).find(
      (row) => row.venueId === fixture.venueId
    )
    const venueFinances = await getVenueFinanceView(database.db, fixture.venueId, START)
    expect(beforeOrder).toMatchObject({
      version: null,
      limitMinor: DEFAULT_CASH_CREDIT_LIMIT_MINOR,
      availableMinor: DEFAULT_CASH_CREDIT_LIMIT_MINOR,
    })
    expect(venueFinances.creditLimitMinor).toBe(DEFAULT_CASH_CREDIT_LIMIT_MINOR)

    const result = await createService(START).startOrder(
      input('automatic-default', fixture.productId)
    )

    expect(result).toMatchObject({ kind: 'reserved', duplicate: false })
    const [policy] = await database.sql<
      {
        version: number
        limit_minor: string
        approved_by_user_id: string | null
        audit_events: string
      }[]
    >`
      select p.version, p.limit_minor::text, p.approved_by_user_id,
        (select count(*)::text from finance_audit_event e
          where e.entity_id = p.id and e.action = 'defaulted') as audit_events
      from venue_credit_policy p where p.venue_id = ${fixture.venueId}
    `
    expect(policy).toEqual({
      version: 1,
      limit_minor: DEFAULT_CASH_CREDIT_LIMIT_MINOR.toString(),
      approved_by_user_id: null,
      audit_events: '1',
    })
  }, 30_000)

  test('does not restore the automatic cupo after an operator sets it to zero', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('manual-zero', { limitMinor: BigInt(0) })

    const result = await createService(START).startOrder(input('manual-zero', fixture.productId))

    expect(result).toEqual({ kind: 'unavailable', reason: 'credit-not-configured' })
    const policies = await database.sql`
      select id from venue_credit_policy where venue_id = ${fixture.venueId}
    `
    expect(policies).toHaveLength(1)
  }, 30_000)

  test('creates the automatic policy once under concurrent first orders', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('default-race')

    const results = await Promise.all([
      createService(START).startOrder(input('default-race-a', fixture.productId)),
      createService(START).startOrder(input('default-race-b', fixture.productId)),
    ])

    expect(results.every((result) => result.kind === 'reserved')).toBe(true)
    const [counts] = await database.sql<{ policies: string; audit_events: string }[]>`
      select
        count(*)::text as policies,
        (select count(*)::text from finance_audit_event e
          where e.entity_type = 'venue_credit_policy'
            and e.detail->>'venueId' = ${fixture.venueId}) as audit_events
      from venue_credit_policy where venue_id = ${fixture.venueId}
    `
    expect(counts).toEqual({ policies: '1', audit_events: '1' })
  }, 30_000)

  test('reserves the exact limit once and never extends the deadline on retry', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('exact-limit', { limitMinor: BigInt(10_000) })
    const request = input('exact-limit', fixture.productId, 2)

    const first = await createService(START).startOrder(request)
    const retry = await createService(new Date(START.getTime() + 5 * 60_000)).startOrder(request)
    const over = await createService(START).startOrder(input('exact-limit-over', fixture.productId))

    expect(first).toMatchObject({ kind: 'reserved', duplicate: false })
    expect(retry).toMatchObject({ kind: 'reserved', duplicate: true })
    if (first.kind !== 'reserved' || retry.kind !== 'reserved') {
      throw new Error('Expected reserved cash orders')
    }
    expect(retry.orderId).toBe(first.orderId)
    expect(retry.expiresAt).toEqual(first.expiresAt)
    expect(over).toEqual({ kind: 'unavailable', reason: 'credit-exhausted' })
    const [counts] = await database.sql<{ orders: string; units: string; reservations: string }[]>`
      select
        count(distinct o.id)::text as orders,
        count(distinct u.id)::text as units,
        count(distinct r.id)::text as reservations
      from product_order o
      join commerce_order_snapshot s on s.order_id = o.id
      join commerce_order_unit u on u.order_snapshot_id = s.id
      join credit_reservation r on r.unit_id = u.id
      where o.venue_id = ${fixture.venueId}
    `
    expect(counts).toEqual({ orders: '1', units: '2', reservations: '2' })
  }, 30_000)

  test('rejects conflicting submission-key reuse', async () => {
    const fixture = await seedVenue('idempotency-conflict', { limitMinor: BigInt(20_000) })
    const service = createService(START)
    const request = input('idempotency-conflict', fixture.productId)
    await service.startOrder(request)

    const conflict = await service.startOrder({ ...request, quantity: 2 })

    expect(conflict).toEqual({ kind: 'conflict', reason: 'submission-key-reused' })
  }, 30_000)

  test('serializes concurrent reservations at the credit boundary', async () => {
    const fixture = await seedVenue('concurrent-limit', { limitMinor: BigInt(5_000) })
    const service = createService(START)

    const results = await Promise.all([
      service.startOrder(input('concurrent-limit-a', fixture.productId)),
      service.startOrder(input('concurrent-limit-b', fixture.productId)),
    ])

    expect(results.filter((result) => result.kind === 'reserved')).toHaveLength(1)
    expect(
      results.filter(
        (result) => result.kind === 'unavailable' && result.reason === 'credit-exhausted'
      )
    ).toHaveLength(1)
  }, 30_000)

  test('releases expired reservations before evaluating new capacity', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('reservation-expiry', {
      limitMinor: BigInt(5_000),
      ttlSeconds: 900,
    })
    const first = await createService(START).startOrder(
      input('reservation-expiry-a', fixture.productId)
    )
    const afterDeadline = new Date(START.getTime() + 901_000)

    const second = await createService(afterDeadline).startOrder(
      input('reservation-expiry-b', fixture.productId)
    )

    expect(first).toMatchObject({ kind: 'reserved' })
    expect(second).toMatchObject({ kind: 'reserved' })
    const [states] = await database.sql<{ expired: string; active: string; void_codes: string }[]>`
      select
        count(*) filter (where r.status = 'expired')::text as expired,
        count(*) filter (where r.status = 'active')::text as active,
        count(*) filter (where q.status = 'void')::text as void_codes
      from credit_reservation r
      join commerce_order_unit u on u.id = r.unit_id
      join order_redemption q on q.id = u.redemption_id
      where r.venue_id = ${fixture.venueId}
    `
    expect(states).toEqual({ expired: '1', active: '1', void_codes: '1' })
  }, 30_000)

  test('enforces per-shopper and venue active-reservation bounds in the database', async () => {
    const fixture = await seedVenue('abuse-bounds', {
      limitMinor: BigInt(100_000),
      maxActive: 2,
      maxPerShopper: 1,
    })
    const service = createService(START)

    const shopper = await service.startOrder(input('abuse-bounds-a', fixture.productId, 2))
    const first = await service.startOrder(input('abuse-bounds-b', fixture.productId))
    const second = await service.startOrder(input('abuse-bounds-c', fixture.productId))
    const venueBound = await service.startOrder(input('abuse-bounds-d', fixture.productId))

    expect(shopper).toEqual({ kind: 'unavailable', reason: 'shopper-limit' })
    expect(first).toMatchObject({ kind: 'reserved' })
    expect(second).toMatchObject({ kind: 'reserved' })
    expect(venueBound).toEqual({ kind: 'unavailable', reason: 'venue-reservation-limit' })
  }, 30_000)

  test('uses a stable hashed shopper identity across fresh submission keys', async () => {
    const fixture = await seedVenue('stable-shopper', {
      limitMinor: BigInt(100_000),
      maxActive: 20,
      maxPerShopper: 1,
    })
    const service = createService(START)
    const firstRequest = input('stable-shopper-a', fixture.productId)

    const first = await service.startOrder(firstRequest)
    const second = await service.startOrder({
      ...input('stable-shopper-b', fixture.productId),
      buyerEmail: firstRequest.buyerEmail.toUpperCase(),
    })

    expect(first).toMatchObject({ kind: 'reserved' })
    expect(second).toEqual({ kind: 'unavailable', reason: 'shopper-limit' })
  }, 30_000)

  test('rejects cash-credit self-orders by members of the same venue', async () => {
    const fixture = await seedVenue('self-order', { limitMinor: BigInt(10_000) })

    const result = await createService(START).startOrder({
      ...input('self-order', fixture.productId),
      userId: ACTOR_ID,
    })

    expect(result).toEqual({ kind: 'unavailable', reason: 'self-order-not-allowed' })
    const orders = await database!.sql`
      select id from product_order where venue_id = ${fixture.venueId}
    `
    expect(orders).toHaveLength(0)
  }, 30_000)

  test('turns a redeemed reservation into seven-day debt and a balanced payable', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('cash-redemption', {
      limitMinor: BigInt(10_000),
      termSeconds: 604800,
    })
    const reserved = await createService(START).startOrder(
      input('cash-redemption', fixture.productId)
    )
    if (reserved.kind !== 'reserved') throw new Error('Expected a cash reservation')

    const redeemed = await new CommerceUnitService({
      database: database.db,
      now: () => START,
    }).redeem({
      code: reserved.codes[0]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:cash-redemption:first',
    })

    expect(redeemed).toMatchObject({
      kind: 'redeemed',
      collectMinor: BigInt(10_000),
      duplicate: false,
    })
    const [state] = await database.sql<
      {
        reservation: string
        outstanding: string
        due_at: Date
        order_status: string
        entries: string
        difference: string
      }[]
    >`
      select r.status as reservation, d.outstanding_minor::text as outstanding,
             d.due_at, o.status as order_status,
             count(e.id)::text as entries, coalesce(sum(e.amount_minor), 0)::text as difference
      from credit_reservation r
      join credit_debt d on d.reservation_id = r.id
      join commerce_order_unit u on u.id = r.unit_id
      join commerce_order_snapshot s on s.id = u.order_snapshot_id
      join product_order o on o.id = s.order_id
      join finance_transaction t on t.order_snapshot_id = s.id and t.kind = 'cash_debt_incurred'
      join finance_entry e on e.transaction_id = t.id
      where o.id = ${reserved.orderId}
      group by r.status, d.outstanding_minor, d.due_at, o.status
    `
    expect(state).toMatchObject({
      reservation: 'consumed',
      outstanding: '5000',
      order_status: 'paid',
      entries: '2',
      difference: '0',
    })
    expect(new Date(String(state?.due_at))).toEqual(new Date(START.getTime() + 604800 * 1_000))
  }, 30_000)

  test('blocks new cash reservations once debt is overdue without affecting app checkout', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('overdue-debt', {
      limitMinor: BigInt(20_000),
      termSeconds: 604800,
    })
    const reserved = await createService(START).startOrder(
      input('overdue-debt-a', fixture.productId)
    )
    if (reserved.kind !== 'reserved') throw new Error('Expected a cash reservation')
    await new CommerceUnitService({ database: database.db, now: () => START }).redeem({
      code: reserved.codes[0]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:overdue-debt:first',
    })

    const afterDue = new Date(START.getTime() + 604801 * 1_000)
    const blocked = await createService(afterDue).startOrder(
      input('overdue-debt-b', fixture.productId)
    )

    expect(blocked).toEqual({ kind: 'unavailable', reason: 'overdue-debt' })
  }, 30_000)

  test('serializes different units of one cash order and marks it paid only after both', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('cash-multi-unit', { limitMinor: BigInt(10_000) })
    const reserved = await createService(START).startOrder(
      input('cash-multi-unit', fixture.productId, 2)
    )
    if (reserved.kind !== 'reserved') throw new Error('Expected a cash reservation')
    const units = new CommerceUnitService({ database: database.db, now: () => START })

    const results = await Promise.all(
      reserved.codes.map((code, index) =>
        units.redeem({
          code,
          expectedVenueId: fixture.venueId,
          actorUserId: ACTOR_ID,
          actorIsPlatform: false,
          operationKey: `redeem:cash-multi-unit:${index + 1}`,
        })
      )
    )

    expect(results.every((result) => result.kind === 'redeemed')).toBe(true)
    const [state] = await database.sql<{ status: string; debts: string }[]>`
      select o.status, count(d.id)::text as debts
      from product_order o
      join commerce_order_snapshot s on s.order_id = o.id
      join commerce_order_unit u on u.order_snapshot_id = s.id
      join credit_debt d on d.unit_id = u.id
      where o.id = ${reserved.orderId}
      group by o.status
    `
    expect(state).toEqual({ status: 'paid', debts: '2' })
  }, 30_000)

  test('applies verified repayments oldest-first without resetting debt age', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('cash-repayment', { limitMinor: BigInt(20_000) })
    const firstTime = START
    const secondTime = new Date(START.getTime() + 60_000)
    const first = await createService(firstTime).startOrder(
      input('cash-repayment-a', fixture.productId)
    )
    const second = await createService(secondTime).startOrder(
      input('cash-repayment-b', fixture.productId)
    )
    if (first.kind !== 'reserved' || second.kind !== 'reserved') {
      throw new Error('Expected two cash reservations')
    }
    await new CommerceUnitService({ database: database.db, now: () => firstTime }).redeem({
      code: first.codes[0]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:cash-repayment:first',
    })
    await new CommerceUnitService({ database: database.db, now: () => secondTime }).redeem({
      code: second.codes[0]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:cash-repayment:second',
    })
    const settlement = new CreditSettlementService({ database: database.db, now: () => secondTime })
    await database.sql`
      insert into finance_evidence
        (id, owner_type, owner_id, kind, retained_private_storage_key, sha256, status,
         reviewed_by_user_id, reviewed_at)
      values ('evidence-cash-repayment-1', 'credit_repayment_reference',
              'bank-cash-repayment-1', 'bank_record',
              'private/credit-repayments/bank-cash-repayment-1.pdf',
              ${'a'.repeat(64)}, 'reviewed', ${ACTOR_ID}, ${secondTime.toISOString()})
    `
    const request = {
      operationKey: 'credit-repayment:oldest-first',
      venueId: fixture.venueId,
      amountMinor: BigInt(7_000),
      externalReference: 'bank-cash-repayment-1',
      bankEvidenceId: 'evidence-cash-repayment-1',
      verifiedByUserId: ACTOR_ID,
    }

    const result = await settlement.recordVerifiedRepayment(request)
    const retry = await settlement.recordVerifiedRepayment(request)

    expect(result.applications.map((application) => String(application.amountMinor))).toEqual([
      '5000',
      '2000',
    ])
    expect(retry).toMatchObject({ operationId: result.operationId, duplicate: true })
    const debts = await database.sql<
      { outstanding: string; incurred_at: string; due_at: string; settled_at: string | null }[]
    >`
      select outstanding_minor::text as outstanding, incurred_at::text, due_at::text,
             settled_at::text
      from credit_debt where venue_id = ${fixture.venueId}
      order by incurred_at
    `
    expect(debts.map((debt) => debt.outstanding)).toEqual(['0', '3000'])
    expect(new Date(debts[1]!.due_at)).toEqual(new Date(secondTime.getTime() + 604800 * 1_000))
    const [posting] = await database.sql<{ entries: string; difference: string }[]>`
      select count(e.id)::text as entries, coalesce(sum(e.amount_minor), 0)::text as difference
      from finance_transaction t join finance_entry e on e.transaction_id = t.id
      where t.operation_id = ${result.operationId}
    `
    expect(posting).toEqual({ entries: '2', difference: '0' })
  }, 30_000)

  test('serializes a new reservation against repayment at the credit boundary', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('reservation-repayment-race', {
      limitMinor: BigInt(5_000),
    })
    const first = await createService(START).startOrder(
      input('reservation-repayment-race-debt', fixture.productId)
    )
    if (first.kind !== 'reserved') throw new Error('Expected the initial reservation')
    await new CommerceUnitService({ database: database.db, now: () => START }).redeem({
      code: first.codes[0]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:reservation-repayment-race',
    })
    await database.sql`
      insert into finance_evidence
        (id, owner_type, owner_id, kind, retained_private_storage_key, sha256, status,
         reviewed_by_user_id, reviewed_at)
      values ('evidence-reservation-repayment-race', 'credit_repayment_reference',
              'bank-reservation-repayment-race', 'bank_record',
              'private/credit-repayments/reservation-repayment-race.pdf',
              ${'c'.repeat(64)}, 'reviewed', ${ACTOR_ID}, ${START.toISOString()})
    `

    const [repayment, reservation] = await Promise.all([
      new CreditSettlementService({
        database: database.db,
        now: () => START,
      }).recordVerifiedRepayment({
        operationKey: 'credit-repayment:reservation-race',
        venueId: fixture.venueId,
        amountMinor: BigInt(5_000),
        externalReference: 'bank-reservation-repayment-race',
        bankEvidenceId: 'evidence-reservation-repayment-race',
        verifiedByUserId: ACTOR_ID,
      }),
      createService(START).startOrder(input('reservation-repayment-race-next', fixture.productId)),
    ])

    expect(repayment.amountMinor).toBe(BigInt(5_000))
    expect(
      reservation.kind === 'reserved' ||
        (reservation.kind === 'unavailable' && reservation.reason === 'credit-exhausted')
    ).toBe(true)
    const [exposure] = await database.sql<{ outstanding: string; reserved: string }[]>`
      select
        coalesce((select sum(outstanding_minor) from credit_debt
          where venue_id = ${fixture.venueId}), 0)::text as outstanding,
        coalesce((select sum(amount_minor) from credit_reservation
          where venue_id = ${fixture.venueId} and status = 'active'), 0)::text as reserved
    `
    expect(BigInt(exposure!.outstanding) + BigInt(exposure!.reserved)).toBeLessThanOrEqual(
      BigInt(5_000)
    )
  }, 30_000)

  test('offsets debt only against specifically identified cleared real earnings once', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('cash-offset', { limitMinor: BigInt(10_000) })
    const cash = await createService(START).startOrder(input('cash-offset', fixture.productId))
    if (cash.kind !== 'reserved') throw new Error('Expected a cash reservation')
    await new CommerceUnitService({ database: database.db, now: () => START }).redeem({
      code: cash.codes[0]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:cash-offset:first',
    })
    const sourceId = await seedClearedAppAllocation({
      suffix: 'cash-offset',
      productId: fixture.productId,
      venueId: fixture.venueId,
    })
    const settlements = new CreditSettlementService({ database: database.db, now: () => START })
    const request = {
      operationKey: 'credit-offset:cash-offset:first',
      venueId: fixture.venueId,
      amountMinor: BigInt(3_000),
      sources: [{ unitAllocationId: sourceId, amountMinor: BigInt(3_000) }],
      verifiedByUserId: ACTOR_ID,
    }

    const offset = await settlements.applyVerifiedOffset(request)
    const retry = await settlements.applyVerifiedOffset(request)
    let overuse: unknown
    try {
      await settlements.applyVerifiedOffset({
        ...request,
        operationKey: 'credit-offset:cash-offset:overuse',
        amountMinor: BigInt(2_001),
        sources: [{ unitAllocationId: sourceId, amountMinor: BigInt(2_001) }],
      })
    } catch (error) {
      overuse = error
    }
    await database.sql`
      insert into financial_operation
        (id, operation_key, content_hash, kind, venue_id, amount_minor, currency,
         funding_classification, status)
      values ('cash-offset-payout', 'cash-offset-payout-operation', 'payout-hash',
              'venue_payout', ${fixture.venueId}, 1000, 'COP', 'real', 'prepared')
    `
    await database.sql`
      insert into financial_operation_allocation
        (id, operation_id, source_type, source_id, amount_minor, ordinal)
      values ('cash-offset-payout-source', 'cash-offset-payout', 'venue_unit_allocation',
              ${sourceId}, 1000, 1)
    `
    let payoutOverlap: unknown
    try {
      await settlements.applyVerifiedOffset({
        ...request,
        operationKey: 'credit-offset:cash-offset:payout-overlap',
        amountMinor: BigInt(1_001),
        sources: [{ unitAllocationId: sourceId, amountMinor: BigInt(1_001) }],
      })
    } catch (error) {
      payoutOverlap = error
    }

    expect(offset.applications.map((application) => String(application.amountMinor))).toEqual([
      '3000',
    ])
    expect(retry).toMatchObject({ operationId: offset.operationId, duplicate: true })
    expect(String(overuse)).toContain('already consumed')
    expect(String(payoutOverlap)).toContain('already consumed')
    const [state] = await database.sql<
      { outstanding: string; source_consumed: string; entries: string; difference: string }[]
    >`
      select d.outstanding_minor::text as outstanding,
             (select coalesce(sum(a.amount_minor), 0)::text
                from financial_operation_allocation a
                join financial_operation o on o.id = a.operation_id
               where a.source_type = 'unit_allocation' and a.source_id = ${sourceId}
                 and o.status = 'bank_verified') as source_consumed,
             count(e.id)::text as entries, coalesce(sum(e.amount_minor), 0)::text as difference
      from credit_debt d
      join finance_transaction t on t.operation_id = ${offset.operationId}
      join finance_entry e on e.transaction_id = t.id
      where d.venue_id = ${fixture.venueId}
      group by d.outstanding_minor
    `
    expect(state).toEqual({
      outstanding: '2000',
      source_consumed: '3000',
      entries: '2',
      difference: '0',
    })
  }, 30_000)

  test('serializes a payout and credit offset competing for the same venue earnings', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedVenue('cash-payout-race', { limitMinor: BigInt(10_000) })
    const cash = await createService(START).startOrder(input('cash-payout-race', fixture.productId))
    if (cash.kind !== 'reserved') throw new Error('Expected a cash reservation')
    await new CommerceUnitService({ database: database.db, now: () => START }).redeem({
      code: cash.codes[0]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:cash-payout-race:first',
    })
    const sourceId = await seedClearedAppAllocation({
      suffix: 'cash-payout-race',
      productId: fixture.productId,
      venueId: fixture.venueId,
    })
    await database.sql`
      insert into treasury_policy
        (id, operation_key, content_hash, version, currency, funding_classification,
         minimum_operating_reserve_minor, status, approved_by_user_id, effective_at)
      values ('cash-race-treasury', 'cash-race-treasury-operation', 'treasury-hash', 1,
              'COP', 'real', 0, 'active', ${ACTOR_ID}, ${START.toISOString()})
      on conflict do nothing
    `
    await database.sql`
      insert into commerce_beneficiary
        (id, kind, venue_id, legal_name, legal_identifier_hash, status,
         verified_by_user_id, verified_at)
      values ('cash-race-beneficiary', 'venue', ${fixture.venueId}, 'Venue payout race',
              'cash-race-beneficiary-hash', 'verified', ${ACTOR_ID}, ${START.toISOString()})
    `
    await database.sql`
      insert into beneficiary_bank_version
        (id, beneficiary_id, version, destination_fingerprint, encrypted_details_storage_key,
         status, verification_method, verification_reference, verified_by_user_id, verified_at)
      values ('cash-race-bank', 'cash-race-beneficiary', 1, ${'b'.repeat(64)},
              'private/banks/cash-race.enc', 'verified', 'certificate', 'RACE-VERIFY',
              ${ACTOR_ID}, ${START.toISOString()})
    `
    const settlements = new CreditSettlementService({ database: database.db, now: () => START })
    const payouts = new PayoutService({ database: database.db, now: () => START })

    const outcomes = await Promise.allSettled([
      settlements.applyVerifiedOffset({
        operationKey: 'credit-offset:cash-payout-race:first',
        venueId: fixture.venueId,
        amountMinor: BigInt(3_000),
        sources: [{ unitAllocationId: sourceId, amountMinor: BigInt(3_000) }],
        verifiedByUserId: ACTOR_ID,
      }),
      payouts.prepare({
        operationKey: 'payout:cash-payout-race:first',
        kind: 'venue_payout',
        beneficiaryBankVersionId: 'cash-race-bank',
        fundingClassification: 'real',
        sources: [{ unitAllocationId: sourceId, amountMinor: BigInt(3_000) }],
        requestedByUserId: ACTOR_ID,
      }),
    ])

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    const [reserved] = await database.sql<{ amount: string }[]>`
      select coalesce(sum(a.amount_minor), 0)::text as amount
      from financial_operation_allocation a
      join financial_operation o on o.id = a.operation_id
      where a.source_id = ${sourceId}
        and a.source_type in ('unit_allocation', 'venue_unit_allocation')
        and o.status not in ('failed', 'cancelled', 'reversed')
    `
    expect(reserved).toEqual({ amount: '3000' })
  }, 30_000)

  test('versions operator-approved limits and keeps configuration retries idempotent', async () => {
    const fixture = await seedVenue('policy-versioning')
    const policies = new CreditPolicyService({ database: database!.db, now: () => START })
    const firstRequest = {
      operationKey: 'credit-policy:policy-versioning:first',
      venueId: fixture.venueId,
      limitMinor: BigInt(0),
      maxActiveReservations: 10,
      maxActivePerShopper: 2,
      approvedByUserId: ACTOR_ID,
    }

    const first = await policies.configurePolicy(firstRequest)
    const retry = await policies.configurePolicy(firstRequest)
    const second = await policies.configurePolicy({
      ...firstRequest,
      operationKey: 'credit-policy:policy-versioning:second',
      limitMinor: BigInt(5_000),
    })

    expect(first).toMatchObject({ version: 1, duplicate: false })
    expect(retry).toMatchObject({ policyId: first.policyId, version: 1, duplicate: true })
    expect(second).toMatchObject({ version: 2, duplicate: false })
    const rows = await database!.sql<{ version: number; status: string; limit_minor: string }[]>`
      select version, status, limit_minor::text from venue_credit_policy
      where venue_id = ${fixture.venueId} order by version
    `
    expect(rows.map((row) => ({ ...row }))).toEqual([
      { version: 1, status: 'retired', limit_minor: '0' },
      { version: 2, status: 'active', limit_minor: '5000' },
    ])
  }, 30_000)
})
