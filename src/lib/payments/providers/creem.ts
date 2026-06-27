/**
 * Creem Payment Adapter
 *
 * Implements the PaymentAdapter interface for Creem (https://creem.io) integration.
 * Creem is an EU-based Merchant of Record. Handles checkout sessions, subscriptions,
 * the customer portal, and webhooks.
 *
 * Dependency: creem
 */

import crypto from 'crypto'

import { Creem } from 'creem'
import type {
  PaymentAdapter,
  CheckoutOptions,
  CheckoutResult,
  CustomerData,
  SubscriptionData,
  PortalResult,
  WebhookEvent,
  WebhookResult,
} from '../types'
import type { PaymentProvider, PlanName } from '@/config/payments'
import { getPriceConfig, paymentConfig } from '@/config/payments'
import { env, isTruthy } from '@/config/env'

/**
 * Creem expands nested objects (customer, product, subscription, order) in both
 * API responses and webhook payloads, but a field can still arrive as a bare id
 * string. This narrows either shape down to its id.
 */
function resolveId(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as { id: unknown }).id ?? '')
  }
  return ''
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

export class CreemAdapter implements PaymentAdapter {
  public readonly provider: PaymentProvider = 'creem'
  private creem: Creem
  private apiKey: string

  constructor() {
    if (!env.CREEM_API_KEY) {
      throw new Error('CREEM_API_KEY is required for Creem adapter')
    }

    this.apiKey = env.CREEM_API_KEY
    // serverIdx 0 -> https://api.creem.io (production), 1 -> https://test-api.creem.io
    this.creem = new Creem({
      serverIdx: isTruthy(env.CREEM_TEST_MODE) ? 1 : 0,
    })
  }

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    const { plan, successUrl, userId, email } = options

    const prices = getPriceConfig(plan, 'creem')
    if (prices.length === 0) {
      throw new Error(`No Creem prices configured for plan: ${plan}`)
    }

    // Use the monthly price if present, otherwise the first configured price.
    const price = prices.find((p: any) => p.interval === 'month') || prices[0]

    if (!price.productId) {
      throw new Error(`No Creem product ID configured for plan ${plan}`)
    }

    try {
      const checkout = await this.creem.createCheckout({
        xApiKey: this.apiKey,
        createCheckoutRequest: {
          productId: price.productId,
          successUrl: successUrl || paymentConfig.providers.successUrl,
          ...(email && { customer: { email } }),
          metadata: {
            userId,
            plan,
            provider: 'creem',
          },
        },
      })

      if (!checkout.checkoutUrl) {
        throw new Error('Creem checkout did not return a checkout URL')
      }

      return {
        url: checkout.checkoutUrl,
        sessionId: checkout.id,
      }
    } catch (error) {
      console.error('Creem checkout creation error:', error)
      throw new Error('Failed to create Creem checkout session')
    }
  }

  async createCustomer(userId: string, email?: string): Promise<CustomerData> {
    // Creem creates customers during checkout; there is no email-based lookup.
    // Return a placeholder that the webhook will reconcile with the real id.
    const customerId = `creem_pending_${userId}`

    return {
      id: customerId,
      providerCustomerId: customerId,
      email,
      userId,
      provider: 'creem',
    }
  }

  async getSubscription(providerSubscriptionId: string): Promise<SubscriptionData | null> {
    try {
      const subscription = await this.creem.retrieveSubscription({
        subscriptionId: providerSubscriptionId,
        xApiKey: this.apiKey,
      })

      return this.mapSubscription(subscription)
    } catch (error) {
      console.error('Failed to get Creem subscription:', error)
      return null
    }
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    try {
      await this.creem.cancelSubscription({
        id: providerSubscriptionId,
        xApiKey: this.apiKey,
      })
    } catch (error) {
      console.error('Creem subscription cancellation error:', error)
      throw new Error('Failed to cancel Creem subscription')
    }
  }

  async createPortal(customerId: string, _returnUrl?: string): Promise<PortalResult> {
    const providerCustomerId = customerId.replace(/^creem_/, '')

    try {
      const links = await this.creem.generateCustomerLinks({
        xApiKey: this.apiKey,
        createCustomerPortalLinkRequestEntity: {
          customerId: providerCustomerId,
        },
      })

      return { url: links.customerPortalLink }
    } catch (error) {
      console.error('Creem portal creation error:', error)
      throw new Error('Failed to create Creem customer portal session')
    }
  }

  async processWebhook(event: WebhookEvent): Promise<WebhookResult> {
    try {
      const creemEvent = event.rawEvent as any
      const eventType: string = creemEvent.eventType
      const object = creemEvent.object || {}

      switch (eventType) {
        case 'checkout.completed': {
          const userId = object.metadata?.userId || ''
          const customerId = resolveId(object.customer)

          // Recurring purchase: surface the subscription so it is persisted.
          if (object.subscription) {
            return {
              processed: true,
              subscription: this.mapSubscription(object.subscription, userId),
            }
          }

          // One-time purchase: surface it as a payment.
          if (object.order) {
            const order = object.order
            return {
              processed: true,
              payment: {
                id: `creem_${resolveId(order)}`,
                providerPaymentId: resolveId(order),
                userId,
                customerId: customerId ? `creem_${customerId}` : undefined,
                type: 'one_time',
                status: 'succeeded',
                amount: typeof order.amount === 'number' ? order.amount : 0,
                currency: order.currency || 'usd',
                description: `Creem order ${resolveId(order)}`,
                provider: 'creem',
              },
            }
          }

          return { processed: true }
        }

        case 'subscription.active':
        case 'subscription.paid':
        case 'subscription.trialing':
        case 'subscription.update':
        case 'subscription.past_due':
        case 'subscription.unpaid':
        case 'subscription.paused':
        case 'subscription.canceled':
        case 'subscription.expired': {
          const userId = object.metadata?.userId || ''
          return {
            processed: true,
            subscription: this.mapSubscription(object, userId),
          }
        }

        default:
          return { processed: true }
      }
    } catch (error) {
      console.error('Creem webhook processing error:', error)
      return {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async validateWebhook(rawBody: string, signature: string): Promise<boolean> {
    if (!env.CREEM_WEBHOOK_SECRET) {
      throw new Error('CREEM_WEBHOOK_SECRET is required for webhook validation')
    }

    const computed = crypto
      .createHmac('sha256', env.CREEM_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex')

    const computedBuffer = Buffer.from(computed, 'utf8')
    const signatureBuffer = Buffer.from(signature, 'utf8')

    if (computedBuffer.length !== signatureBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(computedBuffer, signatureBuffer)
  }

  /**
   * Normalize a Creem subscription (from the API or a webhook payload) into the
   * unified SubscriptionData shape. Accepts both camelCase (SDK) and snake_case
   * (raw webhook) field names.
   */
  private mapSubscription(sub: any, userId = ''): SubscriptionData {
    const productId = resolveId(sub.product)
    const customerId = resolveId(sub.customer)
    const plan = this.mapProductToPlan(productId)
    const price = (getPriceConfig(plan, 'creem')[0] as any) || null

    const currentPeriodStart =
      toDate(sub.currentPeriodStartDate) || toDate(sub.current_period_start_date)
    const currentPeriodEnd = toDate(sub.currentPeriodEndDate) || toDate(sub.current_period_end_date)
    const canceledAt = toDate(sub.canceledAt) || toDate(sub.canceled_at)

    return {
      id: `creem_${resolveId(sub)}`,
      providerSubscriptionId: resolveId(sub),
      userId: userId || sub.metadata?.userId || '',
      customerId: customerId ? `creem_${customerId}` : undefined,
      status: this.mapStatus(sub.status),
      plan,
      provider: 'creem',
      interval: price?.interval ?? 'month',
      amount: price?.amount ?? null,
      currency: price?.currency ?? null,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(canceledAt),
      canceledAt,
      trialStart: null,
      trialEnd: null,
    }
  }

  private mapStatus(status: string): SubscriptionData['status'] {
    switch (status) {
      case 'active':
        return 'active'
      case 'trialing':
        return 'trialing'
      case 'paused':
        return 'paused'
      case 'canceled':
      case 'expired':
        return 'canceled'
      case 'past_due':
      case 'unpaid':
        return 'past_due'
      default:
        return 'incomplete'
    }
  }

  private mapProductToPlan(productId: string): PlanName {
    for (const [planName, plan] of Object.entries(paymentConfig.plans)) {
      const creemPrices = (plan.prices as any).creem
      if (creemPrices?.some((price: any) => price.productId === productId)) {
        return planName as PlanName
      }
    }

    return 'free'
  }
}
