import { expect, test } from '@playwright/test'

/**
 * Guards the amplifiers fixed in T4 (env/Zod) and T5 (Sentry): none of the
 * JS chunks the homepage's initial HTML references should carry server
 * secrets or the eagerly-loaded Sentry SDK. All three needles were present
 * in the initial chunks before those tasks; see docs/plans/session-hint.md.
 */
const FORBIDDEN_NEEDLES = ['DATABASE_URL', 'ZodError', '__SENTRY__'] as const

test('the initial chunks referenced by / carry no server secrets or eager Sentry code', async ({
  request,
}) => {
  const homepage = await request.get('/')
  expect(homepage.ok()).toBe(true)
  const html = await homepage.text()

  const chunkPaths = [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/_next\/static\/chunks\/[^"]+\.js[^"]*)"/g)].map(
        (match) => match[1]
      )
    ),
  ]
  expect(chunkPaths.length).toBeGreaterThan(0)

  const offenders: { path: string; needle: string }[] = []

  for (const path of chunkPaths) {
    const response = await request.get(path)
    expect(response.ok(), `chunk ${path} did not load: ${response.status()}`).toBe(true)
    const body = await response.text()
    for (const needle of FORBIDDEN_NEEDLES) {
      if (body.includes(needle)) offenders.push({ path, needle })
    }
  }

  expect(offenders).toEqual([])
})
