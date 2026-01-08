/**
 * Billing Plugins Index
 *
 * This file exports the active billing plugin based on configuration.
 * Only ONE billing provider can be active at a time.
 *
 * Set BILLING_PROVIDER in your .env to explicitly select which provider to use.
 * If not set, the first configured provider in the preference order will be used.
 *
 * To add a new provider:
 * 1. Create a new file in this directory (e.g., lemonsqueezy.ts)
 * 2. Implement the isXxxConfigured and createXxxPlugin functions
 * 3. Add it to the providerRegistry below
 * 4. Add the provider name to BillingProviderName type in types.ts
 * 5. Add env vars to config/env.ts
 *
 * To remove a provider:
 * 1. Delete the provider file
 * 2. Remove it from the providerRegistry below
 * 3. Remove the provider name from BillingProviderName type in types.ts
 * 4. Remove the corresponding env vars from config/env.ts
 * 5. Uninstall any related packages
 */

import { env } from '@/config/env'
import type { BillingProviderName } from '../types'

import { isStripeConfigured, createStripePlugin, getStripeClient } from './stripe'
import { isPolarConfigured, createPolarPlugin, getPolarClient } from './polar'
import { isDodoConfigured, createDodoPlugin, getDodoClient } from './dodo'
import { isCreemConfigured, createCreemPlugin } from './creem'
import { isAutumnConfigured, createAutumnPlugin } from './autumn'

/**
 * Registry of all available providers with their check and create functions.
 */
const providerRegistry: Record<
  BillingProviderName,
  { isConfigured: () => boolean; createPlugin: () => unknown }
> = {
  stripe: { isConfigured: isStripeConfigured, createPlugin: createStripePlugin },
  polar: { isConfigured: isPolarConfigured, createPlugin: createPolarPlugin },
  dodo: { isConfigured: isDodoConfigured, createPlugin: createDodoPlugin },
  creem: { isConfigured: isCreemConfigured, createPlugin: createCreemPlugin },
  autumn: { isConfigured: isAutumnConfigured, createPlugin: createAutumnPlugin },
}

/**
 * Default order of provider preference when auto-discovering.
 * The first configured provider will be used.
 */
export const providerPreferenceOrder: BillingProviderName[] = [
  'stripe',
  'polar',
  'dodo',
  'creem',
  'autumn',
]

/**
 * Get the active billing provider name.
 * If BILLING_PROVIDER is set, it will use that provider (if configured).
 * Otherwise, it will return the first available configured provider.
 * Returns null if no provider is configured.
 */
export function getActiveBillingProvider(): BillingProviderName | null {
  // Check if a specific provider is requested
  const selectedProvider = env.BILLING_PROVIDER as BillingProviderName | undefined
  if (selectedProvider && providerRegistry[selectedProvider]?.isConfigured()) {
    return selectedProvider
  }

  if (selectedProvider) {
    console.warn(
      `[Billing] Selected provider "${selectedProvider}" is not configured, falling back to auto-discovery`
    )
  }

  // Auto-discover first available provider
  for (const name of providerPreferenceOrder) {
    if (providerRegistry[name]?.isConfigured()) {
      return name
    }
  }

  return null
}

/**
 * Get the active billing plugin for better-auth.
 * Returns the plugin configuration or null if no provider is configured.
 */
export function getBillingPlugin(): unknown {
  const providerName = getActiveBillingProvider()
  if (!providerName) {
    return null
  }

  const provider = providerRegistry[providerName]
  if (!provider) {
    return null
  }

  const plugin = provider.createPlugin()
  if (plugin) {
    console.info(`[Billing] Using ${providerName} as billing provider`)
  }

  return plugin
}

/**
 * Check if any billing provider is configured.
 */
export function hasBillingProvider(): boolean {
  return getActiveBillingProvider() !== null
}

/**
 * Check if a specific provider is configured.
 */
export function isProviderConfigured(name: BillingProviderName): boolean {
  return providerRegistry[name]?.isConfigured() ?? false
}

/**
 * Get all configured providers (for debugging).
 */
export function getConfiguredProviders(): BillingProviderName[] {
  return providerPreferenceOrder.filter((name) => providerRegistry[name]?.isConfigured())
}

// Re-export individual provider utilities for direct access
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
}
