/**
 * Measures how long it takes for the nav to show the CORRECT auth state
 * (Entrar / person name / venue name) after first paint.
 *
 *   bun scripts/measure-auth-paint.ts --url http://localhost:3000/ --profile 4g --runs 3
 *   bun scripts/measure-auth-paint.ts --profile 4g --login duenoa@prueba.local
 *
 * Ports the probe used during the session-hint diagnosis (see
 * docs/plans/session-hint.md, "T0b"), with three upgrades:
 *   - navCorrectAt comes from a requestAnimationFrame loop calling
 *     checkVisibility() on the expected control, not a MutationObserver text
 *     match. That reports the first PAINTED frame, including CSS-only state
 *     changes (relevant from T3 on, once the nav uses the session-hint cookie
 *     + Tailwind data-attribute variants instead of a text swap).
 *   - `labels` is the ordered sequence of distinct visible trigger labels
 *     (falling back to the CSS `::after` content once T3 renders the label
 *     that way), so a label flicker (anon -> person -> venue) is visible in
 *     the output instead of only the final state.
 *   - CLI args (--login, --runs, --profile) plus per-scenario medians instead
 *     of one-off manual runs.
 *
 * WHY --login POSTs instead of using a stored storageState: the test
 * accounts are local-only (bun run seed:cuentas) and the point is to measure
 * a REAL sign-in response's Set-Cookie headers, the same ones a browser gets.
 *
 * Local prod builds (`bun run start`) name cookies `__Secure-tumbenla.*`
 * even over http://localhost, because better-auth derives the prefix from
 * `useSecureCookies` (NODE_ENV==='production'), not from the request's
 * protocol. Playwright's addCookies rejects a `__Secure-` cookie without
 * `secure: true`, so that flag is forced from the cookie name, not only from
 * the Set-Cookie header (which may omit `Secure` on a plain http response).
 */
import { type Browser, type Page, chromium } from '@playwright/test'
import { parseArgs } from 'node:util'

const TEST_PASSWORD = 'Prueba-2026-tumbenla'

type Profile = '4g' | 'none'

interface Args {
  url: string
  profile: Profile
  runs: number
  login?: string
}

const parseCliArgs = (): Args => {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', default: 'http://localhost:3000/' },
      profile: { type: 'string', default: 'none' },
      runs: { type: 'string', default: '3' },
      login: { type: 'string' },
    },
  })

  const profile = values.profile as string
  if (profile !== '4g' && profile !== 'none') {
    throw new Error(`--profile must be "4g" or "none", got "${profile}"`)
  }

  const runs = Number.parseInt(values.runs as string, 10)
  if (!Number.isFinite(runs) || runs < 1) {
    throw new Error(`--runs must be a positive integer, got "${values.runs}"`)
  }

  return { url: values.url as string, profile, runs, login: values.login as string | undefined }
}

interface ParsedCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

const parseSetCookie = (raw: string, hostname: string): ParsedCookie => {
  const parts = raw.split(';').map((part) => part.trim())
  const [name, ...valueParts] = parts[0].split('=')
  const value = valueParts.join('=')

  let domain = hostname
  let path = '/'
  let secure = false
  let httpOnly = false
  let sameSite: ParsedCookie['sameSite']

  for (const attr of parts.slice(1)) {
    const [rawKey, rawVal] = attr.split('=')
    const key = rawKey.toLowerCase()
    if (key === 'domain' && rawVal) domain = rawVal.replace(/^\./, '')
    else if (key === 'path' && rawVal) path = rawVal
    else if (key === 'secure') secure = true
    else if (key === 'httponly') httpOnly = true
    else if (key === 'samesite' && rawVal) {
      const normalized = rawVal.trim().toLowerCase()
      sameSite = normalized === 'strict' ? 'Strict' : normalized === 'none' ? 'None' : 'Lax'
    }
  }

  // better-auth names the session cookie `__Secure-tumbenla.session_token` in
  // any production build, even served over plain http on localhost. The
  // browser rule for that prefix requires Secure, but a local http response
  // can't set it, so Playwright is told directly from the cookie name.
  if (name.startsWith('__Secure-') || name.startsWith('__Host-')) secure = true

  return { name, value, domain, path, secure, httpOnly, sameSite }
}

/** Signs in a seeded local test account and returns its session cookies. */
const signIn = async (appUrl: string, email: string): Promise<ParsedCookie[]> => {
  const origin = new URL(appUrl).origin
  const response = await fetch(new URL('/api/auth/sign-in/email', appUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  })
  if (!response.ok) {
    throw new Error(`Sign-in failed for ${email}: ${response.status} ${await response.text()}`)
  }
  const hostname = new URL(appUrl).hostname
  return response.headers.getSetCookie().map((raw) => parseSetCookie(raw, hostname))
}

interface ProbeState {
  marks: [number, string][]
  labels: string[]
  navCorrectAt: number | null
}

/**
 * Runs inside the page via addInitScript, before any app script. Every
 * timestamp is `performance.now()` inside the page, so results don't depend
 * on Playwright's own polling cadence.
 */
const installProbe = (signedIn: boolean) => {
  const state: ProbeState = { marks: [], labels: [], navCorrectAt: null }
  ;(window as unknown as { __authPaintProbe: ProbeState }).__authPaintProbe = state
  const mark = (label: string) => state.marks.push([Math.round(performance.now()), label])

  const originalFetch = window.fetch
  // `typeof fetch` also carries static members (e.g. `preconnect`), so a bare
  // arrow function isn't assignable to `window.fetch` under strict mode.
  // Object.assign copies those statics from the original onto the wrapper.
  window.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // better-auth's client passes a URL object here, not a string.
      const requestUrl = String(input instanceof Request ? input.url : input)
      const path = requestUrl.replace(/^https?:\/\/[^/]+/, '')
      if (path.startsWith('/api/auth/get-session')) mark('fetch:get-session')
      return originalFetch(input, init)
    },
    originalFetch
  )

  const findControl = (): Element | null => {
    if (signedIn) {
      return document.querySelector('header [data-account-trigger], header nav button[aria-haspopup]')
    }
    const nav = document.querySelector('header nav')
    if (!nav) return null
    return [...nav.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'Entrar') ?? null
  }

  // Real text today; T3 moves the label onto ::after content instead.
  const labelOf = (el: Element): string => {
    const afterContent = getComputedStyle(el, '::after').content
    if (afterContent && afterContent !== 'none' && afterContent !== '""' && afterContent !== 'normal') {
      return afterContent.replace(/^"|"$/g, '')
    }
    return el.textContent?.trim() ?? ''
  }

  let lastLabel = ''
  const tick = () => {
    const control = findControl()
    if (control && (control as HTMLElement).checkVisibility()) {
      if (state.navCorrectAt === null) {
        state.navCorrectAt = Math.round(performance.now())
        mark('navCorrectAt')
      }
      const label = labelOf(control)
      if (label && label !== lastLabel) {
        lastLabel = label
        state.labels.push(label)
        mark(`label:${label}`)
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

interface RunResult {
  fcp: number | null
  hydratedAt: number | null
  navCorrectAt: number | null
  labels: string[]
}

const collectResult = (): RunResult => {
  const probe = (window as unknown as { __authPaintProbe: ProbeState }).__authPaintProbe
  const fcpEntry = performance.getEntriesByType('paint').find((entry) => entry.name === 'first-contentful-paint')
  const fetchMark = probe.marks.find(([, label]) => label === 'fetch:get-session')
  return {
    fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
    hydratedAt: fetchMark ? fetchMark[0] : null,
    navCorrectAt: probe.navCorrectAt,
    labels: probe.labels,
  }
}

const runOnce = async (browser: Browser, args: Args): Promise<RunResult> => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    if (args.login) {
      const cookies = await signIn(args.url, args.login)
      await context.addCookies(cookies)
    }
    await context.addInitScript(installProbe, Boolean(args.login))

    const page: Page = await context.newPage()
    if (args.profile === '4g') {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    }

    await page.goto(args.url, { waitUntil: 'load' })
    // Wait for the control to settle, then a short grace period to catch a
    // late relabel (e.g. mi-acceso switching person -> venue), instead of a
    // fixed sleep sized for the worst case.
    await page
      .waitForFunction(
        () => (window as unknown as { __authPaintProbe?: ProbeState }).__authPaintProbe?.navCorrectAt !== null,
        undefined,
        { timeout: 20_000 }
      )
      .catch(() => {})
    await page.waitForTimeout(args.profile === '4g' ? 1500 : 500)

    return await page.evaluate(collectResult)
  } finally {
    await context.close()
  }
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

const nums = (values: (number | null)[]): number[] => values.filter((v): v is number => v !== null)

const main = async () => {
  const args = parseCliArgs()
  console.log(
    `\n=== ${args.url}  profile=${args.profile}  login=${args.login ?? 'anon'}  runs=${args.runs}`
  )

  const browser = await chromium.launch()
  const results: RunResult[] = []
  try {
    for (let i = 1; i <= args.runs; i++) {
      const result = await runOnce(browser, args)
      results.push(result)
      const gap = result.fcp !== null && result.navCorrectAt !== null ? result.navCorrectAt - result.fcp : null
      console.log(
        `run ${i}: FCP=${result.fcp ?? 'n/a'}ms navCorrectAt=${result.navCorrectAt ?? 'n/a'}ms ` +
          `gap=${gap ?? 'n/a'}ms hydratedAt=${result.hydratedAt ?? 'n/a'}ms labels=${JSON.stringify(result.labels)}`
      )
    }
  } finally {
    await browser.close()
  }

  const fcps = nums(results.map((r) => r.fcp))
  const navs = nums(results.map((r) => r.navCorrectAt))
  const hydrated = nums(results.map((r) => r.hydratedAt))
  const gaps = nums(results.map((r) => (r.fcp !== null && r.navCorrectAt !== null ? r.navCorrectAt - r.fcp : null)))
  const allLabels = [...new Set(results.flatMap((r) => r.labels))]

  console.log(
    `median: FCP=${median(fcps) ?? 'n/a'}ms navCorrectAt=${median(navs) ?? 'n/a'}ms ` +
      `gap=${median(gaps) ?? 'n/a'}ms hydratedAt=${median(hydrated) ?? 'n/a'}ms labels=${JSON.stringify(allLabels)}`
  )
}

await main()
