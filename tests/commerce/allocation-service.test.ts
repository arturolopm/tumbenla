import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { AllocationService } from '../../src/lib/commerce/allocation-service'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into commerce_beneficiary
      (id, kind, legal_name, legal_identifier_hash, status, verified_at)
    values
      ('allocation-foundation', 'foundation', 'Fundación reparto',
       'allocation-foundation-hash', 'verified', now())
  `
  await database.sql`
    insert into allocation_policy (id, version, name, effective_at)
    values ('allocation-policy', 1, 'Política reparto', now() - interval '1 day')
  `
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

const seedApprovedCharge = async (input: {
  suffix: string
  quantity: number
  donationBasisPoints: number
  redeemedOrdinals?: readonly number[]
}): Promise<{ chargeId: string; snapshotId: string; unitIds: string[] }> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const venueId = `allocation-venue-${input.suffix}`
  const productId = `allocation-product-${input.suffix}`
  const orderId = `allocation-order-${input.suffix}`
  const snapshotId = `allocation-snapshot-${input.suffix}`
  const attemptId = `allocation-attempt-${input.suffix}`
  const chargeId = `allocation-charge-${input.suffix}`
  const unitGrossMinor = BigInt(10_000)
  const grossMinor = unitGrossMinor * BigInt(input.quantity)
  const unitIds = Array.from(
    { length: input.quantity },
    (_, index) => `allocation-unit-${input.suffix}-${index + 1}`
  )

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
      (${productId}, ${venueId}, ${productId}, ${`Product ${input.suffix}`}, 'coctel', 100.00,
       'COP', ${String(input.donationBasisPoints / 100)}, 'published')
  `
  await database.sql`
    insert into product_order
      (id, product_id, venue_id, buyer_name, buyer_email, quantity, unit_price,
       donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
       public_token, pay_method, status, provider, provider_reference, paid_at)
    values
      (${orderId}, ${productId}, ${venueId}, 'Persona', 'persona@example.test',
       ${String(input.quantity)}, 100.00, ${String(input.donationBasisPoints / 100)}, 50.00,
       50.00, ${String(Number(grossMinor) / 100)}, ${`token-${input.suffix}`}, 'app', 'paid',
       'epayco', ${`reference-${input.suffix}`}, now())
  `
  await database.sql`
    insert into commerce_order_snapshot
      (id, order_id, product_name, product_kind, venue_name, currency, quantity,
       unit_gross_minor, donation_basis_points, allocation_policy_id,
       foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
       funding_classification)
    values
      (${snapshotId}, ${orderId}, ${`Product ${input.suffix}`}, 'coctel',
       ${`Venue ${input.suffix}`}, 'COP', ${input.quantity}, ${String(unitGrossMinor)},
       ${input.donationBasisPoints}, 'allocation-policy', 'allocation-foundation',
       'Fundación reparto', 'Reparto de prueba', 'sandbox')
  `
  for (const [index, unitId] of unitIds.entries()) {
    const ordinal = index + 1
    const status = input.redeemedOrdinals?.includes(ordinal) ? 'redeemed' : 'issued'
    await database.sql`
      insert into commerce_order_unit
        (id, order_snapshot_id, ordinal, gross_minor, lifecycle_status, redeemed_at)
      values
        (${unitId}, ${snapshotId}, ${ordinal}, ${String(unitGrossMinor)}, ${status},
         ${status === 'redeemed' ? new Date().toISOString() : null})
    `
  }
  await database.sql`
    insert into payment_attempt
      (id, order_snapshot_id, submission_key, request_hash, provider,
       provider_config_version, merchant_account_key, environment,
       provider_attempt_reference, status)
    values
      (${attemptId}, ${snapshotId}, ${`submission-${input.suffix}`}, 'hash', 'epayco',
       'test-v1', 'merchant-test', 'test', ${`reference-${input.suffix}`}, 'approved')
  `
  await database.sql`
    insert into payment_charge
      (id, attempt_id, provider, merchant_account_key, environment, provider_reference,
       provider_transaction_id, gross_minor, currency, status, approved_at)
    values
      (${chargeId}, ${attemptId}, 'epayco', 'merchant-test', 'test',
       ${`reference-${input.suffix}`}, ${`transaction-${input.suffix}`}, ${String(grossMinor)},
       'COP', 'approved', now())
  `

  await database.sql`
    insert into finance_account
      (id, kind, owner_key, currency, funding_classification)
    values
      ('allocation-receivable', 'gateway_receivable', 'epayco:merchant-test:test',
       'COP', 'sandbox'),
      (${`held-${input.suffix}`}, 'customer_funds_held', ${snapshotId}, 'COP', 'sandbox')
    on conflict do nothing
  `
  await database.sql.begin(async (transaction) => {
    await transaction`
      insert into finance_transaction
        (id, operation_key, content_hash, kind, currency, status, order_snapshot_id, posted_at)
      values
        (${`approval-${input.suffix}`}, ${`approval-op-${input.suffix}`}, 'approval-hash',
         'payment_approved', 'COP', 'draft', ${snapshotId}, null)
    `
    await transaction`
      insert into finance_entry
        (id, transaction_id, account_id, amount_minor, ordinal)
      values
        (${`approval-debit-${input.suffix}`}, ${`approval-${input.suffix}`},
         'allocation-receivable', ${String(grossMinor)}, 1),
        (${`approval-credit-${input.suffix}`}, ${`approval-${input.suffix}`},
         ${`held-${input.suffix}`}, ${String(-grossMinor)}, 2)
    `
    await transaction`
      update finance_transaction set status = 'posted', posted_at = now()
      where id = ${`approval-${input.suffix}`}
    `
  })

  return { chargeId, snapshotId, unitIds }
}

const seedApprovedCustomerOrderCharge = async (
  suffix: string
): Promise<{ chargeId: string; customerOrderId: string; unitIds: string[] }> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const venueId = `mixed-allocation-venue-${suffix}`
  const customerOrderId = `mixed-allocation-order-${suffix}`
  const attemptId = `mixed-allocation-attempt-${suffix}`
  const chargeId = `mixed-allocation-charge-${suffix}`
  const splits = [4_000, 5_000, 10_000] as const
  const unitIds: string[] = []

  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values
      (${venueId}, ${venueId}, 'Venue reparto mixto', 'bar', 'Calle 1', 'Bogotá',
       'Bogotá D.C.', 4.710989, -74.072090, 'published')
  `
  await database.sql`
    insert into customer_order
      (id, venue_id, buyer_name, buyer_email, total_units, total_amount, currency,
       public_token, pay_method, status, provider, provider_reference, paid_at)
    values
      (${customerOrderId}, ${venueId}, 'Persona', 'persona@example.test', 3, 3.00, 'COP',
       ${`mixed-token-${suffix}`}, 'app', 'paid', 'epayco', ${`mixed-reference-${suffix}`}, now())
  `

  for (const [index, donationBasisPoints] of splits.entries()) {
    const ordinal = index + 1
    const productId = `mixed-allocation-product-${suffix}-${ordinal}`
    const orderId = `mixed-allocation-line-${suffix}-${ordinal}`
    const snapshotId = `mixed-allocation-snapshot-${suffix}-${ordinal}`
    const unitId = `mixed-allocation-unit-${suffix}-${ordinal}`
    unitIds.push(unitId)
    await database.sql`
      insert into venue_product
        (id, venue_id, slug, name, kind, price, currency, donation_percentage, status)
      values
        (${productId}, ${venueId}, ${productId}, ${`Producto ${ordinal}`}, 'coctel', 1.00,
         'COP', ${String(donationBasisPoints / 100)}, 'published')
    `
    await database.sql`
      insert into product_order
        (id, customer_order_id, line_ordinal, product_id, venue_id, buyer_name, buyer_email,
         quantity, unit_price, donation_percentage, unit_donation_amount, unit_venue_amount,
         total_amount, public_token, pay_method, status, paid_at)
      values
        (${orderId}, ${customerOrderId}, ${ordinal}, ${productId}, ${venueId}, 'Persona',
         'persona@example.test', 1, 1.00, ${String(donationBasisPoints / 100)},
         ${String(donationBasisPoints / 10_000)},
         ${String(1 - donationBasisPoints / 10_000)}, 1.00, ${`mixed-line-token-${suffix}-${ordinal}`},
         'app', 'paid', now())
    `
    await database.sql`
      insert into commerce_order_snapshot
        (id, order_id, product_name, product_kind, venue_name, currency, quantity,
         unit_gross_minor, donation_basis_points, allocation_policy_id,
         foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
         funding_classification)
      values
        (${snapshotId}, ${orderId}, ${`Producto ${ordinal}`}, 'coctel', 'Venue reparto mixto',
         'COP', 1, 100, ${donationBasisPoints}, 'allocation-policy', 'allocation-foundation',
         'Fundación reparto', 'Reparto mixto', 'sandbox')
    `
    await database.sql`
      insert into commerce_order_unit
        (id, order_snapshot_id, ordinal, gross_minor, lifecycle_status, redeemed_at)
      values (${unitId}, ${snapshotId}, 1, 100, 'redeemed', now())
    `
  }

  await database.sql`
    insert into payment_attempt
      (id, order_snapshot_id, customer_order_id, submission_key, request_hash, provider,
       provider_config_version, merchant_account_key, environment,
       provider_attempt_reference, status)
    values
      (${attemptId}, ${`mixed-allocation-snapshot-${suffix}-1`}, ${customerOrderId},
       ${`mixed-submission-${suffix}`}, 'hash', 'epayco', 'test-v1', 'merchant-test', 'test',
       ${`mixed-reference-${suffix}`}, 'approved')
  `
  await database.sql`
    insert into payment_charge
      (id, attempt_id, provider, merchant_account_key, environment, provider_reference,
       provider_transaction_id, gross_minor, currency, status, approved_at)
    values
      (${chargeId}, ${attemptId}, 'epayco', 'merchant-test', 'test',
       ${`mixed-reference-${suffix}`}, ${`mixed-transaction-${suffix}`}, 300, 'COP', 'approved', now())
  `
  await database.sql`
    insert into finance_account
      (id, kind, owner_key, currency, funding_classification)
    values
      ('allocation-receivable', 'gateway_receivable', 'epayco:merchant-test:test',
       'COP', 'sandbox'),
      (${`mixed-held-${suffix}`}, 'customer_funds_held', ${customerOrderId}, 'COP', 'sandbox')
    on conflict do nothing
  `
  await database.sql.begin(async (transaction) => {
    await transaction`
      insert into finance_transaction
        (id, operation_key, content_hash, kind, currency, status, order_snapshot_id,
         customer_order_id, posted_at)
      values
        (${`mixed-approval-${suffix}`}, ${`mixed-approval-op-${suffix}`}, 'approval-hash',
         'payment_approved', 'COP', 'draft', ${`mixed-allocation-snapshot-${suffix}-1`},
         ${customerOrderId}, null)
    `
    await transaction`
      insert into finance_entry
        (id, transaction_id, account_id, amount_minor, ordinal)
      values
        (${`mixed-approval-debit-${suffix}`}, ${`mixed-approval-${suffix}`},
         'allocation-receivable', 300, 1),
        (${`mixed-approval-credit-${suffix}`}, ${`mixed-approval-${suffix}`},
         ${`mixed-held-${suffix}`}, -300, 2)
    `
    await transaction`
      update finance_transaction set status = 'posted', posted_at = now()
      where id = ${`mixed-approval-${suffix}`}
    `
  })
  return { chargeId, customerOrderId, unitIds }
}

const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected operation to fail')
}

const seedDeductionEvidence = async (evidenceId: string, chargeId: string): Promise<void> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  await database.sql`
    insert into finance_evidence
      (id, owner_type, owner_id, kind, retained_private_storage_key, sha256, status, reviewed_at)
    values (${evidenceId}, 'payment_charge', ${chargeId}, 'provider_settlement_report',
            ${`private/deductions/${evidenceId}.pdf`}, ${'a'.repeat(64)}, 'reviewed', now())
  `
}

describe('AllocationService', () => {
  test('allocates one charge across mixed line percentages in stable line and unit order', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedCustomerOrderCharge('mixed-lines')
    await seedDeductionEvidence('evidence-mixed-lines', fixture.chargeId)

    const result = await new AllocationService({ database: database.db }).reconcileCharge({
      chargeId: fixture.chargeId,
      operationKey: 'allocation:mixed-lines:report-1',
      deductions: [
        {
          externalKey: 'gateway-fee',
          kind: 'gateway_fee',
          amount: '0.020000',
          finality: 'final',
          evidenceId: 'evidence-mixed-lines',
        },
      ],
    })

    expect(result.units.map((unit) => unit.unitId)).toEqual(fixture.unitIds)
    expect(result.units.map((unit) => String(unit.deductionMinor))).toEqual(['1', '1', '0'])
    expect(result.units.map((unit) => String(unit.donationMinor))).toEqual(['40', '50', '100'])
    const [persisted] = await database.sql<
      { parentRuns: string; parentTransactions: string; lineHeldAccounts: string }[]
    >`
      select
        (select count(*) from allocation_run
          where customer_order_id = ${fixture.customerOrderId})::text as "parentRuns",
        (select count(*) from finance_transaction
          where customer_order_id = ${fixture.customerOrderId})::text as "parentTransactions",
        (select count(*) from finance_account account
          where account.kind = 'customer_funds_held'
            and account.owner_key like 'mixed-allocation-snapshot-%')::text as "lineHeldAccounts"
    `
    expect(persisted).toEqual({
      parentRuns: '1',
      parentTransactions: '5',
      lineHeldAccounts: '0',
    })
  }, 30_000)

  test('persists deterministic deductions, final allocations, clearing, and redeemed release', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedCharge({
      suffix: 'first',
      quantity: 3,
      donationBasisPoints: 5_000,
      redeemedOrdinals: [1],
    })
    const service = new AllocationService({ database: database.db })
    await seedDeductionEvidence('evidence-report-1', fixture.chargeId)
    const input = {
      chargeId: fixture.chargeId,
      operationKey: 'allocation:first:report-1',
      deductions: [
        {
          externalKey: 'gateway-fee',
          kind: 'gateway_fee' as const,
          amount: '0.010000',
          finality: 'final' as const,
          evidenceId: 'evidence-report-1',
        },
        {
          externalKey: 'temporary-hold',
          kind: 'temporary_hold' as const,
          amount: '20.000000',
          finality: 'final' as const,
          evidenceId: 'evidence-report-1',
        },
      ],
    }

    const result = await service.reconcileCharge(input)

    expect(String(result.grossMinor)).toBe('30000')
    expect(String(result.deductionMinor)).toBe('1')
    expect(String(result.netMinor)).toBe('29999')
    expect(result.units.map((unit) => String(unit.deductionMinor))).toEqual(['1', '0', '0'])
    expect(result.units.map((unit) => String(unit.donationMinor))).toEqual(['5000', '5000', '5000'])

    const duplicate = await service.reconcileCharge(input)
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.allocationRunId).toBe(result.allocationRunId)

    const [balances] = await database.sql<
      { transactions: string; difference: string; released: string }[]
    >`
      select
        count(distinct t.id) filter (where t.order_snapshot_id = ${fixture.snapshotId}) as transactions,
        coalesce(sum(e.amount_minor), 0)::text as difference,
        count(distinct t.id) filter (where t.kind = 'unit_distribution'
          and t.order_snapshot_id = ${fixture.snapshotId}) as released
      from finance_transaction t
      join finance_entry e on e.transaction_id = t.id
      where t.order_snapshot_id = ${fixture.snapshotId}
    `
    expect(balances).toEqual({ transactions: '3', difference: '0', released: '1' })
  }, 30_000)

  test('creates explicit correction revisions and rejects conflicting idempotency reuse', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedCharge({
      suffix: 'correction',
      quantity: 3,
      donationBasisPoints: 5_000,
      redeemedOrdinals: [1],
    })
    const service = new AllocationService({ database: database.db })
    await seedDeductionEvidence('evidence-correction-1', fixture.chargeId)
    await seedDeductionEvidence('evidence-correction-2', fixture.chargeId)
    await service.reconcileCharge({
      chargeId: fixture.chargeId,
      operationKey: 'allocation:correction:report-1',
      deductions: [
        {
          externalKey: 'gateway-fee',
          kind: 'gateway_fee',
          amount: '0.010000',
          finality: 'final',
          evidenceId: 'evidence-correction-1',
        },
      ],
    })
    const corrected = await service.reconcileCharge({
      chargeId: fixture.chargeId,
      operationKey: 'allocation:correction:report-2',
      deductions: [
        {
          externalKey: 'gateway-fee',
          kind: 'gateway_fee',
          amount: '0.040000',
          finality: 'final',
          evidenceId: 'evidence-correction-2',
        },
      ],
    })

    expect(corrected.revision).toBe(2)
    expect(String(corrected.deductionMinor)).toBe('4')
    const runs = await database.sql<{ revision: number; status: string }[]>`
      select revision, status from allocation_run
      where order_snapshot_id = ${fixture.snapshotId}
      order by revision
    `
    expect(runs.map(({ revision, status }) => ({ revision, status }))).toEqual([
      { revision: 1, status: 'superseded' },
      { revision: 2, status: 'final' },
    ])
    const adjustments = await database.sql`
      select id from finance_transaction
      where order_snapshot_id = ${fixture.snapshotId}
        and kind in ('charge_clearing_adjustment', 'unit_distribution_adjustment')
    `
    expect(adjustments).toHaveLength(2)

    const conflict = await captureError(() =>
      service.reconcileCharge({
        chargeId: fixture.chargeId,
        operationKey: 'allocation:correction:report-2',
        deductions: [],
      })
    )
    expect(String(conflict)).toContain('different content')
  }, 30_000)

  test('supports a 100% allocation without writing zero-value entries', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedCharge({
      suffix: 'all-foundation',
      quantity: 1,
      donationBasisPoints: 10_000,
      redeemedOrdinals: [1],
    })
    const service = new AllocationService({ database: database.db })

    const result = await service.reconcileCharge({
      chargeId: fixture.chargeId,
      operationKey: 'allocation:all-foundation:report-1',
      deductions: [],
    })

    expect(String(result.units[0]?.donationMinor)).toBe('10000')
    expect(String(result.units[0]?.venueMinor)).toBe('0')
    const invalidEntries = await database.sql`
      select id from finance_entry where amount_minor = 0
    `
    expect(invalidEntries).toHaveLength(0)
  }, 30_000)

  test('rejects final deduction lines without reviewed provider evidence', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedApprovedCharge({
      suffix: 'missing-evidence',
      quantity: 1,
      donationBasisPoints: 5_000,
    })
    const error = await captureError(() =>
      new AllocationService({ database: database!.db }).reconcileCharge({
        chargeId: fixture.chargeId,
        operationKey: 'allocation:missing-evidence:first',
        deductions: [
          {
            externalKey: 'gateway-fee',
            kind: 'gateway_fee',
            amount: '1.000000',
            finality: 'final',
          },
        ],
      })
    )
    expect(String(error)).toContain('reviewed provider evidence')
  }, 30_000)
})
