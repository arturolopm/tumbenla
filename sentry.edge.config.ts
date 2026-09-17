// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const environment = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment,

  // Keep complete traces outside production while protecting the production quota.
  tracesSampleRate: environment === 'production' ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Request headers, cookies, and other default PII stay out of error reports.
  sendDefaultPii: false,
})
