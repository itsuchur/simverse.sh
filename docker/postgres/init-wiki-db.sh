#!/bin/sh
set -eu
# Runs only on first Postgres data-dir init. Existing volumes need:
#   docker compose -f compose.prod.yaml exec postgres sh -c '
#     psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
#       -c "DO \$\$ BEGIN
#             IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '\''$WIKI_DB_USER'\'') THEN
#               CREATE ROLE \"$WIKI_DB_USER\" LOGIN PASSWORD '\''$WIKI_DB_PASSWORD'\'';
#             ELSE
#               ALTER ROLE \"$WIKI_DB_USER\" WITH LOGIN PASSWORD '\''$WIKI_DB_PASSWORD'\'';
#             END IF;
#           END \$\$;"
#     psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
#       "SELECT 1 FROM pg_database WHERE datname = '\''$WIKI_DB_NAME'\''" | grep -q 1 \
#       || psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
#            -c "CREATE DATABASE \"$WIKI_DB_NAME\" OWNER \"$WIKI_DB_USER\";"
#   '

WIKI_DB_USER="${WIKI_DB_USER:-wiki}"
WIKI_DB_PASSWORD="${WIKI_DB_PASSWORD:?WIKI_DB_PASSWORD is required}"
WIKI_DB_NAME="${WIKI_DB_NAME:-wiki}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "DO \$\$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${WIKI_DB_USER}') THEN
          CREATE ROLE \"${WIKI_DB_USER}\" LOGIN PASSWORD '${WIKI_DB_PASSWORD}';
        ELSE
          ALTER ROLE \"${WIKI_DB_USER}\" WITH LOGIN PASSWORD '${WIKI_DB_PASSWORD}';
        END IF;
      END \$\$;"

if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${WIKI_DB_NAME}'" | grep -q 1; then
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE \"${WIKI_DB_NAME}\" OWNER \"${WIKI_DB_USER}\";"
