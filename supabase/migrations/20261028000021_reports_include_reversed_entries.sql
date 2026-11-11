-- Migration 21: keep reversed entries in every report
-- Deku Finance
--
-- reverse_journal_entry marks the original entry 'reversed' and posts an offsetting entry.
-- Every report filtered on status = 'posted', so the original vanished while its reversal
-- stayed: after any reversal, balances, trial balance, P&L, balance sheet, cash flow and
-- ageing were wrong by the reversed amount. A reversed entry is still part of the ledger;
-- its reversal is what cancels it.
--
-- Also: the report functions below are SECURITY DEFINER and never checked that the caller
-- belongs to p_org_id, so any signed-in user could read another company's statements,
-- cash flow, ageing, FP&A metrics and budgets by passing its id. Each now checks membership.
-- Generated from the latest definitions; nothing else differs.

-- view_general_ledger: latest definition from 20261018000011_alerx_coa_hierarchy.sql; changed: status filter
CREATE OR REPLACE VIEW public.view_general_ledger
WITH (security_invoker = true)
AS
SELECT
  l.id AS line_id,
  e.organisation_id,
  e.id AS journal_entry_id,
  e.entry_number,
  e.entry_date,
  e.reference,
  e.status,
  l.line_number,
  l.account_id,
  a.code AS account_code,
  a.account_group,
  a.ledger,
  a.sub_ledger,
  a.label,
  a.name AS account_name,
  a.type AS account_type,
  -- Unit: State change delta for this line (default 1)
  COALESCE(l.unit_delta, 1) AS unit_delta,
  l.party_id,
  p.legal_name AS party_name,
  l.description,
  l.debit,
  l.credit,
  e.fiscal_period_id,
  fp.name AS fiscal_period_name
FROM public.journal_entry_lines l
JOIN public.journal_entries e ON l.journal_entry_id = e.id
JOIN public.accounts a ON l.account_id = a.id
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
LEFT JOIN public.parties p ON l.party_id = p.id
WHERE e.status IN ('posted', 'reversed');

-- view_account_balances: latest definition from 20261018000011_alerx_coa_hierarchy.sql; changed: status filter
CREATE OR REPLACE VIEW public.view_account_balances
WITH (security_invoker = true)
AS
SELECT
  a.organisation_id,
  a.id AS account_id,
  a.code AS account_code,
  a.account_group,
  a.ledger,
  a.sub_ledger,
  a.label,
  a.name AS account_name,
  a.type AS account_type,
  a.is_active,
  a.is_postable,
  -- UNIT: Highlights the change of state (e.g. 1 if owner added capital once)
  COUNT(l.id) FILTER (WHERE l.id IS NOT NULL)::integer AS units,
  COUNT(l.id) FILTER (WHERE l.id IS NOT NULL)::integer AS state_changes,
  -- VALUE: The monetary value in currency (positive / negative / net)
  COALESCE(SUM(l.debit), 0.00) AS total_debit,
  COALESCE(SUM(l.credit), 0.00) AS total_credit,
  CASE
    WHEN a.account_group IN ('asset', 'expense') THEN
      COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    WHEN a.account_group IN ('liability', 'equity', 'revenue') THEN
      COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    ELSE 0.00
  END AS value,
  CASE
    WHEN a.account_group IN ('asset', 'expense') THEN
      COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    WHEN a.account_group IN ('liability', 'equity', 'revenue') THEN
      COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    ELSE 0.00
  END AS natural_balance
FROM public.accounts a
LEFT JOIN public.journal_entry_lines l ON a.id = l.account_id
LEFT JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status IN ('posted', 'reversed')
GROUP BY 
  a.organisation_id, a.id, a.code, a.account_group, a.ledger, a.sub_ledger, a.label, 
  a.name, a.type, a.is_active, a.is_postable;

-- view_profit_and_loss: latest definition from 20261018000011_alerx_coa_hierarchy.sql; changed: status filter
CREATE OR REPLACE VIEW public.view_profit_and_loss
WITH (security_invoker = true)
AS
SELECT
  a.organisation_id,
  e.fiscal_period_id,
  fp.name AS fiscal_period_name,
  a.id AS account_id,
  a.code AS account_code,
  a.account_group,
  a.ledger,
  a.sub_ledger,
  a.label,
  a.name AS account_name,
  a.type AS account_type,
  -- Number of state changes recorded
  COUNT(l.id)::integer AS units,
  COALESCE(SUM(l.debit), 0.00) AS total_debit,
  COALESCE(SUM(l.credit), 0.00) AS total_credit,
  -- Monetary Value
  CASE
    WHEN a.account_group = 'revenue' OR a.type = 'income' THEN COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    WHEN a.account_group = 'expense' OR a.type = 'expense' THEN COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    ELSE 0.00
  END AS value,
  CASE
    WHEN a.account_group = 'revenue' OR a.type = 'income' THEN COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    WHEN a.account_group = 'expense' OR a.type = 'expense' THEN COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    ELSE 0.00
  END AS net_amount
FROM public.accounts a
JOIN public.journal_entry_lines l ON a.id = l.account_id
JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status IN ('posted', 'reversed')
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
WHERE a.account_group IN ('revenue', 'expense') OR a.type IN ('income', 'expense')
GROUP BY 
  a.organisation_id, e.fiscal_period_id, fp.name, a.id, a.code, a.account_group, 
  a.ledger, a.sub_ledger, a.label, a.name, a.type;

-- view_balance_sheet: latest definition from 20261018000011_alerx_coa_hierarchy.sql; changed: status filter
CREATE OR REPLACE VIEW public.view_balance_sheet
WITH (security_invoker = true)
AS
SELECT
  a.organisation_id,
  e.fiscal_period_id,
  fp.name AS fiscal_period_name,
  a.id AS account_id,
  a.code AS account_code,
  a.account_group,
  a.ledger,
  a.sub_ledger,
  a.label,
  a.name AS account_name,
  a.type AS account_type,
  -- Number of state changes recorded
  COUNT(l.id)::integer AS units,
  COALESCE(SUM(l.debit), 0.00) AS total_debit,
  COALESCE(SUM(l.credit), 0.00) AS total_credit,
  -- Monetary Value
  CASE
    WHEN a.account_group = 'asset' OR a.type = 'asset' THEN COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    WHEN a.account_group IN ('liability', 'equity') OR a.type IN ('liability', 'equity') THEN COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    ELSE 0.00
  END AS value,
  CASE
    WHEN a.account_group = 'asset' OR a.type = 'asset' THEN COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    WHEN a.account_group IN ('liability', 'equity') OR a.type IN ('liability', 'equity') THEN COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    ELSE 0.00
  END AS balance
FROM public.accounts a
JOIN public.journal_entry_lines l ON a.id = l.account_id
JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status IN ('posted', 'reversed')
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
WHERE a.account_group IN ('asset', 'liability', 'equity') OR a.type IN ('asset', 'liability', 'equity')
GROUP BY 
  a.organisation_id, e.fiscal_period_id, fp.name, a.id, a.code, a.account_group, 
  a.ledger, a.sub_ledger, a.label, a.name, a.type;

-- view_trial_balance: latest definition from 20261018000017_universal_financial_rollup_wcm_fpa.sql; changed: status filter
CREATE OR REPLACE VIEW public.view_trial_balance
WITH (security_invoker = true)
AS
SELECT
  a.organisation_id,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(l.debit), 0.00) AS total_debit,
  COALESCE(SUM(l.credit), 0.00) AS total_credit,
  CASE
    WHEN a.type IN ('asset', 'expense') THEN
      GREATEST(0.00, COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00))
    ELSE 0.00
  END AS closing_debit,
  CASE
    WHEN a.type IN ('liability', 'equity', 'income') THEN
      GREATEST(0.00, COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00))
    ELSE 0.00
  END AS closing_credit
FROM public.accounts a
LEFT JOIN public.journal_entry_lines l ON a.id = l.account_id
LEFT JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status IN ('posted', 'reversed')
GROUP BY a.organisation_id, a.id, a.code, a.name, a.type;

-- get_account_statement: latest definition from 20261018000017_universal_financial_rollup_wcm_fpa.sql; changed: status filter + membership check
CREATE OR REPLACE FUNCTION public.get_account_statement(
  p_org_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT '2026-04-01',
  p_end_date date DEFAULT '2027-03-31'
)
RETURNS TABLE (
  line_id uuid,
  entry_id uuid,
  entry_number text,
  entry_date date,
  voucher_type text,
  reference text,
  party_name text,
  narration text,
  debit numeric,
  credit numeric,
  running_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acct_type text;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;
  SELECT type INTO v_acct_type FROM public.accounts WHERE id = p_account_id AND organisation_id = p_org_id;

  RETURN QUERY
  WITH lines AS (
    SELECT
      l.id AS l_id,
      e.id AS e_id,
      e.entry_number AS e_num,
      e.entry_date AS e_date,
      COALESCE(e.reference, 'Journal') AS v_type,
      e.reference AS e_ref,
      p.legal_name AS p_name,
      COALESCE(l.description, e.narration) AS l_narr,
      COALESCE(l.debit, 0.00) AS l_deb,
      COALESCE(l.credit, 0.00) AS l_cred,
      l.created_at AS l_created
    FROM public.journal_entry_lines l
    JOIN public.journal_entries e ON l.journal_entry_id = e.id
    LEFT JOIN public.parties p ON l.party_id = p.id
    WHERE l.organisation_id = p_org_id
      AND l.account_id = p_account_id
      AND e.status IN ('posted', 'reversed')
      AND e.entry_date BETWEEN p_start_date AND p_end_date
  )
  SELECT
    l_id,
    e_id,
    e_num,
    e_date,
    v_type,
    e_ref,
    p_name,
    l_narr,
    l_deb,
    l_cred,
    CASE 
      WHEN v_acct_type IN ('asset', 'expense') THEN
        SUM(l_deb - l_cred) OVER (ORDER BY e_date ASC, l_created ASC)
      ELSE
        SUM(l_cred - l_deb) OVER (ORDER BY e_date ASC, l_created ASC)
    END AS running_balance
  FROM lines
  ORDER BY e_date ASC, l_created ASC;
END;
$$;

-- get_cash_flow_statement: latest definition from 20261018000017_universal_financial_rollup_wcm_fpa.sql; changed: status filter + membership check
CREATE OR REPLACE FUNCTION public.get_cash_flow_statement(
  p_org_id uuid,
  p_start_date date DEFAULT '2026-04-01',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operating_inflows numeric(15, 2) := 0.00;
  v_operating_outflows numeric(15, 2) := 0.00;
  v_investing_cash numeric(15, 2) := 0.00;
  v_financing_cash numeric(15, 2) := 0.00;
  v_opening_cash numeric(15, 2) := 0.00;
  v_closing_cash numeric(15, 2) := 0.00;
  v_net_operating numeric(15, 2) := 0.00;
  v_net_cash_flow numeric(15, 2) := 0.00;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;
  -- 1. Calculate opening cash & bank balance before p_start_date
  SELECT COALESCE(SUM(l.debit - l.credit), 0.00)
  INTO v_opening_cash
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.code IN ('1110', '1120', '1130') -- Cash on Hand, Bank Accounts, Liquid Equivalents
    AND e.status IN ('posted', 'reversed')
    AND e.entry_date < p_start_date;

  -- 2. Operating Inflows: Revenue / Customer collections during period
  SELECT COALESCE(SUM(l.credit), 0.00)
  INTO v_operating_inflows
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.type = 'income'
    AND e.status IN ('posted', 'reversed')
    AND e.entry_date BETWEEN p_start_date AND p_end_date;

  -- 3. Operating Outflows: Expenses / Operational payouts during period
  SELECT COALESCE(SUM(l.debit), 0.00)
  INTO v_operating_outflows
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.type = 'expense'
    AND a.code NOT LIKE '15%' -- Exclude capex depreciation
    AND e.status IN ('posted', 'reversed')
    AND e.entry_date BETWEEN p_start_date AND p_end_date;

  -- 4. Investing Outflows/Inflows (Fixed Assets Capex: codes 1400-1599)
  SELECT COALESCE(SUM(l.credit - l.debit), 0.00)
  INTO v_investing_cash
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.code BETWEEN '1400' AND '1599'
    AND e.status IN ('posted', 'reversed')
    AND e.entry_date BETWEEN p_start_date AND p_end_date;

  -- 5. Financing Cash Flow (Equity & Loans: codes 2500-2999 and 3000-3999)
  SELECT COALESCE(SUM(l.credit - l.debit), 0.00)
  INTO v_financing_cash
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND (a.code BETWEEN '2500' AND '2999' OR a.type = 'equity')
    AND e.status IN ('posted', 'reversed')
    AND e.entry_date BETWEEN p_start_date AND p_end_date;

  v_net_operating := v_operating_inflows - v_operating_outflows;
  v_net_cash_flow := v_net_operating + v_investing_cash + v_financing_cash;
  v_closing_cash := v_opening_cash + v_net_cash_flow;

  RETURN jsonb_build_object(
    'organisation_id', p_org_id,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'opening_cash_equivalents', v_opening_cash,
    'operating_activities', jsonb_build_object(
      'cash_receipts_from_sales', v_operating_inflows,
      'cash_paid_for_operations', v_operating_outflows,
      'net_cash_from_operating_activities', v_net_operating
    ),
    'investing_activities', jsonb_build_object(
      'capital_expenditures_and_fixed_assets', v_investing_cash,
      'net_cash_used_in_investing', v_investing_cash
    ),
    'financing_activities', jsonb_build_object(
      'equity_and_debt_financing', v_financing_cash,
      'net_cash_from_financing', v_financing_cash
    ),
    'net_change_in_cash', v_net_cash_flow,
    'closing_cash_equivalents', v_closing_cash
  );
END;
$$;

-- get_ar_ap_aging_analysis: latest definition from 20261018000017_universal_financial_rollup_wcm_fpa.sql; changed: status filter + membership check
CREATE OR REPLACE FUNCTION public.get_ar_ap_aging_analysis(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Receivables (Debtors)
  v_ar_total numeric(15, 2) := 0.00;
  v_ar_current numeric(15, 2) := 0.00;    -- 0-30 days
  v_ar_31_60 numeric(15, 2) := 0.00;     -- 31-60 days
  v_ar_61_90 numeric(15, 2) := 0.00;     -- 61-90 days
  v_ar_over_90 numeric(15, 2) := 0.00;   -- 90+ days
  v_dso_days numeric(6, 1) := 0.0;

  -- Payables (Creditors)
  v_ap_total numeric(15, 2) := 0.00;
  v_ap_current numeric(15, 2) := 0.00;    -- 0-30 days
  v_ap_31_60 numeric(15, 2) := 0.00;     -- 31-60 days
  v_ap_61_90 numeric(15, 2) := 0.00;     -- 61-90 days
  v_ap_over_90 numeric(15, 2) := 0.00;   -- 90+ days
  v_dpo_days numeric(6, 1) := 0.0;

  -- Turnover bases
  v_total_credit_sales numeric(15, 2) := 0.00;
  v_total_credit_purchases numeric(15, 2) := 0.00;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;
  -- 1. AR: Group unpaid sales invoices into aging buckets
  SELECT
    COALESCE(SUM(total_amount - balance_due), 0.00),
    COALESCE(SUM(CASE WHEN (CURRENT_DATE - invoice_date) <= 30 THEN balance_due ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN (CURRENT_DATE - invoice_date) BETWEEN 31 AND 60 THEN balance_due ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN (CURRENT_DATE - invoice_date) BETWEEN 61 AND 90 THEN balance_due ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN (CURRENT_DATE - invoice_date) > 90 THEN balance_due ELSE 0 END), 0.00)
  INTO
    v_total_credit_sales,
    v_ar_current,
    v_ar_31_60,
    v_ar_61_90,
    v_ar_over_90
  FROM public.sales_invoices
  WHERE organisation_id = p_org_id AND status NOT IN ('draft', 'cancelled');

  v_ar_total := v_ar_current + v_ar_31_60 + v_ar_61_90 + v_ar_over_90;

  -- DSO = (Accounts Receivable / Total Credit Sales) * 365
  IF v_total_credit_sales > 0 THEN
    v_dso_days := ROUND(((v_ar_total / v_total_credit_sales) * 365.0), 1);
  ELSE
    v_dso_days := 30.0; -- Standard benchmark default
  END IF;

  -- 2. AP: Payables from Creditors ledger account 2110
  SELECT COALESCE(SUM(l.credit - l.debit), 0.00)
  INTO v_ap_total
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.code = '2110' -- Sundry Creditors
    AND e.status IN ('posted', 'reversed');

  -- Distribute payables into standard aging distribution
  v_ap_current := ROUND(v_ap_total * 0.55, 2);
  v_ap_31_60  := ROUND(v_ap_total * 0.25, 2);
  v_ap_61_90  := ROUND(v_ap_total * 0.12, 2);
  v_ap_over_90 := v_ap_total - (v_ap_current + v_ap_31_60 + v_ap_61_90);

  -- DPO Benchmark estimation
  v_dpo_days := 42.0;

  RETURN jsonb_build_object(
    'organisation_id', p_org_id,
    'accounts_receivable', jsonb_build_object(
      'total_receivable', v_ar_total,
      'dso_days', v_dso_days,
      'buckets', jsonb_build_object(
        'current_0_30_days', v_ar_current,
        'aging_31_60_days', v_ar_31_60,
        'aging_61_90_days', v_ar_61_90,
        'over_90_days_overdue', v_ar_over_90
      )
    ),
    'accounts_payable', jsonb_build_object(
      'total_payable', v_ap_total,
      'dpo_days', v_dpo_days,
      'buckets', jsonb_build_object(
        'current_0_30_days', v_ap_current,
        'aging_31_60_days', v_ap_31_60,
        'aging_61_90_days', v_ap_61_90,
        'over_90_days_overdue', v_ap_over_90
      )
    ),
    'working_capital_gap', (v_ar_total - v_ap_total)
  );
END;
$$;

-- get_fpa_corporate_metrics: latest definition from 20261018000017_universal_financial_rollup_wcm_fpa.sql; changed: status filter + membership check
CREATE OR REPLACE FUNCTION public.get_fpa_corporate_metrics(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue numeric(15, 2) := 0.00;
  v_cogs numeric(15, 2) := 0.00;
  v_gross_profit numeric(15, 2) := 0.00;
  v_gross_margin_pct numeric(5, 2) := 0.00;
  v_opex numeric(15, 2) := 0.00;
  v_net_profit numeric(15, 2) := 0.00;
  v_net_margin_pct numeric(5, 2) := 0.00;

  v_current_assets numeric(15, 2) := 0.00;
  v_current_liabilities numeric(15, 2) := 0.00;
  v_cash_and_bank numeric(15, 2) := 0.00;
  v_working_capital numeric(15, 2) := 0.00;
  v_current_ratio numeric(6, 2) := 0.00;
  v_quick_ratio numeric(6, 2) := 0.00;

  v_monthly_burn_rate numeric(15, 2) := 0.00;
  v_cash_runway_months numeric(5, 1) := 0.0;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;
  -- 1. Revenue
  SELECT COALESCE(SUM(l.credit - l.debit), 0.00)
  INTO v_revenue
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.type = 'income'
    AND e.status IN ('posted', 'reversed');

  -- 2. COGS (Direct operational costs: 5100-5199)
  SELECT COALESCE(SUM(l.debit - l.credit), 0.00)
  INTO v_cogs
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.code BETWEEN '5100' AND '5199'
    AND e.status IN ('posted', 'reversed');

  v_gross_profit := v_revenue - v_cogs;
  IF v_revenue > 0 THEN
    v_gross_margin_pct := ROUND(((v_gross_profit / v_revenue) * 100.0), 2);
  END IF;

  -- 3. OPEX (Indirect expenses: 5200-5999)
  SELECT COALESCE(SUM(l.debit - l.credit), 0.00)
  INTO v_opex
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.type = 'expense'
    AND a.code >= '5200'
    AND e.status IN ('posted', 'reversed');

  v_net_profit := v_gross_profit - v_opex;
  IF v_revenue > 0 THEN
    v_net_margin_pct := ROUND(((v_net_profit / v_revenue) * 100.0), 2);
  END IF;

  -- 4. Current Assets (1100-1399: Cash, Bank, Debtors, GST Input)
  SELECT COALESCE(SUM(l.debit - l.credit), 0.00)
  INTO v_current_assets
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.code BETWEEN '1100' AND '1399'
    AND e.status IN ('posted', 'reversed');

  -- Cash & Bank (1110, 1120, 1130)
  SELECT COALESCE(SUM(l.debit - l.credit), 0.00)
  INTO v_cash_and_bank
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.code IN ('1110', '1120', '1130')
    AND e.status IN ('posted', 'reversed');

  -- 5. Current Liabilities (2100-2499: Creditors, Duties & Taxes, Salary Payable)
  SELECT COALESCE(SUM(l.credit - l.debit), 0.00)
  INTO v_current_liabilities
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id
  JOIN public.accounts a ON l.account_id = a.id
  WHERE l.organisation_id = p_org_id
    AND a.code BETWEEN '2100' AND '2499'
    AND e.status IN ('posted', 'reversed');

  v_working_capital := v_current_assets - v_current_liabilities;

  IF v_current_liabilities > 0 THEN
    v_current_ratio := ROUND((v_current_assets / v_current_liabilities), 2);
    v_quick_ratio := ROUND((v_cash_and_bank / v_current_liabilities), 2);
  ELSE
    v_current_ratio := 2.50;
    v_quick_ratio := 1.80;
  END IF;

  -- 6. Burn Rate & Runway Calculation
  v_monthly_burn_rate := GREATEST(1.00, ROUND(v_opex / 6.0, 2)); -- 6-month trailing average estimation
  IF v_cash_and_bank > 0 AND v_monthly_burn_rate > 0 THEN
    v_cash_runway_months := ROUND((v_cash_and_bank / v_monthly_burn_rate), 1);
  ELSE
    v_cash_runway_months := 12.0;
  END IF;

  RETURN jsonb_build_object(
    'organisation_id', p_org_id,
    'profitability', jsonb_build_object(
      'total_revenue', v_revenue,
      'cogs', v_cogs,
      'gross_profit', v_gross_profit,
      'gross_margin_pct', v_gross_margin_pct,
      'opex', v_opex,
      'net_profit', v_net_profit,
      'net_margin_pct', v_net_margin_pct
    ),
    'liquidity_and_balance_sheet', jsonb_build_object(
      'current_assets', v_current_assets,
      'current_liabilities', v_current_liabilities,
      'working_capital', v_working_capital,
      'current_ratio', v_current_ratio,
      'quick_ratio', v_quick_ratio
    ),
    'treasury_and_runway', jsonb_build_object(
      'cash_and_bank_reserves', v_cash_and_bank,
      'estimated_monthly_burn', v_monthly_burn_rate,
      'cash_runway_months', v_cash_runway_months
    )
  );
END;
$$;

-- get_departmental_budget_variance: latest definition from 20261018000017_universal_financial_rollup_wcm_fpa.sql; changed: membership check
CREATE OR REPLACE FUNCTION public.get_departmental_budget_variance(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_departments jsonb;
  v_total_allocated numeric(15, 2) := 0.00;
  v_total_utilized numeric(15, 2) := 0.00;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;
  SELECT 
    COALESCE(SUM(budget_allocated), 0.00),
    COALESCE(SUM(budget_utilized), 0.00)
  INTO v_total_allocated, v_total_utilized
  FROM public.departments
  WHERE organisation_id = p_org_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'code', d.code,
      'budget_allocated', d.budget_allocated,
      'budget_utilized', d.budget_utilized,
      'budget_remaining', (d.budget_allocated - d.budget_utilized),
      'burn_percentage', CASE 
        WHEN d.budget_allocated > 0 THEN ROUND(((d.budget_utilized / d.budget_allocated) * 100.0), 1)
        ELSE 0.0
      END,
      'headcount', (SELECT COUNT(*) FROM public.employees e WHERE e.department_id = d.id AND e.status = 'active')
    )
  )
  INTO v_departments
  FROM public.departments d
  WHERE d.organisation_id = p_org_id;

  RETURN jsonb_build_object(
    'organisation_id', p_org_id,
    'total_budget_allocated', v_total_allocated,
    'total_budget_utilized', v_total_utilized,
    'total_budget_remaining', (v_total_allocated - v_total_utilized),
    'overall_burn_pct', CASE WHEN v_total_allocated > 0 THEN ROUND(((v_total_utilized / v_total_allocated) * 100.0), 1) ELSE 0.0 END,
    'departments', COALESCE(v_departments, '[]'::jsonb)
  );
END;
$$;
