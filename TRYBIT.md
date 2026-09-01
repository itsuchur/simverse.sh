# Trybit setup

Crypto checkout uses [Trybit](https://docs.trybit.com). The Mini App creates a USD invoice, the customer pays on `pay.trybit.com`, and Trybit POSTs a signed JSON postback when the invoice is confirmed.

Official API: [authorization](https://docs.trybit.com/api-reference-v2/authorization), [create invoice](https://docs.trybit.com/api-reference-v2/create-invoice), [postback](https://docs.trybit.com/api-reference-v2/postback).

## Environment variables

Set these in `.env` (and production Compose). All three are required in production; checkout returns 503 if any is missing.

| Variable | Where it comes from | Used for |
| --- | --- | --- |
| `TRYBIT_API_KEY` | Trybit project API key | `Authorization: Token <key>` on `POST https://api.trybit.com/v2/invoice/create` |
| `TRYBIT_SHOP_ID` | Store / shop id in the Trybit personal account | Invoice body `shop_id` |
| `TRYBIT_SECRET_KEY` | Project secret key (Integration & API) | Verify postback JWT (`HS256`) |

`compose.prod.yaml` and `compose.override.yaml` already pass these through to `app`.

## Trybit dashboard (one-time)

Open the project → **Integration & API**.

1. **Notification / postback URL** (callback). Production:

   ```
   https://api.simverse.sh/webhooks/payments/trybit
   ```

   Do **not** add `/api` on `api.simverse.sh`. Traefik prefixes `/api` before Next.js. The route handler is `POST /api/webhooks/payments/trybit`.

2. **Postback format:** JSON (not `x-www-form-urlencoded`). The app verifies `token` and reads `order_id` plus `invoice_info`.

3. **Success URL** (browser after pay). A `t.me` deep link that reopens the Mini App in Telegram; `<StartParamRouter />` routes `startapp` to `/successful-payment`:

   ```
   https://t.me/simversebot?startapp=successful_payment
   ```

4. **Fail URL** (browser after cancel / fail):

   ```
   https://t.me/simversebot?startapp=failed_payment
   ```

Trybit does not take callback or return URLs on create-invoice. They only exist in project settings.

## Local / ngrok

If `API_URL` is unset, public webhook paths keep `/api`:

```
https://<your-tunnel>/api/webhooks/payments/trybit
```

Point Trybit’s notification URL at that tunnel while testing. Success/fail URLs are `t.me` deep links (`https://t.me/<bot>?startapp=successful_payment` / `failed_payment`), so use the test bot’s username; they reopen whatever Mini App URL is registered for that bot in BotFather.

## What the app does

- Checkout crypto button → `POST /api/checkout/trybit` → invoice with `currency: USD` and `order_id` = our order UUID → redirect to `result.link`.
- Postback: require JWT `token` signed with `TRYBIT_SECRET_KEY`. Fulfill on invoice `paid` / `overpaid` (or `invoice_status: success`). Fail pending order on `canceled`. Ignore `partial`.
- Dashboard → Webhooks → **Trybit** lists raw postbacks.

## After changing keys

Restart `app` so `src/env.js` picks up the new values. Production Compose: `docker compose -f compose.prod.yaml up -d` (rebuild only if you also changed code).
