import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  CommercePaymentService,
  type StartPaymentInput,
} from '../../src/lib/commerce/payment-service'
import {
  type AuthoritativePaymentQuery,
  type AuthoritativePaymentResult,
  type CheckoutCreationResult,
  type CheckoutRequest,
  type CollectionGateway,
  type CollectionGatewayCapabilities,
  type GatewayBinding,
  type HostedCheckoutLaunch,
  type NotificationAuthenticationResult,
  type RawNotificationFields,
  RegistryGatewaySelectionStrategy,
} from '../../src/lib/commerce/gateways'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

const BINDING: GatewayBinding = {
  provider: 'epayco',
  configVersion: 'test-v1',
  accountId: 'merchant-test',
  environment: 'test',
}

const CAPABILITIES: CollectionGatewayCapabilities = {
  hostedCheckout: true,
  paymentMethods: ['credit-card', 'debit-card', 'pse'],
  signedNotifications: true,
  authoritativeLookup: true,
  automaticRefunds: false,
  finalDeductionBreakdown: false,
  checkoutSplitting: false,
}

class TestCollectionGateway implements CollectionGateway {
  readonly binding: GatewayBinding
  readonly capabilities = CAPABILITIES
  createCalls = 0
  retrieveCalls = 0
  createBehavior: (request: CheckoutRequest) => Promise<CheckoutCreationResult> = async (
    request
  ) => ({
    kind: 'created',
    launch: this.resumeHostedCheckout(`session-${request.attemptId}`)!,
  })
  retrieveBehavior: (query: AuthoritativePaymentQuery) => Promise<AuthoritativePaymentResult> =
    async (query) => {
      const invoice = query.expected?.invoice
      const transactionId = query.expected?.transactionId
      const gross = query.expected?.gross
      if (!invoice || !transactionId || !gross) {
        return { kind: 'uncertain', reason: 'not-found' }
      }
      return {
        kind: 'verified',
        payment: {
          merchantId: this.binding.accountId,
          invoice,
          reference: query.reference,
          transactionId,
          gross,
          environment: this.binding.environment,
          status: 'approved',
          providerStatus: 'Aceptada',
        },
      }
    }
  authenticationBehavior: (fields: RawNotificationFields) => NotificationAuthenticationResult = (
    fields
  ) => {
    const reference = fields.x_ref_payco
    const transactionId = fields.x_transaction_id
    const gross = fields.x_amount
    const currency = fields.x_currency_code
    if (
      fields.x_signature !== 'valid-test-signature' ||
      typeof reference !== 'string' ||
      typeof transactionId !== 'string' ||
      typeof gross !== 'string' ||
      typeof currency !== 'string'
    ) {
      return { authenticated: false, reason: 'invalid-signature' }
    }
    return { authenticated: true, notification: { reference, transactionId, gross, currency } }
  }

  constructor(binding: GatewayBinding = BINDING) {
    this.binding = binding
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutCreationResult> {
    this.createCalls += 1
    return this.createBehavior(request)
  }

  resumeHostedCheckout(sessionId: string): HostedCheckoutLaunch | undefined {
    return {
      type: 'hosted-session',
      sessionId,
      scriptUrl: 'https://checkout.example.test/v2.js',
      testMode: true,
    }
  }

  authenticateNotification(fields: RawNotificationFields): NotificationAuthenticationResult {
    return this.authenticationBehavior(fields)
  }

  async retrievePayment(query: AuthoritativePaymentQuery): Promise<AuthoritativePaymentResult> {
    this.retrieveCalls += 1
    return this.retrieveBehavior(query)
  }
}

let database: CommerceTestDatabase | undefined
let codeSequence = 0

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into commerce_beneficiary
      (id, kind, legal_name, legal_identifier_hash, status, verified_at)
    values
      ('foundation-test', 'foundation', 'Fundación de prueba', 'foundation-hash', 'verified', now())
  `
  await database.sql`
    insert into allocation_policy
      (id, version, name, effective_at)
    values
      ('policy-test', 1, 'Política de prueba', now() - interval '1 day')
  `
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

const seedProduct = async (suffix: string, donationPercentage = '50.00'): Promise<string> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const venueId = `venue-${suffix}`
  const productId = `product-${suffix}`
  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values
      (${venueId}, ${`venue-${suffix}`}, ${`Venue ${suffix}`}, 'bar', 'Calle 1', 'Bogotá',
       'Bogotá D.C.', 4.710989, -74.072090, 'published')
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, description, price, currency,
       donation_percentage, status)
    values
      (${productId}, ${venueId}, ${`product-${suffix}`}, ${`Product ${suffix}`}, 'coctel',
       'Descripción de prueba', 30000.00, 'COP', ${donationPercentage}, 'published')
  `
  return productId
}

const paymentInput = (suffix: string, productId: string, quantity = 2): StartPaymentInput => ({
  submissionKey: `submission_${suffix.padEnd(16, 'x')}`,
  productId,
  buyerName: 'Persona de prueba',
  buyerEmail: `${suffix}@example.test`,
  quantity,
  userId: null,
})

const createService = (
  gateway: TestCollectionGateway,
  overrides: Partial<ConstructorParameters<typeof CommercePaymentService>[0]> = {}
): CommercePaymentService => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const gateways = new RegistryGatewaySelectionStrategy(BINDING, [gateway])
  return new CommercePaymentService({
    database: database.db,
    gateways,
    generateCode: () => (++codeSequence).toString(32).toUpperCase().padStart(8, '0'),
    generateToken: () => `token_${crypto.randomUUID()}`,
    ...overrides,
  })
}

const expectCheckout = (result: Awaited<ReturnType<CommercePaymentService['startPayment']>>) => {
  expect(result.kind).toBe('checkout')
  if (result.kind !== 'checkout') throw new Error('Expected hosted checkout')
  return result
}

const approve = async (
  service: CommercePaymentService,
  attemptId: string,
  reference = `reference-${attemptId}`,
  transactionId = `transaction-${attemptId}`
) => service.reconcileAttempt({ attemptId, reference, transactionId })

describe('CommercePaymentService checkout idempotency', () => {
  test('persists one immutable order and reuses its hosted session across identical retries', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('reuse')
    const gateway = new TestCollectionGateway()
    const service = createService(gateway)
    const input = paymentInput('reuse', productId, 2)

    const first = expectCheckout(await service.startPayment(input))
    const second = expectCheckout(await service.startPayment(input))

    expect(first.attemptId).toBe(second.attemptId)
    expect(first.orderToken).toBe(second.orderToken)
    expect(first.launch.sessionId).toBe(second.launch.sessionId)
    expect(gateway.createCalls).toBe(1)

    const [counts] = await database.sql<
      { orders: string; snapshots: string; attempts: string; units: string }[]
    >`
      select
        (select count(*) from product_order where product_id = ${productId}) as orders,
        (select count(*) from commerce_order_snapshot s
          join product_order o on o.id = s.order_id where o.product_id = ${productId}) as snapshots,
        (select count(*) from payment_attempt a
          join commerce_order_snapshot s on s.id = a.order_snapshot_id
          join product_order o on o.id = s.order_id where o.product_id = ${productId}) as attempts,
        (select count(*) from commerce_order_unit u
          join commerce_order_snapshot s on s.id = u.order_snapshot_id
          join product_order o on o.id = s.order_id where o.product_id = ${productId}) as units
    `
    expect(counts).toEqual({ orders: '1', snapshots: '1', attempts: '1', units: '2' })
  }, 30_000)

  test('lets only one concurrent caller contact the provider', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('concurrent')
    const gateway = new TestCollectionGateway()
    let releaseProvider!: () => void
    const providerBarrier = new Promise<void>((resolve) => {
      releaseProvider = resolve
    })
    gateway.createBehavior = async (request) => {
      await providerBarrier
      return {
        kind: 'created',
        launch: gateway.resumeHostedCheckout(`session-${request.attemptId}`)!,
      }
    }
    const service = createService(gateway)
    const input = paymentInput('concurrent', productId)

    const first = service.startPayment(input)
    while (gateway.createCalls === 0) await Bun.sleep(1)
    const second = service.startPayment(input)
    releaseProvider()
    const results = await Promise.all([first, second])

    expect(gateway.createCalls).toBe(1)
    expect(results.map((result) => result.kind).sort()).toEqual(['checkout', 'pending'])
    const attemptIds = results.flatMap((result) =>
      'attemptId' in result ? [result.attemptId] : []
    )
    expect(new Set(attemptIds).size).toBe(1)
  }, 30_000)

  test('rejects conflicting reuse of a submission key without creating a second order', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('conflict')
    const service = createService(new TestCollectionGateway())
    const input = paymentInput('conflict', productId)

    await service.startPayment(input)
    const result = await service.startPayment({ ...input, quantity: 3 })

    expect(result).toEqual({ kind: 'conflict', reason: 'submission-key-reused' })
    const [count] = await database.sql<{ value: string }[]>`
      select count(*) as value from product_order where product_id = ${productId}
    `
    expect(count?.value).toBe('1')
  }, 30_000)

  test('makes a checkout without a provider session explicitly retryable', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('uncertain')
    const gateway = new TestCollectionGateway()
    gateway.createBehavior = async () => ({ kind: 'uncertain', reason: 'network' })
    const service = createService(gateway)
    const input = paymentInput('uncertain', productId)

    const first = await service.startPayment(input)
    const retry = await service.startPayment(input)

    expect(first).toMatchObject({
      kind: 'checkout-unavailable',
      retryUrl: '/sitios/venue-uncertain/pedir/product-uncertain',
    })
    expect(retry).toMatchObject({
      kind: 'checkout-unavailable',
      retryUrl: '/sitios/venue-uncertain/pedir/product-uncertain',
    })
    expect(gateway.createCalls).toBe(1)
    const [attempt] = await database.sql<{ status: string }[]>`
      select status from payment_attempt where submission_key = ${input.submissionKey}
    `
    expect(attempt?.status).toBe('uncertain')
  }, 30_000)

  test('makes a provider rejection before session creation explicitly retryable', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('session-rejected')
    const gateway = new TestCollectionGateway()
    gateway.createBehavior = async () => ({ kind: 'rejected', reason: 'provider-rejected' })
    const service = createService(gateway)
    const input = paymentInput('session-rejected', productId)

    const first = await service.startPayment(input)
    const retry = await service.startPayment(input)

    expect(first).toMatchObject({
      kind: 'checkout-unavailable',
      retryUrl: '/sitios/venue-session-rejected/pedir/product-session-rejected',
    })
    expect(retry).toMatchObject({
      kind: 'checkout-unavailable',
      retryUrl: '/sitios/venue-session-rejected/pedir/product-session-rejected',
    })
    expect(gateway.createCalls).toBe(1)
    const [attempt] = await database.sql<{ status: string }[]>`
      select status from payment_attempt where submission_key = ${input.submissionKey}
    `
    expect(attempt?.status).toBe('declined')
  }, 30_000)

  test('creates a distinct order and checkout for a genuine second purchase', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('second-purchase')
    const gateway = new TestCollectionGateway()
    const service = createService(gateway)
    const firstInput = paymentInput('second-purchase-a', productId, 1)
    const secondInput = {
      ...firstInput,
      submissionKey: 'submission_second_purchase_b',
    }

    const first = expectCheckout(await service.startPayment(firstInput))
    const second = expectCheckout(await service.startPayment(secondInput))

    expect(second.attemptId).not.toBe(first.attemptId)
    expect(second.orderToken).not.toBe(first.orderToken)
    expect(gateway.createCalls).toBe(2)
    const [counts] = await database.sql<{ orders: string; attempts: string }[]>`
      select
        count(distinct o.id) as orders,
        count(distinct a.id) as attempts
      from payment_attempt a
      join commerce_order_snapshot s on s.id = a.order_snapshot_id
      join product_order o on o.id = s.order_id
      where o.product_id = ${productId}
    `
    expect(counts).toEqual({ orders: '2', attempts: '2' })
  }, 30_000)

  test('ignores client-supplied price, percentage, and recipient fields and freezes server data', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('server-snapshot', '40.00')
    const service = createService(new TestCollectionGateway())
    const malicious = {
      ...paymentInput('server-snapshot', productId, 2),
      unitGrossMinor: 1,
      donationPercentage: '100.00',
      foundationBeneficiaryId: 'attacker-recipient',
      merchantAccountKey: 'attacker-merchant',
    }

    const checkout = expectCheckout(await service.startPayment(malicious))
    const [snapshot] = await database.sql<
      {
        unit_gross_minor: string
        donation_basis_points: number
        foundation_beneficiary_id: string
        merchant_account_key: string
        quantity: number
      }[]
    >`
      select s.unit_gross_minor::text,
             s.donation_basis_points,
             s.foundation_beneficiary_id,
             a.merchant_account_key,
             s.quantity
      from payment_attempt a
      join commerce_order_snapshot s on s.id = a.order_snapshot_id
      where a.id = ${checkout.attemptId}
    `
    expect(snapshot).toEqual({
      unit_gross_minor: '3000000',
      donation_basis_points: 4000,
      foundation_beneficiary_id: 'foundation-test',
      merchant_account_key: 'merchant-test',
      quantity: 2,
    })
  }, 30_000)

  test('keeps an old pending attempt bound to its original provider configuration', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('provider-switch')
    const oldBinding = { ...BINDING, configVersion: 'old-v1' }
    const newBinding = { ...BINDING, configVersion: 'new-v2' }
    const oldGateway = new TestCollectionGateway(oldBinding)
    const newGateway = new TestCollectionGateway(newBinding)
    const original = new CommercePaymentService({
      database: database.db,
      gateways: new RegistryGatewaySelectionStrategy(oldBinding, [oldGateway]),
      generateCode: () => (++codeSequence).toString(32).toUpperCase().padStart(8, '0'),
      generateToken: () => `token_${crypto.randomUUID()}`,
    })
    const checkout = expectCheckout(
      await original.startPayment(paymentInput('provider-switch', productId, 1))
    )
    const afterSwitch = new CommercePaymentService({
      database: database.db,
      gateways: new RegistryGatewaySelectionStrategy(newBinding, [oldGateway, newGateway]),
      generateCode: () => (++codeSequence).toString(32).toUpperCase().padStart(8, '0'),
      generateToken: () => `token_${crypto.randomUUID()}`,
    })

    await approve(afterSwitch, checkout.attemptId)

    expect(oldGateway.retrieveCalls).toBe(1)
    expect(newGateway.retrieveCalls).toBe(0)
  }, 30_000)
})

describe('CommercePaymentService authoritative approval', () => {
  test('issues exact units and a balanced immutable posting only after approval', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('approval')
    const gateway = new TestCollectionGateway()
    const notified: { orderId: string; codes: readonly string[] }[] = []
    const service = createService(gateway, {
      notifyApproval: async (input) => {
        notified.push(input)
      },
    })
    const checkout = expectCheckout(await service.startPayment(paymentInput('approval', productId)))

    const before = await database.sql`
      select id from order_redemption where order_id = (
        select order_id from commerce_order_snapshot s
        join payment_attempt a on a.order_snapshot_id = s.id
        where a.id = ${checkout.attemptId}
      )
    `
    expect(before).toHaveLength(0)

    const result = await approve(service, checkout.attemptId)

    expect(result).toMatchObject({ kind: 'applied', status: 'approved', issuedUnitCount: 2 })
    expect(notified).toHaveLength(1)
    expect(notified[0]?.codes).toHaveLength(2)
    const [state] = await database.sql<
      {
        order_status: string
        attempt_status: string
        charges: string
        units: string
        entries: string
      }[]
    >`
      select
        o.status as order_status,
        a.status as attempt_status,
        (select count(*) from payment_charge c where c.attempt_id = a.id) as charges,
        (select count(*) from commerce_order_unit u
          where u.order_snapshot_id = s.id and u.lifecycle_status = 'issued') as units,
        (select count(*) from finance_entry e
          join finance_transaction t on t.id = e.transaction_id
          where t.order_snapshot_id = s.id and t.status = 'posted') as entries
      from payment_attempt a
      join commerce_order_snapshot s on s.id = a.order_snapshot_id
      join product_order o on o.id = s.order_id
      where a.id = ${checkout.attemptId}
    `
    expect(state).toEqual({
      order_status: 'paid',
      attempt_status: 'approved',
      charges: '1',
      units: '2',
      entries: '2',
    })

    const duplicate = await approve(service, checkout.attemptId)
    expect(duplicate).toMatchObject({ kind: 'applied', status: 'approved', duplicate: true })
    expect(notified).toHaveLength(1)
  }, 30_000)

  test('keeps pending PSE authoritative without issuing QR units', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('pending')
    const gateway = new TestCollectionGateway()
    gateway.retrieveBehavior = async (query) => ({
      kind: 'verified',
      payment: {
        merchantId: BINDING.accountId,
        invoice: query.expected!.invoice!,
        reference: query.reference,
        transactionId: query.expected!.transactionId!,
        gross: query.expected!.gross!,
        environment: 'test',
        status: 'pending',
        providerStatus: 'Pendiente',
      },
    })
    const service = createService(gateway)
    const checkout = expectCheckout(await service.startPayment(paymentInput('pending', productId)))

    const result = await approve(service, checkout.attemptId)

    expect(result).toMatchObject({ kind: 'pending', status: 'pending', issuedUnitCount: 0 })
    const redemptions = await database.sql`
      select r.id from order_redemption r
      join commerce_order_snapshot s on s.order_id = r.order_id
      where s.id = (select order_snapshot_id from payment_attempt where id = ${checkout.attemptId})
    `
    expect(redemptions).toHaveLength(0)
  }, 30_000)

  test('applies a late PSE approval and ignores an out-of-order pending status afterwards', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('late-pse')
    const gateway = new TestCollectionGateway()
    let status: 'pending' | 'approved' = 'pending'
    gateway.retrieveBehavior = async (query) => ({
      kind: 'verified',
      payment: {
        merchantId: BINDING.accountId,
        invoice: query.expected!.invoice!,
        reference: query.reference,
        transactionId: query.expected!.transactionId!,
        gross: query.expected!.gross!,
        environment: 'test',
        status,
        providerStatus: status === 'approved' ? 'Aceptada' : 'Pendiente',
      },
    })
    const service = createService(gateway)
    const checkout = expectCheckout(await service.startPayment(paymentInput('late-pse', productId)))
    const reference = 'late-pse-reference'
    const transactionId = 'late-pse-transaction'

    expect(await approve(service, checkout.attemptId, reference, transactionId)).toMatchObject({
      kind: 'pending',
      status: 'pending',
    })
    status = 'approved'
    expect(await approve(service, checkout.attemptId, reference, transactionId)).toMatchObject({
      kind: 'applied',
      status: 'approved',
      issuedUnitCount: 2,
    })
    status = 'pending'
    expect(await approve(service, checkout.attemptId, reference, transactionId)).toMatchObject({
      kind: 'applied',
      status: 'approved',
      duplicate: true,
      reason: 'stale-status-after-approval',
    })

    const [state] = await database.sql<
      { attempt_status: string; charge_status: string; units: string }[]
    >`
      select
        a.status as attempt_status,
        c.status as charge_status,
        (select count(*) from commerce_order_unit u
          where u.order_snapshot_id = a.order_snapshot_id and u.lifecycle_status = 'issued') as units
      from payment_attempt a
      join payment_charge c on c.attempt_id = a.id
      where a.id = ${checkout.attemptId}
    `
    expect(state).toEqual({ attempt_status: 'approved', charge_status: 'approved', units: '2' })
  }, 30_000)

  test('fails closed on facade-level tampering even if an adapter returns verified', async () => {
    const productId = await seedProduct('tamper')
    const gateway = new TestCollectionGateway()
    gateway.retrieveBehavior = async (query) => ({
      kind: 'verified',
      payment: {
        merchantId: 'different-merchant',
        invoice: 'different-invoice',
        reference: query.reference,
        transactionId: query.expected!.transactionId!,
        gross: { minorUnits: query.expected!.gross!.minorUnits - 1, currency: 'COP' },
        environment: 'test',
        status: 'approved',
        providerStatus: 'Aceptada',
      },
    })
    const service = createService(gateway)
    const checkout = expectCheckout(await service.startPayment(paymentInput('tamper', productId)))

    const result = await approve(service, checkout.attemptId)

    expect(result).toMatchObject({ kind: 'rejected', status: 'operator_review' })
    expect(result.reason).toContain('merchant,invoice,gross')
  }, 30_000)

  test('records a second approved charge as overpayment without extra entitlements', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('overpayment')
    const gateway = new TestCollectionGateway()
    const service = createService(gateway)
    const checkout = expectCheckout(
      await service.startPayment(paymentInput('overpayment', productId, 1))
    )
    await approve(service, checkout.attemptId, 'reference-first', 'transaction-first')

    const second = await approve(
      service,
      checkout.attemptId,
      'reference-second',
      'transaction-second'
    )

    expect(second).toMatchObject({
      kind: 'applied',
      status: 'operator_review',
      issuedUnitCount: 0,
      reason: 'additional-approved-charge',
    })
    const [counts] = await database.sql<{ charges: string; redemptions: string }[]>`
      select
        (select count(*) from payment_charge where attempt_id = ${checkout.attemptId}) as charges,
        (select count(*) from order_redemption r
          join commerce_order_snapshot s on s.order_id = r.order_id
          where s.id = (select order_snapshot_id from payment_attempt
            where id = ${checkout.attemptId})) as redemptions
    `
    expect(counts).toEqual({ charges: '2', redemptions: '1' })
  }, 30_000)

  test('rejects a provider charge reference already bound to another order', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('cross-order-charge')
    const service = createService(new TestCollectionGateway())
    const first = expectCheckout(
      await service.startPayment(paymentInput('cross-order-charge-a', productId, 1))
    )
    const second = expectCheckout(
      await service.startPayment(paymentInput('cross-order-charge-b', productId, 1))
    )
    const sharedReference = 'shared-provider-reference'

    await approve(service, first.attemptId, sharedReference, 'first-provider-transaction')
    const result = await approve(
      service,
      second.attemptId,
      sharedReference,
      'second-provider-transaction'
    )

    expect(result).toMatchObject({
      kind: 'rejected',
      status: 'operator_review',
      reason: 'provider-charge-bound-to-another-attempt',
    })
    const [count] = await database.sql<{ value: string }[]>`
      select count(*) as value from payment_charge where provider_reference = ${sharedReference}
    `
    expect(count?.value).toBe('1')
  }, 30_000)

  test('rolls back charge, order, QR, and posting together when the ledger fails', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('rollback')
    const gateway = new TestCollectionGateway()
    const service = createService(gateway)
    const checkout = expectCheckout(await service.startPayment(paymentInput('rollback', productId)))
    await database.sql`
      create function commerce_test_reject_entry() returns trigger language plpgsql as $$
      begin
        raise exception 'injected finance failure';
      end;
      $$
    `
    await database.sql`
      create trigger commerce_test_reject_entry
      before insert on finance_entry
      for each row execute function commerce_test_reject_entry()
    `

    let failure: unknown
    try {
      await approve(service, checkout.attemptId)
    } catch (error) {
      failure = error
    } finally {
      await database.sql`drop trigger commerce_test_reject_entry on finance_entry`
      await database.sql`drop function commerce_test_reject_entry()`
    }
    expect(failure).toBeDefined()

    const [state] = await database.sql<
      { order_status: string; charges: string; redemptions: string; postings: string }[]
    >`
      select
        o.status as order_status,
        (select count(*) from payment_charge where attempt_id = a.id) as charges,
        (select count(*) from order_redemption where order_id = o.id) as redemptions,
        (select count(*) from finance_transaction where order_snapshot_id = s.id) as postings
      from payment_attempt a
      join commerce_order_snapshot s on s.id = a.order_snapshot_id
      join product_order o on o.id = s.order_id
      where a.id = ${checkout.attemptId}
    `
    expect(state).toEqual({
      order_status: 'pending',
      charges: '0',
      redemptions: '0',
      postings: '0',
    })
  }, 30_000)
})

describe('CommercePaymentService notifications', () => {
  test('uses ref_payco for lookup and verifies the signed x_ref_payco separately', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('dual-provider-reference')
    const gateway = new TestCollectionGateway()
    gateway.authenticationBehavior = () => ({
      authenticated: true,
      notification: {
        reference: 'signed-provider-reference',
        lookupReference: 'opaque-lookup-reference',
        transactionId: 'dual-reference-transaction',
        gross: '30000.00',
        currency: 'COP',
      },
    })
    gateway.retrieveBehavior = async (query) => {
      expect(query.reference).toBe('opaque-lookup-reference')
      expect(query.expected?.providerReference).toBe('signed-provider-reference')
      return {
        kind: 'verified',
        payment: {
          merchantId: BINDING.accountId,
          invoice: query.expected!.invoice!,
          reference: query.expected!.providerReference!,
          transactionId: query.expected!.transactionId!,
          gross: query.expected!.gross!,
          environment: 'test',
          status: 'approved',
          providerStatus: 'Aceptada',
        },
      }
    }
    const service = createService(gateway)
    const checkout = expectCheckout(
      await service.startPayment(paymentInput('dual-provider-reference', productId, 1))
    )

    const result = await service.processNotification('epayco', {
      x_id_invoice: checkout.attemptId,
    })

    expect(result).toMatchObject({
      accepted: true,
      retryable: false,
      result: { kind: 'applied', status: 'approved', issuedUnitCount: 1 },
    })
  }, 30_000)

  test('authenticates, looks up, applies, and deduplicates provider callbacks', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('webhook')
    const gateway = new TestCollectionGateway()
    const service = createService(gateway)
    const checkout = expectCheckout(await service.startPayment(paymentInput('webhook', productId)))
    const fields = {
      x_id_invoice: checkout.attemptId,
      x_ref_payco: 'webhook-reference',
      x_transaction_id: 'webhook-transaction',
      x_amount: '60000.00',
      x_currency_code: 'COP',
      x_signature: 'valid-test-signature',
      x_response: 'Aceptada',
    }

    const first = await service.processNotification('epayco', fields)
    const duplicate = await service.processNotification('epayco', fields)

    expect(first).toMatchObject({
      accepted: true,
      duplicate: false,
      retryable: false,
      result: { kind: 'applied', status: 'approved', issuedUnitCount: 2 },
    })
    expect(duplicate).toMatchObject({ accepted: true, duplicate: true })
    expect(gateway.retrieveCalls).toBe(1)
    const events = await database.sql`
      select id from payment_event where attempt_id = ${checkout.attemptId}
    `
    expect(events).toHaveLength(1)
  }, 30_000)

  test('serializes concurrent duplicate callbacks into one charge and one entitlement set', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('concurrent-webhook')
    const gateway = new TestCollectionGateway()
    const service = createService(gateway)
    const checkout = expectCheckout(
      await service.startPayment(paymentInput('concurrent-webhook', productId))
    )
    const fields = {
      x_id_invoice: checkout.attemptId,
      x_ref_payco: 'concurrent-webhook-reference',
      x_transaction_id: 'concurrent-webhook-transaction',
      x_amount: '60000.00',
      x_currency_code: 'COP',
      x_signature: 'valid-test-signature',
      x_response: 'Aceptada',
    }

    const results = await Promise.all([
      service.processNotification('epayco', fields),
      service.processNotification('epayco', fields),
    ])

    expect(results.every((result) => result.accepted)).toBe(true)
    expect(results.some((result) => result.duplicate)).toBe(true)
    const [counts] = await database.sql<{ events: string; charges: string; units: string }[]>`
      select
        (select count(*) from payment_event where attempt_id = ${checkout.attemptId}) as events,
        (select count(*) from payment_charge where attempt_id = ${checkout.attemptId}) as charges,
        (select count(*) from commerce_order_unit u
          join payment_attempt a on a.order_snapshot_id = u.order_snapshot_id
          where a.id = ${checkout.attemptId} and u.lifecycle_status = 'issued') as units
    `
    expect(counts).toEqual({ events: '1', charges: '1', units: '2' })
  }, 30_000)

  test('records invalid and unknown callbacks without applying payment state', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('invalid-hook')
    const gateway = new TestCollectionGateway()
    const service = createService(gateway)
    const checkout = expectCheckout(
      await service.startPayment(paymentInput('invalid-hook', productId))
    )

    const invalid = await service.processNotification('epayco', {
      x_id_invoice: checkout.attemptId,
      x_ref_payco: 'invalid-reference',
      x_transaction_id: 'invalid-transaction',
      x_amount: '60000.00',
      x_currency_code: 'COP',
      x_signature: 'invalid',
    })
    const unknown = await service.processNotification('epayco', {
      x_id_invoice: 'unknown-attempt',
      x_ref_payco: 'unknown-reference',
    })

    expect(invalid).toMatchObject({ accepted: false, retryable: false })
    expect(unknown).toMatchObject({ accepted: false, retryable: false })
    const rows = await database.sql<{ environment: string; processing_status: string }[]>`
      select environment, processing_status from payment_event
      where provider_event_id in (
        select provider_event_id from payment_event
        where attempt_id = ${checkout.attemptId} or merchant_account_key = 'unbound'
      )
      order by environment
    `
    expect(rows).toContainEqual({ environment: 'test', processing_status: 'rejected' })
    expect(rows).toContainEqual({ environment: 'unknown', processing_status: 'rejected' })
  }, 30_000)

  test('keeps a lookup failure retryable and later applies the same persisted callback', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const productId = await seedProduct('webhook-retry')
    const gateway = new TestCollectionGateway()
    gateway.retrieveBehavior = async () => ({ kind: 'uncertain', reason: 'network' })
    const service = createService(gateway)
    const checkout = expectCheckout(
      await service.startPayment(paymentInput('webhook-retry', productId, 1))
    )
    const fields = {
      x_id_invoice: checkout.attemptId,
      x_ref_payco: 'webhook-retry-reference',
      x_transaction_id: 'webhook-retry-transaction',
      x_amount: '30000.00',
      x_currency_code: 'COP',
      x_signature: 'valid-test-signature',
    }

    expect(await service.processNotification('epayco', fields)).toMatchObject({
      accepted: false,
      duplicate: false,
      retryable: true,
      result: { kind: 'retryable', reason: 'network' },
    })
    gateway.retrieveBehavior = async (query) => ({
      kind: 'verified',
      payment: {
        merchantId: BINDING.accountId,
        invoice: query.expected!.invoice!,
        reference: query.reference,
        transactionId: query.expected!.transactionId!,
        gross: query.expected!.gross!,
        environment: 'test',
        status: 'approved',
        providerStatus: 'Aceptada',
      },
    })
    expect(await service.processNotification('epayco', fields)).toMatchObject({
      accepted: true,
      duplicate: true,
      retryable: false,
      result: { kind: 'applied', status: 'approved', issuedUnitCount: 1 },
    })
    const [event] = await database.sql<{ count: string; status: string }[]>`
      select count(*)::text as count, min(processing_status) as status
      from payment_event where attempt_id = ${checkout.attemptId}
    `
    expect(event).toEqual({ count: '1', status: 'applied' })
  }, 30_000)
})
