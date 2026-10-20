# syntax=docker/dockerfile:1
# Production image: bun for install, Node 22 to run Strapi (official runtime).
# Bun binary is glibc; use Debian Node so `COPY --from=oven/bun` actually runs.

FROM oven/bun:1.4.0 AS bun

FROM node:22-slim AS build
RUN set -eux; \
  sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
  printf 'Acquire::Retries "5";\nAcquire::http::Timeout "120";\nAcquire::https::Timeout "120";\n' > /etc/apt/apt.conf.d/80-retries; \
  for attempt in 1 2 3 4 5; do \
    if apt-get update \
      && apt-get install -y --no-install-recommends git python3 make g++; then break; fi; \
    if [ "$attempt" = "5" ]; then exit 1; fi; \
    sleep $((attempt * 5)); \
  done; \
  rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /opt/
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/app
COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM node:22-slim
RUN set -eux; \
  sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
  printf 'Acquire::Retries "5";\nAcquire::http::Timeout "120";\nAcquire::https::Timeout "120";\n' > /etc/apt/apt.conf.d/80-retries; \
  for attempt in 1 2 3 4 5; do \
    if apt-get update \
      && apt-get install -y --no-install-recommends wget libvips42 gosu; then break; fi; \
    if [ "$attempt" = "5" ]; then exit 1; fi; \
    sleep $((attempt * 5)); \
  done; \
  rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV NODE_ENV=production

WORKDIR /opt/
COPY --from=build /opt/package.json /opt/bun.lock ./
RUN bun install --frozen-lockfile --production
ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/app
COPY --from=build /opt/app ./
COPY docker-entrypoint.sh /usr/local/bin/strapi-entrypoint.sh
RUN chmod +x /usr/local/bin/strapi-entrypoint.sh \
  && mkdir -p /opt/app/public/uploads \
  && chown -R node:node /opt/app
ENTRYPOINT ["strapi-entrypoint.sh"]
EXPOSE 1337
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:1337/_health || exit 1
CMD ["npm", "run", "start"]
