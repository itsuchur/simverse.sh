# Simverse CMS (Strapi 5)

Headless CMS for the public blog. Next.js reads published **Article** documents
and renders them at `/blog` (local/ngrok) and `https://blog.simverse.sh`
(production). The admin UI and REST API are this service.

## Article body (Better Blocks)

The localized Article **Body** uses `@qkix/strapi-plugin-better-blocks`, the
maintained successor to the marketplace's deprecated `@k11k` package. The field
keeps its `body` name and JSON storage, so existing article content stays in place.
The blog uses the companion React renderer for the extended formatting and blocks.

The admin CSP permits YouTube, Vimeo, Loom, Wistia, Dailymotion and api.video
iframe previews. Add any other provider's exact host to `config/middlewares.ts`
before using its embeds. No new environment variables or paid services are needed.

Deploy from the repository directory on the VPS:

```bash
git pull --ff-only
docker compose -f compose.prod.yaml build app strapi
docker compose -f compose.prod.yaml up -d --no-deps app strapi
docker compose -f compose.prod.yaml logs --tail=100 strapi
```

Take a Strapi database backup before deployment. Strapi synchronizes the custom
field schema on startup; no manual SQL or Prisma migration is required. A plain
container restart is insufficient because both admin and frontend need rebuilding.
After deployment, open an existing article in each locale, confirm Body content
is intact, and publish a draft with colors and a table to verify the blog output.

## Article tags

Articles include an optional, localized **Tags** custom field provided by
`strapi-plugin-tagsinput`. Enter a tag and press Enter to add it, then save and
publish the article. English and Russian articles can have different tags.
Tags appear on blog previews and article pages; existing articles can leave
the field empty. No separate Tags collection or suggestions API is required.

The Bun patch in `patches/` aligns the plugin's admin registration and change
payload with its JSON storage type, confirms pending tags on blur, and fixes
removing the last tag. Keep the patches available during Docker installs.
Run `bun test src/admin/tagsinput.test.tsx` from this directory to check the
actual input's edit, reload, and removal behavior.

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
