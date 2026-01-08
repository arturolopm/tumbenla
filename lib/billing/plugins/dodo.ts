/**
 * Dodo Payments Billing Plugin
 *
 * Uses @dodopayments/better-auth for Dodo Payments integration.
 * Dodo is a developer-friendly payment platform.
 *
 * Required environment variables:
 * - DODO_API_KEY: Your Dodo API key
 * - DODO_WEBHOOK_SECRET: Webhook signing secret
 * - DODO_PRODUCT_ID: Default product ID for checkouts
 * - DODO_ENVIRONMENT: 'live_mode' or 'test_mode' (default: 'test_mode')
 *
 * To remove this provider:
 * 1. Delete this file
 * 2. Remove from plugins/index.ts
 * 3. Remove DODO_* env vars from config/env.ts
 * 4. Run: bun remove @dodopayments/better-auth dodopayments
 */

import { dodopayments, checkout, portal, webhooks } from '@dodopayments/better-auth'
import DodoPayments from 'dodopayments'

import { env } from '@/config/env'

function hasNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

let dodoClient: DodoPayments | null = null

function getDodoClient(): DodoPayments | null {
  if (dodoClient) return dodoClient

  const apiKey = env.DODO_API_KEY
  if (!hasNonEmpty(apiKey)) return null

  dodoClient = new DodoPayments({
    bearerToken: apiKey,
    environment: (env.DODO_ENVIRONMENT as 'live_mode' | 'test_mode') || 'test_mode',
  })
  return dodoClient
}

export function isDodoConfigured(): boolean {
  return hasNonEmpty(env.DODO_API_KEY)
}

export function createDodoPlugin() {
  const client = getDodoClient()
  if (!client) {
    return null
  }

  const products = env.DODO_PRODUCT_ID ? [{ productId: env.DODO_PRODUCT_ID, slug: 'premium' }] : []

  return dodopayments({
    client,
    createCustomerOnSignUp: true,
    use: [
      checkout({
        products,
        successUrl: '/dashboard?checkout=success',
        authenticatedUsersOnly: true,
      }),
      portal(),
      ...(env.DODO_WEBHOOK_SECRET
        ? [
            webhooks({
              webhookKey: env.DODO_WEBHOOK_SECRET,
              onPayload: async (payload) => {
                console.info('[Dodo] Webhook received:', payload.type)
              },
            }),
          ]
        : []),
    ],
  })
}

export { getDodoClient }
