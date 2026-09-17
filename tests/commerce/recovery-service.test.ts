import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { GET as runRecoveryCron } from '../../src/app/api/cron/commerce-recovery/route'
import type { PaymentReconciliationResult } from '../../src/lib/commerce/payment-service'
import { CommerceRecoveryService } from '../../src/lib/commerce/recovery-service'
import type { ExpireUnitsResult } from '../../src/lib/commerce/unit-lifecycle-service'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined
const NOW = new Date('2026-09-12T20:00:00.000Z')

const seedAttempt = async (input: {
  id: string
  reference?: string
  checkoutSessionId?: string
  updatedAt: Date
}): Promise<void> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const orderId = `recovery-order-${input.id}`
  const snapshotId = `recovery-snapshot-${input.id}`
  await database.sql`
    insert into product_order
      (id, product_id, venue_id, buyer_name, buyer_email, quantity, unit_price,
       donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
       public_token, pay_method, status)
    values
      (${orderId}, 'recovery-product', 'recovery-venue', 'Cliente', 'recovery@example.test',
       1, 100.00, 50.00, 50.00, 50.00, 100.00, ${`token-${input.id}`}, 'app', 'pending')
  `
  await database.sql`
    insert into commerce_order_snapshot
      (id, order_id, product_name, product_kind, venue_name, currency, quantity,
       unit_gross_minor, donation_basis_points, allocation_policy_id,
       foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
       funding_classification)
    values
      (${snapshotId}, ${orderId}, 'Producto', 'coctel', 'Venue recovery', 'COP', 1, 10000,
       5000, 'recovery-policy', 'recovery-foundation', 'Foundation recovery', 'Reparto', 'real')
  `
  await database.sql`
    insert into payment_attempt
      (id, order_snapshot_id, submission_key, request_hash, provider,
       provider_config_version, merchant_account_key, environment,
       provider_attempt_reference, checkout_session_id, status, created_at, updated_at)
    values
      (${input.id}, ${snapshotId}, ${`submission-${input.id}`}, 'hash', 'epayco', 'live-v1',
       'merchant', 'live', ${input.reference ?? null}, ${input.checkoutSessionId ?? null}, 'pending',
       ${input.updatedAt.toISOString()}, ${input.updatedAt.toISOString()})
  `
}

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values
      ('recovery-venue', 'recovery-venue', 'Venue recovery', 'bar', 'Calle 1', 'Bogotá',
       'Bogotá D.C.', 4.710989, -74.072090, 'published')
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, price, currency, donation_percentage, status)
    values
      ('recovery-product', 'recovery-venue', 'recovery-product', 'Producto', 'coctel',
       100.00, 'COP', 50.00, 'published')
  `
  await database.sql`
    insert into allocation_policy (id, version, name, effective_at)
    values ('recovery-policy', 9901, 'Recovery policy', now() - interval '1 day')
  `
  await database.sql`
    insert into commerce_beneficiary
      (id, kind, legal_name, legal_identifier_hash, status)
    values ('recovery-foundation', 'foundation', 'Foundation recovery', 'recovery-hash', 'verified')
  `
  await seedAttempt({
    id: 'recovery-attempt-missing',
    updatedAt: new Date(NOW.getTime() - 30 * 60_000),
  })
  await seedAttempt({
    id: 'recovery-attempt-success',
    reference: 'RECOVERY-SUCCESS',
    updatedAt: new Date(NOW.getTime() - 20 * 60_000),
  })
  await seedAttempt({
    id: 'recovery-attempt-error',
    reference: 'RECOVERY-ERROR',
    updatedAt: new Date(NOW.getTime() - 10 * 60_000),
  })
  await seedAttempt({
    id: 'recovery-attempt-hosted-session',
    checkoutSessionId: 'hosted-session-without-transaction-yet',
    updatedAt: new Date(NOW.getTime() - 25 * 60_000),
  })
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

describe('CommerceRecoveryService', () => {
  test('cron route rejects an unauthenticated request without running recovery', async () => {
    const response = await runRecoveryCron(
      new Request('https://example.test/api/cron/commerce-recovery')
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false })
  })

  test('bounds batches, escalates missing references, prevents overlap, and persists failures', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    let unitRuns = 0
    const units = {
      expireDueUnits: async (): Promise<ExpireUnitsResult> => {
        unitRuns += 1
        return { reviewed: 1, expired: 1, retainedMinor: BigInt(10_000), errors: [] }
      },
    }
    const payments = {
      reconcileAttempt: async (input: {
        attemptId: string
        reference: string
      }): Promise<PaymentReconciliationResult> => {
        if (input.reference === 'RECOVERY-ERROR') throw new Error('provider unavailable')
        await database!.sql`
          update payment_attempt set status = 'approved', updated_at = ${NOW.toISOString()}
          where id = ${input.attemptId}
        `
        return { kind: 'applied', attemptId: input.attemptId, status: 'approved' }
      },
    }
    let ownerSequence = 0
    const service = () =>
      new CommerceRecoveryService({
        database: database!.db,
        payments,
        units,
        now: () => NOW,
        owner: () => `recovery-owner-${++ownerSequence}`,
      })

    const first = await service().run({ batchSize: 1, staleAfterSeconds: 60 })
    expect(first).toMatchObject({
      status: 'completed',
      attemptsReviewed: 1,
      attemptsEscalated: 1,
      attemptsRecovered: 0,
      attemptBacklog: 2,
    })
    const [missing] = await database.sql`
      select status, outcome_detail from payment_attempt where id = 'recovery-attempt-missing'
    `
    expect(missing).toMatchObject({
      status: 'operator_review',
      outcome_detail: 'missing-provider-reference',
    })
    const [hostedSession] = await database.sql`
      select status, outcome_detail from payment_attempt
      where id = 'recovery-attempt-hosted-session'
    `
    expect(hostedSession).toMatchObject({
      status: 'pending',
      outcome_detail: null,
    })

    const second = await service().run({ batchSize: 1, staleAfterSeconds: 60 })
    expect(second).toMatchObject({
      status: 'completed',
      attemptsReviewed: 1,
      attemptsRecovered: 1,
      attemptBacklog: 1,
    })

    await database.sql`
      update recovery_checkpoint
      set lease_owner = 'another-worker', lease_expires_at = ${new Date(
        NOW.getTime() + 60_000
      ).toISOString()}
      where job = 'commerce_daily' and scope = 'global'
    `
    const overlap = await service().run({ batchSize: 1, staleAfterSeconds: 60 })
    expect(overlap.status).toBe('overlap')
    expect(unitRuns).toBe(2)

    await database.sql`
      update recovery_checkpoint set lease_owner = null, lease_expires_at = null
      where job = 'commerce_daily' and scope = 'global'
    `
    const failed = await service().run({ batchSize: 1, staleAfterSeconds: 60 })
    expect(failed.status).toBe('completed_with_errors')
    expect(failed.errors).toContain('recovery-attempt-error: provider unavailable')
    expect(failed.attemptBacklog).toBe(1)
    const [checkpoint] = await database.sql`
      select lease_owner, lease_expires_at, last_succeeded_at, last_error, cursor
      from recovery_checkpoint where job = 'commerce_daily' and scope = 'global'
    `
    expect(checkpoint?.lease_owner).toBeNull()
    expect(checkpoint?.lease_expires_at).toBeNull()
    expect(checkpoint?.last_succeeded_at).not.toBeNull()
    expect(checkpoint?.last_error).toContain('provider unavailable')
    expect(checkpoint?.cursor).toBe('recovery-attempt-error')
  })
})
