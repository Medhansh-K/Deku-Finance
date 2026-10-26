-- Migration 11: ALERX Chart of Accounts Hierarchy & State-Change Unit Engine
-- Deku Finance - 5 Main Account Groups (Assets, Liabilities, Equity, Revenue, Expense)
-- Structured as: COA Group -> Ledger -> Sub-Ledger -> Label -> Unit & Value
--
-- Core Principle:
-- 1. Transactions occur strictly between Labels (leaf accounts).
-- 2. "Unit" tracks the change of state (e.g., 1 state mutation when owner adds 2.5L once).
-- 3. "Value" tracks the financial magnitude in currency (e.g., 250,000.00 INR).

-- 1. Add ALERX Hierarchical Columns to Accounts Table
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS account_group text,
  ADD COLUMN IF NOT EXISTS ledger text NOT NULL DEFAULT 'General Ledger',
  ADD COLUMN IF NOT EXISTS sub_ledger text NOT NULL DEFAULT 'General Sub-Ledger',
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS is_postable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unit_name text NOT NULL DEFAULT 'state_change';

-- Add column to journal_entry_lines to record unit state mutations (default 1 per transaction line)
ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS unit_delta integer NOT NULL DEFAULT 1;

-- Add Constraint on account_group to strictly enforce ALERX
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_accounts_alerx_group'
  ) THEN
    ALTER TABLE public.accounts 
      ADD CONSTRAINT chk_accounts_alerx_group 
      CHECK (account_group IN ('asset', 'liability', 'equity', 'revenue', 'expense'));
  END IF;
END $$;

-- 2. Backfill existing accounts with ALERX 4-tier hierarchy
UPDATE public.accounts
SET 
  account_group = CASE 
    WHEN type = 'income' THEN 'revenue'
    ELSE type::text 
  END,
  label = COALESCE(label, name),
  ledger = CASE 
    WHEN code LIKE '101%' OR code LIKE '102%' THEN 'Cash & Liquid Capital'
    WHEN code LIKE '103%' THEN 'Current Assets & Receivables'
    WHEN code LIKE '108%' THEN 'Tax Assets & Input Credits'
    WHEN code = '1000' THEN 'Assets Root Group'
    WHEN code LIKE '201%' THEN 'Current Liabilities & Payables'
    WHEN code LIKE '208%' THEN 'Statutory & Tax Liabilities (Duties & Taxes)'
    WHEN code = '2000' THEN 'Liabilities Root Group'
    WHEN code LIKE '301%' THEN 'Owner / Contributed Capital'
    WHEN code LIKE '302%' THEN 'Reserves & Retained Earnings'
    WHEN code = '3000' THEN 'Equity Root Group'
    WHEN code LIKE '401%' OR code LIKE '402%' THEN 'Operating Revenue / Sales'
    WHEN code LIKE '409%' THEN 'Other Income & Receipts'
    WHEN code = '4000' THEN 'Revenue Root Group'
    WHEN code LIKE '501%' THEN 'Cost of Sales / Direct Delivery'
    WHEN code LIKE '502%' OR code LIKE '503%' OR code LIKE '504%' OR code LIKE '509%' THEN 'Operating Overheads & Administration'
    WHEN code = '5000' THEN 'Expense Root Group'
    ELSE 'General Ledger'
  END,
  sub_ledger = CASE 
    WHEN code = '1010' THEN 'Cash In-Hand'
    WHEN code = '1020' THEN 'Operating Bank Accounts'
    WHEN code = '1030' THEN 'Trade Debtors (Accounts Receivable)'
    WHEN code LIKE '108%' THEN 'Input GST Credits'
    WHEN code = '2010' THEN 'Trade Creditors (Accounts Payable)'
    WHEN code LIKE '208%' THEN 'Output GST Control'
    WHEN code = '3010' THEN 'Shareholder Capital'
    WHEN code = '3020' THEN 'Retained Earnings'
    WHEN code = '4010' THEN 'Product Sales Revenue'
    WHEN code = '4020' THEN 'Service & Advisory Fees'
    WHEN code = '4090' THEN 'Incidental Revenue'
    WHEN code = '5010' THEN 'Cost of Goods Sold (COGS)'
    WHEN code = '5020' THEN 'Human Resources & Payroll'
    WHEN code = '5030' THEN 'Technology & SaaS Infrastructure'
    WHEN code = '5040' THEN 'Facilities & Real Estate'
    WHEN code = '5090' THEN 'Financial & Banking Charges'
    ELSE 'General Sub-Ledger'
  END,
  is_postable = CASE 
    WHEN code IN ('1000', '2000', '3000', '4000', '5000') THEN false
    ELSE true
  END
WHERE account_group IS NULL OR label IS NULL;

-- Set Default value for future account insertions
ALTER TABLE public.accounts ALTER COLUMN account_group SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN label SET NOT NULL;

-- 3. Business Guard Trigger: Transactions MUST occur between Labels (Leaf Accounts)
CREATE OR REPLACE FUNCTION public.guard_journal_line_postable_label()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_postable boolean;
  v_label text;
BEGIN
  SELECT is_postable, label INTO v_is_postable, v_label
  FROM public.accounts
  WHERE id = NEW.account_id;

  IF v_is_postable IS FALSE THEN
    RAISE EXCEPTION 'Accounting Violation: Transactions can only be posted to Labels (leaf accounts), not parent ledgers or groups (Account % is not postable)', v_label;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_journal_line_postable ON public.journal_entry_lines;
CREATE TRIGGER trg_guard_journal_line_postable
  BEFORE INSERT OR UPDATE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_journal_line_postable_label();

-- 4. Update seed_default_chart_of_accounts() with ALERX 4-Tier Hierarchy
CREATE OR REPLACE FUNCTION public.seed_default_chart_of_accounts(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has authority
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot seed chart of accounts';
  END IF;

  -- =========================================================================
  -- 1. ASSETS (A)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1000', 'Assets', 'asset', 'asset', 'Assets Root Group', 'Assets Root', 'Assets', false, true, 'Root Assets Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Liquid Capital -> Operating Bank Accounts -> HDFC Current Account
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1020', 'Operating Bank Account (HDFC Current Account)', 'asset', 'asset', 'Cash & Liquid Capital', 'Operating Bank Accounts', 'HDFC Bank Current Account', true, true, 'Primary operational bank current account')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Liquid Capital -> Cash In-Hand -> Petty Cash Reserve
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1010', 'Cash on Hand (Petty Cash Reserve)', 'asset', 'asset', 'Cash & Liquid Capital', 'Cash In-Hand', 'Petty Cash Reserve', true, true, 'Physical cash in office till')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Receivables -> Trade Debtors -> Customer Trade Receivables
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1030', 'Accounts Receivable (Customer Trade Debtors)', 'asset', 'asset', 'Current Assets & Receivables', 'Trade Debtors', 'Customer Trade Receivables', true, true, 'Trade balances due from billed customers')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Tax Assets -> Input GST Credits -> Input CGST / SGST / IGST
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES 
    (p_org_id, '1081', 'Input CGST 9%', 'asset', 'asset', 'Tax Assets & Input Credits', 'Input GST Credits', 'Input CGST 9%', true, true, 'Input Central GST Credit on purchases'),
    (p_org_id, '1082', 'Input SGST 9%', 'asset', 'asset', 'Tax Assets & Input Credits', 'Input GST Credits', 'Input SGST 9%', true, true, 'Input State GST Credit on purchases'),
    (p_org_id, '1083', 'Input IGST 18%', 'asset', 'asset', 'Tax Assets & Input Credits', 'Input GST Credits', 'Input IGST 18%', true, true, 'Input Integrated GST Credit on inter-state purchases')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- =========================================================================
  -- 2. LIABILITIES (L)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '2000', 'Liabilities', 'liability', 'liability', 'Liabilities Root Group', 'Liabilities Root', 'Liabilities', false, true, 'Root Liabilities Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Payables -> Trade Creditors -> Domestic Vendor Payables
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '2010', 'Accounts Payable (Trade Creditors)', 'liability', 'liability', 'Current Liabilities & Payables', 'Trade Creditors', 'Domestic Vendor Payables', true, true, 'Trade balances owed to suppliers and vendors')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Statutory Liabilities -> Output GST Control -> Output CGST / SGST / IGST
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES 
    (p_org_id, '2081', 'Output CGST Payable (9%)', 'liability', 'liability', 'Statutory & Tax Liabilities', 'Output GST Control', 'Output CGST 9% Payable', true, true, 'Collected Central GST payable to government'),
    (p_org_id, '2082', 'Output SGST Payable (9%)', 'liability', 'liability', 'Statutory & Tax Liabilities', 'Output GST Control', 'Output SGST 9% Payable', true, true, 'Collected State GST payable to government'),
    (p_org_id, '2083', 'Output IGST Payable (18%)', 'liability', 'liability', 'Statutory & Tax Liabilities', 'Output GST Control', 'Output IGST 18% Payable', true, true, 'Collected Integrated GST payable to government')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- =========================================================================
  -- 3. EQUITY (E)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '3000', 'Equity', 'equity', 'equity', 'Equity Root Group', 'Equity Root', 'Equity', false, true, 'Root Equity Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Contributed Capital -> Shareholder Capital -> Primary Founder / Shareholder Equity
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '3010', 'Shareholder / Owner Capital', 'equity', 'equity', 'Owner / Contributed Capital', 'Shareholder Capital', 'Primary Shareholder Capital', true, true, 'Paid-in founder and shareholder equity capital')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Reserves -> Retained Earnings -> Accumulated Retained Earnings
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '3020', 'Retained Earnings', 'equity', 'equity', 'Reserves & Retained Earnings', 'Retained Earnings', 'Accumulated Retained Earnings', true, true, 'Accumulated earnings from prior accounting periods')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- =========================================================================
  -- 4. REVENUE (R)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4000', 'Operating Revenue', 'income', 'revenue', 'Revenue Root Group', 'Revenue Root', 'Revenue', false, true, 'Root Revenue Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Operating Revenue -> Product Sales -> Domestic Product Sales
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4010', 'Sales Revenue - Products', 'income', 'revenue', 'Operating Revenue / Sales', 'Product Sales Revenue', 'Domestic Product Sales Revenue', true, true, 'Gross revenue from commercial product sales')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Operating Revenue -> Service Revenue -> Professional Services Revenue
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4020', 'Service Fees & Professional Revenue', 'income', 'revenue', 'Operating Revenue / Sales', 'Service & Advisory Fees', 'Professional Advisory & Consulting Revenue', true, true, 'Fees from professional and advisory engagements')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Other Income -> Incidental Revenue -> Interest & Misc Income
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '4090', 'Other Income & Interest', 'income', 'revenue', 'Other Income & Receipts', 'Incidental Revenue', 'Interest & Miscellaneous Income', true, true, 'Incidental earnings and interest received')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- =========================================================================
  -- 5. EXPENSES (X)
  -- =========================================================================
  -- Root
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5000', 'Operating Expenses', 'expense', 'expense', 'Expense Root Group', 'Expense Root', 'Expenses', false, true, 'Root Expense Group')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Direct Delivery -> Cost of Goods Sold -> Direct Delivery Costs
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5010', 'Cost of Goods Sold (COGS)', 'expense', 'expense', 'Cost of Sales / Direct Delivery', 'Cost of Goods Sold (COGS)', 'Direct Operational Delivery Costs', true, true, 'Direct operational and goods delivery expenditures')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Human Resources -> Salaries & Compensation
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5020', 'Salaries and Contractor Compensation', 'expense', 'expense', 'Operating Overheads & Administration', 'Human Resources & Payroll', 'Staff Salaries & Contractor Fees', true, true, 'Employee payroll and professional contractor fees')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Technology -> Cloud Infrastructure & Software
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5030', 'Cloud Infrastructure & Software', 'expense', 'expense', 'Operating Overheads & Administration', 'Technology & SaaS Infrastructure', 'Cloud Infrastructure & SaaS Subscriptions', true, true, 'Server hosting, cloud APIs, and productivity software')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Facilities -> Office & Operational Rent
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5040', 'Office & Operational Rent', 'expense', 'expense', 'Operating Overheads & Administration', 'Facilities & Real Estate', 'Office Workspace Lease & Utilities', true, true, 'Physical workspace rent, co-working, and utility bills')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

  -- Overheads -> Financial Charges -> Bank Fees & Gateway Charges
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '5090', 'Bank & Payment Processing Charges', 'expense', 'expense', 'Operating Overheads & Administration', 'Financial & Banking Charges', 'Bank Transaction Fees & Payment Gateway Charges', true, true, 'Commercial banking service fees and merchant discount rates')
  ON CONFLICT (organisation_id, code) DO UPDATE SET 
    account_group = EXCLUDED.account_group, ledger = EXCLUDED.ledger, sub_ledger = EXCLUDED.sub_ledger, label = EXCLUDED.label, is_postable = EXCLUDED.is_postable;

END;
$$;

-- 5. Drop and recreate reporting views to expose ALERX hierarchy, state-change units, and monetary values
DROP VIEW IF EXISTS public.view_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.view_profit_and_loss CASCADE;
DROP VIEW IF EXISTS public.view_account_balances CASCADE;
DROP VIEW IF EXISTS public.view_general_ledger CASCADE;

-- 5.1 General Ledger View (Showing Transaction Delta Units & Monetary Values)
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
WHERE e.status = 'posted';

-- 5.2 Account Balances View (With State Change Units and Monetary Value)
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
LEFT JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status = 'posted'
GROUP BY 
  a.organisation_id, a.id, a.code, a.account_group, a.ledger, a.sub_ledger, a.label, 
  a.name, a.type, a.is_active, a.is_postable;

-- 5.3 Profit & Loss View
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
JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status = 'posted'
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
WHERE a.account_group IN ('revenue', 'expense') OR a.type IN ('income', 'expense')
GROUP BY 
  a.organisation_id, e.fiscal_period_id, fp.name, a.id, a.code, a.account_group, 
  a.ledger, a.sub_ledger, a.label, a.name, a.type;

-- 5.4 Balance Sheet View
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
JOIN public.journal_entries e ON l.journal_entry_id = e.id AND e.status = 'posted'
JOIN public.fiscal_periods fp ON e.fiscal_period_id = fp.id
WHERE a.account_group IN ('asset', 'liability', 'equity') OR a.type IN ('asset', 'liability', 'equity')
GROUP BY 
  a.organisation_id, e.fiscal_period_id, fp.name, a.id, a.code, a.account_group, 
  a.ledger, a.sub_ledger, a.label, a.name, a.type;
