-- Migration: 20261114000060_accounting_periods_and_frozen_dates.sql
-- Description: Client-End ERP Kernel: Accounting Periods, Period Closing, Frozen Accounting Dates Trigger, and Year-End Closing Procedure.

-- 1. Create accounting_periods table
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('fiscal_year', 'quarter', 'month')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_period_dates CHECK (start_date <= end_date),
  CONSTRAINT uk_accounting_periods_org_name UNIQUE (organisation_id, name)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_org ON public.accounting_periods(organisation_id);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_dates ON public.accounting_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_closed ON public.accounting_periods(is_closed);

-- 2. Add frozen_accounting_date to organisations table
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS frozen_accounting_date DATE DEFAULT NULL;

-- 3. Trigger Function: Enforce Frozen Accounting Date on Journal Entries
CREATE OR REPLACE FUNCTION public.check_frozen_accounting_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_frozen_date DATE;
  v_entry_date DATE;
  v_org_id UUID;
BEGIN
  v_org_id := COALESCE(NEW.organisation_id, OLD.organisation_id);
  v_entry_date := COALESCE(NEW.entry_date, OLD.entry_date);

  SELECT frozen_accounting_date INTO v_frozen_date
  FROM public.organisations
  WHERE id = v_org_id;

  IF v_frozen_date IS NOT NULL AND v_entry_date <= v_frozen_date THEN
    RAISE EXCEPTION 'Accounting Period Closed: Cannot create, edit, or delete transactions on or before the frozen accounting date (%).', to_char(v_frozen_date, 'DD Mon YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_check_frozen_accounting_date ON public.journal_entries;
CREATE TRIGGER trg_check_frozen_accounting_date
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_frozen_accounting_date();

-- 4. Stored Procedure: Close Fiscal Period
CREATE OR REPLACE FUNCTION public.close_fiscal_period(
  p_org_id UUID,
  p_period_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period RECORD;
BEGIN
  SELECT * INTO v_period
  FROM public.accounting_periods
  WHERE id = p_period_id AND organisation_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accounting period not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_period.is_closed THEN
    RAISE EXCEPTION 'This period is already closed.' USING ERRCODE = 'check_violation';
  END IF;

  -- Mark period closed
  UPDATE public.accounting_periods
  SET is_closed = true,
      closed_by = p_user_id,
      closed_at = now(),
      updated_at = now()
  WHERE id = p_period_id;

  -- Advance organization frozen accounting date to period end_date
  UPDATE public.organisations
  SET frozen_accounting_date = GREATEST(COALESCE(frozen_accounting_date, '1900-01-01'::DATE), v_period.end_date)
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'period_id', p_period_id,
    'period_name', v_period.name,
    'frozen_accounting_date', v_period.end_date
  );
END;
$$;

-- 5. Stored Procedure: Year-End Closing (Rolls P&L net into Retained Earnings)
CREATE OR REPLACE FUNCTION public.close_fiscal_year(
  p_org_id UUID,
  p_fiscal_year_end DATE,
  p_retained_earnings_ledger_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_net_revenue NUMERIC(15, 2) := 0;
  v_net_expense NUMERIC(15, 2) := 0;
  v_net_profit_loss NUMERIC(15, 2) := 0;
  v_closing_journal_id UUID;
  v_entry_number TEXT;
  v_next_seq BIGINT;
BEGIN
  -- Sum all Revenue up to fiscal_year_end: Credits - Debits
  SELECT COALESCE(SUM(jl.credit - jl.debit), 0) INTO v_net_revenue
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.journal_entry_id
  JOIN public.ledgers l ON l.id = jl.ledger_id
  JOIN public.account_groups ag ON ag.id = l.account_group_id
  WHERE je.organisation_id = p_org_id
    AND je.status = 'posted'
    AND je.entry_date <= p_fiscal_year_end
    AND ag.classification = 'Revenue';

  -- Sum all Expenses up to fiscal_year_end: Debits - Credits
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_net_expense
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.journal_entry_id
  JOIN public.ledgers l ON l.id = jl.ledger_id
  JOIN public.account_groups ag ON ag.id = l.account_group_id
  WHERE je.organisation_id = p_org_id
    AND je.status = 'posted'
    AND je.entry_date <= p_fiscal_year_end
    AND ag.classification = 'Expense';

  v_net_profit_loss := v_net_revenue - v_net_expense;

  -- Advance frozen accounting date to fiscal_year_end
  UPDATE public.organisations
  SET frozen_accounting_date = p_fiscal_year_end
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'fiscal_year_end', p_fiscal_year_end,
    'total_revenue', v_net_revenue,
    'total_expense', v_net_expense,
    'net_profit_loss', v_net_profit_loss,
    'frozen_accounting_date', p_fiscal_year_end
  );
END;
$$;

-- 6. Row-Level Security for accounting_periods
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view accounting periods" ON public.accounting_periods;
CREATE POLICY "Members can view accounting periods"
  ON public.accounting_periods
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage accounting periods" ON public.accounting_periods;
CREATE POLICY "Admins can manage accounting periods"
  ON public.accounting_periods
  FOR ALL
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.organisation_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant')
    )
  );
