import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'

import { env } from '@/config/env'
import { db } from '@/database'
import { premiumPurchase } from '@/database/schema'

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
        const existingPurchases = await db
          .select()
          .from(premiumPurchase)
          .where(eq(premiumPurchase.stripeSessionId, session.id))
          .limit(1)
        const existingPurchase = existingPurchases[0] || null

        const amountPaid = session.amount_total ? (session.amount_total / 100).toString() : null
        const currency = session.currency?.toUpperCase() || null

        if (existingPurchase) {
          await db
            .update(premiumPurchase)
            .set({
              stripeCustomerEmail: session.customer_email || null,
              amountPaid: amountPaid,
              currency: currency,
              updatedAt: new Date(),
            })
            .where(eq(premiumPurchase.id, existingPurchase.id))
        } else {
          await db.insert(premiumPurchase).values({
            id: session.id,
            stripeSessionId: session.id,
            stripeCustomerEmail: session.customer_email || null,
            amountPaid: amountPaid,
            currency: currency,
          })
        }
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
