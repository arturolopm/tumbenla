import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { AllocationService } from '../../src/lib/commerce/allocation-service'
import { BeneficiaryService } from '../../src/lib/commerce/beneficiary-service'
import { ChargeDisputeService } from '../../src/lib/commerce/charge-dispute-service'
import { FinanceEvidenceService } from '../../src/lib/commerce/finance-evidence-service'
import { loadAdminFinanceOverview } from '../../src/lib/commerce/finance-admin-queries'
import { ensureFinanceAccount, postFinanceTransaction } from '../../src/lib/commerce/finance-ledger'
import { PayoutService } from '../../src/lib/commerce/payout-service'
import { CommerceRefundService } from '../../src/lib/commerce/refund-service'
import { TreasuryService } from '../../src/lib/commerce/treasury-service'
import type { CommerceTestDatabase } from './database'
import { createCommerceTestDatabase } from './database'

let database: CommerceTestDatabase | undefined
const ACTOR_ID = 'financial-operations-actor'
const NOW = new Date('2026-09-12T16:00:00.000Z')
const destination = (suffix: string): string =>
  createHash('sha256').update(`destination:${suffix}`).digest('hex')
const hash = (value: string): string => createHash('sha256').update(value).digest('hex')

let foundationId = ''
let foundationBankVersionId = ''

beforeAll(async () => {
  database = await createCommerceTestDatabase()
  await database.sql`
    insert into "user" (id, name, email, email_verified)
    values (${ACTOR_ID}, 'Operadora', 'finanzas@example.test', true)
  `
  await database.sql`
    insert into allocation_policy (id, version, name, effective_at)
    values ('financial-operations-policy', 1, 'Política financiera', now() - interval '1 day')
  `
  const beneficiary = new BeneficiaryService({ database: database.db, now: () => NOW })
  const evidence = new FinanceEvidenceService({ database: database.db, now: () => NOW })
  const foundation = await beneficiary.register({
    kind: 'foundation',
    legalName: 'Fundación verificada',
    legalIdentifierHash: hash('foundation-legal-id'),
    actorUserId: ACTOR_ID,
  })
  foundationId = foundation.beneficiaryId
  const agreement = await evidence.recordPrivate({
    ownerType: 'commerce_beneficiary',
    ownerId: foundationId,
    kind: 'signed_agreement',
    retainedPrivateStorageKey: `private/agreements/${foundationId}.pdf`,
    sha256: hash('foundation-agreement'),
    actorUserId: ACTOR_ID,
  })
  await evidence.review({ evidenceId: agreement.evidenceId, reviewedByUserId: ACTOR_ID })
  await beneficiary.verify({
    beneficiaryId: foundationId,
    agreementEvidenceId: agreement.evidenceId,
    verifiedByUserId: ACTOR_ID,
  })
  const bank = await beneficiary.addBankVersion({
    beneficiaryId: foundationId,
    destinationFingerprint: destination('foundation-v1'),
    encryptedDetailsStorageKey: `private/banks/${foundationId}/v1.enc`,
    actorUserId: ACTOR_ID,
  })
  foundationBankVersionId = bank.bankVersionId
  const bankEvidence = await evidence.recordPrivate({
    ownerType: 'beneficiary_bank_version',
    ownerId: bank.bankVersionId,
    kind: 'bank_ownership_record',
    retainedPrivateStorageKey: `private/bank-verification/${bank.bankVersionId}.pdf`,
    sha256: hash('foundation-bank-evidence'),
    actorUserId: ACTOR_ID,
  })
  await evidence.review({ evidenceId: bankEvidence.evidenceId, reviewedByUserId: ACTOR_ID })
  await beneficiary.verifyBankVersion({
    bankVersionId: bank.bankVersionId,
    evidenceId: bankEvidence.evidenceId,
    verificationMethod: 'bank_certificate_and_call',
    verificationReference: 'FOUNDATION-VERIFY-1',
    verifiedByUserId: ACTOR_ID,
  })

  const treasury = new TreasuryService({ database: database.db, now: () => NOW })
  await treasury.configurePolicy({
    operationKey: 'treasury:real:initial',
    fundingClassification: 'real',
    minimumOperatingReserveMinor: BigInt(0),
    approvedByUserId: ACTOR_ID,
  })
  await treasury.configurePolicy({
    operationKey: 'treasury:sandbox:initial',
    fundingClassification: 'sandbox',
    minimumOperatingReserveMinor: BigInt(0),
    approvedByUserId: ACTOR_ID,
  })
}, 120_000)

afterAll(async () => {
  await database?.close()
}, 30_000)

type FinancialFixture = Readonly<{
  chargeId: string
  orderId: string
  snapshotId: string
  unitId: string
  unitAllocationId: string
  venueId: string
  venueBankVersionId: string
}>

type MixedRefundFixture = Readonly<{
  customerOrderId: string
  firstOrderId: string
  secondOrderId: string
  firstUnitId: string
  secondUnitId: string
}>

const createVerifiedVenueBeneficiary = async (suffix: string, venueId: string): Promise<string> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const beneficiary = new BeneficiaryService({ database: database.db, now: () => NOW })
  const evidence = new FinanceEvidenceService({ database: database.db, now: () => NOW })
  const registered = await beneficiary.register({
    kind: 'venue',
    venueId,
    legalName: `Venue legal ${suffix}`,
    legalIdentifierHash: hash(`venue-legal:${suffix}`),
    actorUserId: ACTOR_ID,
  })
  const agreement = await evidence.recordPrivate({
    ownerType: 'commerce_beneficiary',
    ownerId: registered.beneficiaryId,
    kind: 'signed_agreement',
    retainedPrivateStorageKey: `private/agreements/venue-${suffix}.pdf`,
    sha256: hash(`venue-agreement:${suffix}`),
    actorUserId: ACTOR_ID,
  })
  await evidence.review({ evidenceId: agreement.evidenceId, reviewedByUserId: ACTOR_ID })
  await beneficiary.verify({
    beneficiaryId: registered.beneficiaryId,
    agreementEvidenceId: agreement.evidenceId,
    verifiedByUserId: ACTOR_ID,
  })
  const bank = await beneficiary.addBankVersion({
    beneficiaryId: registered.beneficiaryId,
    destinationFingerprint: destination(`venue:${suffix}:v1`),
    encryptedDetailsStorageKey: `private/banks/venue-${suffix}/v1.enc`,
    actorUserId: ACTOR_ID,
  })
  const proof = await evidence.recordPrivate({
    ownerType: 'beneficiary_bank_version',
    ownerId: bank.bankVersionId,
    kind: 'bank_ownership_record',
    retainedPrivateStorageKey: `private/bank-verification/venue-${suffix}.pdf`,
    sha256: hash(`venue-bank:${suffix}`),
    actorUserId: ACTOR_ID,
  })
  await evidence.review({ evidenceId: proof.evidenceId, reviewedByUserId: ACTOR_ID })
  await beneficiary.verifyBankVersion({
    bankVersionId: bank.bankVersionId,
    evidenceId: proof.evidenceId,
    verificationMethod: 'bank_certificate_and_call',
    verificationReference: `VENUE-VERIFY-${suffix}`,
    verifiedByUserId: ACTOR_ID,
  })
  return bank.bankVersionId
}

const seedFinancialUnit = async (input: {
  suffix: string
  fundingClassification: 'real' | 'sandbox'
  redeemed: boolean
  deduction?: string
}): Promise<FinancialFixture> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const venueId = `financial-venue-${input.suffix}`
  const productId = `financial-product-${input.suffix}`
  const orderId = `financial-order-${input.suffix}`
  const snapshotId = `financial-snapshot-${input.suffix}`
  const unitId = `financial-unit-${input.suffix}`
  const redemptionId = `financial-redemption-${input.suffix}`
  const attemptId = `financial-attempt-${input.suffix}`
  const chargeId = `financial-charge-${input.suffix}`
  const environment = input.fundingClassification === 'real' ? 'live' : 'test'
  await database.sql`
    insert into venue
      (id, slug, name, type, address_line, city, department, latitude, longitude, status)
    values
      (${venueId}, ${venueId}, ${`Venue ${input.suffix}`}, 'bar', 'Calle 1', 'Bogotá',
       'Bogotá D.C.', 4.710989, -74.072090, 'published')
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, price, currency, donation_percentage, status)
    values
      (${productId}, ${venueId}, ${productId}, ${`Product ${input.suffix}`}, 'coctel',
       100.00, 'COP', 50.00, 'published')
  `
  await database.sql`
    insert into product_order
      (id, product_id, venue_id, buyer_name, buyer_email, quantity, unit_price,
       donation_percentage, unit_donation_amount, unit_venue_amount, total_amount,
       public_token, pay_method, status, provider, provider_reference, paid_at)
    values
      (${orderId}, ${productId}, ${venueId}, 'Persona', 'persona@example.test', 1, 100.00,
       50.00, 50.00, 50.00, 100.00, ${`token-${input.suffix}`}, 'app', 'paid', 'epayco',
       ${`reference-${input.suffix}`}, now())
  `
  await database.sql`
    insert into commerce_order_snapshot
      (id, order_id, product_name, product_kind, venue_name, currency, quantity,
       unit_gross_minor, donation_basis_points, allocation_policy_id,
       foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
       funding_classification)
    values
      (${snapshotId}, ${orderId}, ${`Product ${input.suffix}`}, 'coctel',
       ${`Venue ${input.suffix}`}, 'COP', 1, 10000, 5000, 'financial-operations-policy',
       ${foundationId}, 'Fundación verificada', 'Reparto de prueba',
       ${input.fundingClassification})
  `
  await database.sql`
    insert into order_redemption (id, order_id, code, status)
    values (${redemptionId}, ${orderId}, ${`CODE-${input.suffix}`},
            ${input.redeemed ? 'redeemed' : 'issued'})
  `
  await database.sql`
    insert into commerce_order_unit
      (id, order_snapshot_id, redemption_id, ordinal, gross_minor, lifecycle_status, redeemed_at)
    values
      (${unitId}, ${snapshotId}, ${redemptionId}, 1, 10000,
       ${input.redeemed ? 'redeemed' : 'issued'}, ${input.redeemed ? NOW.toISOString() : null})
  `
  await database.sql`
    insert into payment_attempt
      (id, order_snapshot_id, submission_key, request_hash, provider,
       provider_config_version, merchant_account_key, environment,
       provider_attempt_reference, status)
    values
      (${attemptId}, ${snapshotId}, ${`submission-${input.suffix}`}, 'hash', 'epayco',
       ${`${environment}-v1`}, 'merchant-financial', ${environment},
       ${`reference-${input.suffix}`}, 'approved')
  `
  await database.sql`
    insert into payment_charge
      (id, attempt_id, provider, merchant_account_key, environment, provider_reference,
       provider_transaction_id, gross_minor, currency, status, approved_at)
    values
      (${chargeId}, ${attemptId}, 'epayco', 'merchant-financial', ${environment},
       ${`reference-${input.suffix}`}, ${`transaction-${input.suffix}`}, 10000, 'COP',
       'approved', now())
  `
  await database.sql`
    insert into finance_account (id, kind, owner_key, currency, funding_classification)
    values
      (${`receivable-${input.fundingClassification}`}, 'gateway_receivable',
       ${`epayco:merchant-financial:${environment}`}, 'COP', ${input.fundingClassification}),
      (${`held-${input.suffix}`}, 'customer_funds_held', ${snapshotId}, 'COP',
       ${input.fundingClassification})
    on conflict do nothing
  `
  await database.sql.begin(async (transaction) => {
    await transaction`
      insert into finance_transaction
        (id, operation_key, content_hash, kind, currency, status, order_snapshot_id)
      values (${`approval-${input.suffix}`}, ${`approval-op-${input.suffix}`}, 'approval-hash',
              'payment_approved', 'COP', 'draft', ${snapshotId})
    `
    await transaction`
      insert into finance_entry (id, transaction_id, account_id, amount_minor, ordinal)
      values
        (${`approval-debit-${input.suffix}`}, ${`approval-${input.suffix}`},
         ${`receivable-${input.fundingClassification}`}, 10000, 1),
        (${`approval-credit-${input.suffix}`}, ${`approval-${input.suffix}`},
         ${`held-${input.suffix}`}, -10000, 2)
    `
    await transaction`
      update finance_transaction set status = 'posted', posted_at = now()
      where id = ${`approval-${input.suffix}`}
    `
  })
  const deductionEvidenceId = `financial-deduction-evidence-${input.suffix}`
  if (input.deduction) {
    await database.sql`
      insert into finance_evidence
        (id, owner_type, owner_id, kind, retained_private_storage_key, sha256, status,
         reviewed_by_user_id, reviewed_at)
      values (${deductionEvidenceId}, 'payment_charge', ${chargeId},
              'provider_settlement_report',
              ${`private/deductions/${input.suffix}.pdf`}, ${hash(`deduction:${input.suffix}`)},
              'reviewed', ${ACTOR_ID}, ${NOW.toISOString()})
    `
  }
  const allocation = await new AllocationService({
    database: database.db,
    now: () => NOW,
  }).reconcileCharge({
    chargeId,
    operationKey: `allocation:financial:${input.suffix}`,
    deductions: input.deduction
      ? [
          {
            externalKey: 'gateway-fee',
            kind: 'gateway_fee',
            amount: input.deduction,
            finality: 'final',
            evidenceId: deductionEvidenceId,
          },
        ]
      : [],
  })
  const venueBankVersionId = await createVerifiedVenueBeneficiary(input.suffix, venueId)
  const [source] = await database.sql<{ id: string }[]>`
    select id from unit_allocation where allocation_run_id = ${allocation.allocationRunId}
  `
  if (!source) throw new Error('Allocation source was not created')
  return {
    chargeId,
    orderId,
    snapshotId,
    unitId,
    unitAllocationId: source.id,
    venueId,
    venueBankVersionId,
  }
}

const extendToMixedRefundOrder = async (
  fixture: FinancialFixture,
  suffix: string
): Promise<MixedRefundFixture> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const customerOrderId = `financial-customer-order-${suffix}`
  const secondProductId = `financial-product-${suffix}-second`
  const secondOrderId = `financial-order-${suffix}-second`
  const secondSnapshotId = `financial-snapshot-${suffix}-second`
  const secondRedemptionId = `financial-redemption-${suffix}-second`
  const secondUnitId = `financial-unit-${suffix}-second`

  await database.sql`
    insert into customer_order
      (id, venue_id, buyer_name, buyer_email, total_units, total_amount, public_token,
       pay_method, status, provider, provider_reference, paid_at)
    values
      (${customerOrderId}, ${fixture.venueId}, 'Persona', 'persona@example.test', 2, 200.00,
       ${`customer-token-${suffix}`}, 'app', 'paid', 'epayco', ${`reference-${suffix}`}, now())
  `
  await database.sql`
    update product_order
    set customer_order_id = ${customerOrderId}, line_ordinal = 1
    where id = ${fixture.orderId}
  `
  await database.sql`
    insert into venue_product
      (id, venue_id, slug, name, kind, price, currency, donation_percentage, status)
    values
      (${secondProductId}, ${fixture.venueId}, ${secondProductId}, 'Second product', 'cerveza',
       100.00, 'COP', 40.00, 'published')
  `
  await database.sql`
    insert into product_order
      (id, customer_order_id, line_ordinal, product_id, venue_id, buyer_name, buyer_email,
       quantity, unit_price, donation_percentage, unit_donation_amount, unit_venue_amount,
       total_amount, public_token, pay_method, status, paid_at)
    values
      (${secondOrderId}, ${customerOrderId}, 2, ${secondProductId}, ${fixture.venueId}, 'Persona',
       'persona@example.test', 1, 100.00, 40.00, 40.00, 60.00, 100.00,
       ${`line-token-${suffix}-second`}, 'app', 'paid', now())
  `
  await database.sql`
    insert into commerce_order_snapshot
      (id, order_id, product_name, product_kind, venue_name, currency, quantity,
       unit_gross_minor, donation_basis_points, allocation_policy_id,
       foundation_beneficiary_id, foundation_legal_name, policy_disclosure,
       funding_classification)
    values
      (${secondSnapshotId}, ${secondOrderId}, 'Second product', 'cerveza', ${`Venue ${suffix}`},
       'COP', 1, 10000, 4000, 'financial-operations-policy', ${foundationId},
       'Fundación verificada', 'Reparto de prueba', 'sandbox')
  `
  await database.sql`
    insert into order_redemption (id, order_id, code, status)
    values (${secondRedemptionId}, ${secondOrderId}, ${`CODE-${suffix}-SECOND`}, 'issued')
  `
  await database.sql`
    insert into commerce_order_unit
      (id, order_snapshot_id, redemption_id, ordinal, gross_minor, lifecycle_status)
    values (${secondUnitId}, ${secondSnapshotId}, ${secondRedemptionId}, 1, 10000, 'issued')
  `
  await database.sql`
    update payment_attempt set customer_order_id = ${customerOrderId}
    where order_snapshot_id = ${fixture.snapshotId}
  `
  await database.sql`
    update payment_charge set gross_minor = 20000 where id = ${fixture.chargeId}
  `
  await database.sql`
    update finance_account set owner_key = ${customerOrderId}
    where kind = 'customer_funds_held' and owner_key = ${fixture.snapshotId}
  `
  return {
    customerOrderId,
    firstOrderId: fixture.orderId,
    secondOrderId,
    firstUnitId: fixture.unitId,
    secondUnitId,
  }
}

const bindFixtureToCustomerOrder = async (
  fixture: FinancialFixture,
  suffix: string
): Promise<string> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const customerOrderId = `financial-customer-order-${suffix}`
  await database.sql`
    insert into customer_order
      (id, venue_id, buyer_name, buyer_email, total_units, total_amount, public_token,
       pay_method, status, provider, provider_reference, paid_at)
    select ${customerOrderId}, venue_id, buyer_name, buyer_email, quantity::integer, total_amount,
           ${`customer-token-${suffix}`}, pay_method, status, provider, provider_reference, paid_at
    from product_order where id = ${fixture.orderId}
  `
  await database.sql`
    update product_order
    set customer_order_id = ${customerOrderId}, line_ordinal = 1
    where id = ${fixture.orderId}
  `
  await database.sql`
    update payment_attempt set customer_order_id = ${customerOrderId}
    where order_snapshot_id = ${fixture.snapshotId}
  `
  return customerOrderId
}

const reviewedOperationEvidence = async (operationId: string, suffix: string): Promise<string> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  const service = new FinanceEvidenceService({ database: database.db, now: () => NOW })
  const evidence = await service.recordPrivate({
    ownerType: 'financial_operation',
    ownerId: operationId,
    kind: 'bank_record',
    retainedPrivateStorageKey: `private/operations/${suffix}.pdf`,
    sha256: hash(`operation-evidence:${suffix}`),
    actorUserId: ACTOR_ID,
  })
  await service.review({ evidenceId: evidence.evidenceId, reviewedByUserId: ACTOR_ID })
  return evidence.evidenceId
}

const addOperatingCash = async (
  fundingClassification: 'real' | 'sandbox',
  amountMinor: bigint,
  suffix: string
): Promise<void> => {
  if (!database) throw new Error('Commerce test database was not initialized')
  await database.db.transaction(async (transaction) => {
    const cash = await ensureFinanceAccount(transaction, {
      kind: 'platform_cash',
      ownerKey: 'platform',
      currency: 'COP',
      fundingClassification,
    })
    const equity = await ensureFinanceAccount(transaction, {
      kind: 'operating_equity',
      ownerKey: 'platform',
      currency: 'COP',
      fundingClassification,
    })
    await postFinanceTransaction(transaction, {
      operationKey: `operating-cash:${suffix}`,
      kind: 'operating_cash_funding',
      currency: 'COP',
      createdByUserId: ACTOR_ID,
      entries: [
        { accountId: cash, amountMinor },
        { accountId: equity, amountMinor: -amountMinor },
      ],
      now: NOW,
    })
  })
}

const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected operation to fail')
}

describe('reviewed beneficiaries and evidence', () => {
  test('retires the prior verified bank version without changing frozen destinations', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const beneficiary = new BeneficiaryService({ database: database.db, now: () => NOW })
    const evidence = new FinanceEvidenceService({ database: database.db, now: () => NOW })
    const next = await beneficiary.addBankVersion({
      beneficiaryId: foundationId,
      destinationFingerprint: destination('foundation-v2'),
      encryptedDetailsStorageKey: `private/banks/${foundationId}/v2.enc`,
      actorUserId: ACTOR_ID,
    })
    const proof = await evidence.recordPrivate({
      ownerType: 'beneficiary_bank_version',
      ownerId: next.bankVersionId,
      kind: 'bank_ownership_record',
      retainedPrivateStorageKey: `private/bank-verification/${next.bankVersionId}.pdf`,
      sha256: hash('foundation-bank-evidence-v2'),
      actorUserId: ACTOR_ID,
    })
    await evidence.review({ evidenceId: proof.evidenceId, reviewedByUserId: ACTOR_ID })
    await beneficiary.verifyBankVersion({
      bankVersionId: next.bankVersionId,
      evidenceId: proof.evidenceId,
      verificationMethod: 'bank_certificate_and_call',
      verificationReference: 'FOUNDATION-VERIFY-2',
      verifiedByUserId: ACTOR_ID,
    })

    const versions = await database.sql<{ id: string; status: string; retired_at: Date | null }[]>`
      select id, status, retired_at from beneficiary_bank_version
      where beneficiary_id = ${foundationId}
      order by version
    `
    expect(versions.map((row) => ({ ...row, retired_at: Boolean(row.retired_at) }))).toEqual([
      { id: foundationBankVersionId, status: 'retired', retired_at: true },
      { id: next.bankVersionId, status: 'verified', retired_at: false },
    ])
    foundationBankVersionId = next.bankVersionId
  }, 30_000)
})

describe('reviewed payouts', () => {
  test('freezes sources and destination through unknown state, then posts only after evidence', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedFinancialUnit({
      suffix: 'payout-confirm',
      fundingClassification: 'real',
      redeemed: true,
    })
    const payouts = new PayoutService({ database: database.db, now: () => NOW })
    const prepared = await payouts.prepare({
      operationKey: 'payout:venue:confirm:first',
      kind: 'venue_payout',
      beneficiaryBankVersionId: fixture.venueBankVersionId,
      fundingClassification: 'real',
      sources: [{ unitAllocationId: fixture.unitAllocationId, amountMinor: BigInt(3_000) }],
      requestedByUserId: ACTOR_ID,
    })
    await payouts.markSubmittedUnknown({
      operationId: prepared.operationId,
      submittedByUserId: ACTOR_ID,
      statusDetail: 'Bank request timed out after submission',
    })
    const unreviewed = new FinanceEvidenceService({ database: database.db, now: () => NOW })
    const evidence = await unreviewed.recordPrivate({
      ownerType: 'financial_operation',
      ownerId: prepared.operationId,
      kind: 'bank_record',
      retainedPrivateStorageKey: 'private/operations/payout-confirm.pdf',
      sha256: hash('payout-confirm-evidence'),
      actorUserId: ACTOR_ID,
    })
    const rejected = await captureError(() =>
      payouts.confirm({
        operationId: prepared.operationId,
        externalReference: 'BANK-PAYOUT-1',
        bankEvidenceId: evidence.evidenceId,
        destinationFingerprint: destination('venue:payout-confirm:v1'),
        verifiedByUserId: ACTOR_ID,
      })
    )
    expect(String(rejected)).toContain('Reviewed evidence')
    await unreviewed.review({ evidenceId: evidence.evidenceId, reviewedByUserId: ACTOR_ID })
    const confirmed = await payouts.confirm({
      operationId: prepared.operationId,
      externalReference: 'BANK-PAYOUT-1',
      bankEvidenceId: evidence.evidenceId,
      destinationFingerprint: destination('venue:payout-confirm:v1'),
      verifiedByUserId: ACTOR_ID,
    })
    const retry = await payouts.confirm({
      operationId: prepared.operationId,
      externalReference: 'BANK-PAYOUT-1',
      bankEvidenceId: evidence.evidenceId,
      destinationFingerprint: destination('venue:payout-confirm:v1'),
      verifiedByUserId: ACTOR_ID,
    })
    expect(confirmed).toMatchObject({ status: 'bank_verified', duplicate: false })
    expect(retry).toMatchObject({ status: 'bank_verified', duplicate: true })
    const [posting] = await database.sql<{ difference: string; transactions: string }[]>`
      select coalesce(sum(e.amount_minor), 0)::text as difference,
             count(distinct t.id)::text as transactions
      from finance_transaction t join finance_entry e on e.transaction_id = t.id
      where t.operation_id = ${prepared.operationId}
    `
    expect(posting).toEqual({ difference: '0', transactions: '1' })
  }, 30_000)

  test('releases failed sources and reverses confirmed transfers with compensating entries', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedFinancialUnit({
      suffix: 'payout-failure-reversal',
      fundingClassification: 'real',
      redeemed: true,
    })
    const payouts = new PayoutService({ database: database.db, now: () => NOW })
    const failed = await payouts.prepare({
      operationKey: 'payout:venue:failed:first',
      kind: 'venue_payout',
      beneficiaryBankVersionId: fixture.venueBankVersionId,
      fundingClassification: 'real',
      sources: [{ unitAllocationId: fixture.unitAllocationId, amountMinor: BigInt(2_000) }],
      requestedByUserId: ACTOR_ID,
    })
    const failedEvidence = await reviewedOperationEvidence(failed.operationId, 'payout-failed')
    await payouts.fail({
      operationId: failed.operationId,
      evidenceId: failedEvidence,
      verifiedByUserId: ACTOR_ID,
      reason: 'Bank rejected the destination',
    })
    const replacement = await payouts.prepare({
      operationKey: 'payout:venue:replacement:first',
      kind: 'venue_payout',
      beneficiaryBankVersionId: fixture.venueBankVersionId,
      fundingClassification: 'real',
      sources: [{ unitAllocationId: fixture.unitAllocationId, amountMinor: BigInt(2_000) }],
      requestedByUserId: ACTOR_ID,
    })
    const paidEvidence = await reviewedOperationEvidence(replacement.operationId, 'payout-paid')
    await payouts.confirm({
      operationId: replacement.operationId,
      externalReference: 'BANK-PAYOUT-REVERSAL-PAID',
      bankEvidenceId: paidEvidence,
      destinationFingerprint: destination('venue:payout-failure-reversal:v1'),
      verifiedByUserId: ACTOR_ID,
    })
    const reversalEvidence = await reviewedOperationEvidence(
      replacement.operationId,
      'payout-reversed'
    )
    await payouts.reverse({
      operationId: replacement.operationId,
      operationKey: 'payout:venue:reversal:first',
      externalReference: 'BANK-PAYOUT-REVERSAL-RETURN',
      evidenceId: reversalEvidence,
      verifiedByUserId: ACTOR_ID,
    })
    const [movements] = await database.sql<{ total: string; transactions: string }[]>`
      select coalesce(sum(e.amount_minor), 0)::text as total,
             count(distinct t.id)::text as transactions
      from finance_transaction t join finance_entry e on e.transaction_id = t.id
      where t.operation_id in (
        ${replacement.operationId},
        (select id from financial_operation where reversal_of_operation_id = ${replacement.operationId})
      )
    `
    expect(movements).toEqual({ total: '0', transactions: '2' })
  }, 30_000)

  test('supports partial foundation payouts and rejects a reused bank reference', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedFinancialUnit({
      suffix: 'foundation-payout',
      fundingClassification: 'real',
      redeemed: true,
    })
    const payouts = new PayoutService({ database: database.db, now: () => NOW })
    const prepared = await payouts.prepare({
      operationKey: 'payout:foundation:partial:first',
      kind: 'foundation_payout',
      beneficiaryBankVersionId: foundationBankVersionId,
      fundingClassification: 'real',
      sources: [{ unitAllocationId: fixture.unitAllocationId, amountMinor: BigInt(2_500) }],
      requestedByUserId: ACTOR_ID,
    })
    const evidence = await reviewedOperationEvidence(prepared.operationId, 'foundation-payout')
    const duplicateReference = await captureError(() =>
      payouts.confirm({
        operationId: prepared.operationId,
        externalReference: 'BANK-PAYOUT-1',
        bankEvidenceId: evidence,
        destinationFingerprint: destination('foundation-v2'),
        verifiedByUserId: ACTOR_ID,
      })
    )
    expect(String(duplicateReference)).toContain('Failed query')
    const [stillPrepared] = await database.sql<{ status: string; postings: string }[]>`
      select o.status,
             count(t.id) filter (where t.operation_id = o.id)::text as postings
      from financial_operation o
      left join finance_transaction t on t.operation_id = o.id
      where o.id = ${prepared.operationId}
      group by o.status
    `
    expect(stillPrepared).toEqual({ status: 'prepared', postings: '0' })
    const confirmed = await payouts.confirm({
      operationId: prepared.operationId,
      externalReference: 'BANK-FOUNDATION-1',
      bankEvidenceId: evidence,
      destinationFingerprint: destination('foundation-v2'),
      verifiedByUserId: ACTOR_ID,
    })
    expect(confirmed).toMatchObject({ amountMinor: BigInt(2_500), status: 'bank_verified' })
    const [source] = await database.sql<{ paid: string }[]>`
      select coalesce(sum(a.amount_minor), 0)::text as paid
      from financial_operation_allocation a
      join financial_operation o on o.id = a.operation_id
      where a.source_type = 'foundation_unit_allocation'
        and a.source_id = ${fixture.unitAllocationId}
        and o.status = 'bank_verified'
    `
    expect(source).toEqual({ paid: '2500' })
    const overview = await loadAdminFinanceOverview(database.db)
    const visible = overview.payoutSources.find((item) => item.id === fixture.unitAllocationId)
    expect(visible).toMatchObject({
      venueAvailableMinor: BigInt(5_000),
      foundationAvailableMinor: BigInt(2_500),
    })
  }, 30_000)
})

describe('reviewed refunds and treasury coverage', () => {
  test('keeps a mixed parent paid after a partial-line refund and refunds it after every line', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const base = await seedFinancialUnit({
      suffix: 'refund-mixed-parent',
      fundingClassification: 'sandbox',
      redeemed: false,
    })
    const fixture = await extendToMixedRefundOrder(base, 'refund-mixed-parent')
    const refunds = new CommerceRefundService({ database: database.db, now: () => NOW })

    const first = await refunds.reserveRefund({
      operationKey: 'refund:mixed-parent:first-line',
      orderId: fixture.customerOrderId,
      unitIds: [fixture.firstUnitId],
      destinationFingerprint: destination('refund-mixed-parent'),
      requestedByUserId: ACTOR_ID,
    })
    const firstEvidence = await reviewedOperationEvidence(first.operationId, 'refund-mixed-first')
    await refunds.confirm({
      operationId: first.operationId,
      externalReference: 'BANK-REFUND-MIXED-1',
      bankEvidenceId: firstEvidence,
      destinationFingerprint: destination('refund-mixed-parent'),
      verifiedByUserId: ACTOR_ID,
    })

    const afterFirst = await database.sql<
      { id: string; status: string; parent_status: string; ledger_parent: string | null }[]
    >`
      select o.id, o.status, c.status as parent_status, t.customer_order_id as ledger_parent
      from product_order o
      join customer_order c on c.id = o.customer_order_id
      left join finance_transaction t on t.operation_id = ${first.operationId}
      where o.customer_order_id = ${fixture.customerOrderId}
      order by o.line_ordinal
    `
    expect([...afterFirst]).toEqual([
      {
        id: fixture.firstOrderId,
        status: 'refunded',
        parent_status: 'paid',
        ledger_parent: fixture.customerOrderId,
      },
      {
        id: fixture.secondOrderId,
        status: 'paid',
        parent_status: 'paid',
        ledger_parent: fixture.customerOrderId,
      },
    ])

    const second = await refunds.reserveRefund({
      operationKey: 'refund:mixed-parent:second-line',
      orderId: fixture.customerOrderId,
      unitIds: [fixture.secondUnitId],
      destinationFingerprint: destination('refund-mixed-parent'),
      requestedByUserId: ACTOR_ID,
    })
    const secondEvidence = await reviewedOperationEvidence(
      second.operationId,
      'refund-mixed-second'
    )
    await addOperatingCash('sandbox', BigInt(10_000), 'refund-mixed-second')
    await refunds.confirm({
      operationId: second.operationId,
      externalReference: 'BANK-REFUND-MIXED-2',
      bankEvidenceId: secondEvidence,
      destinationFingerprint: destination('refund-mixed-parent'),
      verifiedByUserId: ACTOR_ID,
    })

    const afterSecond = await database.sql<
      { parent_status: string; line_statuses: string[]; refunded_units: string }[]
    >`
      select c.status as parent_status,
             array_agg(distinct o.status order by o.status) as line_statuses,
             count(*) filter (where u.lifecycle_status = 'refunded')::text as refunded_units
      from customer_order c
      join product_order o on o.customer_order_id = c.id
      join commerce_order_snapshot s on s.order_id = o.id
      join commerce_order_unit u on u.order_snapshot_id = s.id
      where c.id = ${fixture.customerOrderId}
      group by c.status
    `
    expect([...afterSecond]).toEqual([
      { parent_status: 'refunded', line_statuses: ['refunded'], refunded_units: '2' },
    ])
  }, 30_000)

  test('refunds full gross only after operating cash and reviewed destination evidence exist', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedFinancialUnit({
      suffix: 'refund-confirm',
      fundingClassification: 'sandbox',
      redeemed: false,
      deduction: '10.000000',
    })
    const refunds = new CommerceRefundService({ database: database.db, now: () => NOW })
    const prepared = await refunds.reserveRefund({
      operationKey: 'refund:financial:confirm:first',
      orderId: fixture.orderId,
      unitIds: [fixture.unitId],
      destinationFingerprint: destination('refund-confirm'),
      requestedByUserId: ACTOR_ID,
    })
    const evidence = await reviewedOperationEvidence(prepared.operationId, 'refund-confirm')
    const insufficient = await captureError(() =>
      refunds.confirm({
        operationId: prepared.operationId,
        externalReference: 'BANK-REFUND-1',
        bankEvidenceId: evidence,
        destinationFingerprint: destination('refund-confirm'),
        verifiedByUserId: ACTOR_ID,
      })
    )
    expect(String(insufficient)).toContain('cleared cash coverage')
    await addOperatingCash('sandbox', BigInt(1_000), 'refund-fee-shortfall')
    const confirmed = await refunds.confirm({
      operationId: prepared.operationId,
      externalReference: 'BANK-REFUND-1',
      bankEvidenceId: evidence,
      destinationFingerprint: destination('refund-confirm'),
      verifiedByUserId: ACTOR_ID,
    })
    expect(confirmed).toMatchObject({ amountMinor: BigInt(10_000), status: 'bank_verified' })
    const [state] = await database.sql<
      { unit: string; order_status: string; refund_entry: string }[]
    >`
      select u.lifecycle_status as unit, o.status as order_status,
             sum(e.amount_minor) filter (where a.kind = 'customer_funds_held')::text as refund_entry
      from commerce_order_unit u
      join commerce_order_snapshot s on s.id = u.order_snapshot_id
      join product_order o on o.id = s.order_id
      join finance_transaction t on t.operation_id = ${prepared.operationId}
      join finance_entry e on e.transaction_id = t.id
      join finance_account a on a.id = e.account_id
      where u.id = ${fixture.unitId}
      group by u.lifecycle_status, o.status
    `
    expect(state).toEqual({ unit: 'refunded', order_status: 'refunded', refund_entry: '10000' })
  }, 30_000)

  test('keeps an unknown refund reserved until reviewed failure evidence releases its QR', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedFinancialUnit({
      suffix: 'refund-failed',
      fundingClassification: 'sandbox',
      redeemed: false,
    })
    const refunds = new CommerceRefundService({ database: database.db, now: () => NOW })
    const prepared = await refunds.reserveRefund({
      operationKey: 'refund:financial:failed:first',
      orderId: fixture.orderId,
      unitIds: [fixture.unitId],
      destinationFingerprint: destination('refund-failed'),
      requestedByUserId: ACTOR_ID,
    })
    await refunds.markSubmittedUnknown({
      operationId: prepared.operationId,
      submittedByUserId: ACTOR_ID,
      statusDetail: 'Provider response was interrupted',
    })
    const missingEvidence = await captureError(() =>
      refunds.fail({
        operationId: prepared.operationId,
        verifiedByUserId: ACTOR_ID,
        reason: 'No refund transaction exists',
      })
    )
    expect(String(missingEvidence)).toContain('reviewed evidence')
    const evidence = await reviewedOperationEvidence(prepared.operationId, 'refund-failed')
    await refunds.fail({
      operationId: prepared.operationId,
      evidenceId: evidence,
      verifiedByUserId: ACTOR_ID,
      reason: 'No refund transaction exists',
    })
    const [state] = await database.sql<{ unit: string; qr: string; operation: string }[]>`
      select u.lifecycle_status as unit, r.status as qr, o.status as operation
      from commerce_order_unit u
      join order_redemption r on r.id = u.redemption_id
      join financial_operation o on o.id = ${prepared.operationId}
      where u.id = ${fixture.unitId}
    `
    expect(state).toEqual({ unit: 'issued', qr: 'issued', operation: 'failed' })
  }, 30_000)

  test('blocks payouts that would consume customer refund coverage', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const testDatabase = database
    const redeemable = await seedFinancialUnit({
      suffix: 'coverage-payout',
      fundingClassification: 'real',
      redeemed: true,
    })
    await seedFinancialUnit({
      suffix: 'coverage-refund-liability',
      fundingClassification: 'real',
      redeemed: false,
    })
    const treasuryService = new TreasuryService({ database: database.db, now: () => NOW })
    const treasury = await treasuryService.snapshot('real')
    expect(treasury.customerRefundCoverageMinor).toBeGreaterThanOrEqual(BigInt(10_000))
    await treasuryService.configurePolicy({
      operationKey: 'treasury:real:coverage-test',
      fundingClassification: 'real',
      minimumOperatingReserveMinor:
        treasury.availableForNewPayoutMinor > BigInt(0)
          ? treasury.availableForNewPayoutMinor
          : BigInt(0),
      approvedByUserId: ACTOR_ID,
    })
    const blocked = await captureError(() =>
      new PayoutService({ database: testDatabase.db, now: () => NOW }).prepare({
        operationKey: 'payout:coverage:blocked:first',
        kind: 'venue_payout',
        beneficiaryBankVersionId: redeemable.venueBankVersionId,
        fundingClassification: 'real',
        sources: [{ unitAllocationId: redeemable.unitAllocationId, amountMinor: BigInt(5_000) }],
        requestedByUserId: ACTOR_ID,
      })
    )
    expect(String(blocked)).toContain('refund, dispute, pending-transfer, or reserve coverage')
  }, 30_000)
})

describe('charge disputes', () => {
  test('reserves the full charge after payout and realizes a verified loss from operating cash', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const disputed = await seedFinancialUnit({
      suffix: 'dispute-after-payout',
      fundingClassification: 'real',
      redeemed: true,
    })
    const disputeCustomerOrderId = await bindFixtureToCustomerOrder(
      disputed,
      'dispute-after-payout'
    )
    const nextPayout = await seedFinancialUnit({
      suffix: 'dispute-next-payout',
      fundingClassification: 'real',
      redeemed: true,
    })
    await addOperatingCash('real', BigInt(1_000_000), 'dispute-after-payout')

    const payouts = new PayoutService({ database: database.db, now: () => NOW })
    const prepared = await payouts.prepare({
      operationKey: 'payout:venue:before-dispute',
      kind: 'venue_payout',
      beneficiaryBankVersionId: disputed.venueBankVersionId,
      fundingClassification: 'real',
      sources: [{ unitAllocationId: disputed.unitAllocationId, amountMinor: BigInt(5_000) }],
      requestedByUserId: ACTOR_ID,
    })
    const payoutEvidence = await reviewedOperationEvidence(
      prepared.operationId,
      'dispute-payout-confirmed'
    )
    await payouts.confirm({
      operationId: prepared.operationId,
      externalReference: 'BANK-BEFORE-DISPUTE-1',
      bankEvidenceId: payoutEvidence,
      destinationFingerprint: destination('venue:dispute-after-payout:v1'),
      verifiedByUserId: ACTOR_ID,
    })

    const treasury = new TreasuryService({ database: database.db, now: () => NOW })
    const beforePolicy = await treasury.snapshot('real')
    await treasury.configurePolicy({
      operationKey: 'treasury:real:dispute-test',
      fundingClassification: 'real',
      minimumOperatingReserveMinor:
        beforePolicy.minimumOperatingReserveMinor +
        (beforePolicy.availableForNewPayoutMinor > BigInt(0)
          ? beforePolicy.availableForNewPayoutMinor
          : BigInt(0)),
      approvedByUserId: ACTOR_ID,
    })
    const before = await treasury.snapshot('real')

    const evidence = new FinanceEvidenceService({ database: database.db, now: () => NOW })
    const notice = await evidence.recordPrivate({
      ownerType: 'payment_charge',
      ownerId: disputed.chargeId,
      kind: 'provider_dispute_notice',
      retainedPrivateStorageKey: 'private/disputes/after-payout-notice.pdf',
      sha256: hash('dispute-after-payout-notice'),
      actorUserId: ACTOR_ID,
    })
    await evidence.review({ evidenceId: notice.evidenceId, reviewedByUserId: ACTOR_ID })
    const disputes = new ChargeDisputeService({ database: database.db, now: () => NOW })
    const opened = await disputes.open({
      operationKey: 'dispute:after-payout:open',
      chargeId: disputed.chargeId,
      providerCaseReference: 'EPAYCO-DISPUTE-1',
      reason: 'Provider notified a cardholder dispute after the venue payout',
      evidenceId: notice.evidenceId,
      openedByUserId: ACTOR_ID,
    })
    const retry = await disputes.open({
      operationKey: 'dispute:after-payout:open',
      chargeId: disputed.chargeId,
      providerCaseReference: 'EPAYCO-DISPUTE-1',
      reason: 'Provider notified a cardholder dispute after the venue payout',
      evidenceId: notice.evidenceId,
      openedByUserId: ACTOR_ID,
    })
    expect(opened).toMatchObject({ status: 'open', duplicate: false })
    expect(retry).toMatchObject({ disputeId: opened.disputeId, duplicate: true })

    const whileOpen = await treasury.snapshot('real')
    expect(whileOpen.cashMinor).toBe(before.cashMinor)
    expect(whileOpen.disputeCoverageMinor - before.disputeCoverageMinor).toBe(BigInt(10_000))
    expect(whileOpen.availableForNewPayoutMinor - before.availableForNewPayoutMinor).toBe(
      BigInt(-10_000)
    )
    const blocked = await captureError(() =>
      payouts.prepare({
        operationKey: 'payout:blocked-by-dispute',
        kind: 'venue_payout',
        beneficiaryBankVersionId: nextPayout.venueBankVersionId,
        fundingClassification: 'real',
        sources: [{ unitAllocationId: nextPayout.unitAllocationId, amountMinor: BigInt(1_000) }],
        requestedByUserId: ACTOR_ID,
      })
    )
    expect(String(blocked)).toContain('refund, dispute, pending-transfer, or reserve coverage')

    const resolution = await evidence.recordPrivate({
      ownerType: 'charge_dispute',
      ownerId: opened.disputeId,
      kind: 'provider_dispute_resolution',
      retainedPrivateStorageKey: 'private/disputes/after-payout-resolution.pdf',
      sha256: hash('dispute-after-payout-resolution'),
      actorUserId: ACTOR_ID,
    })
    await evidence.review({ evidenceId: resolution.evidenceId, reviewedByUserId: ACTOR_ID })
    const lost = await disputes.resolve({
      disputeId: opened.disputeId,
      operationKey: 'dispute:after-payout:lost',
      outcome: 'lost',
      resolutionReference: 'EPAYCO-DISPUTE-LOSS-1',
      detail: 'Provider debited the full disputed amount',
      evidenceId: resolution.evidenceId,
      resolvedByUserId: ACTOR_ID,
    })
    const lostRetry = await disputes.resolve({
      disputeId: opened.disputeId,
      operationKey: 'dispute:after-payout:lost',
      outcome: 'lost',
      resolutionReference: 'EPAYCO-DISPUTE-LOSS-1',
      detail: 'Provider debited the full disputed amount',
      evidenceId: resolution.evidenceId,
      resolvedByUserId: ACTOR_ID,
    })
    expect(lost).toMatchObject({ status: 'lost', duplicate: false })
    expect(lostRetry).toMatchObject({ status: 'lost', duplicate: true })

    const afterLoss = await treasury.snapshot('real')
    expect(afterLoss.disputeCoverageMinor).toBe(before.disputeCoverageMinor)
    expect(afterLoss.cashMinor).toBe(before.cashMinor - BigInt(10_000))
    const [state] = await database.sql<
      {
        charge_status: string
        loss_postings: string
        balance: string
        customer_order_id: string | null
      }[]
    >`
      select
        c.status as charge_status,
        count(distinct t.id)::text as loss_postings,
        coalesce(sum(e.amount_minor), 0)::text as balance,
        max(t.customer_order_id) as customer_order_id
      from payment_charge c
      left join finance_transaction t
        on t.operation_key = ${`charge-dispute-loss:${opened.disputeId}`}
      left join finance_entry e on e.transaction_id = t.id
      where c.id = ${disputed.chargeId}
      group by c.status
    `
    expect(state).toEqual({
      charge_status: 'disputed',
      loss_postings: '1',
      balance: '0',
      customer_order_id: disputeCustomerOrderId,
    })
  }, 30_000)

  test('restores an approved charge when reviewed evidence shows the dispute was won', async () => {
    if (!database) throw new Error('Commerce test database was not initialized')
    const fixture = await seedFinancialUnit({
      suffix: 'dispute-won',
      fundingClassification: 'sandbox',
      redeemed: true,
    })
    const evidence = new FinanceEvidenceService({ database: database.db, now: () => NOW })
    const notice = await evidence.recordPrivate({
      ownerType: 'payment_charge',
      ownerId: fixture.chargeId,
      kind: 'provider_dispute_notice',
      retainedPrivateStorageKey: 'private/disputes/won-notice.pdf',
      sha256: hash('dispute-won-notice'),
      actorUserId: ACTOR_ID,
    })
    await evidence.review({ evidenceId: notice.evidenceId, reviewedByUserId: ACTOR_ID })
    const disputes = new ChargeDisputeService({ database: database.db, now: () => NOW })
    const opened = await disputes.open({
      operationKey: 'dispute:sandbox:won:open',
      chargeId: fixture.chargeId,
      providerCaseReference: 'EPAYCO-DISPUTE-WON',
      reason: 'Provider requested supporting records',
      evidenceId: notice.evidenceId,
      openedByUserId: ACTOR_ID,
    })
    const resolution = await evidence.recordPrivate({
      ownerType: 'charge_dispute',
      ownerId: opened.disputeId,
      kind: 'provider_dispute_resolution',
      retainedPrivateStorageKey: 'private/disputes/won-resolution.pdf',
      sha256: hash('dispute-won-resolution'),
      actorUserId: ACTOR_ID,
    })
    await evidence.review({ evidenceId: resolution.evidenceId, reviewedByUserId: ACTOR_ID })
    await disputes.resolve({
      disputeId: opened.disputeId,
      operationKey: 'dispute:sandbox:won:resolve',
      outcome: 'won',
      resolutionReference: 'EPAYCO-DISPUTE-WON-FINAL',
      detail: 'Provider closed the dispute in Tumbenla’s favor',
      evidenceId: resolution.evidenceId,
      resolvedByUserId: ACTOR_ID,
    })

    const [charge] = await database.sql<{ status: string; loss_postings: string }[]>`
      select c.status,
             count(t.id) filter (where t.operation_key = ${`charge-dispute-loss:${opened.disputeId}`})::text
               as loss_postings
      from payment_charge c
      left join finance_transaction t on true
      where c.id = ${fixture.chargeId}
      group by c.status
    `
    expect(charge).toEqual({ status: 'approved', loss_postings: '0' })
  }, 30_000)
})
