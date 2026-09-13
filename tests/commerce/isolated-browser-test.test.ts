import { describe, expect, test } from 'bun:test'
import { isIsolatedBrowserTest } from '../../src/lib/isolated-browser-test'

describe('isolated browser test runtime', () => {
  const isolatedEnvironment = {
    COMMERCE_BROWSER_TEST: 'true',
    COMMERCE_FUNDING_CLASSIFICATION: 'sandbox',
    DATABASE_URL: 'postgres://browser-test@127.0.0.1:5432/tumbenla_e2e_fixture',
  }

  test('allows only an explicit sandbox run against a disposable local database', () => {
    expect(isIsolatedBrowserTest(isolatedEnvironment)).toBe(true)
    expect(
      isIsolatedBrowserTest({
        ...isolatedEnvironment,
        DATABASE_URL: 'postgres://browser-test@example.test/tumbenla_e2e_fixture',
      })
    ).toBe(false)
    expect(
      isIsolatedBrowserTest({
        ...isolatedEnvironment,
        DATABASE_URL: 'postgres://browser-test@localhost:5432/tumbenla',
      })
    ).toBe(false)
  })

  test('refuses incomplete flags and every Vercel environment', () => {
    expect(
      isIsolatedBrowserTest({ ...isolatedEnvironment, COMMERCE_BROWSER_TEST: undefined })
    ).toBe(false)
    expect(
      isIsolatedBrowserTest({ ...isolatedEnvironment, COMMERCE_FUNDING_CLASSIFICATION: 'real' })
    ).toBe(false)
    expect(isIsolatedBrowserTest({ ...isolatedEnvironment, VERCEL_ENV: 'preview' })).toBe(false)
    expect(isIsolatedBrowserTest({ ...isolatedEnvironment, VERCEL_ENV: 'production' })).toBe(false)
  })
})
