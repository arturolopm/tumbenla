import 'server-only'

import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { env } from '@/config/env'
import { auth } from './auth'

/**
 * Operator access to /admin.
 *
 * An env allowlist rather than a role column: this product has no public account
 * feature, so a handful of operator emails is the whole authorization model.
 *
 * Do NOT re-export any of this from src/lib/auth/index.ts. That barrel already
 * re-exports auth-client.ts, which carries 'use client'. Import from
 * '@/lib/auth/admin' directly.
 */

const parseAllowlist = () =>
  env.ADMIN_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

/**
 * Fails closed in both directions.
 *
 * An empty allowlist grants nobody, rather than everybody. The opposite is the
 * classic misconfiguration that hands over the CMS on the first deploy where
 * someone forgot to set the variable.
 *
 * The verified-email requirement is not decoration. This matches on the session
 * email while /register is reachable, so without it anyone who learns an
 * operator's address could register with it first and inherit the admin panel,
 * then publish fake venues and fake receipts in the one product whose entire
 * currency is trust.
 */
export const isAdminEmail = (email?: string | null, emailVerified?: boolean | null) => {
  if (!email || !emailVerified) return false

  const allowlist = parseAllowlist()
  if (allowlist.length === 0) return false

  return allowlist.includes(email.trim().toLowerCase())
}

/**
 * For layouts, pages and route handlers. Never returns to a non-admin: it
 * throws via redirect() or notFound().
 *
 * A logged-in non-admin gets a 404 rather than a redirect, so the admin surface
 * does not announce that it exists.
 */
export const requireAdmin = async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect('/login?redirectAfter=/admin')
  if (!isAdminEmail(session.user.email, session.user.emailVerified)) notFound()

  return session
}

export type AdminCheck =
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string }

/**
 * For server actions, which must never throw. Mirrors the discriminated-result
 * contract in src/app/actions/premium-purchase.ts.
 *
 * A layout gate does not protect server actions. They are independently
 * addressable POST endpoints, so every one of them has to call this itself.
 */
export const assertAdmin = async (): Promise<AdminCheck> => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return { ok: false, error: 'No has iniciado sesion.' }
  }

  if (!session.user.emailVerified) {
    return { ok: false, error: 'Tu correo no esta verificado.' }
  }

  if (!isAdminEmail(session.user.email, session.user.emailVerified)) {
    return { ok: false, error: 'No tienes permiso para hacer esto.' }
  }

  return { ok: true, userId: session.user.id, email: session.user.email }
}
