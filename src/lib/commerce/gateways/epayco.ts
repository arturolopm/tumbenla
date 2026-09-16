import 'server-only'

import { Buffer } from 'node:buffer'
import { createHash, timingSafeEqual } from 'node:crypto'
import type {
  AuthoritativePaymentQuery,
  AuthoritativePaymentResult,
  CheckoutCreationResult,
  CheckoutRequest,
  CollectionGateway,
  CollectionGatewayCapabilities,
  GatewayBinding,
  GatewayEnvironment,
  HostedCheckoutLaunch,
  NotificationAuthenticationResult,
  PaymentStatus,
  RawNotificationFields,
  VerificationMismatchField,
} from './contract'

export const EPAYCO_LOGIN_URL = 'https://apify.epayco.co/login'
export const EPAYCO_SESSION_URL = 'https://apify.epayco.co/payment/session/create'
export const EPAYCO_TRANSACTION_URL = 'https://apify.epayco.co/payment/transaction'
export const EPAYCO_VALIDATION_ORIGIN = 'https://secure.epayco.co'
export const EPAYCO_CHECKOUT_SCRIPT_URL = 'https://checkout.epayco.co/checkout-v2.js'

const RESPONSE_PATH = '/pago/respuesta'
const CONFIRMATION_PATH = '/api/comercio/pagos/epayco/confirmacion'
const COP_MINOR_UNIT_SCALE = 100

const EPAYCO_CAPABILITIES: CollectionGatewayCapabilities = Object.freeze({
  hostedCheckout: true,
  paymentMethods: Object.freeze(['credit-card', 'debit-card', 'pse'] as const),
  signedNotifications: true,
  authoritativeLookup: true,
  automaticRefunds: false,
  finalDeductionBreakdown: false,
  checkoutSplitting: false,
})

type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>

export type EpaycoGatewayConfig = Readonly<{
  binding: GatewayBinding
  publicKey: string
  privateKey: string
  pKey: string
  merchantName: string
  applicationOrigin: string
  requestTimeoutMs?: number
  fetch?: FetchImplementation
}>

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readNonEmptyString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const readProviderScalar = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key]
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  return undefined
}

const readRawField = (
  fields: RawNotificationFields,
  key: string
): { kind: 'value'; value: string } | { kind: 'missing' | 'duplicate' } => {
  const value = fields[key]
  if (Array.isArray(value)) return { kind: 'duplicate' }
  if (typeof value !== 'string' || value.length === 0) return { kind: 'missing' }
  return { kind: 'value', value }
}

const safeSignatureEqual = (expectedHex: string, candidate: string): boolean => {
  const expected = Buffer.from(expectedHex, 'hex')
  const candidateBytes = /^[0-9a-fA-F]{64}$/.test(candidate)
    ? Buffer.from(candidate, 'hex')
    : Buffer.alloc(expected.length)
  return timingSafeEqual(expected, candidateBytes)
}

const parseProviderAmount = (value: string): number | undefined => {
  const match = /^(?:0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return undefined

  const fraction = (match[1] ?? '').padEnd(2, '0')
  const [whole] = value.split('.')
  const minorUnits = Number(whole) * COP_MINOR_UNIT_SCALE + Number(fraction)
  return Number.isSafeInteger(minorUnits) ? minorUnits : undefined
}

const minorUnitsToProviderAmount = (minorUnits: number): number =>
  Number((minorUnits / COP_MINOR_UNIT_SCALE).toFixed(2))

const isValidCheckoutRequest = (request: CheckoutRequest): boolean =>
  request.attemptId.length > 0 &&
  request.invoice.length > 0 &&
  request.productName.length > 0 &&
  request.description.length > 0 &&
  request.customer.name.length > 0 &&
  request.customer.email.length > 0 &&
  request.gross.currency === 'COP' &&
  Number.isSafeInteger(request.gross.minorUnits) &&
  request.gross.minorUnits > 0

const normalizeProviderStatus = (value: string): PaymentStatus => {
  switch (value.trim().toLocaleLowerCase('es')) {
    case 'aceptada':
      return 'approved'
    case 'pendiente':
    case 'iniciada':
      return 'pending'
    case 'rechazada':
      return 'declined'
    case 'fallida':
      return 'failed'
    case 'reversada':
      return 'reversed'
    case 'expirada':
      return 'expired'
    case 'abandonada':
      return 'abandoned'
    case 'cancelada':
      return 'cancelled'
    default:
      return 'unknown'
  }
}

const environmentFromProvider = (value: string): GatewayEnvironment | undefined => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return 'test'
  if (normalized === 'false') return 'live'
  return undefined
}

const responseStatus = (
  data: UnknownRecord
): { providerStatus: string; status: PaymentStatus } | undefined => {
  const response = data.x_response
  const transactionState = data.x_transaction_state
  const responseString = typeof response === 'string' && response.length > 0 ? response : undefined
  const stateString =
    typeof transactionState === 'string' && transactionState.length > 0
      ? transactionState
      : undefined

  if (!responseString && !stateString) return undefined

  if (
    responseString &&
    stateString &&
    normalizeProviderStatus(responseString) !== normalizeProviderStatus(stateString)
  ) {
    return undefined
  }

  const providerStatus = responseString ?? stateString!
  return { providerStatus, status: normalizeProviderStatus(providerStatus) }
}

const parseJson = async (response: Response): Promise<unknown | undefined> => {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

const logUnexpectedCheckoutResponse = (
  stage: 'login' | 'session',
  response: Response,
  payload: unknown
): void => {
  const record = isRecord(payload) ? payload : undefined
  const data = record && isRecord(record.data) ? record.data : undefined
  console.warn('[commerce.epayco.checkout] Unexpected provider response', {
    stage,
    status: response.status,
    contentType: response.headers.get('content-type'),
    payloadType: Array.isArray(payload) ? 'array' : typeof payload,
    success: typeof record?.success === 'boolean' ? record.success : undefined,
    hasData: data !== undefined,
    dataKeys: data ? Object.keys(data).sort() : [],
    hasSessionId: data ? typeof data.sessionId === 'string' && data.sessionId.length > 0 : false,
  })
}

export class EpaycoCollectionGateway implements CollectionGateway {
  readonly binding: GatewayBinding
  readonly capabilities = EPAYCO_CAPABILITIES
  readonly #publicKey: string
  readonly #privateKey: string
  readonly #pKey: string
  readonly #merchantName: string
  readonly #responseUrl: string
  readonly #confirmationUrl: string
  readonly #requestTimeoutMs: number
  readonly #fetch: FetchImplementation

  constructor(config: EpaycoGatewayConfig) {
    if (config.binding.provider !== 'epayco') {
      throw new Error('An ePayco gateway requires an epayco binding')
    }
    for (const value of [
      config.binding.configVersion,
      config.binding.accountId,
      config.publicKey,
      config.privateKey,
      config.pKey,
      config.merchantName,
    ]) {
      if (value.length === 0) throw new Error('ePayco configuration values must not be empty')
    }

    const applicationOrigin = new URL(config.applicationOrigin)
    if (applicationOrigin.pathname !== '/' || applicationOrigin.search || applicationOrigin.hash) {
      throw new Error('applicationOrigin must contain only an origin')
    }
    if (config.binding.environment === 'live' && applicationOrigin.protocol !== 'https:') {
      throw new Error('Live ePayco callbacks require an HTTPS application origin')
    }
    if (!['http:', 'https:'].includes(applicationOrigin.protocol)) {
      throw new Error('The ePayco application origin must use HTTP or HTTPS')
    }

    this.binding = Object.freeze({ ...config.binding })
    this.#publicKey = config.publicKey
    this.#privateKey = config.privateKey
    this.#pKey = config.pKey
    this.#merchantName = config.merchantName
    this.#responseUrl = new URL(RESPONSE_PATH, applicationOrigin).toString()
    this.#confirmationUrl = new URL(CONFIRMATION_PATH, applicationOrigin).toString()
    this.#requestTimeoutMs = config.requestTimeoutMs ?? 8_000
    this.#fetch = config.fetch ?? fetch
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutCreationResult> {
    if (!isValidCheckoutRequest(request)) {
      return { kind: 'rejected', reason: 'invalid-request' }
    }

    let loginResponse: Response
    try {
      loginResponse = await this.#fetch(EPAYCO_LOGIN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.#publicKey}:${this.#privateKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(this.#requestTimeoutMs),
      })
    } catch {
      return { kind: 'uncertain', reason: 'network' }
    }

    if (!loginResponse.ok) {
      return loginResponse.status >= 400 && loginResponse.status < 500
        ? { kind: 'rejected', reason: 'authentication-rejected' }
        : { kind: 'uncertain', reason: 'provider-unavailable' }
    }

    const loginPayload = await parseJson(loginResponse)
    const token = isRecord(loginPayload) ? readNonEmptyString(loginPayload, 'token') : undefined
    if (!token) {
      logUnexpectedCheckoutResponse('login', loginResponse, loginPayload)
      return { kind: 'uncertain', reason: 'malformed-response' }
    }

    let sessionResponse: Response
    try {
      sessionResponse = await this.#fetch(EPAYCO_SESSION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkout_version: '2',
          name: this.#merchantName,
          description: request.description,
          currency: request.gross.currency,
          amount: minorUnitsToProviderAmount(request.gross.minorUnits),
          invoice: request.invoice,
          lang: 'ES',
          country: 'CO',
          response: this.#responseUrl,
          confirmation: this.#confirmationUrl,
          method: 'POST',
          uniqueTransactionPerBill: true,
          billing: {
            email: request.customer.email,
            name: request.customer.name,
          },
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(this.#requestTimeoutMs),
      })
    } catch {
      return { kind: 'uncertain', reason: 'network' }
    }

    if (!sessionResponse.ok) {
      return sessionResponse.status >= 400 && sessionResponse.status < 500
        ? { kind: 'rejected', reason: 'provider-rejected' }
        : { kind: 'uncertain', reason: 'provider-unavailable' }
    }

    const sessionPayload = await parseJson(sessionResponse)
    if (isRecord(sessionPayload) && sessionPayload.success === false) {
      logUnexpectedCheckoutResponse('session', sessionResponse, sessionPayload)
      return { kind: 'rejected', reason: 'provider-rejected' }
    }
    if (
      !isRecord(sessionPayload) ||
      sessionPayload.success !== true ||
      !isRecord(sessionPayload.data)
    ) {
      logUnexpectedCheckoutResponse('session', sessionResponse, sessionPayload)
      return { kind: 'uncertain', reason: 'malformed-response' }
    }
    const sessionId = readNonEmptyString(sessionPayload.data, 'sessionId')
    if (!sessionId) {
      logUnexpectedCheckoutResponse('session', sessionResponse, sessionPayload)
      return { kind: 'uncertain', reason: 'malformed-response' }
    }

    return {
      kind: 'created',
      launch: {
        type: 'hosted-session',
        sessionId,
        scriptUrl: EPAYCO_CHECKOUT_SCRIPT_URL,
        testMode: this.binding.environment === 'test',
      },
    }
  }

  resumeHostedCheckout(sessionId: string): HostedCheckoutLaunch | undefined {
    if (sessionId.length === 0) return undefined
    return {
      type: 'hosted-session',
      sessionId,
      scriptUrl: EPAYCO_CHECKOUT_SCRIPT_URL,
      testMode: this.binding.environment === 'test',
    }
  }

  authenticateNotification(fields: RawNotificationFields): NotificationAuthenticationResult {
    const requiredKeys = [
      'x_ref_payco',
      'x_transaction_id',
      'x_amount',
      'x_currency_code',
      'x_signature',
    ] as const
    const values = new Map<(typeof requiredKeys)[number], string>()
    let invalidReason: 'missing-field' | 'duplicate-field' | undefined

    for (const key of requiredKeys) {
      const field = readRawField(fields, key)
      if (field.kind === 'duplicate') invalidReason = 'duplicate-field'
      else if (field.kind === 'missing' && invalidReason !== 'duplicate-field') {
        invalidReason = 'missing-field'
      } else if (field.kind === 'value') values.set(key, field.value)
    }

    const lookupField = readRawField(fields, 'ref_payco')
    if (lookupField.kind === 'duplicate') invalidReason = 'duplicate-field'
    const lookupReference = lookupField.kind === 'value' ? lookupField.value : undefined
    const reference = values.get('x_ref_payco') ?? ''
    const transactionId = values.get('x_transaction_id') ?? ''
    const gross = values.get('x_amount') ?? ''
    const currency = values.get('x_currency_code') ?? ''
    const signature = values.get('x_signature') ?? ''
    const signatureInput = [
      this.binding.accountId,
      this.#pKey,
      reference,
      transactionId,
      gross,
      currency,
    ].join('^')
    const expectedSignature = createHash('sha256').update(signatureInput, 'utf8').digest('hex')
    const signatureMatches = safeSignatureEqual(expectedSignature, signature)

    if (invalidReason) return { authenticated: false, reason: invalidReason }
    if (!signatureMatches) return { authenticated: false, reason: 'invalid-signature' }

    return {
      authenticated: true,
      notification: { reference, lookupReference, transactionId, gross, currency },
    }
  }

  async retrievePayment(query: AuthoritativePaymentQuery): Promise<AuthoritativePaymentResult> {
    const expectedGross = query.expected?.gross
    if (query.reference.length === 0) {
      return { kind: 'uncertain', reason: 'malformed-response' }
    }
    if (
      expectedGross &&
      (expectedGross.currency !== 'COP' ||
        !Number.isSafeInteger(expectedGross.minorUnits) ||
        expectedGross.minorUnits <= 0)
    ) {
      return { kind: 'uncertain', reason: 'malformed-response' }
    }

    const useAuthenticatedTransactionLookup = query.reference === query.expected?.providerReference
    let response: Response
    if (useAuthenticatedTransactionLookup) {
      let loginResponse: Response
      try {
        loginResponse = await this.#fetch(EPAYCO_LOGIN_URL, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.#publicKey}:${this.#privateKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(this.#requestTimeoutMs),
        })
      } catch {
        return { kind: 'uncertain', reason: 'network' }
      }
      if (!loginResponse.ok) return { kind: 'uncertain', reason: 'provider-unavailable' }
      const loginPayload = await parseJson(loginResponse)
      const token = isRecord(loginPayload) ? readNonEmptyString(loginPayload, 'token') : undefined
      if (!token) return { kind: 'uncertain', reason: 'malformed-response' }

      try {
        response = await this.#fetch(EPAYCO_TRANSACTION_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ referencePayco: query.reference }),
          redirect: 'error',
          signal: AbortSignal.timeout(this.#requestTimeoutMs),
        })
      } catch {
        return { kind: 'uncertain', reason: 'network' }
      }
    } else {
      const lookupUrl = new URL(
        `/validation/v1/reference/${encodeURIComponent(query.reference)}`,
        EPAYCO_VALIDATION_ORIGIN
      )
      try {
        response = await this.#fetch(lookupUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(this.#requestTimeoutMs),
        })
      } catch {
        return { kind: 'uncertain', reason: 'network' }
      }
    }

    if (!response.ok) {
      return {
        kind: 'uncertain',
        reason: response.status === 404 ? 'not-found' : 'provider-unavailable',
      }
    }

    const payload = await parseJson(response)
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
      return { kind: 'uncertain', reason: 'malformed-response' }
    }

    let data = payload.data
    if (useAuthenticatedTransactionLookup) {
      const transaction = data.transaction
      if (!isRecord(transaction)) return { kind: 'uncertain', reason: 'malformed-response' }
      data = {
        x_cust_id_cliente: transaction.clientId,
        x_id_invoice: transaction.invoice,
        x_ref_payco: transaction.refPayco,
        x_transaction_id: transaction.transactionId,
        x_amount: transaction.amount,
        x_currency_code: transaction.currency,
        x_test_request: transaction.testMode,
        x_response: transaction.response,
        x_transaction_state: transaction.status,
      }
    }
    const merchantId = readProviderScalar(data, 'x_cust_id_cliente')
    const invoice = readProviderScalar(data, 'x_id_invoice')
    const reference = readProviderScalar(data, 'x_ref_payco')
    const transactionId = readProviderScalar(data, 'x_transaction_id')
    const grossString = readProviderScalar(data, 'x_amount')
    const currency = readProviderScalar(data, 'x_currency_code')
    const testRequest = readProviderScalar(data, 'x_test_request')
    const status = responseStatus(data)
    const grossMinorUnits = grossString ? parseProviderAmount(grossString) : undefined
    const environment = testRequest ? environmentFromProvider(testRequest) : undefined

    if (
      !merchantId ||
      !invoice ||
      !reference ||
      !transactionId ||
      grossMinorUnits === undefined ||
      !currency ||
      !environment ||
      !status
    ) {
      return { kind: 'uncertain', reason: 'malformed-response' }
    }

    const mismatchFields: VerificationMismatchField[] = []
    if (merchantId !== this.binding.accountId) mismatchFields.push('merchant')
    if (query.expected?.invoice && invoice !== query.expected.invoice)
      mismatchFields.push('invoice')
    if (query.expected?.providerReference && reference !== query.expected.providerReference) {
      mismatchFields.push('reference')
    }
    if (query.expected?.transactionId && transactionId !== query.expected.transactionId) {
      mismatchFields.push('transaction')
    }
    if (expectedGross && grossMinorUnits !== expectedGross.minorUnits) mismatchFields.push('gross')
    if (currency !== (expectedGross?.currency ?? 'COP')) mismatchFields.push('currency')
    if (environment !== this.binding.environment) mismatchFields.push('environment')

    if (mismatchFields.length > 0) return { kind: 'mismatch', fields: mismatchFields }

    return {
      kind: 'verified',
      payment: {
        merchantId,
        invoice,
        reference,
        transactionId,
        gross: { minorUnits: grossMinorUnits, currency: 'COP' },
        environment,
        status: status.status,
        providerStatus: status.providerStatus,
      },
    }
  }
}
