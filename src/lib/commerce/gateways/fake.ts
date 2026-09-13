import 'server-only'

import { isIsolatedBrowserTest } from '@/lib/isolated-browser-test'

import type {
  AuthoritativePaymentQuery,
  AuthoritativePaymentResult,
  CheckoutCreationResult,
  CheckoutRequest,
  CollectionGateway,
  CollectionGatewayCapabilities,
  GatewayBinding,
  HostedCheckoutLaunch,
  NotificationAuthenticationResult,
  RawNotificationFields,
} from './contract'

const FAKE_CAPABILITIES: CollectionGatewayCapabilities = Object.freeze({
  hostedCheckout: false,
  paymentMethods: Object.freeze(['credit-card', 'debit-card', 'pse'] as const),
  signedNotifications: false,
  authoritativeLookup: true,
  automaticRefunds: false,
  finalDeductionBreakdown: false,
  checkoutSplitting: false,
})

export type FakeGatewayBehavior = Readonly<{
  createCheckout?: (request: CheckoutRequest) => Promise<CheckoutCreationResult>
  authenticateNotification?: (fields: RawNotificationFields) => NotificationAuthenticationResult
  retrievePayment?: (query: AuthoritativePaymentQuery) => Promise<AuthoritativePaymentResult>
}>

export type FakeGatewayConfig = Readonly<{
  binding: GatewayBinding
  behavior?: FakeGatewayBehavior
}>

const assertFakeGatewayAllowed = (binding: GatewayBinding): void => {
  if (binding.provider !== 'fake' || binding.environment !== 'test') {
    throw new Error('The fake collection gateway only supports a fake test binding')
  }
  if (
    process.env.VERCEL_ENV !== undefined ||
    (process.env.NODE_ENV === 'production' && !isIsolatedBrowserTest())
  ) {
    throw new Error('The fake collection gateway is unavailable in deployed or live operation')
  }
}

export class FakeCollectionGateway implements CollectionGateway {
  readonly binding: GatewayBinding
  readonly capabilities = FAKE_CAPABILITIES
  readonly #behavior: FakeGatewayBehavior

  constructor(config: FakeGatewayConfig) {
    assertFakeGatewayAllowed(config.binding)
    this.binding = Object.freeze({ ...config.binding })
    this.#behavior = config.behavior ?? {}
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutCreationResult> {
    if (this.#behavior.createCheckout) return this.#behavior.createCheckout(request)
    return {
      kind: 'created',
      launch: {
        type: 'test-redirect',
        url: '/pago/respuesta',
        reference: `fake-${request.attemptId}`,
        transactionId: `fake-${request.attemptId}`,
      },
    }
  }

  resumeHostedCheckout(_sessionId: string): HostedCheckoutLaunch | undefined {
    return undefined
  }

  authenticateNotification(fields: RawNotificationFields): NotificationAuthenticationResult {
    if (this.#behavior.authenticateNotification) {
      return this.#behavior.authenticateNotification(fields)
    }
    return { authenticated: false, reason: 'invalid-signature' }
  }

  async retrievePayment(query: AuthoritativePaymentQuery): Promise<AuthoritativePaymentResult> {
    if (this.#behavior.retrievePayment) return this.#behavior.retrievePayment(query)
    return {
      kind: 'verified',
      payment: {
        merchantId: this.binding.accountId,
        invoice: query.expected?.invoice ?? '',
        reference: query.reference,
        transactionId: query.expected?.transactionId ?? query.reference,
        gross: query.expected?.gross ?? { minorUnits: 1, currency: 'COP' },
        environment: 'test',
        status: 'approved',
        providerStatus: 'fake-approved',
      },
    }
  }
}
