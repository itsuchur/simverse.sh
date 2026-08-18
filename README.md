# Simverse

Travel eSIM store running as a Telegram Mini App. Users sign in automatically
with their Telegram account, browse a catalog of eSIM data packages (synced
hourly from eSIM Access into Redis by the poller service), and purchase
packages for their trips.

Built on the [T3 Stack](https://create.t3.gg/):

- [Next.js](https://nextjs.org) (App Router)
- [Better Auth](https://better-auth.com) with the Telegram Mini App plugin
- [Prisma](https://prisma.io) + PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) + shadcn/ui
- [tRPC](https://trpc.io)
- Redis 8 (catalog as RedisJSON documents + RediSearch catalog search, carts), Sentry (monitoring)

## Development

```bash
cp .env.example .env   # fill in values
bun install            # also runs `prisma generate` (client lives in generated/, gitignored)
bun run db:migrate     # apply Prisma migrations
bun run dev
```

Useful scripts: `bun run check` (lint + typecheck), `bun run lint:fix`,
`bun run db:studio`.

Testing the Mini App end-to-end requires a public HTTPS URL (e.g. ngrok)
registered with your Telegram bot; set it as `BETTER_AUTH_URL`.

The internal dashboard at `/dashboard` uses Google OAuth via Better Auth.
Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and add
`{BETTER_AUTH_URL}/api/auth/callback/google` as an authorized redirect URI.
Only `support@simverse.sh` can access it.

## Docker Compose

Copy `.env.example` to `.env` and fill in the values before starting either stack.

| File                    | Purpose                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compose.override.yaml` | Local/dev: app, poller, Postgres, Redis. Uses `Dockerfile.dev` / `Dockerfile.poller.dev` with bind mounts for hot reload. No Traefik. Publishes ports `3000`, `5432`, and `6379`. |
| `compose.prod.yaml`     | Production: Traefik (TLS), backups, and segmented networks. Uses `Dockerfile` / `Dockerfile.poller` (multi-stage production images).                                              |

```bash
# Local
docker compose -f compose.override.yaml up --build

# Production
docker compose -f compose.prod.yaml up -d --build
```

### Webhook logs

Inbound webhooks (Telegram, eSIM Access, etc.) are stored in `webhook_logs` before the handler runs. Inspect them from the local Postgres container:

```bash
# Interactive shell (uses POSTGRES_* from the container env)
docker compose -f compose.override.yaml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Then:

```sql
SELECT id, source, received_at, payload
FROM webhook_logs
ORDER BY received_at DESC;
```

One-shot:

```bash
docker compose -f compose.override.yaml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, source, received_at, payload FROM webhook_logs ORDER BY received_at DESC;"'
```

Skip `headers` unless you need them — they can include the Telegram webhook secret.

### Updating dependencies in local Docker

The dev stack keeps `node_modules` in named volumes (`app_node_modules`, `poller_node_modules`) so host binds do not overwrite them. Rebuilding the image alone does **not** update those volumes.

After changing `package.json` / the lockfile, install into the volume:

```bash
docker compose -f compose.override.yaml run --rm --no-deps app bun install
```

Or wipe the volume and rebuild:

```bash
docker compose -f compose.override.yaml down
docker volume rm simversesh_app_node_modules
docker compose -f compose.override.yaml up --build
```
