import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { env } from '@/config/env'

export async function POST(request: Request) {
  try {
    if (!env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Premium purchase not configured' }, { status: 500 })
    }

    const body = await request.text()
    const headerList = await headers()
    const signature = headerList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const stripe = new Stripe(env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })

    let event: Stripe.Event

    try {
      if (env.PREMIUM_PURCHASE_STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          env.PREMIUM_PURCHASE_STRIPE_WEBHOOK_SECRET
        )
      } else {
        console.warn('PREMIUM_PURCHASE_STRIPE_WEBHOOK_SECRET not set')
        event = JSON.parse(body) as Stripe.Event
      }
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.metadata?.type === 'premium_template_purchase') {
        console.log('Premium template purchase completed:', {
          sessionId: session.id,
          customerEmail: session.customer_email,
          amountTotal: session.amount_total,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Premium purchase webhook error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      },
      { status: 500 }
    )
  }
}
