# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## Docker Compose

Copy `.env.example` to `.env` and fill in the values before starting either stack.

| File | Purpose |
| --- | --- |
| `compose.override.yaml` | Local/dev: app, poller, Postgres, Redis. Uses `Dockerfile.dev` / `Dockerfile.poller.dev` with bind mounts for hot reload. No Traefik. Publishes ports `3000`, `5432`, and `6379`. |
| `compose.prod.yaml` | Production: Traefik (TLS), backups, and segmented networks. Uses `Dockerfile` / `Dockerfile.poller` (multi-stage production images). |

```bash
# Local
docker compose -f compose.override.yaml up --build

# Production
docker compose -f compose.prod.yaml up -d --build
```

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
