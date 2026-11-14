-- Migration: 20261114000061_hierarchical_cost_centres_and_budget_blocks.sql
-- Description: Client-End ERP Kernel: Hierarchical Cost Centres, Nested Departments, and Hard Budget Spending Enforcement Trigger.

-- 1. Extend departments table for Hierarchical Cost Centres & Enforcement Mode
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS parent_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_type TEXT NOT NULL DEFAULT 'department'
    CHECK (department_type IN ('department', 'cost_centre', 'division', 'profit_centre')),
  ADD COLUMN IF NOT EXISTS budget_enforcement_mode TEXT NOT NULL DEFAULT 'warning'
    CHECK (budget_enforcement_mode IN ('none', 'warning', 'strict_block'));

CREATE INDEX IF NOT EXISTS idx_departments_parent ON public.departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_departments_type ON public.departments(department_type);

-- 2. Multi-Period Department Budgets Table
CREATE TABLE IF NOT EXISTS public.department_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'annual' CHECK (period IN ('annual', 'q1', 'q2', 'q3', 'q4', 'monthly')),
  budget_limit NUMERIC(15, 2) NOT NULL CHECK (budget_limit >= 0),
  warning_threshold_pct NUMERIC(5, 2) NOT NULL DEFAULT 80.0 CHECK (warning_threshold_pct BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_department_budget_period UNIQUE (department_id, fiscal_year, period)
);

CREATE INDEX IF NOT EXISTS idx_dept_budgets_org ON public.department_budgets(organisation_id);
CREATE INDEX IF NOT EXISTS idx_dept_budgets_dept ON public.department_budgets(department_id);

-- 3. Trigger Function: Validate Budget Limit and Enforce Hard Spending Block
CREATE OR REPLACE FUNCTION public.validate_department_budget_on_posting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dept_id UUID;
  v_enforcement TEXT;
  v_dept_name TEXT;
  v_budget_limit NUMERIC(15, 2);
  v_current_spent NUMERIC(15, 2);
  v_new_expense NUMERIC(15, 2);
  v_is_expense BOOLEAN := false;
  v_entry_status TEXT;
  v_org_id UUID;
BEGIN
  -- Check if the line has a department tag
  v_dept_id := NEW.department_id;
  IF v_dept_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verify if the associated ledger is an Expense
  SELECT (ag.classification = 'Expense') INTO v_is_expense
  FROM public.ledgers l
  JOIN public.account_groups ag ON ag.id = l.account_group_id
  WHERE l.id = NEW.ledger_id;

  IF NOT v_is_expense OR NEW.debit <= 0 THEN
    RETURN NEW;
  END IF;

  -- Get journal entry status and org
  SELECT status, organisation_id INTO v_entry_status, v_org_id
  FROM public.journal_entries
  WHERE id = NEW.journal_entry_id;

  IF v_entry_status <> 'posted' THEN
    RETURN NEW;
  END IF;

  -- Get department enforcement setting and budget limit
  SELECT name, budget_enforcement_mode, COALESCE(budget_allocated, 0)
  INTO v_dept_name, v_enforcement, v_budget_limit
  FROM public.departments
  WHERE id = v_dept_id;

  IF v_enforcement = 'none' OR v_budget_limit <= 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate current posted spend for this department
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_current_spent
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.journal_entry_id
  JOIN public.ledgers l ON l.id = jl.ledger_id
  JOIN public.account_groups ag ON ag.id = l.account_group_id
  WHERE je.organisation_id = v_org_id
    AND je.status = 'posted'
    AND jl.department_id = v_dept_id
    AND ag.classification = 'Expense'
    AND jl.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

  v_new_expense := v_current_spent + NEW.debit;

  -- If strict block is enabled and limit is exceeded, abort the posting!
  IF v_enforcement = 'strict_block' AND v_new_expense > v_budget_limit THEN
    RAISE EXCEPTION 'Hard Budget Block: Department [%] has an allocated budget of ₹% (current spent: ₹%). This transaction would push spend to ₹%, which is blocked by policy.',
      v_dept_name,
      to_char(v_budget_limit, 'FM999,999,990.00'),
      to_char(v_current_spent, 'FM999,999,990.00'),
      to_char(v_new_expense, 'FM999,999,990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  -- Update budget_utilized on the department for real-time visibility
  UPDATE public.departments
  SET budget_utilized = v_new_expense,
      updated_at = now()
  WHERE id = v_dept_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_dept_budget ON public.journal_lines;
CREATE TRIGGER trg_validate_dept_budget
  BEFORE INSERT OR UPDATE ON public.journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_department_budget_on_posting();

-- 4. Function: Return Department & Cost Centre Hierarchy with Budget Status
CREATE OR REPLACE FUNCTION public.get_department_hierarchy(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(dept_tree) INTO v_result
  FROM (
    SELECT
      d.id,
      d.name,
      d.code,
      d.department_type,
      d.parent_department_id,
      d.budget_enforcement_mode,
      d.budget_allocated,
      d.budget_utilized,
      CASE
        WHEN d.budget_allocated > 0 THEN ROUND((d.budget_utilized / d.budget_allocated) * 100, 1)
        ELSE 0.0
      END AS utilization_pct,
      d.lead_name,
      d.lead_designation,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sub.id,
            'name', sub.name,
            'code', sub.code,
            'department_type', sub.department_type,
            'budget_allocated', sub.budget_allocated,
            'budget_utilized', sub.budget_utilized,
            'budget_enforcement_mode', sub.budget_enforcement_mode
          )
        )
        FROM public.departments sub
        WHERE sub.parent_department_id = d.id
      ) AS child_cost_centres
    FROM public.departments d
    WHERE d.organisation_id = p_org_id
      AND d.parent_department_id IS NULL
    ORDER BY d.code ASC
  ) dept_tree;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- 5. RLS on department_budgets
ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view department budgets" ON public.department_budgets;
CREATE POLICY "Members can view department budgets"
  ON public.department_budgets
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage department budgets" ON public.department_budgets;
CREATE POLICY "Admins can manage department budgets"
  ON public.department_budgets
  FOR ALL
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.organisation_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant')
    )
  );
