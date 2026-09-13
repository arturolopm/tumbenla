import { createHash } from 'node:crypto'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  EPAYCO_LOGIN_URL,
  EPAYCO_SESSION_URL,
  EPAYCO_VALIDATION_ORIGIN,
  EpaycoCollectionGateway,
  FakeCollectionGateway,
  RegistryGatewaySelectionStrategy,
  type AuthoritativePaymentQuery,
  type EpaycoGatewayConfig,
  type GatewayBinding,
  type RawNotificationFields,
} from '../../src/lib/commerce/gateways'
import { resolveCommerceNewOperationsEnabled } from '../../src/lib/commerce/payment-service-factory'

const EPAYCO_BINDING: GatewayBinding = {
  provider: 'epayco',
  configVersion: 'checkout-v2-2026-09',
  accountId: '0001234567',
  environment: 'test',
}

const CHECKOUT_REQUEST = {
  attemptId: 'attempt_01',
  invoice: 'invoice_01',
  productName: 'Producto de prueba',
  description: 'Producto de prueba de documentación',
  gross: { minorUnits: 3_000_000, currency: 'COP' as const },
  customer: { name: 'Persona de prueba', email: 'persona@example.test' },
}

const LOOKUP_QUERY = {
  reference: '00009876543210987654',
  expected: {
    invoice: 'invoice_01',
    transactionId: '0000000000000042',
    gross: { minorUnits: 3_000_000, currency: 'COP' },
  },
} satisfies AuthoritativePaymentQuery

type FetchCall = Readonly<{ input: RequestInfo | URL; init?: RequestInit }>
type FetchImplementation = NonNullable<EpaycoGatewayConfig['fetch']>

const setEnvironmentVariable = (
  name:
    | 'COMMERCE_BROWSER_TEST'
    | 'COMMERCE_FUNDING_CLASSIFICATION'
    | 'DATABASE_URL'
    | 'NODE_ENV'
    | 'VERCEL_ENV',
  value?: string
): void => {
  if (value === undefined) Reflect.deleteProperty(process.env, name)
  else Reflect.set(process.env, name, value)
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const createQueuedFetch = (responses: readonly (Response | Error)[]) => {
  const queue = [...responses]
  const calls: FetchCall[] = []
  const fetch: FetchImplementation = async (input, init) => {
    calls.push({ input, init })
    const next = queue.shift()
    if (!next) throw new Error('Unexpected fetch call')
    if (next instanceof Error) throw next
    return next
  }
  return { fetch, calls }
}

const createGateway = (fetch: FetchImplementation, binding = EPAYCO_BINDING) =>
  new EpaycoCollectionGateway({
    binding,
    publicKey: 'public-key-placeholder',
    privateKey: 'private-key-placeholder',
    pKey: 'signature-key-placeholder',
    merchantName: 'Tumbenla',
    applicationOrigin: 'https://checkout.example.test',
    fetch,
  })

const signedNotification = (
  overrides: Partial<Record<string, string | readonly string[]>> = {}
): RawNotificationFields => {
  const fields: Record<string, string | readonly string[]> = {
    x_ref_payco: '00009876543210987654',
    x_transaction_id: '0000000000000042',
    x_amount: '30000.00',
    x_currency_code: 'COP',
    x_id_invoice: 'invoice_01',
    x_response: 'Aceptada',
    x_test_request: 'true',
    ...overrides,
  }
  const signatureInput = [
    EPAYCO_BINDING.accountId,
    'signature-key-placeholder',
    fields.x_ref_payco,
    fields.x_transaction_id,
    fields.x_amount,
    fields.x_currency_code,
  ].join('^')
  fields.x_signature = createHash('sha256').update(signatureInput).digest('hex')
  return fields
}

const validationPayload = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    x_cust_id_cliente: EPAYCO_BINDING.accountId,
    x_id_invoice: LOOKUP_QUERY.expected.invoice,
    x_ref_payco: LOOKUP_QUERY.reference,
    x_transaction_id: LOOKUP_QUERY.expected.transactionId,
    x_amount: '30000.00',
    x_currency_code: 'COP',
    x_test_request: 'true',
    x_response: 'Aceptada',
    x_transaction_state: 'Aceptada',
    ...overrides,
  },
})

describe('ePayco checkout session creation', () => {
  test('authenticates in the backend and creates a v2 hosted session with fixed callbacks', async () => {
    const queued = createQueuedFetch([
      jsonResponse({ token: 'apify-token-placeholder' }),
      jsonResponse({ success: true, data: { sessionId: 'session_01', token: 'unused-token' } }),
    ])
    const gateway = createGateway(queued.fetch)

    const result = await gateway.createCheckout(CHECKOUT_REQUEST)

    expect(result).toEqual({
      kind: 'created',
      launch: {
        type: 'hosted-session',
        sessionId: 'session_01',
        scriptUrl: 'https://checkout.epayco.co/checkout-v2.js',
        testMode: true,
      },
    })
    expect(queued.calls).toHaveLength(2)
    expect(queued.calls[0]?.input).toBe(EPAYCO_LOGIN_URL)
    expect(queued.calls[0]?.init?.redirect).toBe('error')
    expect(new Headers(queued.calls[0]?.init?.headers).get('authorization')).toBe(
      `Basic ${Buffer.from('public-key-placeholder:private-key-placeholder').toString('base64')}`
    )
    expect(queued.calls[1]?.input).toBe(EPAYCO_SESSION_URL)
    expect(queued.calls[1]?.init?.redirect).toBe('error')
    expect(new Headers(queued.calls[1]?.init?.headers).get('authorization')).toBe(
      'Bearer apify-token-placeholder'
    )

    const body = JSON.parse(String(queued.calls[1]?.init?.body))
    expect(body).toEqual({
      checkout_version: '2',
      name: 'Tumbenla',
      description: CHECKOUT_REQUEST.description,
      currency: 'COP',
      amount: 30000,
      invoice: 'invoice_01',
      lang: 'ES',
      country: 'CO',
      response: 'https://checkout.example.test/pago/respuesta',
      confirmation: 'https://checkout.example.test/api/comercio/pagos/epayco/confirmacion',
      method: 'POST',
      uniqueTransactionPerBill: true,
      billing: CHECKOUT_REQUEST.customer,
    })
    expect(JSON.stringify(body)).not.toContain(CHECKOUT_REQUEST.attemptId)
    expect(JSON.stringify(body)).not.toContain('/orden/')
  })

  test('distinguishes deterministic rejection from an uncertain session outcome', async () => {
    const rejectedLogin = createQueuedFetch([jsonResponse({ error: 'unauthorized' }, 401)])
    expect(await createGateway(rejectedLogin.fetch).createCheckout(CHECKOUT_REQUEST)).toEqual({
      kind: 'rejected',
      reason: 'authentication-rejected',
    })

    const timedOutSession = createQueuedFetch([
      jsonResponse({ token: 'apify-token-placeholder' }),
      new Error('connection ended after request submission'),
    ])
    expect(await createGateway(timedOutSession.fetch).createCheckout(CHECKOUT_REQUEST)).toEqual({
      kind: 'uncertain',
      reason: 'network',
    })

    const rejectedSession = createQueuedFetch([
      jsonResponse({ token: 'apify-token-placeholder' }),
      jsonResponse({ success: false }, 422),
    ])
    expect(await createGateway(rejectedSession.fetch).createCheckout(CHECKOUT_REQUEST)).toEqual({
      kind: 'rejected',
      reason: 'provider-rejected',
    })
  })

  test('treats malformed success payloads and provider errors as uncertain', async () => {
    const malformedLogin = createQueuedFetch([jsonResponse({ token: 123 })])
    expect(await createGateway(malformedLogin.fetch).createCheckout(CHECKOUT_REQUEST)).toEqual({
      kind: 'uncertain',
      reason: 'malformed-response',
    })

    const malformedSession = createQueuedFetch([
      jsonResponse({ token: 'apify-token-placeholder' }),
      jsonResponse({ success: true, data: { sessionId: 123 } }),
    ])
    expect(await createGateway(malformedSession.fetch).createCheckout(CHECKOUT_REQUEST)).toEqual({
      kind: 'uncertain',
      reason: 'malformed-response',
    })

    const unavailable = createQueuedFetch([jsonResponse({}, 503)])
    expect(await createGateway(unavailable.fetch).createCheckout(CHECKOUT_REQUEST)).toEqual({
      kind: 'uncertain',
      reason: 'provider-unavailable',
    })
  })
})

describe('ePayco notification authentication', () => {
  const unusedFetch: FetchImplementation = async () => {
    throw new Error('fetch must not be used while authenticating a callback')
  }

  test('hashes the untouched provider strings and returns only signed fields', () => {
    const gateway = createGateway(unusedFetch)
    const fields = signedNotification({ x_amount: '030000.00' })

    expect(gateway.authenticateNotification(fields)).toEqual({
      authenticated: true,
      notification: {
        reference: '00009876543210987654',
        transactionId: '0000000000000042',
        gross: '030000.00',
        currency: 'COP',
      },
    })
  })

  test('does not mistake unsigned invoice, status, or environment for authenticated data', () => {
    const gateway = createGateway(unusedFetch)
    const original = gateway.authenticateNotification(signedNotification())
    const modifiedUnsigned = gateway.authenticateNotification(
      signedNotification({
        x_id_invoice: 'another-invoice',
        x_response: 'Aceptada',
        x_test_request: 'false',
      })
    )

    expect(modifiedUnsigned).toEqual(original)
    expect(modifiedUnsigned).not.toHaveProperty('notification.invoice')
    expect(modifiedUnsigned).not.toHaveProperty('notification.status')
    expect(modifiedUnsigned).not.toHaveProperty('notification.environment')
  })

  test('rejects missing, duplicate, malformed, and changed signed fields', () => {
    const gateway = createGateway(unusedFetch)
    const missing = { ...signedNotification() }
    Reflect.deleteProperty(missing, 'x_signature')
    expect(gateway.authenticateNotification(missing)).toEqual({
      authenticated: false,
      reason: 'missing-field',
    })

    expect(
      gateway.authenticateNotification(
        signedNotification({ x_ref_payco: ['00009876543210987654', 'second-reference'] })
      )
    ).toEqual({ authenticated: false, reason: 'duplicate-field' })

    expect(
      gateway.authenticateNotification({ ...signedNotification(), x_signature: 'not-hex' })
    ).toEqual({ authenticated: false, reason: 'invalid-signature' })

    expect(
      gateway.authenticateNotification({ ...signedNotification(), x_amount: '30000' })
    ).toEqual({ authenticated: false, reason: 'invalid-signature' })
  })
})

describe('ePayco authoritative lookup', () => {
  test('uses the fixed host, preserves the reference string, and verifies every expected field', async () => {
    const maliciousLookingReference = '0000//evil.example/path?amount=1'
    const query = { ...LOOKUP_QUERY, reference: maliciousLookingReference }
    const queued = createQueuedFetch([
      jsonResponse(validationPayload({ x_ref_payco: maliciousLookingReference })),
    ])

    const result = await createGateway(queued.fetch).retrievePayment(query)

    expect(result.kind).toBe('verified')
    if (result.kind !== 'verified') throw new Error('Expected a verified fixture')
    expect(result.payment.reference).toBe(maliciousLookingReference)
    expect(result.payment.transactionId).toBe('0000000000000042')
    expect(result.payment.gross).toEqual({ minorUnits: 3_000_000, currency: 'COP' })
    expect(result.payment.environment).toBe('test')
    expect(result.payment.status).toBe('approved')

    const lookupUrl = new URL(String(queued.calls[0]?.input))
    expect(lookupUrl.origin).toBe(EPAYCO_VALIDATION_ORIGIN)
    expect(lookupUrl.pathname).toBe(
      `/validation/v1/reference/${encodeURIComponent(maliciousLookingReference)}`
    )
    expect(queued.calls[0]?.init?.redirect).toBe('error')
  })

  test('reports all merchant, invoice, reference, transaction, gross, currency, and environment mismatches', async () => {
    const queued = createQueuedFetch([
      jsonResponse(
        validationPayload({
          x_cust_id_cliente: 'different-merchant',
          x_id_invoice: 'different-invoice',
          x_ref_payco: 'different-reference',
          x_transaction_id: 'different-transaction',
          x_amount: '30000.01',
          x_currency_code: 'USD',
          x_test_request: 'false',
        })
      ),
    ])

    expect(await createGateway(queued.fetch).retrievePayment(LOOKUP_QUERY)).toEqual({
      kind: 'mismatch',
      fields: [
        'merchant',
        'invoice',
        'reference',
        'transaction',
        'gross',
        'currency',
        'environment',
      ],
    })
  })

  test('keeps pending PSE authoritative without approving it', async () => {
    const queued = createQueuedFetch([
      jsonResponse(
        validationPayload({ x_response: 'Pendiente', x_transaction_state: 'Pendiente' })
      ),
    ])
    const result = await createGateway(queued.fetch).retrievePayment(LOOKUP_QUERY)
    expect(result.kind).toBe('verified')
    if (result.kind !== 'verified') throw new Error('Expected a verified fixture')
    expect(result.payment.status).toBe('pending')
  })

  test('supports a bounded reference-only lookup for browser return recovery', async () => {
    const queued = createQueuedFetch([jsonResponse(validationPayload())])
    const result = await createGateway(queued.fetch).retrievePayment({
      reference: LOOKUP_QUERY.reference,
    })

    expect(result.kind).toBe('verified')
    if (result.kind !== 'verified') throw new Error('Expected a verified fixture')
    expect(result.payment.invoice).toBe('invoice_01')
    expect(result.payment.gross).toEqual({ minorUnits: 3_000_000, currency: 'COP' })
  })

  test('fails closed as uncertain for malformed, non-string, and contradictory responses', async () => {
    const fixtures = [
      validationPayload({ x_ref_payco: 987654321 }),
      validationPayload({ x_amount: '30000.001' }),
      validationPayload({ x_test_request: 'TRUE' }),
      validationPayload({ x_response: 'Aceptada', x_transaction_state: 'Rechazada' }),
      { success: true, data: null },
    ]

    for (const fixture of fixtures) {
      const queued = createQueuedFetch([jsonResponse(fixture)])
      expect(await createGateway(queued.fetch).retrievePayment(LOOKUP_QUERY)).toEqual({
        kind: 'uncertain',
        reason: 'malformed-response',
      })
    }
  })

  test('does not convert network, not-found, or provider errors into payment failure', async () => {
    const cases = [
      {
        response: new Error('network unavailable'),
        expected: { kind: 'uncertain', reason: 'network' },
      },
      {
        response: jsonResponse({}, 404),
        expected: { kind: 'uncertain', reason: 'not-found' },
      },
      {
        response: jsonResponse({}, 503),
        expected: { kind: 'uncertain', reason: 'provider-unavailable' },
      },
    ] as const

    for (const current of cases) {
      const queued = createQueuedFetch([current.response])
      expect(await createGateway(queued.fetch).retrievePayment(LOOKUP_QUERY)).toEqual(
        current.expected
      )
    }
  })
})

describe('gateway selection and fake safety', () => {
  const originalBrowserTest = process.env.COMMERCE_BROWSER_TEST
  const originalFundingClassification = process.env.COMMERCE_FUNDING_CLASSIFICATION
  const originalDatabaseUrl = process.env.DATABASE_URL
  const originalVercelEnvironment = process.env.VERCEL_ENV
  const originalNodeEnvironment = process.env.NODE_ENV

  afterEach(() => {
    setEnvironmentVariable('COMMERCE_BROWSER_TEST', originalBrowserTest)
    setEnvironmentVariable('COMMERCE_FUNDING_CLASSIFICATION', originalFundingClassification)
    setEnvironmentVariable('DATABASE_URL', originalDatabaseUrl)
    setEnvironmentVariable('VERCEL_ENV', originalVercelEnvironment)
    setEnvironmentVariable('NODE_ENV', originalNodeEnvironment)
  })

  test('selects the active binding only for new attempts and resolves old persisted versions', () => {
    setEnvironmentVariable('VERCEL_ENV')
    setEnvironmentVariable('NODE_ENV', 'test')
    const oldBinding: GatewayBinding = {
      provider: 'fake',
      configVersion: 'v1',
      accountId: 'test-account',
      environment: 'test',
    }
    const currentBinding: GatewayBinding = { ...oldBinding, configVersion: 'v2' }
    const oldGateway = new FakeCollectionGateway({ binding: oldBinding })
    const currentGateway = new FakeCollectionGateway({ binding: currentBinding })
    const selection = new RegistryGatewaySelectionStrategy(currentBinding, [
      oldGateway,
      currentGateway,
    ])

    expect(selection.selectForNewAttempt({ currency: 'COP' })).toEqual({
      binding: currentBinding,
      gateway: currentGateway,
    })
    expect(selection.resolvePersisted(oldBinding)).toBe(oldGateway)
    expect(selection.resolveCandidates('fake')).toEqual([oldGateway, currentGateway])
    expect(selection.resolveCandidates('epayco')).toEqual([])
    expect(() =>
      selection.resolvePersisted({ ...oldBinding, accountId: 'another-account' })
    ).toThrow('No collection gateway is registered for the persisted binding')
  })

  test('fake checkout works locally but refuses live bindings, production, and deployments', async () => {
    setEnvironmentVariable('VERCEL_ENV')
    setEnvironmentVariable('NODE_ENV', 'test')
    const binding: GatewayBinding = {
      provider: 'fake',
      configVersion: 'test-v1',
      accountId: 'test-account',
      environment: 'test',
    }
    const fake = new FakeCollectionGateway({ binding })
    expect(await fake.createCheckout(CHECKOUT_REQUEST)).toEqual({
      kind: 'created',
      launch: {
        type: 'test-redirect',
        url: '/pago/respuesta',
        reference: 'fake-attempt_01',
        transactionId: 'fake-attempt_01',
      },
    })

    expect(
      () => new FakeCollectionGateway({ binding: { ...binding, environment: 'live' } })
    ).toThrow('only supports a fake test binding')

    setEnvironmentVariable('NODE_ENV', 'production')
    expect(() => new FakeCollectionGateway({ binding })).toThrow(
      'unavailable in deployed or live operation'
    )

    setEnvironmentVariable('COMMERCE_BROWSER_TEST', 'true')
    setEnvironmentVariable('COMMERCE_FUNDING_CLASSIFICATION', 'sandbox')
    setEnvironmentVariable(
      'DATABASE_URL',
      'postgres://browser-test@127.0.0.1:5432/tumbenla_e2e_fixture'
    )
    expect(() => new FakeCollectionGateway({ binding })).not.toThrow()

    setEnvironmentVariable('DATABASE_URL', 'postgres://browser-test@example.test/app')
    expect(() => new FakeCollectionGateway({ binding })).toThrow(
      'unavailable in deployed or live operation'
    )

    setEnvironmentVariable('NODE_ENV', 'test')
    setEnvironmentVariable('VERCEL_ENV', 'preview')
    setEnvironmentVariable(
      'DATABASE_URL',
      'postgres://browser-test@127.0.0.1:5432/tumbenla_e2e_fixture'
    )
    expect(() => new FakeCollectionGateway({ binding })).toThrow(
      'unavailable in deployed or live operation'
    )
  })

  test('new operations fail closed in deployments unless the rollout switch is explicit', () => {
    expect(resolveCommerceNewOperationsEnabled({ nodeEnvironment: 'production' })).toBe(false)
    expect(
      resolveCommerceNewOperationsEnabled({
        nodeEnvironment: 'test',
        vercelEnvironment: 'preview',
      })
    ).toBe(false)
    expect(
      resolveCommerceNewOperationsEnabled({
        configured: 'true',
        nodeEnvironment: 'production',
        vercelEnvironment: 'production',
      })
    ).toBe(true)
    expect(
      resolveCommerceNewOperationsEnabled({
        configured: 'false',
        nodeEnvironment: 'development',
      })
    ).toBe(false)
  })
})
