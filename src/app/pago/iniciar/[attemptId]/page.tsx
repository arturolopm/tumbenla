import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { EpaycoCheckoutLauncher } from '@/components/comercio/epayco-checkout-launcher'
import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pago seguro',
  robots: { index: false, follow: false },
}

export default async function StartPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>
  searchParams: Promise<{ cuenta?: string }>
}) {
  const { attemptId } = await params
  const { cuenta } = await searchParams
  const wantsAccount = cuenta === '1'
  const result = await createCommercePaymentService().checkoutLaunch(attemptId)

  if (result.kind === 'approved') {
    redirect(`/orden/${result.orderToken}${wantsAccount ? '?cuenta=1' : ''}`)
  }
  if (result.kind === 'pending') {
    redirect(`/pago/estado/${result.attemptId}${wantsAccount ? '?cuenta=1' : ''}`)
  }
  if (result.kind === 'checkout') {
    return (
      <EpaycoCheckoutLauncher
        attemptId={result.attemptId}
        sessionId={result.launch.sessionId}
        scriptUrl={result.launch.scriptUrl}
        testMode={result.launch.testMode}
        wantsAccount={wantsAccount}
      />
    )
  }

  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-margin-mobile py-10'>
      <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
        No pudimos abrir el pago
      </h1>
      <p className='text-body-lg text-muted-foreground'>
        No creamos otro cobro automáticamente. Vuelve a la carta para iniciar un pedido nuevo.
      </p>
      <Link
        href='/sitios'
        className='rounded-xl bg-primary px-6 py-4 text-center font-display text-label-lg text-primary-foreground uppercase'
      >
        Ver sitios
      </Link>
    </main>
  )
}
