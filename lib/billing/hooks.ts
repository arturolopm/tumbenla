'use client'

/**
 * Billing Hooks
 *
 * React hooks for billing operations. These hooks provide a unified API
 * across all billing providers.
 *
 * Usage:
 * ```tsx
 * import { useBilling } from '@/lib/billing/hooks'
 *
 * function UpgradeButton() {
 *   const { checkout, isLoading, provider } = useBilling()
 *
 *   if (!provider) return null // No billing configured
 *
 *   return (
 *     <button onClick={() => checkout('pro')} disabled={isLoading}>
 *       Upgrade to Pro
 *     </button>
 *   )
 * }
 * ```
 */

import { useState, useCallback } from 'react'
import { billingClient } from './billing-client'
import { getClientBillingProvider } from './plugins/client'
import type { BillingProviderName } from './types'

interface CheckoutOptions {
  productId?: string
  slug?: string
  successUrl?: string
  cancelUrl?: string
}

interface UseBillingReturn {
  /** The active billing provider, or null if none configured */
  provider: BillingProviderName | null
  /** Whether a billing operation is in progress */
  isLoading: boolean
  /** Error from the last billing operation */
  error: Error | null
  /** Initiate a checkout session */
  checkout: (options: CheckoutOptions | string) => Promise<void>
  /** Open the customer portal (if supported) */
  openPortal: () => Promise<void>
  /** Cancel subscription (Stripe only) */
  cancelSubscription: () => Promise<void>
  /** Upgrade subscription (Stripe only) */
  upgradeSubscription: (planId: string) => Promise<void>
}

/**
 * Hook for billing operations.
 * Provides a unified API across all billing providers.
 */
export function useBilling(): UseBillingReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const provider = getClientBillingProvider()

  const checkout = useCallback(
    async (options: CheckoutOptions | string) => {
      if (!provider) {
        setError(new Error('No billing provider configured'))
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const opts = typeof options === 'string' ? { slug: options } : options

        if (!billingClient) {
          throw new Error('Billing client not initialized')
        }

        switch (provider) {
          case 'stripe': {
            // Stripe uses subscription.upgrade for checkout
            // @ts-expect-error - dynamic plugin methods
            await billingClient.subscription?.upgrade?.({
              plan: opts.slug || opts.productId,
              successUrl: opts.successUrl,
              cancelUrl: opts.cancelUrl,
            })
            break
          }
          case 'polar': {
            // @ts-expect-error - dynamic plugin methods
            await billingClient.checkout?.({
              slug: opts.slug,
              products: opts.productId ? [opts.productId] : undefined,
            })
            break
          }
          case 'dodo': {
            // @ts-expect-error - dynamic plugin methods
            await billingClient.checkout?.({
              slug: opts.slug,
              products: opts.productId ? [opts.productId] : undefined,
            })
            break
          }
          case 'creem': {
            // @ts-expect-error - dynamic plugin methods
            await billingClient.checkout?.({
              productId: opts.productId || opts.slug,
            })
            break
          }
          case 'autumn':
            // Autumn uses useCustomer hook from autumn-js/react
            throw new Error('Use useCustomer from autumn-js/react for Autumn checkout')
          default:
            throw new Error(`Unknown billing provider: ${provider}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [provider]
  )

  const openPortal = useCallback(async () => {
    if (!provider) {
      setError(new Error('No billing provider configured'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (!billingClient) {
        throw new Error('Billing client not initialized')
      }

      switch (provider) {
        case 'stripe': {
          // @ts-expect-error - dynamic plugin methods
          await billingClient.subscription?.manageSubscription?.()
          break
        }
        case 'polar':
        case 'dodo': {
          // @ts-expect-error - dynamic plugin methods
          await billingClient.portal?.()
          break
        }
        case 'creem':
          throw new Error('Creem does not support customer portal')
        case 'autumn':
          throw new Error('Use useCustomer from autumn-js/react for Autumn portal')
        default:
          throw new Error(`Unknown billing provider: ${provider}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [provider])

  const cancelSubscription = useCallback(async () => {
    if (provider !== 'stripe') {
      setError(new Error('Cancel subscription is only available for Stripe'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (!billingClient) {
        throw new Error('Billing client not initialized')
      }
      // @ts-expect-error - dynamic plugin methods
      await billingClient.subscription?.cancel?.()
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [provider])

  const upgradeSubscription = useCallback(
    async (planId: string) => {
      if (provider !== 'stripe') {
        setError(new Error('Upgrade subscription is only available for Stripe'))
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        if (!billingClient) {
          throw new Error('Billing client not initialized')
        }
        // @ts-expect-error - dynamic plugin methods
        await billingClient.subscription?.upgrade?.({ plan: planId })
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [provider]
  )

  return {
    provider,
    isLoading,
    error,
    checkout,
    openPortal,
    cancelSubscription,
    upgradeSubscription,
  }
}

/**
 * Hook to check if billing is available.
 */
export function useHasBilling(): boolean {
  return getClientBillingProvider() !== null
}
