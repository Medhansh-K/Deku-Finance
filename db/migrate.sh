#!/bin/sh
# Applies supabase/migrations/*.sql in filename order, records each in public.schema_migrations,
# sets the authenticator password and optionally loads the demo seed.
# Env: DATABASE_URL (libpq URI or conninfo, e.g. "host=/cloudsql/PROJECT:REGION:INSTANCE dbname=deku user=... password=..."),
#      AUTHENTICATOR_PASSWORD, DEKU_SEED_DEMO=true, MIGRATIONS_DIR, SEED_FILE.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"
SEED_FILE="${SEED_FILE:-/seed.sql}"

db() {
  psql -X -q -v ON_ERROR_STOP=1 -d "$DATABASE_URL" "$@"
}

tries=0
until pg_isready -q -d "$DATABASE_URL"; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "migrate: database not reachable" >&2
    exit 1
  fi
  sleep 2
done

# RLS with no policies keeps the ledger out of reach of the API roles; the owner bypasses it.
db <<'SQL'
SET client_min_messages = warning;
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
SQL

found=false
for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$f" ] || break
  found=true
  name=$(basename "$f")
  # CRs stripped so a Windows (autocrlf) checkout and a Linux one record the same checksum.
  sum=$(tr -d '\015' < "$f" | sha256sum | cut -d ' ' -f 1)
  applied=$(db -At -v name="$name" <<'SQL'
SELECT checksum FROM public.schema_migrations WHERE filename = :'name';
SQL
)
  if [ -n "$applied" ]; then
    if [ "$applied" != "$sum" ]; then
      echo "migrate: $name was changed after it was applied; add a new migration instead" >&2
      exit 1
    fi
    continue
  fi
  echo "migrate: applying $name"
  # No --single-transaction: 016 adds enum values and uses them in the same file.
  db -f "$f"
  db -v name="$name" -v sum="$sum" <<'SQL'
INSERT INTO public.schema_migrations (filename, checksum) VALUES (:'name', :'sum');
SQL
done
if [ "$found" = false ]; then
  echo "migrate: no migrations in $MIGRATIONS_DIR" >&2
  exit 1
fi

if [ -n "${AUTHENTICATOR_PASSWORD:-}" ]; then
  # \getenv keeps the password out of argv and logs of this script.
  db <<'SQL'
\getenv pw AUTHENTICATOR_PASSWORD
ALTER ROLE authenticator WITH PASSWORD :'pw';
SQL
else
  echo "migrate: AUTHENTICATOR_PASSWORD not set; authenticator password unchanged" >&2
fi

if [ "${DEKU_SEED_DEMO:-false}" = "true" ]; then
  echo "migrate: loading demo seed"
  db -f "$SEED_FILE"
fi

# Running PostgREST instances reload their schema cache.
db -c "NOTIFY pgrst, 'reload schema'"
echo "migrate: done"
