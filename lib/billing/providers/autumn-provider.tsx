'use client'

/**
 * Autumn Provider Wrapper
 *
 * Autumn uses a different approach than other billing providers.
 * Instead of a better-auth client plugin, it uses a React context provider.
 *
 * Usage in your root layout (only if using Autumn):
 * ```tsx
 * import { AutumnBillingProvider } from '@/lib/billing/providers/autumn-provider'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AutumnBillingProvider>
 *           {children}
 *         </AutumnBillingProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 *
 * Usage in components:
 * ```tsx
 * import { useAutumnBilling } from '@/lib/billing/providers/autumn-provider'
 *
 * function PricingButton() {
 *   const { customer, openCheckout, openBillingPortal, allowed } = useAutumnBilling()
 *
 *   if (!customer) return <p>Loading...</p>
 *
 *   return (
 *     <div>
 *       {allowed('premium-feature') ? (
 *         <p>You have access!</p>
 *       ) : (
 *         <button onClick={() => openCheckout('pro-plan')}>
 *           Upgrade to Pro
 *         </button>
 *       )}
 *       <button onClick={openBillingPortal}>Manage Billing</button>
 *     </div>
 *   )
 * }
 * ```
 */

import type { ReactNode } from 'react'
import { env } from '@/config/env'
import { getClientBillingProvider } from '../plugins/client'

interface AutumnBillingProviderProps {
  children: ReactNode
}

// Default no-op values for when Autumn is not configured
const noopAutumnBilling = {
  customer: null,
  allowed: () => false,
  openCheckout: () => {
    console.warn('[Billing] Autumn is not configured')
  },
  openBillingPortal: () => {
    console.warn('[Billing] Autumn is not configured')
  },
  isAutumn: false as const,
}

/**
 * Wrapper component for Autumn billing provider.
 * Only renders AutumnProvider if Autumn is the configured billing provider.
 */
export function AutumnBillingProvider({ children }: AutumnBillingProviderProps) {
  const provider = getClientBillingProvider()

  // If not using Autumn, just render children
  if (provider !== 'autumn') {
    return <>{children}</>
  }

  // Dynamically import and render Autumn provider
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AutumnProvider } = require('autumn-js/react')
    return <AutumnProvider betterAuthUrl={env.NEXT_PUBLIC_APP_URL}>{children}</AutumnProvider>
  } catch {
    console.warn('[Billing] Failed to load autumn-js/react')
    return <>{children}</>
  }
}

/**
 * Hook for Autumn billing operations.
 *
 * IMPORTANT: This hook should only be used when NEXT_PUBLIC_BILLING_PROVIDER=autumn.
 * For other providers, use the useBilling() hook from '@/lib/billing/client'.
 *
 * @returns Autumn customer data and billing methods, or no-op values if not configured
 */
export function useAutumnBilling() {
  const provider = getClientBillingProvider()

  if (provider !== 'autumn') {
    return noopAutumnBilling
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, react-hooks/rules-of-hooks
    const { useCustomer } = require('autumn-js/react')
    // biome-ignore lint/correctness/useHookAtTopLevel: Intentional - provider is stable (env var doesn't change at runtime)
    const data = useCustomer()
    return {
      customer: data.customer,
      allowed: data.allowed,
      openCheckout: data.openCheckout,
      openBillingPortal: data.openBillingPortal,
      isAutumn: true as const,
    }
  } catch {
    console.warn('[Billing] Failed to load autumn-js/react useCustomer hook')
    return noopAutumnBilling
  }
}
