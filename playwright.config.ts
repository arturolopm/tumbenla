import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3107'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun start --hostname 127.0.0.1 --port 3107',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ADMIN_EMAILS: 'operador@prueba.local',
      COMMERCE_BROWSER_TEST: 'true',
      COMMERCE_FUNDING_CLASSIFICATION: 'sandbox',
      COMMERCE_NEW_OPERATIONS_ENABLED: 'true',
      COMMERCE_PAYMENT_PROVIDER: 'fake',
      EMAIL_PROVIDER: 'log',
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
})
