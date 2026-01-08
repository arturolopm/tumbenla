/**
 * Billing Client Plugins
 *
 * This module provides client-side billing plugin configuration for better-auth.
 * It dynamically exports the appropriate client plugin based on NEXT_PUBLIC_BILLING_PROVIDER.
 *
 * Each provider has different client-side capabilities:
 * - Stripe: subscription management, upgrade/downgrade, cancel
 * - Polar: checkout, customer portal
 * - Dodo: checkout, customer portal
 * - Creem: checkout
 * - Autumn: Uses AutumnProvider wrapper (see lib/billing/providers/autumn-provider.tsx)
 */

import { env } from '@/config/env'
import type { BillingProviderName } from '../types'

// Get the billing provider from client-accessible env var
export function getClientBillingProvider(): BillingProviderName | null {
  const provider = env.NEXT_PUBLIC_BILLING_PROVIDER
  if (!provider) return null
  return provider as BillingProviderName
}

/**
 * Get the client plugin for the active billing provider.
 * Returns null if no provider is configured.
 *
 * Usage in auth-client.ts:
 * ```ts
 * import { getBillingClientPlugin } from '@/lib/billing/plugins/client'
 *
 * const billingPlugin = getBillingClientPlugin()
 *
 * export const client = createAuthClient({
 *   plugins: [
 *     emailOTPClient(),
 *     ...(billingPlugin ? [billingPlugin] : []),
 *   ],
 * })
 * ```
 */
export function getBillingClientPlugin() {
  const provider = getClientBillingProvider()
  if (!provider) return null

  switch (provider) {
    case 'stripe': {
      // Dynamic import would be better but we need sync for plugin array
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { stripeClient } = require('@better-auth/stripe/client')
      return stripeClient({ subscription: true })
    }
    case 'polar': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { polarClient } = require('@polar-sh/better-auth/client')
      return polarClient()
    }
    case 'dodo': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { dodopaymentsClient } = require('@dodopayments/better-auth')
      return dodopaymentsClient()
    }
    case 'creem': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { creemClient } = require('@creem_io/better-auth/client')
      return creemClient()
    }
    case 'autumn':
      // Autumn uses AutumnProvider wrapper, not a client plugin
      // See lib/billing/providers/autumn-provider.tsx
      return null
    default:
      return null
  }
}

/**
 * Check if billing is enabled on the client side.
 */
export function hasClientBillingProvider(): boolean {
  return getClientBillingProvider() !== null
}
