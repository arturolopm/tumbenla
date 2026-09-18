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
  deliveredUnits: number
  totalUnits: number
  units: { id: string; status: string }[]
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

test('public transparency shows the reconstruction total and material split', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/transparencia')
  await expect(page.getByText('Para reconstruir', { exact: true })).toBeVisible()
  await expect(page.getByText('Ya en material', { exact: true })).toBeVisible()
  await expect(page.getByText('Pendiente de convertir en material', { exact: true })).toBeVisible()
  await expect(page.getByText('no es una comisión ni plata que Tumbenla se quede')).toBeVisible()
  await expect(page.getByText('Asignado', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Con respaldo', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false
  )
})

test('venue discovery searches by name or city and exposes the public contact links', async ({
  page,
}) => {
  const anonymousGeocode = await page.request.get('/api/geocode?q=x')
  expect(anonymousGeocode.status()).toBe(404)

  await page.goto('/sitios')

  const search = page.getByRole('searchbox', { name: 'Busca por nombre o ciudad' })
  await search.fill('Bar La Nona')
  await expect(page.getByRole('link', { name: 'Bar La Nona' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Veneno' })).toHaveCount(0)

  await search.fill('Manizales')
  await expect(page.getByText('5 sitios en el mapa con estos filtros')).toBeVisible()

  await page.goto('/sitios/bar-la-nona')
  const directionsHref = await page.getByRole('link', { name: 'Cómo llegar' }).getAttribute('href')
  expect(directionsHref).toBeTruthy()
  if (!directionsHref) throw new Error('The directions link did not have an href')

  const directions = new URL(directionsHref)
  expect(directions.origin).toBe('https://www.google.com')
  expect(directions.pathname).toBe('/maps/dir/')
  expect(directions.searchParams.get('api')).toBe('1')
  expect(directions.searchParams.get('destination')).toBe('5.0689,-75.5174')

  const footer = page.locator('footer')
  await expect(footer).toContainText('TUMBENLA')
  await expect(footer).toContainText(
    'Salir sigue siendo salir. En los sitios de Tumbenla, una parte del trago se vuelve material para volver a levantar, con la factura a la vista.'
  )
  await expect(footer.getByRole('link', { name: 'hastaabajo@tumbenla.com' })).toHaveAttribute(
    'href',
    'mailto:hastaabajo@tumbenla.com'
  )
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

test('owner can find a second venue under Sitios and the active venue name follows the URL', async ({
  browser,
}) => {
  const context = await authenticatedContext(browser, 'ownerA')
  try {
    const page = await context.newPage()
    await page.goto('/panel/bar-la-nona/sitios')
    await expect(page.getByRole('heading', { name: 'Tus sitios' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Registrar otro sitio' })).toHaveAttribute(
      'href',
      '/registrar-sitio'
    )
    const venueList = page.getByRole('list').filter({ hasText: 'Bar La Nona' })
    await expect(venueList.getByText('Bar La Nona')).toBeVisible()
    await expect(venueList.getByText('Billar La Enea')).toBeVisible()

    await page.goto('/panel/billar-la-enea')
    await expect(page.getByRole('button', { name: /Billar La Enea/ })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('owner address lookup places the first result without exposing geocoding publicly', async ({
  browser,
}) => {
  const context = await authenticatedContext(browser, 'ownerA')
  try {
    const page = await context.newPage()
    await page.goto('/panel/bar-la-nona/sitio')
    const venueId = await page.locator('input[name="id"]').inputValue()
    const authorizedStatus = await page.evaluate(
      async (url) => (await fetch(url)).status,
      `/api/geocode?q=x&venueId=${encodeURIComponent(venueId)}`
    )
    expect(authorizedStatus).toBe(400)

    let geocodeRequest = ''
    await page.route('**/api/geocode?*', async (route) => {
      geocodeRequest = route.request().url()
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              lat: 4.6097,
              lng: -74.0817,
              displayName: 'Carrera 7 # 12-34, Bogotá, Colombia',
              addressLine: 'Carrera 7 # 12-34',
              neighborhood: 'La Candelaria',
              city: 'Bogotá',
              department: 'Bogotá D.C.',
            },
          ],
        }),
      })
    })

    await page.locator('input[name="addressLine"]').fill('Carrera 7 # 12-34')
    await page.getByRole('button', { name: 'Ubicar esta dirección en el mapa' }).click()

    await expect(page.locator('input[name="latitude"]')).toHaveValue('4.6097')
    await expect(page.locator('input[name="longitude"]')).toHaveValue('-74.0817')
    expect(new URL(geocodeRequest).searchParams.get('venueId')).toBeTruthy()
  } finally {
    await context.close()
  }
})

test('owner chooses between a draft and immediate publication when saving a drink', async ({
  browser,
}, testInfo) => {
  const context = await authenticatedContext(browser, 'ownerA')
  try {
    const page = await context.newPage()
    const suffix = `${testInfo.retry}-${testInfo.repeatEachIndex}`
    const draftName = `Borrador E2E ${suffix}`
    const publishedName = `Trago E2E ${suffix}`
    await page.goto('/panel/bar-la-nona/carta')
    await page.getByRole('button', { name: 'Agregar algo a la carta' }).click()
    await page.getByLabel('Cómo se llama').fill(draftName)
    await page.getByLabel('Cuánto vale').fill('24000')

    await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible()
    await page.getByRole('button', { name: 'Guardar borrador' }).click()

    const draft = page.getByRole('listitem').filter({ hasText: draftName })
    await expect(draft).toBeVisible()
    await expect(draft.getByText('Borrador', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Agregar algo a la carta' }).click()
    await page.getByLabel('Cómo se llama').fill(publishedName)
    await page.getByLabel('Cuánto vale').fill('24000')
    await page.getByRole('button', { name: 'Guardar y publicar' }).click()

    const product = page.getByRole('listitem').filter({ hasText: publishedName })
    await expect(product).toBeVisible()
    await expect(product.getByText('A la venta')).toBeVisible()
  } finally {
    await context.close()
  }
})

test('personal history separates sandbox orders from real spend and reconstruction allocation', async ({
  browser,
}) => {
  const context = await authenticatedContext(browser, 'ownerA')
  try {
    const page = await context.newPage()
    await page.goto('/sitios/bar-la-nona/pedir/mojito-reconstruccion')
    await page.getByRole('button', { name: /^Pagar / }).click()
    await expect(page).toHaveURL(/\/orden\/[A-Za-z0-9_-]+/)

    await page.goto('/mi-historia')
    await expect(page.getByRole('heading', { name: 'Mi historia' })).toBeVisible()

    const realTotals = page.getByText('Tus pedidos reales').locator('..')
    await expect(realTotals.getByText('Total gastado', { exact: true })).toBeVisible()
    await expect(realTotals.getByText('Para reconstruir', { exact: true })).toBeVisible()
    await expect(realTotals.getByText('$ 0', { exact: true })).toHaveCount(2)

    const nonRealTotals = page
      .getByText('Pedidos que no cuentan en los totales reales')
      .locator('..')
    await expect(nonRealTotals).toContainText('Gastado en pruebas o históricos')
    await expect(nonRealTotals).toContainText('$ 30.000')
    await expect(nonRealTotals).toContainText('Reparto mostrado al pedir')
    await expect(nonRealTotals).toContainText('$ 24.000')

    const order = page.getByRole('link', { name: /Pedido en Bar La Nona/ })
    await expect(order).toContainText('Prueba')
    await expect(order).toContainText('Reparto mostrado al pedir: $ 24.000 para reconstruir')
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

test('staff can reach nights and photo review, but nothing else, and a non-member is still rejected', async ({
  browser,
}) => {
  const staffContext = await authenticatedContext(browser, 'staff')
  try {
    const staff = await staffContext.newPage()
    await staff.goto('/panel/bar-la-nona')
    await expect(staff).toHaveURL(/\/panel\/bar-la-nona\/escanear$/)
    await expect(staff.getByRole('link', { name: 'Las noches' })).toBeVisible()
    await expect(staff.getByRole('link', { name: 'Por revisar' })).toBeVisible()
    await expect(staff.getByRole('link', { name: 'Carta' })).toHaveCount(0)
    await expect(staff.getByRole('link', { name: 'Equipo' })).toHaveCount(0)

    await staff.goto('/panel/bar-la-nona/noches')
    await expect(staff.getByRole('heading', { name: 'Las noches' })).toBeVisible()

    await staff.goto('/panel/bar-la-nona/fotos')
    await expect(staff.getByRole('heading', { name: 'Por revisar' })).toBeVisible()
  } finally {
    await staffContext.close()
  }

  const outsiderContext = await authenticatedContext(browser, 'ownerB')
  try {
    const outsider = await outsiderContext.newPage()
    await outsider.goto('/panel/bar-la-nona/noches')
    await expect(outsider.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()

    await outsider.goto('/panel/bar-la-nona/fotos')
    await expect(outsider.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
  } finally {
    await outsiderContext.close()
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

test('one mixed app order uses one URL, QR, charge, and staff scan', async ({
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
    await expect(guest.getByRole('link', { name: 'Volver a Bar La Nona' })).toHaveAttribute(
      'href',
      '/sitios/bar-la-nona'
    )
    await guest.getByRole('button', { name: 'Agregar Cerveza de la casa' }).click()
    await expect(guest.getByLabel('1 unidades de Mojito Reconstrucción')).toBeVisible()
    await expect(guest.getByLabel('1 unidades de Cerveza de la casa')).toBeVisible()
    await guest.getByLabel('Tu nombre').fill('Rumbero navegador')
    await guest
      .getByLabel('Tu correo')
      .fill(`rumbero-e2e-${testInfo.repeatEachIndex}-${testInfo.retry}@prueba.local`)
    await guest.getByRole('button', { name: /^Pagar / }).click()
    await expect(guest).toHaveURL(/\/orden\/[A-Za-z0-9_-]+/)
    await expect(
      guest.getByText('Ya está pagado. Un solo escaneo entrega todo el pedido.')
    ).toBeVisible()
    await expect(guest.getByText('Mojito Reconstrucción')).toBeVisible()
    await expect(guest.getByText('Cerveza de la casa')).toBeVisible()
    await expect(guest.locator('section[aria-label="Código único del pedido"] svg')).toHaveCount(1)
    await expect(guest.getByRole('link', { name: 'Volver a Bar La Nona' })).toHaveAttribute(
      'href',
      '/sitios/bar-la-nona'
    )

    const token = /^\/orden\/([A-Za-z0-9_-]+)$/.exec(new URL(guest.url()).pathname)?.[1]
    expect(token).toBeTruthy()
    if (!token) throw new Error('The guest order URL did not contain a bearer token')

    const initialStatus = await readOrderStatus(guest, token)
    expect(initialStatus).toMatchObject({ deliveredUnits: 0, totalUnits: 2 })
    expect(initialStatus.units).toHaveLength(2)
    expect(initialStatus.units.every((unit) => unit.status === 'issued')).toBe(true)
    const unitId = initialStatus.units[0]?.id
    if (!unitId) throw new Error('The order status did not expose its unit identity')

    const formattedCode = await guest.locator('p.font-mono').first().innerText()
    const redemptionCode = formattedCode.replace(/[^A-Z0-9]/g, '')
    expect(redemptionCode).toMatch(/^[A-Z0-9]{8}$/)

    const guestObservedRedemption = guest.waitForResponse(
      async (response) => {
        if (!response.url().endsWith(`/api/orden/${token}/estado`) || !response.ok()) return false
        const status = (await response.json()) as OrderStatus
        return status.units.some((unit) => unit.id === unitId && unit.status === 'redeemed')
      },
      { timeout: 15_000 }
    )

    await staff.getByLabel('O escríbelo').fill(redemptionCode)
    await staff.getByRole('button', { name: 'Buscar' }).click()
    await expect(staff.getByText('Ya pagado')).toBeVisible()
    await expect(staff.getByText(/No cobres nada\. Entrega/)).toBeVisible()
    await expect(staff.getByText(/Mojito Reconstrucción/)).toBeVisible()
    await expect(staff.getByText(/Cerveza de la casa/)).toBeVisible()
    await expect(
      staff.getByText('Orden registrada. En Tumbenla ya quedó todo listo.')
    ).toBeVisible()
    await expect(staff.getByText('Toca para registrar otra orden')).toBeVisible()
    await staff.getByRole('button', { name: 'Historial' }).click()
    await expect(staff.getByRole('region', { name: 'Últimas órdenes registradas' })).toContainText(
      'Mojito Reconstrucción'
    )

    await expect
      .poll(
        async () => {
          const status = await readOrderStatus(guest, token)
          return status.units.find((unit) => unit.id === unitId)?.status
        },
        { message: 'the order status API should expose the redeemed unit', timeout: 10_000 }
      )
      .toBe('redeemed')

    await guest.bringToFront()
    await guestObservedRedemption
    await expect(guest.getByText('Confirmado', { exact: true })).toBeVisible()
    await expect(guest.getByText('El bar ya recibió el pedido completo.')).toBeVisible()
  } finally {
    await staffContext.close()
  }
})

test('one QR fulfills a mixed bar order and tells staff the full amount and lines', async ({
  browser,
  page: guest,
}, testInfo) => {
  const staffContext = await authenticatedContext(browser, 'staff')
  try {
    const staff = await staffContext.newPage()
    await staff.goto('/panel/bar-la-nona')
    await expect(staff).toHaveURL(/\/panel\/bar-la-nona\/escanear$/)

    await guest.goto('/sitios/bar-la-nona/pedir/mojito-reconstruccion')
    await guest.getByRole('button', { name: 'Agregar una unidad de Mojito Reconstrucción' }).click()
    await guest.getByRole('button', { name: 'Agregar Cerveza de la casa' }).click()
    await guest.getByRole('button', { name: /^En la barra/ }).click()
    await guest.getByLabel('Tu nombre').fill('Rumbero barra')
    await guest
      .getByLabel('Tu correo')
      .fill(`rumbero-barra-e2e-${testInfo.repeatEachIndex}-${testInfo.retry}@prueba.local`)
    await guest.getByRole('button', { name: /^Pedir todo/ }).click()
    await expect(guest).toHaveURL(/\/orden\/[A-Za-z0-9_-]+/)
    await expect(guest.getByText('Muestra esto antes de pagar')).toBeVisible()
    await expect(guest.locator('section[aria-label="Código único del pedido"] svg')).toHaveCount(1)
    await expect(guest.locator('footer')).toContainText(
      'Del total de $ 68.000: $ 52.000 se van en material. $ 16.000 se quedan en el sitio.'
    )

    const token = /^\/orden\/([A-Za-z0-9_-]+)$/.exec(new URL(guest.url()).pathname)?.[1]
    if (!token) throw new Error('The cash order URL did not contain a bearer token')
    const initialStatus = await readOrderStatus(guest, token)
    expect(initialStatus).toMatchObject({ deliveredUnits: 0, totalUnits: 3 })
    expect(initialStatus.units).toHaveLength(3)
    expect(initialStatus.units.every((unit) => unit.status === 'issued')).toBe(true)

    const formattedCode = await guest.locator('p.font-mono').first().innerText()
    const redemptionCode = formattedCode.replace(/[^A-Z0-9]/g, '')
    await staff.getByLabel('O escríbelo').fill(redemptionCode)
    await staff.getByRole('button', { name: 'Buscar' }).click()
    await expect(staff.getByText(/Cobra en la barra.*68\.000/)).toBeVisible()
    await expect(staff.getByText(/Este pedido no está pagado\. Cobra el total aquí/)).toBeVisible()
    await expect(staff.getByText(/2 × Mojito Reconstrucción/)).toBeVisible()
    await expect(staff.getByText(/Cerveza de la casa/)).toBeVisible()
    await expect(
      staff.getByText('Orden registrada. En Tumbenla ya quedó todo listo.')
    ).toBeVisible()
    await expect(staff.getByText('Toca para registrar otra orden')).toBeVisible()

    await expect
      .poll(
        async () => {
          const status = await readOrderStatus(guest, token)
          return status.units.map((unit) => unit.status)
        },
        { message: 'the cash order should be redeemed after staff scans it', timeout: 10_000 }
      )
      .toEqual(['redeemed', 'redeemed', 'redeemed'])
    await expect(guest.getByText('Confirmado', { exact: true })).toBeVisible()
  } finally {
    await staffContext.close()
  }
})
