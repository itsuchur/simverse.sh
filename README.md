# Simverse

Travel eSIM store as a Telegram Mini App. Users sign in with Telegram, browse
packages synced hourly from eSIM Access into Redis, and buy data for their trips.

This document is the production deploy runbook for `compose.prod.yaml`. Run all
commands from the clone directory that contains that file.

## Stack

- **`app`** — Next.js standalone on port 3000, attached to the host Traefik network `traefik-public`
- **`strapi`** — CMS admin/API on port 1337 at `cms.simverse.sh`
- **`poller`** — hourly eSIM Access catalog sync into Redis
- **`mcp`** — FastMCP HTTP on port 4000 (`internal` + `egress` only; other containers use `http://mcp:4000`)
- **Postgres 18** — databases `app` and `strapi`
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
| `REDIS_PASSWORD` | Redis `--requirepass`. |
| `REDIS_URL` | Compose: `redis://:PASSWORD@redis:6379` |
| `ESIMACCESS_ACCESS_CODE` | eSIM Access API. |
| `ESIMACCESS_WEBHOOK_SECRET` | ≥ 16 chars. Query token on the supplier webhook URL. |
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
- **`poller`:** `DATABASE_URL`, `REDIS_URL`, `ESIMACCESS_ACCESS_CODE`, `OPENROUTER_KEY`.
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
- **Trybit:** project notification URL `https://api.simverse.sh/webhooks/payments/trybit` (JSON postbacks). Success URL `https://miniapp.simverse.sh/successful-payment`, fail URL `https://miniapp.simverse.sh/failed-payment`.

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

- Open `https://dashboard.simverse.sh`, `https://miniapp.simverse.sh`, `https://blog.simverse.sh`, and `https://cms.simverse.sh/admin`.
- Poller logs a catalog sync on start, then hourly (`[cron] synced … packages to RedisJSON catalog generation …`).
- Sign in at `https://dashboard.simverse.sh` as `support@simverse.sh`.

Webhook log table (skip `headers`; they can include the Telegram secret):

```bash
docker compose -f compose.prod.yaml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, source, received_at, payload FROM webhook_logs ORDER BY received_at DESC LIMIT 20;"'
```

## 6. Backups and rollback

- Before each archive, Postgres runs `pg_dump -F c` for both `app` (`POSTGRES_DB`) and `strapi` into the `pg_dumps` volume and deletes dumps older than 7 days.
- The backup service runs daily at 03:00, uploads `pg-backup-*.tar.gz` to S3, and retains archives for 14 days.

Rollback: check out the previous git SHA, run `docker compose -f compose.prod.yaml up -d --build`. Reverse a Prisma migration only if you explicitly choose to; do not treat that as the default rollback.
