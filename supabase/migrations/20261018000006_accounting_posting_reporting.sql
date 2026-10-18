-- Migration 6: Accounting Integrity, Controlled Posting & Reporting Views
-- Deku Finance - Ledger Integrity Engine & Financial Reporting

-- 1. Direct Modification Guard Trigger on Journal Entries and Lines
CREATE OR REPLACE FUNCTION public.guard_journal_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION 'Accounting Violation: Posted or reversed journal entries are immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION 'Accounting Violation: Posted or reversed journal entries cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_journal_entries ON public.journal_entries;
CREATE TRIGGER trg_guard_journal_entries
  BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_journal_immutability();

CREATE OR REPLACE FUNCTION public.guard_journal_lines_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_status public.journal_entry_status;
BEGIN
  SELECT status INTO v_parent_status
  FROM public.journal_entries
  WHERE id = COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);

  IF v_parent_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'Accounting Violation: Lines belonging to a posted or reversed entry cannot be modified or deleted';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_journal_lines ON public.journal_entry_lines;
CREATE TRIGGER trg_guard_journal_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_journal_lines_immutability();

-- 2. Controlled Posting Function (Atomic Validation & Status Transition)
CREATE OR REPLACE FUNCTION public.post_journal_entry(
  p_org_id uuid,
  p_entry_id uuid
)
RETURNS public.journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.journal_entries;
  v_fiscal public.fiscal_periods;
  v_line_count integer;
  v_total_debit numeric(15, 2);
  v_total_credit numeric(15, 2);
BEGIN
  -- Permission check
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot post journal entries';
  END IF;

  -- Fetch entry for update to prevent concurrent race conditions
  SELECT * INTO v_entry
  FROM public.journal_entries
  WHERE id = p_entry_id
    AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found or does not belong to specified organisation';
  END IF;

  IF v_entry.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft entries can be posted (Current status: %)', v_entry.status;
  END IF;

  -- Validate fiscal period
  SELECT * INTO v_fiscal
  FROM public.fiscal_periods
  WHERE id = v_entry.fiscal_period_id
    AND organisation_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned fiscal period not found';
  END IF;

  IF v_fiscal.status <> 'open' THEN
    RAISE EXCEPTION 'Cannot post into a closed fiscal period (%)', v_fiscal.name;
  END IF;

  IF v_entry.entry_date < v_fiscal.start_date OR v_entry.entry_date > v_fiscal.end_date THEN
    RAISE EXCEPTION 'Entry date (%) falls outside fiscal period bounds (% to %)',
      v_entry.entry_date, v_fiscal.start_date, v_fiscal.end_date;
  END IF;

  -- Validate lines
  SELECT
    COUNT(*),
    COALESCE(SUM(debit), 0.00),
    COALESCE(SUM(credit), 0.00)
  INTO
    v_line_count,
    v_total_debit,
    v_total_credit
  FROM public.journal_entry_lines
  WHERE journal_entry_id = p_entry_id
    AND organisation_id = p_org_id;

  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'Double-entry failure: A posted journal entry must have at least 2 lines (Found %)', v_line_count;
  END IF;

  IF v_total_debit <= 0.00 THEN
    RAISE EXCEPTION 'Double-entry failure: Total entry value must be strictly positive';
  END IF;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Out of balance: Total debits (%) do not equal total credits (%)', v_total_debit, v_total_credit;
  END IF;

  -- Atomic transition
  UPDATE public.journal_entries
  SET
    status = 'posted',
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

-- 3. Controlled Reversal Function
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(
  p_org_id uuid,
  p_entry_id uuid,
  p_reversal_date date,
  p_narration text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig public.journal_entries;
  v_rev_id uuid;
  v_rev_num text;
  v_fiscal_id uuid;
  v_line record;
BEGIN
  -- Permission check
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot reverse journal entries';
  END IF;

  SELECT * INTO v_orig
  FROM public.journal_entries
  WHERE id = p_entry_id
    AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original journal entry not found';
  END IF;

  IF v_orig.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted journal entries can be reversed (Status: %)', v_orig.status;
  END IF;

  -- Find open fiscal period for reversal date
  SELECT id INTO v_fiscal_id
  FROM public.fiscal_periods
  WHERE organisation_id = p_org_id
    AND status = 'open'
    AND p_reversal_date BETWEEN start_date AND end_date
  LIMIT 1;

  IF v_fiscal_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal period found for reversal date %', p_reversal_date;
  END IF;

  v_rev_num := 'REV-' || v_orig.entry_number;

  -- Create reversal header
  INSERT INTO public.journal_entries (
    organisation_id,
    fiscal_period_id,
    entry_number,
    entry_date,
    status,
    narration,
    reference,
    reversal_of_id,
    created_by
  )
  VALUES (
    p_org_id,
    v_fiscal_id,
    v_rev_num,
    p_reversal_date,
    'draft',
    COALESCE(p_narration, 'Reversal of ' || v_orig.entry_number || ': ' || v_orig.narration),
    'REV-' || COALESCE(v_orig.reference, v_orig.entry_number),
    v_orig.id,
    auth.uid()
  )
  RETURNING id INTO v_rev_id;

  -- Copy lines with inverted debits and credits
  FOR v_line IN
    SELECT *
    FROM public.journal_entry_lines
    WHERE journal_entry_id = p_entry_id
    ORDER BY line_number
  LOOP
    INSERT INTO public.journal_entry_lines (
      organisation_id,
      journal_entry_id,
      line_number,
      account_id,
      party_id,
      description,
      debit,
      credit
    )
    VALUES (
      p_org_id,
      v_rev_id,
      v_line.line_number,
      v_line.account_id,
      v_line.party_id,
      'Reversal: ' || COALESCE(v_line.description, ''),
      v_line.credit, -- swapped
      v_line.debit   -- swapped
    );
  END LOOP;

  -- Post the reversal entry
  PERFORM public.post_journal_entry(p_org_id, v_rev_id);

  -- Mark original as reversed
  UPDATE public.journal_entries
  SET
    status = 'reversed',
    updated_at = now()
  WHERE id = p_entry_id;

  RETURN v_rev_id;
END;
$$;

-- 4. Financial Reporting Views (security_invoker = true)

-- General Ledger View
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
  a.name AS account_name,
  a.type AS account_type,
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
WHERE e.status = 'posted';

-- Account Balances View (With Natural Balance Calculation)
CREATE OR REPLACE VIEW public.view_account_balances
WITH (security_invoker = true)
AS
SELECT
  a.organisation_id,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  a.is_active,
  COALESCE(SUM(l.debit), 0.00) AS total_debit,
  COALESCE(SUM(l.credit), 0.00) AS total_credit,
  CASE
    WHEN a.type IN ('asset', 'expense') THEN
      COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    WHEN a.type IN ('liability', 'equity', 'income') THEN
      COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    ELSE 0.00
  END AS natural_balance
FROM public.accounts a
LEFT JOIN public.journal_entry_lines l ON a.id = l.account_id
LEFT JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status = 'posted'
GROUP BY a.organisation_id, a.id, a.code, a.name, a.type, a.is_active;

-- Profit & Loss View (Income & Expense Accounts with Net Profit)
CREATE OR REPLACE VIEW public.view_profit_and_loss
WITH (security_invoker = true)
AS
SELECT
  a.organisation_id,
  e.fiscal_period_id,
  fp.name AS fiscal_period_name,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(l.debit), 0.00) AS total_debit,
  COALESCE(SUM(l.credit), 0.00) AS total_credit,
  CASE
    WHEN a.type = 'income' THEN COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    WHEN a.type = 'expense' THEN COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    ELSE 0.00
  END AS net_amount
FROM public.accounts a
JOIN public.journal_entry_lines l ON a.id = l.account_id
JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status = 'posted'
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
WHERE a.type IN ('income', 'expense')
GROUP BY a.organisation_id, e.fiscal_period_id, fp.name, a.id, a.code, a.name, a.type;

-- Balance Sheet View (Assets, Liabilities, Equity)
CREATE OR REPLACE VIEW public.view_balance_sheet
WITH (security_invoker = true)
AS
SELECT
  a.organisation_id,
  e.fiscal_period_id,
  fp.name AS fiscal_period_name,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(l.debit), 0.00) AS total_debit,
  COALESCE(SUM(l.credit), 0.00) AS total_credit,
  CASE
    WHEN a.type = 'asset' THEN COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)
    WHEN a.type IN ('liability', 'equity') THEN COALESCE(SUM(l.credit), 0.00) - COALESCE(SUM(l.debit), 0.00)
    ELSE 0.00
  END AS balance
FROM public.accounts a
JOIN public.journal_entry_lines l ON a.id = l.account_id
JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status = 'posted'
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
WHERE a.type IN ('asset', 'liability', 'equity')
GROUP BY a.organisation_id, e.fiscal_period_id, fp.name, a.id, a.code, a.name, a.type;
