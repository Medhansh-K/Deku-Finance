-- Migration: 20261114000062_fixed_assets_and_depreciation.sql
-- Description: Client-End ERP Kernel: Fixed Asset Register, SLM/WDV Schedule Generator, and 1-Click Batch Depreciation Journal Posting.

-- 1. Fixed Assets Master Table
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('plant_machinery', 'computers', 'furniture_fixtures', 'vehicles', 'buildings', 'land', 'other')),
  purchase_date DATE NOT NULL,
  put_to_use_date DATE NOT NULL,
  purchase_cost NUMERIC(15, 2) NOT NULL CHECK (purchase_cost >= 0),
  salvage_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (salvage_value >= 0),
  depreciation_method TEXT NOT NULL CHECK (depreciation_method IN ('slm', 'wdv')),
  useful_life_years NUMERIC(5, 2) NOT NULL CHECK (useful_life_years > 0),
  depreciation_rate_pct NUMERIC(5, 2) NOT NULL CHECK (depreciation_rate_pct >= 0),
  accumulated_depreciation NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (accumulated_depreciation >= 0),
  current_book_value NUMERIC(15, 2) NOT NULL CHECK (current_book_value >= 0),
  fixed_asset_ledger_id UUID NOT NULL REFERENCES public.ledgers(id) ON DELETE RESTRICT,
  accumulated_depreciation_ledger_id UUID NOT NULL REFERENCES public.ledgers(id) ON DELETE RESTRICT,
  depreciation_expense_ledger_id UUID NOT NULL REFERENCES public.ledgers(id) ON DELETE RESTRICT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'scrapped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_fixed_assets_org_code UNIQUE (organisation_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_org ON public.fixed_assets(organisation_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON public.fixed_assets(status);

-- 2. Fixed Asset Depreciation Schedules Table
CREATE TABLE IF NOT EXISTS public.asset_depreciation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  opening_book_value NUMERIC(15, 2) NOT NULL,
  depreciation_amount NUMERIC(15, 2) NOT NULL CHECK (depreciation_amount >= 0),
  closing_book_value NUMERIC(15, 2) NOT NULL CHECK (closing_book_value >= 0),
  is_posted BOOLEAN NOT NULL DEFAULT false,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_asset_schedule_date UNIQUE (asset_id, schedule_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_schedules_asset ON public.asset_depreciation_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_schedules_posted ON public.asset_depreciation_schedules(is_posted);

-- 3. Stored Procedure: Generate Amortization / Depreciation Schedule
CREATE OR REPLACE FUNCTION public.generate_asset_depreciation_schedule(p_asset_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_asset RECORD;
  v_months INT;
  v_month_idx INT;
  v_current_book NUMERIC(15, 2);
  v_dep_amount NUMERIC(15, 2);
  v_schedule_date DATE;
  v_annual_rate NUMERIC(15, 6);
  v_monthly_rate NUMERIC(15, 6);
BEGIN
  SELECT * INTO v_asset
  FROM public.fixed_assets
  WHERE id = p_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fixed asset not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Clear existing unposted schedules
  DELETE FROM public.asset_depreciation_schedules
  WHERE asset_id = p_asset_id AND is_posted = false;

  v_months := ROUND(v_asset.useful_life_years * 12);
  v_current_book := v_asset.purchase_cost;
  v_schedule_date := v_asset.put_to_use_date;

  IF v_asset.depreciation_method = 'slm' THEN
    -- Straight Line Method: (Cost - Salvage) / Months
    v_dep_amount := ROUND((v_asset.purchase_cost - v_asset.salvage_value) / v_months, 2);
  END IF;

  v_annual_rate := v_asset.depreciation_rate_pct / 100.0;
  v_monthly_rate := v_annual_rate / 12.0;

  FOR v_month_idx IN 1..v_months LOOP
    v_schedule_date := v_schedule_date + INTERVAL '1 month';

    IF v_asset.depreciation_method = 'wdv' THEN
      -- Written Down Value: Book * monthly rate
      v_dep_amount := ROUND(v_current_book * v_monthly_rate, 2);
    END IF;

    -- Ensure we don't depreciate below salvage value
    IF (v_current_book - v_dep_amount) < v_asset.salvage_value THEN
      v_dep_amount := GREATEST(v_current_book - v_asset.salvage_value, 0.00);
    END IF;

    EXIT WHEN v_dep_amount <= 0;

    INSERT INTO public.asset_depreciation_schedules (
      asset_id,
      schedule_date,
      opening_book_value,
      depreciation_amount,
      closing_book_value,
      is_posted
    ) VALUES (
      p_asset_id,
      v_schedule_date,
      v_current_book,
      v_dep_amount,
      v_current_book - v_dep_amount,
      false
    )
    ON CONFLICT (asset_id, schedule_date) DO NOTHING;

    v_current_book := v_current_book - v_dep_amount;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'asset_id', p_asset_id, 'months_scheduled', v_months);
END;
$$;

-- 4. Stored Procedure: 1-Click Batch Post Depreciation to General Ledger
CREATE OR REPLACE FUNCTION public.post_depreciation_run(
  p_org_id UUID,
  p_run_date DATE,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sched RECORD;
  v_entry_id UUID;
  v_entry_num TEXT;
  v_posted_count INT := 0;
  v_total_dep NUMERIC(15, 2) := 0;
BEGIN
  FOR v_sched IN
    SELECT
      s.id AS schedule_id,
      s.depreciation_amount,
      s.schedule_date,
      a.id AS asset_id,
      a.asset_code,
      a.asset_name,
      a.depreciation_expense_ledger_id,
      a.accumulated_depreciation_ledger_id,
      a.department_id
    FROM public.asset_depreciation_schedules s
    JOIN public.fixed_assets a ON a.id = s.asset_id
    WHERE a.organisation_id = p_org_id
      AND a.status = 'active'
      AND s.is_posted = false
      AND s.schedule_date <= p_run_date
    ORDER BY s.schedule_date ASC
  LOOP
    -- Generate Journal Entry Number
    v_entry_num := 'DEP-' || to_char(v_sched.schedule_date, 'YYYYMM') || '-' || v_sched.asset_code;

    -- Create Journal Header
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
      v_sched.schedule_date,
      'posted',
      'Automated Depreciation: ' || v_sched.asset_name || ' (' || v_sched.asset_code || ')',
      now(),
      p_user_id,
      p_user_id
    ) RETURNING id INTO v_entry_id;

    -- Create Debit Leg (Depreciation Expense Dr)
    INSERT INTO public.journal_lines (
      journal_entry_id,
      ledger_id,
      department_id,
      line_number,
      debit,
      credit,
      narration
    ) VALUES (
      v_entry_id,
      v_sched.depreciation_expense_ledger_id,
      v_sched.department_id,
      1,
      v_sched.depreciation_amount,
      0.00,
      'Depreciation Expense for ' || v_sched.asset_name
    );

    -- Create Credit Leg (Accumulated Depreciation Cr)
    INSERT INTO public.journal_lines (
      journal_entry_id,
      ledger_id,
      department_id,
      line_number,
      debit,
      credit,
      narration
    ) VALUES (
      v_entry_id,
      v_sched.accumulated_depreciation_ledger_id,
      v_sched.department_id,
      2,
      0.00,
      v_sched.depreciation_amount,
      'Accumulated Depreciation for ' || v_sched.asset_name
    );

    -- Mark Schedule Row as Posted
    UPDATE public.asset_depreciation_schedules
    SET is_posted = true,
        journal_entry_id = v_entry_id
    WHERE id = v_sched.schedule_id;

    -- Update Asset Totals
    UPDATE public.fixed_assets
    SET accumulated_depreciation = accumulated_depreciation + v_sched.depreciation_amount,
        current_book_value = GREATEST(current_book_value - v_sched.depreciation_amount, salvage_value),
        updated_at = now()
    WHERE id = v_sched.asset_id;

    v_posted_count := v_posted_count + 1;
    v_total_dep := v_total_dep + v_sched.depreciation_amount;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'run_date', p_run_date,
    'posted_schedules', v_posted_count,
    'total_depreciation_posted', v_total_dep
  );
END;
$$;

-- 5. RLS Policies
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view fixed assets" ON public.fixed_assets;
CREATE POLICY "Members can view fixed assets"
  ON public.fixed_assets FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage fixed assets" ON public.fixed_assets;
CREATE POLICY "Admins can manage fixed assets"
  ON public.fixed_assets FOR ALL TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant')));

DROP POLICY IF EXISTS "Members can view asset schedules" ON public.asset_depreciation_schedules;
CREATE POLICY "Members can view asset schedules"
  ON public.asset_depreciation_schedules FOR SELECT TO authenticated
  USING (asset_id IN (SELECT id FROM public.fixed_assets WHERE organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid())));
