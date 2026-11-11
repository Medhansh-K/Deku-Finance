#!/bin/sh
# Loads an official HSN/SAC list into public.hsn_sac_codes. See docs/HSN_IMPORT.md for where to get the file.
# Usage: DATABASE_URL=... sh db/import_hsn.sh --source "CBIC HSN directory xlsx, downloaded 2026-10-31" codes.csv
# The CSV is UTF-8 with a header row and columns code,description. Nothing is written unless every row is valid.
set -eu

usage() {
  echo "usage: DATABASE_URL=... $0 --source \"<file name, publisher, download date>\" <file.csv>" >&2
  exit 2
}

source_label=""
csv=""
while [ $# -gt 0 ]; do
  case "$1" in
    --source) [ $# -ge 2 ] || usage; source_label="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) [ -z "$csv" ] || usage; csv="$1"; shift ;;
  esac
done

: "${DATABASE_URL:?DATABASE_URL is required}"
[ -n "$source_label" ] || usage
[ -n "$csv" ] || usage
[ -r "$csv" ] || { echo "import_hsn: cannot read $csv" >&2; exit 1; }
# psql meta-command quoting: a single quote inside '...' is written twice.
csv_quoted=$(printf '%s' "$csv" | sed "s/'/''/g")

# One transaction: a bad row aborts the whole import. \copy reads the file client-side, so no superuser is needed.
psql -X -q -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -v src="$source_label" <<SQL
BEGIN;
CREATE TEMP TABLE hsn_import (code text, description text) ON COMMIT DROP;
\copy hsn_import (code, description) FROM '$csv_quoted' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

UPDATE hsn_import SET code = btrim(code), description = btrim(regexp_replace(description, '\s+', ' ', 'g'));

DO \$\$
DECLARE
  v_bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM hsn_import) THEN
    RAISE EXCEPTION 'import_hsn: the file has no rows';
  END IF;

  SELECT string_agg(coalesce(code, '<empty>'), ', ') INTO v_bad FROM (
    SELECT code FROM hsn_import
    WHERE code IS NULL OR code !~ '^[0-9]+\$' OR length(code) NOT IN (2, 4, 6, 8)
    LIMIT 20) s;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'import_hsn: codes must be 2, 4, 6 or 8 digits; bad: %', v_bad;
  END IF;

  SELECT string_agg(code, ', ') INTO v_bad FROM (
    SELECT code FROM hsn_import WHERE description IS NULL OR description = '' LIMIT 20) s;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'import_hsn: missing description for: %', v_bad;
  END IF;

  SELECT string_agg(code, ', ') INTO v_bad FROM (
    SELECT code FROM hsn_import GROUP BY code HAVING count(*) > 1 LIMIT 20) s;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'import_hsn: duplicate codes: %', v_bad;
  END IF;
END \$\$;

INSERT INTO public.hsn_sac_codes (code, description, source, imported_at)
SELECT code, description, :'src', now() FROM hsn_import
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, source = EXCLUDED.source, imported_at = EXCLUDED.imported_at;

SELECT count(*) AS imported FROM hsn_import \gset
\echo import_hsn: upserted :imported codes from :src
COMMIT;
SQL
