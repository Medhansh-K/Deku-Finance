-- Deku Finance - a company starts with its chart of accounts, and voucher numbers come from the server.

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

  RETURN v_org_id;
END;
$$;

-- The next number after the highest used under this prefix. Runs as the caller, so row-level security
-- applies. Two people saving at once are still separated by uk_journal_entries_org_num.
CREATE OR REPLACE FUNCTION public.next_voucher_number(p_org_id uuid, p_prefix text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_prefix || '-' || lpad(
    (coalesce(max(substr(e.entry_number, length(p_prefix) + 2)::bigint), 0) + 1)::text, 4, '0')
  FROM public.journal_entries e
  WHERE e.organisation_id = p_org_id
    AND left(e.entry_number, length(p_prefix) + 1) = p_prefix || '-'
    AND substr(e.entry_number, length(p_prefix) + 2) ~ '^[0-9]{1,12}$';
$$;
REVOKE EXECUTE ON FUNCTION public.next_voucher_number(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_voucher_number(uuid, text) TO authenticated, service_role;
