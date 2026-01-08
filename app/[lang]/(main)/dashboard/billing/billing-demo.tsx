'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, CreditCard, ExternalLink, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBilling, useHasBilling, getClientBillingProvider } from '@/lib/billing/client'
import type { BillingProviderName } from '@/lib/billing/types'

/**
 * Provider info for display purposes
 */
const providerInfo: Record<
  BillingProviderName,
  { name: string; description: string; docsUrl: string; features: string[] }
> = {
  stripe: {
    name: 'Stripe',
    description: 'Full-featured payment processing with subscriptions, invoicing, and more.',
    docsUrl: 'https://www.better-auth.com/docs/plugins/stripe',
    features: ['Subscriptions', 'One-time payments', 'Customer portal', 'Webhooks', 'Invoicing'],
  },
  polar: {
    name: 'Polar',
    description: 'Developer-first payment infrastructure for open source and digital products.',
    docsUrl: 'https://www.better-auth.com/docs/plugins/polar',
    features: ['Checkout', 'Customer portal', 'Usage-based billing', 'Webhooks', 'Benefits'],
  },
  dodo: {
    name: 'Dodo Payments',
    description: 'Simple, developer-friendly payment platform.',
    docsUrl: 'https://dodopayments.com/docs',
    features: ['Checkout', 'Customer portal', 'Webhooks', 'Simple integration'],
  },
  creem: {
    name: 'Creem',
    description: 'Payment platform optimized for digital products and subscriptions.',
    docsUrl: 'https://creem.io/docs',
    features: ['Checkout', 'Access control', 'Webhooks', 'Digital products'],
  },
  autumn: {
    name: 'Autumn',
    description: 'Usage-based billing platform with feature flags and metering.',
    docsUrl: 'https://autumn.dev/docs',
    features: ['Usage-based billing', 'Feature flags', 'Metering', 'Customer portal'],
  },
}

/**
 * Status badge component
 */
function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        configured ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {configured ? (
        <>
          <CheckCircle className='h-3.5 w-3.5' />
          Configured
        </>
      ) : (
        <>
          <XCircle className='h-3.5 w-3.5' />
          Not Configured
        </>
      )}
    </span>
  )
}

/**
 * Provider card component
 */
function ProviderCard({
  provider,
  isActive,
}: {
  provider: BillingProviderName
  isActive: boolean
}) {
  const info = providerInfo[provider]

  return (
    <div
      className={`relative rounded-lg border p-6 ${
        isActive ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border'
      }`}
    >
      {isActive && (
        <div className='absolute -top-3 left-4'>
          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground'>
            Active Provider
          </span>
        </div>
      )}
      <div className='flex items-start justify-between mb-4'>
        <div>
          <h3 className='text-lg font-semibold'>{info.name}</h3>
          <p className='text-sm text-muted-foreground mt-1'>{info.description}</p>
        </div>
        <StatusBadge configured={isActive} />
      </div>
      <div className='mb-4'>
        <h4 className='text-sm font-medium mb-2'>Features:</h4>
        <div className='flex flex-wrap gap-2'>
          {info.features.map((feature) => (
            <span
              key={feature}
              className='inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs'
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
      <a
        href={info.docsUrl}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex items-center gap-1 text-sm text-primary hover:underline'
      >
        View Documentation
        <ExternalLink className='h-3.5 w-3.5' />
      </a>
    </div>
  )
}

/**
 * Demo checkout section
 */
function CheckoutDemo() {
  const { checkout, openPortal, cancelSubscription, isLoading, error, provider } = useBilling()
  const [lastAction, setLastAction] = useState<string | null>(null)

  const handleCheckout = async (slug: string) => {
    setLastAction(`Initiating checkout for "${slug}"...`)
    try {
      await checkout({ slug })
      setLastAction(`Checkout initiated for "${slug}"`)
    } catch (err) {
      setLastAction(`Checkout failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handlePortal = async () => {
    setLastAction('Opening customer portal...')
    try {
      await openPortal()
      setLastAction('Portal opened')
    } catch (err) {
      setLastAction(`Portal failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleCancel = async () => {
    setLastAction('Canceling subscription...')
    try {
      await cancelSubscription()
      setLastAction('Subscription canceled')
    } catch (err) {
      setLastAction(`Cancel failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (!provider) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center'>
        <CreditCard className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
        <h3 className='text-lg font-medium mb-2'>No Billing Provider Configured</h3>
        <p className='text-sm text-muted-foreground mb-4'>
          Set <code className='px-1.5 py-0.5 rounded bg-muted'>NEXT_PUBLIC_BILLING_PROVIDER</code>{' '}
          in your <code className='px-1.5 py-0.5 rounded bg-muted'>.env.local</code> to enable
          billing.
        </p>
        <div className='text-xs text-muted-foreground'>
          Available providers: stripe, polar, dodo, creem, autumn
        </div>
      </div>
    )
  }

  const info = providerInfo[provider]

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-medium'>Test {info.name} Integration</h3>
          <p className='text-sm text-muted-foreground'>
            Try out the billing actions below. In production, these would redirect to {info.name}
            &apos;s checkout/portal.
          </p>
        </div>
        <StatusBadge configured={true} />
      </div>

      {/* Action buttons */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {/* Checkout buttons */}
        <div className='rounded-lg border p-4'>
          <h4 className='font-medium mb-3'>Checkout</h4>
          <div className='space-y-2'>
            <Button
              onClick={() => handleCheckout('starter')}
              disabled={isLoading}
              className='w-full'
              variant='outline'
            >
              {isLoading ? <Loader2 className='h-4 w-4 animate-spin mr-2' /> : null}
              Checkout: Starter Plan
            </Button>
            <Button onClick={() => handleCheckout('pro')} disabled={isLoading} className='w-full'>
              {isLoading ? <Loader2 className='h-4 w-4 animate-spin mr-2' /> : null}
              Checkout: Pro Plan
            </Button>
          </div>
        </div>

        {/* Portal button */}
        <div className='rounded-lg border p-4'>
          <h4 className='font-medium mb-3'>Customer Portal</h4>
          <Button
            onClick={handlePortal}
            disabled={isLoading || provider === 'creem'}
            className='w-full'
            variant='outline'
          >
            {isLoading ? <Loader2 className='h-4 w-4 animate-spin mr-2' /> : null}
            <Settings className='h-4 w-4 mr-2' />
            Open Portal
          </Button>
          {provider === 'creem' && (
            <p className='text-xs text-muted-foreground mt-2'>
              Creem doesn&apos;t support customer portal
            </p>
          )}
        </div>

        {/* Cancel button (Stripe only) */}
        <div className='rounded-lg border p-4'>
          <h4 className='font-medium mb-3'>Subscription</h4>
          <Button
            onClick={handleCancel}
            disabled={isLoading || provider !== 'stripe'}
            className='w-full'
            variant='destructive'
          >
            {isLoading ? <Loader2 className='h-4 w-4 animate-spin mr-2' /> : null}
            Cancel Subscription
          </Button>
          {provider !== 'stripe' && (
            <p className='text-xs text-muted-foreground mt-2'>
              Direct cancel only available for Stripe
            </p>
          )}
        </div>
      </div>

      {/* Status/Error display */}
      {(lastAction || error) && (
        <div
          className={`rounded-lg p-4 ${error ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}
        >
          <p className='text-sm font-mono'>{error ? `Error: ${error.message}` : lastAction}</p>
        </div>
      )}
    </div>
  )
}

/**
 * Configuration guide section
 */
function ConfigurationGuide() {
  const provider = getClientBillingProvider()

  return (
    <div className='rounded-lg border p-6'>
      <h3 className='text-lg font-medium mb-4'>Configuration Guide</h3>

      <div className='space-y-4'>
        <div>
          <h4 className='text-sm font-medium mb-2'>1. Set Environment Variables</h4>
          <div className='rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto'>
            <div className='text-muted-foreground'># .env.local</div>
            <div className='mt-2'>
              <span className='text-blue-600'>BILLING_PROVIDER</span>=stripe
            </div>
            <div>
              <span className='text-blue-600'>NEXT_PUBLIC_BILLING_PROVIDER</span>=stripe
            </div>
            <div className='mt-2 text-muted-foreground'># Provider-specific keys</div>
            <div>
              <span className='text-blue-600'>STRIPE_SECRET_KEY</span>=sk_test_...
            </div>
            <div>
              <span className='text-blue-600'>STRIPE_WEBHOOK_SECRET</span>=whsec_...
            </div>
          </div>
        </div>

        <div>
          <h4 className='text-sm font-medium mb-2'>2. Use in Components</h4>
          <div className='rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto'>
            <pre>{`import { useBilling } from '@/lib/billing/client'

function PricingButton() {
  const { checkout, isLoading } = useBilling()

  return (
    <button
      onClick={() => checkout('pro')}
      disabled={isLoading}
    >
      Upgrade to Pro
    </button>
  )
}`}</pre>
          </div>
        </div>

        <div>
          <h4 className='text-sm font-medium mb-2'>3. Current Status</h4>
          <div className='flex items-center gap-2'>
            <StatusBadge configured={!!provider} />
            {provider && (
              <span className='text-sm text-muted-foreground'>
                Using <strong>{providerInfo[provider].name}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Main billing demo component
 */
export function BillingDemo() {
  const hasBilling = useHasBilling()
  const provider = getClientBillingProvider()

  return (
    <div className='container mx-auto py-8 px-4 max-w-6xl'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold tracking-tight'>Billing System Demo</h1>
        <p className='text-muted-foreground mt-2'>
          This page demonstrates the better-auth billing plugin integration. Test the checkout flow
          and explore the available providers.
        </p>
      </div>

      {/* Current provider status */}
      <div className='mb-8 p-4 rounded-lg bg-muted/50 border'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-sm text-muted-foreground'>Current Provider</div>
            <div className='text-xl font-semibold'>
              {provider ? providerInfo[provider].name : 'None'}
            </div>
          </div>
          <StatusBadge configured={hasBilling} />
        </div>
      </div>

      {/* Demo checkout section */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-4'>Try It Out</h2>
        <CheckoutDemo />
      </div>

      {/* Available providers */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-4'>Available Providers</h2>
        <div className='grid gap-4 md:grid-cols-2'>
          {(Object.keys(providerInfo) as BillingProviderName[]).map((p) => (
            <ProviderCard key={p} provider={p} isActive={p === provider} />
          ))}
        </div>
      </div>

      {/* Configuration guide */}
      <ConfigurationGuide />
    </div>
  )
}
