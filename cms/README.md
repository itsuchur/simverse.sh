# Simverse CMS (Strapi 5)

Headless CMS for the public blog. Next.js reads published **Article** documents
and renders them at `/blog` (local/ngrok) and `https://blog.simverse.sh`
(production). The admin UI and REST API are this service.

## Article tags

Articles include an optional, localized **Tags** custom field provided by
`strapi-plugin-tagsinput`. Enter a tag and press Enter to add it, then save and
publish the article. English and Russian articles can have different tags.
Tags appear on blog previews and article pages; existing articles can leave
the field empty. No separate Tags collection or suggestions API is required.

After installing this change, rebuild and restart the CMS so Strapi registers
the plugin and synchronizes the article schema (`bun install`, `bun run build`,
then `bun run start`, or rebuild the CMS Docker service).

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
