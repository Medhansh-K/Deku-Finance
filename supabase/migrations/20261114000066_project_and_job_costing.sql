-- Migration: 20261114000066_project_and_job_costing.sql
-- Description: Client-End ERP Kernel: Project & Job Costing Finance, Project Financial Accounting Dimensions, and Profitability Engine.

-- 1. Projects Dimension Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  budgeted_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (budgeted_cost >= 0),
  budgeted_revenue NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (budgeted_revenue >= 0),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_projects_org_code UNIQUE (organisation_id, project_code),
  CONSTRAINT uk_projects_org_id UNIQUE (organisation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organisation_id);
CREATE INDEX IF NOT EXISTS idx_projects_party ON public.projects(party_id);
CREATE INDEX IF NOT EXISTS idx_projects_dept ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(organisation_id, status);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_org_isolation ON public.projects
  FOR ALL
  USING (organisation_id = (current_setting('app.current_organisation_id', true))::uuid)
  WITH CHECK (organisation_id = (current_setting('app.current_organisation_id', true))::uuid);

-- 2. Add project_id financial dimension to transaction tables
ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_project ON public.journal_entry_lines(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_project ON public.sales_invoices(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.sales_invoice_lines
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_bills
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_bills_project ON public.purchase_bills(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.purchase_bill_lines
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 3. Stored Procedure: Compute Real-time Project Profitability & Financial Health
CREATE OR REPLACE FUNCTION public.get_project_profitability(
  p_org_id UUID,
  p_project_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proj RECORD;
  v_invoiced_revenue NUMERIC(15, 2) := 0.00;
  v_billed_expenses NUMERIC(15, 2) := 0.00;
  v_direct_labor NUMERIC(15, 2) := 0.00;
  v_other_journal_expenses NUMERIC(15, 2) := 0.00;
  v_total_revenue NUMERIC(15, 2) := 0.00;
  v_total_cost NUMERIC(15, 2) := 0.00;
  v_net_margin NUMERIC(15, 2) := 0.00;
  v_margin_pct NUMERIC(5, 2) := 0.00;
  v_budget_burn_pct NUMERIC(5, 2) := 0.00;
BEGIN
  -- Fetch project details
  SELECT * INTO v_proj
  FROM public.projects
  WHERE id = p_project_id AND organisation_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project % not found in organisation %', p_project_id, p_org_id;
  END IF;

  -- 1. Invoiced revenue from Sales Invoices tagged with project
  SELECT COALESCE(SUM(total_amount), 0.00) INTO v_invoiced_revenue
  FROM public.sales_invoices
  WHERE organisation_id = p_org_id 
    AND project_id = p_project_id 
    AND status IN ('posted', 'paid', 'partially_paid');

  -- 2. Direct vendor expenses from Purchase Bills
  SELECT COALESCE(SUM(total_amount), 0.00) INTO v_billed_expenses
  FROM public.purchase_bills
  WHERE organisation_id = p_org_id 
    AND project_id = p_project_id 
    AND status != 'cancelled';

  -- 3. Tagged journal entries (Expenses Dr - Cr)
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0.00) INTO v_other_journal_expenses
  FROM public.journal_entry_lines jel
  JOIN public.accounts acc ON acc.id = jel.account_id
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.organisation_id = p_org_id
    AND jel.project_id = p_project_id
    AND acc.account_type IN ('direct_expense', 'indirect_expense', 'operating_expense', 'cost_of_goods_sold')
    AND je.status = 'posted';

  -- Calculate combined actuals
  v_total_revenue := v_invoiced_revenue;
  v_total_cost := v_billed_expenses + v_other_journal_expenses;
  v_net_margin := v_total_revenue - v_total_cost;

  IF v_total_revenue > 0 THEN
    v_margin_pct := ROUND(((v_net_margin / v_total_revenue) * 100)::numeric, 2);
  ELSE
    v_margin_pct := 0.00;
  END IF;

  IF v_proj.budgeted_cost > 0 THEN
    v_budget_burn_pct := ROUND(((v_total_cost / v_proj.budgeted_cost) * 100)::numeric, 2);
  ELSE
    v_budget_burn_pct := 0.00;
  END IF;

  RETURN jsonb_build_object(
    'project_id', v_proj.id,
    'project_code', v_proj.project_code,
    'project_name', v_proj.project_name,
    'status', v_proj.status,
    'budgeted_cost', v_proj.budgeted_cost,
    'budgeted_revenue', v_proj.budgeted_revenue,
    'actual_revenue', v_total_revenue,
    'actual_cost', v_total_cost,
    'billed_expenses', v_billed_expenses,
    'other_journal_expenses', v_other_journal_expenses,
    'net_profit', v_net_margin,
    'margin_pct', v_margin_pct,
    'budget_burn_pct', v_budget_burn_pct,
    'start_date', v_proj.start_date,
    'end_date', v_proj.end_date
  );
END;
$$;
