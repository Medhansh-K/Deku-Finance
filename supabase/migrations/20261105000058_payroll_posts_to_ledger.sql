-- Deku Finance - a payroll run posts its journal, so salaries reach the P&L and the amounts owed show as liabilities.
--   Dr 5020 Staff salaries (gross)
--   Cr 2091 Salaries Payable (net), Cr 2092 TDS on Salaries Payable, Cr 2093 EPF Payable
-- Paying staff or the government is then an ordinary payment voucher against these accounts.
-- Employer contributions aren't recorded anywhere yet, so they aren't posted either.

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

-- Not in the default chart, so a company that never runs payroll doesn't carry them.
CREATE OR REPLACE FUNCTION public._payroll_liability_account(
  p_org_id uuid, p_code text, p_name text, p_ledger text, p_sub_ledger text, p_label text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.accounts WHERE organisation_id = p_org_id AND code = p_code;
  IF v_id IS NULL THEN
    INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system)
    VALUES (p_org_id, p_code, p_name, 'liability', 'liability', p_ledger, p_sub_ledger, p_label, true, true)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._payroll_liability_account(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_monthly_payroll(
  p_org_id uuid,
  p_period text,
  p_executed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_gross numeric(15, 2) := 0;
  v_net numeric(15, 2) := 0;
  v_tds numeric(15, 2) := 0;
  v_epf numeric(15, 2) := 0;
  v_run_id uuid;
  v_month_start date;
  v_entry_date date;
  v_fiscal_id uuid;
  v_previous public.journal_entries;
  v_number text;
  v_attempt int;
  v_expense uuid;
  v_entry public.journal_entries;
  v_line int := 1;
  v_executed_by uuid;
BEGIN
  IF NOT (public.is_superadmin() OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[])) THEN
    RAISE EXCEPTION 'Permission denied: only the owner, CFO or admin can run payroll';
  END IF;

  IF p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'payroll_error: the period must look like 2026-11';
  END IF;
  v_month_start := (p_period || '-01')::date;
  IF v_month_start > current_date THEN
    RAISE EXCEPTION 'payroll_error: that month hasn''t started yet';
  END IF;
  -- Mid-month runs are dated today, or reports up to today would leave the salaries out.
  v_entry_date := least((v_month_start + interval '1 month - 1 day')::date, current_date);

  -- A month reaches the ledger once. Reversing its journal, or a checker sending it back, reopens it.
  SELECT e.* INTO v_previous
  FROM public.payroll_runs r
  JOIN public.journal_entries e ON e.id = r.journal_entry_id
  WHERE r.organisation_id = p_org_id AND r.period = p_period
  FOR UPDATE OF r;
  IF FOUND AND v_previous.status <> 'reversed' AND v_previous.rejected_at IS NULL THEN
    RAISE EXCEPTION 'payroll_error: payroll for % is already in the ledger as %. Reverse that voucher to run it again', p_period, v_previous.entry_number;
  END IF;

  SELECT count(*), coalesce(sum(monthly_gross), 0), coalesce(sum(monthly_net), 0),
         coalesce(sum(tds_deduction_monthly), 0), coalesce(sum(epf_monthly), 0)
  INTO v_count, v_gross, v_net, v_tds, v_epf
  FROM public.employees
  WHERE organisation_id = p_org_id AND status = 'active';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active employees found in organisation');
  END IF;

  -- Posting a figure that doesn't add up would hide the mistake in a liability account.
  IF v_gross <> v_net + v_tds + v_epf THEN
    RAISE EXCEPTION 'payroll_error: gross pay of % doesn''t equal net pay, TDS and EPF of %. Correct the salary details first', v_gross, v_net + v_tds + v_epf;
  END IF;

  IF v_gross > 0 THEN
    SELECT id INTO v_fiscal_id FROM public.fiscal_periods
    WHERE organisation_id = p_org_id AND status = 'open' AND v_entry_date BETWEEN start_date AND end_date
    LIMIT 1;
    IF v_fiscal_id IS NULL THEN
      RAISE EXCEPTION 'payroll_error: no open fiscal period covers %. Add or reopen one in Settings', v_entry_date;
    END IF;

    SELECT id INTO v_expense FROM public.accounts
    WHERE organisation_id = p_org_id AND code = '5020' AND is_postable AND is_active;
    IF v_expense IS NULL THEN
      RAISE EXCEPTION 'payroll_error: the salaries expense account 5020 is missing from the chart of accounts';
    END IF;

    -- Earlier journals for this month stay on the record, so the number moves on.
    SELECT count(*) + 1 INTO v_attempt FROM public.journal_entries
    WHERE organisation_id = p_org_id AND left(entry_number, length('PAYROLL-' || p_period)) = 'PAYROLL-' || p_period;
    v_number := 'PAYROLL-' || p_period || CASE WHEN v_attempt > 1 THEN '-' || v_attempt ELSE '' END;

    INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, created_by)
    VALUES (p_org_id, v_fiscal_id, v_number, v_entry_date, 'draft', 'Payroll for ' || p_period, auth.uid())
    RETURNING * INTO v_entry;

    INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
    VALUES (p_org_id, v_entry.id, 1, v_expense, 'Gross salaries ' || p_period, v_gross, 0);
    IF v_net > 0 THEN
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (p_org_id, v_entry.id, v_line,
        public._payroll_liability_account(p_org_id, '2091', 'Salaries Payable', 'Current Liabilities & Payables', 'Payroll Payable', 'Net Salaries Payable'),
        'Net salaries ' || p_period, 0, v_net);
    END IF;
    IF v_tds > 0 THEN
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (p_org_id, v_entry.id, v_line,
        public._payroll_liability_account(p_org_id, '2092', 'TDS on Salaries Payable', 'Statutory & Tax Liabilities', 'TDS Payable', 'TDS on Salaries'),
        'TDS ' || p_period, 0, v_tds);
    END IF;
    IF v_epf > 0 THEN
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (p_org_id, v_entry.id, v_line,
        public._payroll_liability_account(p_org_id, '2093', 'EPF Payable', 'Statutory & Tax Liabilities', 'EPF Payable', 'Employee Provident Fund Payable'),
        'EPF ' || p_period, 0, v_epf);
    END IF;

    IF (SELECT require_journal_approval FROM public.organisations WHERE id = p_org_id) THEN
      v_entry := public.submit_journal_for_approval(p_org_id, v_entry.id);
    ELSE
      v_entry := public.post_journal_entry(p_org_id, v_entry.id);
    END IF;
  END IF;

  UPDATE public.employees
  SET payroll_status = 'processed', last_payroll_date = CURRENT_DATE::text, updated_at = now()
  WHERE organisation_id = p_org_id AND status = 'active';

  SELECT coalesce(p_executed_by, (SELECT id FROM public.employees WHERE organisation_id = p_org_id AND user_id = auth.uid() LIMIT 1))
  INTO v_executed_by;

  INSERT INTO public.payroll_runs (organisation_id, period, total_gross, total_net_disbursed, total_tds, total_epf, headcount, executed_by, executed_at, status, journal_entry_id)
  VALUES (p_org_id, p_period, v_gross, v_net, v_tds, v_epf, v_count, v_executed_by, now(), 'processed', v_entry.id)
  ON CONFLICT (organisation_id, period) DO UPDATE
  SET total_gross = EXCLUDED.total_gross,
      total_net_disbursed = EXCLUDED.total_net_disbursed,
      total_tds = EXCLUDED.total_tds,
      total_epf = EXCLUDED.total_epf,
      headcount = EXCLUDED.headcount,
      executed_by = EXCLUDED.executed_by,
      executed_at = now(),
      journal_entry_id = EXCLUDED.journal_entry_id
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'payroll_run_id', v_run_id,
    'period', p_period,
    'headcount', v_count,
    'total_gross', v_gross,
    'total_net_disbursed', v_net,
    'total_tds', v_tds,
    'total_epf', v_epf,
    'journal_entry_id', v_entry.id,
    'entry_number', v_entry.entry_number,
    'journal_status', v_entry.status,
    'submitted_for_approval', v_entry.submitted_at IS NOT NULL
  );
END;
$$;
