import 'server-only'

type BrowserTestEnvironment = Readonly<{
  COMMERCE_BROWSER_TEST?: string
  COMMERCE_FUNDING_CLASSIFICATION?: string
  DATABASE_URL?: string
  VERCEL_ENV?: string
}>

export const isIsolatedBrowserTest = (
  environment: BrowserTestEnvironment = {
    COMMERCE_BROWSER_TEST: process.env.COMMERCE_BROWSER_TEST,
    COMMERCE_FUNDING_CLASSIFICATION: process.env.COMMERCE_FUNDING_CLASSIFICATION,
    DATABASE_URL: process.env.DATABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }
): boolean => {
  if (
    environment.COMMERCE_BROWSER_TEST !== 'true' ||
    environment.COMMERCE_FUNDING_CLASSIFICATION !== 'sandbox' ||
    environment.VERCEL_ENV !== undefined
  ) {
    return false
  }

  try {
    const database = new URL(environment.DATABASE_URL ?? '')
    const localHost = ['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname)
    return localHost && /^\/tumbenla_e2e_[a-zA-Z0-9_]+$/.test(database.pathname)
  } catch {
    return false
  }
}
