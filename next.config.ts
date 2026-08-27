import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

/**
 * El host de R2, sacado de la variable en tiempo de BUILD.
 *
 * remotePatterns no admite comodines de host, y la URL del bucket cambia entre
 * local, preview y produccion, asi que se deriva en vez de escribirse. Y como
 * se resuelve al construir, cambiar el bucket obliga a REDESPLEGAR: ponerlo en
 * el panel de Vercel y esperar no basta.
 *
 * Sin la variable no se agrega ningun patron y next/image rechaza las remotas,
 * que es lo correcto: mejor una imagen rota en desarrollo que un optimizador
 * abierto a cualquier host.
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

  // Inherited from the boilerplate and pointing at someone else's Sentry
  // project. Set SENTRY_ORG / SENTRY_PROJECT before enabling error reporting.
  org: process.env.SENTRY_ORG,

  project: process.env.SENTRY_PROJECT,

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
