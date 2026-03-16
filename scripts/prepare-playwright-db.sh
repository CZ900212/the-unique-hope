#!/usr/bin/env bash

set -euo pipefail

set -a
source .env
set +a

eval "$(
  node -e '
    const url = new URL(process.env.DATABASE_URL);
    const values = {
      DB_NAME: url.pathname.replace(/^\//, ""),
      DB_PASSWORD: url.password,
      DB_PORT: url.port || "5432",
      DB_USERNAME: url.username || "postgres",
    };
    for (const [key, value] of Object.entries(values)) {
      console.log(`${key}=${JSON.stringify(value)}`);
    }
  '
)"

DB_CONTAINER_NAME="${DB_NAME}-postgres"
PLAYWRIGHT_DB_NAME="${DB_NAME}_e2e"

docker exec "$DB_CONTAINER_NAME" psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$PLAYWRIGHT_DB_NAME' AND pid <> pg_backend_pid();"
docker exec "$DB_CONTAINER_NAME" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS \"$PLAYWRIGHT_DB_NAME\";"
docker exec "$DB_CONTAINER_NAME" psql -U postgres -d postgres -c "CREATE DATABASE \"$PLAYWRIGHT_DB_NAME\";"

printf 'postgres://%s:%s@127.0.0.1:%s/%s' "$DB_USERNAME" "$DB_PASSWORD" "$DB_PORT" "$PLAYWRIGHT_DB_NAME" > .playwright-database-url
