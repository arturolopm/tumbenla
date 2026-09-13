import { NextResponse } from 'next/server'

import {
  NotificationRequestError,
  parseNotificationRequest,
} from '@/lib/commerce/notification-request'
import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  let fields
  try {
    fields = await parseNotificationRequest(request)
  } catch (error) {
    const status = error instanceof NotificationRequestError ? error.status : 400
    return NextResponse.json({ accepted: false }, { status })
  }

  try {
    const outcome = await createCommercePaymentService().processNotification('epayco', fields)
    if (outcome.retryable) {
      return NextResponse.json({ accepted: false, retryable: true }, { status: 503 })
    }
    return NextResponse.json(
      { accepted: outcome.accepted, duplicate: outcome.duplicate },
      { status: outcome.accepted ? 200 : 400 }
    )
  } catch {
    return NextResponse.json({ accepted: false, retryable: true }, { status: 503 })
  }
}
