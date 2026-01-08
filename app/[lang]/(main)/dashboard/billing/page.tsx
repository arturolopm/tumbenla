import type { Metadata } from 'next'
import { BillingDemo } from './billing-demo'

export const metadata: Metadata = {
  title: 'Billing Demo | ShipFree',
  description: 'Demo page showcasing the billing system integration',
}

export default function BillingDemoPage() {
  return (
    <div className='min-h-screen bg-background'>
      <BillingDemo />
    </div>
  )
}
