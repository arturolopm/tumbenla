import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { getBaseUrl } from '../utils'

/**
 * Auth Client
 *
 * Core authentication client with email OTP support.
 *
 * For billing operations, use the useBilling() hook from '@/lib/billing/client'.
 * The billing client plugin is configured separately to maintain proper TypeScript types.
 *
 * @see lib/billing/client.ts for billing configuration
 * @see lib/billing/hooks.ts for billing React hooks
 */
/**
 * A DONDE LLAMA EL NAVEGADOR: a su propio origen, siempre.
 *
 * Aca vivia `getBaseUrl()`, y era un error. Esa funcion devuelve la URL
 * CANONICA —la de la rama en preview, la del dominio propio en produccion— y
 * queda incrustada en el bundle durante el build. Sirve para un enlace dentro
 * de un correo, que se abre desde afuera y necesita una direccion absoluta y
 * estable.
 *
 * Pero un despliegue de Vercel se sirve desde VARIAS direcciones a la vez: la
 * de la rama, la del despliegue suelto (`proyecto-7590aq1ux-...`) y la del
 * dominio propio. Si la pagina se abre por una y el fetch de la sesion sale
 * hacia otra, es una peticion entre origenes: el preflight no lleva
 * `Access-Control-Allow-Origin`, el navegador la corta antes de mandarla y lo
 * unico que queda es un `TypeError: Failed to fetch` sin ninguna pista.
 *
 * El origen actual es el unico valor que siempre coincide con la pagina que se
 * esta viendo. En el servidor no hay `window`, y ahi si toca la canonica.
 */
const urlDeLaApi = () =>
  typeof window !== 'undefined' ? window.location.origin : getBaseUrl()

export const client = createAuthClient({
  baseURL: urlDeLaApi(),
  plugins: [emailOTPClient()],
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
  },
})

export const { signIn, signUp, signOut, useSession } = client
