import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  CommerceEvidenceStorage,
  type EvidenceStoragePort,
} from '../../src/lib/commerce/commerce-evidence-storage'
import { FinanceEvidenceService } from '../../src/lib/commerce/finance-evidence-service'
import { FoundationPurchaseService } from '../../src/lib/commerce/foundation-purchase-service'
import {
  getCustomerContributionStages,
  getFoundationTransparencyStages,
} from '../../src/lib/commerce/transparency-service'
import { getVenueFinanceView } from '../../src/lib/commerce/venue-finance-view'
import type { StorageObjectMetadata } from '../../src/lib/storage'
import { getPurchaseBySlugFrom } from '../../src/lib/transparency/queries'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined
const NOW = new Date('2026-09-12T19:00:00.000Z')
const ACTOR_ID = 'foundation-transparency-actor'
const FOUNDATION_ID = 'foundation-transparency-beneficiary'
const OTHER_FOUNDATION_ID = 'foundation-transparency-other'
const BANK_ID = 'foundation-transparency-bank'
const OTHER_BANK_ID = 'foundation-transparency-other-bank'

const hash = (value: string): string => createHash('sha256').update(value).digest('hex')

class FakeEvidenceObjects implements EvidenceStoragePort {
  readonly metadata = new Map<string, StorageObjectMetadata>()
  readonly signedUploads: { key: string; bucket: string; headers?: Record<string, string> }[] = []

  async getSignedUploadUrl(input: {
    key: string
    bucket: 'public' | 'private'
    expiresIn: number
    headers?: Record<string, string>
  }): Promise<string> {
    this.signedUploads.push(input)
    return `https://signed.test/${input.bucket}/${input.key}`
  }

  async getSignedDownloadUrl(input: {
    key: string
    bucket: 'private'
    expiresIn: number
  }): Promise<string> {
    return `https://download.test/${input.bucket}/${input.key}`
  }

  async head(input: { key: string; bucket: 'public' | 'private' }): Promise<StorageObjectMetadata> {
    return (
      this.metadata.get(`${input.bucket}:${input.key}`) ?? {
        exists: false,
        contentLength: null,
        contentType: null,
        etag: null,
        sha256: null,
      }
    )
  }

  publicUrl(key: string): string {
    return `https://evidence.test/${key}`
  }

  put(
    bucket: 'public' | 'private',
    key: string,
    file: { contentLength: number; contentType: string; sha256: string }
  ): void {
    this.metadata.set(`${bucket}:${key}`, {
      exists: true,
      contentLength: file.contentLength,
      contentType: file.contentType,
      etag: `etag-${file.sha256.slice(0, 8)}`,
      sha256: file.sha256,
    })
  }
}

const seedVerifiedFoundation = async (
  beneficiaryId: string,
  bankId: string,
  suffix: string
): Promise<void> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  await database.sql`
    insert into commerce_beneficiary
      (id, kind, legal_name, legal_identifier_hash, status, verified_by_user_id, verified_at)
    values
      (${beneficiaryId}, 'foundation', ${`Foundation ${suffix}`}, ${hash(`foundation:${suffix}`)},
       'verified', ${ACTOR_ID}, ${NOW.toISOString()})
  `
  await database.sql`
    insert into beneficiary_bank_version
      (id, beneficiary_id, version, destination_fingerprint, encrypted_details_storage_key,
       status, verification_method, verification_reference, verified_by_user_id, verified_at)
    values
      (${bankId}, ${beneficiaryId}, 1, ${hash(`destination:${suffix}`)},
       ${`private/bank/${suffix}.enc`}, 'verified', 'bank_certificate', ${`BANK-${suffix}`},
       ${ACTOR_ID}, ${NOW.toISOString()})
  `
}

const recordPurchase = async (suffix: string, amountMinor = BigInt(10_000)) => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const service = new FoundationPurchaseService({
    database: database.db,
    now: () => NOW,
    publicUrl: (key) => `https://evidence.test/${key}`,
  })
  return service.record({
    operationKey: `purchase:${suffix}`,
    beneficiaryId: FOUNDATION_ID,
    amountMinor,
    currency: 'COP',
    details: {
      slug: `compra-${suffix}`,
      title: `Compra ${suffix}`,
      municipality: 'Bogotá',
      department: 'Bogotá D.C.',
      purchasedAt: NOW,
      items: [
        {
          name: 'Material',
          quantity: '1',
          unit: 'unidad',
          unitCostMinor: amountMinor,
          subtotalMinor: amountMinor,
        },
      ],
    },
    actorUserId: ACTOR_ID,
  })
}

const addReviewedReceipt = async (purchaseId: string, suffix: string): Promise<string> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const evidence = new FinanceEvidenceService({ database: database.db, now: () => NOW })
  const recorded = await evidence.recordPrivate({
    ownerType: 'foundation_purchase',
    ownerId: purchaseId,
    kind: 'purchase_receipt',
    retainedPrivateStorageKey: `finance/private/foundation_purchase/${purchaseId}/${suffix}.pdf`,
    sha256: hash(`receipt:${suffix}`),
    retainedPrivateSize: 100,
    retainedPrivateContentType: 'application/pdf',
    actorUserId: ACTOR_ID,
  })
  await evidence.review({ evidenceId: recorded.evidenceId, reviewedByUserId: ACTOR_ID })
  return recorded.evidenceId
}

const verifyPurchase = async (suffix: string, amountMinor = BigInt(10_000)) => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const recorded = await recordPurchase(suffix, amountMinor)
  const receiptEvidenceId = await addReviewedReceipt(recorded.purchaseId, suffix)
  await new FoundationPurchaseService({ database: database.db, now: () => NOW }).verify({
    purchaseId: recorded.purchaseId,
    receiptEvidenceId,
    verifiedByUserId: ACTOR_ID,
  })
  return { ...recorded, receiptEvidenceId }
}

const publishEvidence = async (
  objects: FakeEvidenceObjects,
  evidenceId: string,
  suffix: string
): Promise<void> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const file = {
    contentType: 'application/pdf' as const,
    contentLength: 80,
    sha256: hash(`public:${suffix}`),
  }
  const custody = new CommerceEvidenceStorage({
    database: database.db,
    objects,
    now: () => NOW,
    nonce: () => `public-${suffix}`,
  })
  const prepared = await custody.preparePublicRedaction({ evidenceId, file })
  objects.put('public', prepared.key, file)
  await custody.publishRedaction({
    evidenceId,
    key: prepared.key,
    file,
    reviewedByUserId: ACTOR_ID,
  })
}

const seedPayoutSource = async (input: {
  suffix: string
  amountMinor: bigint
  beneficiaryId?: string
  bankId?: string
  fundingClassification?: 'real' | 'sandbox'
  sourceId?: string
}): Promise<string> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const operationId = `foundation-payout-${input.suffix}`
  const allocationId = `foundation-payout-allocation-${input.suffix}`
  const beneficiaryId = input.beneficiaryId ?? FOUNDATION_ID
  const bankId = input.bankId ?? BANK_ID
  await database.sql`
    insert into financial_operation
      (id, operation_key, content_hash, kind, beneficiary_bank_version_id, amount_minor,
       currency, funding_classification, status, external_reference, destination_fingerprint,
       requested_by_user_id, verified_by_user_id, verified_at)
    values
      (${operationId}, ${`foundation-payout:${input.suffix}`}, ${hash(`payout:${input.suffix}`)},
       'foundation_payout', ${bankId}, ${input.amountMinor.toString()}, 'COP',
       ${input.fundingClassification ?? 'real'}, 'bank_verified', ${`BANK-PAYOUT-${input.suffix}`},
       ${hash(`destination:${beneficiaryId}`)}, ${ACTOR_ID}, ${ACTOR_ID}, ${NOW.toISOString()})
  `
  await database.sql`
    insert into financial_operation_allocation
      (id, operation_id, source_type, source_id, amount_minor, ordinal)
    values
      (${allocationId}, ${operationId}, 'foundation_unit_allocation',
       ${input.sourceId ?? `unit-allocation-${input.suffix}`}, ${input.amountMinor.toString()}, 1)
  `
  return allocationId
}

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into "user" (id, name, email, email_verified)
    values (${ACTOR_ID}, 'Operadora', 'foundation@example.test', true)
  `
  await seedVerifiedFoundation(FOUNDATION_ID, BANK_ID, 'primary')
  await seedVerifiedFoundation(OTHER_FOUNDATION_ID, OTHER_BANK_ID, 'other')
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

describe('R2 financial evidence custody', () => {
  test('verifies private and public objects, keeps namespaces separate, and preserves private data', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const objects = new FakeEvidenceObjects()
    const file = {
      contentType: 'application/pdf' as const,
      contentLength: 120,
      sha256: hash('private-evidence'),
    }
    const custody = new CommerceEvidenceStorage({
      database: database.db,
      objects,
      now: () => NOW,
      nonce: () => 'private-file',
    })
    const prepared = await custody.preparePrivateUpload({
      ownerType: 'payment_charge',
      ownerId: 'charge-evidence-test',
      file,
    })
    expect(prepared.key).toStartWith('finance/private/payment_charge/charge-evidence-test/')
    expect(prepared.headers).toEqual({
      'Content-Type': 'application/pdf',
      'x-amz-meta-sha256': file.sha256,
    })
    objects.put('private', prepared.key, { ...file, contentLength: 119 })
    await expect(
      custody.finalizePrivate({
        ownerType: 'payment_charge',
        ownerId: 'charge-evidence-test',
        kind: 'deduction_report',
        key: prepared.key,
        file,
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow('size')

    objects.put('private', prepared.key, file)
    const finalized = await custody.finalizePrivate({
      ownerType: 'payment_charge',
      ownerId: 'charge-evidence-test',
      kind: 'deduction_report',
      key: prepared.key,
      file,
      actorUserId: ACTOR_ID,
    })
    const duplicate = await custody.finalizePrivate({
      ownerType: 'payment_charge',
      ownerId: 'charge-evidence-test',
      kind: 'deduction_report',
      key: prepared.key,
      file,
      actorUserId: ACTOR_ID,
    })
    expect(duplicate.duplicate).toBe(true)
    await expect(
      custody.preparePublicRedaction({ evidenceId: finalized.evidenceId, file })
    ).rejects.toThrow('reviewed')

    await new FinanceEvidenceService({ database: database.db, now: () => NOW }).review({
      evidenceId: finalized.evidenceId,
      reviewedByUserId: ACTOR_ID,
    })
    const publicFile = { ...file, contentLength: 90, sha256: hash('public-redaction') }
    const publicUpload = await custody.preparePublicRedaction({
      evidenceId: finalized.evidenceId,
      file: publicFile,
    })
    expect(publicUpload.key).toStartWith(`finance/public/${finalized.evidenceId}/`)
    expect(publicUpload.key).not.toBe(prepared.key)
    objects.put('public', publicUpload.key, publicFile)
    const published = await custody.publishRedaction({
      evidenceId: finalized.evidenceId,
      key: publicUpload.key,
      file: publicFile,
      reviewedByUserId: ACTOR_ID,
    })
    expect(published.publicUrl).toBe(`https://evidence.test/${publicUpload.key}`)
    expect(
      (
        await custody.publishRedaction({
          evidenceId: finalized.evidenceId,
          key: publicUpload.key,
          file: publicFile,
          reviewedByUserId: ACTOR_ID,
        })
      ).duplicate
    ).toBe(true)
    expect(await custody.privateDownloadUrl(finalized.evidenceId)).toContain(prepared.key)

    await custody.withdraw({
      evidenceId: finalized.evidenceId,
      actorUserId: ACTOR_ID,
      reason: 'La redacción debe corregirse',
    })
    expect((await objects.head({ key: prepared.key, bucket: 'private' })).exists).toBe(true)
    const [stored] = await database.sql`
      select status, retained_private_storage_key, public_redacted_storage_key
      from finance_evidence where id = ${finalized.evidenceId}
    `
    expect(stored?.status).toBe('withdrawn')
    expect(stored?.retained_private_storage_key).toBe(prepared.key)
    expect(stored?.public_redacted_storage_key).toBe(publicUpload.key)
    await custody.probeConfiguration()
  })
})

describe('foundation purchase verification and funding attribution', () => {
  test('is idempotent, evidence-gated, publication-gated, and correction-preserving', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const service = new FoundationPurchaseService({
      database: database.db,
      now: () => NOW,
      publicUrl: (key) => `https://evidence.test/${key}`,
    })
    const recorded = await recordPurchase('lifecycle')
    expect((await recordPurchase('lifecycle')).duplicate).toBe(true)
    await expect(
      service.record({
        operationKey: 'purchase:lifecycle',
        beneficiaryId: FOUNDATION_ID,
        amountMinor: BigInt(11_000),
        currency: 'COP',
        details: {
          slug: 'compra-lifecycle-conflict',
          title: 'Conflict',
          municipality: 'Bogotá',
          department: 'Bogotá D.C.',
          purchasedAt: NOW,
          items: [
            {
              name: 'Material',
              quantity: '1',
              unit: 'unidad',
              subtotalMinor: BigInt(11_000),
            },
          ],
        },
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow('different content')
    await expect(
      service.verify({
        purchaseId: recorded.purchaseId,
        receiptEvidenceId: 'missing-evidence',
        verifiedByUserId: ACTOR_ID,
      })
    ).rejects.toThrow('evidence')

    const receiptEvidenceId = await addReviewedReceipt(recorded.purchaseId, 'lifecycle')
    await service.verify({
      purchaseId: recorded.purchaseId,
      receiptEvidenceId,
      verifiedByUserId: ACTOR_ID,
    })
    await expect(
      service.publish({ purchaseId: recorded.purchaseId, actorUserId: ACTOR_ID })
    ).rejects.toThrow('published redacted receipt')

    const objects = new FakeEvidenceObjects()
    await publishEvidence(objects, receiptEvidenceId, 'lifecycle')
    const published = await service.publish({
      purchaseId: recorded.purchaseId,
      actorUserId: ACTOR_ID,
    })
    expect(published.publicUrl).toContain('finance/public/')
    expect(
      (await service.publish({ purchaseId: recorded.purchaseId, actorUserId: ACTOR_ID })).duplicate
    ).toBe(true)
    expect(await getPurchaseBySlugFrom(database.db, 'compra-lifecycle')).not.toBeNull()
    await new CommerceEvidenceStorage({
      database: database.db,
      objects,
      now: () => NOW,
    }).withdraw({
      evidenceId: receiptEvidenceId,
      actorUserId: ACTOR_ID,
      reason: 'La copia pública necesita una corrección',
    })
    expect(await getPurchaseBySlugFrom(database.db, 'compra-lifecycle')).toBeNull()

    const corrected = await service.record({
      operationKey: 'purchase:lifecycle:correction',
      beneficiaryId: FOUNDATION_ID,
      amountMinor: BigInt(9_000),
      currency: 'COP',
      correctionOfId: recorded.purchaseId,
      details: {
        slug: 'compra-lifecycle-corregida',
        title: 'Compra corregida',
        municipality: 'Bogotá',
        department: 'Bogotá D.C.',
        purchasedAt: NOW,
        items: [
          {
            name: 'Material corregido',
            quantity: '1',
            unit: 'unidad',
            subtotalMinor: BigInt(9_000),
          },
        ],
      },
      actorUserId: ACTOR_ID,
    })
    const [oldRow] = await database.sql`
      select fp.status, mp.status as material_status
      from foundation_purchase fp
      join material_purchase mp on mp.id = fp.material_purchase_id
      where fp.id = ${recorded.purchaseId}
    `
    expect(oldRow?.status).toBe('corrected')
    expect(oldRow?.material_status).toBe('draft')
    expect(corrected.purchaseId).not.toBe(recorded.purchaseId)
  })

  test('caps allocations by purchase and confirmed transfer under concurrency', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const service = new FoundationPurchaseService({ database: database.db, now: () => NOW })
    const first = await verifyPurchase('funding-first', BigInt(10_000))
    const source = await seedPayoutSource({ suffix: 'funding-cap', amountMinor: BigInt(8_000) })
    expect(
      (
        await service.allocateFunding({
          purchaseId: first.purchaseId,
          allocations: [{ payoutAllocationId: source, amountMinor: BigInt(6_000) }],
          actorUserId: ACTOR_ID,
        })
      ).allocatedMinor
    ).toBe(BigInt(6_000))
    expect(
      (
        await service.allocateFunding({
          purchaseId: first.purchaseId,
          allocations: [{ payoutAllocationId: source, amountMinor: BigInt(6_000) }],
          actorUserId: ACTOR_ID,
        })
      ).duplicate
    ).toBe(true)

    const second = await verifyPurchase('funding-second', BigInt(5_000))
    await expect(
      service.allocateFunding({
        purchaseId: second.purchaseId,
        allocations: [{ payoutAllocationId: source, amountMinor: BigInt(3_000) }],
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow('exceeds the confirmed transfer')

    const concurrentA = await verifyPurchase('funding-concurrent-a', BigInt(5_000))
    const concurrentB = await verifyPurchase('funding-concurrent-b', BigInt(5_000))
    const concurrentSource = await seedPayoutSource({
      suffix: 'funding-concurrency',
      amountMinor: BigInt(8_000),
    })
    const results = await Promise.allSettled(
      [concurrentA, concurrentB].map((purchase) =>
        new FoundationPurchaseService({ database: database!.db, now: () => NOW }).allocateFunding({
          purchaseId: purchase.purchaseId,
          allocations: [{ payoutAllocationId: concurrentSource, amountMinor: BigInt(5_000) }],
          actorUserId: ACTOR_ID,
        })
      )
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const otherSource = await seedPayoutSource({
      suffix: 'wrong-beneficiary',
      amountMinor: BigInt(5_000),
      beneficiaryId: OTHER_FOUNDATION_ID,
      bankId: OTHER_BANK_ID,
    })
    await expect(
      service.allocateFunding({
        purchaseId: second.purchaseId,
        allocations: [{ payoutAllocationId: otherSource, amountMinor: BigInt(1_000) }],
        actorUserId: ACTOR_ID,
      })
    ).rejects.toThrow('confirmed real foundation transfer')
  })
})

describe('V2 transparency stages', () => {
  test('separates allocated, backed, transferred, and verified-purchase amounts', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const baseline = await getFoundationTransparencyStages(database.db)
    const userId = 'transparency-customer'
    const venueId = 'transparency-venue'
    await database.sql`
      insert into "user" (id, name, email, email_verified)
      values (${userId}, 'Cliente', 'transparency-customer@example.test', true)
    `
    await database.sql`
      insert into venue
        (id, slug, name, type, address_line, city, department, latitude, longitude, status)
      values
        (${venueId}, ${venueId}, 'Venue transparency', 'bar', 'Calle 1', 'Bogotá',
         'Bogotá D.C.', 4.710989, -74.072090, 'published')
    `
    await database.sql`
      insert into venue_product
        (id, venue_id, slug, name, kind, price, currency, donation_percentage, status)
      values
        ('transparency-product', ${venueId}, 'transparency-product', 'Producto', 'coctel',
         100.00, 'COP', 50.00, 'published')
    `
    await database.sql`
      insert into allocation_policy (id, version, name, effective_at)
      values ('transparency-policy', 9001, 'Transparency policy', now() - interval '1 day')
    `

    const seedAppUnit = async (input: {
      suffix: string
      status: 'approved' | 'disputed'
      cleared: boolean
      donationMinor?: bigint
      lifecycle?: 'redeemed' | 'refunded'
      classification?: 'real' | 'sandbox'
    }): Promise<string | null> => {
      const orderId = `transparency-order-${input.suffix}`
      const snapshotId = `transparency-snapshot-${input.suffix}`
      const redemptionId = `transparency-redemption-${input.suffix}`
      const unitId = `transparency-unit-${input.suffix}`
      const attemptId = `transparency-attempt-${input.suffix}`
      const chargeId = `transparency-charge-${input.suffix}`
      await database!.sql`
        insert into product_order
          (id, product_id, venue_id, user_id, buyer_name, buyer_email, quantity, unit_price,
           donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
           public_token, pay_method, status)
        values
          (${orderId}, 'transparency-product', ${venueId}, ${userId}, 'Cliente',
           'transparency-customer@example.test', 1, 100.00, 50.00, 50.00, 50.00, 100.00,
           ${`token-${input.suffix}`}, 'app', 'paid')
      `
      await database!.sql`
        insert into commerce_order_snapshot
          (id, order_id, product_name, product_kind, venue_name, currency, quantity,
           unit_gross_minor, donation_basis_points, allocation_policy_id,
           foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
           funding_classification)
        values
          (${snapshotId}, ${orderId}, 'Producto', 'coctel', 'Venue transparency', 'COP', 1,
           10000, 5000, 'transparency-policy', ${FOUNDATION_ID}, 'Foundation primary',
           'Reparto', ${input.classification ?? 'real'})
      `
      await database!.sql`
        insert into order_redemption (id, order_id, code, status)
        values (${redemptionId}, ${orderId}, ${`CODE-${input.suffix}`},
                ${input.lifecycle === 'refunded' ? 'void' : 'redeemed'})
      `
      await database!.sql`
        insert into commerce_order_unit
          (id, order_snapshot_id, redemption_id, ordinal, gross_minor, lifecycle_status,
           redeemed_at)
        values
          (${unitId}, ${snapshotId}, ${redemptionId}, 1, 10000,
           ${input.lifecycle ?? 'redeemed'}, ${NOW.toISOString()})
      `
      await database!.sql`
        insert into payment_attempt
          (id, order_snapshot_id, submission_key, request_hash, provider,
           provider_config_version, merchant_account_key, environment,
           provider_attempt_reference, status)
        values
          (${attemptId}, ${snapshotId}, ${`submission-${input.suffix}`}, 'hash', 'epayco',
           'live-v1', 'merchant', 'live', ${`provider-${input.suffix}`}, 'approved')
      `
      await database!.sql`
        insert into payment_charge
          (id, attempt_id, provider, merchant_account_key, environment, provider_reference,
           gross_minor, currency, status, cleared_at)
        values
          (${chargeId}, ${attemptId}, 'epayco', 'merchant', 'live',
           ${`provider-${input.suffix}`}, 10000, 'COP', ${input.status},
           ${input.cleared ? NOW.toISOString() : null})
      `
      if (input.donationMinor === undefined) return null
      const runId = `transparency-run-${input.suffix}`
      const allocationId = `transparency-allocation-${input.suffix}`
      await database!.sql`
        insert into allocation_run
          (id, operation_key, input_digest, order_snapshot_id, charge_id, policy_id,
           revision, gross_minor, deduction_minor, net_minor, status)
        values
          (${runId}, ${`transparency-run:${input.suffix}`}, ${hash(`run:${input.suffix}`)},
           ${snapshotId}, ${chargeId}, 'transparency-policy', 1, 10000, 0, 10000, 'final')
      `
      await database!.sql`
        insert into unit_allocation
          (id, allocation_run_id, unit_id, gross_minor, deduction_minor, net_minor,
           donation_minor, venue_minor)
        values
          (${allocationId}, ${runId}, ${unitId}, 10000, 0, 10000,
           ${input.donationMinor.toString()}, ${(BigInt(10_000) - input.donationMinor).toString()})
      `
      return allocationId
    }

    const clearedAllocationId = await seedAppUnit({
      suffix: 'cleared',
      status: 'approved',
      cleared: true,
      donationMinor: BigInt(4_000),
    })
    await seedAppUnit({
      suffix: 'disputed',
      status: 'disputed',
      cleared: false,
      donationMinor: BigInt(2_000),
    })
    await seedAppUnit({
      suffix: 'refunded',
      status: 'approved',
      cleared: true,
      donationMinor: BigInt(5_000),
      lifecycle: 'refunded',
    })
    await seedAppUnit({
      suffix: 'sandbox',
      status: 'approved',
      cleared: true,
      donationMinor: BigInt(5_000),
      classification: 'sandbox',
    })
    await seedAppUnit({ suffix: 'pending-allocation', status: 'approved', cleared: false })

    await database.sql`
      insert into venue_credit_policy
        (id, operation_key, content_hash, venue_id, version, limit_minor, currency,
         status, approved_by_user_id, effective_at)
      values
        ('transparency-credit-policy', 'transparency:credit:policy', 'hash', ${venueId}, 1,
         10000, 'COP', 'active', ${ACTOR_ID}, ${NOW.toISOString()})
    `
    await database.sql`
      insert into product_order
        (id, product_id, venue_id, user_id, buyer_name, buyer_email, quantity, unit_price,
         donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
         public_token, pay_method, status)
      values
        ('transparency-order-cash', 'transparency-product', ${venueId}, ${userId}, 'Cliente',
         'transparency-customer@example.test', 1, 100.00, 40.00, 40.00, 60.00, 100.00,
         'token-cash', 'bar', 'paid')
    `
    await database.sql`
      insert into commerce_order_snapshot
        (id, order_id, product_name, product_kind, venue_name, currency, quantity,
         unit_gross_minor, donation_basis_points, allocation_policy_id,
         foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
         funding_classification)
      values
        ('transparency-snapshot-cash', 'transparency-order-cash', 'Producto', 'coctel',
         'Venue transparency', 'COP', 1, 10000, 4000, 'transparency-policy', ${FOUNDATION_ID},
         'Foundation primary', 'Reparto', 'real')
    `
    await database.sql`
      insert into order_redemption (id, order_id, code, status)
      values ('transparency-redemption-cash', 'transparency-order-cash', 'CODE-CASH', 'redeemed')
    `
    await database.sql`
      insert into commerce_order_unit
        (id, order_snapshot_id, redemption_id, ordinal, gross_minor, lifecycle_status, redeemed_at)
      values
        ('transparency-unit-cash', 'transparency-snapshot-cash',
         'transparency-redemption-cash', 1, 10000, 'redeemed', ${NOW.toISOString()})
    `
    await database.sql`
      insert into credit_reservation
        (id, operation_key, content_hash, policy_id, venue_id, unit_id, amount_minor,
         shopper_key, currency, status, expires_at, consumed_at)
      values
        ('transparency-reservation-cash', 'transparency:reservation:cash', 'hash',
         'transparency-credit-policy', ${venueId}, 'transparency-unit-cash', 4000, 'shopper',
         'COP', 'consumed', ${new Date(NOW.getTime() + 60_000).toISOString()},
         ${NOW.toISOString()})
    `
    await database.sql`
      insert into credit_debt
        (id, venue_id, unit_id, reservation_id, principal_minor, outstanding_minor,
         currency, incurred_at, due_at)
      values
        ('transparency-debt-cash', ${venueId}, 'transparency-unit-cash',
         'transparency-reservation-cash', 4000, 1000, 'COP', ${NOW.toISOString()},
         ${new Date(NOW.getTime() + 604_800_000).toISOString()})
    `
    await database.sql`
      insert into financial_operation
        (id, operation_key, content_hash, kind, venue_id, amount_minor, currency,
         funding_classification, status, requested_by_user_id)
      values
        ('transparency-venue-payout-reserved', 'transparency:venue:payout:reserved', 'hash-1',
         'venue_payout', ${venueId}, 2000, 'COP', 'real', 'prepared', ${ACTOR_ID}),
        ('transparency-venue-payout-paid', 'transparency:venue:payout:paid', 'hash-2',
         'venue_payout', ${venueId}, 3000, 'COP', 'real', 'bank_verified', ${ACTOR_ID})
    `

    if (!clearedAllocationId) throw new Error('Cleared allocation was not created')
    await seedPayoutSource({
      suffix: 'customer-transfer',
      amountMinor: BigInt(1_500),
      sourceId: clearedAllocationId,
    })
    const stagePurchase = await verifyPurchase('stages-published', BigInt(5_000))
    const stageObjects = new FakeEvidenceObjects()
    await publishEvidence(stageObjects, stagePurchase.receiptEvidenceId, 'stages-published')
    const purchaseService = new FoundationPurchaseService({
      database: database.db,
      now: () => NOW,
      publicUrl: (key) => `https://evidence.test/${key}`,
    })
    await purchaseService.publish({ purchaseId: stagePurchase.purchaseId, actorUserId: ACTOR_ID })
    const purchaseSource = await seedPayoutSource({
      suffix: 'stages-purchase-source',
      amountMinor: BigInt(4_000),
    })
    await purchaseService.allocateFunding({
      purchaseId: stagePurchase.purchaseId,
      allocations: [{ payoutAllocationId: purchaseSource, amountMinor: BigInt(4_000) }],
      actorUserId: ACTOR_ID,
    })
    const stages = await getFoundationTransparencyStages(database.db)
    expect(stages.allocatedMinor - baseline.allocatedMinor).toBe(BigInt(10_000))
    expect(stages.backedMinor - baseline.backedMinor).toBe(BigInt(7_000))
    expect(stages.transferredMinor - baseline.transferredMinor).toBe(BigInt(5_500))
    expect(stages.verifiedPurchaseMinor - baseline.verifiedPurchaseMinor).toBe(BigInt(4_000))
    expect(stages.publishedPurchaseTotalMinor - baseline.publishedPurchaseTotalMinor).toBe(
      BigInt(5_000)
    )

    const customer = await getCustomerContributionStages(database.db, userId)
    expect(customer).toEqual({
      pendingAllocationUnits: 1,
      finalDonationMinor: BigInt(10_000),
      transferredMinor: BigInt(1_500),
    })

    const venueFinances = await getVenueFinanceView(database.db, venueId, NOW)
    expect(venueFinances).toEqual({
      earnedMinor: BigInt(12_000),
      pendingMinor: BigInt(13_000),
      payoutReservedMinor: BigInt(2_000),
      paidMinor: BigInt(3_000),
      debtMinor: BigInt(1_000),
      creditLimitMinor: BigInt(10_000),
      creditAvailableMinor: BigInt(9_000),
      oldestDebtDueAt: new Date(NOW.getTime() + 604_800_000),
    })
  })
})
