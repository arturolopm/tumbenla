import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, isNull, lte, ne, or, sql } from 'drizzle-orm'

import type { db } from '@/database'
import {
  allocationPolicy,
  commerceBeneficiary,
  commerceOrderSnapshot,
  commerceOrderUnit,
  financeTransaction,
  paymentAttempt,
  paymentCharge,
  paymentEvent,
} from '@/database/commerce-schema'
import { orderRedemption, productOrder, venue, venueProduct } from '@/database/schema'
import { generarCodigo } from '@/lib/comercio/codigos'
import { fechaDeCaducidad } from '@/lib/comercio/types'
import { createId } from '@/lib/utils/id'
import { ensureFinanceAccount, postFinanceTransaction } from './finance-ledger'
import { divideHalfUp, formatMinorUnits, parseMinorUnits, parseScaledDecimal } from './money'
import type {
  AuthoritativePaymentResult,
  CheckoutLaunch,
  CheckoutRequest,
  CollectionGateway,
  CollectionProvider,
  GatewayBinding,
  GatewaySelectionStrategy,
  HostedCheckoutLaunch,
  PaymentStatus,
  RawNotificationFields,
  VerifiedPayment,
} from './gateways'

type CommerceDatabase = typeof db
type CommerceTransaction = Parameters<Parameters<CommerceDatabase['transaction']>[0]>[0]

const MAX_CHECKOUT_UNITS = 20
const MIN_DONATION_BASIS_POINTS = 4_000
const MAX_PROVIDER_CANDIDATES = 8

type FundingClassification = 'real' | 'sandbox'

export type StartPaymentInput = Readonly<{
  submissionKey: string
  productId: string
  buyerName: string
  buyerEmail: string
  quantity: number
  userId: string | null
}>

export type StartPaymentResult =
  | Readonly<{
      kind: 'checkout'
      attemptId: string
      orderToken: string
      launch: HostedCheckoutLaunch
    }>
  | Readonly<{
      kind: 'approved'
      attemptId: string
      orderToken: string
    }>
  | Readonly<{
      kind: 'pending'
      attemptId: string
      orderToken: string
      status: 'submitted' | 'pending' | 'uncertain' | 'operator_review'
    }>
  | Readonly<{
      kind: 'rejected'
      attemptId: string
      orderToken: string
      reason: string
    }>
  | Readonly<{
      kind: 'conflict'
      reason: 'submission-key-reused'
    }>
  | Readonly<{
      kind: 'unavailable'
      reason: 'invalid-request' | 'product-unavailable' | 'commerce-not-configured'
    }>

export type PaymentReconciliationResult = Readonly<{
  kind: 'applied' | 'pending' | 'rejected' | 'retryable' | 'not-found'
  attemptId?: string
  orderToken?: string
  status?: PaymentStatus | 'operator_review'
  issuedUnitCount?: number
  duplicate?: boolean
  reason?: string
}>

export type PaymentNotificationResult = Readonly<{
  accepted: boolean
  duplicate: boolean
  retryable: boolean
  result: PaymentReconciliationResult
}>

type ApprovalNotifier = (input: { orderId: string; codes: readonly string[] }) => Promise<void>

export type CommercePaymentServiceDependencies = Readonly<{
  database: CommerceDatabase
  gateways: GatewaySelectionStrategy
  now?: () => Date
  generateCode?: () => string
  generateToken?: () => string
  notifyApproval?: ApprovalNotifier
}>

type AttemptContext = Readonly<{
  attemptId: string
  orderSnapshotId: string
  orderId: string
  orderToken: string
  buyerName: string
  buyerEmail: string
  productName: string
  venueName: string
  quantity: number
  grossMinor: bigint
  status: string
  checkoutSessionId: string | null
  provider: string
  providerConfigVersion: string
  merchantAccountKey: string
  environment: string
  fundingClassification: string
}>

type PreparedAttempt =
  | Readonly<{ kind: 'attempt'; attemptId: string }>
  | Readonly<{
      kind: 'unavailable'
      reason: 'product-unavailable' | 'commerce-not-configured'
    }>

type AppliedPayment = PaymentReconciliationResult & Readonly<{ issuedCodes: readonly string[] }>

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex')

const hashJson = (value: unknown): string => sha256(JSON.stringify(value))

const generateBearerToken = (): string => randomBytes(32).toString('base64url')

const isCollectionProvider = (value: string): value is CollectionProvider =>
  value === 'epayco' || value === 'fake'

const isGatewayEnvironment = (value: string): value is GatewayBinding['environment'] =>
  value === 'test' || value === 'live'

const persistedBinding = (context: AttemptContext): GatewayBinding => {
  if (!isCollectionProvider(context.provider) || !isGatewayEnvironment(context.environment)) {
    throw new Error('The persisted payment attempt has an invalid gateway binding')
  }
  return {
    provider: context.provider,
    configVersion: context.providerConfigVersion,
    accountId: context.merchantAccountKey,
    environment: context.environment,
  }
}

const requestHashFor = (input: StartPaymentInput): string =>
  hashJson({
    buyerEmail: input.buyerEmail.trim().toLowerCase(),
    buyerName: input.buyerName.trim(),
    productId: input.productId,
    quantity: input.quantity,
    userId: input.userId,
  })

const validStartInput = (input: StartPaymentInput): boolean =>
  /^[A-Za-z0-9_-]{16,128}$/.test(input.submissionKey) &&
  input.productId.length > 0 &&
  input.buyerName.trim().length >= 2 &&
  input.buyerName.trim().length <= 80 &&
  input.buyerEmail.trim().length > 3 &&
  input.buyerEmail.includes('@') &&
  Number.isInteger(input.quantity) &&
  input.quantity >= 1 &&
  input.quantity <= MAX_CHECKOUT_UNITS

const uniqueConstraint = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined
  const record = error as Record<string, unknown>
  return record.code === '23505' && typeof record.constraint_name === 'string'
    ? record.constraint_name
    : record.code === '23505' && typeof record.constraint === 'string'
      ? record.constraint
      : undefined
}

const amountAsSafeNumber = (amount: bigint): number => {
  const value = Number(amount)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Payment amount cannot be represented safely for the collection gateway')
  }
  return value
}

const fundingFor = (binding: GatewayBinding): FundingClassification =>
  binding.environment === 'live' ? 'real' : 'sandbox'

const persistedFunding = (value: string): FundingClassification => {
  if (value !== 'real' && value !== 'sandbox') {
    throw new Error('A new payment cannot use legacy or unknown funding')
  }
  return value
}

const chargeStatusFor = (
  status: PaymentStatus
): 'pending' | 'approved' | 'declined' | 'reversed' | 'unknown' => {
  if (status === 'approved') return 'approved'
  if (status === 'pending') return 'pending'
  if (status === 'reversed') return 'reversed'
  if (status === 'unknown') return 'unknown'
  return 'declined'
}

const attemptStatusFor = (
  status: PaymentStatus
): 'pending' | 'approved' | 'declined' | 'operator_review' => {
  if (status === 'approved') return 'approved'
  if (status === 'pending') return 'pending'
  if (status === 'unknown' || status === 'reversed') return 'operator_review'
  return 'declined'
}

const canonicalRawFields = (fields: RawNotificationFields): string =>
  JSON.stringify(
    Object.keys(fields)
      .sort()
      .map((key) => [key, fields[key]])
  )

const uniqueRawField = (fields: RawNotificationFields, key: string): string | undefined => {
  const value = fields[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const sameBinding = (left: GatewayBinding, right: GatewayBinding): boolean =>
  left.provider === right.provider &&
  left.configVersion === right.configVersion &&
  left.accountId === right.accountId &&
  left.environment === right.environment

const paymentMismatches = (
  payment: VerifiedPayment,
  context: AttemptContext,
  binding: GatewayBinding,
  reference: string,
  transactionId?: string
): readonly string[] => {
  const mismatches: string[] = []
  if (payment.merchantId !== binding.accountId) mismatches.push('merchant')
  if (payment.invoice !== context.attemptId) mismatches.push('invoice')
  if (payment.reference !== reference) mismatches.push('reference')
  if (transactionId && payment.transactionId !== transactionId) mismatches.push('transaction')
  if (BigInt(payment.gross.minorUnits) !== context.grossMinor) mismatches.push('gross')
  if (payment.gross.currency !== 'COP') mismatches.push('currency')
  if (payment.environment !== binding.environment) mismatches.push('environment')
  return mismatches
}

export class CommercePaymentService {
  readonly #database: CommerceDatabase
  readonly #gateways: GatewaySelectionStrategy
  readonly #now: () => Date
  readonly #generateCode: () => string
  readonly #generateToken: () => string
  readonly #notifyApproval?: ApprovalNotifier

  constructor(dependencies: CommercePaymentServiceDependencies) {
    this.#database = dependencies.database
    this.#gateways = dependencies.gateways
    this.#now = dependencies.now ?? (() => new Date())
    this.#generateCode = dependencies.generateCode ?? generarCodigo
    this.#generateToken = dependencies.generateToken ?? generateBearerToken
    this.#notifyApproval = dependencies.notifyApproval
  }

  async startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
    if (!validStartInput(input)) return { kind: 'unavailable', reason: 'invalid-request' }

    const requestHash = requestHashFor(input)
    const existing = await this.#findAttemptBySubmissionKey(input.submissionKey)
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return { kind: 'conflict', reason: 'submission-key-reused' }
      }
      return this.#continueAttempt(existing.id)
    }

    let selection: ReturnType<GatewaySelectionStrategy['selectForNewAttempt']>
    try {
      selection = this.#gateways.selectForNewAttempt({ currency: 'COP' })
    } catch {
      return { kind: 'unavailable', reason: 'commerce-not-configured' }
    }

    let prepared: PreparedAttempt
    try {
      prepared = await this.#prepareAttempt(input, requestHash, selection.binding)
    } catch (error) {
      if (uniqueConstraint(error) !== 'payment_attempt_submission_key') throw error
      const raced = await this.#findAttemptBySubmissionKey(input.submissionKey)
      if (!raced) throw error
      if (raced.requestHash !== requestHash) {
        return { kind: 'conflict', reason: 'submission-key-reused' }
      }
      return this.#continueAttempt(raced.id)
    }

    if (prepared.kind === 'unavailable') return prepared
    return this.#continueAttempt(prepared.attemptId)
  }

  async reconcileAttempt(input: {
    attemptId: string
    reference: string
    transactionId?: string
    eventId?: string
  }): Promise<PaymentReconciliationResult> {
    const context = await this.#loadAttemptContext(input.attemptId)
    if (!context) return { kind: 'not-found' }

    let gateway: CollectionGateway
    try {
      gateway = this.#gateways.resolvePersisted(persistedBinding(context))
    } catch {
      await this.#markAttemptForReview(
        context.attemptId,
        'missing-persisted-gateway',
        input.eventId
      )
      return {
        kind: 'retryable',
        attemptId: context.attemptId,
        orderToken: context.orderToken,
        status: 'operator_review',
        reason: 'missing-persisted-gateway',
      }
    }

    const lookup = await gateway.retrievePayment({
      reference: input.reference,
      expected: {
        invoice: context.attemptId,
        transactionId: input.transactionId,
        gross: { minorUnits: amountAsSafeNumber(context.grossMinor), currency: 'COP' },
      },
    })

    return this.#handleLookupResult({
      context,
      gateway,
      reference: input.reference,
      transactionId: input.transactionId,
      eventId: input.eventId,
      lookup,
    })
  }

  async reconcileReference(input: {
    provider: CollectionProvider
    reference: string
  }): Promise<PaymentReconciliationResult> {
    if (input.reference.length === 0) return { kind: 'not-found' }
    const candidates = this.#gateways.resolveCandidates(input.provider)
    if (candidates.length === 0 || candidates.length > MAX_PROVIDER_CANDIDATES) {
      return { kind: 'retryable', reason: 'gateway-candidates-unavailable' }
    }

    let uncertain = false
    for (const gateway of candidates) {
      const lookup = await gateway.retrievePayment({ reference: input.reference })
      if (lookup.kind === 'uncertain') {
        uncertain = true
        continue
      }
      if (lookup.kind === 'mismatch') continue

      const context = await this.#loadAttemptContext(lookup.payment.invoice)
      if (!context) continue
      const binding = persistedBinding(context)
      if (!sameBinding(binding, gateway.binding)) continue

      return this.#handleLookupResult({
        context,
        gateway,
        reference: input.reference,
        lookup,
      })
    }

    return uncertain
      ? { kind: 'retryable', reason: 'provider-lookup-uncertain' }
      : { kind: 'not-found' }
  }

  async processNotification(
    provider: CollectionProvider,
    fields: RawNotificationFields
  ): Promise<PaymentNotificationResult> {
    const payloadDigest = sha256(canonicalRawFields(fields))
    const invoiceHint = uniqueRawField(fields, 'x_id_invoice')
    const context = invoiceHint ? await this.#loadAttemptContext(invoiceHint) : undefined

    if (!context || context.provider !== provider) {
      await this.#recordUnboundEvent(provider, payloadDigest, 'unknown-attempt')
      return {
        accepted: false,
        duplicate: false,
        retryable: false,
        result: { kind: 'rejected', reason: 'unknown-attempt' },
      }
    }

    let gateway: CollectionGateway
    try {
      gateway = this.#gateways.resolvePersisted(persistedBinding(context))
    } catch {
      const event = await this.#upsertEvent({
        context,
        payloadDigest,
        signatureVerified: false,
        processingStatus: 'retryable_error',
        processingError: 'missing-persisted-gateway',
        verifiedFields: {},
      })
      return {
        accepted: false,
        duplicate: event.duplicate,
        retryable: true,
        result: { kind: 'retryable', reason: 'missing-persisted-gateway' },
      }
    }

    const authentication = gateway.authenticateNotification(fields)
    if (!authentication.authenticated) {
      const event = await this.#upsertEvent({
        context,
        payloadDigest,
        signatureVerified: false,
        processingStatus: 'rejected',
        processingError: authentication.reason,
        verifiedFields: {},
      })
      return {
        accepted: false,
        duplicate: event.duplicate,
        retryable: false,
        result: { kind: 'rejected', reason: authentication.reason },
      }
    }

    const event = await this.#upsertEvent({
      context,
      payloadDigest,
      signatureVerified: true,
      processingStatus: 'verified',
      processingError: null,
      verifiedFields: {
        reference: authentication.notification.reference,
        transactionId: authentication.notification.transactionId,
        gross: authentication.notification.gross,
        currency: authentication.notification.currency,
      },
    })

    if (event.terminal) {
      return {
        accepted: event.processingStatus === 'applied' || event.processingStatus === 'ignored',
        duplicate: true,
        retryable: false,
        result: {
          kind: event.processingStatus === 'rejected' ? 'rejected' : 'applied',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          duplicate: true,
        },
      }
    }

    const result = await this.reconcileAttempt({
      attemptId: context.attemptId,
      reference: authentication.notification.reference,
      transactionId: authentication.notification.transactionId,
      eventId: event.id,
    })

    return {
      accepted: result.kind === 'applied' || result.kind === 'pending',
      duplicate: event.duplicate || result.duplicate === true,
      retryable: result.kind === 'retryable',
      result,
    }
  }

  async checkoutLaunch(attemptId: string): Promise<StartPaymentResult> {
    return this.#continueAttempt(attemptId)
  }

  async #prepareAttempt(
    input: StartPaymentInput,
    requestHash: string,
    binding: GatewayBinding
  ): Promise<PreparedAttempt> {
    const now = this.#now()
    const fundingClassification = fundingFor(binding)

    return this.#database.transaction(async (transaction) => {
      const [product] = await transaction
        .select({
          id: venueProduct.id,
          venueId: venueProduct.venueId,
          name: venueProduct.name,
          kind: venueProduct.kind,
          description: venueProduct.description,
          price: venueProduct.price,
          currency: venueProduct.currency,
          donationPercentage: venueProduct.donationPercentage,
          productStatus: venueProduct.status,
          venueName: venue.name,
          venueStatus: venue.status,
        })
        .from(venueProduct)
        .innerJoin(venue, eq(venueProduct.venueId, venue.id))
        .where(eq(venueProduct.id, input.productId))
        .limit(1)
        .for('share')

      if (
        !product ||
        product.productStatus !== 'published' ||
        product.venueStatus !== 'published' ||
        product.currency !== 'COP'
      ) {
        return { kind: 'unavailable', reason: 'product-unavailable' }
      }

      const unitGrossMinor = parseMinorUnits(product.price)
      const donationBasisPoints = Number(parseScaledDecimal(product.donationPercentage, 2))
      if (
        !Number.isSafeInteger(donationBasisPoints) ||
        donationBasisPoints < MIN_DONATION_BASIS_POINTS ||
        donationBasisPoints > 10_000
      ) {
        return { kind: 'unavailable', reason: 'product-unavailable' }
      }

      const foundations = await transaction
        .select({ id: commerceBeneficiary.id, legalName: commerceBeneficiary.legalName })
        .from(commerceBeneficiary)
        .where(
          and(
            eq(commerceBeneficiary.kind, 'foundation'),
            eq(commerceBeneficiary.status, 'verified')
          )
        )
        .orderBy(commerceBeneficiary.createdAt)
        .limit(2)

      const [policy] = await transaction
        .select({ id: allocationPolicy.id })
        .from(allocationPolicy)
        .where(
          and(
            lte(allocationPolicy.effectiveAt, now),
            or(isNull(allocationPolicy.retiredAt), gt(allocationPolicy.retiredAt, now))
          )
        )
        .orderBy(desc(allocationPolicy.version))
        .limit(1)

      if (foundations.length !== 1 || !policy) {
        return { kind: 'unavailable', reason: 'commerce-not-configured' }
      }

      const orderId = createId('ord')
      const snapshotId = createId('cos')
      const attemptId = createId('pat')
      const orderToken = this.#generateToken()
      const quantity = input.quantity
      const totalGrossMinor = unitGrossMinor * BigInt(quantity)
      const grossDonationMinor = divideHalfUp(
        unitGrossMinor * BigInt(donationBasisPoints),
        BigInt(10_000)
      )
      const grossVenueMinor = unitGrossMinor - grossDonationMinor
      const percentage = formatMinorUnits(BigInt(donationBasisPoints), 2)

      await transaction.insert(productOrder).values({
        id: orderId,
        productId: product.id,
        venueId: product.venueId,
        userId: input.userId,
        buyerName: input.buyerName.trim(),
        buyerEmail: input.buyerEmail.trim().toLowerCase(),
        quantity: String(quantity),
        unitPrice: formatMinorUnits(unitGrossMinor),
        donationPercentage: percentage,
        unitDonationAmount: formatMinorUnits(grossDonationMinor),
        unitVenueAmount: formatMinorUnits(grossVenueMinor),
        totalAmount: formatMinorUnits(totalGrossMinor),
        currency: 'COP',
        publicToken: orderToken,
        payMethod: 'app',
        status: 'pending',
        expiresAt: fechaDeCaducidad(now),
        createdAt: now,
        updatedAt: now,
      })

      await transaction.insert(commerceOrderSnapshot).values({
        id: snapshotId,
        orderId,
        schemaVersion: 1,
        productName: product.name,
        productKind: product.kind,
        productDescription: product.description,
        venueName: product.venueName,
        currency: 'COP',
        quantity,
        unitGrossMinor,
        donationBasisPoints,
        allocationPolicyId: policy.id,
        foundationBeneficiaryId: foundations[0]!.id,
        foundationLegalName: foundations[0]!.legalName,
        policyDisclosure: `El ${percentage}% se distribuye después de las deducciones verificadas; el monto exacto queda pendiente hasta la reconciliación.`,
        fundingClassification,
        createdAt: now,
      })

      await transaction.insert(commerceOrderUnit).values(
        Array.from({ length: quantity }, (_, index) => ({
          id: createId('cou'),
          orderSnapshotId: snapshotId,
          ordinal: index + 1,
          grossMinor: unitGrossMinor,
          lifecycleStatus: 'pending_payment',
          expiresAt: fechaDeCaducidad(now),
          createdAt: now,
          updatedAt: now,
        }))
      )

      await transaction.insert(paymentAttempt).values({
        id: attemptId,
        orderSnapshotId: snapshotId,
        submissionKey: input.submissionKey,
        requestHash,
        provider: binding.provider,
        providerConfigVersion: binding.configVersion,
        merchantAccountKey: binding.accountId,
        environment: binding.environment,
        status: 'created',
        createdAt: now,
        updatedAt: now,
      })

      return { kind: 'attempt', attemptId }
    })
  }

  async #continueAttempt(attemptId: string): Promise<StartPaymentResult> {
    let context = await this.#loadAttemptContext(attemptId)
    if (!context) return { kind: 'unavailable', reason: 'invalid-request' }

    const terminal = this.#startResultFromContext(context)
    if (terminal) return terminal

    if (context.status !== 'created') {
      return {
        kind: 'pending',
        attemptId: context.attemptId,
        orderToken: context.orderToken,
        status: context.status as 'submitted' | 'pending' | 'uncertain' | 'operator_review',
      }
    }

    const now = this.#now()
    const [claimed] = await this.#database
      .update(paymentAttempt)
      .set({ status: 'submitted', lastCheckedAt: now, updatedAt: now })
      .where(and(eq(paymentAttempt.id, attemptId), eq(paymentAttempt.status, 'created')))
      .returning({ id: paymentAttempt.id })

    if (!claimed) {
      context = await this.#loadAttemptContext(attemptId)
      if (!context) return { kind: 'unavailable', reason: 'invalid-request' }
      return (
        this.#startResultFromContext(context) ?? {
          kind: 'pending',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: context.status as 'submitted' | 'pending' | 'uncertain' | 'operator_review',
        }
      )
    }

    let gateway: CollectionGateway
    try {
      gateway = this.#gateways.resolvePersisted(persistedBinding(context))
    } catch {
      await this.#markAttemptForReview(attemptId, 'missing-persisted-gateway')
      return {
        kind: 'pending',
        attemptId,
        orderToken: context.orderToken,
        status: 'operator_review',
      }
    }

    const checkoutRequest: CheckoutRequest = {
      attemptId,
      invoice: attemptId,
      productName: context.productName,
      description: `${context.productName} · ${context.venueName}`,
      gross: { minorUnits: amountAsSafeNumber(context.grossMinor), currency: 'COP' },
      customer: { name: context.buyerName, email: context.buyerEmail },
    }
    const creation = await gateway.createCheckout(checkoutRequest)

    if (creation.kind === 'rejected') {
      await this.#database
        .update(paymentAttempt)
        .set({
          status: 'declined',
          outcomeDetail: creation.reason,
          lastCheckedAt: this.#now(),
          updatedAt: this.#now(),
        })
        .where(and(eq(paymentAttempt.id, attemptId), eq(paymentAttempt.status, 'submitted')))
      return {
        kind: 'rejected',
        attemptId,
        orderToken: context.orderToken,
        reason: creation.reason,
      }
    }

    if (creation.kind === 'uncertain') {
      await this.#database
        .update(paymentAttempt)
        .set({
          status: 'uncertain',
          outcomeDetail: creation.reason,
          lastCheckedAt: this.#now(),
          updatedAt: this.#now(),
        })
        .where(and(eq(paymentAttempt.id, attemptId), eq(paymentAttempt.status, 'submitted')))
      return {
        kind: 'pending',
        attemptId,
        orderToken: context.orderToken,
        status: 'uncertain',
      }
    }

    await this.#persistCheckoutLaunch(attemptId, creation.launch)

    if (creation.launch.type === 'test-redirect') {
      const reconciled = await this.reconcileAttempt({
        attemptId,
        reference: creation.launch.reference,
        transactionId: creation.launch.transactionId,
      })
      if (reconciled.kind === 'applied' && reconciled.status === 'approved') {
        return { kind: 'approved', attemptId, orderToken: context.orderToken }
      }
      return {
        kind: 'pending',
        attemptId,
        orderToken: context.orderToken,
        status: reconciled.status === 'operator_review' ? 'operator_review' : 'pending',
      }
    }

    return {
      kind: 'checkout',
      attemptId,
      orderToken: context.orderToken,
      launch: creation.launch,
    }
  }

  #startResultFromContext(context: AttemptContext): StartPaymentResult | undefined {
    if (context.status === 'approved') {
      return { kind: 'approved', attemptId: context.attemptId, orderToken: context.orderToken }
    }
    if (context.status === 'declined' || context.status === 'cancelled') {
      return {
        kind: 'rejected',
        attemptId: context.attemptId,
        orderToken: context.orderToken,
        reason: context.status,
      }
    }
    if (context.status === 'pending' && context.checkoutSessionId) {
      try {
        const gateway = this.#gateways.resolvePersisted(persistedBinding(context))
        const launch = gateway.resumeHostedCheckout(context.checkoutSessionId)
        if (launch) {
          return {
            kind: 'checkout',
            attemptId: context.attemptId,
            orderToken: context.orderToken,
            launch,
          }
        }
      } catch {
        return {
          kind: 'pending',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: 'operator_review',
        }
      }
    }
    return undefined
  }

  async #persistCheckoutLaunch(attemptId: string, launch: CheckoutLaunch): Promise<void> {
    const now = this.#now()
    await this.#database
      .update(paymentAttempt)
      .set({
        status: 'pending',
        providerAttemptReference: launch.type === 'test-redirect' ? launch.reference : null,
        checkoutSessionId: launch.type === 'hosted-session' ? launch.sessionId : null,
        outcomeDetail: 'checkout-created',
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(and(eq(paymentAttempt.id, attemptId), eq(paymentAttempt.status, 'submitted')))
  }

  async #handleLookupResult(input: {
    context: AttemptContext
    gateway: CollectionGateway
    reference: string
    transactionId?: string
    eventId?: string
    lookup: AuthoritativePaymentResult
  }): Promise<PaymentReconciliationResult> {
    if (input.lookup.kind === 'uncertain') {
      const now = this.#now()
      await this.#database
        .update(paymentAttempt)
        .set({
          status: 'uncertain',
          outcomeDetail: input.lookup.reason,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(
          and(eq(paymentAttempt.id, input.context.attemptId), ne(paymentAttempt.status, 'approved'))
        )
      if (input.eventId) {
        await this.#updateEvent(
          input.eventId,
          'retryable_error',
          `authoritative-${input.lookup.reason}`
        )
      }
      return {
        kind: 'retryable',
        attemptId: input.context.attemptId,
        orderToken: input.context.orderToken,
        reason: input.lookup.reason,
      }
    }

    if (input.lookup.kind === 'mismatch') {
      const reason = `authoritative-mismatch:${input.lookup.fields.join(',')}`
      await this.#markAttemptForReview(input.context.attemptId, reason, input.eventId)
      return {
        kind: 'rejected',
        attemptId: input.context.attemptId,
        orderToken: input.context.orderToken,
        status: 'operator_review',
        reason,
      }
    }

    const mismatches = paymentMismatches(
      input.lookup.payment,
      input.context,
      input.gateway.binding,
      input.reference,
      input.transactionId
    )
    if (mismatches.length > 0) {
      const reason = `facade-mismatch:${mismatches.join(',')}`
      await this.#markAttemptForReview(input.context.attemptId, reason, input.eventId)
      return {
        kind: 'rejected',
        attemptId: input.context.attemptId,
        orderToken: input.context.orderToken,
        status: 'operator_review',
        reason,
      }
    }

    const applied = await this.#applyVerifiedPayment(
      input.context,
      input.lookup.payment,
      input.eventId
    )
    if (applied.issuedCodes.length > 0 && this.#notifyApproval) {
      try {
        await this.#notifyApproval({ orderId: input.context.orderId, codes: applied.issuedCodes })
      } catch {
        // Notification delivery is deliberately outside the payment transaction.
      }
    }
    const { issuedCodes: _issuedCodes, ...result } = applied
    return result
  }

  async #applyVerifiedPayment(
    context: AttemptContext,
    payment: VerifiedPayment,
    eventId?: string
  ): Promise<AppliedPayment> {
    const now = this.#now()
    const chargeStatus = chargeStatusFor(payment.status)
    const desiredAttemptStatus = attemptStatusFor(payment.status)

    return this.#database.transaction(async (transaction) => {
      const [locked] = await transaction
        .select({
          attemptId: paymentAttempt.id,
          attemptStatus: paymentAttempt.status,
          orderId: commerceOrderSnapshot.orderId,
          orderSnapshotId: paymentAttempt.orderSnapshotId,
          orderStatus: productOrder.status,
          quantity: commerceOrderSnapshot.quantity,
          grossMinor: sql<bigint>`${commerceOrderSnapshot.unitGrossMinor} * ${commerceOrderSnapshot.quantity}`,
          fundingClassification: commerceOrderSnapshot.fundingClassification,
        })
        .from(paymentAttempt)
        .innerJoin(
          commerceOrderSnapshot,
          eq(paymentAttempt.orderSnapshotId, commerceOrderSnapshot.id)
        )
        .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
        .where(eq(paymentAttempt.id, context.attemptId))
        .limit(1)
        .for('update')

      if (!locked) {
        return { kind: 'not-found', issuedCodes: [] } as AppliedPayment
      }

      const existingCharge = await this.#findCharge(transaction, context, payment)
      if (existingCharge?.attemptId && existingCharge.attemptId !== context.attemptId) {
        await transaction
          .update(paymentAttempt)
          .set({
            status: 'operator_review',
            outcomeDetail: 'provider-charge-bound-to-another-attempt',
            lastCheckedAt: now,
            updatedAt: now,
          })
          .where(eq(paymentAttempt.id, context.attemptId))
        if (eventId) {
          await transaction
            .update(paymentEvent)
            .set({
              processingStatus: 'rejected',
              processingError: 'provider-charge-bound-to-another-attempt',
              processedAt: now,
              attemptId: context.attemptId,
            })
            .where(eq(paymentEvent.id, eventId))
        }
        return {
          kind: 'rejected',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: 'operator_review',
          reason: 'provider-charge-bound-to-another-attempt',
          issuedCodes: [],
        }
      }

      if (existingCharge?.status === 'disputed') {
        if (eventId) {
          await this.#updateEventInTransaction(
            transaction,
            eventId,
            'ignored',
            'charge-under-dispute',
            existingCharge.id,
            now
          )
        }
        return {
          kind: 'applied',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: 'operator_review',
          issuedUnitCount: 0,
          duplicate: true,
          reason: 'charge-under-dispute',
          issuedCodes: [],
        }
      }

      if (existingCharge?.approvedAt && payment.status !== 'approved') {
        if (eventId) {
          await this.#updateEventInTransaction(
            transaction,
            eventId,
            'ignored',
            'stale-status-after-approval',
            existingCharge.id,
            now
          )
        }
        return {
          kind: 'applied',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: 'approved',
          issuedUnitCount: 0,
          duplicate: true,
          reason: 'stale-status-after-approval',
          issuedCodes: [],
        }
      }

      const chargeId = existingCharge?.id ?? createId('pch')
      if (!existingCharge) {
        try {
          await transaction.insert(paymentCharge).values({
            id: chargeId,
            attemptId: context.attemptId,
            provider: context.provider,
            merchantAccountKey: context.merchantAccountKey,
            environment: context.environment,
            providerReference: payment.reference,
            providerTransactionId: payment.transactionId,
            grossMinor: BigInt(payment.gross.minorUnits),
            currency: payment.gross.currency,
            status: chargeStatus,
            authoritativeLookupDigest: hashJson(payment),
            approvedAt: payment.status === 'approved' ? now : null,
            createdAt: now,
          })
        } catch (error) {
          if (!uniqueConstraint(error)) throw error
          const raced = await this.#findCharge(transaction, context, payment)
          if (!raced || raced.attemptId !== context.attemptId) throw error
        }
      } else {
        await transaction
          .update(paymentCharge)
          .set({
            status: chargeStatus,
            authoritativeLookupDigest: hashJson(payment),
            approvedAt: payment.status === 'approved' ? (existingCharge.approvedAt ?? now) : null,
          })
          .where(eq(paymentCharge.id, chargeId))
      }

      if (payment.status !== 'approved') {
        await transaction
          .update(paymentAttempt)
          .set({
            status: desiredAttemptStatus,
            providerAttemptReference: payment.reference,
            outcomeDetail: payment.providerStatus,
            lastCheckedAt: now,
            updatedAt: now,
          })
          .where(eq(paymentAttempt.id, context.attemptId))
        if (eventId) {
          await this.#updateEventInTransaction(transaction, eventId, 'applied', null, chargeId, now)
        }
        return {
          kind: payment.status === 'pending' ? 'pending' : 'applied',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: desiredAttemptStatus,
          issuedUnitCount: 0,
          issuedCodes: [],
        }
      }

      const paymentOperationKey = `payment-approved:${chargeId}`
      const [existingPosting] = await transaction
        .select({ id: financeTransaction.id })
        .from(financeTransaction)
        .where(eq(financeTransaction.operationKey, paymentOperationKey))
        .limit(1)

      if (locked.orderStatus !== 'pending' && !existingPosting) {
        await transaction
          .update(paymentAttempt)
          .set({
            status: 'operator_review',
            providerAttemptReference: payment.reference,
            outcomeDetail: 'additional-approved-charge',
            lastCheckedAt: now,
            updatedAt: now,
          })
          .where(eq(paymentAttempt.id, context.attemptId))
        if (eventId) {
          await this.#updateEventInTransaction(
            transaction,
            eventId,
            'applied',
            'additional-approved-charge',
            chargeId,
            now
          )
        }
        return {
          kind: 'applied',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: 'operator_review',
          issuedUnitCount: 0,
          reason: 'additional-approved-charge',
          issuedCodes: [],
        }
      }

      if (existingPosting) {
        await transaction
          .update(paymentAttempt)
          .set({
            status: 'approved',
            providerAttemptReference: payment.reference,
            outcomeDetail: payment.providerStatus,
            lastCheckedAt: now,
            updatedAt: now,
          })
          .where(eq(paymentAttempt.id, context.attemptId))
        if (eventId) {
          await this.#updateEventInTransaction(transaction, eventId, 'ignored', null, chargeId, now)
        }
        return {
          kind: 'applied',
          attemptId: context.attemptId,
          orderToken: context.orderToken,
          status: 'approved',
          issuedUnitCount: 0,
          duplicate: true,
          issuedCodes: [],
        }
      }

      const [markedPaid] = await transaction
        .update(productOrder)
        .set({
          status: 'paid',
          provider: context.provider,
          providerReference: payment.reference,
          paidAt: now,
          updatedAt: now,
        })
        .where(and(eq(productOrder.id, locked.orderId), eq(productOrder.status, 'pending')))
        .returning({ id: productOrder.id })

      if (!markedPaid) {
        throw new Error('The payment order changed while applying authoritative approval')
      }

      const units = await transaction
        .select({ id: commerceOrderUnit.id, ordinal: commerceOrderUnit.ordinal })
        .from(commerceOrderUnit)
        .where(eq(commerceOrderUnit.orderSnapshotId, locked.orderSnapshotId))
        .orderBy(commerceOrderUnit.ordinal)
        .for('update')

      if (units.length !== locked.quantity) {
        throw new Error('The immutable order unit count does not match its snapshot')
      }

      const issuedCodes: string[] = []
      for (const unit of units) {
        const code = this.#generateCode()
        const redemptionId = createId('red')
        await transaction.insert(orderRedemption).values({
          id: redemptionId,
          orderId: locked.orderId,
          code,
          status: 'issued',
          createdAt: now,
          updatedAt: now,
        })
        const [issued] = await transaction
          .update(commerceOrderUnit)
          .set({
            redemptionId,
            lifecycleStatus: 'issued',
            updatedAt: now,
          })
          .where(
            and(
              eq(commerceOrderUnit.id, unit.id),
              eq(commerceOrderUnit.lifecycleStatus, 'pending_payment'),
              isNull(commerceOrderUnit.redemptionId)
            )
          )
          .returning({ id: commerceOrderUnit.id })
        if (!issued) throw new Error('An order unit was already issued by another operation')
        issuedCodes.push(code)
      }

      await this.#postApprovedPayment(transaction, {
        chargeId,
        operationKey: paymentOperationKey,
        snapshotId: locked.orderSnapshotId,
        grossMinor: BigInt(payment.gross.minorUnits),
        provider: context.provider,
        merchantAccountKey: context.merchantAccountKey,
        environment: context.environment,
        fundingClassification: persistedFunding(locked.fundingClassification),
        now,
      })

      await transaction
        .update(paymentAttempt)
        .set({
          status: 'approved',
          providerAttemptReference: payment.reference,
          outcomeDetail: payment.providerStatus,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(paymentAttempt.id, context.attemptId))

      if (eventId) {
        await this.#updateEventInTransaction(transaction, eventId, 'applied', null, chargeId, now)
      }

      return {
        kind: 'applied',
        attemptId: context.attemptId,
        orderToken: context.orderToken,
        status: 'approved',
        issuedUnitCount: issuedCodes.length,
        issuedCodes,
      }
    })
  }

  async #postApprovedPayment(
    transaction: CommerceTransaction,
    input: {
      chargeId: string
      operationKey: string
      snapshotId: string
      grossMinor: bigint
      provider: string
      merchantAccountKey: string
      environment: string
      fundingClassification: FundingClassification
      now: Date
    }
  ): Promise<void> {
    const receivable = await ensureFinanceAccount(transaction, {
      kind: 'gateway_receivable',
      ownerKey: `${input.provider}:${input.merchantAccountKey}:${input.environment}`,
      currency: 'COP',
      fundingClassification: input.fundingClassification,
    })
    const heldFunds = await ensureFinanceAccount(transaction, {
      kind: 'customer_funds_held',
      ownerKey: input.snapshotId,
      currency: 'COP',
      fundingClassification: input.fundingClassification,
    })
    await postFinanceTransaction(transaction, {
      operationKey: input.operationKey,
      kind: 'payment_approved',
      currency: 'COP',
      orderSnapshotId: input.snapshotId,
      entries: [
        {
          accountId: receivable,
          amountMinor: input.grossMinor,
          memo: `Cargo ${input.chargeId}`,
        },
        {
          accountId: heldFunds,
          amountMinor: -input.grossMinor,
          memo: `Fondos retenidos ${input.snapshotId}`,
        },
      ],
      now: input.now,
    })
  }

  async #findAttemptBySubmissionKey(
    submissionKey: string
  ): Promise<{ id: string; requestHash: string } | undefined> {
    const [attempt] = await this.#database
      .select({ id: paymentAttempt.id, requestHash: paymentAttempt.requestHash })
      .from(paymentAttempt)
      .where(eq(paymentAttempt.submissionKey, submissionKey))
      .limit(1)
    return attempt
  }

  async #loadAttemptContext(attemptId: string): Promise<AttemptContext | undefined> {
    const [row] = await this.#database
      .select({
        attemptId: paymentAttempt.id,
        orderSnapshotId: paymentAttempt.orderSnapshotId,
        orderId: commerceOrderSnapshot.orderId,
        orderToken: productOrder.publicToken,
        buyerName: productOrder.buyerName,
        buyerEmail: productOrder.buyerEmail,
        productName: commerceOrderSnapshot.productName,
        venueName: commerceOrderSnapshot.venueName,
        quantity: commerceOrderSnapshot.quantity,
        unitGrossMinor: commerceOrderSnapshot.unitGrossMinor,
        status: paymentAttempt.status,
        checkoutSessionId: paymentAttempt.checkoutSessionId,
        provider: paymentAttempt.provider,
        providerConfigVersion: paymentAttempt.providerConfigVersion,
        merchantAccountKey: paymentAttempt.merchantAccountKey,
        environment: paymentAttempt.environment,
        fundingClassification: commerceOrderSnapshot.fundingClassification,
      })
      .from(paymentAttempt)
      .innerJoin(
        commerceOrderSnapshot,
        eq(paymentAttempt.orderSnapshotId, commerceOrderSnapshot.id)
      )
      .innerJoin(productOrder, eq(commerceOrderSnapshot.orderId, productOrder.id))
      .where(eq(paymentAttempt.id, attemptId))
      .limit(1)

    if (!row) return undefined
    return {
      ...row,
      grossMinor: row.unitGrossMinor * BigInt(row.quantity),
    }
  }

  async #findCharge(
    transaction: CommerceTransaction,
    context: AttemptContext,
    payment: VerifiedPayment
  ): Promise<
    { id: string; attemptId: string; status: string; approvedAt: Date | null } | undefined
  > {
    const [charge] = await transaction
      .select({
        id: paymentCharge.id,
        attemptId: paymentCharge.attemptId,
        status: paymentCharge.status,
        approvedAt: paymentCharge.approvedAt,
      })
      .from(paymentCharge)
      .where(
        and(
          eq(paymentCharge.provider, context.provider),
          eq(paymentCharge.merchantAccountKey, context.merchantAccountKey),
          eq(paymentCharge.environment, context.environment),
          or(
            eq(paymentCharge.providerReference, payment.reference),
            eq(paymentCharge.providerTransactionId, payment.transactionId)
          )
        )
      )
      .limit(1)
    return charge
  }

  async #markAttemptForReview(attemptId: string, reason: string, eventId?: string): Promise<void> {
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      await transaction
        .update(paymentAttempt)
        .set({
          status: 'operator_review',
          outcomeDetail: reason,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(paymentAttempt.id, attemptId))
      if (eventId) {
        await this.#updateEventInTransaction(
          transaction,
          eventId,
          'rejected',
          reason,
          undefined,
          now
        )
      }
    })
  }

  async #recordUnboundEvent(
    provider: CollectionProvider,
    payloadDigest: string,
    error: string
  ): Promise<void> {
    const now = this.#now()
    await this.#database
      .insert(paymentEvent)
      .values({
        id: createId('pev'),
        provider,
        merchantAccountKey: 'unbound',
        environment: 'unknown',
        providerEventId: payloadDigest,
        payloadDigest,
        verifiedFields: {},
        signatureVerified: false,
        processingStatus: 'rejected',
        processingError: error,
        receivedAt: now,
        processedAt: now,
      })
      .onConflictDoNothing()
  }

  async #upsertEvent(input: {
    context: AttemptContext
    payloadDigest: string
    signatureVerified: boolean
    processingStatus: string
    processingError: string | null
    verifiedFields: Record<string, string>
  }): Promise<{
    id: string
    duplicate: boolean
    terminal: boolean
    processingStatus: string
  }> {
    const now = this.#now()
    const [inserted] = await this.#database
      .insert(paymentEvent)
      .values({
        id: createId('pev'),
        provider: input.context.provider,
        merchantAccountKey: input.context.merchantAccountKey,
        environment: input.context.environment,
        providerEventId: input.payloadDigest,
        payloadDigest: input.payloadDigest,
        verifiedFields: input.verifiedFields,
        signatureVerified: input.signatureVerified,
        processingStatus: input.processingStatus,
        processingError: input.processingError,
        attemptId: input.context.attemptId,
        receivedAt: now,
        processedAt: ['rejected', 'ignored', 'applied'].includes(input.processingStatus)
          ? now
          : null,
      })
      .onConflictDoNothing()
      .returning({ id: paymentEvent.id, processingStatus: paymentEvent.processingStatus })

    if (inserted) {
      return {
        ...inserted,
        duplicate: false,
        terminal: ['rejected', 'ignored', 'applied'].includes(inserted.processingStatus),
      }
    }

    const [existing] = await this.#database
      .select({ id: paymentEvent.id, processingStatus: paymentEvent.processingStatus })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.provider, input.context.provider),
          eq(paymentEvent.merchantAccountKey, input.context.merchantAccountKey),
          eq(paymentEvent.environment, input.context.environment),
          eq(paymentEvent.providerEventId, input.payloadDigest)
        )
      )
      .limit(1)
    if (!existing) throw new Error('The persisted payment event could not be resolved')
    return {
      ...existing,
      duplicate: true,
      terminal: ['rejected', 'ignored', 'applied'].includes(existing.processingStatus),
    }
  }

  async #updateEvent(
    eventId: string,
    status: 'retryable_error' | 'rejected' | 'applied' | 'ignored',
    error: string | null
  ): Promise<void> {
    await this.#database
      .update(paymentEvent)
      .set({ processingStatus: status, processingError: error, processedAt: this.#now() })
      .where(eq(paymentEvent.id, eventId))
  }

  async #updateEventInTransaction(
    transaction: CommerceTransaction,
    eventId: string,
    status: 'rejected' | 'applied' | 'ignored',
    error: string | null,
    chargeId: string | undefined,
    now: Date
  ): Promise<void> {
    await transaction
      .update(paymentEvent)
      .set({
        processingStatus: status,
        processingError: error,
        chargeId,
        processedAt: now,
      })
      .where(eq(paymentEvent.id, eventId))
  }
}
