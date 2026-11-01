# Codapay Hosted Payment Page

The integration uses Codapay v2 and starts in sandbox. The enabled-market allowlist
in `src/lib/codapay-markets.ts` comes from the supplied sandbox portal list, including
Vietnam (4 enabled methods). Countries with zero enabled methods are excluded.
An enabled market has at least one payment method; this does not guarantee cards.

Checkout reads Cloudflare's `CF-IPCountry` header on the server to select an enabled
billing market, independently of Telegram language and eSIM destination. Cloudflare
IP Geolocation must be enabled, and ingress must preserve the header and restrict
origin access to trusted proxies. Unknown, Tor, missing and unsupported countries
have no automatic default. Clicking the card button then opens country selection;
no payment is initiated until the user chooses an enabled billing country.

The selector is normally hidden behind "Change billing country". An explicit user
selection overrides the IP estimate, allowing travelers and VPN users to correct it.
The checkout endpoint validates overrides and also supports server-side IP detection
when no override is supplied. Country codes are converted from ISO alpha-2 to numeric
using `i18n-iso-countries`; `payType=0` lets Coda host payment-method selection.
Update and recheck the allowlist when portal configuration changes. Sandbox availability
must be reconfirmed for production before switching environments.

## Configuration

Set these server variables (see `.env.example`):

- `CODAPAY_API_KEY`: the sandbox global v2 API key.
- `CODAPAY_PROJECT_ID=4378`: confirm this is the sandbox project ID.
- `CODAPAY_ENVIRONMENT=sandbox`.

Payment initiation uses `payType=0`: Codapay hosts the payment channel selection.
No individual channel IDs are needed. Complete the Payment Page Configuration
in the portal and enable the desired payment methods for these markets.

In the Codapay Publisher Portal, set the Transaction Complete Notification URL to:

`https://api.simverse.sh/webhooks/payments/codapay`

Enable successful and failed notifications and USD price notification. The single
callback handles both payment outcomes. It accepts Codapay's documented GET query
parameters and acknowledges processed notifications with plain text `ResultCode=0`.
The browser return URL is supplied on each initiation request:

`https://api.simverse.sh/checkout/codapay/return?orderId={orderId}&txnId={transactionId}`

For local testing, expose the application through HTTPS. Without `API_URL`, public
URLs include `/api`; set the portal callback to that host's
`/api/webhooks/payments/codapay` endpoint. An external provider cannot notify localhost.

## Payment verification

Orders and promotional discounts are priced in USD. Codapay handles local currency
conversion. The callback verifies the prescribed checksum, saves a redacted audit
record, then queries Codapay with server credentials. Fulfillment requires matching
transaction ID, order ID, original USD currency and amount. `TotalPrice` is a local
currency value; neither it nor the unsigned `USDPrice` callback field is trusted as
proof of the order amount. `USDPrice` is retained in the audit record.

Pending results (`216`, `431`, `481`) do not fulfill or fail orders. Confirmed failures
close pending orders. Duplicate success and late failure notifications use the
existing idempotent fulfillment and failure transitions. The payment reconciliation
worker also checks saved Codapay invoice IDs when a notification is missed.
The browser return verifies through the same server inquiry before redirecting.

Changing payer market closes the old pending draft and creates a new one. A late
payment on a closed invoice remains recoverable through the callback or worker.
The additive migration stores the payment market separately on the order; run
`bun run db:migrate` before running the updated app.

## Sandbox acceptance

For each market, initiate a payment, verify its hosted page and finish the sandbox
success and failure flows. Confirm the webhook log source is `codapay`, the success
issues one eSIM, and the failure does not issue one. Replay a notification to check
idempotency. This requires real sandbox credentials and Payment Page Configuration.

Production requires the corresponding production global key, project/payment-page
configuration and `CODAPAY_ENVIRONMENT=production` after sandbox acceptance.

References: [Hosted Payment Page](https://docs.coda.co/codapay/hosted-payment-page-integration),
[notifications](https://docs.coda.co/codapay/hosted-payment-page-integration/get-notified-of-a-transaction-status-change),
[security](https://docs.coda.co/codapay/integration-guides/security-guidelines),
[inquiry](https://docs.coda.co/codapay/hosted-payment-page-integration/check-a-transaction-status).
