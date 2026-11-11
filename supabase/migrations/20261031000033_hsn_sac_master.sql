-- Migration 33: HSN/SAC master (global reference data)
-- Deku Finance
--
-- Codes and descriptions are loaded only by db/import_hsn.sh from an official file (see docs/HSN_IMPORT.md),
-- which records where each row came from. No codes ship in migrations or seeds.
-- Readable by any signed-in user; written only by the importer (table owner / service_role).
-- The GST rate is never inferred from this table: hsn_sac_rates stays empty until someone imports a
-- notified rate schedule, and the app always lets the user pick the rate.

CREATE TABLE IF NOT EXISTS public.hsn_sac_codes (
  code text PRIMARY KEY CHECK (code ~ '^[0-9]+$' AND length(code) IN (2, 4, 6, 8)),
  description text NOT NULL CHECK (btrim(description) <> ''),
  -- SAC (services) codes are chapter 99; every other chapter is goods.
  kind text GENERATED ALWAYS AS (CASE WHEN left(code, 2) = '99' THEN 'service' ELSE 'goods' END) STORED,
  chapter text GENERATED ALWAYS AS (left(code, 2)) STORED,
  source text NOT NULL CHECK (btrim(source) <> ''),
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hsn_sac_rates (
  code text NOT NULL REFERENCES public.hsn_sac_codes(code) ON DELETE CASCADE,
  rate_pct numeric(5,2) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  cess_pct numeric(6,2) CHECK (cess_pct >= 0),
  effective_from date NOT NULL,
  notification_ref text NOT NULL CHECK (btrim(notification_ref) <> ''),
  source text NOT NULL CHECK (btrim(source) <> ''),
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, effective_from)
);

-- Migration 000's default privileges give authenticated full DML on new tables; this is read-only for them.
REVOKE ALL ON public.hsn_sac_codes, public.hsn_sac_rates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.hsn_sac_codes, public.hsn_sac_rates TO authenticated;
GRANT ALL ON public.hsn_sac_codes, public.hsn_sac_rates TO service_role;

ALTER TABLE public.hsn_sac_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_sac_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hsn_sac_codes_read ON public.hsn_sac_codes;
CREATE POLICY hsn_sac_codes_read ON public.hsn_sac_codes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS hsn_sac_rates_read ON public.hsn_sac_rates;
CREATE POLICY hsn_sac_rates_read ON public.hsn_sac_rates FOR SELECT TO authenticated USING (true);
-- service_role may lack BYPASSRLS on Cloud SQL.
DROP POLICY IF EXISTS hsn_sac_codes_service ON public.hsn_sac_codes;
CREATE POLICY hsn_sac_codes_service ON public.hsn_sac_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS hsn_sac_rates_service ON public.hsn_sac_rates;
CREATE POLICY hsn_sac_rates_service ON public.hsn_sac_rates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigram index makes the description ILIKE fast; without pg_trgm the same ILIKE just scans (a few
-- thousand rows), so a server without the extension still works.
DO $$
DECLARE
  v_schema text;
BEGIN
  BEGIN
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm unavailable (%); HSN search falls back to unindexed ILIKE', SQLERRM;
  END;

  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF v_schema IS NOT NULL THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_hsn_sac_codes_description_trgm ON public.hsn_sac_codes USING gin (description %I.gin_trgm_ops)',
      v_schema);
  END IF;
END $$;

-- code is text, so the primary key's btree does not serve LIKE 'x%' under non-C collations.
CREATE INDEX IF NOT EXISTS idx_hsn_sac_codes_code_prefix ON public.hsn_sac_codes (code text_pattern_ops);

-- Code-prefix matches first (shortest code first), then rows whose description contains every word.
CREATE OR REPLACE FUNCTION public.search_hsn(p_query text, p_limit int DEFAULT 20)
RETURNS TABLE (code text, description text, kind text, chapter text, match text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT btrim(coalesce(p_query, '')) AS raw,
           -- "8471 30" and "8471.30" are how codes get written on bills.
           CASE WHEN btrim(coalesce(p_query, '')) ~ '^[0-9][0-9 .]*$'
                THEN regexp_replace(p_query, '[^0-9]', '', 'g') END AS digits,
           least(greatest(coalesce(p_limit, 20), 1), 50) AS lim
  ),
  words AS (
    SELECT replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') AS pat
    FROM q, regexp_split_to_table(q.raw, '\s+') AS w
    WHERE w <> ''
  ),
  hits AS (
    SELECT h.code, h.description, h.kind, h.chapter, 'code'::text AS match, 0 AS rank
    FROM public.hsn_sac_codes h, q
    WHERE q.digits IS NOT NULL AND h.code LIKE q.digits || '%'
    UNION ALL
    SELECT h.code, h.description, h.kind, h.chapter, 'description', 1
    FROM public.hsn_sac_codes h, q
    WHERE q.raw <> ''
      AND NOT (q.digits IS NOT NULL AND h.code LIKE q.digits || '%')
      AND NOT EXISTS (SELECT 1 FROM words WHERE h.description NOT ILIKE '%' || words.pat || '%')
  )
  SELECT hits.code, hits.description, hits.kind, hits.chapter, hits.match
  FROM hits
  ORDER BY hits.rank, length(hits.code), hits.code
  LIMIT (SELECT lim FROM q);
$$;

REVOKE EXECUTE ON FUNCTION public.search_hsn(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_hsn(text, int) TO authenticated, service_role;
