import { randomUUID } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import * as commerceSchema from '../../src/database/commerce-schema'
import * as baseSchema from '../../src/database/schema'

const schema = { ...baseSchema, ...commerceSchema }

const createDrizzleDatabase = (sql: ReturnType<typeof postgres>) => drizzle({ client: sql, schema })

export type CommerceTestDatabase = Readonly<{
  name: string
  sql: ReturnType<typeof postgres>
  db: ReturnType<typeof createDrizzleDatabase>
  close: () => Promise<void>
}>

type CommerceTestDatabaseOptions = Readonly<{
  beforeLatestMigration?: (sql: ReturnType<typeof postgres>) => Promise<void>
}>

const databaseName = (): string =>
  `tumbenla_test_${process.pid}_${randomUUID().replaceAll('-', '')}`

const connectionUrls = (name: string): { admin: string; database: string } => {
  const configured = process.env.TEST_DATABASE_ADMIN_URL?.trim() || process.env.DATABASE_URL?.trim()
  if (!configured) {
    throw new Error('DATABASE_URL or TEST_DATABASE_ADMIN_URL is required for PostgreSQL tests')
  }

  const admin = new URL(configured)
  admin.pathname = '/postgres'
  admin.search = ''
  admin.hash = ''

  const database = new URL(admin)
  database.pathname = `/${name}`
  return { admin: admin.toString(), database: database.toString() }
}

export const createCommerceTestDatabase = async (
  options: CommerceTestDatabaseOptions = {}
): Promise<CommerceTestDatabase> => {
  const name = databaseName()
  if (!/^tumbenla_test_[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error('Refusing to create a database with an unsafe generated name')
  }

  const urls = connectionUrls(name)
  const admin = postgres(urls.admin, { max: 1 })
  await admin.unsafe(`CREATE DATABASE "${name}"`)

  const sql = postgres(urls.database, { max: 5 })
  const db = createDrizzleDatabase(sql)
  let closed = false
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    await sql.end()
    try {
      await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`)
    } finally {
      await admin.end()
    }
  }

  try {
    if (options.beforeLatestMigration) {
      const temporaryRoot = await mkdtemp(join(tmpdir(), 'tumbenla-migrations-'))
      const migrationsFolder = join(temporaryRoot, 'migrations')
      try {
        await cp('./migrations', migrationsFolder, { recursive: true })
        const journalPath = join(migrationsFolder, 'meta', '_journal.json')
        const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
          entries: Array<{ tag: string }>
        }
        journal.entries.pop()
        await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`)
        await migrate(drizzle(sql), { migrationsFolder })
        await options.beforeLatestMigration(sql)
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
      }
    }
    await migrate(drizzle(sql), { migrationsFolder: './migrations' })
  } catch (error) {
    await close()
    throw error
  }

  return { name, sql, db, close }
}
