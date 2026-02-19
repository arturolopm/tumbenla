import { Suspense } from 'react'
import PremiumPurchaseSuccessClient from './success-client'

export default function PremiumPurchaseSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950'>
          <div className='text-center space-y-3'>
            <div className='w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto' />
            <p className='text-muted-foreground font-medium'>Loading checkout details...</p>
          </div>
        </div>
      }
    >
      <PremiumPurchaseSuccessClient />
    </Suspense>
  )
}
