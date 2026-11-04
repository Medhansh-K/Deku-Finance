-- Deku Finance - date ranges for the Trial Balance, Profit & Loss and Balance Sheet.
-- The report views stay as they are for callers that pass no dates. A NULL bound here means open-ended.
-- Accounts are classed by accounts.type alone, so each one lands on exactly one side of the equation.

CREATE OR REPLACE FUNCTION public.get_trial_balance_range(
  p_org_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS TABLE (
  organisation_id uuid,
  account_id uuid,
  account_code text,
  account_name text,
  account_type public.account_type,
  total_debit numeric,
  total_credit numeric,
  closing_debit numeric,
  closing_credit numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation' USING ERRCODE = '42501';
  END IF;

  -- The nested join keeps accounts with no movement without letting unposted lines through (see migration 045).
  RETURN QUERY
  SELECT
    a.organisation_id,
    a.id,
    a.code::text,
    a.name::text,
    a.type,
    COALESCE(SUM(l.debit), 0.00)::numeric,
    COALESCE(SUM(l.credit), 0.00)::numeric,
    (CASE WHEN a.type IN ('asset', 'expense')
      THEN GREATEST(0.00, COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)) ELSE 0.00 END)::numeric,
    (CASE WHEN a.type IN ('liability', 'equity', 'income')
      THEN GREATEST(0.00, COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)) ELSE 0.00 END)::numeric
  FROM public.accounts a
  LEFT JOIN (
    public.journal_entry_lines l
    JOIN public.journal_entries e ON e.id = l.journal_entry_id
      AND e.status IN ('posted', 'reversed')
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
  ) ON l.account_id = a.id
  WHERE a.organisation_id = p_org_id
  GROUP BY a.organisation_id, a.id, a.code, a.name, a.type
  ORDER BY a.code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profit_and_loss_range(
  p_org_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS TABLE (
  organisation_id uuid,
  account_id uuid,
  account_code text,
  account_name text,
  account_type public.account_type,
  total_debit numeric,
  total_credit numeric,
  net_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.organisation_id,
    a.id,
    a.code::text,
    a.name::text,
    a.type,
    SUM(l.debit)::numeric,
    SUM(l.credit)::numeric,
    (CASE WHEN a.type = 'income' THEN SUM(l.credit) - SUM(l.debit) ELSE SUM(l.debit) - SUM(l.credit) END)::numeric
  FROM public.accounts a
  JOIN public.journal_entry_lines l ON l.account_id = a.id
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE a.organisation_id = p_org_id
    AND a.type IN ('income', 'expense')
    AND e.status IN ('posted', 'reversed')
    AND (p_from IS NULL OR e.entry_date >= p_from)
    AND (p_to IS NULL OR e.entry_date <= p_to)
  GROUP BY a.organisation_id, a.id, a.code, a.name, a.type
  ORDER BY a.code;
END;
$$;

-- Income and expense up to the date come back as one extra equity row with no account_id, so the
-- rows satisfy assets = liabilities + equity on their own. Don't add profit to them again.
CREATE OR REPLACE FUNCTION public.get_balance_sheet_as_of(
  p_org_id uuid,
  p_as_of date DEFAULT NULL
)
RETURNS TABLE (
  organisation_id uuid,
  account_id uuid,
  account_code text,
  account_name text,
  account_type public.account_type,
  total_debit numeric,
  total_credit numeric,
  balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH booked AS (
    SELECT a.id, a.code, a.name, a.type, l.debit, l.credit
    FROM public.accounts a
    JOIN public.journal_entry_lines l ON l.account_id = a.id
    JOIN public.journal_entries e ON e.id = l.journal_entry_id
    WHERE a.organisation_id = p_org_id
      AND e.status IN ('posted', 'reversed')
      AND (p_as_of IS NULL OR e.entry_date <= p_as_of)
  )
  SELECT
    p_org_id,
    b.id,
    b.code::text,
    b.name::text,
    b.type,
    SUM(b.debit)::numeric,
    SUM(b.credit)::numeric,
    (CASE WHEN b.type = 'asset' THEN SUM(b.debit) - SUM(b.credit) ELSE SUM(b.credit) - SUM(b.debit) END)::numeric
  FROM booked b
  WHERE b.type IN ('asset', 'liability', 'equity')
  GROUP BY b.id, b.code, b.name, b.type
  UNION ALL
  SELECT
    p_org_id,
    NULL::uuid,
    NULL::text,
    'Accumulated profit / (loss)'::text,
    'equity'::public.account_type,
    SUM(b.debit)::numeric,
    SUM(b.credit)::numeric,
    (SUM(b.credit) - SUM(b.debit))::numeric
  FROM booked b
  WHERE b.type IN ('income', 'expense')
  HAVING COUNT(*) > 0
  ORDER BY 3;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.get_trial_balance_range(uuid, date, date),
  public.get_profit_and_loss_range(uuid, date, date),
  public.get_balance_sheet_as_of(uuid, date)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_trial_balance_range(uuid, date, date),
  public.get_profit_and_loss_range(uuid, date, date),
  public.get_balance_sheet_as_of(uuid, date)
TO authenticated, service_role;

-- The General Ledger screen shows the voucher's narration, which the view left out. New column last.
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
  fp.name AS fiscal_period_name,
  e.narration
FROM public.journal_entry_lines l
JOIN public.journal_entries e ON l.journal_entry_id = e.id
JOIN public.accounts a ON l.account_id = a.id
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
LEFT JOIN public.parties p ON l.party_id = p.id
WHERE e.status IN ('posted', 'reversed');
