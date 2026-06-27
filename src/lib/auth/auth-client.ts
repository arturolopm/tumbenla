import { emailOTPClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { getBaseUrl } from '../utils'

/**
 * Auth Client
 *
 * Core authentication client with email OTP and organization support.
 *
 * For billing operations, use the useBilling() hook from '@/lib/billing/client'.
 * The billing client plugin is configured separately to maintain proper TypeScript types.
 *
 * @see lib/billing/client.ts for billing configuration
 * @see lib/billing/hooks.ts for billing React hooks
 */
export const client = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [emailOTPClient(), organizationClient()],
  fetchOptions: {
    onError(context) {
      const message =
        context.error?.message ||
        (typeof context.error?.status === 'number'
          ? `Request failed (${context.error.status})`
          : 'Authentication request failed')

      const code = context.error?.code?.toUpperCase() ?? ''
      const normalizedMessage = message.toLowerCase()
      const isDuplicateEmail =
        code.includes('USER_ALREADY_EXISTS') ||
        code.includes('EMAIL_ALREADY_EXISTS') ||
        normalizedMessage.includes('already exists') ||
        normalizedMessage.includes('use another email')

      if (isDuplicateEmail) {
        return
      }

      console.error('Auth error:', message, context.error)
    },
    onSuccess(data) {
      console.log('Auth action successful:', data)
    },
  },
})

export const { signIn, signUp, signOut, useSession } = client
