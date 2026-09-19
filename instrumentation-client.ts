// Runs in the browser before React hydrates. It deliberately does NOT import
// the Sentry SDK: see src/lib/monitoring/sentry-browser.ts for why, and for how
// errors thrown before the SDK loads still reach Sentry.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { captureEarlyErrors, getLoadedSentry, loadSentry } from '@/lib/monitoring/sentry-browser'

captureEarlyErrors()

const startSentry = () => void loadSentry()
const whenIdle = () =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(startSentry, { timeout: 5000 })
    : setTimeout(startSentry, 1)

if (document.readyState === 'complete') whenIdle()
else window.addEventListener('load', whenIdle, { once: true })

export const onRouterTransitionStart = (
  href: string,
  navigationType: 'push' | 'replace' | 'traverse'
) => {
  getLoadedSentry()?.captureRouterTransitionStart(href, navigationType)
}
