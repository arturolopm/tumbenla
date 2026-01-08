/**
 * Creem Billing Plugin
 *
 * Uses @creem_io/better-auth for Creem integration.
 * Creem is a payment platform for digital products.
 *
 * Required environment variables:
 * - CREEM_API_KEY: Your Creem API key
 * - CREEM_WEBHOOK_SECRET: Webhook signing secret
 * - CREEM_PRODUCT_ID: Default product ID for checkouts (optional)
 *
 * To remove this provider:
 * 1. Delete this file
 * 2. Remove from plugins/index.ts
 * 3. Remove CREEM_* env vars from config/env.ts
 * 4. Run: bun remove @creem_io/better-auth
 */

import { creem } from '@creem_io/better-auth'

import { env } from '@/config/env'

function hasNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isCreemConfigured(): boolean {
  return hasNonEmpty(env.CREEM_API_KEY)
}

export function createCreemPlugin() {
  const apiKey = env.CREEM_API_KEY
  if (!hasNonEmpty(apiKey)) {
    return null
  }

  return creem({
    apiKey,
    webhookSecret: env.CREEM_WEBHOOK_SECRET,
    onGrantAccess: async ({
      product,
      customer,
    }: {
      product: { name: string }
      customer: { email: string }
      metadata?: { referenceId?: string }
    }) => {
      console.info(`[Creem] Access granted for ${customer.email} to ${product.name}`)
      // Grant access to the user based on the product
      // You can use metadata.referenceId to find the user
    },
    onRevokeAccess: async ({
      reason,
      product,
      customer,
    }: {
      reason: string
      product: { name: string }
      customer: { email: string }
      metadata?: { referenceId?: string }
    }) => {
      console.info(`[Creem] Access revoked (${reason}) for ${customer.email} from ${product.name}`)
      // Revoke access from the user
      // This handles cancellations, expirations, refunds, and failed payments
    },
  })
}
