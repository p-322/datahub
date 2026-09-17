#!/usr/bin/env bash
# Local development database for the datahub (Postgres, matching Discovery One).
# Starts a postgres:16 container and prints the DATABASE_URL to put in
# apps/researcher/.env.local. Then: npm run db:migrate --workspace @colonial-collections/database
set -euo pipefail

read -r -p "Container name [datahub-postgres]: " container_name
container_name=${container_name:-datahub-postgres}
read -r -p "Database name [sawubona_datahub]: " database_name
database_name=${database_name:-sawubona_datahub}
read -r -p "User [sawubona_datahub]: " user_name
user_name=${user_name:-sawubona_datahub}
read -r -s -p "Password: " password; echo

docker run --name "${container_name}" -d \
  -e POSTGRES_DB="${database_name}" \
  -e POSTGRES_USER="${user_name}" \
  -e POSTGRES_PASSWORD="${password}" \
  -p 5432:5432 \
  -v "${container_name}-data:/var/lib/postgresql/data" \
  postgres:16-alpine

echo
echo "DATABASE_URL=postgresql://${user_name}:${password}@localhost:5432/${database_name}"
