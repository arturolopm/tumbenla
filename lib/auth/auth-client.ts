import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { getBaseUrl } from '../utils'

export const client = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [emailOTPClient()],
})

export const { signIn, signUp, signOut } = client
