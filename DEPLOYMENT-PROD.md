# Production deployment

Operator runbook for the production Docker Compose stack in `compose.prod.yaml`. Local development uses `compose.override.yaml` instead; see [README.md](README.md).

Services: `app` (Next.js standalone on port 3000, attached to the host Traefik network `traefik-public`), `poller` (hourly eSIM Access catalog sync into Redis), Postgres 18, Redis 8, and `offen/docker-volume-backup` (daily dumps to S3). TLS and HTTP→HTTPS live on the VPS Traefik stack (Cloudflare DNS-01, wildcard `*.simverse.sh`), not in this compose file.

Public hostnames (DNS already in Cloudflare):

| Host | Serves |
| --- | --- |
| `https://dashboard.simverse.sh` | Internal dashboard (`/dashboard`, pretty-rooted) |
| `https://miniapp.simverse.sh` | Telegram Mini App (`/app`, pretty-rooted) |
| `https://api.simverse.sh` | Webhooks and other route handlers (`/webhooks/...` publicly; Traefik prefixes `/api` for Next.js). Same-origin `/api` stays on the two UI hosts. |

Internal Compose services can call the app at `http://app:3000/api/...` on the `internal` network. Internet callers (Telegram, eSIM Access, Cryptomus, Trybit, Cardlink) must use `https://api.simverse.sh/webhooks/...` (no extra `/api` in the path).

The app requires the JSON and Search modules that ship with Redis 8 (catalog documents, cart storage, and catalog search). The official `redis:8` image auto-loads every module in `/usr/local/lib/redis/modules/` through its entrypoint, so the plain `redis-server …` command in `compose.prod.yaml` is enough; verify with `redis-cli … module list` if in doubt.

## 1. Host prerequisites

On the production host:

1. Clone this repository (or pull the release you intend to run).
2. Install Docker Engine and Docker Compose.
3. Confirm Traefik is running and attached to the external Docker network `traefik-public`.
4. Confirm Cloudflare DNS for `dashboard.simverse.sh`, `miniapp.simverse.sh`, and `api.simverse.sh` points at this host.
5. Create `.env` in the same directory as `compose.prod.yaml` (the compose project directory).

All commands below are run from that directory.

## 2. Fill `.env`

Copy [`.env.example`](.env.example) and set production values. Origins have **no trailing slash**.

### App / database (also listed in `.env.example`)

| Variable | Notes |
| --- | --- |
| `BETTER_AUTH_SECRET` | Required in production. |
| `BETTER_AUTH_URL` | Dashboard origin: `https://dashboard.simverse.sh` (Google OAuth `baseURL`). |
| `MINIAPP_URL` | Mini App origin: `https://miniapp.simverse.sh`. |
| `API_URL` | Public API origin: `https://api.simverse.sh`. |
| `TELEGRAM_BOT_TOKEN` | Production bot. |
| `TELEGRAM_BOT_USERNAME` | Production bot username. |
| `TELEGRAM_WEBHOOK_SECRET` | ≥ 16 chars; `A-Z a-z 0-9 _ -` only. `openssl rand -hex 24` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Passed into the Postgres container. |
| `DATABASE_URL` | Compose: `postgresql://USER:PASSWORD@postgres:5432/DB` |
| `REDIS_PASSWORD` | Redis `--requirepass`. |
| `REDIS_URL` | Compose: `redis://:PASSWORD@redis:6379` |
| `ESIMACCESS_ACCESS_CODE` | eSIM Access API. |
| `ESIMACCESS_WEBHOOK_SECRET` | ≥ 16 chars. Query token on the supplier webhook URL. |
| `CRYPTOMUS_MERCHANT_ID`, `CRYPTOMUS_API_KEY` | Required in production (legacy Cryptomus webhooks). |
| `TRYBIT_API_KEY`, `TRYBIT_SHOP_ID`, `TRYBIT_SECRET_KEY` | Required in production. Checkout crypto invoices. |
| `CARDLINK_API_TOKEN`, `CARDLINK_SHOP_ID` | Required in production. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Internal dashboard. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional Mini App analytics. Host is ingest (`https://us.i.posthog.com` or `https://eu.i.posthog.com`). Keys are baked into the client at **image build**; change them with `--build`. |

Use strong `POSTGRES_PASSWORD` / `REDIS_PASSWORD` in production; do not keep the example defaults.

### Compose-only (used by `compose.prod.yaml`, not in `.env.example`)

| Variable | Used by |
| --- | --- |
| `AWS_S3_BUCKET_NAME` | Backup archives. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 credentials for backups. |
| `OPENROUTER_KEY` | Poller (Russian package names). |

`ACME_EMAIL` and `CF_DNS_API_TOKEN` belong to the host Traefik stack, not this compose file.

### What Compose actually injects

- **`app`:** `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_*`, `MINIAPP_URL`, `API_URL`, Telegram, eSIM Access, Cryptomus, Trybit, Cardlink, Google OAuth, `NEXT_PUBLIC_POSTHOG_*` (also as image build args), `NODE_ENV=production`.
- **`poller`:** `DATABASE_URL`, `REDIS_URL`, `ESIMACCESS_ACCESS_CODE`, `OPENROUTER_KEY`.

`TONCONSOLE_KEY` appears in `.env.example` but is **not** passed through `compose.prod.yaml`.

## 3. Apply migrations before serving traffic

The `app` image has no Prisma CLI (`CMD bun server.js`). Run `prisma migrate deploy` from the **poller** image, which includes the schema and Prisma:

```bash
docker compose -f compose.prod.yaml run --rm poller bun run db:migrate
```

That starts healthy Postgres (and Redis) as dependencies, then applies migrations.

## 4. Start or update the stack

```bash
docker compose -f compose.prod.yaml up -d --build
```

Routine release:

```bash
git pull
# if prisma/migrations/ changed:
docker compose -f compose.prod.yaml run --rm poller bun run db:migrate
docker compose -f compose.prod.yaml up -d --build
```

Do not use `docker compose down -v` as a normal step; `-v` destroys the Postgres and Redis volumes.

## 5. One-time (or after domain change) external wiring

### Telegram webhook and Mini App

BotFather Mini App URL = `https://miniapp.simverse.sh`. Register the webhook (same `secret_token` as `TELEGRAM_WEBHOOK_SECRET`):

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://api.simverse.sh/webhooks/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message","pre_checkout_query"]'
```

### eSIM Access

Webhook URL in the eSIM Access console:

```
https://api.simverse.sh/webhooks/suppliers/esimaccess?token=<ESIMACCESS_WEBHOOK_SECRET>
```

### Payments

- **Cardlink:** shop Result URL `https://api.simverse.sh/webhooks/payments/cardlink`
- **Trybit:** project notification URL `https://api.simverse.sh/webhooks/payments/trybit` (JSON postbacks). Success URL `https://miniapp.simverse.sh/app/successful-payment`, fail URL `https://miniapp.simverse.sh/app/failed-payment`.
- **Cryptomus (legacy):** `url_callback` is sent per invoice to `https://api.simverse.sh/webhooks/payments/cryptomus`; browser return URLs use `MINIAPP_URL`.

### Google OAuth (dashboard)

Authorized JavaScript origin: `https://dashboard.simverse.sh` (no path). Redirect URI:

```
https://dashboard.simverse.sh/api/auth/callback/google
```

Only `support@simverse.sh` can access the dashboard. Details: [src/app/[locale]/dashboard/README.md](src/app/[locale]/dashboard/README.md).

## 6. Verify

```bash
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs -f poller
```

- Open `https://dashboard.simverse.sh` and `https://miniapp.simverse.sh` and confirm TLS (Traefik / Let's Encrypt).
- Poller logs a catalog sync on start, then hourly (`[cron] synced … packages to RedisJSON catalog generation …`).
- Sign in at `https://dashboard.simverse.sh` as `support@simverse.sh`.

Webhook log table (skip `headers`; they can include the Telegram secret):

```bash
docker compose -f compose.prod.yaml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, source, received_at, payload FROM webhook_logs ORDER BY received_at DESC LIMIT 20;"'
```

## 7. Backups and rollback

- Before each archive, Postgres runs `pg_dump -F c` into the `pg_dumps` volume and deletes dumps older than 7 days.
- The backup service runs daily at 03:00, uploads `pg-backup-*.tar.gz` to S3, and retains archives for 14 days.

Rollback: check out the previous git SHA, run `docker compose -f compose.prod.yaml up -d --build`. Reverse a Prisma migration only if you explicitly choose to; do not treat that as the default rollback.
