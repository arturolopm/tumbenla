'use client'

/**
 * Billing Auth Client
 *
 * A separate auth client configured with billing plugins.
 * This is kept separate from the main auth client to maintain proper TypeScript types.
 *
 * Usage:
 * ```ts
 * import { billingClient } from '@/lib/billing/billing-client'
 *
 * // For Stripe
 * await billingClient?.subscription?.upgrade({ plan: 'pro' })
 *
 * // For Polar/Dodo
 * await billingClient?.checkout({ slug: 'pro' })
 * ```
 *
 * For a more convenient API, use the useBilling() hook instead:
 * ```ts
 * import { useBilling } from '@/lib/billing/client'
 *
 * const { checkout, openPortal } = useBilling()
 * ```
 */

import { createAuthClient } from 'better-auth/react'
import { getBaseUrl } from '../utils'
import { getClientBillingProvider } from './client'

// Create billing client with the appropriate plugin
function createBillingClient() {
  const provider = getClientBillingProvider()
  if (!provider) return null

  try {
    switch (provider) {
      case 'stripe': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { stripeClient } = require('@better-auth/stripe/client')
        return createAuthClient({
          baseURL: getBaseUrl(),
          plugins: [stripeClient({ subscription: true })],
        })
      }
      case 'polar': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { polarClient } = require('@polar-sh/better-auth/client')
        return createAuthClient({
          baseURL: getBaseUrl(),
          plugins: [polarClient()],
        })
      }
      case 'dodo': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { dodopaymentsClient } = require('@dodopayments/better-auth')
        return createAuthClient({
          baseURL: getBaseUrl(),
          plugins: [dodopaymentsClient()],
        })
      }
      case 'creem': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { creemClient } = require('@creem_io/better-auth/client')
        return createAuthClient({
          baseURL: getBaseUrl(),
          plugins: [creemClient()],
        })
      }
      case 'autumn':
        // Autumn doesn't use a client plugin, uses AutumnProvider instead
        return null
      default:
        return null
    }
  } catch (error) {
    console.warn('[Billing] Failed to create billing client:', error)
    return null
  }
}

/**
 * Billing client instance.
 * Will be null if no billing provider is configured or if Autumn is used.
 *
 * For Autumn, use the useAutumnBilling() hook from '@/lib/billing/client'.
 */
export const billingClient = createBillingClient()
