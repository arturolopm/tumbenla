/**
 * Billing Client Module
 *
 * Client-side exports for billing functionality.
 * Use these in your React components and auth-client.ts.
 *
 * IMPORTANT: For Autumn provider, you need to wrap your app with AutumnProvider.
 * See lib/billing/providers/autumn-provider.tsx for details.
 *
 * Example usage in auth-client.ts:
 * ```ts
 * import { getBillingClientPlugin } from '@/lib/billing/client'
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
 *
 * Example usage in components:
 * ```tsx
 * import { useBilling } from '@/lib/billing/client'
 *
 * function PricingButton() {
 *   const { checkout, isLoading } = useBilling()
 *   return (
 *     <button onClick={() => checkout({ productId: 'pro' })} disabled={isLoading}>
 *       Upgrade to Pro
 *     </button>
 *   )
 * }
 * ```
 */

// Client plugin utilities
export {
  getBillingClientPlugin,
  getClientBillingProvider,
  hasClientBillingProvider,
} from './plugins/client'

// Billing client
export { billingClient } from './billing-client'

// Billing hooks
export { useBilling, useHasBilling } from './hooks'

// Autumn-specific exports (only use if NEXT_PUBLIC_BILLING_PROVIDER=autumn)
export { AutumnBillingProvider, useAutumnBilling } from './providers/autumn-provider'

// Re-export types
export type { BillingProviderName } from './types'
