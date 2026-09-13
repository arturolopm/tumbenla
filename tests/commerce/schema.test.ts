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
    expect(names.map((row) => row.table_name)).toHaveLength(16)
  }, 30_000)

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
