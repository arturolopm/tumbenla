import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { listCustomerOrders, summarizeNonRealOrders } from '../../src/lib/commerce/customer-history'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined
const USER_ID = 'customer-history-user'
const VENUE_ID = 'customer-history-venue'

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into "user" (id, name, email, email_verified)
    values (${USER_ID}, 'History User', 'customer-history@example.test', true)
  `
  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values
      (${VENUE_ID}, 'history-venue', 'History Venue', 'bar', 'Calle 1', 'Manizales', 'Caldas',
       5.0, -75.5, 'published')
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, price, donation_percentage, status)
    values
      ('customer-history-product-a', ${VENUE_ID}, 'history-a', 'Cerveza', 'cerveza', 100.00, 50.00,
       'published'),
      ('customer-history-product-b', ${VENUE_ID}, 'history-b', 'Cóctel', 'coctel', 50.00, 40.00,
       'published')
  `
  await database.sql`
    insert into customer_order
      (id, venue_id, user_id, buyer_name, buyer_email, total_units, total_amount, public_token,
       pay_method, status, created_at, updated_at)
    values
      ('customer-history-parent', ${VENUE_ID}, ${USER_ID}, 'History User',
       'customer-history@example.test', 3, 250.00, 'history-parent-token', 'app', 'paid',
       '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')
  `
  await database.sql`
    insert into product_order
      (id, customer_order_id, line_ordinal, product_id, venue_id, user_id, buyer_name, buyer_email,
       quantity, unit_price, donation_percentage, unit_donation_amount, unit_venue_amount,
       total_amount, public_token, pay_method, status, created_at, updated_at)
    values
      ('customer-history-line-b', 'customer-history-parent', 2, 'customer-history-product-b',
       ${VENUE_ID}, ${USER_ID}, 'History User', 'customer-history@example.test', 1, 50.00, 40.00,
       20.00, 30.00, 50.00, 'history-line-b-token', 'app', 'paid',
       '2026-09-10T12:00:02Z', '2026-09-10T12:00:02Z'),
      ('customer-history-line-a', 'customer-history-parent', 1, 'customer-history-product-a',
       ${VENUE_ID}, ${USER_ID}, 'History User', 'customer-history@example.test', 2, 100.00, 30.00,
       30.00, 70.00, 200.00, 'history-line-a-token', 'app', 'paid',
       '2026-09-10T12:00:01Z', '2026-09-10T12:00:01Z')
  `
  await database.sql`
    insert into order_redemption (id, order_id, code, status)
    values
      ('customer-history-redemption-a1', 'customer-history-line-a', 'HISTA001', 'redeemed'),
      ('customer-history-redemption-a2', 'customer-history-line-a', 'HISTA002', 'redeemed'),
      ('customer-history-redemption-b', 'customer-history-line-b', 'HISTB001', 'issued')
  `
  await database.sql`
    insert into product_order
      (id, product_id, venue_id, user_id, buyer_name, buyer_email, quantity, unit_price,
       donation_percentage, unit_donation_amount, unit_venue_amount, total_amount, public_token,
       pay_method, status, created_at, updated_at)
    values
      ('customer-history-legacy', 'customer-history-product-a', ${VENUE_ID}, ${USER_ID},
       'History User', 'customer-history@example.test', 1, 40.00, 25.00, 10.00, 30.00, 40.00,
       'history-legacy-token', 'app', 'paid', '2026-09-09T12:00:00Z', '2026-09-09T12:00:00Z')
  `
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

describe('customer history aggregation', () => {
  test('returns one parent row with ordered lines and keeps a legacy line visible', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')

    const orders = await listCustomerOrders(database.db, USER_ID)
    const parent = orders.find((order) => order.id === 'customer-history-parent')
    const legacy = orders.find((order) => order.id === 'customer-history-legacy')

    expect(orders).toHaveLength(2)
    expect(parent).toMatchObject({
      publicToken: 'history-parent-token',
      quantity: 3,
      totalMinor: BigInt(25_000),
      promisedDonationMinor: BigInt(8_000),
      redeemedUnits: 2,
      status: 'paid',
      lines: [
        { productOrderId: 'customer-history-line-a', productName: 'Cerveza', quantity: 2 },
        { productOrderId: 'customer-history-line-b', productName: 'Cóctel', quantity: 1 },
      ],
    })
    expect(parent?.fundingClassification).toBe('legacy_unverified')
    expect(legacy).toMatchObject({
      publicToken: 'history-legacy-token',
      quantity: 1,
      totalMinor: BigInt(4_000),
      promisedDonationMinor: BigInt(1_000),
      redeemedUnits: 0,
      lines: [{ productOrderId: 'customer-history-legacy', productName: 'Cerveza', quantity: 1 }],
    })
    expect(summarizeNonRealOrders(orders)).toEqual({
      spentMinor: BigInt(29_000),
      promisedDonationMinor: BigInt(9_000),
      orderCount: 2,
    })
  })
})
