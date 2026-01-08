/**
 * Billing Types
 *
 * Shared types for the billing system using better-auth payment plugins.
 *
 * Supported providers (via better-auth plugins):
 * - Stripe (@better-auth/stripe)
 * - Polar (@polar-sh/better-auth)
 * - Dodo Payments (@dodopayments/better-auth)
 * - Creem (@creem_io/better-auth)
 * - Autumn (autumn-js)
 *
 * Only ONE provider can be active at a time.
 */

export type BillingProviderName = 'stripe' | 'polar' | 'dodo' | 'creem' | 'autumn'

export interface ProductConfig {
  productId: string
  slug: string
  name?: string
}

export interface BillingConfig {
  provider: BillingProviderName
  products: ProductConfig[]
  successUrl: string
  cancelUrl?: string
  createCustomerOnSignUp?: boolean
  authenticatedUsersOnly?: boolean
}
