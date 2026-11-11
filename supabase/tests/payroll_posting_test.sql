-- Migration 58: a payroll run posts its journal once. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('58000000-0000-4000-8000-0000000000a1', 'pay-post-owner@test.local');
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('58000000-0000-4000-8000-000000000001', 'Payroll Post Co', 'payroll-post-co', '58000000-0000-4000-8000-0000000000a1');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('58000000-0000-4000-8000-000000000001', '58000000-0000-4000-8000-0000000000a1', 'owner');
SELECT public.seed_default_chart_of_accounts('58000000-0000-4000-8000-000000000001');
INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date) VALUES
  ('58000000-0000-4000-8000-000000000001', 'Current', current_date - 400, current_date + 400);
DELETE FROM public.employees WHERE organisation_id = '58000000-0000-4000-8000-000000000001';
INSERT INTO public.employees (organisation_id, name, email, designation, monthly_gross, monthly_net, tds_deduction_monthly, epf_monthly, status) VALUES
  ('58000000-0000-4000-8000-000000000001', 'One', 'one@test.local', 'Clerk', 50000, 42000, 2000, 6000, 'active'),
  ('58000000-0000-4000-8000-000000000001', 'Two', 'two@test.local', 'Clerk', 30000, 25400, 1000, 3600, 'active'),
  ('58000000-0000-4000-8000-000000000001', 'Away', 'away@test.local', 'Clerk', 99000, 99000, 0, 0, 'on_leave');

SELECT set_config('request.jwt.claims', '{"sub":"58000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

CREATE FUNCTION pg_temp.net(p_code text) RETURNS numeric LANGUAGE sql AS $$
  SELECT total_debit - total_credit FROM public.view_trial_balance
  WHERE organisation_id = '58000000-0000-4000-8000-000000000001' AND account_code = p_code;
$$;

DO $$
DECLARE
  v_org uuid := '58000000-0000-4000-8000-000000000001';
  v_period text := to_char(current_date, 'YYYY-MM');
  r jsonb;
  v_entry uuid;
BEGIN
  -- Dr gross 80,000; Cr net 67,400, TDS 3,000, EPF 9,600.
  r := public.run_monthly_payroll(v_org, v_period);
  ASSERT (r->>'success')::boolean AND r->>'entry_number' = 'PAYROLL-' || v_period, r::text;
  ASSERT pg_temp.net('5020') = 80000, 'gross salaries not expensed';
  ASSERT pg_temp.net('2091') = -67400, 'net pay not owed';
  ASSERT pg_temp.net('2092') = -3000, 'TDS not owed';
  ASSERT pg_temp.net('2093') = -9600, 'EPF not owed';
  v_entry := (r->>'journal_entry_id')::uuid;
  ASSERT (SELECT journal_entry_id FROM public.payroll_runs WHERE organisation_id = v_org AND period = v_period) = v_entry, 'run not linked to its journal';

  -- A month reaches the ledger once.
  BEGIN
    PERFORM public.run_monthly_payroll(v_org, v_period);
    RAISE EXCEPTION 'posted the same month twice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'payroll_error: payroll for%' THEN RAISE; END IF;
  END;
  ASSERT pg_temp.net('5020') = 80000, 'refused run still moved the ledger';

  -- Reversing reopens the month, under a new number.
  PERFORM public.reverse_journal_entry(v_org, v_entry, current_date, 'payroll correction');
  ASSERT pg_temp.net('5020') = 0 OR pg_temp.net('5020') IS NULL OR pg_temp.net('5020') = 0, 'reversal did not net out';
  r := public.run_monthly_payroll(v_org, v_period);
  ASSERT r->>'entry_number' = 'PAYROLL-' || v_period || '-2', r::text;
  ASSERT (SELECT count(*) FROM public.payroll_runs WHERE organisation_id = v_org AND period = v_period) = 1, 'month has two runs';
  ASSERT pg_temp.net('5020') = 80000, 're-run after reversal is wrong';

  -- Figures that don't add up are refused rather than posted.
  UPDATE public.employees SET monthly_net = monthly_net - 1 WHERE organisation_id = v_org AND name = 'One';
  BEGIN
    PERFORM public.run_monthly_payroll(v_org, to_char(current_date - 62, 'YYYY-MM'));
    RAISE EXCEPTION 'posted figures that do not add up';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'payroll_error: gross pay%' THEN RAISE; END IF;
  END;
  UPDATE public.employees SET monthly_net = monthly_net + 1 WHERE organisation_id = v_org AND name = 'One';

  BEGIN
    PERFORM public.run_monthly_payroll(v_org, 'November');
    RAISE EXCEPTION 'accepted a bad period';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'payroll_error: the period%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.run_monthly_payroll(v_org, to_char(current_date + 70, 'YYYY-MM'));
    RAISE EXCEPTION 'ran payroll for a future month';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'payroll_error: that month%' THEN RAISE; END IF;
  END;

  -- With approvals on, a run waits for a checker instead of reaching the ledger.
  UPDATE public.organisations SET require_journal_approval = true WHERE id = v_org;
  r := public.run_monthly_payroll(v_org, to_char(current_date - 62, 'YYYY-MM'));
  ASSERT (r->>'submitted_for_approval')::boolean, r::text;
  ASSERT pg_temp.net('5020') = 80000, 'a run awaiting approval moved the ledger';
END $$;

ROLLBACK;
\echo payroll_posting_test passed
