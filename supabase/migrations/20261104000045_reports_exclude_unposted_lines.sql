-- Deku Finance - reports count only posted and reversed vouchers.
-- The second LEFT JOIN in migration 021 kept every line and only blanked the entry, so draft,
-- pending, rejected and even unbalanced vouchers were added into both views. Found by tests/e2e.

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
LEFT JOIN (
  public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status IN ('posted', 'reversed')
) ON a.id = l.account_id
GROUP BY 
  a.organisation_id, a.id, a.code, a.account_group, a.ledger, a.sub_ledger, a.label, 
  a.name, a.type, a.is_active, a.is_postable;

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
LEFT JOIN (
  public.journal_entry_lines l
  JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status IN ('posted', 'reversed')
) ON a.id = l.account_id
GROUP BY a.organisation_id, a.id, a.code, a.name, a.type;
