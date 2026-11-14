-- Migration: 20261114000065_statutory_payroll_engine.sql
-- Description: Client-End ERP Kernel: Indian Statutory Payroll Engine (EPF 12%, ESIC 0.75%, State PT, Sec 192 TDS), Payslips, and Compound Balanced Ledger Posting.

-- 1. Extend department_members for Statutory Pay Components
ALTER TABLE public.department_members
  ADD COLUMN IF NOT EXISTS pan TEXT,
  ADD COLUMN IF NOT EXISTS uan_epf TEXT,
  ADD COLUMN IF NOT EXISTS esic_number TEXT,
  ADD COLUMN IF NOT EXISTS tax_regime TEXT NOT NULL DEFAULT 'new' CHECK (tax_regime IN ('new', 'old')),
  ADD COLUMN IF NOT EXISTS basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (basic_pay >= 0),
  ADD COLUMN IF NOT EXISTS hra NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (hra >= 0),
  ADD COLUMN IF NOT EXISTS special_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (special_allowances >= 0),
  ADD COLUMN IF NOT EXISTS state_for_pt TEXT NOT NULL DEFAULT 'Maharashtra',
  ADD COLUMN IF NOT EXISTS epf_applicable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS esic_applicable BOOLEAN NOT NULL DEFAULT false;

-- 2. Payroll Run Line Items Table
CREATE TABLE IF NOT EXISTS public.payroll_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  payroll_period TEXT NOT NULL, -- e.g. '2026-10'
  employee_id UUID NOT NULL REFERENCES public.department_members(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  hra NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  gross_salary NUMERIC(12, 2) NOT NULL,
  epf_employee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  epf_employer NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  esic_employee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  esic_employer NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  professional_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tds_section_192 NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_salary NUMERIC(12, 2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_payroll_employee_period UNIQUE (employee_id, payroll_period)
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_org ON public.payroll_run_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_period ON public.payroll_run_items(payroll_period);

-- 3. Stored Procedure: Compute and Post Statutory Payroll Run to Ledger
CREATE OR REPLACE FUNCTION public.compute_and_post_statutory_payroll(
  p_org_id UUID,
  p_period TEXT,
  p_salary_expense_ledger_id UUID,
  p_salaries_payable_ledger_id UUID,
  p_epf_payable_ledger_id UUID,
  p_esic_payable_ledger_id UUID,
  p_pt_payable_ledger_id UUID,
  p_tds_payable_ledger_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp RECORD;
  v_gross NUMERIC(12, 2);
  v_epf_emp NUMERIC(12, 2);
  v_epf_empr NUMERIC(12, 2);
  v_esic_emp NUMERIC(12, 2);
  v_esic_empr NUMERIC(12, 2);
  v_pt NUMERIC(12, 2);
  v_tds NUMERIC(12, 2);
  v_total_ded NUMERIC(12, 2);
  v_net NUMERIC(12, 2);

  v_sum_gross NUMERIC(15, 2) := 0;
  v_sum_epf NUMERIC(15, 2) := 0;
  v_sum_esic NUMERIC(15, 2) := 0;
  v_sum_pt NUMERIC(15, 2) := 0;
  v_sum_tds NUMERIC(15, 2) := 0;
  v_sum_net NUMERIC(15, 2) := 0;

  v_journal_id UUID;
  v_entry_num TEXT;
  v_line_num INT := 1;
BEGIN
  -- Delete existing unposted payroll run items for this period
  DELETE FROM public.payroll_run_items
  WHERE organisation_id = p_org_id AND payroll_period = p_period AND payment_status = 'unpaid';

  FOR v_emp IN
    SELECT * FROM public.department_members
    WHERE organisation_id = p_org_id AND status = 'active'
  LOOP
    v_gross := v_emp.basic_pay + v_emp.hra + v_emp.special_allowances;

    -- Statutory EPF (12% of basic up to 15,000 statutory wage ceiling)
    IF v_emp.epf_applicable THEN
      v_epf_emp := ROUND(LEAST(v_emp.basic_pay, 15000.00) * 0.12, 2);
      v_epf_empr := v_epf_emp;
    ELSE
      v_epf_emp := 0.00;
      v_epf_empr := 0.00;
    END IF;

    -- Statutory ESIC (0.75% of gross if gross <= 21,000)
    IF v_emp.esic_applicable AND v_gross <= 21000.00 THEN
      v_esic_emp := ROUND(v_gross * 0.0075, 2);
      v_esic_empr := ROUND(v_gross * 0.0325, 2);
    ELSE
      v_esic_emp := 0.00;
      v_esic_empr := 0.00;
    END IF;

    -- Professional Tax (PT Slabs: Maharashtra model)
    IF v_gross > 10000.00 THEN
      v_pt := 200.00;
    ELSIF v_gross > 7500.00 THEN
      v_pt := 175.00;
    ELSE
      v_pt := 0.00;
    END IF;

    -- Section 192 TDS deduction
    IF v_gross > 50000.00 THEN
      v_tds := ROUND(v_gross * 0.05, 2);
    ELSE
      v_tds := 0.00;
    END IF;

    v_total_ded := v_epf_emp + v_esic_emp + v_pt + v_tds;
    v_net := v_gross - v_total_ded;

    -- Insert Payroll Item
    INSERT INTO public.payroll_run_items (
      organisation_id,
      payroll_period,
      employee_id,
      employee_name,
      department_id,
      basic_pay,
      hra,
      allowances,
      gross_salary,
      epf_employee,
      epf_employer,
      esic_employee,
      esic_employer,
      professional_tax,
      tds_section_192,
      total_deductions,
      net_salary
    ) VALUES (
      p_org_id,
      p_period,
      v_emp.id,
      COALESCE(v_emp.full_name, v_emp.name, 'Employee'),
      v_emp.department_id,
      v_emp.basic_pay,
      v_emp.hra,
      v_emp.special_allowances,
      v_gross,
      v_epf_emp,
      v_epf_empr,
      v_esic_emp,
      v_esic_empr,
      v_pt,
      v_tds,
      v_total_ded,
      v_net
    );

    v_sum_gross := v_sum_gross + v_gross;
    v_sum_epf := v_sum_epf + v_epf_emp;
    v_sum_esic := v_sum_esic + v_esic_emp;
    v_sum_pt := v_sum_pt + v_pt;
    v_sum_tds := v_sum_tds + v_tds;
    v_sum_net := v_sum_net + v_net;
  END LOOP;

  IF v_sum_gross <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active employees with valid salary components found.');
  END IF;

  -- Create Compound Balanced Journal Entry
  v_entry_num := 'PAY-' || replace(p_period, '-', '') || '-RUN';

  INSERT INTO public.journal_entries (
    organisation_id,
    fiscal_period_id,
    entry_number,
    entry_date,
    status,
    narration,
    posted_at,
    posted_by,
    created_by
  ) VALUES (
    p_org_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    v_entry_num,
    CURRENT_DATE,
    'posted',
    'Monthly Statutory Payroll Processing for Period ' || p_period,
    now(),
    p_user_id,
    p_user_id
  ) RETURNING id INTO v_journal_id;

  -- 1. Debit Leg: Gross Salary Expense (Debit)
  INSERT INTO public.journal_lines (journal_entry_id, ledger_id, line_number, debit, credit, narration)
  VALUES (v_journal_id, p_salary_expense_ledger_id, v_line_num, v_sum_gross, 0.00, 'Gross Salaries for ' || p_period);
  v_line_num := v_line_num + 1;

  -- 2. Credit Leg: EPF Payable (Credit)
  IF v_sum_epf > 0 AND p_epf_payable_ledger_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, ledger_id, line_number, debit, credit, narration)
    VALUES (v_journal_id, p_epf_payable_ledger_id, v_line_num, 0.00, v_sum_epf, 'Employee EPF Payable for ' || p_period);
    v_line_num := v_line_num + 1;
  END IF;

  -- 3. Credit Leg: ESIC Payable (Credit)
  IF v_sum_esic > 0 AND p_esic_payable_ledger_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, ledger_id, line_number, debit, credit, narration)
    VALUES (v_journal_id, p_esic_payable_ledger_id, v_line_num, 0.00, v_sum_esic, 'Employee ESIC Payable for ' || p_period);
    v_line_num := v_line_num + 1;
  END IF;

  -- 4. Credit Leg: Professional Tax Payable (Credit)
  IF v_sum_pt > 0 AND p_pt_payable_ledger_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, ledger_id, line_number, debit, credit, narration)
    VALUES (v_journal_id, p_pt_payable_ledger_id, v_line_num, 0.00, v_sum_pt, 'Professional Tax Payable for ' || p_period);
    v_line_num := v_line_num + 1;
  END IF;

  -- 5. Credit Leg: TDS Section 192 Payable (Credit)
  IF v_sum_tds > 0 AND p_tds_payable_ledger_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, ledger_id, line_number, debit, credit, narration)
    VALUES (v_journal_id, p_tds_payable_ledger_id, v_line_num, 0.00, v_sum_tds, 'TDS u/s 192 Payable for ' || p_period);
    v_line_num := v_line_num + 1;
  END IF;

  -- 6. Credit Leg: Net Salaries Payable (Credit)
  INSERT INTO public.journal_lines (journal_entry_id, ledger_id, line_number, debit, credit, narration)
  VALUES (v_journal_id, p_salaries_payable_ledger_id, v_line_num, 0.00, v_sum_net, 'Net Salaries Payable for ' || p_period);

  -- Link journal entry id to payroll items
  UPDATE public.payroll_run_items
  SET journal_entry_id = v_journal_id
  WHERE organisation_id = p_org_id AND payroll_period = p_period;

  RETURN jsonb_build_object(
    'success', true,
    'period', p_period,
    'journal_entry_id', v_journal_id,
    'total_gross', v_sum_gross,
    'total_deductions', (v_sum_gross - v_sum_net),
    'net_payable', v_sum_net
  );
END;
$$;

-- 4. RLS Policies
ALTER TABLE public.payroll_run_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Confidential payroll view for Owners and CFOs" ON public.payroll_run_items;
CREATE POLICY "Confidential payroll view for Owners and CFOs"
  ON public.payroll_run_items FOR SELECT TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.organisation_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage payroll run items" ON public.payroll_run_items;
CREATE POLICY "Admins can manage payroll run items"
  ON public.payroll_run_items FOR ALL TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.organisation_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
