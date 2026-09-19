import { expect, test, type Page } from '@playwright/test'
import { authenticate, BASE_URL } from './auth'

/**
 * Covers the pre-hydration nav paint from docs/plans/session-hint.md (T3-T6):
 * the `tumbenla.session_hint` cookie lets the navbar show "Entrar" or the
 * right name/venue before any JS has run, driven entirely by CSS reading the
 * `data-session` attribute the inline <head> script sets on <html>.
 */

const HINT_COOKIE = 'tumbenla.session_hint'

/** Aborts every JS chunk, so the page never hydrates: what's on screen is the
 * pre-hydration, CSS-only paint. */
const blockScriptChunks = (page: Page) =>
  page.route('**/_next/static/chunks/**/*.js', (route) => route.abort())

const entrarLink = (page: Page) => page.getByRole('link', { name: 'Entrar', exact: true })
const trigger = (page: Page) => page.locator('header [data-account-trigger]')

/**
 * Reads the account-trigger's visible label: the pre-hydration placeholder
 * shows it via the CSS `::after` content of its label span (see
 * account-menu.tsx); the real, hydrated trigger shows it as plain text. Ports
 * the same fallback `scripts/measure-auth-paint.ts` uses.
 */
const readTriggerLabel = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('header [data-account-trigger]')
    if (!el) return null
    const labelSpan = el.querySelector('span:last-child')
    const after = labelSpan ? getComputedStyle(labelSpan, '::after').content : 'none'
    if (after && after !== 'none' && after !== 'normal') return after.replace(/^"|"$/g, '')
    return el.textContent?.trim() ?? null
  })

test('anonymous visitor sees Entrar before any JS runs', async ({ page }) => {
  await blockScriptChunks(page)
  await page.goto('/', { waitUntil: 'load' })
  await expect(entrarLink(page)).toBeVisible()
  await expect(trigger(page)).toBeHidden()
})

test('venue owner sees the venue label before any JS runs, and Entrar stays hidden', async ({
  browser,
}) => {
  const storageState = await authenticate('duenoa@prueba.local', '198.51.100.20')
  const context = await browser.newContext({ storageState })
  try {
    const page = await context.newPage()
    await blockScriptChunks(page)
    await page.goto('/', { waitUntil: 'load' })
    await expect(entrarLink(page)).toBeHidden()
    await expect(trigger(page)).toBeVisible()
    expect(await readTriggerLabel(page)).toBe('Bar La Nona')
  } finally {
    await context.close()
  }
})

test('operator with no venue sees their name before any JS runs', async ({ browser }) => {
  const storageState = await authenticate('operador@prueba.local', '198.51.100.21')
  const context = await browser.newContext({ storageState })
  try {
    const page = await context.newPage()
    await blockScriptChunks(page)
    await page.goto('/', { waitUntil: 'load' })
    await expect(entrarLink(page)).toBeHidden()
    await expect(trigger(page)).toBeVisible()
    expect(await readTriggerLabel(page)).toBe('Operación')
  } finally {
    await context.close()
  }
})

test('owner never sees their personal name in the trigger label sequence', async ({ browser }) => {
  const storageState = await authenticate('duenoa@prueba.local', '198.51.100.22')
  const context = await browser.newContext({ storageState })
  try {
    const page = await context.newPage()
    // Installed before any app script runs, so it captures the very first
    // painted frame through to the fully-hydrated, post-mi-acceso state.
    await context.addInitScript(() => {
      const state: { labels: string[] } = { labels: [] }
      ;(window as unknown as { __labelSequence: typeof state }).__labelSequence = state

      const labelOf = (el: Element): string => {
        const after = getComputedStyle(el, '::after').content
        if (after && after !== 'none' && after !== 'normal') return after.replace(/^"|"$/g, '')
        return el.textContent?.trim() ?? ''
      }

      const tick = () => {
        const el = document.querySelector('header [data-account-trigger]')
        if (el && (el as HTMLElement).checkVisibility()) {
          const label = labelOf(el)
          if (label && state.labels[state.labels.length - 1] !== label) {
            state.labels.push(label)
          }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    // The real sequence: get-session resolves first, then mi-acceso (Design,
    // "Readers"). Both waits are registered BEFORE navigating: either response
    // can arrive before `load`, and a wait registered after it would hang.
    const sessionAnswered = page.waitForResponse((response) =>
      response.url().includes('/api/auth/get-session')
    )
    const accessAnswered = page.waitForResponse((response) =>
      response.url().includes('/api/mi-acceso')
    )
    await page.goto('/', { waitUntil: 'load' })
    await sessionAnswered
    await accessAnswered
    // The hydrated trigger carries the label as text: waiting for it pins the
    // read to the final render instead of a guessed delay.
    await expect(page.locator('header button[data-account-trigger]')).toHaveText('Bar La Nona')

    const labels = await page.evaluate(
      () => (window as unknown as { __labelSequence: { labels: string[] } }).__labelSequence.labels
    )
    expect(labels).not.toContain('Dueño A')
    expect(labels).toEqual(['Bar La Nona'])
  } finally {
    await context.close()
  }
})

test('signing out from the menu clears the hint cookie, and a JS-blocked reload shows Entrar', async ({
  browser,
}) => {
  const storageState = await authenticate('duenoa@prueba.local', '198.51.100.23')
  const context = await browser.newContext({ storageState })
  try {
    const page = await context.newPage()
    await page.goto('/')
    await trigger(page).click()
    await page.getByRole('menuitem', { name: 'Salir' }).click()
    await expect(entrarLink(page)).toBeVisible()

    const cookiesAfterSignOut = await context.cookies(BASE_URL)
    expect(cookiesAfterSignOut.find((cookie) => cookie.name === HINT_COOKIE)).toBeUndefined()

    await blockScriptChunks(page)
    await page.reload({ waitUntil: 'load' })
    await expect(entrarLink(page)).toBeVisible()
  } finally {
    await context.close()
  }
})

test('a hand-set stale hint in an anonymous context is cleared after load, and Entrar shows', async ({
  browser,
}) => {
  const context = await browser.newContext()
  try {
    const staleHint = encodeURIComponent(
      JSON.stringify({ v: 1, k: 'venue', l: 'Sitio Fantasma', s: 'sitio-fantasma' })
    )
    await context.addCookies([{ name: HINT_COOKIE, value: staleHint, url: BASE_URL }])

    const page = await context.newPage()
    // Registered before navigating: the response can land before `load`.
    const sessionAnswered = page.waitForResponse((response) =>
      response.url().includes('/api/auth/get-session')
    )
    await page.goto('/', { waitUntil: 'load' })
    await sessionAnswered

    await expect(entrarLink(page)).toBeVisible()
    // The cookie clears through that response's Set-Cookie header.
    await expect
      .poll(async () =>
        (await context.cookies(BASE_URL)).some((cookie) => cookie.name === HINT_COOKIE)
      )
      .toBe(false)
  } finally {
    await context.close()
  }
})
