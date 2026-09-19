import { type APIRequestContext, request as playwrightRequest } from '@playwright/test'

export const BASE_URL = 'http://127.0.0.1:3107'
export const PASSWORD = 'Prueba-2026-tumbenla'

export type AuthState = Awaited<ReturnType<APIRequestContext['storageState']>>

/**
 * Signs in a seeded local test account through the real API (not a stored
 * storageState fixture), so the returned cookies are exactly what a browser
 * gets from a real sign-in response — the session cookie, and the
 * `tumbenla.session_hint` cookie the auth hook sets alongside it.
 */
export const authenticate = async (email: string, clientAddress: string): Promise<AuthState> => {
  const request = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'x-forwarded-for': clientAddress },
  })

  try {
    const response = await request.post('/api/auth/sign-in/email', {
      data: { email, password: PASSWORD, callbackURL: '/' },
    })
    if (!response.ok()) {
      throw new Error(
        `Sign-in for ${email} returned ${response.status()}: ${await response.text()}`
      )
    }
    return request.storageState()
  } finally {
    await request.dispose()
  }
}
