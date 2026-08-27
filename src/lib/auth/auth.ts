import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins'

import { db } from '@/database'
import { APP_COOKIE_NAME, isProd } from '@/lib/constants'
import { env } from '@/config/env'
import { getBaseUrl } from '@/lib/utils'
import {
  getEmailSubject,
  renderOTPEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from '@/components/emails'
import { getFromEmailAddress, quickValidateEmail, sendEmail } from '@/lib/messaging/email'
import { getActiveProviderName } from '@/lib/messaging/email/mailer'
import { isEmailVerificationEnabled } from '@/config/feature-flags'

/**
 * Todas las direcciones por las que ESTE despliegue responde.
 *
 * `getBaseUrl()` devuelve una sola, la canonica, y con eso basta para escribir
 * un enlace dentro de un correo. Pero Vercel sirve el mismo despliegue por
 * varias a la vez —la del dominio propio, la de la rama y la del despliegue
 * suelto, `proyecto-7590aq1ux-...`— y el chequeo de origen de Better-Auth
 * compara contra la direccion por la que el navegador abrio la pagina, no
 * contra la canonica. Con una sola en la lista, entrar desde cualquier otra
 * devuelve 403 "Invalid origin".
 *
 * Las variables sin prefijo publico las pone Vercel en tiempo de ejecucion y
 * describen este mismo despliegue, asi que confiar en ellas no le abre la
 * puerta a nadie mas. A proposito NO se usa un comodin tipo `*.vercel.app`:
 * eso confiaria en cualquier sitio alojado en Vercel, que es justo lo que el
 * chequeo de origen existe para impedir.
 */
const origenesPropios = (): string[] => {
  const candidatos = [
    getBaseUrl(),
    env.VERCEL_URL?.trim(),
    env.VERCEL_BRANCH_URL?.trim(),
  ].filter((valor): valor is string => Boolean(valor))

  return [
    ...new Set(
      candidatos.map((valor) => (valor.startsWith('http') ? valor : `https://${valor}`))
    ),
  ]
}

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  trustedOrigins: origenesPropios(),
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
    expiresIn: 30 * 24 * 60 * 60, // 30 days (how long a session can last overall)
    updateAge: 24 * 60 * 60, // 24 hours (how often to refresh the expiry)
    freshAge: 60 * 60, // 1 hour (or set to 0 to disable completely)
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
          const html = await renderWelcomeEmail(user.name || undefined)

          await sendEmail({
            to: user.email,
            subject: getEmailSubject('welcome'),
            html,
            from: getFromEmailAddress(),
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
      const username = user.name || ''

      const html = await renderPasswordResetEmail(username, url)

      const result = await sendEmail({
        to: user.email,
        subject: getEmailSubject('reset-password'),
        html,
        from: getFromEmailAddress(),
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

          const validation = quickValidateEmail(data.email)
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

          const html = await renderOTPEmail(data.otp, data.email, data.type)

          const result = await sendEmail({
            to: data.email,
            subject: getEmailSubject(data.type),
            html,
            from: getFromEmailAddress(),
            emailType: 'transactional',
          })

          const otpWasLoggedOnly =
            getActiveProviderName() === 'log' ||
            result.message.toLowerCase().includes('logged')

          if (!isProd || otpWasLoggedOnly) {
            console.info('🔑 VERIFICATION CODE FOR LOGIN/SIGNUP', {
              email: data.email,
              otp: data.otp,
              type: data.type,
              provider: getActiveProviderName(),
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
    // No hay ruta /error en este proyecto; el 404 de la app es mejor destino
    // que una ruta inexistente, que en Next devuelve el not-found igual pero
    // sin que nadie lo haya decidido.
    error: '/',
    verify: '/verify',
  },
})
