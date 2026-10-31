-- Migration 43: import jobs - all-or-nothing apply, re-apply refused, balanced opening journal,
-- maker-checker on imported vouchers, and RLS.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('c3000000-0000-0000-0000-000000000001', 'imp-owner@example.com'),
  ('c3000000-0000-0000-0000-000000000002', 'imp-accountant@example.com'),
  ('c3000000-0000-0000-0000-000000000003', 'imp-outsider@example.com'),
  ('c3000000-0000-0000-0000-000000000004', 'imp-viewer@example.com');
INSERT INTO public.organisations (id, name, slug, created_by)
VALUES ('c4000000-0000-0000-0000-000000000001', 'Import Test', 'import-test', 'c3000000-0000-0000-0000-000000000001');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'owner'),
  ('c4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000002', 'accountant'),
  ('c4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000004', 'viewer')
ON CONFLICT DO NOTHING;
SELECT public.seed_default_chart_of_accounts('c4000000-0000-0000-0000-000000000001');
-- Relative to today: the opening journal goes to the start of the period covering current_date.
INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date)
VALUES ('c4000000-0000-0000-0000-000000000001', 'Import FY', current_date - 30, current_date + 300);

CREATE FUNCTION pg_temp.job(p_kind text, p_allow boolean DEFAULT false) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.import_jobs (organisation_id, kind, source, filename, status, row_count, allow_opening_difference)
  VALUES ('c4000000-0000-0000-0000-000000000001', p_kind, 'csv', 'test.csv', 'validated', 0, p_allow)
  RETURNING id;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

DO $$
DECLARE
  v_org uuid := 'c4000000-0000-0000-0000-000000000001';
  v_job uuid;
  r public.import_jobs;
  v_dr numeric;
  v_cr numeric;
  v_je public.journal_entries;
BEGIN
  -- Chart of accounts: a code is generated when missing; the job applies once.
  v_job := pg_temp.job('chart_of_accounts');
  r := public.apply_import_job(v_org, v_job, '[
    {"row":1,"name":"Office Rent","account_group":"expense","ledger":"Operating Overheads & Administration","sub_ledger":"Indirect Expenses"},
    {"row":2,"code":"1101","name":"HDFC Savings","account_group":"asset"}]');
  ASSERT r.status = 'applied' AND r.applied_at IS NOT NULL AND r.row_count = 2, 'accounts not applied: ' || r.status || ' ' || r.errors::text;
  ASSERT (SELECT code FROM public.accounts WHERE organisation_id = v_org AND name = 'Office Rent') = '50001', 'code not generated';
  ASSERT (SELECT type::text FROM public.accounts WHERE organisation_id = v_org AND code = '1101') = 'asset', 'type not derived';
  BEGIN
    PERFORM public.apply_import_job(v_org, v_job, '[{"row":1,"name":"Another","account_group":"asset"}]');
    RAISE EXCEPTION 're-applied';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Import job was already applied%', SQLERRM;
  END;

  -- All or nothing: the third row duplicates an existing name, so the first two are not created either.
  v_job := pg_temp.job('chart_of_accounts');
  r := public.apply_import_job(v_org, v_job, '[
    {"row":1,"name":"Travel","account_group":"expense"},
    {"row":2,"name":"Fixed Deposit","account_group":"asset"},
    {"row":3,"name":"office rent","account_group":"expense"}]');
  ASSERT r.status = 'failed' AND r.applied_at IS NULL, 'bad job not failed';
  ASSERT (r.errors->0->>'row')::int = 3 AND r.errors->0->>'message' LIKE 'An account named "office rent" already exists', r.errors::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.accounts WHERE organisation_id = v_org AND name IN ('Travel', 'Fixed Deposit')), 'partial import kept';
  ASSERT (SELECT status FROM public.import_jobs WHERE id = v_job) = 'failed', 'failure not recorded';

  -- Parties: the GSTIN check digit is verified on the server too.
  v_job := pg_temp.job('parties');
  r := public.apply_import_job(v_org, v_job, '[
    {"row":1,"name":"Acme Traders","type":"customer","gstin":"27AAPFU0939F1ZV","state":"Maharashtra"},
    {"row":2,"name":"Bad GST Co","type":"vendor","gstin":"27AAPFU0939F1ZW"}]');
  ASSERT r.status = 'failed' AND r.errors->0->>'message' LIKE 'GSTIN 27AAPFU0939F1ZW is not valid%', r.errors::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.parties WHERE organisation_id = v_org AND legal_name = 'Acme Traders'), 'party kept after failure';
  -- A failed job can be retried with corrected rows.
  r := public.apply_import_job(v_org, v_job, '[
    {"row":1,"name":"Acme Traders","type":"customer","gstin":"27AAPFU0939F1ZV","state":"Maharashtra"},
    {"row":2,"name":"Good Supplies","type":"vendor","gstin":"29AABCU9603R1ZJ"}]');
  ASSERT r.status = 'applied', r.errors::text;
  ASSERT (SELECT billing_address->>'state' FROM public.parties WHERE organisation_id = v_org AND legal_name = 'Acme Traders') = 'Maharashtra', 'state lost';

  -- Items.
  v_job := pg_temp.job('items');
  r := public.apply_import_job(v_org, v_job, '[{"row":1,"name":"Widget","sku":"W-1","hsn_sac_code":"8471","unit_code":"NOS","gst_rate":18,"price_paise":12550}]');
  ASSERT r.status = 'applied', r.errors::text;
  ASSERT (SELECT default_unit_price FROM public.catalogue_items WHERE organisation_id = v_org AND sku = 'W-1') = 125.50, 'price wrong';

  -- Opening balances that do not balance are refused unless the difference was confirmed.
  v_job := pg_temp.job('opening_balances');
  r := public.apply_import_job(v_org, v_job, '[
    {"row":1,"account_code":"1010","debit_paise":100000},
    {"row":2,"account_code":"1030","party_name":"Acme Traders","debit_paise":50000},
    {"row":3,"account_code":"3010","credit_paise":120000}]');
  ASSERT r.status = 'failed' AND r.errors->0->>'message' LIKE 'Opening balances do not balance (difference 300.00)%', r.errors::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organisation_id = v_org AND entry_number LIKE 'OPENING/%'), 'opening kept';

  v_job := pg_temp.job('opening_balances', true);
  r := public.apply_import_job(v_org, v_job, '[
    {"row":1,"account_code":"1010","debit_paise":100000},
    {"row":2,"account_code":"1030","party_name":"Acme Traders","debit_paise":50000},
    {"row":3,"account_code":"3010","credit_paise":120000}]');
  ASSERT r.status = 'applied', r.errors::text;
  SELECT * INTO v_je FROM public.journal_entries WHERE organisation_id = v_org AND entry_number LIKE 'OPENING/%';
  ASSERT v_je.status = 'posted', 'owner opening not posted: ' || v_je.status;
  ASSERT v_je.entry_date = current_date - 30, 'opening not dated at the period start';
  SELECT sum(debit), sum(credit) INTO v_dr, v_cr FROM public.journal_entry_lines WHERE journal_entry_id = v_je.id;
  ASSERT v_dr = v_cr AND v_dr = 1500, format('opening not balanced: %s / %s', v_dr, v_cr);
  ASSERT (SELECT l.credit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.name = 'Opening Balance Difference') = 300, 'difference not credited';
  ASSERT (SELECT p.legal_name FROM public.journal_entry_lines l JOIN public.parties p ON p.id = l.party_id
          WHERE l.journal_entry_id = v_je.id) = 'Acme Traders', 'party not on debtor line';
  -- A second opening import for the same period is refused.
  v_job := pg_temp.job('opening_balances');
  r := public.apply_import_job(v_org, v_job, '[{"row":1,"account_code":"1010","debit_paise":1},{"row":2,"account_code":"3010","credit_paise":1}]');
  ASSERT r.status = 'failed' AND r.errors->0->>'message' LIKE 'Opening balances for % were already imported%', r.errors::text;

  -- Vouchers: one unbalanced voucher rolls back the balanced one before it.
  v_job := pg_temp.job('vouchers');
  r := public.apply_import_job(v_org, v_job, format('[
    {"row":1,"date":"%s","number":"1","voucher_type":"Sales","narration":"Sale to Acme","lines":[
      {"account_code":"1030","party_name":"Acme Traders","debit_paise":11800},
      {"account_code":"4010","credit_paise":10000},
      {"account_code":"2083","credit_paise":1800}]},
    {"row":2,"date":"%s","number":"2","voucher_type":"Payment","lines":[
      {"account_name":"Office Rent","debit_paise":5000},
      {"account_name":"HDFC Savings","credit_paise":4999}]}]', current_date, current_date)::jsonb);
  ASSERT r.status = 'failed' AND (r.errors->0->>'row')::int = 2 AND r.errors->0->>'message' LIKE 'Voucher does not balance%', r.errors::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organisation_id = v_org AND entry_number LIKE 'IMP/%'), 'voucher kept';

  v_job := pg_temp.job('vouchers');
  r := public.apply_import_job(v_org, v_job, format('[
    {"row":1,"date":"%s","number":"1","voucher_type":"Sales","narration":"Sale to Acme","lines":[
      {"account_code":"1030","party_name":"Acme Traders","debit_paise":11800},
      {"account_code":"4010","credit_paise":10000},
      {"account_code":"2083","credit_paise":1800}]},
    {"row":2,"date":"%s","number":"2","voucher_type":"Payment","lines":[
      {"account_name":"Office Rent","debit_paise":5000},
      {"account_name":"HDFC Savings","credit_paise":5000}]}]', current_date, current_date)::jsonb);
  ASSERT r.status = 'applied', r.errors::text;
  ASSERT (SELECT count(*) FROM public.journal_entries WHERE organisation_id = v_org AND entry_number IN ('IMP/Sales/1', 'IMP/Payment/2') AND status = 'posted') = 2, 'vouchers not posted';

  -- The same voucher in a new job is a duplicate.
  v_job := pg_temp.job('vouchers');
  r := public.apply_import_job(v_org, v_job, format('[{"row":1,"date":"%s","number":"1","voucher_type":"Sales","lines":[
      {"account_code":"1010","debit_paise":1},{"account_code":"4010","credit_paise":1}]}]', current_date)::jsonb);
  ASSERT r.status = 'failed' AND r.errors->0->>'message' = 'Voucher IMP/Sales/1 was already imported', r.errors::text;

  -- Unknown accounts are named.
  v_job := pg_temp.job('vouchers');
  r := public.apply_import_job(v_org, v_job, format('[{"row":7,"date":"%s","number":"9","lines":[
      {"account_name":"No Such Ledger","debit_paise":1},{"account_code":"4010","credit_paise":1}]}]', current_date)::jsonb);
  ASSERT r.status = 'failed' AND (r.errors->0->>'row')::int = 7 AND r.errors->0->>'message' LIKE 'Account "No Such Ledger" does not exist%', r.errors::text;
END $$;

-- Clients cannot mark a job applied or change it afterwards.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.import_jobs (organisation_id, kind, source, status)
    VALUES ('c4000000-0000-0000-0000-000000000001', 'parties', 'csv', 'applied');
    RAISE EXCEPTION 'inserted an applied job';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.import_jobs SET status = 'validated' WHERE status = 'applied';
    RAISE EXCEPTION 'updated a job';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Viewer: reads jobs, cannot create or apply.
SELECT set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.import_jobs) > 0, 'viewer cannot read jobs';
  BEGIN
    PERFORM pg_temp.job('parties');
    RAISE EXCEPTION 'viewer created a job';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.apply_import_job('c4000000-0000-0000-0000-000000000001', gen_random_uuid(), '[]');
    RAISE EXCEPTION 'viewer applied';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Permission denied%', SQLERRM;
  END;
END $$;

-- Outsider: sees nothing, cannot apply someone else's job.
SELECT set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.import_jobs) = 0, 'outsider reads jobs';
  BEGIN
    PERFORM public.apply_import_job('c4000000-0000-0000-0000-000000000001',
      (SELECT id FROM public.import_jobs LIMIT 1), '[{"name":"x","account_group":"asset"}]');
    RAISE EXCEPTION 'outsider applied';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Permission denied%', SQLERRM;
  END;
END $$;

-- Maker-checker on: the accountant's imported vouchers wait for approval.
RESET ROLE;
UPDATE public.organisations SET require_journal_approval = true WHERE id = 'c4000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE
  r public.import_jobs;
  v_je public.journal_entries;
BEGIN
  r := public.apply_import_job('c4000000-0000-0000-0000-000000000001', pg_temp.job('vouchers'), format('[
    {"row":1,"date":"%s","number":"3","voucher_type":"Journal","lines":[
      {"account_code":"5040","debit_paise":700},{"account_code":"1010","credit_paise":700}]}]', current_date)::jsonb);
  ASSERT r.status = 'applied', r.errors::text;
  SELECT * INTO v_je FROM public.journal_entries WHERE entry_number = 'IMP/Journal/3';
  ASSERT v_je.status = 'draft' AND v_je.submitted_at IS NOT NULL
    AND v_je.submitted_by = 'c3000000-0000-0000-0000-000000000002', 'imported voucher not submitted for approval';
END $$;

RESET ROLE;
DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.apply_import_job(uuid, uuid, jsonb)', 'EXECUTE'), 'anon can apply';
  ASSERT NOT has_function_privilege('authenticated', 'public._import_journal_lines(uuid, uuid, jsonb)', 'EXECUTE'), 'helper exposed';
  ASSERT NOT has_function_privilege('authenticated', 'public._import_account(uuid, jsonb)', 'EXECUTE'), 'helper exposed';
  ASSERT NOT has_table_privilege('anon', 'public.import_jobs', 'SELECT'), 'anon reads jobs';
  RAISE NOTICE 'import_test passed';
END $$;

ROLLBACK;
