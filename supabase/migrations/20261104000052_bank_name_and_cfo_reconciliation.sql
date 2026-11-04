-- Deku Finance - neutral bank ledger name for new companies; a CFO can reconcile, as they can approve vouchers.

CREATE OR REPLACE FUNCTION public.create_organisation(
  p_name text,
  p_slug text,
  p_currency text DEFAULT 'INR',
  p_timezone text DEFAULT 'Asia/Kolkata',
  p_gstin text DEFAULT NULL,
  p_pan text DEFAULT NULL,
  p_fy_start_month smallint DEFAULT 4
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create an organisation';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Organisation name cannot be empty';
  END IF;

  IF trim(p_slug) = '' THEN
    RAISE EXCEPTION 'Organisation slug cannot be empty';
  END IF;

  -- One customer per deployment. Demo companies don't count, so a demo stack can still set up a real one.
  PERFORM pg_advisory_xact_lock(hashtext('deku_single_organisation'));
  IF NOT public.is_demo_user(v_user_id) AND EXISTS (
    SELECT 1 FROM public.organisations o WHERE NOT public.is_demo_user(o.created_by)
  ) THEN
    RAISE EXCEPTION 'single_organisation';
  END IF;

  -- Create organisation
  INSERT INTO public.organisations (
    name,
    slug,
    currency,
    timezone,
    gstin,
    pan,
    financial_year_start_month,
    created_by
  )
  VALUES (
    p_name,
    p_slug,
    COALESCE(p_currency, 'INR'),
    COALESCE(p_timezone, 'Asia/Kolkata'),
    p_gstin,
    p_pan,
    COALESCE(p_fy_start_month, 4),
    v_user_id
  )
  RETURNING id INTO v_org_id;

  -- Add caller as owner atomically
  INSERT INTO public.organisation_members (
    organisation_id,
    user_id,
    role,
    invited_by
  )
  VALUES (
    v_org_id,
    v_user_id,
    'owner',
    v_user_id
  );

  -- With the company, so no path into the app leaves it without a chart of accounts.
  PERFORM public.seed_default_chart_of_accounts(v_org_id);
  -- The chart names one bank, which a company may not use.
  UPDATE public.accounts SET name = 'Operating Bank Account', label = 'Bank Current Account'
  WHERE organisation_id = v_org_id AND code = '1020';

  RETURN v_org_id;
END;
$$;

DROP POLICY IF EXISTS "bank_reconciliations_insert" ON public.bank_reconciliations;
CREATE POLICY "bank_reconciliations_insert"
  ON public.bank_reconciliations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND reconciled_by = auth.uid()
  );
