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

-- Migration 46: posted vouchers move the cash, COGS, debtor and creditor figures.
DO $$
DECLARE
  v_org uuid := 'd0000000-0000-4000-8000-000000000001';
  v_period uuid;
  v_seq int := 0;
  v_cf jsonb;
  v_fpa jsonb;
  v_age jsonb;
  v_start date := date_trunc('year', current_date)::date - 366;
BEGIN
  SELECT id INTO v_period FROM public.fiscal_periods
  WHERE organisation_id = v_org AND current_date BETWEEN start_date AND end_date LIMIT 1;
  IF v_period IS NULL THEN
    INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date)
    VALUES (v_org, 'View test period', current_date - 1, current_date + 1) RETURNING id INTO v_period;
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

  -- Dr / Cr by account code, posted through the real function.
  CREATE TEMP TABLE _v (dr text, cr text, amt numeric) ON COMMIT DROP;
  INSERT INTO _v VALUES
    ('1020', '4010', 1000),  -- cash sale
    ('5010', '1020', 300),   -- cost of sales paid from bank
    ('5090', '1020', 100),   -- overhead paid from bank
    ('1030', '4010', 500),   -- credit sale
    ('5010', '2010', 200);   -- credit purchase

  DECLARE
    r record;
    v_entry uuid;
  BEGIN
    FOR r IN SELECT * FROM _v LOOP
      v_seq := v_seq + 1;
      INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration)
      VALUES (v_org, v_period, 'VIEWTEST/P' || v_seq, current_date, 'draft', 'report function test')
      RETURNING id INTO v_entry;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
      SELECT v_org, v_entry, 1, id, r.amt, 0 FROM public.accounts WHERE organisation_id = v_org AND code = r.dr;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
      SELECT v_org, v_entry, 2, id, 0, r.amt FROM public.accounts WHERE organisation_id = v_org AND code = r.cr;
      PERFORM public.post_journal_entry(v_org, v_entry);
    END LOOP;
  END;

  v_cf := public.get_cash_flow_statement(v_org, v_start, current_date);
  IF (v_cf->>'closing_cash_equivalents')::numeric <> 600 THEN
    RAISE EXCEPTION 'closing cash % , expected 600', v_cf->>'closing_cash_equivalents';
  END IF;
  IF (v_cf->'operating_activities'->>'cash_receipts_from_sales')::numeric <> 1000
     OR (v_cf->'operating_activities'->>'cash_paid_for_operations')::numeric <> 400 THEN
    RAISE EXCEPTION 'operating cash wrong: %', v_cf->'operating_activities';
  END IF;

  v_fpa := public.get_fpa_corporate_metrics(v_org, v_start, current_date);
  IF (v_fpa->'profitability'->>'cogs')::numeric <> 500 THEN
    RAISE EXCEPTION 'cogs %, expected 500', v_fpa->'profitability'->>'cogs';
  END IF;
  IF (v_fpa->'treasury_and_runway'->>'cash_and_bank_reserves')::numeric <> 600 THEN
    RAISE EXCEPTION 'cash %, expected 600', v_fpa->'treasury_and_runway'->>'cash_and_bank_reserves';
  END IF;
  -- Cash 600 + debtors 500 against creditors 200.
  IF (v_fpa->'liquidity_and_balance_sheet'->>'working_capital')::numeric <> 900 THEN
    RAISE EXCEPTION 'working capital %, expected 900', v_fpa->'liquidity_and_balance_sheet'->>'working_capital';
  END IF;

  v_age := public.get_ar_ap_aging_analysis(v_org);
  IF (v_age->'accounts_receivable'->>'total_receivable')::numeric <> 500
     OR (v_age->'accounts_payable'->>'total_payable')::numeric <> 200 THEN
    RAISE EXCEPTION 'ageing wrong: %', v_age;
  END IF;
  IF v_age->'accounts_receivable'->>'dso_days' IS NULL THEN
    RAISE EXCEPTION 'DSO is empty with credit sales on the books';
  END IF;
END $$;

ROLLBACK;
\echo report_views_test passed
