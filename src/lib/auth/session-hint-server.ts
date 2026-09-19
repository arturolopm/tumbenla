import 'server-only'

import { env } from '@/config/env'
import { isProd } from '@/lib/constants'

/**
 * Cookie attributes for the session hint (see `session-hint.ts`).
 *
 * The scope mirrors the session cookie in `auth.ts` — same domain rule — so
 * the hint is visible exactly where the session is. NOT HttpOnly, on purpose:
 * the inline <head> script has to read it. Pass 0 to expire it.
 *
 * Kept apart from `session-hint.ts` because it needs the env schema, which
 * must never reach the browser.
 */
export const sessionHintCookieOptions = (maxAgeSeconds: number) => ({
  path: '/',
  sameSite: 'lax' as const,
  secure: isProd,
  httpOnly: false,
  maxAge: maxAgeSeconds,
  ...(isProd && env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
})
