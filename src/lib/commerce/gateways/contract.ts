export type CollectionProvider = 'epayco' | 'fake'

export type GatewayEnvironment = 'test' | 'live'

/**
 * Persist this value on every payment attempt before contacting a provider.
 * Reconciliation must resolve this exact binding instead of selecting the current provider.
 */
export type GatewayBinding = Readonly<{
  provider: CollectionProvider
  configVersion: string
  accountId: string
  environment: GatewayEnvironment
}>

export type PaymentMethod = 'credit-card' | 'debit-card' | 'pse'

export type CollectionGatewayCapabilities = Readonly<{
  hostedCheckout: boolean
  paymentMethods: readonly PaymentMethod[]
  signedNotifications: boolean
  authoritativeLookup: boolean
  automaticRefunds: boolean
  finalDeductionBreakdown: boolean
  checkoutSplitting: boolean
}>

export type Money = Readonly<{
  /** Integer units of 1/100 of the currency unit. */
  minorUnits: number
  currency: 'COP'
}>

export type CheckoutRequest = Readonly<{
  attemptId: string
  invoice: string
  productName: string
  description: string
  gross: Money
  customer: Readonly<{
    name: string
    email: string
  }>
}>

export type HostedCheckoutLaunch = Readonly<{
  type: 'hosted-session'
  sessionId: string
  scriptUrl: string
  testMode: boolean
}>

export type TestCheckoutLaunch = Readonly<{
  type: 'test-redirect'
  url: string
  reference: string
  transactionId: string
}>

export type CheckoutLaunch = HostedCheckoutLaunch | TestCheckoutLaunch

export type CheckoutCreationResult =
  | Readonly<{
      kind: 'created'
      launch: CheckoutLaunch
    }>
  | Readonly<{
      kind: 'rejected'
      reason:
        | 'invalid-request'
        | 'authentication-rejected'
        | 'provider-rejected'
        | 'provider-amount-limit'
    }>
  | Readonly<{
      kind: 'uncertain'
      reason: 'network' | 'provider-unavailable' | 'malformed-response'
    }>

export type RawNotificationFields = Readonly<Record<string, string | readonly string[] | undefined>>

export type AuthenticatedNotification = Readonly<{
  /** Signed `x_ref_payco`, used as the canonical provider charge reference. */
  reference: string
  /** Opaque `ref_payco` accepted only as the locator for authoritative lookup. */
  lookupReference?: string
  transactionId: string
  /** Original string used in the provider signature. Do not parse before verification. */
  gross: string
  /** Original string used in the provider signature. */
  currency: string
}>

export type NotificationAuthenticationResult =
  | Readonly<{
      authenticated: true
      notification: AuthenticatedNotification
    }>
  | Readonly<{
      authenticated: false
      reason: 'missing-field' | 'duplicate-field' | 'invalid-signature'
    }>

export type AuthoritativePaymentQuery = Readonly<{
  reference: string
  /**
   * A callback supplies all three values. A browser return may supply only a
   * reference; in that case the facade binds the authoritative invoice back to
   * a persisted attempt before applying any state.
   */
  expected?: Readonly<{
    invoice?: string
    /** Signed provider reference to compare with the authoritative record. */
    providerReference?: string
    transactionId?: string
    gross?: Money
  }>
}>

export type PaymentStatus =
  | 'approved'
  | 'pending'
  | 'declined'
  | 'failed'
  | 'reversed'
  | 'expired'
  | 'abandoned'
  | 'cancelled'
  | 'unknown'

export type VerifiedPayment = Readonly<{
  merchantId: string
  invoice: string
  reference: string
  transactionId: string
  gross: Money
  environment: GatewayEnvironment
  status: PaymentStatus
  providerStatus: string
}>

export type VerificationMismatchField =
  | 'merchant'
  | 'invoice'
  | 'reference'
  | 'transaction'
  | 'gross'
  | 'currency'
  | 'environment'

export type AuthoritativePaymentResult =
  | Readonly<{
      kind: 'verified'
      payment: VerifiedPayment
    }>
  | Readonly<{
      kind: 'mismatch'
      fields: readonly VerificationMismatchField[]
    }>
  | Readonly<{
      kind: 'uncertain'
      reason: 'network' | 'provider-unavailable' | 'not-found' | 'malformed-response'
    }>

export interface CollectionGateway {
  readonly binding: GatewayBinding
  readonly capabilities: CollectionGatewayCapabilities
  createCheckout(request: CheckoutRequest): Promise<CheckoutCreationResult>
  resumeHostedCheckout(sessionId: string): HostedCheckoutLaunch | undefined
  authenticateNotification(fields: RawNotificationFields): NotificationAuthenticationResult
  retrievePayment(query: AuthoritativePaymentQuery): Promise<AuthoritativePaymentResult>
}

export type GatewaySelectionContext = Readonly<{
  currency: 'COP'
}>

export type GatewaySelection = Readonly<{
  /** Store this binding before createCheckout performs any network request. */
  binding: GatewayBinding
  gateway: CollectionGateway
}>

export interface GatewaySelectionStrategy {
  selectForNewAttempt(context: GatewaySelectionContext): GatewaySelection
  resolvePersisted(binding: GatewayBinding): CollectionGateway
  resolveCandidates(provider: CollectionProvider): readonly CollectionGateway[]
}

export const gatewayBindingKey = (binding: GatewayBinding): string =>
  [binding.provider, binding.configVersion, binding.accountId, binding.environment].join('\u0000')
