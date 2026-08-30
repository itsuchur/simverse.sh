#!/bin/sh
set -eu
# Runs only on first Postgres data-dir init. Existing volumes need:
#   docker compose ... exec postgres psql -U "$POSTGRES_USER" -c 'CREATE DATABASE strapi;'
if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = 'strapi'" | grep -q 1; then
  exit 0
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c 'CREATE DATABASE strapi;'
