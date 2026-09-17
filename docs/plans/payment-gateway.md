# ePayco integration and auditable settlement plan

## 1. Objective and agreed decisions

Implement interchangeable payment providers, starting with ePayco, while keeping orders, QR redemption, accounting, and settlement under Tumbenla’s control.

**Working branch:** `payment-gateway`
**Inspected baseline:** `d01f3c9`
**Durable document:** `docs/plans/payment-gateway.md`

This planning session performed read-only discovery. The first implementation checkpoint must save this complete plan in that document. No implementation or sandbox payment has been completed.

### Decisions confirmed with the owner

| Area | Decision |
|---|---|
| Customer payments | Credit card, debit card, and PSE through ePayco; retain payment at the bar. |
| Money flow | Tumbenla collects app payments, then makes reviewed bank transfers to the bar and foundation. |
| Foundation | One active, platform-verified foundation initially. Freeze its identity on each order. |
| Distribution basis | Apply the donation percentage after verified, itemized gateway deductions, including applicable withholding. Temporary holds are not deductions. |
| Donation percentage | Preserve the minimum of 40%; encourage 50% and allow 100%. The percentage applies to the disclosed distribution basis. |
| Exact amounts | Show the percentage and “amount pending” until final deductions are reconciled. Do not display an invented peso amount. |
| Distribution eligibility | Require QR redemption, reconciled deductions, cleared backing funds, and no blocking refund or dispute. |
| Bar credit | Operator-approved limit per bar, default zero. Repayment within seven days. |
| Unpaid bar QR | Reserve credit for 15 minutes; release unused capacity on expiry. |
| Unclaimed app order | Expire the QR after 45 days and retain funds for refund. No automatic donation. |
| Customer refunds | Refund the full price of eligible unclaimed units. Tumbenla covers unrecoverable costs from operating funds. |
| Disputes after payout | Use Tumbenla’s operating reserve initially; investigate recovery from a responsible bar. |
| Recovery infrastructure | Neon and Vercel: immediate webhook processing, customer/operator reconciliation, and a daily cron backstop. |
| Evidence storage | Configure and validate the existing R2 integration. |

The foundation purchases materials; Tumbenla verifies and publishes the evidence. Foundation receipt of money and verified purchase of materials must remain separate facts.

The newly added `docs/payment-provider-decision-brief.md` names automatic ePayco split payments and proposes Música para la Paz. Preserve that work, then reconcile it with the decisions above. Música para la Paz remains a candidate pending verification; automatic checkout splitting is not this release’s disbursement mechanism.

## 2. Discovery register

### Existing implementation

These findings are based on source inspection, not production penetration testing.

| ID | Finding | Required response |
|---|---|---|
| D01 | Commerce has a fake adapter with only checkout creation. The separate boilerplate payment system is subscription-oriented and contains unsafe webhook validation. | Build on the commerce domain; do not route drink payments through the subscription service. |
| D02 | `confirmarPago` accepts order/provider/reference without verifying payment amount, currency, merchant, or environment. It is placed in a server-action module, although the inspected development manifest does not expose it. | Move confirmation behind an internal server-only verification boundary. |
| D03 | Checkout creates an order for every submission and has no durable payment-attempt model. Provider errors leave pending orders. A subsequent successful charge against an already processed order can go unrecorded. | Persist attempts, submission idempotency, every actual charge, and uncertain outcomes. |
| D04 | Confirmation already uses a conditional state update to avoid duplicate QR issuance, but ignores a possible ledger-publication failure. | Retain the concurrency gate and make payment, QR issuance, and ledger effects atomic. |
| D05 | Platform ledger-account uniqueness uses a nullable venue ID; concurrent creation can produce duplicate platform accounts. Ledger idempotency does not compare operation contents. | Enforce correct account uniqueness and reject reused keys with conflicting contents. |
| D06 | Ledger entries resist updates/deletes, but transaction publication and database invariants are incomplete. A globally balanced total can conceal malformed individual transactions. | Enforce complete, balanced, immutable postings and reconcile each transaction separately. |
| D07 | Refunds currently change internal records without returning money. Refund calculation can race QR redemption. | Introduce a refund workflow with reserved units, external confirmation, and shared locking. |
| D08 | Settlement reads balance before its transaction, allowing concurrent overpayment. A partial settlement marks all open redemption movements settled. | Reserve specific amounts transactionally and allocate partial settlements explicitly. |
| D09 | Settlement does not require evidence that money moved. | Separate preparation, execution, unknown outcome, and bank-confirmed completion. |
| D10 | Public donation totals depend on incoming bar settlements, omitting app-only and certain offset cases. Personal history uses whole-order status and mishandles partial refunds/expiry. | Derive totals from unit allocations and their reversals, funding, and transfers. |
| D11 | Prices and percentages are snapshotted, but historical product names/descriptions remain mutable joins. | Freeze the full commercial promise, recipient, and policy version on purchase. |
| D12 | There is no foundation beneficiary, foundation payout, or amount-based purchase-allocation model. Real purchase administration is unfinished. | Add the foundation-to-purchase evidence chain. |
| D13 | Scanner expiry checks are incomplete; concurrent scans of different cash-order units can leave the order pending. The expiry job has no schedule. | Enforce deadlines inside transactions and derive order state from actual unit states. |
| D14 | The customer page assumes the first N QR codes were redeemed. The scanner creates new retry keys and does not reliably recover lost responses. | Return unit identities and preserve scan-operation IDs until their outcomes are known. |
| D15 | Payment method is visibly shown beside the QR. There is no commerce-specific throttling. | Add a consistent QR presentation and server-side abuse limits. Do not rely on payment-method secrecy as a fraud guarantee. |
| D16 | Owner-only menu permissions and verified-email history linking already exist. Some documentation incorrectly describes their current behavior. | Preserve these protections and correct the documentation. |
| D17 | CI does not run a comprehensive commerce suite. Some existing scripts mutate the local development database. | Add isolated, repeatable database and browser tests to CI. |
| D18 | GitNexus is indexed at older commit `2c4b71b`. | Refresh during implementation and perform required impact checks before editing symbols. |

Primary implementation evidence: [order/payment actions](/Users/arturolopez/Documents/npi/src/app/actions/pedidos.ts), [settlement/refund actions](/Users/arturolopez/Documents/npi/src/app/actions/liquidar.ts), and [scanner actions](/Users/arturolopez/Documents/npi/src/app/actions/escanear.ts). Related findings involve the commerce ledger, database schema, order screen, history queries, and CI configuration.

### ePayco findings and verification gates

- **Checkout:** Smart Checkout v2 supports backend-created sessions through APIFY authentication and `/payment/session/create`; the browser opens the returned session. It documents `uniqueTransactionPerBill`, but its retry guarantees must be tested. The documentation inconsistently spells `Invoice`/`invoice`. [Official implementation](https://docs.epayco.com/docs/checkout-implementacion)
- **Confirmation:** The documented signature is `SHA256(customerID^p_key^reference^transactionId^amount^currency)`. Invoice, status, and test mode are absent from that formula. Therefore, signature verification alone is insufficient; verify the transaction separately against ePayco’s server and compare all expected fields. References must remain strings. [Official confirmation contract](https://docs.epayco.com/docs/checkout-respuesta-y-confirmacion)
- **Methods:** The current tables describe credit/debit cards and PSE. Availability, enabled methods, pending behavior, and actual sandbox coverage require account-level validation. [Payment methods and states](https://docs.epayco.com/docs/checkout-tablas-de-datos)
- **Deductions:** Reviewed APIs do not establish a complete final fee/withholding breakdown at checkout confirmation. Do not treat `gross − amountNet` as commission. Reports can support manual reconciliation. [APIFY reference](https://api.epayco.co/), [dashboard reports](https://ayuda.epayco.com/en/articles/10739-dashboard), [deduction categories](https://epayco.com/calculadora-comisiones/)
- **Refunds:** Do not assume a universal refund API. Legacy reversal documentation has method/time restrictions and uncertain compatibility with v2 references. The first release must support verified manual refunds. [Reversal guidance](https://ayuda.epayco.com/en/articles/2018-a-qu-mtodos-de-pago-se-les-puede-hacer-reversiones-con-epayco)
- **Distribution:** Checkout splitting, merchant withdrawals, and third-party payouts are different capabilities. This release uses reviewed bank transfers and does not depend on ePayco split-payment activation. [Split-payment documentation](https://docs.epayco.com/docs/split-descripcion)
- **Limits:** Published terms state a COP 5,000 minimum, with account limits subject to change. On 2026-09-16 the configured sandbox account rejected session creation above COP 200,000 with an explicit `Amount must be between 5000 and 200000` validation error. That is account/provider evidence, not a Tumbenla order-total rule: the application keeps COP 700,000+ orders valid and must show the provider restriction until ePayco raises it. Verify the live merchant limit and accounting configuration before enabling live checkout. [Current terms](https://epayco.com/terminos-y-condiciones-generales-2026/)
- **Scheduling:** Vercel Hobby supports daily cron; it does not guarantee precise invocation time or retry failed runs automatically. Recovery must also work through webhooks and explicit reconciliation. [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [execution behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

Unverified contracts become explicit checkpoint requirements, not guessed implementations: merchant eligibility for collecting bar proceeds, foundation agreement, tax responsibility, checkout retry behavior, transaction lookup, settlement reports, and refund procedures.

## 3. Implementation design

### Facade, strategies, and adapters

Keep this within the existing Next.js application and PostgreSQL database.

| Interface | Responsibility |
|---|---|
| `CommercePaymentService` facade | Start/reconcile payments, accept verified provider events, request refunds, and expose customer payment state. |
| `CollectionGateway` adapter | Create checkout, authenticate notifications, retrieve authoritative payment state, and expose supported capabilities. Implement ePayco and test adapters. |
| `GatewaySelectionStrategy` | Choose the provider for a new attempt. Existing operations use their persisted provider, merchant configuration, and environment. |
| `AllocationPolicy` | Calculate the versioned split from verified deductions and immutable order data. |
| `SettlementService` | Calculate eligible balances, reserve allocations, record offsets, and manage transfers/refunds. |
| `DisbursementStrategy` | Produce and reconcile transfer instructions. Implement reviewed bank transfers initially. |

Provider-specific payloads stay inside adapters. No UI, scanner, or ledger function calls ePayco directly.

Changing the active gateway affects new checkouts only. Old payments, webhooks, refunds, and reconciliation continue through their original provider configuration.

### Durable records and invariants

Add the minimum records needed for:

- Payment attempts, actual provider transactions, received events, and processing outcomes.
- Immutable order/unit snapshots and versioned allocation results.
- Itemized deductions and evidence-backed clearing/reconciliation.
- Bar credit limits, expiring reservations, receivables, and offsets.
- Verified beneficiaries and bank-detail versions.
- Refund and payout operations with amount-bearing allocations.
- Foundation purchases, evidence, and funding allocations.
- Audit events and recovery checkpoints.

Separate payment status, preparation confirmation, allocation finality, and payout status. A single `paid` flag cannot represent all four.

Use unique constraints for provider/account/environment/reference, checkout submission keys, unit ordinal within an order, and financial operation keys. Identical retries return the existing result; conflicting reuse fails.

Use exact arithmetic: integer minor units internally, integer basis points for percentages, decimal strings at database boundaries. Preserve reported fractional deductions and display their precision when needed.

For each order:

1. Reconcile gross collected and each final deduction separately.
2. Allocate deductions across stable unit ordinals deterministically, assigning residual minor units by ordinal.
3. Calculate each unit’s donation once using half-up rounding; the bar receives the remainder.
4. Preserve the result. Subsequent corrections create explicit adjustment records.

Illustrative arithmetic only: COP 100,000 gross less COP 6,000 final deductions leaves COP 94,000. A 50% split produces COP 47,000 for each recipient.

Temporary holds affect payout availability, not the distribution formula. Withholding retains its correct tax classification and ownership; it is not renamed “gateway expense.”

### Checkout and payment verification

- Keep guest checkout and existing account linking.
- Obtain product, price, percentage, recipient, tax profile, and quantity limits from the server.
- Persist a submission key and immutable snapshot before contacting ePayco.
- Reuse an existing active attempt. A timeout produces an uncertain state, not permission to create another charge.
- Use hosted Smart Checkout v2 for card/debit/PSE; card credentials remain with ePayco.
- Enable the verified method configuration and provider duplicate-invoice protection as additional defenses.
- Treat browser return data only as a request to reconcile.
- Verify notification signatures using the original field strings and constant-time comparison.
- Perform server-to-server lookup against a fixed provider host; require matching merchant, invoice/attempt, reference, transaction, gross amount, currency, and environment.
- Issue app-payment QR units only after authoritative approval, atomically with the financial posting.
- Record a second successful charge as an overpayment requiring resolution; never issue extra units or discard it.
- Keep pending PSE payments pending until verified. Browser closure and local timeouts do not prove payment failure.

Add a commerce-specific webhook endpoint, a bounded reconciliation endpoint, and richer order-status responses. Do not reuse the subscription webhook route.

Order responses return explicit unit IDs/states, deadlines, refund state, and donation finality. Keep order bearer tokens and redemption codes out of provider metadata, ordinary logs, and bar administration responses.

### QR redemption and bar credit

Use one documented lock order for operations sharing funds: treasury scope where necessary, venue, order, then units/allocations in stable order. External network calls run outside database locks.

- Retain one redeemable record per unit and conditional single-use transitions, but expose one
  canonical QR/code per order to the buyer and email.
- Recheck authorization, venue, payment eligibility, expiry, suspension, and refund state inside the transaction.
- Persist scanner operation IDs through retries and reloads. A replayed success clearly says it was already confirmed.
- Lock the order before its units; one scan conditionally redeems every still-issued unit in stable
  order and returns the full cash amount to collect. Keep state and accounting by unit identity.
- QR redemption means preparation is confirmed. Preserve the customer message that staff will prepare and deliver the order.
- Present an identical dedicated QR view for app/bar orders; keep customer payment details in a separate view.

Cash credit follows a deliberately simple rule:

`available credit = approved limit − outstanding donation debt − active reservations`

Do not count unsettled or merely expected app proceeds as extra credit.

- Start a venue that has never had a credit policy with COP 500,000 of system-default credit.
  Materialize that default as an audited version 1 policy on first use. Any manual policy history,
  including a zero limit or suspension, suppresses automatic recreation.
- Reserve the cash donation obligation before issuing its QR.
- Reservation and QR expire after 15 minutes; retries do not extend that deadline.
- Redemption converts the relevant reserved amount to debt due seven days later.
- Expiry releases only unused reservations.
- Overdue debt blocks new cash reservations. Existing valid reservations remain usable until expiry unless the bar is suspended for security.
- Apply verified repayments and offsets oldest-first without resetting remaining debt age.
- Offset only against specifically identified, cleared bar earnings. Consume each amount once and release equivalent real backing for the foundation.
- Do not net balances across different bars, even when they share an owner.
- Bar-declared POS fees do not reduce its donation obligation.

Rate-limit checkout, cash reservations, scanning, and reconciliation using database-backed controls. Bound simultaneous cash reservations per shopper/session and monitor venue-wide reservation abuse. Cash-cap exhaustion must not disable app payments.

### Refunds, transfers, and evidence

**Refunds**

Reserve eligible units before external action so they cannot also be redeemed. Support partial refunds by unit and full-price refunds for unclaimed units.

Track requested, reserved, submitted/unknown, confirmed, and failed outcomes. Provider or verified bank evidence is required before saying money was returned. Manual refunds must be to a verified original payer destination.

At 45 days, expire unclaimed app QR units and retain the refund liability. Reserve coverage includes fees and withholding shortfalls, not merely the gateway’s net balance.

**Reviewed transfers**

The operator selects eligible balances; the system creates fixed instructions with beneficiary version, amount, currency, and operation ID.

Reserve funds before showing executable instructions. Once execution may have occurred, keep them reserved until banking records establish the outcome. Do not regenerate a second transfer after an uncertain result.

Require actual bank-record verification, transaction reference, and evidence. A screenshot alone does not prove settlement. Partial transfers consume exact allocation amounts.

Operating funds cover transfer expenses, unrecoverable refund costs, and initial dispute losses. New payouts are blocked when required refund coverage, known disputes, or the operator-configured risk reserve are underfunded.

One verified platform operator can perform the initial manual workflow. The audit trail records each action; this is not represented as independent two-person approval.

**Foundation evidence**

- Verify legal identity, agreement, and banking details before payout.
- Recipient changes affect new orders only. Bank-detail changes require new verification; prepared transfers retain their approved destination.
- Record foundation receipt separately from subsequent purchases.
- Allow purchases to consume portions of multiple transfers, with amount caps preventing duplicate attribution.
- Use R2 for retained originals and separately reviewed public evidence. Keep banking/personal information private.
- Publish only verified, appropriately redacted purchase evidence. Preserve corrections and withdrawn publications in the audit trail.

### Customer, bar, and operator views

- Menu/checkout explain that app percentages apply after deductions; exact pesos remain pending until reconciled.
- History separates pending allocation, final donation amount, and transfer progress. Refunds and partial redemption must not erase unrelated contributions.
- Bar accounts show earned, pending, reserved, paid, debt, credit limit, and repayment deadlines.
- Platform accounts show payment exceptions, unreconciled deductions, refund obligations, payouts, cash debt, and foundation balances.
- Public transparency separates money allocated, backed by collected funds, transferred to the foundation, and supported by verified purchases. Never add these stages together as separate donations.
- Add all navigation through visible menus/buttons and document click paths.

### Recovery using Neon and Vercel

Process webhooks immediately within a bounded request. Persist processing state and return a retryable error if verification or financial application fails.

Customer order access and an operator’s “Reconcile” action can trigger bounded rechecks. Ordinary UI polling reads local state; it must not call ePayco every second.

Use a daily authenticated Vercel cron for missed events, stale attempts, refundable expiry, expired cash reservations, and integrity checks. Store leases, cursors, and last successful completion in Neon.

Expiry and credit enforcement also run transactionally when relevant operations occur, so correctness does not depend on cron punctuality.

If a provider reference is missing, no hosted session exists, and automatic lookup cannot establish the transaction, place the attempt in operator review. A hosted session normally has no transaction reference until the buyer submits payment; keep that state pending and resumable instead of escalating it. Do not guess that it failed.

Accepted tradeoff: an unattended payment can remain pending until a provider retry, daily recovery, or human reconciliation. Show recovery age/backlog in the admin panel.

## 4. Resumable implementation checkpoints

Each checkpoint records status, commit, affected files, commands/results, evidence, remaining blockers, and the exact next action in the plan document.

- [x] **P0 — Read-only discovery and business decisions.** Completed in this planning session.
- [x] **P1 — Persist the plan and reconcile doctrine.** Save this document; preserve concurrent edits. Update the provider brief, product decisions, financial metric definitions, and validation harness to reflect the confirmed model.
- [ ] **P2 — Verify ePayco contracts — IN PROGRESS.** Official documentation and synthetic fixtures are recorded, but no account-backed sandbox capture, deduction report, duplicate-invoice observation, or verified refund procedure exists yet. Capture sanitized sandbox fixtures for session creation, card/debit/PSE, verification, pending/failure, duplicate invoice behavior, and uncertain requests. Obtain representative deduction reports and documented manual refund procedures. Record unsupported capabilities explicitly.
- [x] **P3 — Establish migration and test foundations — COMPLETED 2026-09-11.** GitNexus was refreshed, the local legacy ledger was audited read-only, the additive commerce schema is wired into Drizzle, migration `0016_panoramic_calypso.sql` is applied locally, and isolated PostgreSQL tests verify migration and financial invariants. Historical orders are preserved as `legacy_unverified` snapshots and units.
- [x] **P4 — Implement facade and collection adapter — COMPLETED 2026-09-12.** App checkout now uses `CommercePaymentService`, persisted immutable snapshots and globally idempotent attempts, versioned gateway bindings, hosted Smart Checkout v2 launch, signed webhook intake, authoritative lookup, bounded browser-return recovery, explicit payment-state UI, charge/overpayment records, and atomic QR + V2 finance posting. The unsafe direct-confirmation compatibility export fails closed. Account-backed ePayco evidence remains P2, not local P4 evidence.
- [x] **P5 — Repair accounting and unit lifecycle — COMPLETED 2026-09-12.** Final provider deductions now create immutable, deterministic allocation revisions and balanced clearing/correction postings. V2 app units redeem atomically with authorization rechecks and final-allocation release, expiry retains the full refund liability without automatic donation, and refund reservation shares the unit lock with redemption. Legacy cash/legacy-unverified paths remain isolated during P6 migration.
- [x] **P6 — Implement bounded cash credit — COMPLETED 2026-09-12; DEFAULT UPDATED 2026-09-14.** Cash checkout starts a venue with an audited COP 500,000 default only when it has no policy history, atomically reserves only the frozen donation obligation for 15 minutes, honors manual zero/suspended policies, enforces venue/shopper/concurrent capacity, converts redemption into seven-day debt, releases expiry, blocks new cash orders on overdue debt, and applies verified repayments or specifically identified cleared app earnings oldest-first.
- [x] **P7 — Implement reviewed financial operations — COMPLETED 2026-09-12.** Provider deduction reconciliation and incoming credit repayments require reviewed evidence of an approved kind. Legal beneficiaries, agreements, and versioned bank destinations are independently verified. Refunds and exact-source venue/foundation payouts now move through reserved, submitted/unknown, bank-confirmed, failed, and compensating-reversal paths with frozen destinations, cash/refund/dispute/reserve coverage, and immutable audit records. The admin accounts page exposes the reviewed workflow; external bank/provider execution remains a P2/P10 gate.
- [ ] **P8 — Complete foundation transparency — IN PROGRESS.** Private-original/public-redaction custody, purchase administration, amount-capped funding attribution, and V2-derived customer/bar/operator/public views are implemented and covered by local object-port and PostgreSQL tests. Completion still requires the real R2 account, buckets, CORS, credentials, and remote retention/access verification.
- [x] **P9 — Complete recovery and security acceptance — COMPLETED LOCALLY 2026-09-13.** Authenticated daily recovery, durable leases/backlog, deployment guards, database-backed rate limits, adversarial/concurrency coverage, and a disposable PostgreSQL Playwright harness are implemented. The harness now tests a production build with bounded deadlines, explicit API/UI state boundaries, retained failure traces, isolated role sessions, and guaranteed database cleanup. The complete browser suite, a five-repeat purchase/redemption stress run, repository lint, typecheck, build, and all 91 commerce tests pass locally.
- [ ] **P10 — Validate preview and prepare live activation.** Demonstrate all three electronic methods, cash, refund, payout, and evidence flows; record operational sign-off and outstanding account-specific limits.

Resume procedure: read the plan, inspect branch/status/diff, review completed checkpoint evidence, and continue the first incomplete dependency. Never infer completion from a checkbox without its validation record.

Migrations must support the shared preview database. Do not rewrite old financial promises or silently classify historical simulated balances as real funds. Use policy versions and explicit legacy reconciliation. Rollback must disable new operations while preserving pending-payment/refund processing.

## 5. Acceptance tests and release gates

### Required automated tests

Use Bun tests with ephemeral PostgreSQL for real transactions, deterministic concurrency barriers, adapter HTTP fixtures, and Playwright for browser flows. Run the commerce suite in CI.

| Area | Required cases |
|---|---|
| Checkout | Duplicate clicks/reloads, concurrent identical requests, conflicting idempotency payload, timeout after session creation, genuine second purchase. |
| Tampering | Altered price, percentage, quantity, merchant, invoice, amount, currency, environment, or recipient. |
| Webhooks | Missing/invalid signature; modified unsigned fields with valid signature; duplicate/concurrent/out-of-order events; lookup failure; late PSE approval. |
| Charges | Same reference attached to another order; two approved charges for one order; provider switch with old attempts still pending. |
| QR | Same code scanned concurrently; lost-response retry; units redeemed out of order; wrong bar; revoked staff; unpaid/refunded/expired units. |
| Races | Redemption versus refund/expiry; different units of one cash order; credit reservation versus repayment; concurrent payouts and offsets. |
| Accounting | Injected ledger failure rolls back effects; duplicate platform-account creation; incomplete/unbalanced postings rejected; operation-key conflicts. |
| Net split | 40/50/100%; fractional deductions; multi-unit remainders; partial refunds; provider corrections; temporary holds. |
| Cash abuse | Zero limit, exact-limit boundary, concurrent reservations, reservation expiry, overdue debt, partial repayment, self-ordering and capacity exhaustion. |
| Transfers | Duplicate bank reference; partial transfer; uncertain result; failed/reversed transfer; beneficiary change; insufficient cleared backing. |
| Refunds/disputes | Full gross refund despite deductions; refund pending during scan; duplicate refund; dispute after payout; insufficient operating reserve. |
| Transparency | App-only, cash-only, and offset cases; partial fulfillment/refund; donation pending; foundation paid but purchases unverified; duplicate purchase allocation. |
| Authorization/privacy | Cross-bar access, owner/staff separation, guest linking, guessed codes, private receipts, token leakage, unauthorized reconciliation/admin actions. |
| Recovery | Missing webhook, closed browser, daily job failure/overlap, manual recovery, unavailable reference lookup, backlog beyond one execution batch. |

### Manual end-to-end acceptance

Use independent browser profiles and an actual phone for the worker.

1. Platform operator approves the bar, verifies beneficiaries, and assigns credit.
2. Owner opens the account menu → bar administration → menu; publishes a compliant product.
3. Customer opens the bar → selects product → pays with credit card, debit card, or PSE; verify each method separately.
4. Pending electronic payment shows no usable paid QR; approval enables exactly the purchased units.
5. Worker opens bar panel → scanner; confirms one unit. Customer sees preparation confirmed and can order again or view history.
6. Repeat through payment at the bar; verify reservation, debt, deadline, and collection instructions.
7. Operator opens accounts → reconciliation → checks provider deductions and cleared funds.
8. Operator prepares a partial bar transfer and foundation transfer, records verified banking results, and confirms exact remaining balances.
9. Operator records a foundation purchase and publishes reviewed evidence; verify public totals at each stage.
10. Repeat with a refund, duplicate scan, interrupted connection, and a second bar under the same owner.

### Gates before live money

- Written confirmation of the merchant collection model, beneficiary agreements, tax/invoicing responsibilities, and refund handling.
- Verified account-specific transaction limits, enabled card/debit/PSE methods, and real fee/report mappings.
- HTTPS webhook and return paths tested on the stable deployment.
- Separate sandbox/live configuration; fake provider unavailable in deployed live operation.
- Server-only credentials validated through environment configuration; examples contain names/placeholders only.
- Verified beneficiary accounts, funded operating reserve, explicit per-bar limits, and zero unresolved ledger inconsistencies.
- Evidence storage, operator recovery, and daily job tested; customer-facing financial claims match actual state.
- No unresolved critical findings in the payment, redemption, refund, or payout paths.

The system must prevent duplicate internal entitlements and cap recorded cash exposure. It cannot independently prove physical delivery, capture every off-platform cash sale, or eliminate collusion. Those limits must remain documented, with audited exceptions and manual investigation rather than claims of complete fraud prevention.

## 6. Implementation journal

### 2026-09-11 — Approved plan persisted

- Baseline: `d01f3c9`; working branch: `payment-gateway`.
- The complete owner-approved plan above is retained as the implementation contract. The statement
  about no implementation being completed in section 1 describes the planning checkpoint, not a
  claim that later journal entries have not happened.
- Existing changes to `PRODUCT.md` and the untracked `docs/payment-provider-decision-brief.md`
  predate this implementation. Preserve their discovery and legal/account questions while marking
  automatic checkout splitting superseded by the owner-confirmed reviewed-transfer model.
- Validation: document persistence only. No sandbox transaction, migration, provider-account
  activation, live payment, refund, transfer, or evidence-storage validation is implied.
- P1 evidence: reconciled `PRODUCT.md`, `docs/payment-provider-decision-brief.md`,
  `org/datos/METRICAS.md`, and `docs/validation-harness.md`. The current doctrine is
  ePayco Hosted Smart Checkout v2 for collection, followed by reviewed manual bank
  transfers. Automatic checkout splitting remains preserved as historical discovery but
  is superseded for this release. The percentage is fixed at purchase; the exact peso
  allocation stays pending until gross, itemized deductions, and withholding are reconciled.
  A candidate foundation must be verified before it can receive funds; its receipt is a
  separate fact from a verified material purchase. Unclaimed app units expire after 45
  days without automatic allocation and remain eligible for a full gross-price refund.
  Cash has an operator-approved limit of zero by default, 15-minute reservations, and
  seven-day debt after redemption.
- Documentation validation: read-only diff/status review only. No source code, migration,
  provider-account activation, sandbox transaction, live payment, refund, transfer, or R2
  evidence-storage validation was performed by this checkpoint.

### P1 decision and doubts register — review tomorrow

| Question | Choice recorded | Reason and remaining doubt |
|---|---|---|
| Preserve the old gross ledger or add versioned sidecars? | Use additive, versioned records with explicit legacy/sandbox classification. | Preserves historical promises without treating simulated balances as real funds. All new purchases must route through the payment facade; unsafe legacy writes must be disabled during implementation. |
| What to do without ePayco/R2 credentials? | Build documented HTTP fixtures and isolated database/storage contract tests; leave account and remote-R2 gates pending. | Tests can progress without inventing credentials or claiming a remote contract. |
| Stale GitNexus FTS index versus skipping impact work? | Use the supported full rebuild. | Incremental refresh failed on inconsistent FTS; the rebuild completed in 9.2 seconds with 3,027 nodes, 6,597 edges, and 239 flows. The critical ledger impact report is saved as `payment-impact-baseline.json`. |
| Spanish entry-point exports during integration? | Preserve compatibility wrappers and add English services when graph-aware rename is unavailable. | Avoids a cosmetic cross-repository rewrite while preserving callers; rename only with verified call-graph support. |
| Existing local financial rows? | Keep the one legacy paid app order using the fake provider classified as simulation. | A read-only local audit found no duplicate platform accounts and no transaction imbalance/incomplete postings; this is not production evidence. |

### P1 external gates still pending

- ePayco merchant eligibility, contract, visible merchant identity/NIT, and account
  activation.
- Account-level enablement and sandbox evidence for credit card, debit card, and PSE,
  including pending/retry/duplicate-reference behavior.
- Itemized ePayco fee and withholding reports, authoritative transaction lookup, and a
  documented full-gross refund/reversal procedure.
- Legal and operational verification of Música para la Paz (identity, authority, bank
  details, agreement, and reporting/returns handling) before it can be a beneficiary.
- Manual bank-transfer controls, evidence requirements, operating reserve, and live payout
  approval.
- R2 account/bucket/CORS/credentials and evidence-retention contract tests against the
  real storage account.
- Preview/production HTTPS webhook and return paths, separated environments, and deployment
  guards.

The local credential-presence check found no configured `EPAYCO_PUBLIC_KEY`,
`EPAYCO_PRIVATE_KEY`, `EPAYCO_CUSTOMER_ID`, `EPAYCO_P_KEY`, or R2 account/access/secret
values; no secret values were printed. Main reported that the baseline `bun run typecheck`
passed before source integration. These facts do not close any external gate.

### 2026-09-11 — Working-tree implementation assessment

- Branch and baseline remain `payment-gateway` at `d01f3c9`; all payment-gateway work is
  uncommitted. Pre-existing doctrine changes remain in `PRODUCT.md`,
  `docs/validation-harness.md`, `org/datos/METRICAS.md`, and
  `docs/payment-provider-decision-brief.md`.
- New implementation files inspected:
  `src/database/commerce-schema.ts`, `src/lib/commerce/money.ts`,
  `src/lib/commerce/allocation.ts`, `src/lib/commerce/gateways/*`, and
  `tests/commerce/gateways.test.ts`. The impact baseline remains in
  `docs/plans/payment-impact-baseline.json`.
- GitNexus reports the index current at `d01f3c9`. The saved impact report marks
  `publicarMovimiento` CRITICAL because it reaches checkout, payment confirmation,
  scanning, settlement, refund, and expiry flows. None of those existing symbols has
  been edited in the current working tree.
- Read-only local PostgreSQL verification found no duplicate platform ledger accounts
  and no incomplete or unbalanced legacy ledger transaction. It found one `app` order
  in `paid` state, consistent with the journal's simulated legacy row. Neither
  `payment_attempt` nor `commerce_order_snapshot` exists in the database.
- Integration evidence: no application or migration file imports the new commerce
  schema or gateway adapter. `drizzle.config.ts` still points only to
  `src/database/schema.ts`, and there is no generated migration for the new tables.
  The draft layers also disagree on environment vocabulary (`test` in the gateway
  contract versus `sandbox` in the database checks), and the persisted attempt draft
  does not yet represent the binding's `configVersion` as an explicit field. Resolve
  both before generating the migration so historical gateway bindings remain usable.
- Validation results:
  - `bun test tests/commerce/gateways.test.ts` — **failed before tests ran** because
    `server-only` was imported without the React server condition (0 pass, 1 fail).
  - `bun run typecheck` — **failed with 9 errors**: two gateway capability array typing
    errors, missing `bun:test` declarations, and readonly `NODE_ENV` mutations in tests.
  - focused Biome lint over the nine new TypeScript files — **failed with 5 errors**, all
    `noDelete` violations in the test file.
  - repository-wide `bun run lint` also fails in pre-existing `.agents/skills` assets;
    those unrelated diagnostics do not excuse the five focused payment-test errors.
- Checkpoint decision: P1 is complete. P2, P3, P4, and P5 are all in progress but none
  is complete. P6-P10 have schema placeholders at most and remain unimplemented.
- External blocker: P2 cannot be completed without approved ePayco account access and
  representative sandbox/report/refund evidence. Local work may continue under the
  already recorded synthetic-fixture limitation.
- **Exact next action:** repair the P3 test foundation first: make the gateway tests run
  with the React server condition, add Bun test types, fix the capability-array typing
  and focused lint failures, then rerun
  `bun test tests/commerce/gateways.test.ts`, `bun run typecheck`, and focused Biome.
  Once green, wire the reviewed schema into Drizzle and generate the additive migration
  before connecting any checkout or webhook path.

### 2026-09-11 — P3 migration and test foundation completed

- Added `@types/bun` and the durable `bun run test:commerce` command, which runs with the
  React server export condition required by server-only payment modules.
- Wired `src/database/commerce-schema.ts` into Drizzle Kit and the runtime database
  client. Normalized persisted gateway environments to `test | live` and added the
  immutable provider configuration version to payment attempts.
- Generated and reviewed additive migration `migrations/0016_panoramic_calypso.sql`.
  Removed duplicate statements already owned by hand-authored migrations 0014-0015.
- The migration backfills every pre-facade order and redemption as
  `legacy_unverified`; it never upgrades a simulated `paid` flag into evidence of real
  funds. The local row was preserved as one snapshot with one matching unit.
- Added deferred database enforcement that a posted V2 finance transaction has at least
  two entries, balances to zero, and uses accounts in the transaction currency. Posted
  transactions and entries are immutable; invalid posting rolls back atomically.
- Added isolated disposable-PostgreSQL tests plus deterministic exact-money/allocation
  tests. Validation at completion:
  - `bun run migrate:local` — passed against the existing local database.
  - `bun run test:commerce` — 22 passed, 0 failed.
  - `bun run typecheck` — passed.
  - focused Biome over commerce/schema/test files — passed.
- **Next action:** implement the P4 `CommercePaymentService` against injected database and
  gateway dependencies, beginning with durable submission idempotency and immutable
  snapshots. Keep provider calls outside transactions; do not edit the CRITICAL legacy
  `publicarMovimiento` path until the new posting path is covered by transaction tests.

### 2026-09-12 — P4 collection facade and application flow completed locally

- Added migration `0017_friendly_jean_grey.sql`: checkout submission keys are globally
  unique, so a retry can find its order before knowing an order ID; unauthenticated events
  may be recorded as environment `unknown` without misclassifying them as test or live.
- `CommercePaymentService` now freezes the published product, verified foundation,
  allocation policy, quantity, customer, gateway account/configuration/environment, and
  unit rows before any provider request. One conditional `created -> submitted` claim lets
  only one concurrent caller contact the provider. Deterministic rejection, unknown
  submission outcome, hosted-session resumption, and conflicting idempotency reuse remain
  distinct durable states.
- Authoritative approval validates merchant, invoice/attempt, reference, transaction,
  gross, currency, and environment at both adapter and facade boundaries. The same
  transaction records the charge, marks the compatibility order paid, issues exactly one internal
  redemption per immutable unit, exposes one canonical order QR, links each internal redemption to
  its unit, and posts a balanced V2 custody entry.
  A second approved charge is retained as an operator-review overpayment without issuing
  more units. Injected finance failure rolls every effect back.
- Added the ePayco v2 browser launcher using the documented
  `configure({ sessionId, type, test })`, hooks, and `open()` contract; the browser return
  only requests server reconciliation. Added a size/type-bounded form webhook, local
  payment-status polling, reference-only bounded recovery, and separate test/live plus
  historical credential configuration. `fake` still throws in production or any Vercel
  deployment.
- App checkout now goes through the facade. The legacy `confirmarPago(order, provider,
  reference)` export remains only for source compatibility and always fails closed because
  those arguments cannot authenticate a payment. Payment pages never send the order bearer
  token or QR code in provider metadata. The checkout submission key survives reloads and
  pending/uncertain navigation, and is cleared only at an approved/rejected terminal state.
- Customer state now exposes unit identities/states, payment state, expiry, refund state,
  and allocation finality. QR UI updates by unit identity rather than assuming the first N
  units were redeemed. App copy shows the percentage and an exact amount pending verified
  deductions; app expiry no longer claims an automatic donation.
- Validation at completion:
  - `bun run migrate:local` — passed with migrations 0016 and 0017.
  - `bun run test:commerce` — 36 passed, 0 failed, 132 assertions.
  - `bun run typecheck` — passed.
  - focused Biome checks over commerce, payment routes/components/actions, env, and tests —
    passed after formatting the touched files.
  - `bun run build` — passed; Next registered the checkout, state, return, and confirmation
    routes as dynamic routes.
  - `.github/workflows/ci.yml` now runs `bun run test:commerce` against its disposable
    PostgreSQL service.
- External limitation: no statement above proves an ePayco account, method activation,
  sandbox payment, deduction report, duplicate-invoice behavior, or refund procedure; those
  remain P2/P10 gates.
- **Next action:** implement P5 deduction reconciliation and immutable allocation runs,
  then move scan/refund/expiry transitions to the same V2 unit/finance boundary before
  disabling their legacy ledger writes.

### 2026-09-12 — P5 accounting and unit lifecycle completed locally

- Added immutable provider-deduction reports and allocation revisions. Final deductions use
  exact six-decimal parsing, deterministic minor-unit residual assignment, and the percentage
  frozen in the order snapshot. Temporary holds, estimates, and reversed deductions do not enter
  the final split. Provider corrections supersede the prior run and post explicit cash,
  deduction, and already-redeemed distribution adjustments instead of rewriting history.
- Extracted the V2 double-entry posting boundary. Approval, charge clearing, allocation
  corrections, and unit distribution all use content-hashed operation keys, reject conflicting
  reuse, omit zero entries, and remain subject to the database's deferred balance/immutability
  enforcement.
- Added migration `0018_noisy_the_stranger.sql` for durable unit-lifecycle operation keys. V2 app
  scans now update the compatibility QR and immutable unit in one transaction, recheck current
  venue membership inside that transaction, distinguish the same lost-response retry from an
  independent second scan, and release funds only when a final allocation exists. The CRITICAL
  legacy `publicarMovimiento` symbol was not changed; legacy and cash units keep their existing
  path until P6 replaces cash.
- V2 expiry now changes only unclaimed units to `expired`, voids their QR, records an audit event,
  and leaves the full gross customer-funds-held liability intact for refund. The legacy expiry
  job is explicitly restricted to `legacy_unverified` snapshots, preventing new app funds from
  being auto-donated.
- Refund preparation now reserves selected issued or expired units at their full gross amount,
  voids their QR, creates an exact reviewed financial operation/allocation, and uses the same row
  lock as redemption. No UI or internal state claims that money was returned at reservation time;
  external confirmation remains the reviewed P7 step.
- Validation at completion:
  - `bun run migrate:local` — passed through migration 0018.
  - `bun run test:commerce` — 48 passed, 0 failed, 172 assertions.
  - `bun run typecheck` — passed.
  - focused Biome over commerce schema/services, scanner/expiry integration, and commerce tests —
    passed.
  - `bun run build` — passed with the existing local non-pooler database warning only.
- External limitation: these tests prove local accounting and concurrency behavior, not an actual
  ePayco deduction report or refund. Those remain P2/P10 gates.
- **Next action:** implement P6 zero-default bounded cash credit: immutable cash snapshots/units,
  per-unit 15-minute reservations, concurrent limit enforcement, redemption into seven-day debt,
  expiry/release, repayment/offset allocation, and overdue/suspension checks.

### 2026-09-12 — P6 bounded cash credit completed locally

- Replaced the unbounded bar-order branch with `CashCreditService`. A bar order now exists only
  after an active operator-approved policy has enough capacity for its frozen per-unit donation
  obligation. Missing policies and zero limits fail closed without writing an order; app checkout
  remains independent.
- Added migrations `0019_blue_tiger_shark.sql` and `0020_new_doctor_faustus.sql` for database-backed
  shopper/venue reservation bounds and idempotent, content-hashed policy revisions. The admin
  accounts page now shows each venue's limit, active reservations, debt, availability, and overdue
  state, and can create an audited replacement policy. Sandbox is the default funding
  classification unless `COMMERCE_FUNDING_CLASSIFICATION=real` is set explicitly.
- Cash submission retries reuse the same immutable order, QR codes, and original deadline. Policy
  row locking serializes venue exposure so concurrent requests cannot cross the exact limit.
  Reservation expiry voids only unused QR units, releases capacity, and creates no debt or
  donation posting.
- The V2 scanner now handles app and cash units. A valid cash scan atomically consumes that unit's
  reservation, confirms preparation, tells staff the full price to collect, creates debt due seven
  days later, and posts a balanced venue-receivable/foundation-payable transaction. Different
  units of one order serialize correctly; current membership, venue status, policy suspension,
  deadline, and unit state are rechecked inside the transaction.
- Added verified credit repayment and offset operations. Repayments require a bank reference and
  evidence; offsets require named, cleared, final, real-funded, redeemed app allocations for that
  same venue. Both consume debt oldest-first, preserve the original due date on partial payment,
  reject source reuse, and post balanced V2 entries. Bar-declared POS fees never reduce the debt.
- Validation at completion:
  - `bun run migrate:local` — passed through migration 0020.
  - `bun run test:commerce` — 60 passed, 0 failed, 209 assertions.
  - `bun run typecheck` — passed.
  - focused Biome over commerce services/schema, checkout/scanner/admin integration, and tests —
    passed.
  - `bun run build` — passed with the existing local non-pooler warning only.
- External limitation: local tests do not approve a production venue credit limit or verify a real
  repayment/offset. Production classification remains an explicit activation gate.
- **Next action:** implement P7 reviewed financial operations: beneficiary/bank verification,
  refund submission/unknown/confirmation, payout reservation and confirmation, operating-reserve
  checks, evidence binding, and removal of V2 orders from the legacy refund/settlement actions.

### 2026-09-12 — P7 reviewed financial operations completed locally

- Added migrations `0021_young_kid_colt.sql` and `0022_known_skreet.sql` for venue-bound
  beneficiaries, versioned treasury reserve policies, funding-classified operations, frozen
  destination fingerprints, result detail, and compensating-operation links. The migrations are
  additive and passed a local replay through 0022.
- Legal beneficiaries require a reviewed signed agreement before verification. Bank destinations
  are separately versioned, require reviewed ownership evidence, retire the prior active version,
  and are frozen into prepared transfers so later bank changes cannot alter an instruction already
  approved.
- Final provider deductions now require reviewed provider-report evidence bound to the exact
  charge. Verified credit repayments likewise require a reviewed bank record bound to the bank
  reference; arbitrary evidence IDs no longer cross either trust boundary.
- Refund preparation freezes a verified original-payer destination fingerprint and reserves exact
  unclaimed units at full gross. An uncertain submission stays reserved. Confirmation requires a
  unique external reference, approved reviewed evidence, matching destination, and cleared cash;
  only then does it post the full-gross cash movement and mark units/customer state refunded. A
  verified failure restores the prior issued/expired unit state. The old `devolverAction` now
  refuses V2 orders instead of claiming a refund from the legacy ledger.
- Venue and foundation payouts reserve exact final, cleared, redeemed allocation components and a
  verified bank version. Bar and foundation components are independently consumable; bar payouts
  share their source pool with credit offsets. Prepared and uncertain payouts reduce availability,
  failed operations release it, and verified bank reversals restore cash/payables through a new
  compensating posting rather than rewriting history.
- Payout capacity is serialized on the treasury policy and subtracts held customer refund
  liabilities, disputed-charge exposure, already-reserved payouts, and the operator-configured
  minimum reserve. Refund confirmation gets priority but still cannot claim completion without
  enough cleared cash to execute it.
- `/admin/cuentas` now includes independently authorized actions and visible forms for treasury
  policy versions, provider reconciliation, beneficiary/agreement/bank verification, private
  evidence review, refund reservation, exact-source payouts, and uncertain/confirmed/failed/
  reversed external results. The source list reports venue and foundation availability separately.
- Validation at completion:
  - `bun run migrate:local` — passed through migration 0022.
  - `bun run test:commerce` — 69 passed, 0 failed, 232 assertions.
  - `bun run typecheck` — passed.
  - focused Biome over commerce schema/services/actions/admin UI/tests — passed.
  - `bun run build` — passed; `/admin/cuentas` remains a dynamic server route, with only the
    existing local non-pooler database warning.
- External limitation: these fixtures prove the local state machines and accounting, not a real
  refund or transfer, an actual bank record, an ePayco report, or remote R2 retention. Those remain
  P2/P8/P10 gates.
- **Next action:** implement P8 R2 evidence custody and public redaction, amount-capped foundation
  purchase attribution, and V2-derived customer, bar, operator, and public transparency views.

### 2026-09-12 — Paused checkpoint: P8/P9 local implementation and acceptance hardening

- Branch and baseline remain `payment-gateway` at `d01f3c9`. All payment work is still
  uncommitted; the working tree contains the plan/doctrine edits, migrations 0016-0026, commerce
  services, routes, admin/customer views, tests, and browser harness. No external payment,
  transfer, refund, or storage operation was executed during this work.
- P8 is locally substantial but not complete. Migrations `0023_shallow_johnny_storm.sql` and
  `0024_cloudy_fabian_cortez.sql` add verified private/public evidence metadata and immutable,
  correction-preserving purchase operation keys. `CommerceEvidenceStorage` verifies size, MIME,
  SHA-256, namespace separation, reviewed redaction, and private signed access. Foundation
  purchases are evidence-gated, publication-gated, idempotent, correction-preserving, and capped
  concurrently by both purchase value and confirmed foundation transfers. Customer history, venue
  account, operator accounts, and public transparency now read the V2 stages without claiming
  unverified purchases as impact.
- P8 external blocker: the local storage port is tested, but no R2 account/bucket/CORS credentials
  are configured. Remote upload, HEAD metadata, private signed download, public redaction URL,
  retention, and access-control behavior remain unverified and keep P8 open.
- P9 recovery/security implementation includes migration `0025_woozy_scream.sql`, hashed
  database-backed request limits, authenticated daily recovery with leases/cursors/failure state,
  operator recovery controls, deployment/funding guards, bounded notification bodies, and
  authorization checks. CI provisions PostgreSQL, installs Chromium, and invokes the disposable
  E2E runner before lint/build.
- Payment acceptance was hardened for genuine repeat purchases, server-owned checkout values,
  historical gateway configuration bindings, late PSE approval, out-of-order status callbacks,
  cross-order charge-reference reuse, concurrent duplicate callbacks, retryable authoritative
  lookup failure, stable shopper limits, venue-member self-order rejection, and concurrent credit
  reservation versus repayment.
- Migration `0026_lyrical_saracen.sql` and `ChargeDisputeService` add an evidence-backed dispute
  state machine. Open disputes reserve charge exposure; wins restore the approved charge; verified
  losses post exactly once from operating cash without double-counting provisional reserves.
  Provider callbacks cannot overwrite a manually disputed charge or downgrade an approved charge
  through a stale event. The operator accounts page exposes dispute controls and status.
- Latest green local evidence before pausing:
  - `bun run migrate:local` — passed through migration 0026.
  - `bun run test:commerce` — **89 passed, 0 failed, 341 assertions** across 12 files.
  - `bun run typecheck` — passed after the latest order-screen focus-refresh change.
  - focused Biome checks over the latest order screen and E2E scenario — passed; earlier focused
    checks over all payment/schema/service/admin changes also passed.
  - `bun run build` — passed after dispute/admin integration. It has not been rerun after the final
    two-line order-screen/E2E focus change.
- Browser checkpoint: the harness creates and force-drops a random isolated PostgreSQL database,
  applies every migration, seeds roles/commerce, starts the fake provider only in sandbox, and
  warms the slow Next.js development checkout path. The owner menu, cross-venue denial, and
  operator recovery/dispute scenarios passed in prior isolated runs. The guest flow now completes
  fake app payment and staff redemption, but twice failed to render `Confirmado` on the guest page
  within its allowance. A component-level `refetchOnWindowFocus: true` override and explicit
  `bringToFront()` were added and pass static checks, but the second browser run still failed at
  that same assertion. Therefore the E2E gate and P9 remain open; no full-suite pass is claimed.
- P2 and P10 remain externally blocked by approved ePayco account access and evidence: real
  sandbox card/debit/PSE captures, pending/failure/duplicate-invoice behavior, authoritative
  reports and deductions, full-gross refund procedure, stable HTTPS return/webhook paths, and
  reviewed live operating sign-off. R2 verification is the separate P8 external blocker.
- **Exact next action:** instrument the focused guest E2E immediately after staff redemption by
  polling `/api/orden/{token}/estado` and recording its returned unit/redemption state. If the API
  is already redeemed, fix or deterministically exercise the React Query refresh path; if it is
  not, trace the redemption transaction/read model. Then rerun the focused guest scenario, the
  complete `bun run test:e2e`, repository-wide `bun run lint`, `bun run typecheck`,
  `bun run test:commerce`, and `bun run build`. Only after those local gates pass should the next
  session perform the account-backed ePayco/R2 preview acceptance with supplied credentials.

### 2026-09-13 — P9 recovery/security acceptance completed locally

- The apparent guest-confirmation timeout was not a transaction or React Query defect. Live
  inspection during the stalled run showed the order and payment had completed but the test had
  not reached staff redemption. The old harness ran Next.js development mode, added a synthetic
  checkout warm-up, and allowed individual actions/assertions to wait between three and seven
  minutes. Compilation, hydration, or an intercepted click therefore looked like a test that
  neither passed nor failed.
- A production-build run exposed two hidden test-environment dependencies immediately instead of
  timing out: the fake gateway correctly refused `NODE_ENV=production`, and repeated logins hit
  Better Auth's request limit after three runs. Both are now explicit. The fake gateway and auth
  rate-limit exception share one fail-closed predicate that requires an explicit browser-test
  flag, sandbox funding, a loopback PostgreSQL database named `tumbenla_e2e_*`, and no
  `VERCEL_ENV`. Direct tests prove remote databases, real funding, incomplete flags, and every
  Vercel deployment remain excluded.
- The E2E runner now creates one disposable database, migrates and seeds it, builds once, serves
  with `next start`, forwards termination signals, enforces command deadlines, and force-drops the
  database in `finally`. Playwright has 10-second action/expect limits, a 15-second navigation
  limit, a 60-second test limit, no retries, and a retained trace on first failure. Role sessions
  are captured as storage state and used in fresh browser contexts.
- The guest scenario now proves each boundary in order: paid order and issued unit from the status
  API, exact unit identity, staff redemption, authoritative `redeemed` API state, the guest's own
  polling response, then the visible `Confirmado` state. This distinguishes a backend failure from
  a client refresh failure without relying on sleep or focus timing.
- Final local evidence:
  - focused purchase/redemption stress — **5 passed, 0 failed**, 20.5 seconds of Playwright time;
    each scenario completed in 3.0–3.5 seconds.
  - `bun run test:e2e` — **4 passed, 0 failed**, 6.1 seconds of Playwright time; its production
    build compiled successfully in 7.6 seconds.
  - `bun run test:commerce` — **91 passed, 0 failed, 350 assertions** across 13 files in 5.41
    seconds.
  - `bun run lint` and `bun run typecheck` — passed. Biome excludes vendored skill packages and
    generated HyperFrames compositions; it still checks 368 maintained repository files.
  - controlled `SIGINT` during the production build — exited with code 130; the subsequent
    PostgreSQL inventory contained no `tumbenla_e2e_*` database.
- P2, P8, and P10 remain open for external evidence only: approved ePayco account-backed sandbox
  captures and reports, real R2 upload/access/retention checks, and preview/live operational
  acceptance. No external payment, refund, transfer, or storage operation is claimed.
- **Exact next action:** with the required credentials and approvals supplied, execute the P2/P8
  account-backed sandbox and R2 checks in preview, preserve sanitized evidence, then run P10's
  card/debit/PSE, cash, refund, payout, and evidence acceptance before enabling live operations.

### 2026-09-14 — Real ePayco sandbox gate and payment progress feedback

- The fake browser journey remains a deterministic application test only. It proves order
  persistence, idempotency, local payment-state transitions, QR issuance, and redemption, but it
  does not prove ePayco authentication, Smart Checkout rendering, provider callbacks, signature
  validation, or authoritative transaction lookup. P2 cannot be closed with the fake adapter.
- The implemented adapter was compared with ePayco's current Smart Checkout v2 contract. It uses
  Basic authentication at `https://apify.epayco.co/login`, creates a v2 session at
  `https://apify.epayco.co/payment/session/create`, renders
  `https://checkout.epayco.co/checkout-v2.js` in test mode, validates the documented SHA-256
  confirmation signature, and resolves browser/webhook reports through
  `https://secure.epayco.co/validation/v1/reference/{reference}` before granting entitlement.
- The account-backed local gate requires the merchant's own `PUBLIC_KEY`, `PRIVATE_KEY`,
  `P_CUST_ID_CLIENTE`, and `P_KEY`; ePayco does not publish a universal merchant key set. Store
  them only in ignored `.env`, mapped to `EPAYCO_PUBLIC_KEY`, `EPAYCO_PRIVATE_KEY`,
  `EPAYCO_CUSTOMER_ID`, and `EPAYCO_P_KEY`. Local return and confirmation URLs must use the same
  temporary public HTTPS origin. Never record credential values or unredacted provider payloads
  in this plan.
- Official sandbox card cases selected for the first capture (expiry `12/2027`, CVV `123`): Visa
  accepted `4575623182290326`; Visa insufficient funds `4151611527583283`; Mastercard failed
  `5170394490379427`; American Express pending `373118856457642`. The approved case must issue one
  QR only after authoritative validation; failed/insufficient cases must issue none; pending must
  remain non-redeemable while bounded recovery continues. Test data source:
  https://docs.epayco.com/docs/medios-de-pruebas-1
- Immediate customer feedback was added across the entire transition: an order-submission overlay,
  a route loading screen, explicit Smart Checkout loading/open/closed/error/verification phases,
  and a visible spinner plus disabled manual refresh during provider-state polling. Closing the
  ePayco modal without a response no longer redirects into an automatic reopen loop.
- Local regression evidence after those UI changes:
  - focused Biome check over the four payment UI files — passed.
  - `bun run typecheck` — passed.
  - `bun run test:commerce` — **91 passed, 0 failed, 350 assertions** in 7.55 seconds.
  - `bun run test:e2e` — production build passed and **4 passed, 0 failed** in 7.4 seconds.
  - repository lint completed with the same four unrelated unused-import warnings and one existing
    missing-radix advisory; no new payment lint finding was introduced.
- The merchant's four sandbox keys were added only to ignored `.env`. A real authenticated login,
  Smart Checkout v2 session, and accepted sandbox card payment completed through the temporary
  public HTTPS tunnel. The first callback exposed two integration defects that the fake journey
  could not reveal: redirects derived from the proxied request URL returned the browser to HTTPS
  `localhost`, and real provider JSON uses numeric scalars plus uppercase `TRUE`. Redirects now use
  the configured public application origin and provider scalars are normalized before validation.
- The real Smart Checkout v2 confirmation omitted opaque `ref_payco` and supplied only the signed
  numeric `x_ref_payco`. The public validation endpoint therefore cannot reconcile this webhook by
  itself. Webhook recovery now follows ePayco's official WooCommerce integration: it authenticates
  to APIFY and posts the signed reference to `payment/transaction`. Browser returns continue to use
  the opaque reference with the public validation endpoint. In both paths the authoritative result
  must match the persisted merchant, invoice, signed provider reference when available,
  transaction, amount, currency, and environment before issuing anything.
- The already-approved sandbox payment was recovered without a second charge. Database evidence
  after replay: attempt `approved`, order `paid`, signature verified, event handled as an error-free
  duplicate, exactly one approved charge, one issued unit, and two posted ledger entries. Replaying
  the exact signed callback returned HTTP 200 with `accepted: true` and `duplicate: true`.
- Final regression evidence after the real-provider fixes:
  - `bun run typecheck` — passed.
  - `bun run test:commerce` — **94 passed, 0 failed, 358 assertions** across 13 files in 7.41
    seconds.
  - `bun run test:e2e` — production build passed and **4 passed, 0 failed** in 7.1 seconds.
  - `bun run lint` — completed successfully with the same four unrelated unused-import warnings
    and one pre-existing missing-radix advisory.
- P2 remains open for the insufficient-funds, failed, and pending sandbox cases, sanitized provider
  report evidence, and the same callback/return checks in Preview. Production remains disabled
  until those cases and P10's operating sign-off pass.
- **Exact next action:** in local sandbox, run one fresh order for each remaining official card
  result and prove zero QR issuance for insufficient/failed plus a non-redeemable pending state.
  Then deploy the isolated payment changes to Preview with its own test credentials and stable HTTPS
  origin, repeat all four cases, and preserve only sanitized evidence before any live enablement.
### 2026-09-14 — Default bar-credit policy changed to COP 500,000

- Product decision 38 supersedes the former zero-default operating rule. Every published venue
  with no credit-policy history now exposes COP 500,000 of initial capacity against its frozen
  donation obligation. The first cash order creates an audited version 1 policy inside the same
  venue-locked transaction as the reservation.
- A manual policy remains authoritative. Setting the limit to zero, retiring it, or suspending it
  prevents the automatic default from being recreated. Overdue debt, shopper and venue reservation
  limits, 15-minute expiry, seven-day repayment, self-order prevention, and app-payment independence
  remain unchanged.
- Admin and venue account views show the automatic limit before first use and label it as current
  rather than falsely claiming human approval. Local fixtures were explicitly configured with COP
  500,000 for immediate manual acceptance.
- Focused cash tests were repeated five times: **90 passed, 0 failed, 270 assertions**. They prove
  automatic creation, manual-zero precedence, concurrent first-order serialization, and view
  consistency. The concurrency run also exposed a venue/policy lock-order inversion in settlement;
  settlement now follows the documented venue-first order.
- Final regression evidence:
  - `bun run typecheck` — passed.
  - `bun run test:commerce` — **96 passed, 0 failed, 364 assertions** in 7.13 seconds.
  - `bun run test:e2e` — production build passed and **5 passed, 0 failed** in 10.2 seconds,
    including a browser-level bar-order reservation, scan, full-amount collection instruction, and
    buyer confirmation.
  - `bun run lint` — completed successfully with the same four unrelated unused-import warnings
    and one pre-existing missing-radix advisory.
- **Exact next action:** deploy this isolated policy change to Preview and repeat the staff/buyer
  acceptance flow against Preview's database before enabling the same rule in production.

### 2026-09-14 — One visible QR and one scan per order

- Per-unit finance and refund records remain intact, but they no longer leak into the bar UX. The
  order page and email expose one canonical code. For an old partially redeemed order, the page
  selects the first code that is still issued.
- One scan locks the order before its units, validates every remaining unit/reservation, and
  redeems all of them atomically in ordinal order. App-paid orders post every unit distribution;
  bar orders consume every reservation, create every donation debt, mark the order paid, and tell
  staff the full remaining amount to collect. Same-request retries return the same amount; a new
  scan after completion is rejected.
- No migration was required: one internal redemption remains linked to each immutable unit. This
  preserves existing refund, expiry, allocation, and audit boundaries while giving the buyer and
  staff a single order-level interaction.
- Final regression evidence:
  - focused lifecycle suite — **11 passed, 0 failed, 28 assertions**, including a two-unit app
    distribution from one scan and safe completion of a legacy partial order.
  - focused cash-credit suite — **19 passed, 0 failed, 60 assertions**, including two reservations,
    two debts, full collection amount, idempotent retry, and simultaneous legacy-code scans. The
    combined lifecycle/cash suites repeated five times produced **150 passed, 0 failed, 440
    assertions**.
  - `bun run typecheck` — passed.
  - `bun run test:commerce` — **99 passed, 0 failed, 374 assertions** across 13 files in 4.97
    seconds.
  - `bun run test:e2e` — production build passed and **5 passed, 0 failed** in 10.1 seconds. The
    two-mojito bar journey asserts one rendered QR, two issued units, one staff scan, COP 60,000 to
    collect, both units redeemed, and buyer confirmation.
- A mixed-product purchase is not one order today: `product_order` owns one `productId`, and the
  public flow has no cart. Combining a mojito and a beer into one payment/QR requires an explicit
  cart/order-line design; unrelated existing orders must not be silently grouped because a scan
  could redeem an older purchase unintentionally.
- **Exact next action:** deploy this isolated order-level QR change to Preview. If mixed-product
  checkout is approved as the next product scope, add cart/order-line persistence and bind one
  payment plus one canonical QR to that explicit cart.

### 2026-09-15 — Public and personal contribution summaries

- Product decision 39 replaces the four accounting-stage cards with three public figures that form
  one equation: `Total donado = Ya entregado + Pendiente por entregar`. Internal allocated, backed,
  transferred, and receipt-attribution stages remain available for audit and administration.
- `Total donado` is not gross revenue. It includes only final reconstruction allocations from real,
  redeemed units with an approved app charge, plus real bar-order debt created on redemption. It
  excludes sandbox, unverified legacy data, refunds, void units, and disputed app charges.
- `Ya entregado` is capped to the amount attributed from verified bank transfers to verified,
  published material purchases with a published receipt. `Pendiente por entregar` is the remaining
  donation allocation; public copy explains that this interval is not Tumbenla income and may cover
  reconciliation, money in transit from a venue, or the wait for the next bulk material purchase.
- `/mi-historia` now separates a customer's real gross spend from their final donation allocation.
  Sandbox and unverified legacy orders remain visible for manual acceptance and support, but appear
  in a separate test/history summary and carry explicit labels instead of inflating real totals.
- The canonical definitions and SQL were added to `org/datos/METRICAS.md`; regression coverage lives
  in `tests/commerce/foundation-transparency.test.ts`.
- Validation after the change: `bun run typecheck` passed; the complete commerce suite passed with
  **99 tests, 0 failures, and 381 assertions**; the isolated production-build browser harness passed
  **7 tests, 0 failures**, including the public three-number summary and a signed-in customer's
  sandbox/real separation. Repository lint retains only the pre-existing unrelated advisories.

### 2026-09-16 — ePayco pre-session failures and safe checkout retry

- The failing Preview attempt was traced through Vercel logs and a direct sandbox request. ePayco
  authenticated successfully but rejected session creation with HTTP 200, `success: false`, and
  `Amount must be between 5000 and 200000`. No checkout session or provider transaction reference
  existed, so the customer was never shown the gateway and no charge started.
- The ePayco adapter now recognizes that provider response as `provider-amount-limit` without
  logging customer data or raw payload values. The payment-state API and page preserve the reason,
  and the UI says that the account/provider rejected the amount while Tumbenla itself does not cap
  the order. A COP 700,000+ order remains valid in the application; the electronic route requires
  ePayco to raise the merchant-account limit, while payment at the bar remains governed only by the
  venue's donation-obligation cupo from decision 38.
- Pre-session terminal failures now clear the browser's product submission mapping as soon as the
  state page loads, not only when the orange retry button is clicked. Returning through the retry
  button, the sites link, or later navigation can therefore create a fresh order instead of reusing
  the failed attempt.
- A hosted session is handled differently because it may still be payable. Closing ePayco reopens
  the same session rather than creating a duplicate checkout. Daily recovery no longer mistakes a
  normal hosted session without a transaction reference for an operator-review incident, and old
  attempts previously escalated solely as `missing-provider-reference` can resume that session.
- Validation: focused adapter/payment/recovery tests passed **40/40**, and the explicit large-order
  payment/cash cases passed in their focused suites; the complete commerce suite passed **103/103
  with 399 assertions**; `bun run typecheck` and the production build passed;
  `bun run test:e2e` passed **12/12** against its disposable PostgreSQL database and production
  server. Repository lint passed with only three unrelated unused-import warnings and one existing
  Lemon Squeezy radix advisory.
- Remaining external gate: ePayco must raise or remove the merchant account's current amount limit
  before electronic COP 700,000+ orders can open Hosted Checkout in Preview or Production. No code
  or environment variable can override that provider-side rule.
