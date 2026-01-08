/**
 * Stripe Billing Plugin
 *
 * Uses @better-auth/stripe for seamless Stripe integration.
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 * - STRIPE_PRICE_ID: Default price ID for subscriptions (optional)
 *
 * To remove this provider:
 * 1. Delete this file
 * 2. Remove from plugins/index.ts
 * 3. Remove STRIPE_* env vars from config/env.ts
 * 4. Run: bun remove stripe @better-auth/stripe
 */

import { stripe } from '@better-auth/stripe'
import Stripe from 'stripe'

import { env } from '@/config/env'

function hasNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

let stripeClient: Stripe | null = null

function getStripeClient(): Stripe | null {
  if (stripeClient) return stripeClient

  const secretKey = env.STRIPE_SECRET_KEY
  if (!hasNonEmpty(secretKey)) return null

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  })
  return stripeClient
}

export function isStripeConfigured(): boolean {
  return hasNonEmpty(env.STRIPE_SECRET_KEY) && hasNonEmpty(env.STRIPE_WEBHOOK_SECRET)
}

export function createStripePlugin() {
  const client = getStripeClient()
  if (!client || !env.STRIPE_WEBHOOK_SECRET) {
    return null
  }

  return stripe({
    stripeClient: client,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    createCustomerOnSignUp: true,
    onCustomerCreate: async ({
      stripeCustomer,
      user,
    }: {
      stripeCustomer: { id: string }
      user: { id: string }
    }) => {
      console.info(`[Stripe] Customer ${stripeCustomer.id} created for user ${user.id}`)
    },
    onEvent: async (event: Stripe.Event) => {
      // Handle custom Stripe events
      switch (event.type) {
        case 'invoice.paid':
          console.info('[Stripe] Invoice paid:', event.data.object.id)
          break
        case 'customer.subscription.deleted':
          console.info('[Stripe] Subscription deleted:', event.data.object.id)
          break
      }
    },
  })
}

export { getStripeClient }
