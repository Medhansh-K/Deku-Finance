#!/usr/bin/env bash
# Runs every migration, the demo seed and the SQL tests against a throwaway Postgres in Docker.
# Usage: bash supabase/tests/run_local.sh        (needs Docker; exits non-zero on the first SQL error)
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
name="deku-sql-test-$$"
image="postgres:16-alpine"

docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=postgres "$image" >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1

run() {
  echo "-> $1"
  docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1"
}

run "$here/tests/local_supabase_stub.sql"
for f in "$here"/migrations/*.sql; do run "$f"; done
run "$here/seed.sql"
run "$here/seed.sql" # the seed must be safe to re-run
for f in "$here"/tests/*_test.sql; do run "$f"; done
echo "All SQL checks passed."
