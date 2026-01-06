/**
 * Resend Email Provider
 *
 * Modern email API for developers.
 * https://resend.com
 *
 * To use this provider:
 * 1. Install: bun add resend
 * 2. Set environment variables:
 *    - RESEND_API_KEY: Your Resend API key
 *    - RESEND_DOMAIN: Your verified domain (optional, for default from address)
 * 3. Set EMAIL_PROVIDER=resend in your .env
 *
 * To remove this provider if not needed:
 * 1. Delete this file
 * 2. Remove resend from package.json
 * 3. Remove RESEND_* from your .env
 */

import { Resend } from 'resend'

import { env } from '@/config/env'
import type {
  EmailOptions,
  EmailProvider,
  ProcessedEmailData,
  SendEmailResult,
  BatchSendEmailResult,
} from '../types'
import { getFromEmailAddress, hasNonEmpty } from '../utils'

let client: Resend | null = null

function getClient(): Resend | null {
  if (client) return client

  const apiKey = env.RESEND_API_KEY
  if (!hasNonEmpty(apiKey)) return null

  client = new Resend(apiKey)
  return client
}

async function send(data: ProcessedEmailData): Promise<SendEmailResult> {
  const resend = getClient()
  if (!resend) {
    throw new Error('Resend not configured')
  }

  // Build email data with required fields
  const emailData: {
    from: string
    to: string | string[]
    subject: string
    html?: string
    text?: string
    replyTo?: string
    headers?: Record<string, string>
    attachments?: Array<{
      filename: string
      content: string
      contentType: string
    }>
  } = {
    from: data.senderEmail,
    to: data.to,
    subject: data.subject,
  }

  if (data.html) emailData.html = data.html
  if (data.text) emailData.text = data.text
  if (data.replyTo) emailData.replyTo = data.replyTo
  if (Object.keys(data.headers).length > 0) emailData.headers = data.headers
  if (data.attachments) {
    emailData.attachments = data.attachments.map((att) => ({
      filename: att.filename,
      content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
      contentType: att.contentType,
    }))
  }

  const { data: responseData, error } = await resend.emails.send(emailData)

  if (error) {
    throw new Error(error.message || 'Failed to send email via Resend')
  }

  return {
    success: true,
    message: 'Email sent successfully via Resend',
    data: responseData,
  }
}

interface BatchEmailData {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
}

async function sendBatch(emails: EmailOptions[]): Promise<BatchSendEmailResult> {
  const resend = getClient()
  if (!resend) {
    throw new Error('Resend not configured')
  }

  if (emails.length === 0) {
    return {
      success: true,
      message: 'No emails to send',
      results: [],
      data: { count: 0 },
    }
  }

  const batchEmails: BatchEmailData[] = emails.map((email) => {
    const senderEmail = email.from || getFromEmailAddress()
    const emailData: BatchEmailData = {
      from: senderEmail,
      to: email.to,
      subject: email.subject,
    }

    if (email.html) emailData.html = email.html
    if (email.text) emailData.text = email.text

    return emailData
  })

  // Cast to expected type - Resend requires html/text/template but our types are compatible
  const response = await resend.batch.send(batchEmails as Parameters<typeof resend.batch.send>[0])

  if (response.error) {
    throw new Error(response.error.message || 'Resend batch API error')
  }

  const results: SendEmailResult[] = batchEmails.map((_, index) => ({
    success: true,
    message: 'Email sent successfully via Resend batch',
    data: { id: `batch-${index}` },
  }))

  return {
    success: true,
    message: 'All batch emails sent successfully via Resend',
    results,
    data: { count: batchEmails.length },
  }
}

/**
 * Create the Resend email provider.
 * Returns null if not configured.
 */
export function createResendProvider(): EmailProvider | null {
  if (!getClient()) return null

  return {
    name: 'resend',
    send,
    sendBatch,
  }
}
