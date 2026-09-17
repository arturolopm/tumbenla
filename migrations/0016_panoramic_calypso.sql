CREATE TABLE "allocation_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"deduction_precision" integer DEFAULT 6 NOT NULL,
	"rounding" text DEFAULT 'half_up' NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_policy_version_check" CHECK ("allocation_policy"."version" > 0),
	CONSTRAINT "allocation_policy_precision_check" CHECK ("allocation_policy"."deduction_precision" between 2 and 12),
	CONSTRAINT "allocation_policy_rounding_check" CHECK ("allocation_policy"."rounding" = 'half_up')
);
--> statement-breakpoint
CREATE TABLE "allocation_run" (
	"id" text PRIMARY KEY NOT NULL,
	"order_snapshot_id" text NOT NULL,
	"charge_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"operation_key" text NOT NULL,
	"input_digest" text NOT NULL,
	"gross_minor" bigint NOT NULL,
	"deduction_minor" bigint NOT NULL,
	"net_minor" bigint NOT NULL,
	"status" text DEFAULT 'final' NOT NULL,
	"supersedes_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_run_revision_check" CHECK ("allocation_run"."revision" > 0),
	CONSTRAINT "allocation_run_amounts_check" CHECK ("allocation_run"."gross_minor" >= 0 and "allocation_run"."deduction_minor" >= 0 and "allocation_run"."net_minor" = "allocation_run"."gross_minor" - "allocation_run"."deduction_minor"),
	CONSTRAINT "allocation_run_status_check" CHECK ("allocation_run"."status" in ('final', 'superseded'))
);
--> statement-breakpoint
CREATE TABLE "beneficiary_bank_version" (
	"id" text PRIMARY KEY NOT NULL,
	"beneficiary_id" text NOT NULL,
	"version" integer NOT NULL,
	"destination_fingerprint" text NOT NULL,
	"encrypted_details_storage_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification_method" text,
	"verification_reference" text,
	"verified_by_user_id" text,
	"verified_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "beneficiary_bank_version_version_check" CHECK ("beneficiary_bank_version"."version" > 0),
	CONSTRAINT "beneficiary_bank_version_status_check" CHECK ("beneficiary_bank_version"."status" in ('pending', 'verified', 'rejected', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "charge_deduction" (
	"id" text PRIMARY KEY NOT NULL,
	"charge_id" text NOT NULL,
	"external_key" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"kind" text NOT NULL,
	"reported_amount" numeric(24, 6) NOT NULL,
	"currency" text NOT NULL,
	"finality" text NOT NULL,
	"evidence_id" text,
	"supersedes_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_deduction_revision_check" CHECK ("charge_deduction"."revision" > 0),
	CONSTRAINT "charge_deduction_amount_check" CHECK ("charge_deduction"."reported_amount" >= 0),
	CONSTRAINT "charge_deduction_kind_check" CHECK ("charge_deduction"."kind" in ('gateway_fee', 'withholding', 'tax', 'temporary_hold', 'correction')),
	CONSTRAINT "charge_deduction_finality_check" CHECK ("charge_deduction"."finality" in ('estimated', 'final', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "commerce_beneficiary" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"legal_name" text NOT NULL,
	"legal_identifier_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"agreement_evidence_id" text,
	"verified_by_user_id" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_beneficiary_kind_check" CHECK ("commerce_beneficiary"."kind" in ('foundation', 'venue')),
	CONSTRAINT "commerce_beneficiary_status_check" CHECK ("commerce_beneficiary"."status" in ('pending', 'verified', 'suspended', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "commerce_order_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"product_name" text NOT NULL,
	"product_kind" text NOT NULL,
	"product_description" text,
	"venue_name" text NOT NULL,
	"currency" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_gross_minor" bigint NOT NULL,
	"donation_basis_points" integer NOT NULL,
	"allocation_policy_id" text,
	"foundation_beneficiary_id" text,
	"foundation_legal_name" text,
	"policy_disclosure" text NOT NULL,
	"funding_classification" text DEFAULT 'real' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_order_snapshot_schema_version_check" CHECK ("commerce_order_snapshot"."schema_version" > 0),
	CONSTRAINT "commerce_order_snapshot_quantity_check" CHECK ("commerce_order_snapshot"."quantity" > 0),
	CONSTRAINT "commerce_order_snapshot_gross_check" CHECK ("commerce_order_snapshot"."unit_gross_minor" > 0),
	CONSTRAINT "commerce_order_snapshot_bps_check" CHECK ("commerce_order_snapshot"."donation_basis_points" between 0 and 10000 and ("commerce_order_snapshot"."funding_classification" = 'legacy_unverified' or "commerce_order_snapshot"."donation_basis_points" >= 4000)),
	CONSTRAINT "commerce_order_snapshot_funding_check" CHECK ("commerce_order_snapshot"."funding_classification" in ('real', 'sandbox', 'legacy_unverified')),
	CONSTRAINT "commerce_order_snapshot_binding_check" CHECK ("commerce_order_snapshot"."funding_classification" = 'legacy_unverified' or ("commerce_order_snapshot"."allocation_policy_id" is not null and "commerce_order_snapshot"."foundation_beneficiary_id" is not null and "commerce_order_snapshot"."foundation_legal_name" is not null))
);
--> statement-breakpoint
CREATE TABLE "commerce_order_unit" (
	"id" text PRIMARY KEY NOT NULL,
	"order_snapshot_id" text NOT NULL,
	"redemption_id" text,
	"ordinal" integer NOT NULL,
	"gross_minor" bigint NOT NULL,
	"lifecycle_status" text DEFAULT 'pending_payment' NOT NULL,
	"refund_operation_id" text,
	"expires_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_order_unit_ordinal_check" CHECK ("commerce_order_unit"."ordinal" > 0),
	CONSTRAINT "commerce_order_unit_gross_check" CHECK ("commerce_order_unit"."gross_minor" > 0),
	CONSTRAINT "commerce_order_unit_status_check" CHECK ("commerce_order_unit"."lifecycle_status" in ('pending_payment', 'issued', 'redeemed', 'refund_reserved', 'refunded', 'expired', 'void'))
);
--> statement-breakpoint
CREATE TABLE "credit_application" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_id" text NOT NULL,
	"debt_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"ordinal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_application_amount_check" CHECK ("credit_application"."amount_minor" > 0),
	CONSTRAINT "credit_application_ordinal_check" CHECK ("credit_application"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_debt" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"reservation_id" text NOT NULL,
	"principal_minor" bigint NOT NULL,
	"outstanding_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"incurred_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_debt_amount_check" CHECK ("credit_debt"."principal_minor" > 0 and "credit_debt"."outstanding_minor" between 0 and "credit_debt"."principal_minor"),
	CONSTRAINT "credit_debt_due_check" CHECK ("credit_debt"."due_at" > "credit_debt"."incurred_at")
);
--> statement-breakpoint
CREATE TABLE "credit_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"policy_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_reservation_amount_check" CHECK ("credit_reservation"."amount_minor" > 0),
	CONSTRAINT "credit_reservation_status_check" CHECK ("credit_reservation"."status" in ('active', 'consumed', 'released', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "finance_account" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"owner_key" text NOT NULL,
	"venue_id" text,
	"currency" text NOT NULL,
	"funding_classification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_account_funding_check" CHECK ("finance_account"."funding_classification" in ('real', 'sandbox', 'legacy_unverified'))
);
--> statement-breakpoint
CREATE TABLE "finance_audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text,
	"operation_key" text,
	"previous_state" text,
	"next_state" text,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"account_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"ordinal" integer NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_entry_amount_check" CHECK ("finance_entry"."amount_minor" <> 0),
	CONSTRAINT "finance_entry_ordinal_check" CHECK ("finance_entry"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"retained_private_storage_key" text NOT NULL,
	"public_redacted_storage_key" text,
	"sha256" text NOT NULL,
	"status" text DEFAULT 'private' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_evidence_status_check" CHECK ("finance_evidence"."status" in ('private', 'reviewed', 'published', 'rejected', 'withdrawn')),
	CONSTRAINT "finance_evidence_public_check" CHECK ("finance_evidence"."status" not in ('published', 'withdrawn') or "finance_evidence"."public_redacted_storage_key" is not null)
);
--> statement-breakpoint
CREATE TABLE "finance_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_snapshot_id" text,
	"operation_id" text,
	"reversal_of_id" text,
	"created_by_user_id" text,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_transaction_status_check" CHECK ("finance_transaction"."status" in ('draft', 'posted', 'reversed')),
	CONSTRAINT "finance_transaction_posted_check" CHECK (("finance_transaction"."status" = 'draft' and "finance_transaction"."posted_at" is null) or ("finance_transaction"."status" in ('posted', 'reversed') and "finance_transaction"."posted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "financial_operation" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"kind" text NOT NULL,
	"venue_id" text,
	"beneficiary_bank_version_id" text,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"external_reference" text,
	"bank_evidence_id" text,
	"requested_by_user_id" text,
	"verified_by_user_id" text,
	"submitted_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_operation_amount_check" CHECK ("financial_operation"."amount_minor" > 0),
	CONSTRAINT "financial_operation_kind_check" CHECK ("financial_operation"."kind" in ('refund', 'venue_payout', 'foundation_payout', 'credit_repayment', 'credit_offset', 'reserve_adjustment')),
	CONSTRAINT "financial_operation_status_check" CHECK ("financial_operation"."status" in ('prepared', 'submitted_unknown', 'bank_verified', 'failed', 'cancelled', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "financial_operation_allocation" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"ordinal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_operation_allocation_amount_check" CHECK ("financial_operation_allocation"."amount_minor" > 0),
	CONSTRAINT "financial_operation_allocation_ordinal_check" CHECK ("financial_operation_allocation"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "foundation_purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"material_purchase_id" text NOT NULL,
	"beneficiary_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'recorded' NOT NULL,
	"receipt_evidence_id" text,
	"verified_by_user_id" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foundation_purchase_amount_check" CHECK ("foundation_purchase"."amount_minor" > 0),
	CONSTRAINT "foundation_purchase_status_check" CHECK ("foundation_purchase"."status" in ('recorded', 'verified', 'rejected', 'corrected'))
);
--> statement-breakpoint
CREATE TABLE "payment_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"order_snapshot_id" text NOT NULL,
	"submission_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"provider" text NOT NULL,
	"provider_config_version" text NOT NULL,
	"merchant_account_key" text NOT NULL,
	"environment" text NOT NULL,
	"provider_attempt_reference" text,
	"checkout_session_id" text,
	"status" text DEFAULT 'created' NOT NULL,
	"outcome_detail" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempt_environment_check" CHECK ("payment_attempt"."environment" in ('test', 'live')),
	CONSTRAINT "payment_attempt_status_check" CHECK ("payment_attempt"."status" in ('created', 'submitted', 'pending', 'uncertain', 'approved', 'declined', 'cancelled', 'operator_review'))
);
--> statement-breakpoint
CREATE TABLE "payment_charge" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"provider" text NOT NULL,
	"merchant_account_key" text NOT NULL,
	"environment" text NOT NULL,
	"provider_reference" text NOT NULL,
	"provider_transaction_id" text,
	"gross_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"authoritative_lookup_digest" text,
	"approved_at" timestamp with time zone,
	"cleared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_charge_environment_check" CHECK ("payment_charge"."environment" in ('test', 'live')),
	CONSTRAINT "payment_charge_gross_check" CHECK ("payment_charge"."gross_minor" > 0),
	CONSTRAINT "payment_charge_status_check" CHECK ("payment_charge"."status" in ('pending', 'approved', 'declined', 'reversed', 'disputed', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "payment_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"merchant_account_key" text NOT NULL,
	"environment" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"payload_digest" text NOT NULL,
	"verified_fields" jsonb NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"processing_error" text,
	"attempt_id" text,
	"charge_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "payment_event_environment_check" CHECK ("payment_event"."environment" in ('test', 'live')),
	CONSTRAINT "payment_event_processing_status_check" CHECK ("payment_event"."processing_status" in ('received', 'verified', 'applied', 'ignored', 'retryable_error', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "purchase_funding_allocation" (
	"id" text PRIMARY KEY NOT NULL,
	"foundation_purchase_id" text NOT NULL,
	"payout_allocation_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_funding_allocation_amount_check" CHECK ("purchase_funding_allocation"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "recovery_checkpoint" (
	"id" text PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"scope" text NOT NULL,
	"cursor" text,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"last_started_at" timestamp with time zone,
	"last_succeeded_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_allocation" (
	"id" text PRIMARY KEY NOT NULL,
	"allocation_run_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"gross_minor" bigint NOT NULL,
	"deduction_minor" bigint NOT NULL,
	"net_minor" bigint NOT NULL,
	"donation_minor" bigint NOT NULL,
	"venue_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_allocation_amounts_check" CHECK ("unit_allocation"."gross_minor" >= 0 and "unit_allocation"."deduction_minor" >= 0 and "unit_allocation"."net_minor" = "unit_allocation"."gross_minor" - "unit_allocation"."deduction_minor" and "unit_allocation"."net_minor" = "unit_allocation"."donation_minor" + "unit_allocation"."venue_minor" and "unit_allocation"."donation_minor" >= 0 and "unit_allocation"."venue_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "venue_credit_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"version" integer NOT NULL,
	"limit_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"reservation_ttl_seconds" integer DEFAULT 900 NOT NULL,
	"repayment_term_seconds" integer DEFAULT 604800 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"approved_by_user_id" text,
	"effective_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_credit_policy_limit_check" CHECK ("venue_credit_policy"."limit_minor" >= 0),
	CONSTRAINT "venue_credit_policy_version_check" CHECK ("venue_credit_policy"."version" > 0),
	CONSTRAINT "venue_credit_policy_ttl_check" CHECK ("venue_credit_policy"."reservation_ttl_seconds" > 0),
	CONSTRAINT "venue_credit_policy_term_check" CHECK ("venue_credit_policy"."repayment_term_seconds" > 0),
	CONSTRAINT "venue_credit_policy_status_check" CHECK ("venue_credit_policy"."status" in ('active', 'suspended', 'retired'))
);
--> statement-breakpoint
ALTER TABLE "allocation_run" ADD CONSTRAINT "allocation_run_order_snapshot_id_commerce_order_snapshot_id_fk" FOREIGN KEY ("order_snapshot_id") REFERENCES "public"."commerce_order_snapshot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_run" ADD CONSTRAINT "allocation_run_charge_id_payment_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."payment_charge"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_run" ADD CONSTRAINT "allocation_run_policy_id_allocation_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."allocation_policy"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiary_bank_version" ADD CONSTRAINT "beneficiary_bank_version_beneficiary_id_commerce_beneficiary_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."commerce_beneficiary"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiary_bank_version" ADD CONSTRAINT "beneficiary_bank_version_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_deduction" ADD CONSTRAINT "charge_deduction_charge_id_payment_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."payment_charge"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_beneficiary" ADD CONSTRAINT "commerce_beneficiary_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_snapshot" ADD CONSTRAINT "commerce_order_snapshot_order_id_product_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."product_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_snapshot" ADD CONSTRAINT "commerce_order_snapshot_allocation_policy_id_allocation_policy_id_fk" FOREIGN KEY ("allocation_policy_id") REFERENCES "public"."allocation_policy"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_snapshot" ADD CONSTRAINT "commerce_order_snapshot_foundation_beneficiary_id_commerce_beneficiary_id_fk" FOREIGN KEY ("foundation_beneficiary_id") REFERENCES "public"."commerce_beneficiary"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_unit" ADD CONSTRAINT "commerce_order_unit_order_snapshot_id_commerce_order_snapshot_id_fk" FOREIGN KEY ("order_snapshot_id") REFERENCES "public"."commerce_order_snapshot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_unit" ADD CONSTRAINT "commerce_order_unit_redemption_id_order_redemption_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."order_redemption"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_application" ADD CONSTRAINT "credit_application_operation_id_financial_operation_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."financial_operation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_application" ADD CONSTRAINT "credit_application_debt_id_credit_debt_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."credit_debt"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_debt" ADD CONSTRAINT "credit_debt_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_debt" ADD CONSTRAINT "credit_debt_unit_id_commerce_order_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."commerce_order_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_debt" ADD CONSTRAINT "credit_debt_reservation_id_credit_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservation" ADD CONSTRAINT "credit_reservation_policy_id_venue_credit_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."venue_credit_policy"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservation" ADD CONSTRAINT "credit_reservation_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservation" ADD CONSTRAINT "credit_reservation_unit_id_commerce_order_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."commerce_order_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_account" ADD CONSTRAINT "finance_account_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_event" ADD CONSTRAINT "finance_audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_transaction_id_finance_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."finance_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_account_id_finance_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_evidence" ADD CONSTRAINT "finance_evidence_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_order_snapshot_id_commerce_order_snapshot_id_fk" FOREIGN KEY ("order_snapshot_id") REFERENCES "public"."commerce_order_snapshot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_operation" ADD CONSTRAINT "financial_operation_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_operation" ADD CONSTRAINT "financial_operation_beneficiary_bank_version_id_beneficiary_bank_version_id_fk" FOREIGN KEY ("beneficiary_bank_version_id") REFERENCES "public"."beneficiary_bank_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_operation" ADD CONSTRAINT "financial_operation_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_operation" ADD CONSTRAINT "financial_operation_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_operation_allocation" ADD CONSTRAINT "financial_operation_allocation_operation_id_financial_operation_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."financial_operation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_purchase" ADD CONSTRAINT "foundation_purchase_material_purchase_id_material_purchase_id_fk" FOREIGN KEY ("material_purchase_id") REFERENCES "public"."material_purchase"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_purchase" ADD CONSTRAINT "foundation_purchase_beneficiary_id_commerce_beneficiary_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."commerce_beneficiary"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_purchase" ADD CONSTRAINT "foundation_purchase_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_order_snapshot_id_commerce_order_snapshot_id_fk" FOREIGN KEY ("order_snapshot_id") REFERENCES "public"."commerce_order_snapshot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_charge" ADD CONSTRAINT "payment_charge_attempt_id_payment_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempt"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_attempt_id_payment_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempt"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_charge_id_payment_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."payment_charge"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_funding_allocation" ADD CONSTRAINT "purchase_funding_allocation_foundation_purchase_id_foundation_purchase_id_fk" FOREIGN KEY ("foundation_purchase_id") REFERENCES "public"."foundation_purchase"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_funding_allocation" ADD CONSTRAINT "purchase_funding_allocation_payout_allocation_id_financial_operation_allocation_id_fk" FOREIGN KEY ("payout_allocation_id") REFERENCES "public"."financial_operation_allocation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_allocation" ADD CONSTRAINT "unit_allocation_allocation_run_id_allocation_run_id_fk" FOREIGN KEY ("allocation_run_id") REFERENCES "public"."allocation_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_allocation" ADD CONSTRAINT "unit_allocation_unit_id_commerce_order_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."commerce_order_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_credit_policy" ADD CONSTRAINT "venue_credit_policy_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_credit_policy" ADD CONSTRAINT "venue_credit_policy_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_policy_version_key" ON "allocation_policy" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_run_operation_key" ON "allocation_run" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_run_order_revision_key" ON "allocation_run" USING btree ("order_snapshot_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "beneficiary_bank_version_beneficiary_version_key" ON "beneficiary_bank_version" USING btree ("beneficiary_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "beneficiary_bank_version_active_key" ON "beneficiary_bank_version" USING btree ("beneficiary_id") WHERE "beneficiary_bank_version"."status" = 'verified' and "beneficiary_bank_version"."retired_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "charge_deduction_charge_key_revision_key" ON "charge_deduction" USING btree ("charge_id","external_key","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_beneficiary_legal_identifier_hash_key" ON "commerce_beneficiary" USING btree ("legal_identifier_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_order_snapshot_order_key" ON "commerce_order_snapshot" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_order_unit_snapshot_ordinal_key" ON "commerce_order_unit" USING btree ("order_snapshot_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_order_unit_redemption_key" ON "commerce_order_unit" USING btree ("redemption_id");--> statement-breakpoint
CREATE INDEX "commerce_order_unit_status_idx" ON "commerce_order_unit" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_application_operation_debt_key" ON "credit_application" USING btree ("operation_id","debt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_application_operation_ordinal_key" ON "credit_application" USING btree ("operation_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_debt_unit_key" ON "credit_debt" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_debt_reservation_key" ON "credit_debt" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "credit_debt_fifo_idx" ON "credit_debt" USING btree ("venue_id","currency","incurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_reservation_operation_key" ON "credit_reservation" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_reservation_active_unit_key" ON "credit_reservation" USING btree ("unit_id") WHERE "credit_reservation"."status" = 'active';--> statement-breakpoint
CREATE INDEX "credit_reservation_venue_status_idx" ON "credit_reservation" USING btree ("venue_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_account_identity_key" ON "finance_account" USING btree ("kind","owner_key","currency","funding_classification");--> statement-breakpoint
CREATE INDEX "finance_account_venue_idx" ON "finance_account" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "finance_audit_event_entity_idx" ON "finance_audit_event" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "finance_audit_event_operation_idx" ON "finance_audit_event" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_entry_transaction_ordinal_key" ON "finance_entry" USING btree ("transaction_id","ordinal");--> statement-breakpoint
CREATE INDEX "finance_entry_account_idx" ON "finance_entry" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_evidence_private_storage_key" ON "finance_evidence" USING btree ("retained_private_storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_evidence_public_storage_key" ON "finance_evidence" USING btree ("public_redacted_storage_key");--> statement-breakpoint
CREATE INDEX "finance_evidence_owner_idx" ON "finance_evidence" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_transaction_operation_key" ON "finance_transaction" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "finance_transaction_order_idx" ON "finance_transaction" USING btree ("order_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_operation_operation_key" ON "financial_operation" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_operation_bank_reference_key" ON "financial_operation" USING btree ("currency","external_reference") WHERE "financial_operation"."external_reference" is not null;--> statement-breakpoint
CREATE INDEX "financial_operation_status_idx" ON "financial_operation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "financial_operation_venue_idx" ON "financial_operation" USING btree ("venue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_operation_allocation_source_key" ON "financial_operation_allocation" USING btree ("operation_id","source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_operation_allocation_ordinal_key" ON "financial_operation_allocation" USING btree ("operation_id","ordinal");--> statement-breakpoint
CREATE INDEX "financial_operation_allocation_source_idx" ON "financial_operation_allocation" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "foundation_purchase_material_purchase_key" ON "foundation_purchase" USING btree ("material_purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempt_order_submission_key" ON "payment_attempt" USING btree ("order_snapshot_id","submission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempt_provider_reference_key" ON "payment_attempt" USING btree ("provider","merchant_account_key","environment","provider_attempt_reference");--> statement-breakpoint
CREATE INDEX "payment_attempt_status_idx" ON "payment_attempt" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_charge_provider_reference_key" ON "payment_charge" USING btree ("provider","merchant_account_key","environment","provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_charge_provider_transaction_key" ON "payment_charge" USING btree ("provider","merchant_account_key","environment","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_charge_attempt_idx" ON "payment_charge" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_event_provider_event_key" ON "payment_event" USING btree ("provider","merchant_account_key","environment","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_event_processing_status_idx" ON "payment_event" USING btree ("processing_status");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_funding_allocation_pair_key" ON "purchase_funding_allocation" USING btree ("foundation_purchase_id","payout_allocation_id");--> statement-breakpoint
CREATE INDEX "purchase_funding_allocation_payout_idx" ON "purchase_funding_allocation" USING btree ("payout_allocation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_checkpoint_job_scope_key" ON "recovery_checkpoint" USING btree ("job","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_allocation_run_unit_key" ON "unit_allocation" USING btree ("allocation_run_id","unit_id");--> statement-breakpoint
CREATE INDEX "unit_allocation_unit_idx" ON "unit_allocation" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_credit_policy_venue_version_key" ON "venue_credit_policy" USING btree ("venue_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_credit_policy_active_key" ON "venue_credit_policy" USING btree ("venue_id","currency") WHERE "venue_credit_policy"."status" = 'active' and "venue_credit_policy"."retired_at" is null;--> statement-breakpoint

-- Classify every pre-facade order explicitly. These snapshots preserve the data that can be
-- recovered from the legacy rows without asserting that a simulated `paid` flag proves funds.
INSERT INTO "commerce_order_snapshot" (
	"id",
	"order_id",
	"schema_version",
	"product_name",
	"product_kind",
	"product_description",
	"venue_name",
	"currency",
	"quantity",
	"unit_gross_minor",
	"donation_basis_points",
	"allocation_policy_id",
	"foundation_beneficiary_id",
	"foundation_legal_name",
	"policy_disclosure",
	"funding_classification",
	"created_at"
)
SELECT
	'cos_legacy_' || md5(o."id"),
	o."id",
	1,
	p."name",
	p."kind",
	p."description",
	v."name",
	o."currency",
	o."quantity"::integer,
	round(o."unit_price" * 100)::bigint,
	round(o."donation_percentage" * 100)::integer,
	NULL,
	NULL,
	NULL,
	'Orden anterior a la integración verificable de la pasarela; no prueba fondos reales.',
	'legacy_unverified',
	o."created_at" AT TIME ZONE 'UTC'
FROM "product_order" o
JOIN "venue_product" p ON p."id" = o."product_id"
JOIN "venue" v ON v."id" = o."venue_id"
ON CONFLICT ("order_id") DO NOTHING;--> statement-breakpoint

WITH legacy_units AS (
	SELECT
		r.*,
		row_number() OVER (
			PARTITION BY r."order_id"
			ORDER BY r."created_at", r."id"
		)::integer AS ordinal
	FROM "order_redemption" r
)
INSERT INTO "commerce_order_unit" (
	"id",
	"order_snapshot_id",
	"redemption_id",
	"ordinal",
	"gross_minor",
	"lifecycle_status",
	"expires_at",
	"redeemed_at",
	"created_at",
	"updated_at"
)
SELECT
	'cou_legacy_' || md5(r."id"),
	s."id",
	r."id",
	r.ordinal,
	s."unit_gross_minor",
	CASE
		WHEN o."status" = 'refunded' THEN 'refunded'
		WHEN o."status" = 'expired' THEN 'expired'
		WHEN r."status" = 'redeemed' THEN 'redeemed'
		WHEN o."status" = 'paid' AND r."status" = 'issued' THEN 'issued'
		ELSE 'pending_payment'
	END,
	o."expires_at" AT TIME ZONE 'UTC',
	r."redeemed_at" AT TIME ZONE 'UTC',
	r."created_at" AT TIME ZONE 'UTC',
	r."updated_at" AT TIME ZONE 'UTC'
FROM legacy_units r
JOIN "product_order" o ON o."id" = r."order_id"
JOIN "commerce_order_snapshot" s ON s."order_id" = o."id"
ON CONFLICT ("redemption_id") DO NOTHING;--> statement-breakpoint

CREATE FUNCTION "assert_finance_transaction_balanced"("target_transaction_id" text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	transaction_status text;
	transaction_currency text;
	entry_count integer;
	entry_balance bigint;
	wrong_currency_count integer;
BEGIN
	SELECT "status", "currency"
	INTO transaction_status, transaction_currency
	FROM "finance_transaction"
	WHERE "id" = target_transaction_id;

	IF transaction_status IS NULL OR transaction_status = 'draft' THEN
		RETURN;
	END IF;

	SELECT
		count(*)::integer,
		coalesce(sum(e."amount_minor"), 0)::bigint,
		count(*) FILTER (WHERE a."currency" <> transaction_currency)::integer
	INTO entry_count, entry_balance, wrong_currency_count
	FROM "finance_entry" e
	JOIN "finance_account" a ON a."id" = e."account_id"
	WHERE e."transaction_id" = target_transaction_id;

	IF entry_count < 2 OR entry_balance <> 0 OR wrong_currency_count <> 0 THEN
		RAISE EXCEPTION 'finance transaction % must contain at least two balanced entries in %',
			target_transaction_id,
			transaction_currency;
	END IF;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "check_finance_transaction_balance"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM "assert_finance_transaction_balanced"(OLD."transaction_id");
		RETURN OLD;
	END IF;

	PERFORM "assert_finance_transaction_balanced"(NEW."transaction_id");
	IF TG_OP = 'UPDATE' AND OLD."transaction_id" <> NEW."transaction_id" THEN
		PERFORM "assert_finance_transaction_balanced"(OLD."transaction_id");
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "check_finance_transaction_row"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM "assert_finance_transaction_balanced"(NEW."id");
	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE CONSTRAINT TRIGGER "finance_transaction_balance_after_status"
AFTER INSERT OR UPDATE ON "finance_transaction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "check_finance_transaction_row"();--> statement-breakpoint

CREATE CONSTRAINT TRIGGER "finance_transaction_balance_after_entry"
AFTER INSERT OR UPDATE OR DELETE ON "finance_entry"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "check_finance_transaction_balance"();--> statement-breakpoint

CREATE FUNCTION "protect_finance_entry"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	target_transaction_id text;
	target_status text;
BEGIN
	target_transaction_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."transaction_id" ELSE NEW."transaction_id" END;
	SELECT "status" INTO target_status
	FROM "finance_transaction"
	WHERE "id" = target_transaction_id;

	IF target_status <> 'draft' THEN
		RAISE EXCEPTION 'entries of finance transaction % are immutable after posting',
			target_transaction_id;
	END IF;

	IF TG_OP = 'UPDATE' AND OLD."transaction_id" <> NEW."transaction_id" THEN
		SELECT "status" INTO target_status
		FROM "finance_transaction"
		WHERE "id" = OLD."transaction_id";
		IF target_status <> 'draft' THEN
			RAISE EXCEPTION 'entries of finance transaction % are immutable after posting',
				OLD."transaction_id";
		END IF;
	END IF;

	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "finance_entry_immutable_after_posting"
BEFORE INSERT OR UPDATE OR DELETE ON "finance_entry"
FOR EACH ROW
EXECUTE FUNCTION "protect_finance_entry"();--> statement-breakpoint

CREATE FUNCTION "protect_finance_transaction"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' AND OLD."status" <> 'draft' THEN
		RAISE EXCEPTION 'posted finance transaction % is immutable', OLD."id";
	END IF;

	IF TG_OP = 'UPDATE' THEN
		IF OLD."status" <> 'draft' THEN
			RAISE EXCEPTION 'posted finance transaction % is immutable', OLD."id";
		END IF;
		IF NEW."status" NOT IN ('draft', 'posted') THEN
			RAISE EXCEPTION 'a draft finance transaction can only become posted';
		END IF;
		IF NEW."id" <> OLD."id"
			OR NEW."operation_key" <> OLD."operation_key"
			OR NEW."content_hash" <> OLD."content_hash"
			OR NEW."kind" <> OLD."kind"
			OR NEW."currency" <> OLD."currency"
			OR NEW."order_snapshot_id" IS DISTINCT FROM OLD."order_snapshot_id"
			OR NEW."operation_id" IS DISTINCT FROM OLD."operation_id"
			OR NEW."reversal_of_id" IS DISTINCT FROM OLD."reversal_of_id"
			OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
			OR NEW."created_at" <> OLD."created_at"
		THEN
			RAISE EXCEPTION 'finance transaction content is immutable';
		END IF;
	END IF;

	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "finance_transaction_immutable_after_posting"
BEFORE UPDATE OR DELETE ON "finance_transaction"
FOR EACH ROW
EXECUTE FUNCTION "protect_finance_transaction"();
