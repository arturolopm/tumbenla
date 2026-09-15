import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import 'dotenv/config'
import postgres from 'postgres'

const mailpitUrl = 'http://127.0.0.1:8025'
const runId = process.env.E2E_RUN_ID
if (!runId) throw new Error('E2E_RUN_ID is required. Run the suite with bun run e2e:alta.')

const ownerEmail = `e2e-dueno-${runId}@prueba.local`
const operatorEmail = `e2e-operator-${runId}@prueba.local`
const password = 'Prueba-2026-tumbenla'
const venueName = `E2E Reclamo ${runId}`
const instagram = `e2e${runId.replace(/[^a-z0-9]/g, '')}`

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to run E2E tests.')

const sql = postgres(databaseUrl, { max: 1 })

type MailpitMessage = {
  ID: string
  Subject: string
  To: Array<{ Address?: string }>
  Text?: string
  HTML?: string
}

type MailpitList = { messages: MailpitMessage[] }

type VenueState = { slug: string; status: string; owners: number }

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const mailText = (message: MailpitMessage) => `${message.Text ?? ''}\n${message.HTML ?? ''}`

const containsRecipient = (message: MailpitMessage, recipient: string) =>
  message.To.some((address) => address.Address?.toLowerCase() === recipient.toLowerCase())

/** Mailpit is polled by the unique recipient created for this run; it never clears shared mail. */
async function waitForMail(
  recipient: string,
  matches: (message: MailpitMessage) => boolean
): Promise<MailpitMessage> {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`)
    if (!response.ok)
      throw new Error(`Mailpit returned ${response.status}. Is bun run db:up running?`)

    const inbox = (await response.json()) as MailpitList
    const summary = inbox.messages.find(
      (message) => containsRecipient(message, recipient) && matches(message)
    )

    if (summary) {
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${summary.ID}`)
      if (!detailResponse.ok) throw new Error(`Mailpit could not read message ${summary.ID}.`)
      return (await detailResponse.json()) as MailpitMessage
    }

    await sleep(500)
  }

  throw new Error(`No matching Mailpit message arrived for ${recipient} within 30 seconds.`)
}

const extractOtp = (message: MailpitMessage) => {
  const otp = mailText(message).match(/\b(\d{6})\b/)?.[1]
  if (!otp)
    throw new Error(`The verification email for ${ownerEmail} did not contain a six-digit OTP.`)
  return otp
}

/** React Email may arrive quoted-printable or HTML-entity encoded through SMTP. */
const decodeEmailHref = (href: string) =>
  href
    .replace(/=\r?\n/g, '')
    .replace(/=3D/gi, '=')
    .replaceAll('&amp;', '&')

const signupHrefFromApproval = (message: MailpitMessage) => {
  const printable = (message.HTML ?? '').replace(/=\r?\n/g, '')
  const match = printable.match(/href(?:=3D|=)["']([^"']*\/register\?[^"']*)["']/i)
  if (!match) throw new Error('The approval email did not contain its registration link.')
  return decodeEmailHref(match[1])
}

async function registerAndVerify(
  page: Page,
  options: { email: string; name: string; redirectAfter: string; destination: RegExp }
) {
  await page.goto(
    `/register?correo=${encodeURIComponent(options.email)}&redirectAfter=${encodeURIComponent(options.redirectAfter)}`
  )
  await page.locator('#name').fill(options.name)
  await page.locator('#email').fill(options.email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/verify\?fromSignup=true/)
  const verification = await waitForMail(options.email, (message) =>
    /código|codigo|verifica/i.test(message.Subject)
  )

  // input-otp exposes one real input for all six visual slots.
  await page.locator('input').fill(extractOtp(verification))
  await expect(page).toHaveURL(options.destination)
}

async function findVenue(): Promise<VenueState | null> {
  const [venue] = await sql<VenueState[]>`
    select
      venue.slug,
      venue.status,
      count(venue_member.id) filter (where venue_member.role = 'owner')::int as owners
    from venue
    left join venue_member on venue_member.venue_id = venue.id
    where venue.email = ${ownerEmail}
    group by venue.id
  `

  return venue ?? null
}

async function cleanupRun() {
  await sql.begin(async (tx) => {
    await tx`delete from venue_application where contact_email = ${ownerEmail}`
    await tx`
      delete from venue_member
      where user_id in (
        select id from "user" where email in (${operatorEmail}, ${ownerEmail})
      )
    `
    await tx`delete from venue where email = ${ownerEmail}`
    await tx`
      delete from account
      where user_id in (
        select id from "user" where email in (${operatorEmail}, ${ownerEmail})
      )
    `
    await tx`
      delete from session
      where user_id in (
        select id from "user" where email in (${operatorEmail}, ${ownerEmail})
      )
    `
    await tx`delete from verification where identifier in (${operatorEmail}, ${ownerEmail})`
    await tx`delete from "user" where email in (${operatorEmail}, ${ownerEmail})`
  })
}

test.describe('alta anónima aprobada y reclamada', () => {
  let operatorContext: BrowserContext
  let ownerContext: BrowserContext
  let guestContext: BrowserContext

  test.beforeAll(async () => {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=1`)
    if (!response.ok)
      throw new Error(`Mailpit is unavailable (${response.status}). Run bun run db:up first.`)
    await cleanupRun()
  })

  test.afterAll(async () => {
    await cleanupRun()
    await sql.end({ timeout: 5 })
  })

  test('solicitud sin cuenta → aprobación → correo → código → panel', async ({ browser, page }) => {
    guestContext = await browser.newContext()
    const guest = await guestContext.newPage()

    await guest.goto('/registrar-sitio')
    await guest.locator('#name').fill(venueName)
    await guest.locator('#instagram').fill(instagram)
    await guest.locator('#contactEmail').fill(ownerEmail)
    await guest.locator('#whatsapp').fill('3001234567')
    await guest.getByRole('button', { name: 'Enviar la solicitud' }).click()
    await expect(guest).toHaveURL(/\/registrar-sitio\/enviada\?t=/)
    await expect(
      guest.getByText('sin invitaciones ni otro paso de aprobación', { exact: false })
    ).toBeVisible()

    operatorContext = await browser.newContext()
    const operator = await operatorContext.newPage()
    await registerAndVerify(operator, {
      email: operatorEmail,
      name: 'Operación E2E',
      redirectAfter: '/entrar',
      destination: /\/admin\/?$/,
    })
    await expect(operator).toHaveURL(/\/admin\/?$/)

    await operator.goto('/admin/solicitudes')
    const application = operator.getByRole('listitem').filter({ hasText: venueName })
    await expect(application).toBeVisible()
    await application.getByRole('link', { name: 'Aprobar y crear el sitio' }).click()
    await expect(operator).toHaveURL(/\/admin\/sitios\/nuevo\?solicitud=/)

    await operator.locator('select[name="type"]').selectOption('bar')
    await operator.locator('select[name="status"]').selectOption('draft')
    await operator.locator('input[name="addressLine"]').fill('Carrera E2E 1 # 2-3')
    await operator.locator('input[name="neighborhood"]').fill('Centro')
    await operator.locator('input[name="city"]').fill('Manizales')
    await operator.locator('input[name="department"]').fill('Caldas')

    const map = operator.locator('.maplibregl-canvas')
    await expect(map).toBeVisible()
    await map.scrollIntoViewIfNeeded()
    const mapBox = await map.boundingBox()
    if (!mapBox) throw new Error('The venue map did not have a clickable area.')

    // Click away from the initial centre marker. Simulating MapLibre's custom
    // drag recognizer with raw mouse events is browser-timing dependent; a map
    // click exercises the same public onChange contract deterministically.
    await map.click({
      position: {
        x: Math.floor(mapBox.width * 0.75),
        y: Math.floor(mapBox.height * 0.55),
      },
    })
    await expect(operator.locator('input[name="latitude"]')).not.toHaveValue('')
    await expect(operator.locator('input[name="longitude"]')).not.toHaveValue('')

    const createVenue = operator.getByRole('button', { name: 'Crear sitio' })
    await expect(createVenue).toBeEnabled()
    await createVenue.click()
    await expect(operator.getByRole('heading', { name: 'Sitios' })).toBeVisible()

    await expect.poll(findVenue).toEqual(expect.objectContaining({ status: 'draft', owners: 0 }))
    const createdVenue = await findVenue()
    if (!createdVenue) throw new Error('The approved venue was not created.')

    const unavailablePublicPage = await guest.goto(`/sitios/${createdVenue.slug}`)
    expect(unavailablePublicPage?.status()).toBe(404)

    const approval = await waitForMail(ownerEmail, (message) => /sitio/i.test(message.Subject))
    expect(mailText(approval)).toContain(ownerEmail)
    expect(mailText(approval)).toContain('no tienes que aceptar una invitación')
    expect(mailText(approval)).not.toContain('/invitacion/')

    const registrationHref = signupHrefFromApproval(approval)
    const registrationUrl = new URL(registrationHref)
    expect(registrationUrl.searchParams.get('correo')).toBe(ownerEmail)
    expect(registrationUrl.searchParams.get('redirectAfter')).toBe('/entrar')

    ownerContext = await browser.newContext()
    const owner = await ownerContext.newPage()
    await owner.goto(registrationUrl.toString())
    await owner.locator('#name').fill('Dueño E2E')
    await owner.locator('#email').fill(ownerEmail)
    await owner.locator('#password').fill(password)
    await owner.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(owner).toHaveURL(/\/verify\?fromSignup=true/)

    const verification = await waitForMail(ownerEmail, (message) =>
      /código|codigo|verifica/i.test(message.Subject)
    )
    await owner.locator('input').fill(extractOtp(verification))
    await expect(owner).toHaveURL(new RegExp(`/panel/${createdVenue.slug.replaceAll('-', '\\-')}`))

    await expect.poll(findVenue).toEqual(expect.objectContaining({ status: 'draft', owners: 1 }))

    // The dispatcher is idempotent: another entrance changes neither the route nor ownership.
    await owner.goto('/entrar')
    await expect(owner).toHaveURL(new RegExp(`/panel/${createdVenue.slug.replaceAll('-', '\\-')}`))
    await expect.poll(findVenue).toEqual(expect.objectContaining({ owners: 1 }))
  })
})
