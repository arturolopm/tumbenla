import 'server-only'

import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'

import type { db } from '@/database'
import { commerceRateLimit } from '@/database/commerce-schema'
import { createId } from '@/lib/utils/id'

type CommerceDatabase = typeof db

const keyHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex')

export class CommerceRateLimitService {
  readonly #database: CommerceDatabase
  readonly #now: () => Date

  constructor(dependencies: { database: CommerceDatabase; now?: () => Date }) {
    this.#database = dependencies.database
    this.#now = dependencies.now ?? (() => new Date())
  }

  async consume(input: {
    scope: 'checkout' | 'cash_reservation' | 'scanner' | 'reconciliation'
    key: string
    limit: number
    windowSeconds: number
  }): Promise<{ allowed: boolean; remaining: number; retryAt: Date }> {
    if (
      input.key.trim().length === 0 ||
      input.key.length > 1_000 ||
      !Number.isSafeInteger(input.limit) ||
      input.limit <= 0 ||
      !Number.isSafeInteger(input.windowSeconds) ||
      input.windowSeconds < 10 ||
      input.windowSeconds > 86_400
    ) {
      throw new Error('Rate-limit configuration is invalid')
    }
    const now = this.#now()
    const windowMilliseconds = input.windowSeconds * 1_000
    const windowStartedAt = new Date(
      Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds
    )
    const expiresAt = new Date(windowStartedAt.getTime() + windowMilliseconds)
    const [row] = await this.#database
      .insert(commerceRateLimit)
      .values({
        id: createId('crl'),
        scope: input.scope,
        keyHash: keyHash(input.key),
        windowStartedAt,
        count: 1,
        expiresAt,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [
          commerceRateLimit.scope,
          commerceRateLimit.keyHash,
          commerceRateLimit.windowStartedAt,
        ],
        set: { count: sql`${commerceRateLimit.count} + 1` },
      })
      .returning({ count: commerceRateLimit.count })
    const count = row?.count ?? input.limit + 1
    return {
      allowed: count <= input.limit,
      remaining: Math.max(input.limit - count, 0),
      retryAt: expiresAt,
    }
  }
}
