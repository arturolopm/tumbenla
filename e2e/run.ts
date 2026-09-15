import postgres from 'postgres'

const configuredDatabaseUrl = process.env.DATABASE_URL
if (!configuredDatabaseUrl) throw new Error('DATABASE_URL is required for browser tests')
if (process.env.NODE_ENV === 'production') {
  throw new Error('Browser tests cannot run from a production process')
}

const runId = crypto.randomUUID().toLowerCase()
const operatorEmail = `e2e-operator-${runId}@prueba.local`
const databaseName = `tumbenla_e2e_${runId.replaceAll('-', '')}`
if (!/^tumbenla_e2e_[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('Refusing to create an unsafe browser-test database name')
}

const adminUrl = new URL(configuredDatabaseUrl)
adminUrl.pathname = '/postgres'
adminUrl.search = ''
adminUrl.hash = ''
const testUrl = new URL(adminUrl)
testUrl.pathname = `/${databaseName}`

const admin = postgres(adminUrl.toString(), { max: 1 })

const browserEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: testUrl.toString(),
  ADMIN_EMAILS: `operador@prueba.local,${operatorEmail}`,
  COMMERCE_BROWSER_TEST: 'true',
  COMMERCE_FUNDING_CLASSIFICATION: 'sandbox',
  COMMERCE_NEW_OPERATIONS_ENABLED: 'true',
  COMMERCE_PAYMENT_PROVIDER: 'fake',
  EMAIL_PROVIDER: 'nodemailer',
  E2E_RUN_ID: runId,
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3107',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_USER: 'mailpit',
  SMTP_PASS: 'mailpit',
  SMTP_SECURE: 'false',
}

let activeChild: ReturnType<typeof Bun.spawn> | undefined
let receivedSignal: NodeJS.Signals | undefined

const forwardSignal = (signal: NodeJS.Signals): void => {
  receivedSignal = signal
  activeChild?.kill(signal)
}

const handleInterrupt = (): void => forwardSignal('SIGINT')
const handleTermination = (): void => forwardSignal('SIGTERM')

process.on('SIGINT', handleInterrupt)
process.on('SIGTERM', handleTermination)

const run = async (command: string[], timeoutMs: number): Promise<void> => {
  if (receivedSignal) throw new Error(`Browser test interrupted by ${receivedSignal}`)

  const child = Bun.spawn(command, {
    cwd: process.cwd(),
    env: browserEnvironment,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  activeChild = child

  let timedOut = false
  let forceKill: ReturnType<typeof setTimeout> | undefined
  const deadline = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
    forceKill = setTimeout(() => child.kill('SIGKILL'), 5_000)
  }, timeoutMs)

  const exitCode = await child.exited.finally(() => {
    clearTimeout(deadline)
    if (forceKill) clearTimeout(forceKill)
    if (activeChild === child) activeChild = undefined
  })

  if (timedOut) {
    throw new Error(`${command.join(' ')} exceeded ${timeoutMs}ms`)
  }
  if (exitCode !== 0) throw new Error(`${command.join(' ')} exited with ${exitCode}`)
}

let failure: unknown

try {
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`)
  await run(['bun', 'run', 'migrate'], 60_000)
  await run(['bun', 'scripts/seed-tumbenla.ts'], 60_000)
  await run(['bun', 'run', 'seed:cuentas'], 60_000)
  await run(['bun', '--conditions', 'react-server', 'e2e/seed-commerce.ts'], 60_000)
  await run(['bun', 'run', 'build'], 180_000)
  await run(['bunx', 'playwright', 'test', ...process.argv.slice(2)], 180_000)
} catch (error) {
  failure = error
} finally {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
  await admin.end()
  process.off('SIGINT', handleInterrupt)
  process.off('SIGTERM', handleTermination)
}

if (receivedSignal) {
  process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143
} else if (failure) {
  throw failure
}
