import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

/**
 * R2's host, read from the environment at build time.
 *
 * remotePatterns does not allow hostname wildcards, and the bucket URL changes
 * between local, preview, and production, so derive it instead of hardcoding it.
 * Because it is resolved while building, changing the bucket requires a redeploy.
 *
 * Without the variable, no pattern is added and next/image rejects remote images.
 * A broken development image is safer than an optimizer open to arbitrary hosts.
 */
const r2Patterns = (() => {
  const raw = process.env.R2_BUCKET_URL
  if (!raw) return []
  try {
    const url = new URL(raw)
    return [
      {
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        hostname: url.hostname,
        pathname: '/**',
      },
    ]
  } catch {
    console.warn('R2_BUCKET_URL no es una URL valida; next/image no la va a servir')
    return []
  }
})()

const nextConfig: NextConfig = {
  // A package-lock outside this repository otherwise makes Next trace from the
  // user's home directory, slowing builds and making their inputs ambiguous.
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: r2Patterns,
  },
  // Enable standalone output for Docker optimization
  // This reduces the Docker image size by including only necessary files
  // output: 'standalone',
  typescript: {
    // Type errors fail the build. Left on, a green build proved nothing about
    // types and `bun run typecheck` was the only real gate.
    ignoreBuildErrors: false,
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  // Build metadata identifies the Sentry project that receives source maps.
  // Keep these unset locally unless a production-style upload is intentional.
  org: process.env.SENTRY_ORG,

  project: process.env.SENTRY_PROJECT,

  // Build-only secret used to upload source maps. It is never included in the app bundle.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
})
