import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:3107'
const PASSWORD = 'Prueba-2026-tumbenla'

test.describe.configure({ mode: 'serial' })

type OrderStatus = {
  entregadas: number
  total: number
  unidades: { id: string; estado: string }[]
}

type AuthRole = 'operator' | 'ownerA' | 'ownerB' | 'staff'
type AuthState = Awaited<ReturnType<APIRequestContext['storageState']>>

let authStates: Record<AuthRole, AuthState>

const authenticate = async (email: string, clientAddress: string): Promise<AuthState> => {
  const request = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'x-forwarded-for': clientAddress },
  })

  try {
    const response = await request.post('/api/auth/sign-in/email', {
      data: { email, password: PASSWORD, callbackURL: '/' },
    })
    if (!response.ok()) {
      throw new Error(
        `Sign-in for ${email} returned ${response.status()}: ${await response.text()}`
      )
    }
    return request.storageState()
  } finally {
    await request.dispose()
  }
}

const authenticatedContext = (browser: Browser, role: AuthRole): Promise<BrowserContext> =>
  browser.newContext({ storageState: authStates[role] })

const readOrderStatus = async (page: Page, token: string): Promise<OrderStatus> => {
  const response = await page.request.get(`/api/orden/${token}/estado`)
  if (!response.ok()) throw new Error(`Order status returned ${response.status()}`)
  return response.json()
}

test.beforeAll(async () => {
  const [operator, ownerA, ownerB, staff] = await Promise.all([
    authenticate('operador@prueba.local', '192.0.2.10'),
    authenticate('duenoa@prueba.local', '192.0.2.11'),
    authenticate('duenob@prueba.local', '192.0.2.12'),
    authenticate('mesero@prueba.local', '192.0.2.13'),
  ])
  authStates = { operator, ownerA, ownerB, staff }
})

test('owner can read the published menu in the first isolated context', async ({ browser }) => {
  const context = await authenticatedContext(browser, 'ownerA')
  try {
    const page = await context.newPage()
    await page.goto('/panel/bar-la-nona/carta')
    await expect(page.getByRole('heading', { name: 'La carta' })).toBeVisible()
    await expect(page.getByText('Mojito Reconstrucción')).toBeVisible()
  } finally {
    await context.close()
  }
})

test('second owner cannot read the first venue in an isolated context', async ({ browser }) => {
  const context = await authenticatedContext(browser, 'ownerB')
  try {
    const page = await context.newPage()
    await page.goto('/panel/bar-la-nona/carta')
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('operator can reach recovery controls in an isolated context', async ({ browser }) => {
  const context = await authenticatedContext(browser, 'operator')
  try {
    const page = await context.newPage()
    await page.goto('/admin/cuentas')
    await expect(page.getByRole('heading', { name: 'Cuentas' })).toBeVisible()
    await expect(page.getByText('Recuperación de pagos')).toBeVisible()
    await expect(page.getByText('Disputas de cobros')).toBeVisible()
  } finally {
    await context.close()
  }
})

test('one guest order is issued and redeemed by staff in separate contexts', async ({
  browser,
  page: guest,
}, testInfo) => {
  const staffContext = await authenticatedContext(browser, 'staff')
  try {
    const staff = await staffContext.newPage()

    await staff.goto('/panel/bar-la-nona')
    await expect(staff).toHaveURL(/\/panel\/bar-la-nona\/escanear$/)
    await expect(staff.getByRole('heading', { name: 'Escanear' })).toBeVisible()
    await expect(staff.getByRole('link', { name: 'Carta' })).toHaveCount(0)

    await guest.goto('/sitios/bar-la-nona/pedir/mojito-reconstruccion')
    await guest.getByLabel('Tu nombre').fill('Rumbero navegador')
    await guest
      .getByLabel('Tu correo')
      .fill(`rumbero-e2e-${testInfo.repeatEachIndex}-${testInfo.retry}@prueba.local`)
    await guest.getByRole('button', { name: /^Pagar / }).click()
    await expect(guest).toHaveURL(/\/orden\/[A-Za-z0-9_-]+/)
    await expect(
      guest.getByText('Ya está pagado. Que lo escaneen para entregártelo.')
    ).toBeVisible()

    const token = /^\/orden\/([A-Za-z0-9_-]+)$/.exec(new URL(guest.url()).pathname)?.[1]
    expect(token).toBeTruthy()
    if (!token) throw new Error('The guest order URL did not contain a bearer token')

    const initialStatus = await readOrderStatus(guest, token)
    expect(initialStatus).toMatchObject({ entregadas: 0, total: 1 })
    expect(initialStatus.unidades).toHaveLength(1)
    expect(initialStatus.unidades[0]?.estado).toBe('issued')
    const unitId = initialStatus.unidades[0]?.id
    if (!unitId) throw new Error('The order status did not expose its unit identity')

    const formattedCode = await guest.locator('p.font-mono').first().innerText()
    const redemptionCode = formattedCode.replace(/[^A-Z0-9]/g, '')
    expect(redemptionCode).toMatch(/^[A-Z0-9]{8}$/)

    const guestObservedRedemption = guest.waitForResponse(
      async (response) => {
        if (!response.url().endsWith(`/api/orden/${token}/estado`) || !response.ok()) return false
        const status = (await response.json()) as OrderStatus
        return status.unidades.some((unit) => unit.id === unitId && unit.estado === 'redeemed')
      },
      { timeout: 15_000 }
    )

    await staff.getByLabel('O escríbelo').fill(redemptionCode)
    await staff.getByRole('button', { name: 'Buscar' }).click()
    await expect(staff.getByText('Ya pagado')).toBeVisible()
    await expect(staff.getByText('Entrégalo.')).toBeVisible()

    await expect
      .poll(
        async () => {
          const status = await readOrderStatus(guest, token)
          return status.unidades.find((unit) => unit.id === unitId)?.estado
        },
        { message: 'the order status API should expose the redeemed unit', timeout: 10_000 }
      )
      .toBe('redeemed')

    await guest.bringToFront()
    await guestObservedRedemption
    await expect(guest.getByText('Confirmado', { exact: true })).toBeVisible()
    await expect(guest.getByText('El mesero preparará y te entregará tu pedido.')).toBeVisible()
  } finally {
    await staffContext.close()
  }
})

test('one guest bar order uses the default cupo and tells staff to collect', async ({
  browser,
  page: guest,
}, testInfo) => {
  const staffContext = await authenticatedContext(browser, 'staff')
  try {
    const staff = await staffContext.newPage()
    await staff.goto('/panel/bar-la-nona')
    await expect(staff).toHaveURL(/\/panel\/bar-la-nona\/escanear$/)

    await guest.goto('/sitios/bar-la-nona/pedir/mojito-reconstruccion')
    await guest.getByRole('button', { name: /^En la barra/ }).click()
    await guest.getByLabel('Tu nombre').fill('Rumbero barra')
    await guest
      .getByLabel('Tu correo')
      .fill(`rumbero-barra-e2e-${testInfo.repeatEachIndex}-${testInfo.retry}@prueba.local`)
    await guest.getByRole('button', { name: /^Pedirlo/ }).click()
    await expect(guest).toHaveURL(/\/orden\/[A-Za-z0-9_-]+/)
    await expect(guest.getByText('Muestra esto ANTES de pagar')).toBeVisible()

    const token = /^\/orden\/([A-Za-z0-9_-]+)$/.exec(new URL(guest.url()).pathname)?.[1]
    if (!token) throw new Error('The cash order URL did not contain a bearer token')
    const initialStatus = await readOrderStatus(guest, token)
    expect(initialStatus).toMatchObject({ entregadas: 0, total: 1 })
    expect(initialStatus.unidades[0]?.estado).toBe('issued')

    const formattedCode = await guest.locator('p.font-mono').first().innerText()
    const redemptionCode = formattedCode.replace(/[^A-Z0-9]/g, '')
    await staff.getByLabel('O escríbelo').fill(redemptionCode)
    await staff.getByRole('button', { name: 'Buscar' }).click()
    await expect(staff.getByText(/^Cobrar /)).toBeVisible()
    await expect(staff.getByText('Cobra y entrégalo.')).toBeVisible()

    await expect
      .poll(
        async () => {
          const status = await readOrderStatus(guest, token)
          return status.unidades[0]?.estado
        },
        { message: 'the cash order should be redeemed after staff scans it', timeout: 10_000 }
      )
      .toBe('redeemed')
    await expect(guest.getByText('Confirmado', { exact: true })).toBeVisible()
  } finally {
    await staffContext.close()
  }
})
