import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

import { env } from '@/config/env'
import { db } from '@/database'
import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'
import { CommerceRecoveryService } from '@/lib/commerce/recovery-service'
import { CommerceUnitService } from '@/lib/commerce/unit-lifecycle-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const authenticated = (request: Request): boolean => {
  const expected = env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')
  if (!expected || !supplied?.startsWith('Bearer ')) return false
  const actual = supplied.slice('Bearer '.length)
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(actual)
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const result = await new CommerceRecoveryService({
    database: db,
    payments: createCommercePaymentService(),
    units: new CommerceUnitService({ database: db }),
  }).run()

  return NextResponse.json(
    {
      ...result,
      units: { ...result.units, retainedMinor: result.units.retainedMinor.toString() },
    },
    { status: result.status === 'completed_with_errors' ? 503 : 200 }
  )
}
