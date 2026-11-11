-- Ledger aggregation functions (migration 29): get_party_ledger_ageing, get_kpi_snapshot,
-- get_expense_breakdown. Fixtures mirror tests/reports.test.ts. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

-- ---------------------------------------------------------------------------------------------
-- Fixture helpers (superuser only)
-- ---------------------------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('29000000-0000-4000-8000-0000000000f1', 'ledger-member@test.local'),
  ('29000000-0000-4000-8000-0000000000f2', 'ledger-outsider@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, email, full_name) VALUES
  ('29000000-0000-4000-8000-0000000000f1', 'ledger-member@test.local', 'Ledger Member'),
  ('29000000-0000-4000-8000-0000000000f2', 'ledger-outsider@test.local', 'Ledger Outsider')
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.org_id(n int) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('29000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.vendor(n int) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('29a00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.customer(n int) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('29c00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- A company with the reports.test.ts chart of accounts, a vendor and a customer.
CREATE FUNCTION pg_temp.make_org(n int, p_skip_codes text[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_org uuid := pg_temp.org_id(n);
BEGIN
  INSERT INTO public.organisations (id, name, slug, created_by)
  VALUES (v_org, 'Ledger Test ' || n, 'ledger-test-' || n, '29000000-0000-4000-8000-0000000000f1');
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org, '29000000-0000-4000-8000-0000000000f1', 'owner')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;
  INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status) VALUES
    (v_org, 'FY 2025-26', '2025-04-01', '2026-03-31', 'open'),
    (v_org, 'FY 2026-27', '2026-04-01', '2027-03-31', 'open');
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, label)
  SELECT v_org, c, nm, t::public.account_type, g, nm
  FROM (VALUES
    ('1020', 'Operating Bank Account', 'asset', 'asset'),
    ('1030', 'Accounts Receivable (Customer Trade Debtors)', 'asset', 'asset'),
    ('1081', 'Input CGST 9%', 'asset', 'asset'),
    ('2010', 'Accounts Payable (Trade Creditors)', 'liability', 'liability'),
    ('2081', 'Output CGST Payable (9%)', 'liability', 'liability'),
    ('3010', 'Owner Capital', 'equity', 'equity'),
    ('4010', 'Sales Revenue', 'income', 'revenue'),
    ('5010', 'Cost of Goods Sold (COGS)', 'expense', 'expense'),
    ('5040', 'Office Rent', 'expense', 'expense'),
    ('5030', 'Cloud Infrastructure', 'expense', 'expense')
  ) AS x(c, nm, t, g)
  WHERE c <> ALL (p_skip_codes);
  INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name) VALUES
    (pg_temp.vendor(n), v_org, 'vendor', 'Vendor One', ''),
    (pg_temp.customer(n), v_org, 'customer', 'Customer One', 'C One');
  RETURN v_org;
END $$;

-- Journal entry from [code, debit, credit, party] lines. Lines go in while it's a draft, then
-- the status is set directly (the reversal function is covered by database_test.sql).
CREATE FUNCTION pg_temp.je(
  p_org uuid, p_date date, p_lines jsonb, p_status text DEFAULT 'posted', p_reversal_of uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_n int;
  l jsonb;
  i int := 0;
BEGIN
  SELECT count(*) + 1 INTO v_n FROM public.journal_entries WHERE organisation_id = p_org;
  INSERT INTO public.journal_entries (id, organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reversal_of_id)
  SELECT v_id, p_org, f.id, 'JRN-' || lpad(v_n::text, 4, '0'), p_date, 'draft', 'test', p_reversal_of
  FROM public.fiscal_periods f
  WHERE f.organisation_id = p_org AND p_date BETWEEN f.start_date AND f.end_date;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    i := i + 1;
    INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, party_id, debit, credit)
    SELECT p_org, v_id, i, a.id, nullif(l->>3, '')::uuid, (l->>1)::numeric, (l->>2)::numeric
    FROM public.accounts a WHERE a.organisation_id = p_org AND a.code = l->>0;
  END LOOP;
  IF p_status <> 'draft' THEN
    UPDATE public.journal_entries SET status = p_status::public.journal_entry_status WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  o uuid;
  v uuid;
  c uuid;
  b1 uuid;
  ar1 uuid;
BEGIN
  -- 1: empty books plus one draft.
  o := pg_temp.make_org(1);
  PERFORM pg_temp.je(o, '2026-10-01', '[["5040",500,0],["1020",0,500]]', 'draft');

  -- 2: vendor bills aged oldest first.
  o := pg_temp.make_org(2); v := pg_temp.vendor(2);
  PERFORM pg_temp.je(o, '2026-07-01', jsonb_build_array(jsonb_build_array('5030', 100.10, 0), jsonb_build_array('2010', 0, 100.10, v)));
  PERFORM pg_temp.je(o, '2026-09-15', jsonb_build_array(jsonb_build_array('5040', 200.20, 0), jsonb_build_array('2010', 0, 200.20, v)));
  PERFORM pg_temp.je(o, '2026-10-01', jsonb_build_array(jsonb_build_array('2010', 150.15, 0, v), jsonb_build_array('1020', 0, 150.15)));

  -- 3: a reversed bill and its reversal cancel out.
  o := pg_temp.make_org(3); v := pg_temp.vendor(3);
  b1 := pg_temp.je(o, '2026-08-01', jsonb_build_array(jsonb_build_array('5040', 500, 0), jsonb_build_array('2010', 0, 500, v)), 'reversed');
  PERFORM pg_temp.je(o, '2026-08-05', jsonb_build_array(jsonb_build_array('2010', 500, 0, v), jsonb_build_array('5040', 0, 500)), 'posted', b1);
  PERFORM pg_temp.je(o, '2026-10-20', jsonb_build_array(jsonb_build_array('5040', 80, 0), jsonb_build_array('2010', 0, 80, v)));

  -- 4: overpayment is an advance; lines without a party stay apart.
  o := pg_temp.make_org(4); v := pg_temp.vendor(4);
  PERFORM pg_temp.je(o, '2026-10-01', jsonb_build_array(jsonb_build_array('2010', 300, 0, v), jsonb_build_array('1020', 0, 300)));
  PERFORM pg_temp.je(o, '2026-10-10', jsonb_build_array(jsonb_build_array('5040', 100, 0), jsonb_build_array('2010', 0, 100, v)));
  PERFORM pg_temp.je(o, '2026-10-11', '[["5040",40,0],["2010",0,40]]');

  -- 5: DSO over a 60-day-old book; the sale is linked to an issued invoice.
  o := pg_temp.make_org(5); c := pg_temp.customer(5);
  ar1 := pg_temp.je(o, '2026-08-30', jsonb_build_array(jsonb_build_array('1030', 1000, 0, c), jsonb_build_array('4010', 0, 1000)));
  PERFORM pg_temp.je(o, '2026-10-28', jsonb_build_array(jsonb_build_array('1020', 500, 0), jsonb_build_array('1030', 0, 500, c)));
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, status, place_of_supply, total_amount, journal_entry_id)
  VALUES (o, c, 'INV-5-1', '2026-08-30', '2026-09-29', 'issued', '27', 1000, ar1);

  -- 6: operating expenses and KPIs.
  o := pg_temp.make_org(6); v := pg_temp.vendor(6); c := pg_temp.customer(6);
  PERFORM pg_temp.je(o, '2026-03-31', '[["5040",999,0],["1020",0,999]]');
  PERFORM pg_temp.je(o, '2026-05-01', jsonb_build_array(jsonb_build_array('5040', 1000, 0), jsonb_build_array('1081', 90, 0), jsonb_build_array('2010', 0, 1090, v)));
  PERFORM pg_temp.je(o, '2026-06-01', '[["5030",250.50,0],["1020",0,250.50]]');
  PERFORM pg_temp.je(o, '2026-06-02', '[["5010",700,0],["1020",0,700]]');
  PERFORM pg_temp.je(o, '2026-06-03', '[["1020",10000,0],["4010",0,10000]]');
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, status, place_of_supply, total_amount) VALUES
    (o, c, 'INV-6-1', '2026-06-03', '2026-07-03', 'issued', '27', 11800),
    (o, c, 'INV-6-2', '2026-06-04', '2026-07-04', 'draft', '27', 5000),
    (o, c, 'INV-6-3', '2026-06-05', '2026-07-05', 'issued', '27', 5000);
  UPDATE public.sales_invoices SET status = 'cancelled' WHERE organisation_id = o AND invoice_number = 'INV-6-3';

  -- 7: no 2010 account; "Sundry Creditors" is found by name, a GST payable never is.
  o := pg_temp.make_org(7, ARRAY['2010']); v := pg_temp.vendor(7);
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, label)
  VALUES (o, '2999', 'Sundry Creditors', 'liability', 'liability', 'Sundry Creditors');
  PERFORM pg_temp.je(o, '2026-10-20', jsonb_build_array(jsonb_build_array('5040', 75, 0), jsonb_build_array('2999', 0, 75, v)));

  -- 8: no creditors ledger at all.
  o := pg_temp.make_org(8, ARRAY['2010']);
END $$;

-- ---------------------------------------------------------------------------------------------
-- As a member
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true); END $$;

DO $$
DECLARE
  k jsonb;
  e jsonb;
  r record;
  n int;
  o uuid;
BEGIN
  -- Empty books, drafts ignored
  o := '29000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO n FROM public.get_party_ledger_ageing(o, 'payable', '2026-10-28');
  IF n <> 0 THEN RAISE EXCEPTION 'empty books: expected no payable rows, got %', n; END IF;
  k := public.get_kpi_snapshot(o, '2026-04-01', '2026-10-28');
  IF (k->>'has_entries')::boolean THEN RAISE EXCEPTION 'draft counted as booked: %', k; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['turnover','profit','billed','liquid','debtors','creditors','expenses','assets','equity','balanced','dso_days','dpo_days','margin_pct','gst_net']) f
             WHERE k->f <> 'null'::jsonb) THEN
    RAISE EXCEPTION 'empty books: expected null KPIs, got %', k;
  END IF;
  e := public.get_expense_breakdown(o, '2026-04-01', '2026-10-28');
  IF e->'vouchers' <> '[]'::jsonb OR e->'by_head' <> '[]'::jsonb OR (e->>'total')::numeric <> 0 THEN
    RAISE EXCEPTION 'empty books: expected no expenses, got %', e;
  END IF;

  -- Oldest-first ageing in exact rupees
  SELECT * INTO r FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000002', 'payable', '2026-10-28');
  IF r.party_id <> '29a00000-0000-4000-8000-000000000002' OR r.party_name <> 'Vendor One' OR r.balance <> 150.15 THEN
    RAISE EXCEPTION 'ageing: unexpected row %', r;
  END IF;
  IF jsonb_array_length(r.open_items) <> 1
     OR r.open_items->0->>'date' <> '2026-09-15'
     OR (r.open_items->0->>'open')::numeric <> 150.15
     OR (r.open_items->0->>'amount')::numeric <> 200.20
     OR (r.open_items->0->>'age_days')::int <> 43 THEN
    RAISE EXCEPTION 'ageing: July bill should be cleared and September half paid, got %', r.open_items;
  END IF;
  IF (r.d0_30, r.d31_60, r.d61_90, r.d90_plus, r.oldest_age_days) IS DISTINCT FROM (0::numeric, 150.15, 0::numeric, 0::numeric, 43) THEN
    RAISE EXCEPTION 'ageing: wrong buckets %', r;
  END IF;

  -- Reversal pairs cancel out
  SELECT count(*) INTO n FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000003', 'payable', '2026-10-28');
  SELECT * INTO r FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000003', 'payable', '2026-10-28');
  IF n <> 1 OR r.balance <> 80 OR jsonb_array_length(r.open_items) <> 1 OR r.open_items->0->>'date' <> '2026-10-20' THEN
    RAISE EXCEPTION 'reversal: expected only the 80 bill, got % rows, %', n, r;
  END IF;

  -- Advances and lines without a party
  SELECT * INTO r FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000004', 'payable', '2026-10-28') g
  WHERE g.party_id IS NOT NULL;
  IF r.balance <> -200 OR r.advance <> 200 OR r.open_items <> '[]'::jsonb OR r.oldest_age_days IS NOT NULL THEN
    RAISE EXCEPTION 'advance: unexpected vendor row %', r;
  END IF;
  SELECT * INTO r FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000004', 'payable', '2026-10-28') g
  WHERE g.party_id IS NULL;
  IF r.balance IS DISTINCT FROM 40.00 OR r.party_name IS NOT NULL THEN
    RAISE EXCEPTION 'advance: unexpected no-party row %', r;
  END IF;

  -- DSO window shrinks to the age of the books; invoice link on open items
  k := public.get_kpi_snapshot('29000000-0000-4000-8000-000000000005', '2026-04-01', '2026-10-28');
  IF (k->>'dso_days')::int IS DISTINCT FROM 30 OR k->'dpo_days' <> 'null'::jsonb OR (k->>'debtors')::numeric <> 500 THEN
    RAISE EXCEPTION 'dso: expected 30 days on 500 outstanding and no DPO, got %', k;
  END IF;
  IF k->'debtors_account'->>'code' <> '1030' OR (k->>'debtors_count')::int <> 1 OR (k->>'debtors_over_45_count')::int <> 1 THEN
    RAISE EXCEPTION 'dso: debtor counts/account wrong %', k;
  END IF;
  SELECT * INTO r FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000005', 'receivable', '2026-10-28');
  IF r.party_name <> 'C One' OR r.open_items->0->>'invoice_number' <> 'INV-5-1' OR r.open_items->0->>'due_date' <> '2026-09-29'
     OR (r.open_items->0->>'open')::numeric <> 500 THEN
    RAISE EXCEPTION 'invoice link: got %', r;
  END IF;

  -- Expenses exclude cost of sales and earlier periods
  e := public.get_expense_breakdown('29000000-0000-4000-8000-000000000006', '2026-04-01', '2026-10-28');
  IF (e->>'total')::numeric <> 1250.50 OR (e->>'revenue')::numeric <> 10000 THEN
    RAISE EXCEPTION 'expenses: wrong total/revenue %', e;
  END IF;
  IF (SELECT jsonb_agg(jsonb_build_array(h->>'name', (h->>'amount')::numeric, (h->>'entries')::int)) FROM jsonb_array_elements(e->'by_head') h)
     <> '[["Office Rent", 1000.00, 1], ["Cloud Infrastructure", 250.50, 1]]'::jsonb THEN
    RAISE EXCEPTION 'expenses: wrong heads %', e->'by_head';
  END IF;
  SELECT v INTO k FROM jsonb_array_elements(e->'vouchers') v WHERE v->>'date' = '2026-05-01';
  IF k->>'party_name' <> 'Vendor One' OR k->'sources' <> '["Accounts Payable (Trade Creditors)"]'::jsonb
     OR (k->>'amount')::numeric <> 1000 OR jsonb_array_length(k->'lines') <> 3 THEN
    RAISE EXCEPTION 'expenses: wrong bill voucher %', k;
  END IF;
  IF jsonb_array_length(e->'vouchers') <> 2 OR e->'vouchers'->0->>'date' <> '2026-06-01' THEN
    RAISE EXCEPTION 'expenses: vouchers should be the two opex entries, newest first: %', e->'vouchers';
  END IF;

  -- KPIs and the accounting equation
  k := public.get_kpi_snapshot('29000000-0000-4000-8000-000000000006', '2026-04-01', '2026-10-28');
  IF (k->>'turnover')::numeric <> 10000 OR (k->>'expenses')::numeric <> 1250.50
     OR (k->>'profit')::numeric <> 10000 - 1250.50 - 700
     OR (k->>'margin_pct')::numeric <> 80.5
     OR (k->>'billed')::numeric <> 11800
     OR (k->>'liquid')::numeric <> 10000 - 999 - 250.50 - 700
     OR k->'liquid_accounts' <> '["Operating Bank Account"]'::jsonb
     OR (k->>'creditors')::numeric <> 1090 OR (k->>'creditors_count')::int <> 1
     OR (k->>'gst_input')::numeric <> 90 OR (k->>'gst_output')::numeric <> 0 OR (k->>'gst_net')::numeric <> -90
     OR k->'expense_heads' <> '["Office Rent", "Cloud Infrastructure"]'::jsonb
     OR NOT (k->>'balanced')::boolean
     OR (k->>'assets')::numeric <> (k->>'liabilities')::numeric + (k->>'equity')::numeric
     OR k->>'last_entry_date' <> '2026-06-03' THEN
    RAISE EXCEPTION 'kpis: unexpected snapshot %', k;
  END IF;

  -- Control account by name, and none at all
  SELECT * INTO r FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000007', 'payable', '2026-10-28');
  IF r.balance IS DISTINCT FROM 75.00 THEN RAISE EXCEPTION 'sundry creditors not used as control account: %', r; END IF;
  SELECT count(*) INTO n FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000008', 'payable', '2026-10-28');
  k := public.get_kpi_snapshot('29000000-0000-4000-8000-000000000008', '2026-04-01', '2026-10-28');
  IF n <> 0 OR k->'creditors_account' <> 'null'::jsonb OR k->'creditors' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'no creditors ledger: expected nothing, got % rows, %', n, k;
  END IF;

  BEGIN
    PERFORM public.get_party_ledger_ageing(o, 'sideways');
    RAISE EXCEPTION 'bad side accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------------------------
-- As a non-member, and as anon
-- ---------------------------------------------------------------------------------------------
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true); END $$;
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    $q$SELECT * FROM public.get_party_ledger_ageing('29000000-0000-4000-8000-000000000006', 'payable')$q$,
    $q$SELECT public.get_kpi_snapshot('29000000-0000-4000-8000-000000000006', '2026-04-01', '2026-10-28')$q$,
    $q$SELECT public.get_expense_breakdown('29000000-0000-4000-8000-000000000006', '2026-04-01', '2026-10-28')$q$
  ] LOOP
    BEGIN
      EXECUTE f;
      RAISE EXCEPTION 'non-member could run: %', f;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
END $$;

RESET ROLE;
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_party_ledger_ageing(uuid, text, date)',
    'public.get_kpi_snapshot(uuid, date, date)',
    'public.get_expense_breakdown(uuid, date, date)'
  ] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION '% must be executable by authenticated only', f;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public._ledger_control_account(uuid, text)',
    'public._ledger_live_entries(uuid, date)',
    'public._ledger_days_outstanding(uuid, uuid, text, numeric, date)',
    'public._ledger_accounts(uuid)'
  ] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'internal helper % is exposed', f;
    END IF;
  END LOOP;
  RAISE WARNING 'ledger_functions_test: all checks passed';
END $$;

ROLLBACK;
