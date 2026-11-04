-- Migration 45: unposted vouchers don't reach the Trial Balance or account balances.
BEGIN;

DO $$
DECLARE
  v_org uuid := 'd0000000-0000-4000-8000-000000000001';
  v_period uuid;
  v_entry uuid;
  v_dr uuid;
  v_cr uuid;
  v_status text;
  v_tb_before numeric;
  v_bal_before numeric;
  v_n numeric;
BEGIN
  SELECT id INTO v_period FROM public.fiscal_periods WHERE organisation_id = v_org LIMIT 1;
  SELECT id INTO v_dr FROM public.accounts WHERE organisation_id = v_org AND code = '5090';
  SELECT id INTO v_cr FROM public.accounts WHERE organisation_id = v_org AND code = '1020';
  IF v_period IS NULL OR v_dr IS NULL OR v_cr IS NULL THEN
    RAISE EXCEPTION 'seed org is missing its fiscal period or accounts';
  END IF;

  SELECT sum(total_debit) INTO v_tb_before FROM public.view_trial_balance WHERE organisation_id = v_org;
  SELECT sum(total_debit) INTO v_bal_before FROM public.view_account_balances WHERE organisation_id = v_org;

  -- Deliberately unbalanced, as an unposted draft may be.
  INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration)
  VALUES (v_org, v_period, 'VIEWTEST/1', current_date, 'draft', 'report view test')
  RETURNING id INTO v_entry;
  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
  VALUES (v_org, v_entry, 1, v_dr, 777, 0), (v_org, v_entry, 2, v_cr, 0, 111);

  SELECT sum(total_debit) INTO v_n FROM public.view_trial_balance WHERE organisation_id = v_org;
  IF v_n IS DISTINCT FROM v_tb_before THEN
    RAISE EXCEPTION 'draft reached view_trial_balance: % then %', v_tb_before, v_n;
  END IF;
  SELECT sum(total_debit) INTO v_n FROM public.view_account_balances WHERE organisation_id = v_org;
  IF v_n IS DISTINCT FROM v_bal_before THEN
    RAISE EXCEPTION 'draft reached view_account_balances: % then %', v_bal_before, v_n;
  END IF;

  -- The seed's own ledger must still balance.
  SELECT sum(total_debit) - sum(total_credit) INTO v_n FROM public.view_trial_balance WHERE organisation_id = v_org;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'trial balance out by %', v_n;
  END IF;
END $$;

ROLLBACK;
\echo report_views_test passed
