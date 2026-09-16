import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined

const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected the database operation to fail')
}

beforeAll(async () => {
  database = await createCommerceTestDatabase()
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

describe('commerce migration and finance invariants', () => {
  test('creates the durable attempt, unit, allocation, operation, and recovery tables', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const names = await database.sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'payment_attempt',
          'payment_charge',
          'charge_dispute',
          'payment_event',
          'customer_order',
          'commerce_order_snapshot',
          'commerce_order_unit',
          'commerce_beneficiary',
          'beneficiary_bank_version',
          'allocation_run',
          'unit_allocation',
          'financial_operation',
          'finance_evidence',
          'treasury_policy',
          'credit_reservation',
          'credit_debt',
          'recovery_checkpoint'
        )
      order by table_name
    `
    expect(names.map((row) => row.table_name)).toHaveLength(17)
  }, 30_000)

  test('backfills one customer order and aggregate relationships for each legacy order', async () => {
    const legacy = await createCommerceTestDatabase({
      beforeLatestMigration: async (sql) => {
        await sql`
          insert into venue
            (id, slug, name, type, address_line, city, department, latitude, longitude)
          values
            ('venue-legacy-order', 'legacy-order', 'Legacy Order', 'bar', 'Calle 1',
             'Manizales', 'Caldas', 5.0, -75.5)
        `
        await sql`
          insert into venue_product
            (id, venue_id, slug, name, kind, price, donation_percentage, status)
          values
            ('product-legacy-order', 'venue-legacy-order', 'legacy-drink', 'Legacy Drink',
             'cerveza', 24000, 50, 'published')
        `
        await sql`
          insert into product_order
            (id, product_id, venue_id, buyer_name, buyer_email, quantity, unit_price,
             donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
             public_token, pay_method, status, provider, provider_reference, paid_at, expires_at)
          values
            ('order-legacy', 'product-legacy-order', 'venue-legacy-order', 'Legacy Buyer',
             'legacy@example.test', 2, 24000, 50, 12000, 12000, 48000,
             'legacy-public-token', 'app', 'paid', 'epayco', 'legacy-provider-reference',
             now(), now() + interval '45 days')
        `
        await sql`
          insert into allocation_policy
            (id, version, name, effective_at)
          values
            ('policy-legacy', 99, 'Legacy test policy', now())
        `
        await sql`
          insert into commerce_order_snapshot
            (id, order_id, product_name, product_kind, venue_name, currency, quantity,
             unit_gross_minor, donation_basis_points, policy_disclosure,
             funding_classification)
          values
            ('snapshot-legacy', 'order-legacy', 'Legacy Drink', 'cerveza', 'Legacy Order',
             'COP', 2, 2400000, 5000, 'Legacy disclosure', 'legacy_unverified')
        `
        await sql`
          insert into payment_attempt
            (id, order_snapshot_id, submission_key, request_hash, provider,
             provider_config_version, merchant_account_key, environment, status)
          values
            ('attempt-legacy', 'snapshot-legacy', 'submission-legacy', 'hash-legacy',
             'epayco', 'v1', 'merchant-legacy', 'test', 'approved')
        `
        await sql`
          insert into payment_charge
            (id, attempt_id, provider, merchant_account_key, environment, provider_reference,
             gross_minor, currency, status)
          values
            ('charge-legacy', 'attempt-legacy', 'epayco', 'merchant-legacy', 'test',
             'charge-reference-legacy', 4800000, 'COP', 'approved')
        `
        await sql`
          insert into allocation_run
            (id, order_snapshot_id, charge_id, policy_id, revision, operation_key, input_digest,
             gross_minor, deduction_minor, net_minor)
          values
            ('allocation-legacy', 'snapshot-legacy', 'charge-legacy', 'policy-legacy', 1,
             'allocation-operation-legacy', 'allocation-digest-legacy', 4800000, 0, 4800000)
        `
        await sql.begin(async (transaction) => {
          await transaction`
            insert into finance_account
              (id, kind, owner_key, currency, funding_classification)
            values
              ('account-legacy-order-cash', 'platform_cash', 'legacy-order-cash', 'COP',
               'legacy_unverified'),
              ('account-legacy-order-clearing', 'gateway_clearing', 'legacy-order-clearing', 'COP',
               'legacy_unverified')
          `
          await transaction`
            insert into finance_transaction
              (id, operation_key, content_hash, kind, currency, order_snapshot_id)
            values
              ('transaction-legacy-order', 'transaction-operation-legacy-order',
               'transaction-hash-legacy-order', 'payment', 'COP', 'snapshot-legacy')
          `
          await transaction`
            insert into finance_entry
              (id, transaction_id, account_id, amount_minor, ordinal)
            values
              ('entry-legacy-order-1', 'transaction-legacy-order',
               'account-legacy-order-cash', 4800000, 1),
              ('entry-legacy-order-2', 'transaction-legacy-order',
               'account-legacy-order-clearing', -4800000, 2)
          `
          await transaction`
            update finance_transaction
            set status = 'posted', posted_at = now()
            where id = 'transaction-legacy-order'
          `
        })
      },
    })

    try {
      const [row] = await legacy.sql<
        Array<{
          parent_count: number
          customer_order_id: string
          line_ordinal: number
          parent_token: string
          attempt_parent_id: string
          allocation_parent_id: string
          transaction_parent_id: string
          transaction_status: string
        }>
      >`
        select
          (select count(*)::int from customer_order) as parent_count,
          o.customer_order_id,
          o.line_ordinal,
          c.public_token as parent_token,
          a.customer_order_id as attempt_parent_id,
          r.customer_order_id as allocation_parent_id,
          t.customer_order_id as transaction_parent_id,
          t.status as transaction_status
        from product_order o
        join customer_order c on c.id = o.customer_order_id
        join commerce_order_snapshot s on s.order_id = o.id
        join payment_attempt a on a.order_snapshot_id = s.id
        join allocation_run r on r.order_snapshot_id = s.id
        join finance_transaction t on t.order_snapshot_id = s.id
        where o.id = 'order-legacy'
      `

      expect(row).toMatchObject({
        parent_count: 1,
        line_ordinal: 1,
        parent_token: 'legacy-public-token',
        transaction_status: 'posted',
      })
      expect(row?.attempt_parent_id).toBe(row?.customer_order_id)
      expect(row?.allocation_parent_id).toBe(row?.customer_order_id)
      expect(row?.transaction_parent_id).toBe(row?.customer_order_id)

      const immutableTransactionError = await captureError(async () => {
        await legacy.sql`
          update finance_transaction
          set customer_order_id = null
          where id = 'transaction-legacy-order'
        `
      })
      expect(String(immutableTransactionError)).toContain('immutable')

      const duplicateOrdinalError = await captureError(async () => {
        await legacy.sql`
          insert into product_order
            (id, customer_order_id, line_ordinal, product_id, venue_id, buyer_name, buyer_email,
             quantity, unit_price, donation_percentage, unit_donation_amount, unit_venue_amount,
             total_amount, public_token, pay_method, status)
          values
            ('order-duplicate-line', ${row?.customer_order_id}, 1, 'product-legacy-order',
             'venue-legacy-order', 'Legacy Buyer', 'legacy@example.test', 1, 24000, 50, 12000,
             12000, 24000, 'legacy-line-token-duplicate', 'app', 'paid')
        `
      })
      expect(duplicateOrdinalError).toMatchObject({ code: '23505' })
    } finally {
      await legacy.close()
    }
  }, 120_000)

  test('enforces one finance account per exact owner identity', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const { sql } = database
    await sql`
      insert into finance_account
        (id, kind, owner_key, currency, funding_classification)
      values
        ('account-cash', 'platform_cash', 'platform', 'COP', 'sandbox')
      `

    const error = await captureError(async () => {
      await sql`
          insert into finance_account
            (id, kind, owner_key, currency, funding_classification)
          values
            ('account-cash-duplicate', 'platform_cash', 'platform', 'COP', 'sandbox')
        `
    })
    expect(error).toMatchObject({ code: '23505' })
  }, 30_000)

  test('posts a balanced transaction and makes it immutable', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const { sql } = database
    await sql`
      insert into finance_account
        (id, kind, owner_key, currency, funding_classification)
      values
        ('account-clearing', 'gateway_clearing', 'epayco-test', 'COP', 'sandbox')
    `

    await sql.begin(async (transaction) => {
      await transaction`
          insert into finance_transaction
            (id, operation_key, content_hash, kind, currency)
          values
            ('transaction-balanced', 'operation-balanced', 'hash-balanced', 'payment', 'COP')
        `
      await transaction`
          insert into finance_entry
            (id, transaction_id, account_id, amount_minor, ordinal)
          values
            ('entry-balanced-1', 'transaction-balanced', 'account-cash', 10000, 1),
            ('entry-balanced-2', 'transaction-balanced', 'account-clearing', -10000, 2)
        `
      await transaction`
          update finance_transaction
          set status = 'posted', posted_at = now()
          where id = 'transaction-balanced'
        `
    })

    const entryError = await captureError(async () => {
      await sql`
          update finance_entry
          set amount_minor = 9000
          where id = 'entry-balanced-1'
        `
    })
    expect(String(entryError)).toContain('immutable after posting')

    const transactionError = await captureError(async () => {
      await sql`
          update finance_transaction
          set content_hash = 'changed'
          where id = 'transaction-balanced'
        `
    })
    expect(String(transactionError)).toContain('immutable')
  }, 30_000)

  test('rejects an incomplete or unbalanced posted transaction at commit', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const { sql } = database
    const error = await captureError(async () => {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into finance_transaction
            (id, operation_key, content_hash, kind, currency)
          values
            ('transaction-unbalanced', 'operation-unbalanced', 'hash-unbalanced', 'payment', 'COP')
        `
        await transaction`
          insert into finance_entry
            (id, transaction_id, account_id, amount_minor, ordinal)
          values
            ('entry-unbalanced-1', 'transaction-unbalanced', 'account-cash', 10000, 1)
        `
        await transaction`
          update finance_transaction
          set status = 'posted', posted_at = now()
          where id = 'transaction-unbalanced'
        `
      })
    })
    expect(String(error)).toContain('must contain at least two balanced entries')

    const rows = await sql`
      select id from finance_transaction where id = 'transaction-unbalanced'
    `
    expect(rows).toHaveLength(0)
  }, 30_000)
})
