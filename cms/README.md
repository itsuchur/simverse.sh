# Simverse CMS (Strapi 5)

Headless CMS for the public blog. Next.js reads published **Article** documents
and renders them at `/blog` (local/ngrok) and `https://blog.simverse.sh`
(production). The admin UI and REST API are this service.

## Local

Strapi is started by `compose.override.yaml` on port **1337**, using the same
Postgres container as the app and a separate database named `strapi`.

1. Copy [`.env.example`](.env.example) to `.env` (or rely on Compose injecting
   `STRAPI_*` secrets from the **repo root** `.env`).
2. If the Postgres volume already existed before this service was added:

   ```bash
   docker compose -f compose.override.yaml exec postgres \
     sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE strapi;"'
   ```

3. Open `http://localhost:1337/admin` and create the first admin user.
4. Create and **publish** Articles (English + Russian locales). Public
   `find` / `findOne` is granted on bootstrap.

Package manager is **bun** (`bun install`, `bun.lock`). The process runs on
**Node 22** in Docker, matching [Strapi’s Docker docs](https://docs.strapi.io/cms/installation/docker).

```bash
bun install
bun run develop   # or `bun run build` then `bun run start`
```

Do not point Strapi at the Prisma `app` database (`DATABASE_URL` in the Next.js
`.env`). Use `DATABASE_NAME=strapi` on the same server.
