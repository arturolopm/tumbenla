import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import {
  customerOrder,
  materialPurchase,
  orderRedemption,
  productOrder,
  user,
  venue,
} from './schema'
import { createId } from '@/lib/utils/id'

const money = (name: string) => bigint(name, { mode: 'bigint' })
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

/** A legally verified recipient. Identity and bank details are versioned independently. */
export const commerceBeneficiary = pgTable(
  'commerce_beneficiary',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('cbn')),
    kind: text('kind').notNull(),
    venueId: text('venue_id').references(() => venue.id, { onDelete: 'restrict' }),
    legalName: text('legal_name').notNull(),
    legalIdentifierHash: text('legal_identifier_hash').notNull(),
    status: text('status').default('pending').notNull(),
    agreementEvidenceId: text('agreement_evidence_id'),
    verifiedByUserId: text('verified_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('commerce_beneficiary_legal_identifier_hash_key').on(table.legalIdentifierHash),
    uniqueIndex('commerce_beneficiary_venue_key').on(table.venueId),
    check('commerce_beneficiary_kind_check', sql`${table.kind} in ('foundation', 'venue')`),
    check(
      'commerce_beneficiary_status_check',
      sql`${table.status} in ('pending', 'verified', 'suspended', 'retired')`
    ),
    check(
      'commerce_beneficiary_venue_binding_check',
      sql`(${table.kind} = 'foundation' and ${table.venueId} is null) or (${table.kind} = 'venue' and ${table.venueId} is not null)`
    ),
  ]
)

export const beneficiaryBankVersion = pgTable(
  'beneficiary_bank_version',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('bbv')),
    beneficiaryId: text('beneficiary_id')
      .notNull()
      .references(() => commerceBeneficiary.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    destinationFingerprint: text('destination_fingerprint').notNull(),
    encryptedDetailsStorageKey: text('encrypted_details_storage_key').notNull(),
    status: text('status').default('pending').notNull(),
    verificationMethod: text('verification_method'),
    verificationReference: text('verification_reference'),
    verifiedByUserId: text('verified_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('beneficiary_bank_version_beneficiary_version_key').on(
      table.beneficiaryId,
      table.version
    ),
    uniqueIndex('beneficiary_bank_version_active_key')
      .on(table.beneficiaryId)
      .where(sql`${table.status} = 'verified' and ${table.retiredAt} is null`),
    check('beneficiary_bank_version_version_check', sql`${table.version} > 0`),
    check(
      'beneficiary_bank_version_status_check',
      sql`${table.status} in ('pending', 'verified', 'rejected', 'retired')`
    ),
  ]
)

export const allocationPolicy = pgTable(
  'allocation_policy',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('alp')),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    deductionPrecision: integer('deduction_precision').default(6).notNull(),
    rounding: text('rounding').default('half_up').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('allocation_policy_version_key').on(table.version),
    check('allocation_policy_version_check', sql`${table.version} > 0`),
    check('allocation_policy_precision_check', sql`${table.deductionPrecision} between 2 and 12`),
    check('allocation_policy_rounding_check', sql`${table.rounding} = 'half_up'`),
  ]
)

/** Immutable commercial promise and trust classification for one legacy `product_order`. */
export const commerceOrderSnapshot = pgTable(
  'commerce_order_snapshot',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('cos')),
    orderId: text('order_id')
      .notNull()
      .references(() => productOrder.id, { onDelete: 'restrict' }),
    schemaVersion: integer('schema_version').default(1).notNull(),
    productName: text('product_name').notNull(),
    productKind: text('product_kind').notNull(),
    productDescription: text('product_description'),
    venueName: text('venue_name').notNull(),
    currency: text('currency').notNull(),
    quantity: integer('quantity').notNull(),
    unitGrossMinor: money('unit_gross_minor').notNull(),
    donationBasisPoints: integer('donation_basis_points').notNull(),
    allocationPolicyId: text('allocation_policy_id').references(() => allocationPolicy.id, {
      onDelete: 'restrict',
    }),
    foundationBeneficiaryId: text('foundation_beneficiary_id').references(
      () => commerceBeneficiary.id,
      { onDelete: 'restrict' }
    ),
    foundationLegalName: text('foundation_legal_name'),
    policyDisclosure: text('policy_disclosure').notNull(),
    fundingClassification: text('funding_classification').default('real').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('commerce_order_snapshot_order_key').on(table.orderId),
    check('commerce_order_snapshot_schema_version_check', sql`${table.schemaVersion} > 0`),
    check('commerce_order_snapshot_quantity_check', sql`${table.quantity} > 0`),
    check('commerce_order_snapshot_gross_check', sql`${table.unitGrossMinor} > 0`),
    check(
      'commerce_order_snapshot_bps_check',
      sql`${table.donationBasisPoints} between 0 and 10000 and (${table.fundingClassification} = 'legacy_unverified' or ${table.donationBasisPoints} >= 4000)`
    ),
    check(
      'commerce_order_snapshot_funding_check',
      sql`${table.fundingClassification} in ('real', 'sandbox', 'legacy_unverified')`
    ),
    check(
      'commerce_order_snapshot_binding_check',
      sql`${table.fundingClassification} = 'legacy_unverified' or (${table.allocationPolicyId} is not null and ${table.foundationBeneficiaryId} is not null and ${table.foundationLegalName} is not null)`
    ),
  ]
)

/** One stable financial/lifecycle unit for each redeemable order unit. */
export const commerceOrderUnit = pgTable(
  'commerce_order_unit',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('cou')),
    orderSnapshotId: text('order_snapshot_id')
      .notNull()
      .references(() => commerceOrderSnapshot.id, { onDelete: 'restrict' }),
    redemptionId: text('redemption_id').references(() => orderRedemption.id, {
      onDelete: 'restrict',
    }),
    ordinal: integer('ordinal').notNull(),
    grossMinor: money('gross_minor').notNull(),
    lifecycleStatus: text('lifecycle_status').default('pending_payment').notNull(),
    refundOperationId: text('refund_operation_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('commerce_order_unit_snapshot_ordinal_key').on(
      table.orderSnapshotId,
      table.ordinal
    ),
    uniqueIndex('commerce_order_unit_redemption_key').on(table.redemptionId),
    index('commerce_order_unit_status_idx').on(table.lifecycleStatus),
    check('commerce_order_unit_ordinal_check', sql`${table.ordinal} > 0`),
    check('commerce_order_unit_gross_check', sql`${table.grossMinor} > 0`),
    check(
      'commerce_order_unit_status_check',
      sql`${table.lifecycleStatus} in ('pending_payment', 'issued', 'redeemed', 'refund_reserved', 'refunded', 'expired', 'void')`
    ),
  ]
)

/** Durable idempotency and audit boundary for unit-state transitions. */
export const unitLifecycleOperation = pgTable(
  'unit_lifecycle_operation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('ulo')),
    operationKey: text('operation_key').notNull(),
    contentHash: text('content_hash').notNull(),
    unitId: text('unit_id')
      .notNull()
      .references(() => commerceOrderUnit.id, { onDelete: 'restrict' }),
    kind: text('kind').notNull(),
    status: text('status').default('completed').notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'restrict' }),
    detail: jsonb('detail').$type<Record<string, string | number | boolean | null>>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('unit_lifecycle_operation_operation_key').on(table.operationKey),
    index('unit_lifecycle_operation_unit_idx').on(table.unitId, table.createdAt),
    check(
      'unit_lifecycle_operation_kind_check',
      sql`${table.kind} in ('redeem', 'expire', 'refund_reserve', 'refund_release', 'refund_confirm')`
    ),
    check(
      'unit_lifecycle_operation_status_check',
      sql`${table.status} in ('completed', 'rejected')`
    ),
  ]
)

export const paymentAttempt = pgTable(
  'payment_attempt',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('pat')),
    orderSnapshotId: text('order_snapshot_id').references(() => commerceOrderSnapshot.id, {
      onDelete: 'restrict',
    }),
    customerOrderId: text('customer_order_id').references(() => customerOrder.id, {
      onDelete: 'restrict',
    }),
    submissionKey: text('submission_key').notNull(),
    requestHash: text('request_hash').notNull(),
    provider: text('provider').notNull(),
    providerConfigVersion: text('provider_config_version').notNull(),
    merchantAccountKey: text('merchant_account_key').notNull(),
    environment: text('environment').notNull(),
    providerAttemptReference: text('provider_attempt_reference'),
    checkoutSessionId: text('checkout_session_id'),
    status: text('status').default('created').notNull(),
    outcomeDetail: text('outcome_detail'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payment_attempt_submission_key').on(table.submissionKey),
    uniqueIndex('payment_attempt_provider_reference_key').on(
      table.provider,
      table.merchantAccountKey,
      table.environment,
      table.providerAttemptReference
    ),
    index('payment_attempt_status_idx').on(table.status),
    index('payment_attempt_customer_order_idx').on(table.customerOrderId),
    check(
      'payment_attempt_order_binding_check',
      sql`${table.customerOrderId} is not null or ${table.orderSnapshotId} is not null`
    ),
    check('payment_attempt_environment_check', sql`${table.environment} in ('test', 'live')`),
    check(
      'payment_attempt_status_check',
      sql`${table.status} in ('created', 'submitted', 'pending', 'uncertain', 'approved', 'declined', 'cancelled', 'operator_review')`
    ),
  ]
)

/** Every observed provider charge, including duplicate approvals and overpayments. */
export const paymentCharge = pgTable(
  'payment_charge',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('pch')),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => paymentAttempt.id, { onDelete: 'restrict' }),
    provider: text('provider').notNull(),
    merchantAccountKey: text('merchant_account_key').notNull(),
    environment: text('environment').notNull(),
    providerReference: text('provider_reference').notNull(),
    providerTransactionId: text('provider_transaction_id'),
    grossMinor: money('gross_minor').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    authoritativeLookupDigest: text('authoritative_lookup_digest'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('payment_charge_provider_reference_key').on(
      table.provider,
      table.merchantAccountKey,
      table.environment,
      table.providerReference
    ),
    uniqueIndex('payment_charge_provider_transaction_key').on(
      table.provider,
      table.merchantAccountKey,
      table.environment,
      table.providerTransactionId
    ),
    index('payment_charge_attempt_idx').on(table.attemptId),
    check('payment_charge_environment_check', sql`${table.environment} in ('test', 'live')`),
    check('payment_charge_gross_check', sql`${table.grossMinor} > 0`),
    check(
      'payment_charge_status_check',
      sql`${table.status} in ('pending', 'approved', 'declined', 'reversed', 'disputed', 'unknown')`
    ),
  ]
)

export const paymentEvent = pgTable(
  'payment_event',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('pev')),
    provider: text('provider').notNull(),
    merchantAccountKey: text('merchant_account_key').notNull(),
    environment: text('environment').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    payloadDigest: text('payload_digest').notNull(),
    verifiedFields: jsonb('verified_fields').$type<Record<string, string | null>>().notNull(),
    signatureVerified: boolean('signature_verified').default(false).notNull(),
    processingStatus: text('processing_status').default('received').notNull(),
    processingError: text('processing_error'),
    attemptId: text('attempt_id').references(() => paymentAttempt.id, { onDelete: 'restrict' }),
    chargeId: text('charge_id').references(() => paymentCharge.id, { onDelete: 'restrict' }),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('payment_event_provider_event_key').on(
      table.provider,
      table.merchantAccountKey,
      table.environment,
      table.providerEventId
    ),
    index('payment_event_processing_status_idx').on(table.processingStatus),
    check(
      'payment_event_environment_check',
      sql`${table.environment} in ('test', 'live', 'unknown')`
    ),
    check(
      'payment_event_processing_status_check',
      sql`${table.processingStatus} in ('received', 'verified', 'applied', 'ignored', 'retryable_error', 'rejected')`
    ),
  ]
)

/** Provider-reported precision is retained as numeric text; it is rounded only by a policy run. */
export const chargeDeduction = pgTable(
  'charge_deduction',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('cdd')),
    chargeId: text('charge_id')
      .notNull()
      .references(() => paymentCharge.id, { onDelete: 'restrict' }),
    externalKey: text('external_key').notNull(),
    revision: integer('revision').default(1).notNull(),
    kind: text('kind').notNull(),
    reportedAmount: numeric('reported_amount', { precision: 24, scale: 6 }).notNull(),
    currency: text('currency').notNull(),
    finality: text('finality').notNull(),
    evidenceId: text('evidence_id'),
    supersedesId: text('supersedes_id'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('charge_deduction_charge_key_revision_key').on(
      table.chargeId,
      table.externalKey,
      table.revision
    ),
    check('charge_deduction_revision_check', sql`${table.revision} > 0`),
    check('charge_deduction_amount_check', sql`${table.reportedAmount} >= 0`),
    check(
      'charge_deduction_kind_check',
      sql`${table.kind} in ('gateway_fee', 'withholding', 'tax', 'temporary_hold', 'correction')`
    ),
    check(
      'charge_deduction_finality_check',
      sql`${table.finality} in ('estimated', 'final', 'reversed')`
    ),
  ]
)

export const allocationRun = pgTable(
  'allocation_run',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('alr')),
    orderSnapshotId: text('order_snapshot_id').references(() => commerceOrderSnapshot.id, {
      onDelete: 'restrict',
    }),
    customerOrderId: text('customer_order_id').references(() => customerOrder.id, {
      onDelete: 'restrict',
    }),
    chargeId: text('charge_id')
      .notNull()
      .references(() => paymentCharge.id, { onDelete: 'restrict' }),
    policyId: text('policy_id')
      .notNull()
      .references(() => allocationPolicy.id, { onDelete: 'restrict' }),
    revision: integer('revision').default(1).notNull(),
    operationKey: text('operation_key').notNull(),
    inputDigest: text('input_digest').notNull(),
    grossMinor: money('gross_minor').notNull(),
    deductionMinor: money('deduction_minor').notNull(),
    netMinor: money('net_minor').notNull(),
    status: text('status').default('final').notNull(),
    supersedesId: text('supersedes_id'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('allocation_run_operation_key').on(table.operationKey),
    uniqueIndex('allocation_run_order_revision_key').on(table.orderSnapshotId, table.revision),
    uniqueIndex('allocation_run_customer_order_revision_key').on(
      table.customerOrderId,
      table.revision
    ),
    index('allocation_run_customer_order_idx').on(table.customerOrderId),
    check(
      'allocation_run_order_binding_check',
      sql`${table.customerOrderId} is not null or ${table.orderSnapshotId} is not null`
    ),
    check('allocation_run_revision_check', sql`${table.revision} > 0`),
    check(
      'allocation_run_amounts_check',
      sql`${table.grossMinor} >= 0 and ${table.deductionMinor} >= 0 and ${table.netMinor} = ${table.grossMinor} - ${table.deductionMinor}`
    ),
    check('allocation_run_status_check', sql`${table.status} in ('final', 'superseded')`),
  ]
)

export const unitAllocation = pgTable(
  'unit_allocation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('ual')),
    allocationRunId: text('allocation_run_id')
      .notNull()
      .references(() => allocationRun.id, { onDelete: 'restrict' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => commerceOrderUnit.id, { onDelete: 'restrict' }),
    grossMinor: money('gross_minor').notNull(),
    deductionMinor: money('deduction_minor').notNull(),
    netMinor: money('net_minor').notNull(),
    donationMinor: money('donation_minor').notNull(),
    venueMinor: money('venue_minor').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('unit_allocation_run_unit_key').on(table.allocationRunId, table.unitId),
    index('unit_allocation_unit_idx').on(table.unitId),
    check(
      'unit_allocation_amounts_check',
      sql`${table.grossMinor} >= 0 and ${table.deductionMinor} >= 0 and ${table.netMinor} = ${table.grossMinor} - ${table.deductionMinor} and ${table.netMinor} = ${table.donationMinor} + ${table.venueMinor} and ${table.donationMinor} >= 0 and ${table.venueMinor} >= 0`
    ),
  ]
)

/** V2 accounts never mix real funds with sandbox or unreviewed legacy balances. */
export const financeAccount = pgTable(
  'finance_account',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('fac')),
    kind: text('kind').notNull(),
    ownerKey: text('owner_key').notNull(),
    venueId: text('venue_id').references(() => venue.id, { onDelete: 'restrict' }),
    currency: text('currency').notNull(),
    fundingClassification: text('funding_classification').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('finance_account_identity_key').on(
      table.kind,
      table.ownerKey,
      table.currency,
      table.fundingClassification
    ),
    index('finance_account_venue_idx').on(table.venueId),
    check(
      'finance_account_funding_check',
      sql`${table.fundingClassification} in ('real', 'sandbox', 'legacy_unverified')`
    ),
  ]
)

/** Only `posted` transactions participate in balances. Operation-key reuse must match content. */
export const financeTransaction = pgTable(
  'finance_transaction',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('ftx')),
    operationKey: text('operation_key').notNull(),
    contentHash: text('content_hash').notNull(),
    kind: text('kind').notNull(),
    currency: text('currency').notNull(),
    status: text('status').default('draft').notNull(),
    orderSnapshotId: text('order_snapshot_id').references(() => commerceOrderSnapshot.id, {
      onDelete: 'restrict',
    }),
    customerOrderId: text('customer_order_id').references(() => customerOrder.id, {
      onDelete: 'restrict',
    }),
    operationId: text('operation_id'),
    reversalOfId: text('reversal_of_id'),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('finance_transaction_operation_key').on(table.operationKey),
    index('finance_transaction_order_idx').on(table.orderSnapshotId),
    index('finance_transaction_customer_order_idx').on(table.customerOrderId),
    check(
      'finance_transaction_status_check',
      sql`${table.status} in ('draft', 'posted', 'reversed')`
    ),
    check(
      'finance_transaction_posted_check',
      sql`(${table.status} = 'draft' and ${table.postedAt} is null) or (${table.status} in ('posted', 'reversed') and ${table.postedAt} is not null)`
    ),
  ]
)

export const financeEntry = pgTable(
  'finance_entry',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('fen')),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => financeTransaction.id, { onDelete: 'restrict' }),
    accountId: text('account_id')
      .notNull()
      .references(() => financeAccount.id, { onDelete: 'restrict' }),
    amountMinor: money('amount_minor').notNull(),
    ordinal: integer('ordinal').notNull(),
    memo: text('memo'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('finance_entry_transaction_ordinal_key').on(table.transactionId, table.ordinal),
    index('finance_entry_account_idx').on(table.accountId),
    check('finance_entry_amount_check', sql`${table.amountMinor} <> 0`),
    check('finance_entry_ordinal_check', sql`${table.ordinal} > 0`),
  ]
)

/** Reviewed external money movement; an unknown result remains reserved. */
export const financialOperation = pgTable(
  'financial_operation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('fop')),
    operationKey: text('operation_key').notNull(),
    contentHash: text('content_hash').notNull(),
    kind: text('kind').notNull(),
    venueId: text('venue_id').references(() => venue.id, { onDelete: 'restrict' }),
    beneficiaryBankVersionId: text('beneficiary_bank_version_id').references(
      () => beneficiaryBankVersion.id,
      { onDelete: 'restrict' }
    ),
    amountMinor: money('amount_minor').notNull(),
    currency: text('currency').notNull(),
    fundingClassification: text('funding_classification'),
    status: text('status').default('prepared').notNull(),
    externalReference: text('external_reference'),
    bankEvidenceId: text('bank_evidence_id'),
    destinationFingerprint: text('destination_fingerprint'),
    statusDetail: text('status_detail'),
    reversalOfOperationId: text('reversal_of_operation_id'),
    requestedByUserId: text('requested_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    verifiedByUserId: text('verified_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('financial_operation_operation_key').on(table.operationKey),
    uniqueIndex('financial_operation_bank_reference_key')
      .on(table.currency, table.externalReference)
      .where(sql`${table.externalReference} is not null`),
    index('financial_operation_status_idx').on(table.status),
    index('financial_operation_venue_idx').on(table.venueId),
    check('financial_operation_amount_check', sql`${table.amountMinor} > 0`),
    check(
      'financial_operation_funding_check',
      sql`${table.fundingClassification} is null or ${table.fundingClassification} in ('real', 'sandbox')`
    ),
    check(
      'financial_operation_kind_check',
      sql`${table.kind} in ('refund', 'venue_payout', 'foundation_payout', 'credit_repayment', 'credit_offset', 'reserve_adjustment')`
    ),
    check(
      'financial_operation_status_check',
      sql`${table.status} in ('prepared', 'submitted_unknown', 'bank_verified', 'failed', 'cancelled', 'reversed')`
    ),
  ]
)

/** Versioned minimum operating cash that payouts/refunds cannot silently consume. */
export const treasuryPolicy = pgTable(
  'treasury_policy',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('tpy')),
    operationKey: text('operation_key').notNull(),
    contentHash: text('content_hash').notNull(),
    version: integer('version').notNull(),
    currency: text('currency').notNull(),
    fundingClassification: text('funding_classification').notNull(),
    minimumOperatingReserveMinor: money('minimum_operating_reserve_minor')
      .default(sql`0`)
      .notNull(),
    status: text('status').default('active').notNull(),
    approvedByUserId: text('approved_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('treasury_policy_operation_key').on(table.operationKey),
    uniqueIndex('treasury_policy_version_key').on(
      table.currency,
      table.fundingClassification,
      table.version
    ),
    uniqueIndex('treasury_policy_active_key')
      .on(table.currency, table.fundingClassification)
      .where(sql`${table.status} = 'active' and ${table.retiredAt} is null`),
    check('treasury_policy_version_check', sql`${table.version} > 0`),
    check('treasury_policy_reserve_check', sql`${table.minimumOperatingReserveMinor} >= 0`),
    check(
      'treasury_policy_funding_check',
      sql`${table.fundingClassification} in ('real', 'sandbox')`
    ),
    check('treasury_policy_status_check', sql`${table.status} in ('active', 'retired')`),
  ]
)

/** Exact reservation/consumption of a source amount by a refund, payout, repayment, or offset. */
export const financialOperationAllocation = pgTable(
  'financial_operation_allocation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('foa')),
    operationId: text('operation_id')
      .notNull()
      .references(() => financialOperation.id, { onDelete: 'restrict' }),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    amountMinor: money('amount_minor').notNull(),
    ordinal: integer('ordinal').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('financial_operation_allocation_source_key').on(
      table.operationId,
      table.sourceType,
      table.sourceId
    ),
    uniqueIndex('financial_operation_allocation_ordinal_key').on(table.operationId, table.ordinal),
    index('financial_operation_allocation_source_idx').on(table.sourceType, table.sourceId),
    check('financial_operation_allocation_amount_check', sql`${table.amountMinor} > 0`),
    check('financial_operation_allocation_ordinal_check', sql`${table.ordinal} > 0`),
  ]
)

export const venueCreditPolicy = pgTable(
  'venue_credit_policy',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('vcp')),
    operationKey: text('operation_key'),
    contentHash: text('content_hash'),
    venueId: text('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    limitMinor: money('limit_minor').default(sql`0`).notNull(),
    currency: text('currency').notNull(),
    reservationTtlSeconds: integer('reservation_ttl_seconds').default(900).notNull(),
    repaymentTermSeconds: integer('repayment_term_seconds').default(604800).notNull(),
    maxActiveReservations: integer('max_active_reservations').default(100).notNull(),
    maxActivePerShopper: integer('max_active_per_shopper').default(20).notNull(),
    status: text('status').default('active').notNull(),
    approvedByUserId: text('approved_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('venue_credit_policy_venue_version_key').on(table.venueId, table.version),
    uniqueIndex('venue_credit_policy_operation_key').on(table.operationKey),
    uniqueIndex('venue_credit_policy_active_key')
      .on(table.venueId, table.currency)
      .where(sql`${table.status} = 'active' and ${table.retiredAt} is null`),
    check('venue_credit_policy_limit_check', sql`${table.limitMinor} >= 0`),
    check('venue_credit_policy_version_check', sql`${table.version} > 0`),
    check('venue_credit_policy_ttl_check', sql`${table.reservationTtlSeconds} > 0`),
    check('venue_credit_policy_term_check', sql`${table.repaymentTermSeconds} > 0`),
    check(
      'venue_credit_policy_reservation_limits_check',
      sql`${table.maxActiveReservations} > 0 and ${table.maxActivePerShopper} > 0 and ${table.maxActivePerShopper} <= ${table.maxActiveReservations}`
    ),
    check(
      'venue_credit_policy_status_check',
      sql`${table.status} in ('active', 'suspended', 'retired')`
    ),
  ]
)

export const creditReservation = pgTable(
  'credit_reservation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('crs')),
    operationKey: text('operation_key').notNull(),
    contentHash: text('content_hash').notNull(),
    policyId: text('policy_id')
      .notNull()
      .references(() => venueCreditPolicy.id, { onDelete: 'restrict' }),
    venueId: text('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'restrict' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => commerceOrderUnit.id, { onDelete: 'restrict' }),
    amountMinor: money('amount_minor').notNull(),
    shopperKey: text('shopper_key'),
    currency: text('currency').notNull(),
    status: text('status').default('active').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('credit_reservation_operation_key').on(table.operationKey),
    uniqueIndex('credit_reservation_active_unit_key')
      .on(table.unitId)
      .where(sql`${table.status} = 'active'`),
    index('credit_reservation_venue_status_idx').on(table.venueId, table.status),
    index('credit_reservation_shopper_status_idx').on(table.shopperKey, table.status),
    check('credit_reservation_amount_check', sql`${table.amountMinor} > 0`),
    check(
      'credit_reservation_status_check',
      sql`${table.status} in ('active', 'consumed', 'released', 'expired')`
    ),
  ]
)

export const creditDebt = pgTable(
  'credit_debt',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('cdt')),
    venueId: text('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'restrict' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => commerceOrderUnit.id, { onDelete: 'restrict' }),
    reservationId: text('reservation_id')
      .notNull()
      .references(() => creditReservation.id, { onDelete: 'restrict' }),
    principalMinor: money('principal_minor').notNull(),
    outstandingMinor: money('outstanding_minor').notNull(),
    currency: text('currency').notNull(),
    incurredAt: timestamp('incurred_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('credit_debt_unit_key').on(table.unitId),
    uniqueIndex('credit_debt_reservation_key').on(table.reservationId),
    index('credit_debt_fifo_idx').on(table.venueId, table.currency, table.incurredAt),
    check(
      'credit_debt_amount_check',
      sql`${table.principalMinor} > 0 and ${table.outstandingMinor} between 0 and ${table.principalMinor}`
    ),
    check('credit_debt_due_check', sql`${table.dueAt} > ${table.incurredAt}`),
  ]
)

export const creditApplication = pgTable(
  'credit_application',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('cap')),
    operationId: text('operation_id')
      .notNull()
      .references(() => financialOperation.id, { onDelete: 'restrict' }),
    debtId: text('debt_id')
      .notNull()
      .references(() => creditDebt.id, { onDelete: 'restrict' }),
    amountMinor: money('amount_minor').notNull(),
    ordinal: integer('ordinal').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('credit_application_operation_debt_key').on(table.operationId, table.debtId),
    uniqueIndex('credit_application_operation_ordinal_key').on(table.operationId, table.ordinal),
    check('credit_application_amount_check', sql`${table.amountMinor} > 0`),
    check('credit_application_ordinal_check', sql`${table.ordinal} > 0`),
  ]
)

/** Financial verification sidecar for the existing material-purchase domain record. */
export const foundationPurchase = pgTable(
  'foundation_purchase',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('fpu')),
    materialPurchaseId: text('material_purchase_id')
      .notNull()
      .references(() => materialPurchase.id, { onDelete: 'restrict' }),
    beneficiaryId: text('beneficiary_id')
      .notNull()
      .references(() => commerceBeneficiary.id, { onDelete: 'restrict' }),
    operationKey: text('operation_key'),
    contentHash: text('content_hash'),
    correctionOfId: text('correction_of_id').references((): AnyPgColumn => foundationPurchase.id, {
      onDelete: 'restrict',
    }),
    amountMinor: money('amount_minor').notNull(),
    currency: text('currency').notNull(),
    status: text('status').default('recorded').notNull(),
    receiptEvidenceId: text('receipt_evidence_id'),
    verifiedByUserId: text('verified_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('foundation_purchase_material_purchase_key').on(table.materialPurchaseId),
    uniqueIndex('foundation_purchase_operation_key').on(table.operationKey),
    uniqueIndex('foundation_purchase_correction_target_key').on(table.correctionOfId),
    check('foundation_purchase_amount_check', sql`${table.amountMinor} > 0`),
    check(
      'foundation_purchase_status_check',
      sql`${table.status} in ('recorded', 'verified', 'rejected', 'corrected')`
    ),
  ]
)

/** Amount-capped attribution from verified foundation transfers to verified purchases. */
export const purchaseFundingAllocation = pgTable(
  'purchase_funding_allocation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('pfa')),
    foundationPurchaseId: text('foundation_purchase_id')
      .notNull()
      .references(() => foundationPurchase.id, { onDelete: 'restrict' }),
    payoutAllocationId: text('payout_allocation_id')
      .notNull()
      .references(() => financialOperationAllocation.id, { onDelete: 'restrict' }),
    amountMinor: money('amount_minor').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('purchase_funding_allocation_pair_key').on(
      table.foundationPurchaseId,
      table.payoutAllocationId
    ),
    index('purchase_funding_allocation_payout_idx').on(table.payoutAllocationId),
    check('purchase_funding_allocation_amount_check', sql`${table.amountMinor} > 0`),
  ]
)

/** Private originals and separately reviewed/redacted public evidence never share a key. */
export const financeEvidence = pgTable(
  'finance_evidence',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('fev')),
    ownerType: text('owner_type').notNull(),
    ownerId: text('owner_id').notNull(),
    kind: text('kind').notNull(),
    retainedPrivateStorageKey: text('retained_private_storage_key').notNull(),
    publicRedactedStorageKey: text('public_redacted_storage_key'),
    sha256: text('sha256').notNull(),
    retainedPrivateSize: bigint('retained_private_size', { mode: 'number' }),
    retainedPrivateContentType: text('retained_private_content_type'),
    publicRedactedSha256: text('public_redacted_sha256'),
    publicRedactedSize: bigint('public_redacted_size', { mode: 'number' }),
    publicRedactedContentType: text('public_redacted_content_type'),
    status: text('status').default('private').notNull(),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('finance_evidence_private_storage_key').on(table.retainedPrivateStorageKey),
    uniqueIndex('finance_evidence_public_storage_key').on(table.publicRedactedStorageKey),
    index('finance_evidence_owner_idx').on(table.ownerType, table.ownerId),
    check(
      'finance_evidence_status_check',
      sql`${table.status} in ('private', 'reviewed', 'published', 'rejected', 'withdrawn')`
    ),
    check(
      'finance_evidence_public_check',
      sql`${table.status} not in ('published', 'withdrawn') or ${table.publicRedactedStorageKey} is not null`
    ),
  ]
)

/** Evidence-backed provider dispute. The charge remains disputed after a loss until recovery. */
export const chargeDispute = pgTable(
  'charge_dispute',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('cdp')),
    chargeId: text('charge_id')
      .notNull()
      .references(() => paymentCharge.id, { onDelete: 'restrict' }),
    operationKey: text('operation_key').notNull(),
    contentHash: text('content_hash').notNull(),
    providerCaseReference: text('provider_case_reference').notNull(),
    reason: text('reason').notNull(),
    status: text('status').default('open').notNull(),
    openingEvidenceId: text('opening_evidence_id')
      .notNull()
      .references(() => financeEvidence.id, { onDelete: 'restrict' }),
    openedByUserId: text('opened_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    resolutionOperationKey: text('resolution_operation_key'),
    resolutionContentHash: text('resolution_content_hash'),
    resolutionEvidenceId: text('resolution_evidence_id').references(() => financeEvidence.id, {
      onDelete: 'restrict',
    }),
    resolutionReference: text('resolution_reference'),
    resolutionDetail: text('resolution_detail'),
    resolvedByUserId: text('resolved_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('charge_dispute_operation_key').on(table.operationKey),
    uniqueIndex('charge_dispute_resolution_operation_key').on(table.resolutionOperationKey),
    uniqueIndex('charge_dispute_active_charge_key')
      .on(table.chargeId)
      .where(sql`${table.status} = 'open'`),
    index('charge_dispute_charge_idx').on(table.chargeId, table.createdAt),
    check('charge_dispute_status_check', sql`${table.status} in ('open', 'won', 'lost')`),
    check(
      'charge_dispute_resolution_check',
      sql`(${table.status} = 'open' and ${table.resolutionOperationKey} is null and ${table.resolutionContentHash} is null and ${table.resolutionEvidenceId} is null and ${table.resolutionReference} is null and ${table.resolutionDetail} is null and ${table.resolvedByUserId} is null and ${table.resolvedAt} is null) or (${table.status} in ('won', 'lost') and ${table.resolutionOperationKey} is not null and ${table.resolutionContentHash} is not null and ${table.resolutionEvidenceId} is not null and ${table.resolutionReference} is not null and ${table.resolutionDetail} is not null and ${table.resolvedByUserId} is not null and ${table.resolvedAt} is not null)`
    ),
  ]
)

export const financeAuditEvent = pgTable(
  'finance_audit_event',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('fae')),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'restrict' }),
    operationKey: text('operation_key'),
    previousState: text('previous_state'),
    nextState: text('next_state'),
    detail: jsonb('detail').$type<Record<string, string | number | boolean | null>>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('finance_audit_event_entity_idx').on(table.entityType, table.entityId, table.createdAt),
    index('finance_audit_event_operation_idx').on(table.operationKey),
  ]
)

export const recoveryCheckpoint = pgTable(
  'recovery_checkpoint',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('rcp')),
    job: text('job').notNull(),
    scope: text('scope').notNull(),
    cursor: text('cursor'),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lastStartedAt: timestamp('last_started_at', { withTimezone: true }),
    lastSucceededAt: timestamp('last_succeeded_at', { withTimezone: true }),
    lastError: text('last_error'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('recovery_checkpoint_job_scope_key').on(table.job, table.scope)]
)

/** Fixed-window abuse control. Only hashes are retained; raw IPs, emails, and codes are not. */
export const commerceRateLimit = pgTable(
  'commerce_rate_limit',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('crl')),
    scope: text('scope').notNull(),
    keyHash: text('key_hash').notNull(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
    count: integer('count').default(1).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('commerce_rate_limit_window_key').on(
      table.scope,
      table.keyHash,
      table.windowStartedAt
    ),
    index('commerce_rate_limit_expires_idx').on(table.expiresAt),
    check('commerce_rate_limit_count_check', sql`${table.count} > 0`),
    check('commerce_rate_limit_window_check', sql`${table.expiresAt} > ${table.windowStartedAt}`),
  ]
)

/** Named schema object for injected Drizzle clients and isolated database tests. */
export const CommerceSchema = {
  allocationPolicy,
  allocationRun,
  beneficiaryBankVersion,
  chargeDeduction,
  commerceBeneficiary,
  commerceRateLimit,
  commerceOrderSnapshot,
  commerceOrderUnit,
  creditApplication,
  creditDebt,
  creditReservation,
  financeAccount,
  financeAuditEvent,
  financeEntry,
  financeEvidence,
  financeTransaction,
  financialOperation,
  financialOperationAllocation,
  foundationPurchase,
  paymentAttempt,
  paymentCharge,
  paymentEvent,
  purchaseFundingAllocation,
  recoveryCheckpoint,
  treasuryPolicy,
  unitAllocation,
  unitLifecycleOperation,
  venueCreditPolicy,
}

export type CommerceSchema = typeof CommerceSchema
