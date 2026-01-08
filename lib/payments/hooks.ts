/**
 * Payment Hooks
 *
 * Client-side hooks for interacting with the payment system.
 */

import { useState, useCallback, useEffect } from 'react'
import type { SubscriptionData, CheckoutResult, PortalResult } from './types'
import type { PlanName } from '@/config/payments'

interface UseSubscriptionReturn {
  subscription: SubscriptionData | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Hook to get the current user's subscription
 */
export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/payments/subscription')
      
      if (!res.ok) {
        throw new Error('Failed to fetch subscription')
      }
      
      const data = await res.json()
      setSubscription(data.subscription)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  return {
    subscription,
    isLoading,
    error,
    refresh: fetchSubscription,
  }
}

interface CheckoutOptions {
  plan: PlanName
  successUrl?: string
  cancelUrl?: string
}

interface UseCheckoutReturn {
  checkout: (options: CheckoutOptions) => Promise<void>
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to initiate a checkout session
 */
export function useCheckout(): UseCheckoutReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const checkout = useCallback(async (options: CheckoutOptions) => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to initiate checkout')
      }

      const data: CheckoutResult = await res.json()
      
      // Redirect to checkout URL
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    checkout,
    isLoading,
    error,
  }
}

interface UsePortalReturn {
  openPortal: (returnUrl?: string) => Promise<void>
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to open the customer portal
 */
export function usePortal(): UsePortalReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const openPortal = useCallback(async (returnUrl?: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch('/api/payments/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnUrl }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to open portal')
      }

      const data: PortalResult = await res.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No portal URL returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    openPortal,
    isLoading,
    error,
  }
}
