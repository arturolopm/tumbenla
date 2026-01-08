/**
 * Polar Billing Plugin
 *
 * Uses @polar-sh/better-auth for Polar integration.
 * Polar is a developer-first payment infrastructure.
 *
 * Required environment variables:
 * - POLAR_ACCESS_TOKEN: Your Polar access token
 * - POLAR_WEBHOOK_SECRET: Webhook signing secret
 * - POLAR_ORGANIZATION_ID: Your organization ID
 * - POLAR_PRODUCT_ID: Default product ID for checkouts
 * - POLAR_ENVIRONMENT: 'production' or 'sandbox' (default: 'production')
 *
 * To remove this provider:
 * 1. Delete this file
 * 2. Remove from plugins/index.ts
 * 3. Remove POLAR_* env vars from config/env.ts
 * 4. Run: bun remove @polar-sh/better-auth @polar-sh/sdk
 */

import { polar, checkout, portal, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'

import { env } from '@/config/env'

function hasNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

let polarClient: Polar | null = null

function getPolarClient(): Polar | null {
  if (polarClient) return polarClient

  const accessToken = env.POLAR_ACCESS_TOKEN
  if (!hasNonEmpty(accessToken)) return null

  polarClient = new Polar({
    accessToken,
    server: (env.POLAR_ENVIRONMENT as 'production' | 'sandbox') || 'production',
  })
  return polarClient
}

export function isPolarConfigured(): boolean {
  return hasNonEmpty(env.POLAR_ACCESS_TOKEN)
}

export function createPolarPlugin() {
  const client = getPolarClient()
  if (!client) {
    return null
  }

  const products = env.POLAR_PRODUCT_ID
    ? [{ productId: env.POLAR_PRODUCT_ID, slug: 'premium' }]
    : []

  return polar({
    client,
    createCustomerOnSignUp: true,
    use: [
      checkout({
        products,
        successUrl: '/dashboard?checkout=success',
        authenticatedUsersOnly: true,
      }),
      portal(),
      ...(env.POLAR_WEBHOOK_SECRET
        ? [
            webhooks({
              secret: env.POLAR_WEBHOOK_SECRET,
              onCustomerStateChanged: async (payload) => {
                console.info('[Polar] Customer state changed:', payload.data.id)
              },
              onOrderPaid: async (payload) => {
                console.info('[Polar] Order paid:', payload.data.id)
              },
              onSubscriptionActive: async (payload) => {
                console.info('[Polar] Subscription active:', payload.data.id)
              },
              onSubscriptionCanceled: async (payload) => {
                console.info('[Polar] Subscription canceled:', payload.data.id)
              },
            }),
          ]
        : []),
    ],
  })
}

export { getPolarClient }
