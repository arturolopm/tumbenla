import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { getBaseUrl } from '../utils'

export const client = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [emailOTPClient()],
  fetchOptions: {
    onError(error) {
      console.error('Auth error:', error)
    },
    onSuccess(data) {
      console.log('Auth action successful:', data)
    },
  },
})

export const { signIn, signUp, signOut, useSession } = client
