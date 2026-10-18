-- Migration 5: Accounting Foundation (Chart of Accounts, Fiscal Periods, Journals)
-- Deku Finance - Core Ledger Foundation

-- 1. Enums for Accounting
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE public.account_type AS ENUM (
      'asset',
      'liability',
      'equity',
      'income',
      'expense'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_period_status') THEN
    CREATE TYPE public.fiscal_period_status AS ENUM (
      'open',
      'closed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journal_entry_status') THEN
    CREATE TYPE public.journal_entry_status AS ENUM (
      'draft',
      'posted',
      'reversed'
    );
  END IF;
END $$;

-- 2. Fiscal Periods Table
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.fiscal_period_status NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uk_fiscal_periods_org_id UNIQUE (organisation_id, id),
  CONSTRAINT chk_fiscal_period_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_org ON public.fiscal_periods(organisation_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON public.fiscal_periods(organisation_id, start_date, end_date);

CREATE TRIGGER trg_fiscal_periods_updated_at
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Prevent overlapping fiscal periods within an organisation
CREATE OR REPLACE FUNCTION public.check_fiscal_period_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fiscal_periods
    WHERE organisation_id = NEW.organisation_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Fiscal periods cannot overlap within the same organisation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_fiscal_period_overlap ON public.fiscal_periods;
CREATE TRIGGER trg_check_fiscal_period_overlap
  BEFORE INSERT OR UPDATE ON public.fiscal_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.check_fiscal_period_overlap();

-- 3. Chart of Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  parent_account_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uk_accounts_org_code UNIQUE (organisation_id, code),
  CONSTRAINT uk_accounts_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_accounts_parent FOREIGN KEY (organisation_id, parent_account_id)
    REFERENCES public.accounts(organisation_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON public.accounts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_accounts_org_type ON public.accounts(organisation_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON public.accounts(organisation_id, parent_account_id);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Journal Entries Table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  fiscal_period_id uuid NOT NULL,
  entry_number text NOT NULL,
  entry_date date NOT NULL,
  status public.journal_entry_status NOT NULL DEFAULT 'draft',
  narration text NOT NULL,
  reference text,
  posted_at timestamptz,
  posted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reversal_of_id uuid REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT uk_journal_entries_org_num UNIQUE (organisation_id, entry_number),
  CONSTRAINT uk_journal_entries_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_journal_entries_fiscal FOREIGN KEY (organisation_id, fiscal_period_id)
    REFERENCES public.fiscal_periods(organisation_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date ON public.journal_entries(organisation_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org_status ON public.journal_entries(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal ON public.journal_entries(organisation_id, fiscal_period_id);

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Journal Entry Lines Table
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  journal_entry_id uuid NOT NULL,
  line_number integer NOT NULL,
  account_id uuid NOT NULL,
  party_id uuid,
  description text,
  debit numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
  credit numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_journal_entry_lines_org_id UNIQUE (organisation_id, id),
  CONSTRAINT uk_journal_entry_lines_entry_line UNIQUE (journal_entry_id, line_number),
  CONSTRAINT chk_journal_entry_lines_one_side CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  ),
  CONSTRAINT fk_lines_entry FOREIGN KEY (organisation_id, journal_entry_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_lines_account FOREIGN KEY (organisation_id, account_id)
    REFERENCES public.accounts(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_lines_party FOREIGN KEY (organisation_id, party_id)
    REFERENCES public.parties(organisation_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_org ON public.journal_entry_lines(organisation_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON public.journal_entry_lines(organisation_id, account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_party ON public.journal_entry_lines(organisation_id, party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON public.journal_entry_lines(journal_entry_id);

-- 6. Idempotent Initial Chart of Accounts Seeder
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

  -- 1000 Assets
  INSERT INTO public.accounts (organisation_id, code, name, type, is_system, description)
  VALUES
    (p_org_id, '1000', 'Assets', 'asset', true, 'Root Asset Group'),
    (p_org_id, '1010', 'Cash on Hand', 'asset', true, 'Liquid cash reserves'),
    (p_org_id, '1020', 'Operating Bank Account', 'asset', true, 'Primary commercial bank account'),
    (p_org_id, '1030', 'Accounts Receivable (Debtors)', 'asset', true, 'Customer trade balances due'),
    (p_org_id, '1081', 'Input CGST', 'asset', true, 'Input Central GST Credit'),
    (p_org_id, '1082', 'Input SGST', 'asset', true, 'Input State GST Credit'),
    (p_org_id, '1083', 'Input IGST', 'asset', true, 'Input Integrated GST Credit')
  ON CONFLICT (organisation_id, code) DO NOTHING;

  -- 2000 Liabilities
  INSERT INTO public.accounts (organisation_id, code, name, type, is_system, description)
  VALUES
    (p_org_id, '2000', 'Liabilities', 'liability', true, 'Root Liability Group'),
    (p_org_id, '2010', 'Accounts Payable (Creditors)', 'liability', true, 'Trade vendor balances payable'),
    (p_org_id, '2081', 'Output CGST Payable', 'liability', true, 'Collected Central GST payable to govt'),
    (p_org_id, '2082', 'Output SGST Payable', 'liability', true, 'Collected State GST payable to govt'),
    (p_org_id, '2083', 'Output IGST Payable', 'liability', true, 'Collected Integrated GST payable to govt')
  ON CONFLICT (organisation_id, code) DO NOTHING;

  -- 3000 Equity
  INSERT INTO public.accounts (organisation_id, code, name, type, is_system, description)
  VALUES
    (p_org_id, '3000', 'Equity', 'equity', true, 'Root Equity Group'),
    (p_org_id, '3010', 'Shareholder / Owner Capital', 'equity', true, 'Paid-in owner equity'),
    (p_org_id, '3020', 'Retained Earnings', 'equity', true, 'Accumulated earnings from prior periods')
  ON CONFLICT (organisation_id, code) DO NOTHING;

  -- 4000 Income
  INSERT INTO public.accounts (organisation_id, code, name, type, is_system, description)
  VALUES
    (p_org_id, '4000', 'Operating Revenue', 'income', true, 'Root Income Group'),
    (p_org_id, '4010', 'Sales Revenue - Products', 'income', true, 'Revenue from goods sales'),
    (p_org_id, '4020', 'Service Fees & Professional Revenue', 'income', true, 'Revenue from services rendered'),
    (p_org_id, '4090', 'Other Income', 'income', true, 'Incidental and interest income')
  ON CONFLICT (organisation_id, code) DO NOTHING;

  -- 5000 Expense
  INSERT INTO public.accounts (organisation_id, code, name, type, is_system, description)
  VALUES
    (p_org_id, '5000', 'Operating Expenses', 'expense', true, 'Root Expense Group'),
    (p_org_id, '5010', 'Cost of Goods Sold (COGS)', 'expense', true, 'Direct operational delivery costs'),
    (p_org_id, '5020', 'Salaries and Contractor Compensation', 'expense', true, 'Staff payroll & contractor fees'),
    (p_org_id, '5030', 'Cloud Infrastructure & Software', 'expense', true, 'Servers, SaaS subscriptions'),
    (p_org_id, '5040', 'Office & Operational Rent', 'expense', true, 'Workspace lease & facilities'),
    (p_org_id, '5090', 'Bank & Payment Processing Charges', 'expense', true, 'Banking fees and gateway costs')
  ON CONFLICT (organisation_id, code) DO NOTHING;
END;
$$;

-- 7. Row Level Security Policies
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- Fiscal Periods Policies
CREATE POLICY "fiscal_periods_select"
  ON public.fiscal_periods FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "fiscal_periods_manage"
  ON public.fiscal_periods FOR ALL TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]));

-- Accounts Policies
CREATE POLICY "accounts_select"
  ON public.accounts FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "accounts_manage"
  ON public.accounts FOR ALL TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]));

-- Journal Entries Policies
CREATE POLICY "journal_entries_select"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "journal_entries_insert_draft"
  ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
    AND status = 'draft'
  );

CREATE POLICY "journal_entries_update_draft"
  ON public.journal_entries FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
    AND status = 'draft'
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
  );

CREATE POLICY "journal_entries_delete_draft"
  ON public.journal_entries FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
    AND status = 'draft'
  );

-- Journal Entry Lines Policies
CREATE POLICY "journal_entry_lines_select"
  ON public.journal_entry_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "journal_entry_lines_insert"
  ON public.journal_entry_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
  );

CREATE POLICY "journal_entry_lines_update"
  ON public.journal_entry_lines FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
  );

CREATE POLICY "journal_entry_lines_delete"
  ON public.journal_entry_lines FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
  );
