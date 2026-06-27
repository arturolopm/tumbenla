import { NextResponse } from 'next/server'

import { clearUnverifiedUserByEmail } from '@/lib/auth/unverified-signup'

export async function POST(request: Request) {
  let body: { email?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const result = await clearUnverifiedUserByEmail(email)

  return NextResponse.json({
    result,
    canResume: result === 'deleted' || result === 'not_found',
  })
}
