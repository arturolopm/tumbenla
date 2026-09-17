import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { CommerceRateLimitService } from '../../src/lib/commerce/rate-limit-service'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined

beforeAll(async () => {
  database = await createCommerceTestDatabase()
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

describe('CommerceRateLimitService', () => {
  test('enforces a database-backed boundary under concurrency without retaining the raw key', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    let now = new Date('2026-09-12T20:00:05.000Z')
    const service = new CommerceRateLimitService({ database: database.db, now: () => now })
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.consume({
          scope: 'scanner',
          key: 'raw-user-and-venue-key',
          limit: 5,
          windowSeconds: 60,
        })
      )
    )
    expect(results.filter((result) => result.allowed)).toHaveLength(5)
    expect(results.filter((result) => !result.allowed)).toHaveLength(5)
    const [stored] = await database.sql`
      select key_hash, count from commerce_rate_limit where scope = 'scanner'
    `
    expect(stored?.key_hash).not.toContain('raw-user-and-venue-key')
    expect(stored?.count).toBe(10)

    now = new Date('2026-09-12T20:01:00.000Z')
    expect(
      (
        await service.consume({
          scope: 'scanner',
          key: 'raw-user-and-venue-key',
          limit: 5,
          windowSeconds: 60,
        })
      ).allowed
    ).toBe(true)
  })
})
