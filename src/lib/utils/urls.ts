import { isProd } from '@/lib/constants'

/**
 * The public variables this file needs, read as LITERAL `process.env.X`
 * accesses so Next inlines them at build time.
 *
 * WHY NOT `@/config/env`: this file is reachable from the browser — through
 * the `@/lib/utils` barrel, which dozens of client components import for
 * `cn`, and through the auth client. Importing the env schema here shipped
 * t3-env, all of Zod and the name of every server variable to every page:
 * ~62 KB gzipped on the critical path, measured at ~390 ms of extra wait
 * before hydration on a phone. `env.ts` still validates these same values when
 * the server boots — they are in its client schema, and its
 * `emptyStringAsUndefined` treats '' exactly as `clean()` below does — so
 * nothing goes unvalidated.
 */
const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
  productionUrl: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  branchUrl: process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL,
  deploymentUrl: process.env.NEXT_PUBLIC_VERCEL_URL,
}

/** Vercel's system variables arrive WITHOUT a scheme: `my-site.vercel.app`. */
const withScheme = (host: string) =>
  host.startsWith('http://') || host.startsWith('https://')
    ? host
    : `${isProd ? 'https://' : 'http://'}${host}`

const clean = (value: string | undefined) => value?.trim() || undefined

/**
 * The public URL of the app, for email links, session callbacks and
 * canonicals.
 *
 * On Vercel it works itself out, in this order:
 *
 *   1. NEXT_PUBLIC_APP_URL, when set. It is the explicit override and always
 *      wins: it is where the custom domain goes once there is one.
 *   2. In production, NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL. Vercel defines
 *      it as "the shortest custom production domain, or the vercel.app one if
 *      there is none". That is why moving to a custom domain needs no change:
 *      the variable starts returning the new domain by itself.
 *   3. In preview, the BRANCH URL before the standalone deployment's. The
 *      branch URL survives the next push, so the link in an email sent an hour
 *      ago still opens something.
 *   4. Locally, localhost:3000.
 *
 * MIND THE TIMING: NEXT_PUBLIC_* is baked into the bundle DURING THE BUILD.
 * Changing any of these in the dashboard has no effect until the next deploy.
 * The same goes for the custom domain.
 *
 * In production, if none is set, it THROWS. The previous version had a
 * localhost .default() and silently returned 'http://localhost:3000': the
 * deployment went green with every email link broken. A failed build is better
 * than that.
 */
export function getBaseUrl(): string {
  const explicit = clean(publicEnv.appUrl)
  if (explicit) return withScheme(explicit)

  if (publicEnv.vercelEnv === 'production') {
    const production = clean(publicEnv.productionUrl)
    if (production) return withScheme(production)
  }

  const deployment = clean(publicEnv.branchUrl) ?? clean(publicEnv.deploymentUrl)
  if (deployment) return withScheme(deployment)

  if (!isProd) return 'http://localhost:3000'

  throw new Error(
    'No se pudo determinar la URL publica. Pon NEXT_PUBLIC_APP_URL, o activa ' +
      '"Enable access to System Environment Variables" en el proyecto de Vercel.'
  )
}
