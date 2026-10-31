-- Migration 35: marketplace payout settlements (Amazon, Flipkart, Meesho, ...)
-- Deku Finance
--
-- The operator pays out sales less refunds, its commission and fees (with GST on them), GST TCS
-- (section 52 CGST Act) and income-tax TDS (section 194-O). A settlement is imported once, from a
-- report the browser parses with a per-company column map, and posted as one summary journal:
--   Dr Bank (net payout)          Dr Commission & fees      Dr Input GST on fees
--   Dr TCS receivable             Dr TDS receivable         Cr Marketplace clearing (gross - refunds)

CREATE TABLE IF NOT EXISTS public.marketplace_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  -- Same values as sales_invoices.sales_channel (migration 25), minus 'direct'.
  channel text NOT NULL CHECK (channel IN ('amazon', 'flipkart', 'meesho', 'myntra', 'blinkit', 'shopify', 'b2b_portal', 'other')),
  settlement_ref text NOT NULL CHECK (btrim(settlement_ref) <> ''),
  period_from date NOT NULL,
  period_to date NOT NULL,
  gross_sales numeric(15, 2) NOT NULL DEFAULT 0,
  refunds numeric(15, 2) NOT NULL DEFAULT 0,
  commission numeric(15, 2) NOT NULL DEFAULT 0,
  other_fees numeric(15, 2) NOT NULL DEFAULT 0,
  gst_on_fees numeric(15, 2) NOT NULL DEFAULT 0,
  -- The operator's fee invoice is either inter-state (IGST) or intra-state (CGST + SGST halves).
  fee_gst_split text NOT NULL DEFAULT 'igst' CHECK (fee_gst_split IN ('igst', 'cgst_sgst')),
  tcs_amount numeric(15, 2) NOT NULL DEFAULT 0,
  tds_amount numeric(15, 2) NOT NULL DEFAULT 0,
  net_payout numeric(15, 2) NOT NULL,
  journal_entry_id uuid,
  imported_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_marketplace_settlements_ref UNIQUE (organisation_id, channel, settlement_ref),
  CONSTRAINT uk_marketplace_settlements_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_marketplace_settlements_journal FOREIGN KEY (organisation_id, journal_entry_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_marketplace_settlements_period CHECK (period_from <= period_to),
  CONSTRAINT chk_marketplace_settlements_net CHECK (
    net_payout = gross_sales - refunds - commission - other_fees - gst_on_fees - tcs_amount - tds_amount
  )
);

CREATE INDEX IF NOT EXISTS idx_marketplace_settlements_org_period
  ON public.marketplace_settlements(organisation_id, period_to);

-- One row per non-zero amount in the report: amounts carry the header's sign convention
-- (deductions positive), so per type they sum to the header column of the same name.
CREATE TABLE IF NOT EXISTS public.marketplace_settlement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  settlement_id uuid NOT NULL,
  row_number integer NOT NULL,
  txn_date date,
  order_id text,
  sku text,
  line_type text NOT NULL CHECK (line_type IN (
    'gross_sales', 'refunds', 'commission', 'other_fees', 'gst_on_fees', 'tcs_amount', 'tds_amount'
  )),
  description text,
  amount numeric(15, 2) NOT NULL,
  CONSTRAINT fk_marketplace_settlement_lines_settlement FOREIGN KEY (organisation_id, settlement_id)
    REFERENCES public.marketplace_settlements(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_settlement_lines_settlement
  ON public.marketplace_settlement_lines(settlement_id);

-- The company's column mapping for one channel's report: canonical field -> header text.
CREATE TABLE IF NOT EXISTS public.marketplace_column_maps (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('amazon', 'flipkart', 'meesho', 'myntra', 'blinkit', 'shopify', 'b2b_portal', 'other')),
  mapping jsonb NOT NULL CHECK (jsonb_typeof(mapping) = 'object'),
  deductions_negative boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, channel)
);

DROP TRIGGER IF EXISTS trg_marketplace_column_maps_updated_at ON public.marketplace_column_maps;
CREATE TRIGGER trg_marketplace_column_maps_updated_at
  BEFORE UPDATE ON public.marketplace_column_maps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketplace_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settlement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_column_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_settlements_select" ON public.marketplace_settlements;
CREATE POLICY "marketplace_settlements_select"
  ON public.marketplace_settlements FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "marketplace_settlements_insert" ON public.marketplace_settlements;
CREATE POLICY "marketplace_settlements_insert"
  ON public.marketplace_settlements FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND imported_by = auth.uid()
    AND journal_entry_id IS NULL
  );

-- No UPDATE policy: a draft is deleted and re-imported; only post_marketplace_settlement links the journal.
DROP POLICY IF EXISTS "marketplace_settlements_delete" ON public.marketplace_settlements;
CREATE POLICY "marketplace_settlements_delete"
  ON public.marketplace_settlements FOR DELETE TO authenticated
  USING (
    journal_entry_id IS NULL
    AND public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  );

DROP POLICY IF EXISTS "marketplace_settlement_lines_select" ON public.marketplace_settlement_lines;
CREATE POLICY "marketplace_settlement_lines_select"
  ON public.marketplace_settlement_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "marketplace_settlement_lines_insert" ON public.marketplace_settlement_lines;
CREATE POLICY "marketplace_settlement_lines_insert"
  ON public.marketplace_settlement_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND EXISTS (
      SELECT 1 FROM public.marketplace_settlements s
      WHERE s.id = marketplace_settlement_lines.settlement_id
        AND s.organisation_id = marketplace_settlement_lines.organisation_id
        AND s.journal_entry_id IS NULL
    )
  );

DROP POLICY IF EXISTS "marketplace_column_maps_select" ON public.marketplace_column_maps;
CREATE POLICY "marketplace_column_maps_select"
  ON public.marketplace_column_maps FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "marketplace_column_maps_insert" ON public.marketplace_column_maps;
CREATE POLICY "marketplace_column_maps_insert"
  ON public.marketplace_column_maps FOR INSERT TO authenticated
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[]));

DROP POLICY IF EXISTS "marketplace_column_maps_update" ON public.marketplace_column_maps;
CREATE POLICY "marketplace_column_maps_update"
  ON public.marketplace_column_maps FOR UPDATE TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[]));

-- Header and lines in one transaction, with the lines reconciled to the header per type.
-- SECURITY INVOKER: the RLS policies above are the permission check.
CREATE OR REPLACE FUNCTION public.create_marketplace_settlement(p_org_id uuid, p_settlement jsonb, p_lines jsonb)
RETURNS public.marketplace_settlements
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_s public.marketplace_settlements;
  v_bad text;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'A settlement needs at least one line';
  END IF;

  INSERT INTO public.marketplace_settlements (
    organisation_id, channel, settlement_ref, period_from, period_to, gross_sales, refunds, commission,
    other_fees, gst_on_fees, fee_gst_split, tcs_amount, tds_amount, net_payout, source_filename
  )
  SELECT p_org_id, x.channel, btrim(x.settlement_ref), x.period_from, x.period_to,
    coalesce(x.gross_sales, 0), coalesce(x.refunds, 0), coalesce(x.commission, 0), coalesce(x.other_fees, 0),
    coalesce(x.gst_on_fees, 0), coalesce(x.fee_gst_split, 'igst'), coalesce(x.tcs_amount, 0),
    coalesce(x.tds_amount, 0), x.net_payout, x.source_filename
  FROM jsonb_populate_record(NULL::public.marketplace_settlements, p_settlement) x
  RETURNING * INTO v_s;

  INSERT INTO public.marketplace_settlement_lines (
    organisation_id, settlement_id, row_number, txn_date, order_id, sku, line_type, description, amount
  )
  SELECT p_org_id, v_s.id, l.row_number, l.txn_date, l.order_id, l.sku, l.line_type, l.description, l.amount
  FROM jsonb_populate_recordset(NULL::public.marketplace_settlement_lines, p_lines) l;

  SELECT string_agg(format('%s lines %s vs header %s', t.line_type, t.lines, t.header), '; ')
  INTO v_bad
  FROM (
    SELECT h.line_type, coalesce(sum(l.amount), 0) AS lines, h.header
    FROM (VALUES
      ('gross_sales', v_s.gross_sales), ('refunds', v_s.refunds), ('commission', v_s.commission),
      ('other_fees', v_s.other_fees), ('gst_on_fees', v_s.gst_on_fees), ('tcs_amount', v_s.tcs_amount),
      ('tds_amount', v_s.tds_amount)
    ) h(line_type, header)
    LEFT JOIN public.marketplace_settlement_lines l ON l.settlement_id = v_s.id AND l.line_type = h.line_type
    GROUP BY h.line_type, h.header
  ) t
  WHERE t.lines <> t.header;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Settlement lines do not add up to the totals: %', v_bad;
  END IF;

  RETURN v_s;
END;
$$;

-- Seeded code first, else a postable account with the seeded name (a company may have renumbered).
CREATE OR REPLACE FUNCTION public._marketplace_account(p_org_id uuid, p_code text, p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id FROM public.accounts a
  WHERE a.organisation_id = p_org_id AND a.is_postable AND a.is_active
    AND (a.code = p_code OR lower(a.name) = lower(p_name))
  ORDER BY (a.code = p_code) DESC
  LIMIT 1;
$$;

-- Posts (or, under maker-checker, submits) the summary journal and links it to the settlement.
-- p_bank_account_id: the account the payout landed in; defaults to the seeded bank account 1020.
CREATE OR REPLACE FUNCTION public.post_marketplace_settlement(p_org_id uuid, p_id uuid, p_bank_account_id uuid DEFAULT NULL)
RETURNS public.journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.marketplace_settlements;
  v_fiscal_id uuid;
  v_entry public.journal_entries;
  v_bank uuid;
  v_clearing uuid;
  v_fees uuid;
  v_tcs uuid;
  v_tds uuid;
  v_igst uuid;
  v_cgst uuid;
  v_sgst uuid;
  v_fee_cgst numeric(15, 2);
  v_missing text;
BEGIN
  IF NOT public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: cannot post marketplace settlements';
  END IF;

  SELECT * INTO v_s FROM public.marketplace_settlements
  WHERE id = p_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement not found';
  END IF;
  IF v_s.journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Settlement % already has a voucher', v_s.settlement_ref;
  END IF;

  SELECT id INTO v_fiscal_id FROM public.fiscal_periods
  WHERE organisation_id = p_org_id AND status = 'open' AND v_s.period_to BETWEEN start_date AND end_date
  LIMIT 1;
  IF v_fiscal_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal period covers the settlement date %', v_s.period_to;
  END IF;

  v_bank := public._marketplace_account(p_org_id, '1020', 'Operating Bank Account (HDFC Current Account)');
  v_clearing := public._marketplace_account(p_org_id, '1040', 'Marketplace Receivable (Clearing)');
  v_fees := public._marketplace_account(p_org_id, '5091', 'Marketplace Commission & Fees');
  v_tcs := public._marketplace_account(p_org_id, '1084', 'TCS Receivable (Section 52 CGST)');
  v_tds := public._marketplace_account(p_org_id, '1085', 'TDS Receivable (Section 194-O)');
  v_igst := public._marketplace_account(p_org_id, '1083', 'Input IGST 18%');
  v_cgst := public._marketplace_account(p_org_id, '1081', 'Input CGST 9%');
  v_sgst := public._marketplace_account(p_org_id, '1082', 'Input SGST 9%');
  -- Only the accounts this settlement actually touches are required.
  v_missing := array_to_string(ARRAY[
    CASE WHEN v_s.net_payout <> 0 AND p_bank_account_id IS NULL AND v_bank IS NULL THEN '1020 Operating Bank Account (HDFC Current Account)' END,
    CASE WHEN v_s.gross_sales - v_s.refunds <> 0 AND v_clearing IS NULL THEN '1040 Marketplace Receivable (Clearing)' END,
    CASE WHEN (v_s.commission <> 0 OR v_s.other_fees <> 0) AND v_fees IS NULL THEN '5091 Marketplace Commission & Fees' END,
    CASE WHEN v_s.tcs_amount <> 0 AND v_tcs IS NULL THEN '1084 TCS Receivable (Section 52 CGST)' END,
    CASE WHEN v_s.tds_amount <> 0 AND v_tds IS NULL THEN '1085 TDS Receivable (Section 194-O)' END,
    CASE WHEN v_s.gst_on_fees <> 0 AND v_s.fee_gst_split = 'igst' AND v_igst IS NULL THEN '1083 Input IGST 18%' END,
    CASE WHEN v_s.gst_on_fees <> 0 AND v_s.fee_gst_split = 'cgst_sgst' AND v_cgst IS NULL THEN '1081 Input CGST 9%' END,
    CASE WHEN v_s.gst_on_fees <> 0 AND v_s.fee_gst_split = 'cgst_sgst' AND v_sgst IS NULL THEN '1082 Input SGST 9%' END
  ], ', ');
  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Missing accounts for marketplace settlement: %. Add them to the chart of accounts.', v_missing;
  END IF;

  IF p_bank_account_id IS NOT NULL THEN
    SELECT id INTO v_bank FROM public.accounts
    WHERE id = p_bank_account_id AND organisation_id = p_org_id AND account_group = 'asset' AND is_postable;
    IF v_bank IS NULL THEN
      RAISE EXCEPTION 'The chosen bank account is not a postable asset account of this company';
    END IF;
  END IF;

  INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reference, created_by)
  VALUES (
    p_org_id, v_fiscal_id, 'MKT-' || upper(v_s.channel) || '-' || v_s.settlement_ref, v_s.period_to, 'draft',
    format('%s settlement %s (%s to %s)', initcap(v_s.channel), v_s.settlement_ref, v_s.period_from, v_s.period_to),
    v_s.settlement_ref, auth.uid()
  )
  RETURNING * INTO v_entry;

  v_fee_cgst := round(v_s.gst_on_fees / 2, 2);
  -- Signed amounts: positive = debit, negative = credit (a refund-heavy period can flip a side).
  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
  SELECT p_org_id, v_entry.id, row_number() OVER (ORDER BY v.ord), v.account_id, v.descr, greatest(v.amt, 0), greatest(-v.amt, 0)
  FROM (VALUES
    (1, v_bank, 'Net payout', v_s.net_payout),
    (2, v_fees, 'Marketplace commission', v_s.commission),
    (3, v_fees, 'Marketplace fees', v_s.other_fees),
    (4, v_igst, 'IGST on marketplace fees', CASE WHEN v_s.fee_gst_split = 'igst' THEN v_s.gst_on_fees ELSE 0 END),
    (5, v_cgst, 'CGST on marketplace fees', CASE WHEN v_s.fee_gst_split = 'cgst_sgst' THEN v_fee_cgst ELSE 0 END),
    (6, v_sgst, 'SGST on marketplace fees', CASE WHEN v_s.fee_gst_split = 'cgst_sgst' THEN v_s.gst_on_fees - v_fee_cgst ELSE 0 END),
    (7, v_tcs, 'GST TCS u/s 52', v_s.tcs_amount),
    (8, v_tds, 'TDS u/s 194-O', v_s.tds_amount),
    (9, v_clearing, 'Sales less refunds', -(v_s.gross_sales - v_s.refunds))
  ) v(ord, account_id, descr, amt)
  WHERE v.amt <> 0;

  UPDATE public.marketplace_settlements SET journal_entry_id = v_entry.id WHERE id = v_s.id;

  IF (SELECT require_journal_approval FROM public.organisations WHERE id = p_org_id) THEN
    v_entry := public.submit_journal_for_approval(p_org_id, v_entry.id);
  ELSIF public.is_superadmin() OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[]) THEN
    v_entry := public.post_journal_entry(p_org_id, v_entry.id);
  END IF;
  -- Otherwise (an accountant without maker-checker) it stays a draft for the owner, CFO or admin to post.

  RETURN v_entry;
END;
$$;

-- Migration 11's seed_default_chart_of_accounts, plus the four marketplace accounts (1040, 1084, 1085, 5091).
CREATE OR REPLACE FUNCTION public.seed_default_chart_of_accounts(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has authority
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot seed chart of accounts';
  END IF;

  -- =========================================================================
  -- 1. ASSETS (A)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1000', 'Assets', 'asset', 'asset', 'Assets Root Group', 'Assets Root', 'Assets', false, true, 'Root Assets Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Liquid Capital -> Operating Bank Accounts -> HDFC Current Account
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1020', 'Operating Bank Account (HDFC Current Account)', 'asset', 'asset', 'Cash & Liquid Capital', 'Operating Bank Accounts', 'HDFC Bank Current Account', true, true, 'Primary operational bank current account')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Liquid Capital -> Cash In-Hand -> Petty Cash Reserve
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1010', 'Cash on Hand (Petty Cash Reserve)', 'asset', 'asset', 'Cash & Liquid Capital', 'Cash In-Hand', 'Petty Cash Reserve', true, true, 'Physical cash in office till')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Receivables -> Trade Debtors -> Customer Trade Receivables
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1030', 'Accounts Receivable (Customer Trade Debtors)', 'asset', 'asset', 'Current Assets & Receivables', 'Trade Debtors', 'Customer Trade Receivables', true, true, 'Trade balances due from billed customers')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Tax Assets -> Input GST Credits -> Input CGST / SGST / IGST
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES 
    (p_org_id, '1081', 'Input CGST 9%', 'asset', 'asset', 'Tax Assets & Input Credits', 'Input GST Credits', 'Input CGST 9%', true, true, 'Input Central GST Credit on purchases'),
    (p_org_id, '1082', 'Input SGST 9%', 'asset', 'asset', 'Tax Assets & Input Credits', 'Input GST Credits', 'Input SGST 9%', true, true, 'Input State GST Credit on purchases'),
    (p_org_id, '1083', 'Input IGST 18%', 'asset', 'asset', 'Tax Assets & Input Credits', 'Input GST Credits', 'Input IGST 18%', true, true, 'Input Integrated GST Credit on inter-state purchases')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;


  -- Marketplace settlements (migration 35): clearing receivable and taxes withheld by the operator
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES
    (p_org_id, '1040', 'Marketplace Receivable (Clearing)', 'asset', 'asset', 'Current Assets & Receivables', 'Marketplace Clearing', 'Marketplace Settlement Clearing', true, true, 'Sales made through e-commerce operators, cleared by their settlements'),
    (p_org_id, '1084', 'TCS Receivable (Section 52 CGST)', 'asset', 'asset', 'Tax Assets & Input Credits', 'TCS / TDS Receivable', 'GST TCS Collected by E-commerce Operators', true, true, 'TCS under section 52 of the CGST Act, claimed in the electronic cash ledger'),
    (p_org_id, '1085', 'TDS Receivable (Section 194-O)', 'asset', 'asset', 'Tax Assets & Input Credits', 'TCS / TDS Receivable', 'Income-tax TDS by E-commerce Operators', true, true, 'TDS under section 194-O of the Income-tax Act, claimed against income tax')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;
  -- =========================================================================
  -- 2. LIABILITIES (L)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '2000', 'Liabilities', 'liability', 'liability', 'Liabilities Root Group', 'Liabilities Root', 'Liabilities', false, true, 'Root Liabilities Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Payables -> Trade Creditors -> Domestic Vendor Payables
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '2010', 'Accounts Payable (Trade Creditors)', 'liability', 'liability', 'Current Liabilities & Payables', 'Trade Creditors', 'Domestic Vendor Payables', true, true, 'Trade balances owed to suppliers and vendors')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Statutory Liabilities -> Output GST Control -> Output CGST / SGST / IGST
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES 
    (p_org_id, '2081', 'Output CGST Payable (9%)', 'liability', 'liability', 'Statutory & Tax Liabilities', 'Output GST Control', 'Output CGST 9% Payable', true, true, 'Collected Central GST payable to government'),
    (p_org_id, '2082', 'Output SGST Payable (9%)', 'liability', 'liability', 'Statutory & Tax Liabilities', 'Output GST Control', 'Output SGST 9% Payable', true, true, 'Collected State GST payable to government'),
    (p_org_id, '2083', 'Output IGST Payable (18%)', 'liability', 'liability', 'Statutory & Tax Liabilities', 'Output GST Control', 'Output IGST 18% Payable', true, true, 'Collected Integrated GST payable to government')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- =========================================================================
  -- 3. EQUITY (E)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '3000', 'Equity', 'equity', 'equity', 'Equity Root Group', 'Equity Root', 'Equity', false, true, 'Root Equity Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Contributed Capital -> Shareholder Capital -> Primary Founder / Shareholder Equity
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '3010', 'Shareholder / Owner Capital', 'equity', 'equity', 'Owner / Contributed Capital', 'Shareholder Capital', 'Primary Shareholder Capital', true, true, 'Paid-in founder and shareholder equity capital')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Reserves -> Retained Earnings -> Accumulated Retained Earnings
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '3020', 'Retained Earnings', 'equity', 'equity', 'Reserves & Retained Earnings', 'Retained Earnings', 'Accumulated Retained Earnings', true, true, 'Accumulated earnings from prior accounting periods')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- =========================================================================
  -- 4. REVENUE (R)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4000', 'Operating Revenue', 'income', 'revenue', 'Revenue Root Group', 'Revenue Root', 'Revenue', false, true, 'Root Revenue Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Operating Revenue -> Product Sales -> Domestic Product Sales
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4010', 'Sales Revenue - Products', 'income', 'revenue', 'Operating Revenue / Sales', 'Product Sales Revenue', 'Domestic Product Sales Revenue', true, true, 'Gross revenue from commercial product sales')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Operating Revenue -> Service Revenue -> Professional Services Revenue
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4020', 'Service Fees & Professional Revenue', 'income', 'revenue', 'Operating Revenue / Sales', 'Service & Advisory Fees', 'Professional Advisory & Consulting Revenue', true, true, 'Fees from professional and advisory engagements')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Other Income -> Incidental Revenue -> Interest & Misc Income
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4090', 'Other Income & Interest', 'income', 'revenue', 'Other Income & Receipts', 'Incidental Revenue', 'Interest & Miscellaneous Income', true, true, 'Incidental earnings and interest received')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- =========================================================================
  -- 5. EXPENSES (X)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5000', 'Operating Expenses', 'expense', 'expense', 'Expense Root Group', 'Expense Root', 'Expenses', false, true, 'Root Expense Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Direct Delivery -> Cost of Goods Sold -> Direct Delivery Costs
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5010', 'Cost of Goods Sold (COGS)', 'expense', 'expense', 'Cost of Sales / Direct Delivery', 'Cost of Goods Sold (COGS)', 'Direct Operational Delivery Costs', true, true, 'Direct operational and goods delivery expenditures')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Human Resources -> Salaries & Compensation
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5020', 'Salaries and Contractor Compensation', 'expense', 'expense', 'Operating Overheads & Administration', 'Human Resources & Payroll', 'Staff Salaries & Contractor Fees', true, true, 'Employee payroll and professional contractor fees')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Technology -> Cloud Infrastructure & Software
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5030', 'Cloud Infrastructure & Software', 'expense', 'expense', 'Operating Overheads & Administration', 'Technology & SaaS Infrastructure', 'Cloud Infrastructure & SaaS Subscriptions', true, true, 'Server hosting, cloud APIs, and productivity software')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Facilities -> Office & Operational Rent
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5040', 'Office & Operational Rent', 'expense', 'expense', 'Operating Overheads & Administration', 'Facilities & Real Estate', 'Office Workspace Lease & Utilities', true, true, 'Physical workspace rent, co-working, and utility bills')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Financial Charges -> Bank Fees & Gateway Charges
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5090', 'Bank & Payment Processing Charges', 'expense', 'expense', 'Operating Overheads & Administration', 'Financial & Banking Charges', 'Bank Transaction Fees & Payment Gateway Charges', true, true, 'Commercial banking service fees and merchant discount rates')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Marketplace settlements (migration 35)
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5091', 'Marketplace Commission & Fees', 'expense', 'expense', 'Operating Overheads & Administration', 'Selling & Marketplace Fees', 'E-commerce Operator Commission & Fees', true, true, 'Commission, fulfilment, shipping and other fees charged by marketplaces')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

END;
$$;

-- Companies that already have the default chart get the four new accounts; existing rows are untouched.
INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
SELECT o.organisation_id, v.code, v.name, v.type::public.account_type, v.grp, v.ledger, v.sub_ledger, v.label, true, true, v.description
FROM (SELECT DISTINCT organisation_id FROM public.accounts WHERE code = '1000') o
CROSS JOIN (VALUES
  ('1040', 'Marketplace Receivable (Clearing)', 'asset', 'asset', 'Current Assets & Receivables', 'Marketplace Clearing', 'Marketplace Settlement Clearing', 'Sales made through e-commerce operators, cleared by their settlements'),
  ('1084', 'TCS Receivable (Section 52 CGST)', 'asset', 'asset', 'Tax Assets & Input Credits', 'TCS / TDS Receivable', 'GST TCS Collected by E-commerce Operators', 'TCS under section 52 of the CGST Act, claimed in the electronic cash ledger'),
  ('1085', 'TDS Receivable (Section 194-O)', 'asset', 'asset', 'Tax Assets & Input Credits', 'TCS / TDS Receivable', 'Income-tax TDS by E-commerce Operators', 'TDS under section 194-O of the Income-tax Act, claimed against income tax'),
  ('5091', 'Marketplace Commission & Fees', 'expense', 'expense', 'Operating Overheads & Administration', 'Selling & Marketplace Fees', 'E-commerce Operator Commission & Fees', 'Commission, fulfilment, shipping and other fees charged by marketplaces')
) v(code, name, type, grp, ledger, sub_ledger, label, description)
ON CONFLICT (organisation_id, code) DO NOTHING;

-- Migration 18/26 rules: explicit grants only, never on all functions.
REVOKE EXECUTE ON FUNCTION public.seed_default_chart_of_accounts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_marketplace_settlement(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.post_marketplace_settlement(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._marketplace_account(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_marketplace_settlement(uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_marketplace_settlement(uuid, uuid, uuid) TO authenticated, service_role;
