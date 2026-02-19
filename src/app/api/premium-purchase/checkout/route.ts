import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { env } from '@/config/env'

export async function POST() {
  try {
    if (!env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Premium purchase not configured' }, { status: 500 })
    }

    if (!env.PREMIUM_PURCHASE_STRIPE_PRICE_ID) {
      return NextResponse.json({ error: 'Premium purchase price not configured' }, { status: 500 })
    }

    const stripe = new Stripe(env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })

    const baseUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: env.PREMIUM_PURCHASE_STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/premium-purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/premium-purchase/cancel`,
      metadata: {
        type: 'premium_template_purchase',
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Premium purchase checkout error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      },
      { status: 500 }
    )
  }
}
