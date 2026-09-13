import { NextResponse } from 'next/server'

import type { PaymentReconciliationResult } from '@/lib/commerce/payment-service'
import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'

export const dynamic = 'force-dynamic'

const destination = (request: Request, result: PaymentReconciliationResult): URL => {
  if (result.attemptId) return new URL(`/pago/estado/${result.attemptId}`, request.url)
  return new URL('/pago/resultado?estado=pendiente', request.url)
}

const reconcile = async (
  request: Request,
  reference: string | undefined
): Promise<NextResponse> => {
  if (!reference) {
    return NextResponse.redirect(new URL('/pago/resultado?estado=invalido', request.url), 303)
  }
  try {
    const result = await createCommercePaymentService().reconcileReference({
      provider: 'epayco',
      reference,
    })
    return NextResponse.redirect(destination(request, result), 303)
  } catch {
    return NextResponse.redirect(new URL('/pago/resultado?estado=pendiente', request.url), 303)
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const search = new URL(request.url).searchParams
  const references = [...search.getAll('ref_payco'), ...search.getAll('x_ref_payco')]
  return reconcile(request, references.length === 1 ? references[0] : undefined)
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const form = await request.formData()
    const references = [...form.getAll('ref_payco'), ...form.getAll('x_ref_payco')].filter(
      (value): value is string => typeof value === 'string'
    )
    return reconcile(request, references.length === 1 ? references[0] : undefined)
  } catch {
    return reconcile(request, undefined)
  }
}
