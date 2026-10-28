-- Migration 22: caller checks for payroll and licence issuance
-- Deku Finance
--
-- Both functions are SECURITY DEFINER (they bypass row-level security) but never checked who
-- was calling: any signed-in user could run payroll for any company, or issue any company a
-- paid "plan" licence for free. Neither pinned search_path, which lets a caller shadow the
-- tables they use. Generated from the latest definitions; only the check and search_path differ.

-- run_monthly_payroll: latest definition from 20261018000013_departments_members.sql; changed: caller check added
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
  IF NOT (public.is_superadmin() OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[])) THEN
    RAISE EXCEPTION 'Permission denied: only the owner, CFO or admin can run payroll';
  END IF;
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

ALTER FUNCTION public.run_monthly_payroll(uuid, text, uuid) SET search_path = public;

-- issue_organisation_license: latest definition from 20261018000012_organisation_licenses.sql; changed: caller check added
CREATE OR REPLACE FUNCTION public.issue_organisation_license(
  p_org_id uuid,
  p_owner_email text,
  p_type text DEFAULT 'temp',
  p_tier text DEFAULT 'go',
  p_tenure_days int DEFAULT 30
)
RETURNS public.organisation_licenses
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license_key text;
  v_trial_ends timestamptz := NULL;
  v_grace_ends timestamptz := NULL;
  v_expires timestamptz;
  v_result public.organisation_licenses;
BEGIN
  -- Paid plans are issued by the platform; a company may only start its own first trial.
  IF NOT (
    public.is_superadmin()
    OR (p_type = 'temp'
        AND public.has_role(p_org_id, ARRAY['owner', 'admin']::public.organisation_role[])
        AND NOT EXISTS (SELECT 1 FROM public.organisation_licenses WHERE organisation_id = p_org_id))
  ) THEN
    RAISE EXCEPTION 'Permission denied: licences are issued by Deku; a company can start one free trial';
  END IF;
  v_license_key := public.generate_license_key(p_type, p_tier);

  IF p_type = 'temp' THEN
    -- 15 days unrestricted trial + 5 days migration/purchase grace period = 20 days total access
    v_trial_ends := now() + INTERVAL '15 days';
    v_grace_ends := now() + INTERVAL '20 days';
    v_expires := v_grace_ends;
  ELSE
    -- Plan license: terminates strictly as per plan tenure
    v_expires := now() + (p_tenure_days || ' days')::interval;
  END IF;

  INSERT INTO public.organisation_licenses (
    organisation_id,
    license_key,
    license_type,
    plan_tier,
    owner_email,
    issued_at,
    trial_ends_at,
    grace_period_ends_at,
    expires_at,
    status,
    features
  )
  VALUES (
    p_org_id,
    v_license_key,
    p_type,
    p_tier,
    p_owner_email,
    now(),
    v_trial_ends,
    v_grace_ends,
    v_expires,
    'pending_activation',
    jsonb_build_object(
      'max_monthly_bills', CASE WHEN p_tier = 'go' THEN 150 ELSE -1 END,
      'has_gstn_json', CASE WHEN p_tier = 'pro' THEN true ELSE false END,
      'has_custom_fields', true,
      'has_upi_qr', true,
      'seats', CASE WHEN p_tier = 'go' THEN 2 ELSE -1 END
    )
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.issue_organisation_license(uuid, text, text, text, int) SET search_path = public;
