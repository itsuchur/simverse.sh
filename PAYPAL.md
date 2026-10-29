# PayPal checkout

Create a PayPal REST app in the Developer Dashboard. Set `PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and `PAYPAL_ENVIRONMENT=sandbox`
in the application and poller environment. All credentials are server-only.
PayPal remains unavailable until all three credentials are set.

Register the webhook on the same REST app and environment:

- Production API host: `https://api.simverse.sh/webhooks/payments/paypal`
- Local single-host setup: `{BETTER_AUTH_URL}/api/webhooks/payments/paypal`
- Subscribe to `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`.
- Copy the registered webhook ID into `PAYPAL_WEBHOOK_ID`.

The hosted approval flow uses server-calculated USD prices, including promos.
The return URL is generated from `API_URL` (or `BETTER_AUTH_URL` locally).
Approval triggers an idempotent server-side capture. A signed completion webhook
or the poller recovers missed returns. Only a completed capture with the stored
price and currency fulfills an order; mismatches enter manual refund review.
If invoice persistence fails, a signed approval/completion webhook can recover it
using the merchant order UUID stored as PayPal's `custom_id`.

Test with a Sandbox buyer: approval, cancellation, duplicate returns/webhooks,
and a completed payment with the return window closed. Verify one supplier order
and one capture ID in the dashboard. Real sandbox testing requires app credentials.
For live payments, use live app credentials and its webhook ID, then explicitly
set `PAYPAL_ENVIRONMENT=production` and restart the app and poller.
Refunds use the existing manual review workflow.

References: [Next.js guide](https://developer.paypal.com/guides/nextjs-checkout),
[Orders API](https://developer.paypal.com/api/orders/v2),
[webhook verification](https://developer.paypal.com/api/webhooks/v1).
