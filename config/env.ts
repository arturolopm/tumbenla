import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().default('dev-secret-change-in-production'),
    BETTER_AUTH_URL: z.string().default('http://localhost:3000'),

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
    NEXT_PUBLIC_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
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
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  },
  emptyStringAsUndefined: true,
})
