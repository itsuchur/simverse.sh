# Simverse

Travel eSIM store as a Telegram Mini App. Users sign in with Telegram, browse
packages synced daily from eSIM Access into Redis, and buy data for their trips.

This document is the production deploy runbook for `compose.prod.yaml`. Run all
commands from the clone directory that contains that file.

## Stack

- **`app`** — Next.js standalone on port 3000, attached to the host Traefik network `traefik-public`
- **`strapi`** — CMS admin/API on port 1337 at `cms.simverse.sh`
- **`wiki`** — Wiki.js on port 3000 at `kb.simverse.sh` (`mem_limit` 1g; dedicated Postgres role/DB)
- **`poller`** — daily midnight eSIM Access catalog sync into Redis
- **`mcp`** — FastMCP HTTP on port 4000 (`internal` + `egress` only; other containers use `http://mcp:4000`)
- **Postgres 18** — databases `app`, `strapi`, and `wiki`
- **Redis 8** — RedisJSON catalog documents, RediSearch, carts (`redis:8` loads modules via its entrypoint)
- **`offen/docker-volume-backup`** — daily dumps to S3

TLS and HTTP→HTTPS are provided by the host Traefik stack, not this compose file.

| Host | Serves |
| --- | --- |
| `https://simverse.sh` | Public landing page |
| `https://dashboard.simverse.sh` | Internal dashboard (`/dashboard`, pretty-rooted) |
| `https://miniapp.simverse.sh` | Telegram Mini App (pretty-rooted: `/` is the catalog, not `/app`) |
| `https://api.simverse.sh` | Webhooks and other route handlers (`/webhooks/...` publicly; Traefik prefixes `/api` for Next.js). Same-origin `/api` stays on the two UI hosts. |
| `https://blog.simverse.sh` | Public blog (pretty-rooted: `/` is the post list, `/[slug]` is an article) |
| `https://cms.simverse.sh` | Strapi admin (`/admin`), REST API (`/api`), and media (`/uploads`) |
| `https://kb.simverse.sh` | Wiki.js (behind Cloudflare Access, same as dashboard/cms) |

Internal Compose services can call the app at `http://app:3000/api/...` on the
`internal` network. Internet callers (Telegram, eSIM Access, Trybit, Cardlink)
must use `https://api.simverse.sh/webhooks/...` (no extra `/api` in the path).

## 1. Fill `.env`

Copy [`.env.example`](.env.example) to `.env` in the compose project directory
and set production values. Origins have **no trailing slash**. Use strong
`POSTGRES_PASSWORD` / `REDIS_PASSWORD`; do not keep the example defaults.

| Variable | Notes |
| --- | --- |
| `BETTER_AUTH_SECRET` | Required in production. |
| `BETTER_AUTH_URL` | Dashboard origin: `https://dashboard.simverse.sh` (Google OAuth `baseURL`). |
| `MINIAPP_URL` | Mini App origin: `https://miniapp.simverse.sh`. |
| `API_URL` | Public API origin: `https://api.simverse.sh`. |
| `BLOG_URL` | Blog origin: `https://blog.simverse.sh` (pretty-root). |
| `STRAPI_URL` | Server-side CMS origin. Compose: `http://strapi:1337`. |
| `STRAPI_PUBLIC_URL` | Public CMS origin: `https://cms.simverse.sh`. Passed to Strapi as `PUBLIC_URL`. |
| `STRAPI_API_TOKEN` | Optional read-only API token. Public `find`/`findOne` on Article is enabled in CMS bootstrap. |
| `STRAPI_APP_KEYS`, `STRAPI_API_TOKEN_SALT`, `STRAPI_ADMIN_JWT_SECRET`, `STRAPI_TRANSFER_TOKEN_SALT`, `STRAPI_JWT_SECRET`, `STRAPI_ENCRYPTION_KEY` | Strapi secrets. Generate with `openssl rand -base64 32`. `STRAPI_APP_KEYS` is a comma-separated list of at least two keys. |
| `TELEGRAM_BOT_TOKEN` | Production bot. |
| `TELEGRAM_BOT_USERNAME` | Production bot username. |
| `TELEGRAM_WEBHOOK_SECRET` | ≥ 16 chars; `A-Z a-z 0-9 _ -` only. `openssl rand -hex 24` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Passed into the Postgres container. |
| `DATABASE_URL` | Compose: `postgresql://USER:PASSWORD@postgres:5432/DB` |
| `WIKI_DB_USER`, `WIKI_DB_PASSWORD`, `WIKI_DB_NAME` | Dedicated Wiki.js Postgres role and database (defaults: `wiki`). Production must use a strong `WIKI_DB_PASSWORD` (`openssl rand -hex 24`). |
| `REDIS_PASSWORD` | Redis `--requirepass`. |
| `REDIS_URL` | Compose: `redis://:PASSWORD@redis:6379` |
| `ESIMACCESS_ACCESS_CODE` | eSIM Access API. |
| `ESIMACCESS_WEBHOOK_SECRET` | ≥ 16 chars. Query token on the supplier webhook URL. |
| `ESIMFLY_ACCESS_CODE`, `ESIMFLY_SECRET_KEY` | eSIMfly Business API. Optional; the poller skips the eSIMfly catalog sync when unset. |
| `TRYBIT_API_KEY`, `TRYBIT_SHOP_ID`, `TRYBIT_SECRET_KEY` | Required in production. Checkout crypto invoices. |
| `CARDLINK_API_TOKEN`, `CARDLINK_SHOP_ID` | Required in production. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Internal dashboard. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional Mini App analytics. Host is ingest (`https://us.i.posthog.com` or `https://eu.i.posthog.com`). Keys are baked into the client at **image build**; change them with `--build`. |
| `OPENROUTER_KEY` | Poller (Russian package names) and MCP (`OPENROUTER_API_KEY` inside the container). |
| `OPENROUTER_MODEL` | Optional. MCP model; defaults to `mistralai/mistral-small-3.2-24b-instruct`. |

Compose-only (used by `compose.prod.yaml`, not in `.env.example`):

| Variable | Used by |
| --- | --- |
| `AWS_S3_BUCKET_NAME` | Backup archives. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 credentials for backups. |

What Compose injects:

- **`app`:** `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_*`, `MINIAPP_URL`, `API_URL`, `BLOG_URL`, `STRAPI_URL`, `STRAPI_API_TOKEN`, Telegram, eSIM Access, Trybit, Cardlink, Google OAuth, `NEXT_PUBLIC_POSTHOG_*` (also as image build args), `NODE_ENV=production`.
- **`strapi`:** Postgres `DATABASE_*` (database name `strapi`), `PUBLIC_URL` from `STRAPI_PUBLIC_URL`, `APP_KEYS` / JWT / encryption secrets from `STRAPI_*`.
- **`wiki`:** `DB_*` from `WIKI_DB_*` (Postgres host `postgres`). Traefik host `kb.simverse.sh`.
- **`poller`:** same runtime env as **`app`**, plus `OPENROUTER_KEY`. Order recovery imports the app env schema, so production validation needs those secrets even though the worker is not the web app.
- **`mcp`:** `MCP_HOST`, `MCP_PORT`, `REDIS_URL`, `OPENROUTER_API_KEY` (from `OPENROUTER_KEY`), `OPENROUTER_MODEL`. Not published; reach it at `http://mcp:4000` on `internal`.

`TONCONSOLE_KEY` appears in `.env.example` but is **not** passed through `compose.prod.yaml`.

## 2. Apply migrations before serving traffic

The `app` image has no Prisma CLI (`CMD bun server.js`). Run `prisma migrate deploy` from the **poller** image, which includes the schema and Prisma:

```bash
docker compose -f compose.prod.yaml run --rm poller bun run db:migrate
```

That starts healthy Postgres (and Redis) as dependencies, then applies migrations.

If the Postgres volume already existed before Strapi was added, create the CMS database once (init scripts in `docker/postgres/` only run on first data-dir init):

```bash
docker compose -f compose.prod.yaml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE strapi;"'
```

Then open `https://cms.simverse.sh/admin` and create the first admin user. Publish Articles in **en** and **ru**.

If the Postgres volume already existed before Wiki.js was added, create the dedicated role and database once (after `WIKI_DB_*` are set in `.env` and postgres has been recreated/restarted so those env vars are present):

```bash
docker compose -f compose.prod.yaml exec postgres sh /docker-entrypoint-initdb.d/init-wiki-db.sh
```

Then open `https://kb.simverse.sh` (Cloudflare Access) and complete the Wiki.js first-run admin setup.

## 3. Start or update the stack

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

## 4. One-time (or after domain change) external wiring

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

- **Cardlink:** shop Result URL `https://api.simverse.sh/webhooks/payments/cardlink`, Refund URL `https://api.simverse.sh/webhooks/payments/cardlink/refund`, Chargeback URL `https://api.simverse.sh/webhooks/payments/cardlink/chargeback`
- **Trybit:** project notification URL `https://api.simverse.sh/webhooks/payments/trybit` (JSON postbacks). Success URL `https://t.me/simversebot?startapp=successful_payment`, fail URL `https://t.me/simversebot?startapp=failed_payment` (deep links that reopen the Mini App inside Telegram).

### Google OAuth (dashboard)

Authorized JavaScript origin: `https://dashboard.simverse.sh` (no path). Redirect URI:

```
https://dashboard.simverse.sh/api/auth/callback/google
```

Only `support@simverse.sh` can access the dashboard. Details: [src/app/[locale]/dashboard/README.md](src/app/[locale]/dashboard/README.md).

## 5. Verify

```bash
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs -f poller
```

- Open `https://dashboard.simverse.sh`, `https://miniapp.simverse.sh`, `https://blog.simverse.sh`, `https://cms.simverse.sh/admin`, and `https://kb.simverse.sh`.
- Poller logs a catalog sync on start, then daily at midnight (`[cron] synced … packages to RedisJSON catalog generation …`).
- Sign in at `https://dashboard.simverse.sh` as `support@simverse.sh`.

Webhook log table (skip `headers`; they can include the Telegram secret):

```bash
docker compose -f compose.prod.yaml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, source, received_at, payload FROM webhook_logs ORDER BY received_at DESC LIMIT 20;"'
```

## 6. Backups and rollback

- Before each archive, Postgres runs `pg_dump -F c` for `app` (`POSTGRES_DB`), `strapi`, and `wiki` into the `pg_dumps` volume and deletes dumps older than 7 days.
- The backup service runs daily at 03:00, uploads `pg-backup-*.tar.gz` to S3, and retains archives for 14 days.

Rollback: check out the previous git SHA, run `docker compose -f compose.prod.yaml up -d --build`. Reverse a Prisma migration only if you explicitly choose to; do not treat that as the default rollback.


## Unfulfillable top-up refunds

Active checkout providers are Trybit and X-Hub. Top-up checkout is unavailable
within 16 minutes of the stored expiry time (the invoice reuse window plus a
supplier-request margin). Payments arriving after the parent profile becomes
unavailable are taken out of supplier recovery and sent to refund handling.

X-Hub uses its [refund API](https://docs.x-hub.online/payments/refunds/) with the
durable `refunds.idempotency_key`. Each order has one full-refund request;
retries reuse the same record, reason, and key.
The merchant account must have the refund endpoint enabled by X-Hub; a 404 is
reported to Sentry for manual handling. Orders stay `refund_pending` and payments
stay `paid` until the refund is confirmed. The existing X-Hub webhook endpoint
handles `refund.completed`, `refund.rejected`, `refund.failed`, and
`refund.reversed`; the recovery worker also polls pending refunds.

An unavailable/failed refund becomes `refund_required` and produces a Sentry
error tagged `reason: topup_refund_failed`, with the order UUID, payment ID,
refund/request IDs, amount in minor units, and currency. This includes Trybit: its
documented cancellation method only cancels unpaid invoices, while a payout
needs a separate API key and a verified recipient wallet that this app does
not store. Resolve these cases manually; `refund_required` does not mean money
was returned. An uncertain earlier supplier top-up also requires manual
reconciliation to avoid refunding a successfully delivered top-up.

## Refund records and dashboard

The dashboard **Refunds** tab lists dashboard requests, automatic top-up refunds,
provider-reported refunds, and migrated records. It includes status filtering,
pagination, order links, amounts/currencies, provider identifiers, request
initiators, failure codes, and timestamps. Staff-triggered requests record the
signed-in staff user. The `orders` table retains `payment_status` and
`refunded_amount` as transactional summaries; refund details live in `refunds`.
Refund transitions use `requested`, `processing`, `completed`, `failed`,
`reversed`, and `manual_review`. A reversal preserves the original completion
timestamp while removing the order's refunded total.

Migration `20261024180000_create_refunds` backfills existing refunds and preserves
their idempotency keys, then removes the old refund ID/key/reason columns from
`orders`. Historical initiators and exact request times were not stored; these
records are labeled `legacy` and use the last known order update timestamp.

This migration requires a coordinated update of the web app and poller. For an
existing running stack, build the new images first, then stop both old processes
before applying the migration with the new poller image:

```bash
docker compose -f compose.prod.yaml build app poller
docker compose -f compose.prod.yaml stop app poller
docker compose -f compose.prod.yaml run --rm --no-deps poller bun run db:migrate
docker compose -f compose.prod.yaml up -d app poller
```

Do not restart an old app/poller image against the migrated schema. Verify the
backfill, unique constraints, concurrent request behavior, and transaction
rollback locally with `bun run test:refunds-migration` (requires Docker; creates
and removes its own isolated PostgreSQL container).
