'use server'

import { z } from 'zod'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { env } from '@/config/env'
import { db } from '@/database'
import { premiumPurchase } from '@/database/schema'
import { quickValidateEmail } from '@/lib/messaging/email/validation'

const communityInfoSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  githubEmail: z.email().min(1, 'GitHub email is required'),
  githubUsername: z
    .string()
    .min(1, 'GitHub username is required')
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/, {
      message:
        'GitHub username must be 1-39 characters and can only contain alphanumeric characters and hyphens',
    }),
  twitterHandle: z
    .string()
    .min(1, 'Twitter handle is required')
    .regex(/^[a-zA-Z0-9_]{1,15}$/, {
      message:
        'Twitter handle must be 1-15 characters and can only contain letters, numbers, and underscores',
    }),
})

type CommunityInfoState = {
  success: boolean
  message?: string
  errors?: {
    sessionId?: string[]
    githubEmail?: string[]
    githubUsername?: string[]
    twitterHandle?: string[]
    _form?: string[]
  }
}

export async function saveCommunityInfo(
  prevState: CommunityInfoState | null,
  formData: FormData
): Promise<CommunityInfoState> {
  try {
    const rawData = {
      sessionId: formData.get('sessionId')?.toString() || '',
      githubEmail: formData.get('githubEmail')?.toString() || '',
      githubUsername: formData.get('githubUsername')?.toString() || '',
      twitterHandle: formData.get('twitterHandle')?.toString().replace(/^@+/, '') || '',
    }

    const validationResult = communityInfoSchema.safeParse(rawData)

    if (!validationResult.success) {
      return {
        success: false,
        errors: validationResult.error.flatten().fieldErrors,
      }
    }

    const { sessionId, githubEmail, githubUsername, twitterHandle } = validationResult.data

    const emailValidation = quickValidateEmail(githubEmail.trim().toLowerCase())
    if (!emailValidation.isValid) {
      return {
        success: false,
        errors: {
          githubEmail: [emailValidation.reason || 'Please enter a valid email address'],
        },
      }
    }

    if (!env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY) {
      return {
        success: false,
        errors: {
          _form: ['Premium purchase is not configured'],
        },
      }
    }

    const stripe = new Stripe(env.PREMIUM_PURCHASE_STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      })
    } catch (error) {
      return {
        success: false,
        errors: {
          _form: ['Invalid session ID'],
        },
      }
    }

    if (session.metadata?.type !== 'premium_template_purchase') {
      return {
        success: false,
        errors: {
          _form: ['Invalid session type'],
        },
      }
    }

    if (session.payment_status !== 'paid') {
      return {
        success: false,
        errors: {
          _form: ['Payment not completed'],
        },
      }
    }

    const existingPurchases = await db
      .select()
      .from(premiumPurchase)
      .where(eq(premiumPurchase.stripeSessionId, sessionId))
      .limit(1)
    const existingPurchase = existingPurchases[0] || null

    const amountPaid = session.amount_total ? (session.amount_total / 100).toString() : null
    const currency = session.currency?.toUpperCase() || null

    if (existingPurchase) {
      await db
        .update(premiumPurchase)
        .set({
          githubEmail: githubEmail.trim().toLowerCase(),
          githubUsername: githubUsername.trim(),
          twitterHandle: twitterHandle.trim(),
          stripeCustomerEmail: session.customer_email || existingPurchase.stripeCustomerEmail,
          amountPaid: amountPaid || existingPurchase.amountPaid,
          currency: currency || existingPurchase.currency,
          updatedAt: new Date(),
        })
        .where(eq(premiumPurchase.id, existingPurchase.id))
    } else {
      await db.insert(premiumPurchase).values({
        id: sessionId,
        stripeSessionId: sessionId,
        stripeCustomerEmail: session.customer_email || null,
        githubEmail: githubEmail.trim().toLowerCase(),
        githubUsername: githubUsername.trim(),
        twitterHandle: twitterHandle.trim(),
        amountPaid: amountPaid,
        currency: currency,
      })
    }

    return {
      success: true,
      message: 'Community information saved successfully!',
    }
  } catch (error) {
    console.error('Error saving community info:', error)
    return {
      success: false,
      errors: {
        _form: ['An error occurred while saving your information. Please try again.'],
      },
    }
  }
}
