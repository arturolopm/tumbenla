'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function PremiumPurchaseCancel() {
  const router = useRouter()

  return (
    <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4'>
      <div className='max-w-md w-full'>
        <div className='bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl p-10 text-center shadow-2xl shadow-black/5 dark:shadow-black/20 opacity-0 animate-[fadeIn_0.7s_ease-out_0.1s_forwards,slideUp_0.7s_ease-out_0.1s_forwards]'>
          <div className='mb-8'>
            <div className='relative inline-block mb-6'>
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='w-32 h-32 bg-linear-to-br from-muted/30 via-muted/20 to-transparent rounded-full blur-2xl' />
              </div>
              <div className='relative w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto shadow-lg'>
                <XCircle className='w-10 h-10 text-muted-foreground' strokeWidth={2} />
              </div>
            </div>
            <h1 className='text-3xl font-bold mb-3 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'>
              Payment Canceled
            </h1>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              Your payment was canceled. No charges were made. You can return anytime to complete
              your purchase.
            </p>
          </div>
          <div className='space-y-3'>
            <Button
              className='w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300'
              size='lg'
              onClick={() => router.push('/#pricing')}
            >
              Return to Pricing
            </Button>
            <Button
              variant='outline'
              className='w-full h-12 text-base'
              onClick={() => router.push('/')}
            >
              Go to Homepage
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
