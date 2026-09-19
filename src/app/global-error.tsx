'use client'

import NextError from 'next/error'
import { useEffect } from 'react'

import { captureException } from '@/lib/monitoring/sentry-browser'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // Through the lazy loader, not `@sentry/nextjs` directly: a static import here
  // would put the whole SDK back on every page's critical path.
  useEffect(() => {
    captureException(error)
  }, [error])

  return (
    <html lang='en'>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
