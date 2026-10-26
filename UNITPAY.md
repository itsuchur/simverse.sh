# Unitpay

The backend uses [redirect checkout](https://help.unitpay.money/payments/create-payment), with `paymentType=card` and other methods hidden. Russian checkout uses RUB; English checkout uses USD. The frontend does not expose this provider yet.

## Configuration

Set `UNITPAY_PROJECT_ID` and `UNITPAY_SECRET_KEY` in the app and poller environment. Both are optional until Unitpay is enabled. Docker Compose forwards them from `.env`; no database migration is required.

In Unitpay project settings:

- Register the miniapp domain so `resultUrl` and `backUrl` are accepted.
- Set the notification URL to `https://api.simverse.sh/webhooks/payments/unitpay` (local/single-host equivalent: `/api/webhooks/payments/unitpay`).
- Enable CHECK notifications. PAY remains the only callback that triggers fulfillment.
- Exempt the callback path from browser challenges and caching in Cloudflare.

## Routes

- `POST /api/checkout/unitpay`: authenticated checkout; accepts the existing `{ cartRevision, locale }` body and returns `{ orderUuid, invoiceUrl }`. Persists Unitpay's payment ID and reuses the draft invoice.
- `GET /api/checkout/unitpay/return`: returns the buyer to Telegram through the existing payment-result deep link. Navigation never confirms payment.
- `GET /api/webhooks/payments/unitpay`: validates the SHA-256 signature over all sorted callback parameters, project, order, currency, amount, and payment ID. Rejects test callbacks against production orders. Writes sanitized webhook audit records before processing.

`check` validates without fulfillment; `preauth` never fulfills; `error` closes a pending payment but a later valid `pay` can revive it. Repeated `pay` notifications use existing fulfillment claims to prevent duplicate issuance. The payment reconciliation worker also checks stored payment IDs when callbacks are missed, including Unitpay's `error_pay` status (funds were charged but the merchant handler failed).

## Cloudflare ingress

The callback checks **only `CF-Connecting-IP`** against Unitpay's [published addresses](https://help.unitpay.money/book-of-reference/ip-addresses): `31.186.100.49`, `51.250.20.9`, and `217.198.170.141`. Missing, malformed, multiple, or unapproved addresses fail closed. `X-Forwarded-For`, `X-Real-IP`, and `True-Client-IP` cannot override it.

Cloudflare must preserve visitor IP headers. The origin/Traefik ingress must accept public callback traffic only from trusted Cloudflare ingress (firewall, Tunnel, or authenticated origin pulls), so direct requests cannot forge this header. This repository contains router labels, but does not manage the server firewall or global Traefik trust configuration. Signature verification remains mandatory independently of the IP check. See [Cloudflare's header documentation](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip).

## Refunds

The existing dashboard backend and automatic issuance-failure refund flow support Unitpay. Dashboard restrictions on activated eSIMs and top-ups still apply; no dashboard UI has been added.

The backend verifies `getPayment` against the stored charge, project, order, amount and currency, checks full-refund eligibility, and persists a single submission claim before calling `refundPayment`. It omits `sum` to request a full refund. Unitpay permits only one partial or full refund per payment and documents no merchant idempotency key.

A successful API result completes the durable refund and order. A timeout, ambiguous response, or persistence failure after submission requires manual reconciliation; the backend never resends that request. Even a later `getPayment` status of `refund` does not automatically complete an uncertain local refund: the documented response lacks a refunded-amount field and cannot prove a full refund. Check the provider dashboard and reconcile the local record before any further action. There is no documented refund callback to register.

## Verification

Run `bun run check` for ESLint, route/type generation, TypeScript and the Bun test suite. CI runs this same command on pushes and pull requests, with Bun 1.4.4 and actions pinned to commit SHAs. Unitpay tests use mocked HTTP responses; no live payment or refund is made.
