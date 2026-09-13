import { NextResponse } from 'next/server'

import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
): Promise<NextResponse> {
  const { attemptId } = await params
  const wantsAccount = new URL(request.url).searchParams.get('cuenta') === '1'

  try {
    const result = await createCommercePaymentService().checkoutLaunch(attemptId)
    if (result.kind === 'approved') {
      return NextResponse.json(
        {
          state: 'approved',
          nextUrl: `/orden/${result.orderToken}${wantsAccount ? '?cuenta=1' : ''}`,
        },
        { headers: { 'cache-control': 'no-store' } }
      )
    }
    if (result.kind === 'checkout') {
      return NextResponse.json(
        {
          state: 'checkout',
          nextUrl: `/pago/iniciar/${result.attemptId}${wantsAccount ? '?cuenta=1' : ''}`,
        },
        { headers: { 'cache-control': 'no-store' } }
      )
    }
    return NextResponse.json(
      { state: result.kind === 'rejected' ? 'rejected' : 'pending' },
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ state: 'pending' }, { headers: { 'cache-control': 'no-store' } })
  }
}
