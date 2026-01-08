/**
 * Autumn Billing Plugin
 *
 * Uses autumn-js/better-auth for Autumn integration.
 * Autumn is a usage-based billing platform.
 *
 * Required environment variables:
 * - AUTUMN_API_KEY: Your Autumn API key (set in Autumn dashboard)
 * - AUTUMN_CUSTOMER_SCOPE: 'user' | 'organization' | 'user_and_organization' (default: 'user')
 *
 * Note: Autumn uses a different configuration approach where
 * the API key is set in the Autumn dashboard, and the plugin
 * integrates via the AutumnProvider on the client side.
 *
 * To remove this provider:
 * 1. Delete this file
 * 2. Remove from plugins/index.ts
 * 3. Remove AUTUMN_* env vars from config/env.ts
 * 4. Run: bun remove autumn-js
 */

import { autumn } from 'autumn-js/better-auth'

import { env } from '@/config/env'

function hasNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isAutumnConfigured(): boolean {
  // Autumn is configured if the API key is set
  // The actual API key is configured in the Autumn dashboard
  return hasNonEmpty(env.AUTUMN_API_KEY)
}

type CustomerScope = 'user' | 'organization' | 'user_and_organization'

export function createAutumnPlugin() {
  if (!isAutumnConfigured()) {
    return null
  }

  const customerScope = (env.AUTUMN_CUSTOMER_SCOPE as CustomerScope) || 'user'

  return autumn({
    customerScope,
  })
}
