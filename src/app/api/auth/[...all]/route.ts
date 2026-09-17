import { eq } from 'drizzle-orm'
import { toNextJsHandler } from 'better-auth/next-js'

import { db } from '@/database'
import { account, user } from '@/database/schema'
import { auth } from '@/lib/auth/auth'
import { isProd } from '@/lib/constants'

const handlers = toNextJsHandler(auth)

export const GET = handlers.GET

/**
 * Sign-in diagnostics, on the SERVER and only in development.
 *
 * WHY: when signing in fails, the browser is the worst place to find out why.
 * Better-Auth answers with a deliberately vague "Invalid email or password" —
 * which is correct, because saying which half was wrong lets an attacker
 * enumerate accounts — and the client-side error object serialises to `{}` in
 * the console, so whoever is debugging sees nothing at all.
 *
 * This prints the part the vague message hides: whether the account exists,
 * whether it is verified, whether it even has a password set. Enough to tell
 * "wrong password" apart from "that account was never created" or "the seed
 * ran against a database that has since been reset".
 *
 * It never touches the password, and it is gated on development: in production
 * this would be exactly the account-enumeration oracle the vague message
 * exists to prevent.
 */
export async function POST(request: Request) {
  if (isProd) return handlers.POST(request)

  const url = new URL(request.url)
  const isSignIn = url.pathname.endsWith('/sign-in/email')

  // The body can only be read once, so sign-in gets a clone and everything
  // else is passed straight through untouched.
  let email: string | null = null
  if (isSignIn) {
    try {
      const body = await request.clone().json()
      email = typeof body?.email === 'string' ? body.email : null
    } catch {
      // Not JSON: let Better-Auth answer for it.
    }
  }

  const response = await handlers.POST(request)

  if (isSignIn && email && response.status >= 400) {
    // WHAT KIND of failure this is, before saying anything about it.
    //
    // The first version of this assumed any 4xx on sign-in was a credentials
    // problem, so an INVALID_ORIGIN 403 got reported as "the password does not
    // match" — sending whoever read it to debug the wrong thing entirely. That
    // is the same lie the client message used to tell, reproduced in the log
    // that exists to correct it.
    let code = ''
    try {
      code = (await response.clone().json())?.code ?? ''
    } catch {
      // Not JSON; fall through to the account checks.
    }

    if (code && code !== 'INVALID_EMAIL_OR_PASSWORD' && code !== 'INVALID_EMAIL') {
      console.warn(
        `[auth:signin] FALLO — ${code} (HTTP ${response.status}). ` +
          'No es un problema de credenciales; mira la linea [auth:error] de arriba.'
      )
      return response
    }

    const normalised = email.trim().toLowerCase()
    const [found] = await db
      .select({ id: user.id, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, normalised))
      .limit(1)

    if (!found) {
      console.warn(
        `[auth:signin] FALLO — no existe ninguna cuenta con "${normalised}"` +
          (normalised !== email ? ` (llego como "${email}")` : '') +
          '. Si esperabas que existiera: bun run seed:cuentas'
      )
    } else {
      const [credentials] = await db
        .select({ hasPassword: account.password })
        .from(account)
        .where(eq(account.userId, found.id))
        .limit(1)

      if (!credentials?.hasPassword) {
        console.warn(
          `[auth:signin] FALLO — "${normalised}" existe pero NO tiene contraseña ` +
            '(se creo por OAuth, o el seed no la escribio).'
        )
      } else if (!found.emailVerified) {
        console.warn(
          `[auth:signin] FALLO — "${normalised}" existe pero el correo NO esta verificado.`
        )
      } else {
        console.warn(
          `[auth:signin] FALLO — "${normalised}" existe, verificado y con contraseña: ` +
            'entonces la contraseña enviada no coincide.'
        )
      }
    }
  }

  return response
}
