#!/usr/bin/env bash
# Runs every migration (via db/migrate.sh), the demo seed twice and the SQL tests against a throwaway Postgres in Docker.
# Usage: bash supabase/tests/run_local.sh        (needs Docker; exits non-zero on the first SQL error)
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
name="deku-sql-test-$$"
db="postgresql://postgres:postgres@127.0.0.1:5432/postgres"

docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=postgres -v "$repo:/repo:ro" postgres:16-alpine >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
# TCP only answers once the image's init-time server (socket only) has been replaced by the real one.
until docker exec "$name" pg_isready -q -h 127.0.0.1 -U postgres; do sleep 1; done

migrate() {
  docker exec -e DATABASE_URL="$db" -e MIGRATIONS_DIR=/repo/supabase/migrations \
    -e SEED_FILE=/repo/supabase/seed.sql -e DEKU_SEED_DEMO=true "$name" sh /repo/db/migrate.sh
}
migrate
migrate # second run: nothing is re-applied, and the seed must be safe to re-run

for f in "$repo"/supabase/tests/*_test.sql; do
  echo "-> $f"
  docker exec -i "$name" psql -X -q -v ON_ERROR_STOP=1 -d "$db" < "$f"
done
echo "All SQL checks passed."
