import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // Core Database and Authentication
    DATABASE_URL: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().default('dev-secret-change-in-production'),
    BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
    BILLING_ENABLED: z.boolean().default(false),
    EMAIL_VERIFICATION_ENABLED: z.boolean().default(false),

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
    EMAIL_PROVIDER: z
      .enum(['resend', 'postmark', 'nodemailer', 'plunk', 'custom', 'log'])
      .default('log'),
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
    DEFAULT_FROM_NAME: z.string().optional(),

    // Optional: Billing provider selection (only one can be active at a time)
    // Uses better-auth payment plugins: stripe, polar, dodo, creem, autumn
    BILLING_PROVIDER: z.enum(['stripe', 'polar', 'dodo', 'creem', 'autumn']).optional(),

    // Stripe (@better-auth/stripe)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID: z.string().optional(),

    // Polar (@polar-sh/better-auth)
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
    POLAR_ORGANIZATION_ID: z.string().optional(),
    POLAR_PRODUCT_ID: z.string().optional(),
    POLAR_ENVIRONMENT: z.enum(['production', 'sandbox']).default('production'),

    // Dodo Payments (@dodopayments/better-auth)
    DODO_API_KEY: z.string().optional(),
    DODO_WEBHOOK_SECRET: z.string().optional(),
    DODO_PRODUCT_ID: z.string().optional(),
    DODO_ENVIRONMENT: z.enum(['live_mode', 'test_mode']).default('test_mode'),

    // Creem (@creem_io/better-auth)
    CREEM_API_KEY: z.string().optional(),
    CREEM_WEBHOOK_SECRET: z.string().optional(),

    // Autumn (autumn-js/better-auth)
    AUTUMN_API_KEY: z.string().optional(),
    AUTUMN_CUSTOMER_SCOPE: z
      .enum(['user', 'organization', 'user_and_organization'])
      .default('user'),

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
    NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
    // Billing provider for client-side (must match server BILLING_PROVIDER)
    NEXT_PUBLIC_BILLING_PROVIDER: z
      .enum(['stripe', 'polar', 'dodo', 'creem', 'autumn', ''])
      .optional(),
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
    BILLING_PROVIDER: process.env.BILLING_PROVIDER,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
    POLAR_ORGANIZATION_ID: process.env.POLAR_ORGANIZATION_ID,
    POLAR_PRODUCT_ID: process.env.POLAR_PRODUCT_ID,
    POLAR_ENVIRONMENT: process.env.POLAR_ENVIRONMENT,
    DODO_API_KEY: process.env.DODO_API_KEY,
    DODO_WEBHOOK_SECRET: process.env.DODO_WEBHOOK_SECRET,
    DODO_PRODUCT_ID: process.env.DODO_PRODUCT_ID,
    DODO_ENVIRONMENT: process.env.DODO_ENVIRONMENT,
    CREEM_API_KEY: process.env.CREEM_API_KEY,
    CREEM_WEBHOOK_SECRET: process.env.CREEM_WEBHOOK_SECRET,
    AUTUMN_API_KEY: process.env.AUTUMN_API_KEY,
    AUTUMN_CUSTOMER_SCOPE: process.env.AUTUMN_CUSTOMER_SCOPE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BILLING_PROVIDER: process.env.NEXT_PUBLIC_BILLING_PROVIDER,
  },
  emptyStringAsUndefined: true,
})

// Need this utility because t3-env is returning string for boolean values.
export const isTruthy = (value: string | boolean | number | undefined) =>
  typeof value === 'string' ? value.toLowerCase() === 'true' || value === '1' : Boolean(value)

// Utility to check if a value is explicitly false (defaults to false only if explicitly set)
export const isFalsy = (value: string | boolean | number | undefined) =>
  typeof value === 'string' ? value.toLowerCase() === 'false' || value === '0' : value === false
