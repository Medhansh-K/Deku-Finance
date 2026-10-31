-- Migration 43: data import jobs (Tally XML / spreadsheet CSV)
-- Deku Finance
--
-- The browser parses the file (it never leaves the device) and validates the rows against the
-- existing masters. It records a job here, then sends the validated rows to apply_import_job,
-- which re-checks them and applies the whole job in one transaction: one bad row and nothing is
-- written. A job applies at most once.

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('chart_of_accounts', 'parties', 'items', 'opening_balances', 'vouchers')),
  source text NOT NULL CHECK (source IN ('tally_xml', 'csv')),
  filename text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'applied', 'failed')),
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(errors) = 'array'),
  -- Opening balances only: the user confirmed posting any Dr/Cr difference to "Opening Balance Difference".
  allow_opening_difference boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  CONSTRAINT uk_import_jobs_org_id UNIQUE (organisation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_org_created ON public.import_jobs(organisation_id, created_at DESC);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_jobs_select" ON public.import_jobs;
CREATE POLICY "import_jobs_select"
  ON public.import_jobs FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

-- Status moves to applied/failed only inside apply_import_job.
DROP POLICY IF EXISTS "import_jobs_insert" ON public.import_jobs;
CREATE POLICY "import_jobs_insert"
  ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
    AND status IN ('draft', 'validated')
    AND applied_at IS NULL
    AND created_by = auth.uid()
  );

REVOKE ALL ON public.import_jobs FROM anon;
REVOKE UPDATE, DELETE ON public.import_jobs FROM authenticated;

-- GSTIN's 15th character is a mod-36 check digit (same algorithm as src/lib/vouchers/invoice-text-parser.ts).
CREATE OR REPLACE FUNCTION public._import_gstin_ok(p_gstin text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  s int := 0;
  v int;
BEGIN
  IF p_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN
    RETURN false;
  END IF;
  FOR i IN 1..14 LOOP
    v := (strpos(c, substr(p_gstin, i, 1)) - 1) * CASE WHEN i % 2 = 1 THEN 1 ELSE 2 END;
    s := s + v / 36 + v % 36;
  END LOOP;
  RETURN substr(c, (36 - s % 36) % 36 + 1, 1) = substr(p_gstin, 15, 1);
END;
$$;

-- A postable, active account by code, or by exact (case-insensitive) name when no code is given.
CREATE OR REPLACE FUNCTION public._import_account(p_org_id uuid, p_ref jsonb)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := nullif(btrim(p_ref->>'account_code'), '');
  v_name text := nullif(btrim(p_ref->>'account_name'), '');
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.accounts
  WHERE organisation_id = p_org_id AND is_active AND is_postable
    AND CASE WHEN v_code IS NOT NULL THEN code = v_code ELSE lower(name) = lower(v_name) END;
  IF v_ids IS NULL THEN
    RAISE EXCEPTION 'Account "%" does not exist (or is inactive or a group)', coalesce(v_code, v_name, '');
  END IF;
  IF array_length(v_ids, 1) > 1 THEN
    RAISE EXCEPTION 'More than one account is named "%"; use its code', v_name;
  END IF;
  RETURN v_ids[1];
END;
$$;

CREATE OR REPLACE FUNCTION public._import_party(p_org_id uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF nullif(btrim(p_name), '') IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(id) INTO v_ids FROM public.parties
  WHERE organisation_id = p_org_id AND lower(legal_name) = lower(btrim(p_name));
  IF v_ids IS NULL THEN
    RAISE EXCEPTION 'Party "%" does not exist', btrim(p_name);
  END IF;
  IF array_length(v_ids, 1) > 1 THEN
    RAISE EXCEPTION 'More than one party is named "%"', btrim(p_name);
  END IF;
  RETURN v_ids[1];
END;
$$;

-- Lines: [{account_code|account_name, party_name?, debit_paise, credit_paise, description?}].
-- Inserts them and returns the total debit; raises unless they balance.
CREATE OR REPLACE FUNCTION public._import_journal_lines(p_org_id uuid, p_entry_id uuid, p_lines jsonb)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line jsonb;
  v_n int := 0;
  v_dr bigint;
  v_cr bigint;
  v_tdr bigint := 0;
  v_tcr bigint := 0;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'A voucher needs at least two lines';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_n := v_n + 1;
    v_dr := coalesce((v_line->>'debit_paise')::bigint, 0);
    v_cr := coalesce((v_line->>'credit_paise')::bigint, 0);
    IF v_dr < 0 OR v_cr < 0 OR (v_dr > 0) = (v_cr > 0) THEN
      RAISE EXCEPTION 'Line %: give either a debit or a credit, not both or neither', v_n;
    END IF;
    INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit)
    VALUES (p_org_id, p_entry_id, v_n, public._import_account(p_org_id, v_line),
            public._import_party(p_org_id, v_line->>'party_name'), nullif(btrim(v_line->>'description'), ''),
            v_dr / 100.0, v_cr / 100.0);
    v_tdr := v_tdr + v_dr;
    v_tcr := v_tcr + v_cr;
  END LOOP;
  IF v_tdr <> v_tcr THEN
    RAISE EXCEPTION 'Voucher does not balance: debits % vs credits %', (v_tdr / 100.0)::numeric(15, 2), (v_tcr / 100.0)::numeric(15, 2);
  END IF;
  RETURN v_tdr / 100.0;
END;
$$;

-- Migration 20/35 rule: submitted for approval under maker-checker, posted by owner/CFO/admin,
-- otherwise left as a draft for them to post.
CREATE OR REPLACE FUNCTION public._import_finish_journal(p_org_id uuid, p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT require_journal_approval FROM public.organisations WHERE id = p_org_id) THEN
    PERFORM public.submit_journal_for_approval(p_org_id, p_entry_id);
  ELSIF public.is_superadmin() OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[]) THEN
    PERFORM public.post_journal_entry(p_org_id, p_entry_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_import_job(p_org_id uuid, p_job_id uuid, p_rows jsonb)
RETURNS public.import_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.import_jobs;
  v_row jsonb;
  v_rowno int;
  v_ord int;
  v_name text;
  v_code text;
  v_group text;
  v_gstin text;
  v_digit int;
  v_fiscal public.fiscal_periods;
  v_entry_id uuid;
  v_number text;
  v_type text;
  v_date date;
  v_lines jsonb;
  v_diff bigint;
  v_diff_acc uuid;
BEGIN
  IF NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: cannot apply imports';
  END IF;

  SELECT * INTO v_job FROM public.import_jobs
  WHERE id = p_job_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import job not found';
  END IF;
  IF v_job.status = 'applied' THEN
    RAISE EXCEPTION 'Import job was already applied at %; it cannot be applied again', v_job.applied_at;
  END IF;
  IF v_job.status = 'draft' THEN
    RAISE EXCEPTION 'Import job still has validation errors';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'No rows to import';
  END IF;

  -- The sub-block is a savepoint: any error undoes every row, and only the failure is recorded.
  BEGIN
    IF v_job.kind = 'opening_balances' THEN
      v_rowno := NULL;
      SELECT * INTO v_fiscal FROM public.fiscal_periods
      WHERE organisation_id = p_org_id AND status = 'open' AND current_date BETWEEN start_date AND end_date
      LIMIT 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'No open fiscal period covers today; create one before importing opening balances';
      END IF;
      v_number := 'OPENING/' || v_fiscal.start_date;
      IF EXISTS (SELECT 1 FROM public.journal_entries WHERE organisation_id = p_org_id AND entry_number = v_number) THEN
        RAISE EXCEPTION 'Opening balances for % were already imported (voucher %)', v_fiscal.name, v_number;
      END IF;

      -- One line per row; the rows' own numbers are kept for error messages.
      SELECT jsonb_agg(value ORDER BY ordinality),
             sum(coalesce((value->>'debit_paise')::bigint, 0) - coalesce((value->>'credit_paise')::bigint, 0))
      INTO v_lines, v_diff
      FROM jsonb_array_elements(p_rows) WITH ORDINALITY;

      IF v_diff <> 0 THEN
        IF NOT v_job.allow_opening_difference THEN
          RAISE EXCEPTION 'Opening balances do not balance (difference %); confirm the difference to post it to "Opening Balance Difference"', (v_diff / 100.0)::numeric(15, 2);
        END IF;
        SELECT id INTO v_diff_acc FROM public.accounts
        WHERE organisation_id = p_org_id AND lower(name) = 'opening balance difference' AND is_postable;
        IF v_diff_acc IS NULL THEN
          IF EXISTS (SELECT 1 FROM public.accounts WHERE organisation_id = p_org_id AND code = '3090') THEN
            RAISE EXCEPTION 'Account code 3090 is taken; add an "Opening Balance Difference" equity account first';
          END IF;
          INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, description, created_by)
          VALUES (p_org_id, '3090', 'Opening Balance Difference', 'equity', 'equity', 'Reserves & Retained Earnings',
                  'Opening Balance Difference', 'Opening Balance Difference', true,
                  'Unreconciled difference in imported opening balances', auth.uid())
          RETURNING id INTO v_diff_acc;
        END IF;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'account_code', (SELECT code FROM public.accounts WHERE id = v_diff_acc),
          'debit_paise', greatest(-v_diff, 0), 'credit_paise', greatest(v_diff, 0),
          'description', 'Difference in imported opening balances'));
      END IF;

      INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reference, created_by)
      VALUES (p_org_id, v_fiscal.id, v_number, v_fiscal.start_date, 'draft',
              'Opening balances imported from ' || coalesce(v_job.filename, v_job.source), 'IMPORT-' || p_job_id, auth.uid())
      RETURNING id INTO v_entry_id;
      PERFORM public._import_journal_lines(p_org_id, v_entry_id, v_lines);
      PERFORM public._import_finish_journal(p_org_id, v_entry_id);
    ELSE
      FOR v_row, v_ord IN SELECT value, ordinality FROM jsonb_array_elements(p_rows) WITH ORDINALITY LOOP
        v_rowno := coalesce((v_row->>'row')::int, v_ord::int);
        v_name := nullif(btrim(v_row->>'name'), '');

        IF v_job.kind = 'chart_of_accounts' THEN
          v_group := v_row->>'account_group';
          IF v_name IS NULL THEN
            RAISE EXCEPTION 'Account name is required';
          END IF;
          IF v_group IS NULL OR v_group NOT IN ('asset', 'liability', 'equity', 'revenue', 'expense') THEN
            RAISE EXCEPTION 'Unknown account group "%"', coalesce(v_group, '');
          END IF;
          IF EXISTS (SELECT 1 FROM public.accounts WHERE organisation_id = p_org_id AND lower(name) = lower(v_name)) THEN
            RAISE EXCEPTION 'An account named "%" already exists', v_name;
          END IF;
          v_code := nullif(btrim(v_row->>'code'), '');
          IF v_code IS NULL THEN
            -- Imported accounts without a code get five-digit codes, clear of the four-digit default chart.
            v_digit := array_position(ARRAY['asset', 'liability', 'equity', 'revenue', 'expense'], v_group);
            SELECT coalesce(max(code::int), v_digit * 10000) + 1 INTO v_code FROM public.accounts
            WHERE organisation_id = p_org_id AND code ~ ('^' || v_digit || '[0-9]{4}$');
          ELSIF EXISTS (SELECT 1 FROM public.accounts WHERE organisation_id = p_org_id AND code = v_code) THEN
            RAISE EXCEPTION 'Account code % already exists', v_code;
          END IF;
          INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, created_by)
          VALUES (p_org_id, v_code, v_name,
                  (CASE WHEN v_group = 'revenue' THEN 'income' ELSE v_group END)::public.account_type, v_group,
                  coalesce(nullif(btrim(v_row->>'ledger'), ''), 'General Ledger'),
                  coalesce(nullif(btrim(v_row->>'sub_ledger'), ''), 'General Sub-Ledger'),
                  v_name, true, auth.uid());

        ELSIF v_job.kind = 'parties' THEN
          IF v_name IS NULL THEN
            RAISE EXCEPTION 'Party name is required';
          END IF;
          IF EXISTS (SELECT 1 FROM public.parties WHERE organisation_id = p_org_id AND lower(legal_name) = lower(v_name)) THEN
            RAISE EXCEPTION 'A party named "%" already exists', v_name;
          END IF;
          v_gstin := upper(nullif(btrim(v_row->>'gstin'), ''));
          IF v_gstin IS NOT NULL AND NOT public._import_gstin_ok(v_gstin) THEN
            RAISE EXCEPTION 'GSTIN % is not valid (format or check digit)', v_gstin;
          END IF;
          IF v_gstin IS NOT NULL AND EXISTS (SELECT 1 FROM public.parties WHERE organisation_id = p_org_id AND gstin = v_gstin) THEN
            RAISE EXCEPTION 'A party with GSTIN % already exists', v_gstin;
          END IF;
          INSERT INTO public.parties (organisation_id, type, legal_name, display_name, gstin, pan, email, phone, billing_address, created_by)
          VALUES (p_org_id, coalesce(nullif(v_row->>'type', ''), 'customer')::public.party_type, v_name, v_name, v_gstin,
                  upper(nullif(btrim(v_row->>'pan'), '')), nullif(btrim(v_row->>'email'), ''), nullif(btrim(v_row->>'phone'), ''),
                  jsonb_strip_nulls(jsonb_build_object('state', nullif(btrim(v_row->>'state'), ''))), auth.uid());

        ELSIF v_job.kind = 'items' THEN
          IF v_name IS NULL THEN
            RAISE EXCEPTION 'Item name is required';
          END IF;
          IF EXISTS (SELECT 1 FROM public.catalogue_items WHERE organisation_id = p_org_id AND lower(name) = lower(v_name)) THEN
            RAISE EXCEPTION 'An item named "%" already exists', v_name;
          END IF;
          v_code := nullif(btrim(v_row->>'sku'), '');
          IF v_code IS NOT NULL AND EXISTS (SELECT 1 FROM public.catalogue_items WHERE organisation_id = p_org_id AND sku = v_code) THEN
            RAISE EXCEPTION 'An item with SKU % already exists', v_code;
          END IF;
          INSERT INTO public.catalogue_items (organisation_id, type, name, sku, hsn_sac_code, unit_code, default_unit_price, default_gst_rate, created_by)
          VALUES (p_org_id, coalesce(nullif(v_row->>'type', ''), 'goods')::public.catalogue_item_type, v_name, v_code,
                  nullif(btrim(v_row->>'hsn_sac_code'), ''), coalesce(nullif(btrim(v_row->>'unit_code'), ''), 'OTH'),
                  coalesce((v_row->>'price_paise')::bigint, 0) / 100.0, coalesce((v_row->>'gst_rate')::numeric, 0), auth.uid());

        ELSE -- vouchers
          v_date := (v_row->>'date')::date;
          IF v_date IS NULL THEN
            RAISE EXCEPTION 'Voucher date is required';
          END IF;
          v_type := coalesce(nullif(btrim(v_row->>'voucher_type'), ''), 'Journal');
          v_number := 'IMP/' || v_type || '/' || coalesce(nullif(btrim(v_row->>'number'), ''), to_char(v_date, 'YYYYMMDD') || '-' || v_rowno);
          IF EXISTS (SELECT 1 FROM public.journal_entries WHERE organisation_id = p_org_id AND entry_number = v_number) THEN
            RAISE EXCEPTION 'Voucher % was already imported', v_number;
          END IF;
          SELECT * INTO v_fiscal FROM public.fiscal_periods
          WHERE organisation_id = p_org_id AND status = 'open' AND v_date BETWEEN start_date AND end_date
          LIMIT 1;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'No open fiscal period covers %', v_date;
          END IF;
          INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reference, created_by)
          VALUES (p_org_id, v_fiscal.id, v_number, v_date, 'draft',
                  coalesce(nullif(btrim(v_row->>'narration'), ''), v_type || ' ' || coalesce(v_row->>'number', '')),
                  nullif(btrim(v_row->>'number'), ''), auth.uid())
          RETURNING id INTO v_entry_id;
          PERFORM public._import_journal_lines(p_org_id, v_entry_id, v_row->'lines');
          PERFORM public._import_finish_journal(p_org_id, v_entry_id);
        END IF;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.import_jobs
    SET status = 'failed', error_count = 1,
        errors = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('row', v_rowno, 'message', SQLERRM)))
    WHERE id = p_job_id
    RETURNING * INTO v_job;
    RETURN v_job;
  END;

  UPDATE public.import_jobs
  SET status = 'applied', applied_at = now(), row_count = jsonb_array_length(p_rows), error_count = 0, errors = '[]'::jsonb
  WHERE id = p_job_id
  RETURNING * INTO v_job;
  RETURN v_job;
END;
$$;

-- Migration 18/26 rule: no PUBLIC/anon execute; helpers are internal to apply_import_job.
REVOKE EXECUTE ON FUNCTION public._import_gstin_ok(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._import_account(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._import_party(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._import_journal_lines(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._import_finish_journal(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_import_job(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_import_job(uuid, uuid, jsonb) TO authenticated, service_role;
