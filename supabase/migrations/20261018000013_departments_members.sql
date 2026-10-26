-- Migration 13: Departments, Firm Personnel & Member Compensation Governance
-- Deku Finance - Organisational Hierarchy, Inter/Intra Department Tasks, Owner RBAC & Payroll

-- ============================================================================
-- 1. Custom Enums & Types
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_task_type') THEN
    CREATE TYPE public.department_task_type AS ENUM ('intra', 'inter');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_task_priority') THEN
    CREATE TYPE public.department_task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_task_status') THEN
    CREATE TYPE public.department_task_status AS ENUM ('todo', 'in_progress', 'review', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_role') THEN
    CREATE TYPE public.employee_role AS ENUM ('owner', 'admin', 'accountant', 'manager', 'member', 'viewer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
    CREATE TYPE public.employee_status AS ENUM ('active', 'on_leave', 'suspended');
  END IF;
END $$;

-- ============================================================================
-- 2. Departments Master Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL, -- e.g. 'MGMT', 'FIN', 'ENG', 'SAL'
  description text,
  lead_id uuid, -- Reference to public.employees(id), FK added after employees table creation
  lead_name text,
  lead_designation text,
  budget_allocated numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (budget_allocated >= 0),
  budget_utilized numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (budget_utilized >= 0),
  currency text NOT NULL DEFAULT 'INR',
  fiscal_year text NOT NULL DEFAULT '2026-27',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_departments_org_code UNIQUE (organisation_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_departments_code ON public.departments(organisation_id, code);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. Firm Employees & Members Directory Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  avatar_url text,
  designation text NOT NULL,
  is_owner boolean NOT NULL DEFAULT false, -- Prime license owner
  is_lead boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'accountant', 'manager', 'member', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'suspended')),
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  pan text,
  bank_account_masked text,

  -- Selective Platform Access Control (JSONB Matrix)
  permissions jsonb NOT NULL DEFAULT '{
    "can_view_vouchers": false,
    "can_create_vouchers": false,
    "can_view_banking": false,
    "can_view_financial_reports": false,
    "can_view_gst": false,
    "can_manage_parties": false,
    "can_manage_payroll": false,
    "can_access_audit_log": false
  }'::jsonb,

  -- Compensation & Payroll Tracking
  ctc_annual numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (ctc_annual >= 0),
  monthly_gross numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_gross >= 0),
  monthly_net numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_net >= 0),
  tds_deduction_monthly numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (tds_deduction_monthly >= 0),
  epf_monthly numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (epf_monthly >= 0),
  reimbursements_pending numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (reimbursements_pending >= 0),
  reimbursements_approved numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (reimbursements_approved >= 0),
  bonuses_accrued numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (bonuses_accrued >= 0),
  last_payroll_date text,
  payroll_status text NOT NULL DEFAULT 'pending' CHECK (payroll_status IN ('processed', 'pending', 'hold')),

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT uk_employees_org_email UNIQUE (organisation_id, email),
  CONSTRAINT chk_employees_pan_format CHECK (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$')
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON public.employees(organisation_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_dept ON public.employees(organisation_id, department_id);
CREATE INDEX IF NOT EXISTS idx_employees_owner ON public.employees(organisation_id, is_owner);
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(organisation_id, role);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Add circular foreign key for Department Lead safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_departments_lead_employee'
  ) THEN
    ALTER TABLE public.departments
      ADD CONSTRAINT fk_departments_lead_employee
      FOREIGN KEY (lead_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. Department Tasks (Intra & Inter-Departmental Routing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.department_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title text NOT NULL,
  task_type text NOT NULL DEFAULT 'intra' CHECK (task_type IN ('intra', 'inter')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed')),
  assigned_to_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_to_name text,
  target_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  target_department_name text,
  due_date date,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dept_tasks_org_dept ON public.department_tasks(organisation_id, department_id);
CREATE INDEX IF NOT EXISTS idx_dept_tasks_status ON public.department_tasks(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_dept_tasks_assignee ON public.department_tasks(assigned_to_id);

CREATE TRIGGER trg_dept_tasks_updated_at
  BEFORE UPDATE ON public.department_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. Employee Reimbursement Claims Ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  category text NOT NULL, -- e.g. 'Travel', 'Client Dinner', 'Tech Equipment', 'Office Supplies'
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed')),
  claimed_at timestamptz DEFAULT now() NOT NULL,
  approved_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reimbursements_emp ON public.employee_reimbursements(employee_id);
CREATE INDEX IF NOT EXISTS idx_reimbursements_status ON public.employee_reimbursements(organisation_id, status);

CREATE TRIGGER trg_employee_reimbursements_updated_at
  BEFORE UPDATE ON public.employee_reimbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. Payroll Execution History
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  period text NOT NULL, -- Format: YYYY-MM
  total_gross numeric(15, 2) NOT NULL,
  total_net_disbursed numeric(15, 2) NOT NULL,
  total_tds numeric(15, 2) NOT NULL,
  total_epf numeric(15, 2) NOT NULL,
  headcount int NOT NULL,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('draft', 'processed', 'cancelled')),
  executed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  executed_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT uk_payroll_runs_org_period UNIQUE (organisation_id, period)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_org ON public.payroll_runs(organisation_id);

-- ============================================================================
-- 7. Stored Procedures (RPCs for Rust Backend & Client Direct)
-- ============================================================================

-- A. Run Monthly Payroll Batch
CREATE OR REPLACE FUNCTION public.run_monthly_payroll(
  p_org_id uuid,
  p_period text,
  p_executed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int := 0;
  v_gross numeric(15, 2) := 0;
  v_net numeric(15, 2) := 0;
  v_tds numeric(15, 2) := 0;
  v_epf numeric(15, 2) := 0;
  v_run_id uuid;
BEGIN
  -- Compute totals for active personnel
  SELECT 
    COUNT(*),
    COALESCE(SUM(monthly_gross), 0),
    COALESCE(SUM(monthly_net), 0),
    COALESCE(SUM(tds_deduction_monthly), 0),
    COALESCE(SUM(epf_monthly), 0)
  INTO v_count, v_gross, v_net, v_tds, v_epf
  FROM public.employees
  WHERE organisation_id = p_org_id AND status = 'active';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active employees found in organisation');
  END IF;

  -- Update employee payroll statuses
  UPDATE public.employees
  SET 
    payroll_status = 'processed',
    last_payroll_date = CURRENT_DATE::text,
    updated_at = now()
  WHERE organisation_id = p_org_id AND status = 'active';

  -- Record or update payroll run
  INSERT INTO public.payroll_runs (
    organisation_id, period, total_gross, total_net_disbursed, total_tds, total_epf, headcount, executed_by, executed_at, status
  )
  VALUES (
    p_org_id, p_period, v_gross, v_net, v_tds, v_epf, v_count, p_executed_by, now(), 'processed'
  )
  ON CONFLICT (organisation_id, period) DO UPDATE
  SET 
    total_gross = EXCLUDED.total_gross,
    total_net_disbursed = EXCLUDED.total_net_disbursed,
    total_tds = EXCLUDED.total_tds,
    total_epf = EXCLUDED.total_epf,
    headcount = EXCLUDED.headcount,
    executed_at = now()
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'payroll_run_id', v_run_id,
    'period', p_period,
    'headcount', v_count,
    'total_net_disbursed', v_net,
    'total_tds', v_tds,
    'total_epf', v_epf
  );
END;
$$;

-- B. Approve Reimbursement Claim
CREATE OR REPLACE FUNCTION public.approve_employee_reimbursement(
  p_reimbursement_id uuid,
  p_approver_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp_id uuid;
  v_amt numeric(15, 2);
  v_status text;
BEGIN
  SELECT employee_id, amount, status INTO v_emp_id, v_amt, v_status
  FROM public.employee_reimbursements
  WHERE id = p_reimbursement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Reimbursement claim not found');
  END IF;

  IF v_status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Claim already approved');
  END IF;

  -- Update claim record
  UPDATE public.employee_reimbursements
  SET 
    status = 'approved',
    approved_by = p_approver_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_reimbursement_id;

  -- Adjust employee balances
  UPDATE public.employees
  SET 
    reimbursements_pending = GREATEST(0, reimbursements_pending - v_amt),
    reimbursements_approved = reimbursements_approved + v_amt,
    updated_at = now()
  WHERE id = v_emp_id;

  RETURN jsonb_build_object('success', true, 'approved_amount', v_amt, 'employee_id', v_emp_id);
END;
$$;

-- C. Grant Performance Bonus
CREATE OR REPLACE FUNCTION public.grant_employee_bonus(
  p_employee_id uuid,
  p_amount numeric(15, 2)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_bonus numeric(15, 2);
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bonus amount must be positive');
  END IF;

  UPDATE public.employees
  SET 
    bonuses_accrued = bonuses_accrued + p_amount,
    updated_at = now()
  WHERE id = p_employee_id
  RETURNING bonuses_accrued INTO v_new_bonus;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Employee record not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'employee_id', p_employee_id, 'bonuses_accrued', v_new_bonus);
END;
$$;

-- D. Owner-Guarded Permissions Updater
CREATE OR REPLACE FUNCTION public.update_employee_permissions(
  p_employee_id uuid,
  p_permissions jsonb,
  p_new_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_owner boolean;
BEGIN
  SELECT is_owner INTO v_is_owner
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Employee not found');
  END IF;

  -- If employee is prime owner, their permissions cannot be restricted
  IF v_is_owner THEN
    UPDATE public.employees
    SET 
      permissions = '{
        "can_view_vouchers": true,
        "can_create_vouchers": true,
        "can_view_banking": true,
        "can_view_financial_reports": true,
        "can_view_gst": true,
        "can_manage_parties": true,
        "can_manage_payroll": true,
        "can_access_audit_log": true
      }'::jsonb,
      role = 'owner',
      updated_at = now()
    WHERE id = p_employee_id;

    RETURN jsonb_build_object('success', true, 'message', 'Owner permissions are immutable and fully granted');
  END IF;

  -- Update regular employee
  UPDATE public.employees
  SET 
    permissions = p_permissions,
    role = COALESCE(p_new_role, role),
    updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'employee_id', p_employee_id);
END;
$$;

-- ============================================================================
-- 8. Row Level Security Policies
-- ============================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "departments_select_org_members"
  ON public.departments FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "employees_select_org_members"
  ON public.employees FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "tasks_select_org_members"
  ON public.department_tasks FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "reimbursements_select_org_members"
  ON public.employee_reimbursements FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "payroll_runs_select_org_members"
  ON public.payroll_runs FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

-- Modification policies: Only owners/admins can insert/modify departments and employees
CREATE POLICY "departments_modify_owners"
  ON public.departments FOR ALL TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]));

CREATE POLICY "employees_modify_owners"
  ON public.employees FOR ALL TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]));

CREATE POLICY "tasks_modify_permitted"
  ON public.department_tasks FOR ALL TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[]));

CREATE POLICY "payroll_runs_modify_owners"
  ON public.payroll_runs FOR ALL TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]));

-- ============================================================================
-- 9. Seed Data for Deku Financial Technologies
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_owner_emp_id uuid;
  v_fin_lead_id uuid;
  v_eng_lead_id uuid;
  v_sal_lead_id uuid;
  v_dept_mgmt_id uuid;
  v_dept_fin_id uuid;
  v_dept_eng_id uuid;
  v_dept_sal_id uuid;
BEGIN
  -- Look for Deku Financial Technologies
  SELECT id INTO v_org_id 
  FROM public.organisations 
  WHERE name ILIKE '%Deku Financial%' OR slug ILIKE '%deku%' 
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    -- A. Seed 4 core departments
    INSERT INTO public.departments (
      organisation_id, name, code, description, budget_allocated, budget_utilized, currency, fiscal_year
    )
    VALUES
      (v_org_id, 'Executive & Corporate Governance', 'MGMT', 'Firm-wide leadership, license administration and strategic capital allocation', 4500000.00, 2450000.00, 'INR', '2026-27'),
      (v_org_id, 'Finance & Accounts', 'FIN', 'ALERX double-entry ledger management, GST filing, cashflow liquidity and audit compliance', 6500000.00, 3840000.00, 'INR', '2026-27'),
      (v_org_id, 'Engineering & Infrastructure', 'ENG', 'Financial OS core engine, cryptography, API gateways, database scalability & security', 12000000.00, 8540000.00, 'INR', '2026-27'),
      (v_org_id, 'Sales & Client Operations', 'SAL', 'Enterprise account acquisitions, ERP integrations, institutional onboarding & customer success', 5000000.00, 3000000.00, 'INR', '2026-27')
    ON CONFLICT (organisation_id, code) DO NOTHING;

    SELECT id INTO v_dept_mgmt_id FROM public.departments WHERE organisation_id = v_org_id AND code = 'MGMT';
    SELECT id INTO v_dept_fin_id FROM public.departments WHERE organisation_id = v_org_id AND code = 'FIN';
    SELECT id INTO v_dept_eng_id FROM public.departments WHERE organisation_id = v_org_id AND code = 'ENG';
    SELECT id INTO v_dept_sal_id FROM public.departments WHERE organisation_id = v_org_id AND code = 'SAL';

    -- B. Seed Prime Employee & Members
    -- 1. Prime Owner: Medhansh K.
    INSERT INTO public.employees (
      organisation_id, department_id, name, email, phone, designation, is_owner, is_lead, role, status,
      pan, bank_account_masked,
      permissions,
      ctc_annual, monthly_gross, monthly_net, tds_deduction_monthly, epf_monthly, reimbursements_pending, reimbursements_approved, bonuses_accrued, payroll_status
    )
    VALUES (
      v_org_id, v_dept_mgmt_id, 'Medhansh K.', 'founder@dekufinance.com', '+91 98200 11000', 'Founder & Chief Executive Officer', true, true, 'owner', 'active',
      'AAAPK1029M', 'HDFC •••• 9012',
      '{"can_view_vouchers": true, "can_create_vouchers": true, "can_view_banking": true, "can_view_financial_reports": true, "can_view_gst": true, "can_manage_parties": true, "can_manage_payroll": true, "can_access_audit_log": true}'::jsonb,
      4800000.00, 400000.00, 318000.00, 62000.00, 20000.00, 18500.00, 45000.00, 500000.00, 'processed'
    )
    ON CONFLICT (organisation_id, email) DO UPDATE
    SET is_owner = true, role = 'owner'
    RETURNING id INTO v_owner_emp_id;

    -- 2. Finance Lead: Rohan Sharma
    INSERT INTO public.employees (
      organisation_id, department_id, name, email, phone, designation, is_owner, is_lead, role, status,
      pan, bank_account_masked,
      permissions,
      ctc_annual, monthly_gross, monthly_net, tds_deduction_monthly, epf_monthly, reimbursements_pending, reimbursements_approved, bonuses_accrued, payroll_status
    )
    VALUES (
      v_org_id, v_dept_fin_id, 'Rohan Sharma', 'rohan.sharma@dekufinance.com', '+91 98330 22114', 'VP of Finance & Chief Accountant', false, true, 'accountant', 'active',
      'BPNRS4829K', 'ICICI •••• 4421',
      '{"can_view_vouchers": true, "can_create_vouchers": true, "can_view_banking": true, "can_view_financial_reports": true, "can_view_gst": true, "can_manage_parties": true, "can_manage_payroll": true, "can_access_audit_log": true}'::jsonb,
      2800000.00, 233333.00, 188000.00, 31333.00, 14000.00, 8200.00, 24000.00, 180000.00, 'processed'
    )
    ON CONFLICT (organisation_id, email) DO NOTHING
    RETURNING id INTO v_fin_lead_id;

    -- 3. Senior Tax: Priya Iyer
    INSERT INTO public.employees (
      organisation_id, department_id, name, email, phone, designation, is_owner, is_lead, role, status,
      pan, bank_account_masked,
      permissions,
      ctc_annual, monthly_gross, monthly_net, tds_deduction_monthly, epf_monthly, reimbursements_pending, reimbursements_approved, bonuses_accrued, payroll_status
    )
    VALUES (
      v_org_id, v_dept_fin_id, 'Priya Iyer', 'priya.iyer@dekufinance.com', '+91 98110 33445', 'Senior Tax & GST Specialist', false, false, 'accountant', 'active',
      'CPIIY9012L', 'SBI •••• 8820',
      '{"can_view_vouchers": true, "can_create_vouchers": false, "can_view_banking": false, "can_view_financial_reports": true, "can_view_gst": true, "can_manage_parties": true, "can_manage_payroll": false, "can_access_audit_log": false}'::jsonb,
      1600000.00, 133333.00, 112000.00, 13333.00, 8000.00, 3400.00, 12000.00, 95000.00, 'processed'
    )
    ON CONFLICT (organisation_id, email) DO NOTHING;

    -- 4. Eng Lead: Vikramaditya Sen
    INSERT INTO public.employees (
      organisation_id, department_id, name, email, phone, designation, is_owner, is_lead, role, status,
      pan, bank_account_masked,
      permissions,
      ctc_annual, monthly_gross, monthly_net, tds_deduction_monthly, epf_monthly, reimbursements_pending, reimbursements_approved, bonuses_accrued, payroll_status
    )
    VALUES (
      v_org_id, v_dept_eng_id, 'Vikramaditya Sen', 'vikram@dekufinance.com', '+91 98450 55667', 'Chief Technology Officer', false, true, 'manager', 'active',
      'DSVSE2019P', 'KOTAK •••• 1194',
      '{"can_view_vouchers": false, "can_create_vouchers": false, "can_view_banking": false, "can_view_financial_reports": false, "can_view_gst": false, "can_manage_parties": false, "can_manage_payroll": false, "can_access_audit_log": true}'::jsonb,
      3600000.00, 300000.00, 242000.00, 42000.00, 16000.00, 12400.00, 31000.00, 300000.00, 'processed'
    )
    ON CONFLICT (organisation_id, email) DO NOTHING
    RETURNING id INTO v_eng_lead_id;

    -- 5. Sales Lead: Neha Kapur
    INSERT INTO public.employees (
      organisation_id, department_id, name, email, phone, designation, is_owner, is_lead, role, status,
      pan, bank_account_masked,
      permissions,
      ctc_annual, monthly_gross, monthly_net, tds_deduction_monthly, epf_monthly, reimbursements_pending, reimbursements_approved, bonuses_accrued, payroll_status
    )
    VALUES (
      v_org_id, v_dept_sal_id, 'Neha Kapur', 'neha.kapur@dekufinance.com', '+91 98710 66778', 'VP of Sales & Growth', false, true, 'manager', 'active',
      'MNKAP6644T', 'ICICI •••• 9912',
      '{"can_view_vouchers": true, "can_create_vouchers": false, "can_view_banking": false, "can_view_financial_reports": false, "can_view_gst": false, "can_manage_parties": true, "can_manage_payroll": false, "can_access_audit_log": false}'::jsonb,
      3200000.00, 266667.00, 215000.00, 36667.00, 15000.00, 22500.00, 68000.00, 350000.00, 'processed'
    )
    ON CONFLICT (organisation_id, email) DO NOTHING
    RETURNING id INTO v_sal_lead_id;

    -- Update lead designations on departments
    UPDATE public.departments SET lead_id = v_owner_emp_id, lead_name = 'Medhansh K. (License Owner)', lead_designation = 'Founder & Chief Executive Officer' WHERE id = v_dept_mgmt_id;
    UPDATE public.departments SET lead_id = v_fin_lead_id, lead_name = 'Rohan Sharma', lead_designation = 'VP of Finance & Chief Accountant' WHERE id = v_dept_fin_id;
    UPDATE public.departments SET lead_id = v_eng_lead_id, lead_name = 'Vikramaditya Sen', lead_designation = 'Chief Technology Officer' WHERE id = v_dept_eng_id;
    UPDATE public.departments SET lead_id = v_sal_lead_id, lead_name = 'Neha Kapur', lead_designation = 'VP of Sales & Growth' WHERE id = v_dept_sal_id;

    -- C. Seed Sample Inter/Intra Departmental Tasks
    INSERT INTO public.department_tasks (
      organisation_id, department_id, title, task_type, priority, status, assigned_to_name, target_department_name, due_date
    )
    VALUES
      (v_org_id, v_dept_mgmt_id, 'Annual Deku License Rights & Compliance Audit', 'intra', 'urgent', 'in_progress', 'Medhansh K. (License Owner)', NULL, '2026-11-15'),
      (v_org_id, v_dept_mgmt_id, 'Q3 Departmental Budget Allocation & Headcount Approval', 'inter', 'high', 'in_progress', 'Medhansh K. (License Owner)', 'Finance & Accounts', '2026-10-31'),
      (v_org_id, v_dept_fin_id, 'GSTR-1 & GSTR-3B Monthly Return Filing Reconciliation', 'intra', 'urgent', 'in_progress', 'Priya Iyer', NULL, '2026-10-25'),
      (v_org_id, v_dept_fin_id, 'Cross-Department Cloud Infra AWS Capex Verification', 'inter', 'high', 'in_progress', 'Rohan Sharma', 'Engineering & Infrastructure', '2026-10-28'),
      (v_org_id, v_dept_eng_id, 'Rust Backend Migration & Axum Microservice Scale Test', 'intra', 'high', 'completed', 'Vikramaditya Sen', NULL, '2026-10-18'),
      (v_org_id, v_dept_sal_id, 'Apex Enterprise Systems Contract Renewal & BOS Invoicing', 'inter', 'urgent', 'in_progress', 'Neha Kapur', 'Finance & Accounts', '2026-11-05')
    ON CONFLICT DO NOTHING;

  END IF;
END $$;
