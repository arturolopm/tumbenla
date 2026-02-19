'use client'

import { BiSolidZap } from 'react-icons/bi'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { usePremiumCheckout } from '@/lib/premium-purchase/hooks'
import { cn } from '@/lib/utils'

export function PremiumButton({ className }: { className?: string }) {
  const { checkout, isLoading, error } = usePremiumCheckout()

  const handleCheckout = async () => {
    try {
      await checkout()
    } catch (err) {
      console.error('Checkout error:', err)
      alert(err instanceof Error ? err.message : 'Failed to start checkout')
    }
  }

  return (
    <Button
      className={cn('h-12! px-8 text-base font-semibold group', className)}
      size='lg'
      onClick={handleCheckout}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Spinner className='h-5 w-5 mr-2' />
        </>
      ) : (
        <>
          <BiSolidZap className='h-5 w-5 mr-2 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12' />
        </>
      )}
      <span>Get ShipFree</span>
    </Button>
  )
}
