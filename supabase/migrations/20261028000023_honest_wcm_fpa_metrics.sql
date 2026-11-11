-- Migration 23: working-capital and FP&A metrics computed from the ledger only
-- Deku Finance
--
-- The previous versions (migration 17, re-created in 21) could not be trusted:
--   get_ar_ap_aging_analysis read sales_invoices.balance_due, a column that does not exist,
--     so every call failed; payables came from account code 2110, which the chart doesn't have;
--     payable ageing was a fixed 55/25/12/8 split; DPO was hard-coded to 42 and DSO to 30.
--   get_fpa_corporate_metrics used code ranges that don't match the chart (cash 1110-1130,
--     COGS 5100-5199), fell back to a 2.50 current ratio, 1.80 quick ratio and 12 months of
--     runway, ignored the date range the backend sends, and divided all-time opex by 6.
-- Rule now: a figure the books can't support is returned as null (the UI shows "–").
-- Accounts are classified by the ALERX hierarchy labels seeded in migration 11.

DROP FUNCTION IF EXISTS public.get_ar_ap_aging_analysis(uuid);
DROP FUNCTION IF EXISTS public.get_fpa_corporate_metrics(uuid);

CREATE FUNCTION public.get_ar_ap_aging_analysis(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ar numeric(15, 2);
  v_ap numeric(15, 2);
  v_credit_sales numeric(15, 2);
  v_credit_purchases numeric(15, 2);
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;

  SELECT
    coalesce(sum(l.debit - l.credit) FILTER (WHERE a.ledger = 'Trade Debtors'), 0),
    coalesce(sum(l.credit - l.debit) FILTER (WHERE a.ledger = 'Trade Creditors'), 0),
    -- Sales/purchases on credit over the last 365 days = movements into debtors/creditors.
    coalesce(sum(l.debit) FILTER (WHERE a.ledger = 'Trade Debtors' AND e.entry_date > current_date - 365), 0),
    coalesce(sum(l.credit) FILTER (WHERE a.ledger = 'Trade Creditors' AND e.entry_date > current_date - 365), 0)
  INTO v_ar, v_ap, v_credit_sales, v_credit_purchases
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  JOIN public.accounts a ON a.id = l.account_id
  WHERE l.organisation_id = p_org_id
    AND e.status IN ('posted', 'reversed');

  -- Bucket ageing needs bill-by-bill settlement, which only the debtor/creditor screens compute.
  RETURN jsonb_build_object(
    'organisation_id', p_org_id,
    'accounts_receivable', jsonb_build_object(
      'total_receivable', v_ar,
      'dso_days', CASE WHEN v_credit_sales > 0 THEN round(v_ar / v_credit_sales * 365, 1) END,
      'buckets', jsonb_build_object(
        'current_0_30_days', NULL, 'aging_31_60_days', NULL, 'aging_61_90_days', NULL, 'over_90_days_overdue', NULL)
    ),
    'accounts_payable', jsonb_build_object(
      'total_payable', v_ap,
      'dpo_days', CASE WHEN v_credit_purchases > 0 THEN round(v_ap / v_credit_purchases * 365, 1) END,
      'buckets', jsonb_build_object(
        'current_0_30_days', NULL, 'aging_31_60_days', NULL, 'aging_61_90_days', NULL, 'over_90_days_overdue', NULL)
    ),
    'working_capital_gap', v_ar - v_ap
  );
END;
$$;

CREATE FUNCTION public.get_fpa_corporate_metrics(
  p_org_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end date := coalesce(p_end_date, current_date);
  v_revenue numeric(15, 2);
  v_cogs numeric(15, 2);
  v_opex numeric(15, 2);
  v_opex_6m numeric(15, 2);
  v_current_assets numeric(15, 2);
  v_current_liabilities numeric(15, 2);
  v_cash numeric(15, 2);
  v_debtors numeric(15, 2);
  v_burn numeric(15, 2);
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;

  SELECT
    -- Profit & loss: within the requested period (all time when no start date is given).
    coalesce(sum(l.credit - l.debit) FILTER (WHERE a.type = 'income' AND in_period), 0),
    coalesce(sum(l.debit - l.credit) FILTER (WHERE is_cogs AND in_period), 0),
    coalesce(sum(l.debit - l.credit) FILTER (WHERE a.type = 'expense' AND NOT is_cogs AND in_period), 0),
    coalesce(sum(l.debit - l.credit) FILTER (
      WHERE a.type = 'expense' AND NOT is_cogs AND e.entry_date > v_end - interval '6 months'), 0),
    -- Balance sheet: as at the end date.
    coalesce(sum(l.debit - l.credit) FILTER (WHERE a.type = 'asset' AND a.label IN
      ('Cash & Liquid Capital', 'Current Assets & Receivables', 'Tax Assets & Input Credits')), 0),
    coalesce(sum(l.credit - l.debit) FILTER (WHERE a.type = 'liability' AND a.label IN
      ('Current Liabilities & Payables', 'Statutory & Tax Liabilities')), 0),
    coalesce(sum(l.debit - l.credit) FILTER (WHERE a.label = 'Cash & Liquid Capital'), 0),
    coalesce(sum(l.debit - l.credit) FILTER (WHERE a.ledger = 'Trade Debtors'), 0)
  INTO v_revenue, v_cogs, v_opex, v_opex_6m, v_current_assets, v_current_liabilities, v_cash, v_debtors
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  JOIN public.accounts a ON a.id = l.account_id
  CROSS JOIN LATERAL (SELECT
    (p_start_date IS NULL OR e.entry_date >= p_start_date) AND e.entry_date <= v_end AS in_period,
    a.label = 'Cost of Sales / Direct Delivery' AS is_cogs
  ) c
  WHERE l.organisation_id = p_org_id
    AND e.status IN ('posted', 'reversed')
    AND e.entry_date <= v_end;

  v_burn := CASE WHEN v_opex_6m > 0 THEN round(v_opex_6m / 6, 2) END;

  RETURN jsonb_build_object(
    'organisation_id', p_org_id,
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', v_end),
    'profitability', jsonb_build_object(
      'total_revenue', v_revenue,
      'cogs', v_cogs,
      'gross_profit', v_revenue - v_cogs,
      'gross_margin_pct', CASE WHEN v_revenue > 0 THEN round((v_revenue - v_cogs) / v_revenue * 100, 2) END,
      'opex', v_opex,
      'net_profit', v_revenue - v_cogs - v_opex,
      'net_margin_pct', CASE WHEN v_revenue > 0 THEN round((v_revenue - v_cogs - v_opex) / v_revenue * 100, 2) END
    ),
    'liquidity_and_balance_sheet', jsonb_build_object(
      'current_assets', v_current_assets,
      'current_liabilities', v_current_liabilities,
      'working_capital', v_current_assets - v_current_liabilities,
      'current_ratio', CASE WHEN v_current_liabilities > 0 THEN round(v_current_assets / v_current_liabilities, 2) END,
      -- Acid test: cash and receivables only.
      'quick_ratio', CASE WHEN v_current_liabilities > 0 THEN round((v_cash + v_debtors) / v_current_liabilities, 2) END
    ),
    'treasury_and_runway', jsonb_build_object(
      'cash_and_bank_reserves', v_cash,
      'estimated_monthly_burn', v_burn,
      'cash_runway_months', CASE WHEN v_burn > 0 THEN round(v_cash / v_burn, 1) END
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ar_ap_aging_analysis(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_fpa_corporate_metrics(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ar_ap_aging_analysis(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fpa_corporate_metrics(uuid, date, date) TO authenticated, service_role;

-- Cash flow (direct method). The old version read cash from codes 1110-1130, which the chart
-- doesn't have, so opening and closing cash were always zero; it also counted every income and
-- expense posting as cash whether or not cash moved. Now: cash = 'Cash & Liquid Capital'
-- accounts, and each voucher's cash movement is classed by the account on the other side.
CREATE OR REPLACE FUNCTION public.get_cash_flow_statement(
  p_org_id uuid,
  p_start_date date DEFAULT '2026-04-01',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening numeric(15, 2);
  v_receipts numeric(15, 2);
  v_payments numeric(15, 2);
  v_investing numeric(15, 2);
  v_financing numeric(15, 2);
  v_closing numeric(15, 2);
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;

  WITH lines AS (
    SELECT e.id AS entry_id, e.entry_date, l.debit, l.credit, a.type, a.label,
           a.label = 'Cash & Liquid Capital' AS is_cash
    FROM public.journal_entry_lines l
    JOIN public.journal_entries e ON e.id = l.journal_entry_id
    JOIN public.accounts a ON a.id = l.account_id
    WHERE l.organisation_id = p_org_id
      AND e.status IN ('posted', 'reversed')
      AND e.entry_date <= p_end_date
  ), per_entry AS (
    SELECT
      entry_id,
      min(entry_date) AS entry_date,
      coalesce(sum(debit - credit) FILTER (WHERE is_cash), 0) AS cash_delta,
      -- Activity = class of the largest non-cash line; cash-to-cash transfers have none and net to zero.
      (array_agg(
        CASE
          WHEN type = 'equity' OR label ILIKE '%loan%' OR label ILIKE '%long%term%' THEN 'financing'
          WHEN type = 'asset' AND label ILIKE '%fixed%' THEN 'investing'
          ELSE 'operating'
        END ORDER BY greatest(debit, credit) DESC
      ) FILTER (WHERE NOT is_cash))[1] AS activity
    FROM lines
    GROUP BY entry_id
  )
  SELECT
    coalesce(sum(cash_delta) FILTER (WHERE entry_date < p_start_date), 0),
    coalesce(sum(cash_delta) FILTER (WHERE entry_date >= p_start_date AND activity = 'operating' AND cash_delta > 0), 0),
    coalesce(-sum(cash_delta) FILTER (WHERE entry_date >= p_start_date AND activity = 'operating' AND cash_delta < 0), 0),
    coalesce(sum(cash_delta) FILTER (WHERE entry_date >= p_start_date AND activity = 'investing'), 0),
    coalesce(sum(cash_delta) FILTER (WHERE entry_date >= p_start_date AND activity = 'financing'), 0),
    coalesce(sum(cash_delta), 0)
  INTO v_opening, v_receipts, v_payments, v_investing, v_financing, v_closing
  FROM per_entry;

  RETURN jsonb_build_object(
    'organisation_id', p_org_id,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'opening_cash_equivalents', v_opening,
    'operating_activities', jsonb_build_object(
      'cash_receipts_from_sales', v_receipts,
      'cash_paid_for_operations', v_payments,
      'net_cash_from_operating_activities', v_receipts - v_payments
    ),
    'investing_activities', jsonb_build_object(
      'capital_expenditures_and_fixed_assets', v_investing,
      'net_cash_used_in_investing', v_investing
    ),
    'financing_activities', jsonb_build_object(
      'equity_and_debt_financing', v_financing,
      'net_cash_from_financing', v_financing
    ),
    'net_change_in_cash', v_closing - v_opening,
    'closing_cash_equivalents', v_closing
  );
END;
$$;
