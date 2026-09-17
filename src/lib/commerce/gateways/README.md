# Collection gateways

This directory is the provider boundary for one-time commerce collections. Callers persist the
gateway binding (`provider`, `configVersion`, `accountId`, and `environment`) before making a
network request. New attempts use the active selection; callbacks and reconciliation resolve the
binding stored on the original attempt.

## ePayco contract evidence

The adapter follows the current official Smart Checkout v2 documentation:

- Backend authentication uses Basic `PUBLIC_KEY:PRIVATE_KEY` at
  `https://apify.epayco.co/login`.
- Backend checkout sessions use `https://apify.epayco.co/payment/session/create`, checkout version
  `2`, a lowercase `invoice` field (the current page's complete example conflicts with its property
  table, which spells `Invoice`), and `uniqueTransactionPerBill: true`.
- The frontend receives only the session ID and loads
  `https://checkout.epayco.co/checkout-v2.js`; card data never enters this adapter.
- Browser response data is not authoritative. The response URL is fixed at `/pago/respuesta`, and
  the webhook URL is fixed at `/api/comercio/pagos/epayco/confirmacion` under the configured
  application origin. Neither URL contains an order bearer token or redemption code.
- Notification authentication hashes the original strings in this exact order:
  `customerId^pKey^x_ref_payco^x_transaction_id^x_amount^x_currency_code`. The digest comparison
  is constant-time. Duplicate or missing signed parameters fail authentication.
- Because invoice, status, merchant field, and test mode are not covered by that signature, an
  authenticated notification is never enough to approve a payment. The adapter performs a GET
  against the fixed `https://secure.epayco.co/validation/v1/reference/{reference}` host with
  redirects disabled and compares merchant, invoice, reference, transaction ID, gross amount,
  currency, and environment with the stored attempt.
- Only the documented string states are normalized. Numeric `x_cod_response` mappings are not
  guessed. Contradictory `x_response` and `x_transaction_state` values make the result uncertain.

Sources checked on 2026-09-11:

- <https://docs.epayco.com/docs/checkout-implementacion>
- <https://docs.epayco.com/docs/checkout-respuesta-y-confirmacion>
- <https://docs.epayco.com/docs/checkout-tablas-de-datos>

Test payloads in this directory are documentation-derived synthetic fixtures. They demonstrate
our parser and security checks; they are not captured sandbox successes and do not prove that any
Tumbenla ePayco account, payment method, duplicate-invoice option, webhook, refund, or live checkout
has been enabled.

## Unsupported or unverified capabilities

- Automatic refunds are unsupported. The reviewed documentation limits same-day dashboard
  reversals and does not establish a universal Smart Checkout v2 refund API.
- Checkout splitting is disabled for this release. Bar and foundation disbursements are reviewed
  bank transfers outside this adapter.
- Checkout/lookup data does not establish a final, itemized fee and withholding breakdown.
  Deductions require separate reconciliation evidence.
- Credit card, debit card, and PSE are intended methods, but actual availability, PSE pending
  behavior, account limits, and duplicate-invoice guarantees require account-level sandbox and
  commercial validation.
- A network error, provider 5xx response, malformed response, or missing lookup is uncertain. It is
  never converted into a failed payment or permission to create a second charge.
- The fake adapter is restricted to local development and tests with a `fake`/`test` binding. It
  refuses production mode and any Vercel deployment.
