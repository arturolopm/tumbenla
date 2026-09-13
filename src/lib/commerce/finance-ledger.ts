import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import type { db } from '@/database'
import { financeAccount, financeEntry, financeTransaction } from '@/database/commerce-schema'
import { createId } from '@/lib/utils/id'

export type FinanceTransactionConnection = Parameters<Parameters<typeof db.transaction>[0]>[0]

type FundingClassification = 'real' | 'sandbox' | 'legacy_unverified'

export const ensureFinanceAccount = async (
  transaction: FinanceTransactionConnection,
  input: {
    kind: string
    ownerKey: string
    venueId?: string | null
    currency: 'COP'
    fundingClassification: FundingClassification
  }
): Promise<string> => {
  await transaction
    .insert(financeAccount)
    .values({
      id: createId('fac'),
      kind: input.kind,
      ownerKey: input.ownerKey,
      venueId: input.venueId,
      currency: input.currency,
      fundingClassification: input.fundingClassification,
    })
    .onConflictDoNothing()

  const [account] = await transaction
    .select({ id: financeAccount.id })
    .from(financeAccount)
    .where(
      and(
        eq(financeAccount.kind, input.kind),
        eq(financeAccount.ownerKey, input.ownerKey),
        eq(financeAccount.currency, input.currency),
        eq(financeAccount.fundingClassification, input.fundingClassification)
      )
    )
    .limit(1)
  if (!account) throw new Error('The required finance account could not be resolved')
  return account.id
}

const contentHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

export const postFinanceTransaction = async (
  transaction: FinanceTransactionConnection,
  input: {
    operationKey: string
    kind: string
    currency: 'COP'
    orderSnapshotId?: string
    operationId?: string
    reversalOfId?: string
    createdByUserId?: string
    entries: readonly { accountId: string; amountMinor: bigint; memo?: string }[]
    now: Date
  }
): Promise<{ transactionId: string; duplicate: boolean }> => {
  const entries = input.entries.filter((entry) => entry.amountMinor !== BigInt(0))
  if (entries.length < 2) throw new Error('A finance transaction requires at least two entries')
  if (entries.reduce((sum, entry) => sum + entry.amountMinor, BigInt(0)) !== BigInt(0)) {
    throw new Error('Finance transaction entries must balance to zero')
  }

  const hash = contentHash({
    kind: input.kind,
    currency: input.currency,
    orderSnapshotId: input.orderSnapshotId ?? null,
    operationId: input.operationId ?? null,
    reversalOfId: input.reversalOfId ?? null,
    createdByUserId: input.createdByUserId ?? null,
    entries: entries.map((entry, index) => ({
      ordinal: index + 1,
      accountId: entry.accountId,
      amountMinor: String(entry.amountMinor),
      memo: entry.memo ?? null,
    })),
  })
  const transactionId = createId('ftx')
  const [inserted] = await transaction
    .insert(financeTransaction)
    .values({
      id: transactionId,
      operationKey: input.operationKey,
      contentHash: hash,
      kind: input.kind,
      currency: input.currency,
      status: 'draft',
      orderSnapshotId: input.orderSnapshotId,
      operationId: input.operationId,
      reversalOfId: input.reversalOfId,
      createdByUserId: input.createdByUserId,
      createdAt: input.now,
    })
    .onConflictDoNothing({ target: financeTransaction.operationKey })
    .returning({ id: financeTransaction.id })

  if (!inserted) {
    const [existing] = await transaction
      .select({
        id: financeTransaction.id,
        contentHash: financeTransaction.contentHash,
        status: financeTransaction.status,
      })
      .from(financeTransaction)
      .where(eq(financeTransaction.operationKey, input.operationKey))
      .limit(1)
    if (!existing) throw new Error('The existing finance operation could not be resolved')
    if (existing.contentHash !== hash) {
      throw new Error('Finance operation key was reused with different content')
    }
    if (existing.status !== 'posted') {
      throw new Error('The existing finance operation is not posted')
    }
    return { transactionId: existing.id, duplicate: true }
  }

  await transaction.insert(financeEntry).values(
    entries.map((entry, index) => ({
      id: createId('fen'),
      transactionId,
      accountId: entry.accountId,
      amountMinor: entry.amountMinor,
      ordinal: index + 1,
      memo: entry.memo,
      createdAt: input.now,
    }))
  )
  await transaction
    .update(financeTransaction)
    .set({ status: 'posted', postedAt: input.now })
    .where(eq(financeTransaction.id, transactionId))

  return { transactionId, duplicate: false }
}
