# Turning on email sign-in and buyer emails

The code is deployed. Email sign-in and all buyer emails stay off until `RESEND_API_KEY` is set on the server. Telegram users are not affected either way.

## 1. Verify the sending domain in Resend

1. In Resend, go to **Domains → Add domain** and add `e.simverse.sh`.
2. Create the DNS records Resend shows for `simverse.sh`:
   - the DKIM `TXT` record (`resend._domainkey.e`),
   - the `MX` and SPF `TXT` records for the bounce subdomain (`send.e`).
3. Add a DMARC record if `simverse.sh` has none yet: `TXT` at `_dmarc` with `v=DMARC1; p=none;`.
4. Click **Verify** and wait until the domain shows **Verified**.

## 2. Create an API key

In **API Keys → Create API key**, choose **Sending access** limited to the `e.simverse.sh` domain. Copy the key. It is shown only once.

## 3. Add the key to production

On the VPS, add it to `/opt/simverse.sh/.env`:

```bash
RESEND_API_KEY="re_..."
# Optional. This is the default:
# EMAIL_FROM="Simverse <noreply@e.simverse.sh>"
```

Then recreate the services so they pick it up:

```bash
cd /opt/simverse.sh
docker compose -f compose.prod.yaml up -d app poller
```

`compose.prod.yaml` already passes both variables to `app` and `poller`. No push is needed.

## 4. Test once on the live site

1. Open `https://simverse.sh/checkout` in a private window, outside Telegram. You should see "Email me a code" under the Telegram button.
2. Enter your own email, get the 6-digit code, and sign in.
3. Buy the cheapest plan and check that the eSIM email arrives, with the QR code, the install codes, and a working link to `/account`.
4. Repeat the sign-in from `https://simverse.sh/ru/checkout`. The code email should be in Russian.

If the code email does not arrive, look in Resend's **Emails** log first, then in Sentry for `sign_in_code_failed` or `esim_delivery_failed`.

## Limits

- Codes expire after 10 minutes and allow 3 attempts.
- Each address gets at most 5 codes per hour.
- `support@simverse.sh` and `@telegram.local` addresses cannot sign in with a code. The dashboard stays Google-only.

## Turning it off

Remove `RESEND_API_KEY` from `.env` and run the same `docker compose ... up -d app poller`. Accounts created by email stay, but they can't sign in and get no emails until the key is back.
