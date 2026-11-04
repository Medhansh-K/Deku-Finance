-- Deku Finance - one customer per deployment.
-- Licensing is out of scope for this runtime (docs/Deku_Finance_Runtime_Completion_and_Deployment_Plan.md
-- section 2), so a company no longer starts a trial that locks it out after 20 days. The GO and PRO plans
-- and their limit checks stay for a later hosted product. Signup closes after the first administrator;
-- everyone else joins by invitation.

CREATE OR REPLACE FUNCTION public.is_demo_user(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT coalesce((SELECT (u.raw_user_meta_data->>'is_demo')::boolean FROM auth.users u WHERE u.id = p_user), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_demo_user(uuid) FROM PUBLIC, anon, authenticated;

INSERT INTO public.plans (code, name, limits) VALUES
  ('single_org', 'Single organisation',
   '{"max_monthly_invoices": null, "seats": null, "gstn_json": true, "direct_filing": true, "payments": true}')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.start_organisation_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (organisation_id, plan_code, status)
  VALUES (NEW.id, 'single_org', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

UPDATE public.subscriptions
   SET plan_code = 'single_org', status = 'active', trial_ends_at = NULL, current_period_end = NULL
 WHERE status = 'trialing';

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

  RETURN v_org_id;
END;
$$;

-- p_first_admin_allowed comes from the backend's DEKU_ADMIN_EMAIL check. The lock stops two people
-- both becoming the first administrator.
CREATE OR REPLACE FUNCTION public.auth_register_guarded(
  p_email text,
  p_password_hash text,
  p_meta jsonb,
  p_first_admin_allowed boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('deku_signup'));
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_invitations i
    WHERE lower(i.email) = lower(trim(p_email)) AND i.status = 'pending' AND i.expires_at > now()
  ) AND NOT (
    p_first_admin_allowed
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE NOT public.is_demo_user(u.id))
  ) THEN
    RAISE EXCEPTION 'signup_closed';
  END IF;
  RETURN public.auth_register(p_email, p_password_hash, p_meta);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_register_guarded(text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_register_guarded(text, text, jsonb, boolean) TO service_role;
