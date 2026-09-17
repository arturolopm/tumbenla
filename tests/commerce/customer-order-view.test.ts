import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  loadCustomerOrderByToken,
  loadCustomerOrderStatusByToken,
} from '../../src/lib/commerce/customer-order-view'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values
      ('order-view-venue', 'order-view-venue', 'Bar Vista', 'bar', 'Calle 1', 'Bogotá',
       'Bogotá D.C.', 4.71, -74.07, 'published')
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, description, price, donation_percentage, status)
    values
      ('order-view-beer', 'order-view-venue', 'beer', 'Cerveza', 'cerveza', 'Fría', 100.00,
       50.00, 'published'),
      ('order-view-cocktail', 'order-view-venue', 'cocktail', 'Cóctel', 'coctel', 'Fuerte',
       50.00, 40.00, 'published')
  `
  await database.sql`
    insert into customer_order
      (id, venue_id, buyer_name, buyer_email, total_units, total_amount, public_token, pay_method,
       status, paid_at, expires_at)
    values
      ('order-view-parent', 'order-view-venue', 'Buyer', 'buyer@example.test', 3, 250.00,
       'order-view-parent-token', 'app', 'paid', now(), '2026-10-31T00:00:00Z')
  `
  await database.sql`
    insert into product_order
      (id, customer_order_id, line_ordinal, product_id, venue_id, buyer_name, buyer_email,
       quantity, unit_price, donation_percentage, unit_donation_amount, unit_venue_amount,
       total_amount, public_token, pay_method, status, paid_at, expires_at)
    values
      ('order-view-line-1', 'order-view-parent', 1, 'order-view-beer', 'order-view-venue',
       'Buyer', 'buyer@example.test', 2, 100.00, 50.00, 50.00, 50.00, 200.00,
       'order-view-line-token-1', 'app', 'paid', now(), '2026-10-31T00:00:00Z'),
      ('order-view-line-2', 'order-view-parent', 2, 'order-view-cocktail', 'order-view-venue',
       'Buyer', 'buyer@example.test', 1, 50.00, 40.00, 20.00, 30.00, 50.00,
       'order-view-line-token-2', 'app', 'paid', now(), '2026-10-31T00:00:00Z')
  `
  await database.sql`
    insert into commerce_order_snapshot
      (id, order_id, product_name, product_kind, product_description, venue_name, currency,
       quantity, unit_gross_minor, donation_basis_points, policy_disclosure,
       funding_classification)
    values
      ('order-view-snapshot-1', 'order-view-line-1', 'Cerveza', 'cerveza', 'Fría', 'Bar Vista',
       'COP', 2, 10000, 5000, 'Reparto congelado', 'legacy_unverified'),
      ('order-view-snapshot-2', 'order-view-line-2', 'Cóctel', 'coctel', 'Fuerte', 'Bar Vista',
       'COP', 1, 5000, 4000, 'Reparto congelado', 'legacy_unverified')
  `
  await database.sql`
    insert into order_redemption (id, order_id, code, status, redeemed_at)
    values
      ('order-view-redemption-1', 'order-view-line-1', 'VIEW0001', 'redeemed', now()),
      ('order-view-redemption-2', 'order-view-line-1', 'VIEW0002', 'issued', null),
      ('order-view-redemption-3', 'order-view-line-2', 'VIEW0003', 'issued', null)
  `
  await database.sql`
    insert into commerce_order_unit
      (id, order_snapshot_id, redemption_id, ordinal, gross_minor, lifecycle_status, expires_at,
       redeemed_at)
    values
      ('order-view-unit-1', 'order-view-snapshot-1', 'order-view-redemption-1', 1, 10000,
       'redeemed', '2026-10-31T00:00:00Z', now()),
      ('order-view-unit-2', 'order-view-snapshot-1', 'order-view-redemption-2', 2, 10000,
       'issued', '2026-10-31T00:00:00Z', null),
      ('order-view-unit-3', 'order-view-snapshot-2', 'order-view-redemption-3', 1, 5000,
       'issued', '2026-10-31T00:00:00Z', null)
  `
  await database.sql`
    insert into payment_attempt
      (id, order_snapshot_id, customer_order_id, submission_key, request_hash, provider,
       provider_config_version, merchant_account_key, environment, status)
    values
      ('order-view-attempt', 'order-view-snapshot-1', 'order-view-parent',
       'order-view-submission', 'hash', 'epayco', 'test-v1', 'merchant', 'test', 'approved')
  `
  await database.sql`
    insert into product_order
      (id, product_id, venue_id, buyer_name, buyer_email, quantity, unit_price,
       donation_percentage, unit_donation_amount, unit_venue_amount, total_amount, public_token,
       pay_method, status)
    values
      ('order-view-legacy', 'order-view-beer', 'order-view-venue', 'Legacy',
       'legacy@example.test', 1, 100.00, 50.00, 50.00, 50.00, 100.00,
       'order-view-legacy-token', 'bar', 'pending')
  `
  await database.sql`
    insert into order_redemption (id, order_id, code, status)
    values ('order-view-legacy-redemption', 'order-view-legacy', 'OLDV0001', 'issued')
  `
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

describe('customer order bearer view', () => {
  test('loads one mixed parent, one aggregate status, and legacy line tokens', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const order = await loadCustomerOrderByToken(database.db, 'order-view-parent-token')
    expect(order).toMatchObject({
      publicToken: 'order-view-parent-token',
      totalUnits: 3,
      totalAmount: 250,
      donationAmount: 120,
      venueAmount: 130,
      lines: [
        { productOrderId: 'order-view-line-1', productName: 'Cerveza', quantity: 2 },
        { productOrderId: 'order-view-line-2', productName: 'Cóctel', quantity: 1 },
      ],
    })
    expect(order?.units.map((unit) => unit.redemptionCode)).toEqual([
      'VIEW0001',
      'VIEW0002',
      'VIEW0003',
    ])

    const status = await loadCustomerOrderStatusByToken(database.db, 'order-view-parent-token')
    expect(status).toMatchObject({
      status: 'paid',
      paymentStatus: 'approved',
      deliveredUnits: 1,
      totalUnits: 3,
      refundStatus: 'none',
      allocationStatus: 'pending',
    })

    const legacy = await loadCustomerOrderByToken(database.db, 'order-view-legacy-token')
    expect(legacy).toMatchObject({
      publicToken: 'order-view-legacy-token',
      totalUnits: 1,
      totalAmount: 100,
      lines: [{ productOrderId: 'order-view-legacy', productName: 'Cerveza', quantity: 1 }],
      units: [
        {
          id: 'order-view-legacy-redemption',
          redemptionCode: 'OLDV0001',
          status: 'issued',
        },
      ],
    })
  }, 30_000)
})
