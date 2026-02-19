import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { env } from '@/config/env'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    if (!env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Premium purchase not configured' }, { status: 500 })
    }

    const stripe = new Stripe(env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    })

    if (session.metadata?.type !== 'premium_template_purchase') {
      return NextResponse.json({ error: 'Invalid session type' }, { status: 400 })
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email || null,
    })
  } catch (error) {
    console.error('Premium purchase verification error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to verify session',
      },
      { status: 500 }
    )
  }
}
