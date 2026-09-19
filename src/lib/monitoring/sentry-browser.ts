import type * as SentryModule from '@sentry/nextjs'

/**
 * Sentry in the browser, loaded once the page is interactive instead of
 * before hydration.
 *
 * WHY: `instrumentation-client.ts` runs before React hydrates, so importing
 * the SDK there put all of it on the critical path of every page. Measured on
 * a phone profile, with Sentry DISABLED (no DSN locally), removing it made the
 * page interactive ~740 ms sooner; production, which also runs `init`, pays
 * more.
 *
 * WHAT IT COSTS, AND HOW THAT IS COVERED: errors thrown before the SDK loads
 * would be lost. `captureEarlyErrors` queues them from the window's own error
 * events, and so does `captureException` for errors React catches; the queue
 * is replayed into Sentry right after `init`, at which point Sentry's global
 * handlers take over and the early listeners come off. An early error also
 * starts the load at once rather than waiting for idle time. What is really
 * lost is tracing of router transitions that start before the load.
 */

type Sentry = typeof SentryModule

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const environment = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV

let loaded: Sentry | undefined
let loading: Promise<Sentry | undefined> | undefined
const queued: unknown[] = []
const stopEarlyCapture: (() => void)[] = []

export const getLoadedSentry = (): Sentry | undefined => loaded

export const loadSentry = (): Promise<Sentry | undefined> => {
  if (!dsn) return Promise.resolve(undefined)

  loading ??= import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment,
        // Keep complete traces outside production while protecting the production quota.
        tracesSampleRate: environment === 'production' ? 0.1 : 1,
        enableLogs: true,
        // Request headers, cookies, and other default PII stay out of error reports.
        sendDefaultPii: false,
      })
      // From here Sentry's own global handlers see every error.
      for (const stop of stopEarlyCapture.splice(0)) stop()
      loaded = Sentry
      for (const error of queued.splice(0)) Sentry.captureException(error)
      return Sentry
    })
    .catch(() => undefined)

  return loading
}

export const captureException = (error: unknown): void => {
  if (loaded) {
    loaded.captureException(error)
    return
  }
  if (!dsn) return
  queued.push(error)
  void loadSentry()
}

/** Queues uncaught errors and rejections until the SDK is loaded. */
export const captureEarlyErrors = (): void => {
  if (!dsn || loaded) return

  const onError = (event: ErrorEvent) => captureException(event.error ?? event.message)
  const onRejection = (event: PromiseRejectionEvent) => captureException(event.reason)

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  stopEarlyCapture.push(() => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  })
}
