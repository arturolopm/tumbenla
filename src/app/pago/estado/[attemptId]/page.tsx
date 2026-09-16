import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PaymentStateWatcher } from '@/components/comercio/payment-state-watcher'
import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Estado del pago',
  robots: { index: false, follow: false },
}

export default async function PaymentStatePage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>
  searchParams: Promise<{ cuenta?: string }>
}) {
  const { attemptId } = await params
  const { cuenta } = await searchParams
  const wantsAccount = cuenta === '1'
  const state = await createCommercePaymentService().checkoutLaunch(attemptId)

  if (state.kind === 'approved') {
    return (
      <PaymentStateWatcher
        attemptId={attemptId}
        wantsAccount={wantsAccount}
        initialState={{ state: 'approved', nextUrl: `/orden/${state.orderToken}` }}
      />
    )
  }
  if (state.kind === 'checkout') {
    redirect(`/pago/iniciar/${state.attemptId}${wantsAccount ? '?cuenta=1' : ''}`)
  }
  if (state.kind === 'checkout-unavailable') {
    return (
      <PaymentStateWatcher
        attemptId={attemptId}
        wantsAccount={wantsAccount}
        initialState={{
          state: 'checkout-unavailable',
          nextUrl: state.retryUrl,
          reason: state.reason,
        }}
      />
    )
  }

  return (
    <PaymentStateWatcher
      attemptId={attemptId}
      wantsAccount={wantsAccount}
      initialState={state.kind === 'rejected' ? { state: 'rejected' } : undefined}
    />
  )
}
