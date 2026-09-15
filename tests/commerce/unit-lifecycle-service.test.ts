import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { AllocationService } from '../../src/lib/commerce/allocation-service'
import { CommerceRefundService } from '../../src/lib/commerce/refund-service'
import { CommerceUnitService } from '../../src/lib/commerce/unit-lifecycle-service'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined
const ACTOR_ID = 'unit-lifecycle-actor'
const NOW = new Date('2026-09-12T12:00:00.000Z')
const REFUND_DESTINATION = 'a'.repeat(64)

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into "user" (id, name, email, email_verified)
    values (${ACTOR_ID}, 'Mesera', 'mesera-unit@example.test', true)
  `
  await database.sql`
    insert into commerce_beneficiary
      (id, kind, legal_name, legal_identifier_hash, status, verified_at)
    values
      ('unit-foundation', 'foundation', 'Fundación unidades', 'unit-foundation-hash',
       'verified', now())
  `
  await database.sql`
    insert into allocation_policy (id, version, name, effective_at)
    values ('unit-policy', 1, 'Política unidades', now() - interval '1 day')
  `
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

type UnitFixture = Readonly<{
  chargeId: string
  code: string
  codes: readonly string[]
  orderId: string
  snapshotId: string
  unitId: string
  venueId: string
}>

const seedApprovedUnit = async (input: {
  suffix: string
  expiresAt?: Date
  quantity?: number
}): Promise<UnitFixture> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const venueId = `unit-venue-${input.suffix}`
  const productId = `unit-product-${input.suffix}`
  const orderId = `unit-order-${input.suffix}`
  const snapshotId = `unit-snapshot-${input.suffix}`
  const unitId = `unit-${input.suffix}`
  const attemptId = `unit-attempt-${input.suffix}`
  const chargeId = `unit-charge-${input.suffix}`
  const code = `CODE-${input.suffix}`
  const quantity = input.quantity ?? 1
  const grossMinor = quantity * 10_000
  const expiresAt = input.expiresAt ?? new Date('2026-10-01T00:00:00.000Z')

  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values
      (${venueId}, ${venueId}, ${`Venue ${input.suffix}`}, 'bar', 'Calle 1', 'Bogotá',
       'Bogotá D.C.', 4.710989, -74.072090, 'published')
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, price, currency, donation_percentage, status)
    values
      (${productId}, ${venueId}, ${productId}, ${`Product ${input.suffix}`}, 'coctel',
       100.00, 'COP', 50.00, 'published')
  `
  await database.sql`
    insert into venue_member (id, venue_id, user_id, role)
    values (${`unit-member-${input.suffix}`}, ${venueId}, ${ACTOR_ID}, 'staff')
  `
  await database.sql`
    insert into product_order
      (id, product_id, venue_id, buyer_name, buyer_email, quantity, unit_price,
       donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
       public_token, pay_method, status, provider, provider_reference, paid_at, expires_at)
    values
      (${orderId}, ${productId}, ${venueId}, 'Persona', 'persona@example.test', ${quantity}, 100.00,
       50.00, 50.00, 50.00, ${quantity * 100}, ${`token-${input.suffix}`}, 'app', 'paid', 'epayco',
       ${`reference-${input.suffix}`}, now(), ${expiresAt.toISOString()})
  `
  await database.sql`
    insert into commerce_order_snapshot
      (id, order_id, product_name, product_kind, venue_name, currency, quantity,
       unit_gross_minor, donation_basis_points, allocation_policy_id,
       foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
       funding_classification)
    values
      (${snapshotId}, ${orderId}, ${`Product ${input.suffix}`}, 'coctel',
       ${`Venue ${input.suffix}`}, 'COP', ${quantity}, 10000, 5000, 'unit-policy', 'unit-foundation',
       'Fundación unidades', 'Reparto de prueba', 'sandbox')
  `
  const codes: string[] = []
  for (let ordinal = 1; ordinal <= quantity; ordinal += 1) {
    const currentUnitId = ordinal === 1 ? unitId : `${unitId}-${ordinal}`
    const redemptionId = `redemption-${input.suffix}-${ordinal}`
    const currentCode = ordinal === 1 ? code : `${code}-${ordinal}`
    codes.push(currentCode)
    await database.sql`
      insert into order_redemption (id, order_id, code, status)
      values (${redemptionId}, ${orderId}, ${currentCode}, 'issued')
    `
    await database.sql`
      insert into commerce_order_unit
        (id, order_snapshot_id, redemption_id, ordinal, gross_minor, lifecycle_status, expires_at)
      values (${currentUnitId}, ${snapshotId}, ${redemptionId}, ${ordinal}, 10000, 'issued',
              ${expiresAt.toISOString()})
    `
  }
  await database.sql`
    insert into payment_attempt
      (id, order_snapshot_id, submission_key, request_hash, provider,
       provider_config_version, merchant_account_key, environment,
       provider_attempt_reference, status)
    values
      (${attemptId}, ${snapshotId}, ${`submission-${input.suffix}`}, 'hash', 'epayco',
       'test-v1', 'merchant-unit', 'test', ${`reference-${input.suffix}`}, 'approved')
  `
  await database.sql`
    insert into payment_charge
      (id, attempt_id, provider, merchant_account_key, environment, provider_reference,
       provider_transaction_id, gross_minor, currency, status, approved_at)
    values
      (${chargeId}, ${attemptId}, 'epayco', 'merchant-unit', 'test',
       ${`reference-${input.suffix}`}, ${`transaction-${input.suffix}`}, ${grossMinor}, 'COP',
       'approved', now())
  `
  await database.sql`
    insert into finance_account (id, kind, owner_key, currency, funding_classification)
    values
      ('unit-receivable', 'gateway_receivable', 'epayco:merchant-unit:test', 'COP', 'sandbox'),
      (${`unit-held-${input.suffix}`}, 'customer_funds_held', ${snapshotId}, 'COP', 'sandbox')
    on conflict do nothing
  `
  await database.sql.begin(async (transaction) => {
    await transaction`
      insert into finance_transaction
        (id, operation_key, content_hash, kind, currency, status, order_snapshot_id)
      values (${`unit-approval-${input.suffix}`}, ${`unit-approval-op-${input.suffix}`},
              'approval-hash', 'payment_approved', 'COP', 'draft', ${snapshotId})
    `
    await transaction`
      insert into finance_entry (id, transaction_id, account_id, amount_minor, ordinal)
      values
        (${`unit-approval-debit-${input.suffix}`}, ${`unit-approval-${input.suffix}`},
         'unit-receivable', ${grossMinor}, 1),
        (${`unit-approval-credit-${input.suffix}`}, ${`unit-approval-${input.suffix}`},
         ${`unit-held-${input.suffix}`}, ${-grossMinor}, 2)
    `
    await transaction`
      update finance_transaction set status = 'posted', posted_at = now()
      where id = ${`unit-approval-${input.suffix}`}
    `
  })

  return { chargeId, code, codes, orderId, snapshotId, unitId, venueId }
}

describe('CommerceUnitService redemption', () => {
  test('redeems before reconciliation and recognizes only the same retry', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'before-allocation' })
    const service = new CommerceUnitService({ database: database.db, now: () => NOW })
    const request = {
      code: fixture.code,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:before-allocation:first',
    }

    const first = await service.redeem(request)
    const retry = await service.redeem(request)
    const secondScan = await service.redeem({ ...request, operationKey: 'redeem:other-scan:key' })

    expect(first).toMatchObject({ kind: 'redeemed', duplicate: false, redeemedCount: 1 })
    expect(retry).toMatchObject({ kind: 'redeemed', duplicate: true, redeemedCount: 1 })
    expect(secondScan).toEqual({ kind: 'rejected', reason: 'already_redeemed' })
    const distributions = await database.sql`
      select id from finance_transaction
      where order_snapshot_id = ${fixture.snapshotId} and kind = 'unit_distribution'
    `
    expect(distributions).toHaveLength(0)
  }, 30_000)

  test('posts distribution atomically when final allocation already exists', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'after-allocation' })
    await new AllocationService({ database: database.db, now: () => NOW }).reconcileCharge({
      chargeId: fixture.chargeId,
      operationKey: 'allocation:unit-after:report',
      deductions: [],
    })
    const service = new CommerceUnitService({ database: database.db, now: () => NOW })

    const result = await service.redeem({
      code: fixture.code,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:after-allocation:first',
    })

    expect(result).toMatchObject({ kind: 'redeemed', duplicate: false })
    const [posting] = await database.sql<{ entries: string; difference: string }[]>`
      select count(e.id)::text as entries, coalesce(sum(e.amount_minor), 0)::text as difference
      from finance_transaction t
      join finance_entry e on e.transaction_id = t.id
      where t.order_snapshot_id = ${fixture.snapshotId} and t.kind = 'unit_distribution'
    `
    expect(posting).toEqual({ entries: '3', difference: '0' })
  }, 30_000)

  test('one scan redeems and distributes every unit in an app-paid order', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'order-batch', quantity: 2 })
    await new AllocationService({ database: database.db, now: () => NOW }).reconcileCharge({
      chargeId: fixture.chargeId,
      operationKey: 'allocation:order-batch:report',
      deductions: [],
    })
    const service = new CommerceUnitService({ database: database.db, now: () => NOW })

    const result = await service.redeem({
      code: fixture.code,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:order-batch:first',
    })
    const secondScan = await service.redeem({
      code: fixture.codes[1]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:order-batch:second',
    })

    expect(result).toMatchObject({
      kind: 'redeemed',
      collectMinor: null,
      fulfilledCount: 2,
      redeemedCount: 2,
      duplicate: false,
    })
    expect(secondScan).toEqual({ kind: 'rejected', reason: 'already_redeemed' })
    const [state] = await database.sql<
      { redeemed: string; postings: string; entries: string; difference: string }[]
    >`
      select
        (select count(*) from commerce_order_unit u
          where u.order_snapshot_id = ${fixture.snapshotId}
            and u.lifecycle_status = 'redeemed')::text as redeemed,
        count(distinct t.id)::text as postings,
        count(e.id)::text as entries,
        coalesce(sum(e.amount_minor), 0)::text as difference
      from finance_transaction t
      join finance_entry e on e.transaction_id = t.id
      where t.order_snapshot_id = ${fixture.snapshotId} and t.kind = 'unit_distribution'
    `
    expect(state).toEqual({ redeemed: '2', postings: '2', entries: '6', difference: '0' })
  }, 30_000)

  test('finishes only the remaining units of an older partially redeemed order', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'partial-order', quantity: 2 })
    await database.sql`
      update order_redemption set status = 'redeemed', redeemed_at = ${NOW.toISOString()}
      where code = ${fixture.codes[0]!}
    `
    await database.sql`
      update commerce_order_unit set lifecycle_status = 'redeemed', redeemed_at = ${NOW.toISOString()}
      where id = ${fixture.unitId}
    `

    const result = await new CommerceUnitService({ database: database.db, now: () => NOW }).redeem({
      code: fixture.codes[1]!,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:partial-order:remaining',
    })

    expect(result).toMatchObject({
      kind: 'redeemed',
      fulfilledCount: 1,
      redeemedCount: 2,
      duplicate: false,
    })
  }, 30_000)

  test('allows only one of two concurrent independent scans', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'concurrent' })
    const service = new CommerceUnitService({ database: database.db, now: () => NOW })
    const base = {
      code: fixture.code,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
    }

    const results = await Promise.all([
      service.redeem({ ...base, operationKey: 'redeem:concurrent:first' }),
      service.redeem({ ...base, operationKey: 'redeem:concurrent:second' }),
    ])

    expect(results.filter((result) => result.kind === 'redeemed')).toHaveLength(1)
    expect(results.filter((result) => result.kind === 'rejected')).toHaveLength(1)
  }, 30_000)

  test('rechecks the venue and expiry inside the transaction', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const wrongVenue = await seedApprovedUnit({ suffix: 'wrong-venue' })
    const expired = await seedApprovedUnit({
      suffix: 'expired-on-scan',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    const service = new CommerceUnitService({ database: database.db, now: () => NOW })

    expect(
      await service.redeem({
        code: wrongVenue.code,
        expectedVenueId: 'another-venue',
        actorUserId: ACTOR_ID,
        actorIsPlatform: false,
        operationKey: 'redeem:wrong-venue:first',
      })
    ).toEqual({ kind: 'rejected', reason: 'wrong_venue' })
    expect(
      await service.redeem({
        code: expired.code,
        expectedVenueId: expired.venueId,
        actorUserId: ACTOR_ID,
        actorIsPlatform: false,
        operationKey: 'redeem:expired-on-scan:first',
      })
    ).toEqual({ kind: 'rejected', reason: 'expired' })
    const [state] = await database.sql<
      { unit: string; redemption: string; order_status: string }[]
    >`
      select u.lifecycle_status as unit, r.status as redemption, o.status as order_status
      from commerce_order_unit u
      join order_redemption r on r.id = u.redemption_id
      join commerce_order_snapshot s on s.id = u.order_snapshot_id
      join product_order o on o.id = s.order_id
      where u.id = ${expired.unitId}
    `
    expect(state).toEqual({ unit: 'expired', redemption: 'void', order_status: 'expired' })
  }, 30_000)

  test('rejects staff whose venue membership was revoked before the transaction', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'revoked-staff' })
    await database.sql`
      delete from venue_member where venue_id = ${fixture.venueId} and user_id = ${ACTOR_ID}
    `
    const result = await new CommerceUnitService({ database: database.db, now: () => NOW }).redeem({
      code: fixture.code,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:revoked-staff:first',
    })

    expect(result).toEqual({ kind: 'rejected', reason: 'unauthorized' })
  }, 30_000)
})

describe('CommerceUnitService expiry', () => {
  test('expires unclaimed app units without allocating their retained refund liability', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({
      suffix: 'expiry-job',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    await new AllocationService({ database: database.db, now: () => NOW }).reconcileCharge({
      chargeId: fixture.chargeId,
      operationKey: 'allocation:unit-expiry:report',
      deductions: [],
    })
    const service = new CommerceUnitService({ database: database.db, now: () => NOW })

    const result = await service.expireDueUnits({ now: NOW })
    const retry = await service.expireDueUnits({ now: NOW })

    expect(result.expired).toBeGreaterThanOrEqual(1)
    expect(result.retainedMinor).toBeGreaterThanOrEqual(BigInt(10_000))
    expect(retry.expired).toBe(0)
    const distributions = await database.sql`
      select id from finance_transaction
      where order_snapshot_id = ${fixture.snapshotId} and kind = 'unit_distribution'
    `
    expect(distributions).toHaveLength(0)
  }, 30_000)
})

describe('CommerceRefundService reservation', () => {
  test('reserves full gross, voids the QR, and is idempotent', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'refund-reserve' })
    const refunds = new CommerceRefundService({ database: database.db, now: () => NOW })
    const request = {
      operationKey: 'refund:reserve:first-operation',
      orderId: fixture.orderId,
      unitIds: [fixture.unitId],
      destinationFingerprint: REFUND_DESTINATION,
      requestedByUserId: ACTOR_ID,
    }

    const first = await refunds.reserveRefund(request)
    const retry = await refunds.reserveRefund(request)

    expect(first).toMatchObject({ amountMinor: BigInt(10_000), duplicate: false })
    expect(retry).toMatchObject({ operationId: first.operationId, duplicate: true })
    const [state] = await database.sql<
      { unit: string; redemption: string; operation_status: string; reserved: string }[]
    >`
      select u.lifecycle_status as unit, r.status as redemption,
             o.status as operation_status, a.amount_minor::text as reserved
      from commerce_order_unit u
      join order_redemption r on r.id = u.redemption_id
      join financial_operation o on o.id = u.refund_operation_id
      join financial_operation_allocation a on a.operation_id = o.id and a.source_id = u.id
      where u.id = ${fixture.unitId}
    `
    expect(state).toEqual({
      unit: 'refund_reserved',
      redemption: 'void',
      operation_status: 'prepared',
      reserved: '10000',
    })

    const scan = await new CommerceUnitService({
      database: database.db,
      now: () => NOW,
    }).redeem({
      code: fixture.code,
      expectedVenueId: fixture.venueId,
      actorUserId: ACTOR_ID,
      actorIsPlatform: false,
      operationKey: 'redeem:refund-reserved:first',
    })
    expect(scan).toEqual({ kind: 'rejected', reason: 'refund_reserved' })
  }, 30_000)

  test('keeps expired units eligible for their full-price refund', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({
      suffix: 'refund-expired',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    await new CommerceUnitService({ database: database.db, now: () => NOW }).expireDueUnits({
      now: NOW,
    })

    const result = await new CommerceRefundService({
      database: database.db,
      now: () => NOW,
    }).reserveRefund({
      operationKey: 'refund:expired:first-operation',
      orderId: fixture.orderId,
      unitIds: [fixture.unitId],
      destinationFingerprint: REFUND_DESTINATION,
      requestedByUserId: ACTOR_ID,
    })

    expect(result.amountMinor).toBe(BigInt(10_000))
  }, 30_000)

  test('serializes redemption against refund reservation on the same unit', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedUnit({ suffix: 'refund-race' })
    const units = new CommerceUnitService({ database: database.db, now: () => NOW })
    const refunds = new CommerceRefundService({ database: database.db, now: () => NOW })

    const results = await Promise.allSettled([
      units.redeem({
        code: fixture.code,
        expectedVenueId: fixture.venueId,
        actorUserId: ACTOR_ID,
        actorIsPlatform: false,
        operationKey: 'redeem:refund-race:first',
      }),
      refunds.reserveRefund({
        operationKey: 'refund:race:first-operation',
        orderId: fixture.orderId,
        unitIds: [fixture.unitId],
        destinationFingerprint: REFUND_DESTINATION,
        requestedByUserId: ACTOR_ID,
      }),
    ])

    const [state] = await database.sql<{ unit: string; refund_operations: string }[]>`
      select u.lifecycle_status as unit,
             (select count(*)::text from financial_operation o
              where o.operation_key = 'refund:race:first-operation') as refund_operations
      from commerce_order_unit u where u.id = ${fixture.unitId}
    `
    expect(['redeemed', 'refund_reserved']).toContain(state?.unit)
    expect(state?.refund_operations).toBe(state?.unit === 'redeemed' ? '0' : '1')
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true)
  }, 30_000)
})
