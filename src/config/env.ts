import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // Core Database and Authentication
    // Requerida, no opcional. Con .optional() una variable ausente pasaba la
    // validacion y la app moria despues, adentro de una consulta: en Vercel eso
    // es un deploy verde que falla en la primera visita. emptyStringAsUndefined
    // ya esta activo, asi que una variable vacia tambien cuenta como ausente.
    //
    // La URL DIRECTA de Neon no va aca: este es el entorno de la app, se valida
    // al importarse, y la app nunca la necesita. Solo la usan el migrador y
    // drizzle-kit, que corren fuera de Next.
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    BETTER_AUTH_SECRET: z.string().default('dev-secret-change-in-production'),
    BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
    // Strings, not z.boolean(). Everything in process.env arrives as a string,
    // so z.boolean() rejected any value at all and setting the flag crashed the
    // app at boot. isTruthy() below does the coercion.
    BILLING_ENABLED: z.string().optional(),

    // Apex domain for sharing the session cookie across subdomains, e.g. '.tumbenla.com'.
    // Left unset, cross-subdomain cookies stay off, which is correct for a single host.
    COOKIE_DOMAIN: z.string().optional(),

    EMAIL_VERIFICATION_ENABLED: z.string().optional(),

    // Comma-separated emails allowed into /admin.
    // Fails closed: unset or empty means nobody is an admin. Admin access also
    // requires a verified email, so keep EMAIL_VERIFICATION_ENABLED on wherever
    // this is set.
    ADMIN_EMAILS: z.string().default(''),

    // Optional: Sentry
    SENTRY_DSN: z.string().optional(),

    // Optional: Cloudflare R2
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_URL: z.string().optional(),
    R2_STORAGE_BASE_URL: z.string().optional(),
    R2_PUBLIC_BUCKET: z.string().optional(),
    R2_PRIVATE_BUCKET: z.string().optional(),

    // Optional: Email providers
    // Left optional on purpose: when unset, the mailer picks the provider from
    // NODE_ENV (production -> resend, otherwise -> the local Mailpit container).
    // Setting it forces one provider regardless of environment.
    EMAIL_PROVIDER: z
      .enum(['resend', 'postmark', 'nodemailer', 'plunk', 'custom', 'log'])
      .optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_DOMAIN: z.string().optional(),
    POSTMARK_API_TOKEN: z.string().optional(),
    PLUNK_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z.string().optional(),
    DEFAULT_FROM_EMAIL: z.string().optional(),
    /**
     * A donde van las respuestas.
     *
     * Es OTRA direccion que DEFAULT_FROM_EMAIL y tiene que serlo: se envia
     * desde el subdominio verificado en Resend (send.tumbenla.com), que no
     * recibe nada, y se responde al buzon real del dominio principal. Sin esto,
     * el correo de rechazo de una solicitud dice "respondenos a este correo" y
     * la respuesta cae en un buzon que no existe.
     */
    DEFAULT_REPLY_TO: z.string().optional(),
    DEFAULT_FROM_NAME: z.string().optional(),

    // Optional: Payment provider selection
    PAYMENT_PROVIDER: z.enum(['stripe', 'polar', 'lemonsqueezy', 'creem']).default('stripe'),

    // Stripe
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID: z.string().optional(),

    // Polar
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
    POLAR_ORGANIZATION_ID: z.string().optional(),
    POLAR_PRODUCT_ID: z.string().optional(),
    POLAR_ENVIRONMENT: z.enum(['production', 'sandbox']).default('production'),

    // Lemon Squeezy
    LEMONSQUEEZY_API_KEY: z.string().optional(),
    LEMONSQUEEZY_STORE_ID: z.string().optional(),
    LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),

    // Creem (https://creem.io) - EU-based Merchant of Record
    CREEM_API_KEY: z.string().optional(),
    CREEM_WEBHOOK_SECRET: z.string().optional(),
    // Creem ships separate test/production API keys; set this to use test-api.creem.io
    CREEM_TEST_MODE: z.string().optional(),

    // Optional: OAuth
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_TENANT_ID: z.string().optional(),
    FACEBOOK_CLIENT_ID: z.string().optional(),
    FACEBOOK_CLIENT_SECRET: z.string().optional(),
  },

  client: {
    // SIN .default(). Antes traia 'http://localhost:3000', y ese default era
    // justo lo que hacia silencioso el error: si faltaba en el despliegue, la
    // app salia verde y todos los enlaces de correo y los callbacks de sesion
    // apuntaban a localhost. Ahora, cuando no esta, getBaseUrl() la deduce de
    // las variables de sistema de Vercel y en produccion lanza si no hay nada.
    //
    // Sigue mandando sobre todo lo demas: el dia que exista el dominio propio,
    // se pone aca y gana.
    NEXT_PUBLIC_APP_URL: z.string().optional(),

    // Variables de sistema de Vercel, con el prefijo que las expone al
    // navegador. Las pone Vercel solo mientras "Enable access to System
    // Environment Variables" este activo (viene activo). En local no existen.
    NEXT_PUBLIC_VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    // El dominio de produccion del proyecto: el dominio propio mas corto, o el
    // de vercel.app si todavia no hay ninguno. Esto es lo que hace que pasar a
    // un dominio propio no requiera tocar codigo ni variables.
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    // URL estable de la rama, no la del despliegue suelto: sobrevive al
    // siguiente push, asi que los enlaces de un correo viejo siguen sirviendo.
    NEXT_PUBLIC_VERCEL_BRANCH_URL: z.string().optional(),
    NEXT_PUBLIC_VERCEL_URL: z.string().optional(),
    // Lemon Squeezy product IDs (public)
    NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_STARTER_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_PRO_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_ENTERPRISE_MONTHLY: z.string().optional(),

    // Stripe price IDs (public)
    NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().optional(),

    // Polar product IDs (public)
    NEXT_PUBLIC_POLAR_PRODUCT_STARTER_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_POLAR_PRODUCT_PRO_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_POLAR_PRODUCT_ENTERPRISE_MONTHLY: z.string().optional(),

    // Creem product IDs (public)
    NEXT_PUBLIC_CREEM_PRODUCT_STARTER_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_CREEM_PRODUCT_PRO_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_CREEM_PRODUCT_ENTERPRISE_MONTHLY: z.string().optional(),
  },

  // Variables available on both server and client
  shared: {
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(), // Runtime environment
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BILLING_ENABLED: process.env.BILLING_ENABLED,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    EMAIL_VERIFICATION_ENABLED: process.env.EMAIL_VERIFICATION_ENABLED,
    SENTRY_DSN: process.env.SENTRY_DSN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_URL: process.env.R2_BUCKET_URL,
    R2_STORAGE_BASE_URL: process.env.R2_STORAGE_BASE_URL,
    R2_PUBLIC_BUCKET: process.env.R2_PUBLIC_BUCKET,
    R2_PRIVATE_BUCKET: process.env.R2_PRIVATE_BUCKET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_DOMAIN: process.env.RESEND_DOMAIN,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    POSTMARK_API_TOKEN: process.env.POSTMARK_API_TOKEN,
    PLUNK_API_KEY: process.env.PLUNK_API_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_SECURE: process.env.SMTP_SECURE,
    DEFAULT_FROM_EMAIL: process.env.DEFAULT_FROM_EMAIL,
    DEFAULT_REPLY_TO: process.env.DEFAULT_REPLY_TO,
    DEFAULT_FROM_NAME: process.env.DEFAULT_FROM_NAME,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
    MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID,
    FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID,
    FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
    POLAR_ORGANIZATION_ID: process.env.POLAR_ORGANIZATION_ID,
    POLAR_PRODUCT_ID: process.env.POLAR_PRODUCT_ID,
    POLAR_ENVIRONMENT: process.env.POLAR_ENVIRONMENT,
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY,
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID,
    LEMONSQUEEZY_WEBHOOK_SECRET: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    CREEM_API_KEY: process.env.CREEM_API_KEY,
    CREEM_WEBHOOK_SECRET: process.env.CREEM_WEBHOOK_SECRET,
    CREEM_TEST_MODE: process.env.CREEM_TEST_MODE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    NEXT_PUBLIC_VERCEL_BRANCH_URL: process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
    NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_STARTER_MONTHLY:
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_STARTER_MONTHLY,
    NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_PRO_MONTHLY:
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_PRO_MONTHLY,
    NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_ENTERPRISE_MONTHLY:
      process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRODUCT_ENTERPRISE_MONTHLY,
    NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY,
    NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY,
    NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
    NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY,
    NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_MONTHLY:
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_MONTHLY,
    NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_YEARLY:
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_YEARLY,
    NEXT_PUBLIC_POLAR_PRODUCT_STARTER_MONTHLY:
      process.env.NEXT_PUBLIC_POLAR_PRODUCT_STARTER_MONTHLY,
    NEXT_PUBLIC_POLAR_PRODUCT_PRO_MONTHLY: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO_MONTHLY,
    NEXT_PUBLIC_POLAR_PRODUCT_ENTERPRISE_MONTHLY:
      process.env.NEXT_PUBLIC_POLAR_PRODUCT_ENTERPRISE_MONTHLY,
    NEXT_PUBLIC_CREEM_PRODUCT_STARTER_MONTHLY:
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_STARTER_MONTHLY,
    NEXT_PUBLIC_CREEM_PRODUCT_PRO_MONTHLY: process.env.NEXT_PUBLIC_CREEM_PRODUCT_PRO_MONTHLY,
    NEXT_PUBLIC_CREEM_PRODUCT_ENTERPRISE_MONTHLY:
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_ENTERPRISE_MONTHLY,
  },
  emptyStringAsUndefined: true,
})

// Need this utility because t3-env is returning string for boolean values.
export const isTruthy = (value: string | boolean | number | undefined) =>
  typeof value === 'string' ? value.toLowerCase() === 'true' || value === '1' : Boolean(value)

// Utility to check if a value is explicitly false (defaults to false only if explicitly set)
export const isFalsy = (value: string | boolean | number | undefined) =>
  typeof value === 'string' ? value.toLowerCase() === 'false' || value === '0' : value === false

/**
 * Secretos de relleno: prohibidos en produccion.
 *
 * Better-Auth NO lee este archivo. Resuelve el secreto por su cuenta desde
 * process.env.BETTER_AUTH_SECRET, asi que el .default() de arriba solo existe
 * para que la validacion no falle en local; nunca llega a firmar una sesion.
 *
 * Better-Auth ya se niega a arrancar en produccion con SU secreto por defecto,
 * pero no puede reconocer los nuestros. El peligroso es el de .env.example:
 * esta publicado en el repositorio, mide mas de 32 caracteres y por lo tanto
 * pasa todas las comprobaciones de la libreria. Copiarlo al panel de Vercel
 * daria un despliegue verde en el que cualquiera que haya leido el repositorio
 * puede firmar una sesion, y con una sesion falsificada de un correo de
 * ADMIN_EMAILS se entra a /admin.
 *
 * Aca si se lanza, no se avisa. Un aviso en los logs de una funcion serverless
 * no lo ve nadie, y lo que esta en juego es el panel de operacion.
 */
const SECRETOS_DE_RELLENO = new Set([
  'dev-secret-change-in-production',
  'your-secret-key-here-generate-with-openssl-rand-base64-32',
])

if (env.NODE_ENV === 'production' && SECRETOS_DE_RELLENO.has(process.env.BETTER_AUTH_SECRET ?? '')) {
  throw new Error(
    'BETTER_AUTH_SECRET es un valor de ejemplo del repositorio. Genera uno real con ' +
      '`openssl rand -base64 32` y ponlo en las variables de entorno del despliegue.'
  )
}
