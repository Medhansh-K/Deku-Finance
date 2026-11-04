-- Migration 54: dated Trial Balance, Profit & Loss and Balance Sheet. Everything rolls back.
--
-- Ledger, in rupees (Dr / Cr):
--   2025-06-10 posted    1020 / 3010  10,000   capital
--   2025-12-01 posted    1020 / 4010   2,000   sale
--   2026-05-01 posted    5040 / 1020     500   rent
--   2026-06-15 posted    1030 / 4010   1,500   credit sale
--   2026-07-01 reversed  5040 / 2010     300   bill, reversed below
--   2026-07-05 posted    2010 / 5040     300   its reversal
--   2026-08-01 draft     5040 / 1020     999   never counts
--   2026-11-20 posted    5040 / 1020      70   after the range
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('54000000-0000-4000-8000-0000000000f1', 'range-member@test.local'),
  ('54000000-0000-4000-8000-0000000000f2', 'range-outsider@test.local');
INSERT INTO public.profiles (id, email, full_name) VALUES
  ('54000000-0000-4000-8000-0000000000f1', 'range-member@test.local', 'Range Member'),
  ('54000000-0000-4000-8000-0000000000f2', 'range-outsider@test.local', 'Range Outsider')
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.je(p_date date, p_dr text, p_cr text, p_amount numeric, p_status text, p_reversal_of uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_org uuid := '54000000-0000-4000-8000-000000000001';
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.journal_entries (id, organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reversal_of_id)
  SELECT v_id, v_org, f.id, 'RNG-' || p_date || '-' || p_dr, p_date, 'draft', 'range test ' || p_date, p_reversal_of
  FROM public.fiscal_periods f WHERE f.organisation_id = v_org AND p_date BETWEEN f.start_date AND f.end_date;
  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
  SELECT v_org, v_id, 1, a.id, p_amount, 0 FROM public.accounts a WHERE a.organisation_id = v_org AND a.code = p_dr;
  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
  SELECT v_org, v_id, 2, a.id, 0, p_amount FROM public.accounts a WHERE a.organisation_id = v_org AND a.code = p_cr;
  IF p_status <> 'draft' THEN
    UPDATE public.journal_entries SET status = p_status::public.journal_entry_status WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;

DO $$
DECLARE
  v_org uuid := '54000000-0000-4000-8000-000000000001';
  v_bill uuid;
BEGIN
  INSERT INTO public.organisations (id, name, slug, created_by)
  VALUES (v_org, 'Range Test', 'range-test', '54000000-0000-4000-8000-0000000000f1');
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org, '54000000-0000-4000-8000-0000000000f1', 'owner')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;
  INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status) VALUES
    (v_org, 'FY 2025-26', '2025-04-01', '2026-03-31', 'open'),
    (v_org, 'FY 2026-27', '2026-04-01', '2027-03-31', 'open');
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, label)
  SELECT v_org, c, nm, t::public.account_type, g, nm
  FROM (VALUES
    ('1020', 'Bank', 'asset', 'asset'),
    ('1030', 'Debtors', 'asset', 'asset'),
    ('2010', 'Creditors', 'liability', 'liability'),
    ('3010', 'Capital', 'equity', 'equity'),
    ('4010', 'Sales', 'income', 'revenue'),
    ('5040', 'Rent', 'expense', 'expense')
  ) AS x(c, nm, t, g);

  PERFORM pg_temp.je('2025-06-10', '1020', '3010', 10000, 'posted');
  PERFORM pg_temp.je('2025-12-01', '1020', '4010', 2000, 'posted');
  PERFORM pg_temp.je('2026-05-01', '5040', '1020', 500, 'posted');
  PERFORM pg_temp.je('2026-06-15', '1030', '4010', 1500, 'posted');
  v_bill := pg_temp.je('2026-07-01', '5040', '2010', 300, 'reversed');
  PERFORM pg_temp.je('2026-07-05', '2010', '5040', 300, 'posted', v_bill);
  PERFORM pg_temp.je('2026-08-01', '5040', '1020', 999, 'draft');
  PERFORM pg_temp.je('2026-11-20', '5040', '1020', 70, 'posted');
END $$;

SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub":"54000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true); END $$;

-- Trial Balance
DO $$
DECLARE
  o uuid := '54000000-0000-4000-8000-000000000001';
  r record;
  n int;
BEGIN
  -- 1 Apr to 30 Sep 2026: 1020 Cr 500; 1030 Dr 1,500; 2010 Dr 300 Cr 300; 4010 Cr 1,500; 5040 Dr 800 Cr 300.
  SELECT sum(total_debit) d, sum(total_credit) c INTO r FROM public.get_trial_balance_range(o, '2026-04-01', '2026-09-30');
  ASSERT r.d = 2600 AND r.c = 2600, format('range totals %s / %s, expected 2600 / 2600', r.d, r.c);
  SELECT * INTO r FROM public.get_trial_balance_range(o, '2026-04-01', '2026-09-30') t WHERE t.account_code = '5040';
  ASSERT (r.total_debit, r.total_credit, r.closing_debit, r.closing_credit) = (800::numeric, 300::numeric, 500::numeric, 0::numeric),
    format('5040 in range: %s', r);
  SELECT * INTO r FROM public.get_trial_balance_range(o, '2026-04-01', '2026-09-30') t WHERE t.account_code = '1020';
  ASSERT r.total_debit = 0 AND r.total_credit = 500, format('1020 in range: %s', r);

  -- Both ends are inclusive: only the rent falls on 1 May.
  SELECT sum(total_debit) d, sum(total_credit) c INTO r FROM public.get_trial_balance_range(o, '2026-05-01', '2026-05-01');
  ASSERT r.d = 500 AND r.c = 500, format('single day %s / %s', r.d, r.c);

  -- Open ends. Up to 31 Mar 2026: 12,000. From 1 Apr 2026: 2,600 + 70.
  SELECT sum(total_debit) d INTO r FROM public.get_trial_balance_range(o, NULL, '2026-03-31');
  ASSERT r.d = 12000, format('open start %s', r.d);
  SELECT sum(total_debit) d INTO r FROM public.get_trial_balance_range(o, '2026-04-01', NULL);
  ASSERT r.d = 2670, format('open end %s', r.d);

  -- No dates: 12,000 + 2,670, the same as the view, and no draft 999.
  SELECT sum(total_debit) d, sum(total_credit) c INTO r FROM public.get_trial_balance_range(o);
  ASSERT r.d = 14670 AND r.c = 14670, format('undated %s / %s', r.d, r.c);
  SELECT count(*) INTO n FROM (
    SELECT account_id, total_debit, total_credit, closing_debit, closing_credit FROM public.get_trial_balance_range(o)
    EXCEPT
    SELECT account_id, total_debit, total_credit, closing_debit, closing_credit FROM public.view_trial_balance WHERE organisation_id = o
  ) x;
  ASSERT n = 0, 'undated function differs from view_trial_balance';

  -- Year 2000: every account, all zero.
  SELECT count(*) INTO n FROM public.accounts a WHERE a.organisation_id = o;
  SELECT count(*) n, sum(total_debit) d, sum(total_credit) c INTO r FROM public.get_trial_balance_range(o, '2000-01-01', '2000-12-31');
  ASSERT r.n = n AND r.d = 0 AND r.c = 0, format('year 2000: %s of %s accounts', r, n);
END $$;

-- Profit & Loss
DO $$
DECLARE
  o uuid := '54000000-0000-4000-8000-000000000001';
  r record;
  n int;
BEGIN
  -- Sales 1,500. Rent 500 + 300 - 300 = 500: the reversed bill and its reversal cancel; the draft stays out.
  SELECT net_amount INTO r FROM public.get_profit_and_loss_range(o, '2026-04-01', '2026-09-30') p WHERE p.account_code = '4010';
  ASSERT r.net_amount = 1500, format('sales %s', r.net_amount);
  SELECT net_amount INTO r FROM public.get_profit_and_loss_range(o, '2026-04-01', '2026-09-30') p WHERE p.account_code = '5040';
  ASSERT r.net_amount = 500, format('rent %s', r.net_amount);
  SELECT count(*) INTO n FROM public.get_profit_and_loss_range(o, '2026-04-01', '2026-09-30');
  ASSERT n = 2, format('expected 2 rows, got %s', n);

  -- A range that catches the bill but not its reversal shows it, as the books did on that date.
  SELECT net_amount INTO r FROM public.get_profit_and_loss_range(o, '2026-07-01', '2026-07-01') p WHERE p.account_code = '5040';
  ASSERT r.net_amount = 300, format('reversed entry dropped: %s', r.net_amount);

  -- No dates: one row per account, sales 3,500 and rent 570. The view agrees over its one row per period.
  SELECT net_amount INTO r FROM public.get_profit_and_loss_range(o) p WHERE p.account_code = '4010';
  ASSERT r.net_amount = 3500, format('undated sales %s', r.net_amount);
  SELECT net_amount INTO r FROM public.get_profit_and_loss_range(o) p WHERE p.account_code = '5040';
  ASSERT r.net_amount = 570, format('undated rent %s', r.net_amount);
  SELECT sum(net_amount) n INTO r FROM public.view_profit_and_loss v WHERE v.organisation_id = o AND v.account_code = '5040';
  ASSERT r.n = 570, format('view rent %s', r.n);

  SELECT count(*) INTO n FROM public.get_profit_and_loss_range(o, '2000-01-01', '2000-12-31');
  ASSERT n = 0, format('year 2000 has %s rows', n);
END $$;

-- Balance Sheet
DO $$
DECLARE
  o uuid := '54000000-0000-4000-8000-000000000001';
  r record;
  n int;
BEGIN
  -- 30 Sep 2026: bank 12,000 - 500 = 11,500; debtors 1,500; capital 10,000; profit 3,500 - 500 = 3,000.
  SELECT
    sum(balance) FILTER (WHERE account_type = 'asset') a,
    coalesce(sum(balance) FILTER (WHERE account_type = 'liability'), 0) l,
    sum(balance) FILTER (WHERE account_type = 'equity') e,
    sum(balance) FILTER (WHERE account_id IS NULL) p
  INTO r FROM public.get_balance_sheet_as_of(o, '2026-09-30');
  ASSERT (r.a, r.l, r.e, r.p) = (13000::numeric, 0::numeric, 13000::numeric, 3000::numeric), format('as of 30 Sep: %s', r);
  SELECT balance INTO r FROM public.get_balance_sheet_as_of(o, '2026-09-30') b WHERE b.account_code = '1020';
  ASSERT r.balance = 11500, format('bank %s', r.balance);

  -- 31 Mar 2026: bank 12,000 against capital 10,000 and profit 2,000.
  SELECT sum(balance) FILTER (WHERE account_type = 'asset') a, sum(balance) FILTER (WHERE account_type = 'equity') e,
         sum(balance) FILTER (WHERE account_id IS NULL) p
  INTO r FROM public.get_balance_sheet_as_of(o, '2026-03-31');
  ASSERT (r.a, r.e, r.p) = (12000::numeric, 12000::numeric, 2000::numeric), format('as of 31 Mar: %s', r);

  -- 2 Jul 2026: the bill isn't reversed yet, so creditors 300 and profit 3,500 - 800 = 2,700.
  SELECT sum(balance) FILTER (WHERE account_type = 'asset') a, sum(balance) FILTER (WHERE account_type = 'liability') l,
         sum(balance) FILTER (WHERE account_type = 'equity') e, sum(balance) FILTER (WHERE account_id IS NULL) p
  INTO r FROM public.get_balance_sheet_as_of(o, '2026-07-02');
  ASSERT (r.a, r.l, r.e, r.p) = (13000::numeric, 300::numeric, 12700::numeric, 2700::numeric), format('as of 2 Jul: %s', r);

  -- No date: bank 11,430 + debtors 1,500 = 12,930; capital 10,000 + profit 2,930.
  SELECT sum(balance) FILTER (WHERE account_type = 'asset') a, sum(balance) FILTER (WHERE account_type = 'equity') e,
         sum(balance) FILTER (WHERE account_id IS NULL) p
  INTO r FROM public.get_balance_sheet_as_of(o);
  ASSERT (r.a, r.e, r.p) = (12930::numeric, 12930::numeric, 2930::numeric), format('undated: %s', r);

  -- Before the first entry there is nothing, not even a zero profit row.
  SELECT count(*) INTO n FROM public.get_balance_sheet_as_of(o, '2000-12-31');
  ASSERT n = 0, format('year 2000 has %s rows', n);
END $$;

-- General ledger view: the voucher's narration is there, the draft isn't.
DO $$
DECLARE
  o uuid := '54000000-0000-4000-8000-000000000001';
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.view_general_ledger v
  WHERE v.organisation_id = o AND v.narration = 'range test 2026-05-01';
  ASSERT n = 2, format('narration: %s rows', n);
  SELECT count(*) INTO n FROM public.view_general_ledger v WHERE v.organisation_id = o AND v.entry_date = '2026-08-01';
  ASSERT n = 0, 'draft reached the general ledger';
END $$;

-- An outsider gets a refusal, not an empty report.
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub":"54000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true); END $$;
DO $$
DECLARE
  q text;
  n int;
BEGIN
  FOREACH q IN ARRAY ARRAY[
    $s$SELECT * FROM public.get_trial_balance_range('54000000-0000-4000-8000-000000000001')$s$,
    $s$SELECT * FROM public.get_profit_and_loss_range('54000000-0000-4000-8000-000000000001', '2026-04-01', '2026-09-30')$s$,
    $s$SELECT * FROM public.get_balance_sheet_as_of('54000000-0000-4000-8000-000000000001', '2026-09-30')$s$
  ] LOOP
    BEGIN
      EXECUTE q;
      RAISE EXCEPTION 'outsider could run: %', q USING ERRCODE = 'P0002';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  SELECT count(*) INTO n FROM public.view_general_ledger v WHERE v.organisation_id = '54000000-0000-4000-8000-000000000001';
  ASSERT n = 0, 'outsider read the general ledger';
END $$;

RESET ROLE;
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_trial_balance_range(uuid, date, date)',
    'public.get_profit_and_loss_range(uuid, date, date)',
    'public.get_balance_sheet_as_of(uuid, date)'
  ] LOOP
    ASSERT NOT has_function_privilege('anon', f, 'EXECUTE'), f || ' is open to anon';
    ASSERT has_function_privilege('authenticated', f, 'EXECUTE'), f || ' is closed to authenticated';
    ASSERT has_function_privilege('service_role', f, 'EXECUTE'), f || ' is closed to service_role';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE oid = f::regprocedure AND 'search_path=public' = ANY (proconfig)), f || ' has no search_path';
    ASSERT NOT EXISTS (
      SELECT 1 FROM pg_proc p, aclexplode(p.proacl) x WHERE p.oid = f::regprocedure AND x.grantee = 0
    ), f || ' is open to PUBLIC';
  END LOOP;
END $$;

ROLLBACK;
\echo report_ranges_test passed
