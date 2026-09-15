import { NextResponse } from 'next/server'

import type { PaymentReconciliationResult } from '@/lib/commerce/payment-service'
import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'
import { getBaseUrl } from '@/lib/utils/urls'

export const dynamic = 'force-dynamic'

const appUrl = (path: string): URL => new URL(path, getBaseUrl())

const destination = (result: PaymentReconciliationResult): URL => {
  if (result.attemptId) return appUrl(`/pago/estado/${result.attemptId}`)
  return appUrl('/pago/resultado?estado=pendiente')
}

const reconcile = async (reference: string | undefined): Promise<NextResponse> => {
  if (!reference) {
    return NextResponse.redirect(appUrl('/pago/resultado?estado=invalido'), 303)
  }
  try {
    const result = await createCommercePaymentService().reconcileReference({
      provider: 'epayco',
      reference,
    })
    return NextResponse.redirect(destination(result), 303)
  } catch {
    return NextResponse.redirect(appUrl('/pago/resultado?estado=pendiente'), 303)
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const search = new URL(request.url).searchParams
  const references = [...search.getAll('ref_payco'), ...search.getAll('x_ref_payco')]
  return reconcile(references.length === 1 ? references[0] : undefined)
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const form = await request.formData()
    const references = [...form.getAll('ref_payco'), ...form.getAll('x_ref_payco')].filter(
      (value): value is string => typeof value === 'string'
    )
    return reconcile(references.length === 1 ? references[0] : undefined)
  } catch {
    return reconcile(undefined)
  }
}
