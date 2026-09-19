import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins'

import { db } from '@/database'
import { APP_COOKIE_NAME, isProd } from '@/lib/constants'
import { env } from '@/config/env'
import { getBaseUrl } from '@/lib/utils'
import { isEmailVerificationEnabled } from '@/config/feature-flags'
import { isIsolatedBrowserTest } from '@/lib/isolated-browser-test'
import { SESSION_HINT_COOKIE, buildSessionHint, serializeSessionHint } from './session-hint'
import { sessionHintCookieOptions } from './session-hint-server'

/**
 * The email stack, loaded on the first send instead of at boot.
 *
 * Every auth request boots this module, including the `get-session` that each
 * page view makes. Importing the mail providers (Resend and its svix, Postmark,
 * Nodemailer, Plunk) and React Email eagerly put all of them on that path for
 * requests that never send anything: measured, the auth route's cold boot goes
 * from 122 to 101 ms locally without them.
 */
const loadEmail = async () => {
  const [templates, messaging, mailer] = await Promise.all([
    import('@/components/emails'),
    import('@/lib/messaging/email'),
    import('@/lib/messaging/email/mailer'),
  ])
  return { templates, messaging, mailer }
}

/**
 * The body of what an endpoint returned, whichever way it was called.
 *
 * Over HTTP, better-call's `ctx.json(value)` wraps the value as
 * `{ body, _flag: 'json' }`; through `auth.api.*` it returns the value itself
 * (`node_modules/better-call/dist/context.mjs`, `json`). Comparing the raw
 * value with `null` would therefore never match a browser request.
 */
const returnedBody = (returned: unknown): unknown =>
  returned && typeof returned === 'object' && '_flag' in returned
    ? (returned as { body?: unknown }).body
    : returned

/**
 * Every address THIS deployment answers on.
 *
 * `getBaseUrl()` returns one, the canonical one, which is enough to write a
 * link inside an email. But Vercel serves the same deployment on several at
 * once — the custom domain, the branch URL and the standalone deployment URL,
 * `project-7590aq1ux-...` — and Better-Auth's origin check compares against the
 * address the browser opened the page on, not the canonical one. With only one
 * in the list, signing in from any other returns 403 "Invalid origin".
 *
 * The variables without a public prefix are set by Vercel at runtime and
 * describe this same deployment, so trusting them opens the door to nobody
 * else. A wildcard such as `*.vercel.app` is deliberately NOT used: it would
 * trust any site hosted on Vercel, which is exactly what the origin check
 * exists to prevent.
 */
const deploymentOrigins = (): string[] => {
  const candidates = [getBaseUrl(), env.VERCEL_URL?.trim(), env.VERCEL_BRANCH_URL?.trim()].filter(
    (value): value is string => Boolean(value)
  )

  // IN DEVELOPMENT, THE LOOPBACK AS WELL.
  //
  // Testing on a phone requires NEXT_PUBLIC_APP_URL to be the machine's network
  // IP, and at that point `localhost` drops out of the list: the Mac opens the
  // app on localhost, the origin check rejects it, and the result is a 403
  // INVALID_ORIGIN that reads on screen as "wrong email or password". It is
  // exactly the trap already documented in PRODUCT.md, and falling into it
  // costs half an hour of looking in the wrong place.
  //
  // That this is development ONLY is not a detail: in production, trusting
  // localhost would open the door to any page served from the visitor's own
  // machine.
  const loopback = isProd
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://0.0.0.0:3000']

  return [
    ...new Set(
      [...candidates, ...loopback].map((value) =>
        value.startsWith('http') ? value : `https://${value}`
      )
    ),
  ]
}

/** How long a session can last overall; the session hint lives exactly as long. */
export const SESSION_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  trustedOrigins: deploymentOrigins(),
  rateLimit: {
    enabled: !isIsolatedBrowserTest(),
  },

  /**
   * Server-side auth logging.
   *
   * WHY IT EXISTS: when signing in fails, the browser is the worst place to
   * find out why. Better-Auth answers with a deliberately vague
   * "Invalid email or password" — correct, because telling an attacker which
   * half was wrong hands them a way to enumerate accounts — and the client
   * error object serialises to `{}` in the console. So the person debugging
   * sees nothing at all.
   *
   * This puts the real reason on the SERVER, where only we read it. Verbose in
   * development; in production it stays at `error` so a login failure does not
   * write one line per attempt.
   *
   * It never logs the password, and never logs enough for the log itself to
   * become the leak the vague message exists to prevent.
   */
  logger: {
    disabled: false,
    level: isProd ? 'error' : 'debug',
    log: (level, message, ...args) => {
      const prefix = `[auth:${level}]`
      if (level === 'error') console.error(prefix, message, ...args)
      else if (level === 'warn') console.warn(prefix, message, ...args)
      else console.log(prefix, message, ...args)
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  advanced: {
    cookiePrefix: APP_COOKIE_NAME, // Change this to your cookie prefix
    // Only share cookies across subdomains when a domain is actually configured.
    // Hardcoding a domain here breaks sign-in on every other host.
    crossSubDomainCookies: {
      enabled: isProd && Boolean(env.COOKIE_DOMAIN),
      domain: env.COOKIE_DOMAIN,
    },
    useSecureCookies: isProd,
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 24 * 60 * 60, // 24 hours in seconds
    },
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: 24 * 60 * 60, // 24 hours (how often to refresh the expiry)
    freshAge: 60 * 60, // 1 hour (or set to 0 to disable completely)
  },

  /**
   * Keeps the session-hint cookie (`session-hint.ts`) in step with the
   * session, so the navbar paints the right state before hydration.
   *
   * - A new session writes it: sign-in by any method, sign-up, an OAuth
   *   callback, the auto sign-in after verifying an email. That is one venue
   *   query per sign-in, while the database is awake anyway.
   * - Signing out expires it, and so does a `get-session` that finds no session
   *   while a hint is still around. That is all this adds to `get-session`: no
   *   query, and nothing at all for visitors without a hint.
   *
   * The handler must return NOTHING: better-call takes an after-hook's return
   * value as the endpoint's response (`to-auth-endpoints.mjs`,
   * `runAfterHooks`), and `ctx.setCookie` returns the cookie string. And a
   * failure must never fail a sign-in: the hint is decoration, and
   * `/api/mi-acceso` rewrites it on the next page anyway.
   */
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const expireHint = () => {
        ctx.setCookie(SESSION_HINT_COOKIE, '', sessionHintCookieOptions(0))
      }

      if (ctx.path === '/sign-out') {
        expireHint()
        return
      }

      if (ctx.path === '/get-session') {
        if (returnedBody(ctx.context.returned) === null && ctx.getCookie(SESSION_HINT_COOKIE)) {
          expireHint()
        }
        return
      }

      const created = ctx.context.newSession
      if (!created) return

      try {
        // Imported here, not at the top: venue-access imports this file.
        const { listMyVenues } = await import('./venue-access')
        const venues = await listMyVenues(created.user.id)
        const hint = buildSessionHint(
          created.user,
          venues.map((venue) => ({ slug: venue.slug, name: venue.nombre }))
        )
        ctx.setCookie(
          SESSION_HINT_COOKIE,
          serializeSessionHint(hint),
          sessionHintCookieOptions(ctx.context.sessionConfig.expiresIn)
        )
      } catch (error) {
        console.error('[auth:session-hint] could not write the hint after sign-in', error)
      }
    }),
  },

  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          scope: ['email', 'profile'],
        },
      }),
    ...(env.GITHUB_CLIENT_ID &&
      env.GITHUB_CLIENT_SECRET && {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          scope: ['user:email'],
        },
      }),
    ...(env.MICROSOFT_CLIENT_ID &&
      env.MICROSOFT_CLIENT_SECRET && {
        microsoft: {
          clientId: env.MICROSOFT_CLIENT_ID,
          clientSecret: env.MICROSOFT_CLIENT_SECRET,
          tenantId: env.MICROSOFT_TENANT_ID || 'common',
        },
      }),
    ...(env.FACEBOOK_CLIENT_ID &&
      env.FACEBOOK_CLIENT_SECRET && {
        facebook: {
          clientId: env.FACEBOOK_CLIENT_ID,
          clientSecret: env.FACEBOOK_CLIENT_SECRET,
          scope: ['email', 'public_profile'],
        },
      }),
  },

  emailVerification: {
    autoSignInAfterVerification: true,
    afterEmailVerification: async (user) => {
      if (user.email) {
        try {
          const { templates, messaging } = await loadEmail()
          const html = await templates.renderWelcomeEmail(user.name || undefined)

          await messaging.sendEmail({
            to: user.email,
            subject: templates.getEmailSubject('welcome'),
            html,
            from: messaging.getFromEmailAddress(),
            emailType: 'transactional',
          })

          console.info('[emailVerification.afterEmailVerification] Welcome email sent', {
            userId: user.id,
          })
        } catch (error) {
          console.error('[emailVerification.afterEmailVerification] Failed to send welcome email', {
            userId: user.id,
            error,
          })
        }
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: isEmailVerificationEnabled,
    sendResetPassword: async ({ user, url }) => {
      const { templates, messaging } = await loadEmail()
      const username = user.name || ''

      const html = await templates.renderPasswordResetEmail(username, url)

      const result = await messaging.sendEmail({
        to: user.email,
        subject: templates.getEmailSubject('reset-password'),
        html,
        from: messaging.getFromEmailAddress(),
        emailType: 'transactional',
      })

      if (!result.success) {
        throw new Error(`Failed to send reset password email: ${result.message}`)
      }
    },
  },
  plugins: [
    nextCookies(),
    emailOTP({
      sendVerificationOTP: async (data: {
        email: string
        otp: string
        type: 'sign-in' | 'email-verification' | 'forget-password'
      }) => {
        try {
          if (!data.email) {
            throw new Error('Email is required')
          }

          const { templates, messaging, mailer } = await loadEmail()
          const validation = messaging.quickValidateEmail(data.email)
          if (!validation.isValid) {
            console.warn('Email validation failed', {
              email: data.email,
              reason: validation.reason,
              checks: validation.checks,
            })
            throw new Error(
              validation.reason ||
                "We are unable to deliver the verification email to that address. Please make sure it's valid and able to receive emails."
            )
          }

          const html = await templates.renderOTPEmail(data.otp, data.email, data.type)

          const result = await messaging.sendEmail({
            to: data.email,
            subject: templates.getEmailSubject(data.type),
            html,
            from: messaging.getFromEmailAddress(),
            emailType: 'transactional',
          })

          const otpWasLoggedOnly =
            mailer.getActiveProviderName() === 'log' ||
            result.message.toLowerCase().includes('logged')

          if (!isProd || otpWasLoggedOnly) {
            console.info('🔑 VERIFICATION CODE FOR LOGIN/SIGNUP', {
              email: data.email,
              otp: data.otp,
              type: data.type,
              provider: mailer.getActiveProviderName(),
              validation: validation.checks,
            })
          }

          if (!result.success && result.message.includes('no email service configured')) {
            return
          }

          if (!result.success) {
            throw new Error(`Failed to send verification code: ${result.message}`)
          }
        } catch (error) {
          console.error('Error sending verification code:', {
            error,
            email: data.email,
          })
          throw error
        }
      },
      sendVerificationOnSignUp: false,
      otpLength: 6, // Explicitly set the OTP length
      expiresIn: 15 * 60, // 15 minutes in seconds
    }),
    // The organization() plugin was removed on purpose: its `organization`,
    // `member` and `invitation` tables never existed in the schema, so every
    // call against that API failed at runtime. Re-enable it only together with
    // the tables (`npx @better-auth/cli generate`).
  ],

  pages: {
    signIn: '/login',
    signUp: '/register',
    // There is no /error route in this project. The home page is a better
    // destination than a route that does not exist, which Next would answer
    // with the not-found page anyway, only without anyone having decided so.
    error: '/',
    verify: '/verify',
  },
})
