-- Migration: 20261114000067_fpa_scenario_forecasting.sql
-- Description: Client-End ERP Kernel: FP&A Multi-Scenario Financial Forecasting (12-Month Rolling Cash Runway, P&L Best/Base/Worst Case Sensitivity).

-- 1. Forecast Scenarios Table
CREATE TABLE IF NOT EXISTS public.fpa_forecast_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scenario_key TEXT NOT NULL CHECK (scenario_key IN ('base', 'best', 'worst', 'custom')),
  revenue_growth_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  expense_inflation_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  collection_delay_days INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_fpa_scenario_key UNIQUE (organisation_id, scenario_key)
);

CREATE INDEX IF NOT EXISTS idx_fpa_scenarios_org ON public.fpa_forecast_scenarios(organisation_id);

-- Enable RLS
ALTER TABLE public.fpa_forecast_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY fpa_scenarios_org_isolation ON public.fpa_forecast_scenarios
  FOR ALL
  USING (organisation_id = (current_setting('app.current_organisation_id', true))::uuid)
  WITH CHECK (organisation_id = (current_setting('app.current_organisation_id', true))::uuid);

-- 2. Forecast Monthly Projections Cache
CREATE TABLE IF NOT EXISTS public.fpa_forecast_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.fpa_forecast_scenarios(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  month_index INTEGER NOT NULL CHECK (month_index BETWEEN 1 AND 12),
  month_label TEXT NOT NULL,
  projected_revenue NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  projected_opex NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  projected_net_burn NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  projected_closing_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_fpa_proj_month UNIQUE (scenario_id, month_index)
);

CREATE INDEX IF NOT EXISTS idx_fpa_projections_scenario ON public.fpa_forecast_projections(scenario_id);

-- Enable RLS
ALTER TABLE public.fpa_forecast_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY fpa_projections_org_isolation ON public.fpa_forecast_projections
  FOR ALL
  USING (organisation_id = (current_setting('app.current_organisation_id', true))::uuid)
  WITH CHECK (organisation_id = (current_setting('app.current_organisation_id', true))::uuid);

-- 3. Stored Procedure: Seed Default Scenarios & Compute 12-Month Projections
CREATE OR REPLACE FUNCTION public.compute_12m_forecast_scenarios(
  p_org_id UUID,
  p_baseline_monthly_revenue NUMERIC DEFAULT 100000.00,
  p_baseline_monthly_opex NUMERIC DEFAULT 80000.00,
  p_current_cash_balance NUMERIC DEFAULT 500000.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_id UUID;
  v_best_id UUID;
  v_worst_id UUID;
  v_month INT;
  v_date DATE := CURRENT_DATE;
  v_month_label TEXT;
  
  -- Running balances
  v_rev_base NUMERIC(15, 2);
  v_opex_base NUMERIC(15, 2);
  v_cash_base NUMERIC(15, 2) := p_current_cash_balance;

  v_rev_best NUMERIC(15, 2);
  v_opex_best NUMERIC(15, 2);
  v_cash_best NUMERIC(15, 2) := p_current_cash_balance;

  v_rev_worst NUMERIC(15, 2);
  v_opex_worst NUMERIC(15, 2);
  v_cash_worst NUMERIC(15, 2) := p_current_cash_balance;
BEGIN
  -- 1. Upsert Base Case (Conservative +5% Growth, +3% Inflation)
  INSERT INTO public.fpa_forecast_scenarios (organisation_id, name, scenario_key, revenue_growth_pct, expense_inflation_pct, collection_delay_days, notes)
  VALUES (p_org_id, 'Base Case (Expected)', 'base', 5.00, 3.00, 0, 'Conservative business trajectory based on trailing run-rate.')
  ON CONFLICT (organisation_id, scenario_key) DO UPDATE
    SET name = EXCLUDED.name, updated_at = now()
  RETURNING id INTO v_base_id;

  -- 2. Upsert Best Case (Optimistic +20% Growth, +2% Inflation)
  INSERT INTO public.fpa_forecast_scenarios (organisation_id, name, scenario_key, revenue_growth_pct, expense_inflation_pct, collection_delay_days, notes)
  VALUES (p_org_id, 'Best Case (Bullish)', 'best', 20.00, 2.00, -5, 'Accelerated customer acquisitions and improved debtor turnaround.')
  ON CONFLICT (organisation_id, scenario_key) DO UPDATE
    SET name = EXCLUDED.name, updated_at = now()
  RETURNING id INTO v_best_id;

  -- 3. Upsert Worst Case (Stress Test -15% Growth, +8% Inflation, 20-day Delay)
  INSERT INTO public.fpa_forecast_scenarios (organisation_id, name, scenario_key, revenue_growth_pct, expense_inflation_pct, collection_delay_days, notes)
  VALUES (p_org_id, 'Stress Test (Worst Case)', 'worst', -15.00, 8.00, 20, 'Revenue contraction, supply chain inflation, and extended credit cycle.')
  ON CONFLICT (organisation_id, scenario_key) DO UPDATE
    SET name = EXCLUDED.name, updated_at = now()
  RETURNING id INTO v_worst_id;

  -- Clear previous projections
  DELETE FROM public.fpa_forecast_projections WHERE scenario_id IN (v_base_id, v_best_id, v_worst_id);

  -- Compute 12-month projections
  v_rev_base := p_baseline_monthly_revenue;
  v_opex_base := p_baseline_monthly_opex;

  v_rev_best := p_baseline_monthly_revenue;
  v_opex_best := p_baseline_monthly_opex;

  v_rev_worst := p_baseline_monthly_revenue;
  v_opex_worst := p_baseline_monthly_opex;

  FOR v_month IN 1..12 LOOP
    v_month_label := to_char(v_date + (v_month || ' month')::interval, 'Mon YYYY');

    -- Base scenario step
    v_rev_base := ROUND(v_rev_base * (1 + (0.05 / 12)), 2);
    v_opex_base := ROUND(v_opex_base * (1 + (0.03 / 12)), 2);
    v_cash_base := v_cash_base + (v_rev_base - v_opex_base);
    INSERT INTO public.fpa_forecast_projections (scenario_id, organisation_id, month_index, month_label, projected_revenue, projected_opex, projected_net_burn, projected_closing_cash)
    VALUES (v_base_id, p_org_id, v_month, v_month_label, v_rev_base, v_opex_base, v_opex_base - v_rev_base, v_cash_base);

    -- Best scenario step
    v_rev_best := ROUND(v_rev_best * (1 + (0.20 / 12)), 2);
    v_opex_best := ROUND(v_opex_best * (1 + (0.02 / 12)), 2);
    v_cash_best := v_cash_best + (v_rev_best - v_opex_best);
    INSERT INTO public.fpa_forecast_projections (scenario_id, organisation_id, month_index, month_label, projected_revenue, projected_opex, projected_net_burn, projected_closing_cash)
    VALUES (v_best_id, p_org_id, v_month, v_month_label, v_rev_best, v_opex_best, v_opex_best - v_rev_best, v_cash_best);

    -- Worst scenario step
    v_rev_worst := ROUND(v_rev_worst * (1 - (0.15 / 12)), 2);
    v_opex_worst := ROUND(v_opex_worst * (1 + (0.08 / 12)), 2);
    v_cash_worst := v_cash_worst + (v_rev_worst - v_opex_worst);
    INSERT INTO public.fpa_forecast_projections (scenario_id, organisation_id, month_index, month_label, projected_revenue, projected_opex, projected_net_burn, projected_closing_cash)
    VALUES (v_worst_id, p_org_id, v_month, v_month_label, v_rev_worst, v_opex_worst, v_opex_worst - v_rev_worst, v_cash_worst);
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'organisation_id', p_org_id,
    'current_cash', p_current_cash_balance,
    'scenarios', jsonb_build_array('base', 'best', 'worst'),
    'projections_generated', 36
  );
END;
$$;
