/**
 * Billing Module
 *
 * Main entry point for billing functionality using better-auth payment plugins.
 *
 * Supported Providers (via better-auth plugins):
 * - Stripe (@better-auth/stripe)
 * - Polar (@polar-sh/better-auth)
 * - Dodo Payments (@dodopayments/better-auth)
 * - Creem (@creem_io/better-auth)
 * - Autumn (autumn-js/better-auth)
 *
 * IMPORTANT: Only ONE provider can be active at a time.
 *
 * Usage:
 * ```ts
 * import { getBillingPlugin, hasBillingProvider } from "@/lib/billing";
 *
 * // In your auth configuration
 * export const auth = betterAuth({
 *   // ... your config
 *   plugins: [
 *     // ... other plugins
 *     ...(hasBillingProvider() ? [getBillingPlugin()] : []),
 *   ],
 * });
 * ```
 *
 * Configuration:
 * Set BILLING_PROVIDER in your .env to explicitly select a provider,
 * or leave it unset for auto-discovery based on available credentials.
 *
 * To Remove Unused Providers:
 * 1. Delete the provider file from ./plugins/
 * 2. Remove the corresponding import from ./plugins/index.ts
 * 3. Remove the corresponding env vars from config/env.ts
 * 4. Uninstall the related packages
 */

// Main plugin utilities
export {
  getBillingPlugin,
  getActiveBillingProvider,
  hasBillingProvider,
  isProviderConfigured,
  getConfiguredProviders,
  providerPreferenceOrder,
} from './plugins'

// Individual provider utilities (for advanced use cases)
export {
  isStripeConfigured,
  createStripePlugin,
  getStripeClient,
  isPolarConfigured,
  createPolarPlugin,
  getPolarClient,
  isDodoConfigured,
  createDodoPlugin,
  getDodoClient,
  isCreemConfigured,
  createCreemPlugin,
  isAutumnConfigured,
  createAutumnPlugin,
} from './plugins'

// Types
export type { BillingProviderName, ProductConfig, BillingConfig } from './types'
