-- Migration 39: Deku's own plans, trials and limits, decided by the database
-- Deku Finance
--
-- Replaces organisation_licenses (migration 12), whose trial was started by the browser on first
-- visit. A company's trial now starts when its row is inserted, limits are enforced by triggers, and
-- only a superadmin can grant a paid plan.
--
-- organisation_licenses is mapped, not wrapped: each company's latest licence is copied into
-- subscriptions once, then the table is left read-only for history. A compatibility view would have
-- had to invent licence keys and the "features" shape for every new subscription, and nothing reads
-- the table any more (the backend licence routes and the browser licence flow are removed).

-- ---------------------------------------------------------------------------------------------
-- Plan catalogue
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  price_paise_monthly bigint CHECK (price_paise_monthly >= 0),
  price_paise_yearly bigint CHECK (price_paise_yearly >= 0),
  -- A limit that is JSON null (or absent) is unlimited.
  limits jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_plans_limits_object CHECK (jsonb_typeof(limits) = 'object')
);

-- Prices and limits as published in src/components/landing/PricingPlansSection.tsx
-- (GO ₹1,499/mo or ₹1,199/mo billed yearly; PRO ₹4,999/mo or ₹3,999/mo billed yearly).
-- "payments" is gateway collection (PRO: "UPI + Gateway Webhooks"); the plain UPI QR on GO is not gated.
INSERT INTO public.plans (code, name, price_paise_monthly, price_paise_yearly, limits) VALUES
  ('go', 'GO', 149900, 1438800,
   '{"max_monthly_invoices": 150, "seats": 2, "gstn_json": false, "direct_filing": false, "payments": false}'),
  ('pro', 'PRO', 499900, 4798800,
   '{"max_monthly_invoices": null, "seats": null, "gstn_json": true, "direct_filing": true, "payments": true}')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select" ON public.plans;
CREATE POLICY "plans_select" ON public.plans FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.plans FROM authenticated;

-- ---------------------------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.plans(code),
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  trial_ends_at timestamptz,
  -- Access ends here (for a trial: trial end plus the grace days).
  current_period_end timestamptz,
  -- shortcut: only 'manual' is written today; 'razorpay' is reserved for Razorpay Subscriptions on Deku's account (M4 payment).
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'razorpay')),
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_subscriptions_org_current
  ON public.subscriptions(organisation_id) WHERE status IN ('trialing', 'active', 'past_due');

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
CREATE POLICY "subscriptions_select"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;

-- ---------------------------------------------------------------------------------------------
-- Entitlements and usage
-- ---------------------------------------------------------------------------------------------

-- Unchecked: for triggers, which run while the caller may not be a member yet (accepting an invite).
CREATE OR REPLACE FUNCTION public.subscription_limits(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.limits
       FROM public.subscriptions s
       JOIN public.plans p ON p.code = s.plan_code
      WHERE s.organisation_id = p_org_id
        AND s.status IN ('trialing', 'active', 'past_due')
        AND (s.current_period_end IS NULL OR now() < s.current_period_end)
      LIMIT 1),
    -- No live plan: the books stay readable, nothing new can be issued or added.
    '{"read_only": true, "max_monthly_invoices": 0, "seats": 0, "gstn_json": false, "direct_filing": false, "payments": false}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.invoices_issued_this_month(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Calendar month in India time; cancelled invoices still used up their slot.
  SELECT count(*)::int
    FROM public.sales_invoices
   WHERE organisation_id = p_org_id
     AND status <> 'draft'
     AND COALESCE(issued_at, created_at) >= (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata');
$$;

CREATE OR REPLACE FUNCTION public.organisation_entitlements(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;
  RETURN public.subscription_limits(p_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_organisation_subscription(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions;
  v_plan public.plans;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this organisation';
  END IF;

  -- The current row, else the most recent one (an expired trial still says what it was).
  SELECT * INTO v_sub
    FROM public.subscriptions
   WHERE organisation_id = p_org_id
   ORDER BY (status IN ('trialing', 'active', 'past_due')) DESC, created_at DESC
   LIMIT 1;
  SELECT * INTO v_plan FROM public.plans WHERE code = v_sub.plan_code;

  RETURN jsonb_build_object(
    'plan', CASE WHEN v_plan.code IS NULL THEN NULL ELSE jsonb_build_object(
      'code', v_plan.code, 'name', v_plan.name,
      'price_paise_monthly', v_plan.price_paise_monthly, 'price_paise_yearly', v_plan.price_paise_yearly,
      'limits', v_plan.limits) END,
    'status', CASE
      WHEN v_sub.id IS NULL THEN NULL
      WHEN v_sub.status IN ('trialing', 'active', 'past_due') AND v_sub.current_period_end <= now() THEN 'expired'
      ELSE v_sub.status END,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_end', v_sub.current_period_end,
    'provider', v_sub.provider,
    'entitlements', public.subscription_limits(p_org_id),
    'usage', jsonb_build_object(
      'invoices_this_month', public.invoices_issued_this_month(p_org_id),
      'seats_used', (SELECT count(*) FROM public.organisation_members WHERE organisation_id = p_org_id)
    ),
    'server_time', now()
  );
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Trial on company creation (rule from migrations 12/22: 15 days, then 5 days' grace)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_organisation_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (organisation_id, plan_code, status, trial_ends_at, current_period_end)
  VALUES (NEW.id, 'go', 'trialing', now() + interval '15 days', now() + interval '20 days')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organisations_start_trial ON public.organisations;
CREATE TRIGGER trg_organisations_start_trial
  AFTER INSERT ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.start_organisation_trial();

-- ---------------------------------------------------------------------------------------------
-- Limits
-- ---------------------------------------------------------------------------------------------
-- Limits bind signed-in users. Writes with no JWT subject come only from the database owner
-- (migrations, the demo seed, SQL tests); anon has no table privileges.

CREATE OR REPLACE FUNCTION public.enforce_invoice_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_used int;
BEGIN
  IF NEW.status = 'draft' OR (TG_OP = 'UPDATE' AND OLD.status <> 'draft') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Serialise issuance per company so two concurrent issues can't both take the last slot.
  PERFORM pg_advisory_xact_lock(hashtextextended('plan_invoices:' || NEW.organisation_id::text, 0));
  v_max := (public.subscription_limits(NEW.organisation_id)->>'max_monthly_invoices')::int;
  IF v_max IS NOT NULL THEN
    v_used := public.invoices_issued_this_month(NEW.organisation_id);
    IF v_used >= v_max THEN
      RAISE EXCEPTION 'plan_limit:max_monthly_invoices'
        USING DETAIL = format('%s of %s invoices issued this month', v_used, v_max),
              HINT = 'Upgrade the plan to issue more invoices this month.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_invoices_plan_limit ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_plan_limit
  BEFORE INSERT OR UPDATE OF status ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_limit();

CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats int;
  v_used int;
BEGIN
  IF auth.uid() IS NULL OR public.is_superadmin() THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('plan_seats:' || NEW.organisation_id::text, 0));
  -- A re-insert of an existing member is left to the unique constraint / ON CONFLICT.
  IF EXISTS (SELECT 1 FROM public.organisation_members
              WHERE organisation_id = NEW.organisation_id AND user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  v_seats := (public.subscription_limits(NEW.organisation_id)->>'seats')::int;
  IF v_seats IS NOT NULL THEN
    SELECT count(*) INTO v_used FROM public.organisation_members WHERE organisation_id = NEW.organisation_id;
    IF v_used >= v_seats THEN
      RAISE EXCEPTION 'plan_limit:seats'
        USING DETAIL = format('%s of %s seats in use', v_used, v_seats),
              HINT = 'Upgrade the plan to add more members.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organisation_members_seat_limit ON public.organisation_members;
CREATE TRIGGER trg_organisation_members_seat_limit
  BEFORE INSERT ON public.organisation_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();

-- check_org_seat_availability: latest definition from 20261018000016; changed: seats come from the
-- subscription instead of organisation_licenses, and the error is plan_limit:seats.
CREATE OR REPLACE FUNCTION public.check_org_seat_availability(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license_seats int;
  v_current_members int;
  v_pending_invites int;
BEGIN
  -- Superadmin is exempt from seat constraints
  IF public.is_superadmin() THEN
    RETURN true;
  END IF;

  v_license_seats := (public.subscription_limits(p_org_id)->>'seats')::int;

  -- NULL is unlimited
  IF v_license_seats IS NULL THEN
    RETURN true;
  END IF;

  -- Tally current active members + active pending invites
  SELECT COUNT(*) INTO v_current_members
  FROM public.organisation_members
  WHERE organisation_id = p_org_id;

  SELECT COUNT(*) INTO v_pending_invites
  FROM public.organisation_invitations
  WHERE organisation_id = p_org_id AND status = 'pending' AND expires_at > now();

  IF (v_current_members + v_pending_invites) >= v_license_seats THEN
    RAISE EXCEPTION 'plan_limit:seats'
      USING DETAIL = format('%s seats: %s members and %s pending invites', v_license_seats, v_current_members, v_pending_invites),
            HINT = 'Upgrade the plan to add more members.';
  END IF;

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Manual / offline billing
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.grant_subscription(p_org_id uuid, p_plan text, p_until timestamptz)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.subscriptions;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Permission denied: only a platform superadmin can grant a plan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organisation not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = p_plan AND active) THEN
    RAISE EXCEPTION 'Unknown or inactive plan: %', p_plan;
  END IF;
  IF p_until IS NULL OR p_until <= now() THEN
    RAISE EXCEPTION 'p_until must be in the future';
  END IF;

  UPDATE public.subscriptions SET status = 'cancelled'
   WHERE organisation_id = p_org_id AND status IN ('trialing', 'active', 'past_due');

  INSERT INTO public.subscriptions (organisation_id, plan_code, status, current_period_end, provider)
  VALUES (p_org_id, p_plan, 'active', p_until, 'manual')
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Retire organisation_licenses
-- ---------------------------------------------------------------------------------------------

-- Each company's latest licence, once. Companies that never had one start a trial now.
INSERT INTO public.subscriptions (organisation_id, plan_code, status, trial_ends_at, current_period_end, created_at)
SELECT l.organisation_id,
       l.plan_tier,
       CASE
         WHEN l.status = 'revoked' THEN 'cancelled'
         WHEN l.status = 'expired' OR l.expires_at <= now() THEN 'expired'
         WHEN l.license_type = 'temp' THEN 'trialing'
         ELSE 'active'
       END,
       l.trial_ends_at,
       l.expires_at,
       l.created_at
  FROM (SELECT DISTINCT ON (organisation_id) *
          FROM public.organisation_licenses
         ORDER BY organisation_id, created_at DESC) l
 WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.organisation_id = l.organisation_id);

INSERT INTO public.subscriptions (organisation_id, plan_code, status, trial_ends_at, current_period_end)
SELECT o.id, 'go', 'trialing', now() + interval '15 days', now() + interval '20 days'
  FROM public.organisations o
 WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.organisation_id = o.id);

DROP FUNCTION IF EXISTS public.issue_organisation_license(uuid, text, text, text, int);
DROP FUNCTION IF EXISTS public.activate_organisation_license(text, text);
DROP FUNCTION IF EXISTS public.generate_license_key(text, text);

DROP POLICY IF EXISTS "organisation_licenses_admin_manage" ON public.organisation_licenses;
REVOKE INSERT, UPDATE, DELETE ON public.organisation_licenses FROM authenticated;
COMMENT ON TABLE public.organisation_licenses IS
  'Deprecated by public.subscriptions (migration 39); copied there once and kept read-only for history.';

-- superadmin_diagnose_org: latest definition from 20261018000016; changed: active_license reads the subscription.
CREATE OR REPLACE FUNCTION public.superadmin_diagnose_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_member_count int;
  v_vouchers_count int;
  v_is_balanced boolean;
  v_pending_agent_sessions int;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform superadmins can run diagnostic inspects';
  END IF;

  SELECT * INTO v_org FROM public.organisations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Organisation not found');
  END IF;

  SELECT COUNT(*) INTO v_member_count FROM public.organisation_members WHERE organisation_id = p_org_id;
  SELECT COUNT(*) INTO v_vouchers_count FROM public.journal_entries WHERE organisation_id = p_org_id AND status = 'posted';

  -- Check Trial Balance parity across the entire org
  SELECT (COALESCE(SUM(debit), 0) = COALESCE(SUM(credit), 0))
  INTO v_is_balanced
  FROM public.journal_entry_lines
  WHERE organisation_id = p_org_id;

  SELECT COUNT(*) INTO v_pending_agent_sessions
  FROM public.agent_sessions
  WHERE organisation_id = p_org_id AND status NOT IN ('approved', 'posted', 'rejected');

  RETURN jsonb_build_object(
    'organisation_id', v_org.id,
    'name', v_org.name,
    'slug', v_org.slug,
    'gstin', v_org.gstin,
    'active_license', public.get_organisation_subscription(p_org_id),
    'members_count', v_member_count,
    'posted_vouchers', v_vouchers_count,
    'books_balanced', COALESCE(v_is_balanced, true),
    'pending_ai_sessions', v_pending_agent_sessions
  );
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Function access (migration 18/26 rules)
-- ---------------------------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  public.subscription_limits(uuid),
  public.invoices_issued_this_month(uuid),
  public.start_organisation_trial(),
  public.enforce_invoice_limit(),
  public.enforce_seat_limit()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.organisation_entitlements(uuid),
  public.get_organisation_subscription(uuid),
  public.grant_subscription(uuid, text, timestamptz),
  public.check_org_seat_availability(uuid),
  public.superadmin_diagnose_org(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.organisation_entitlements(uuid),
  public.get_organisation_subscription(uuid),
  public.grant_subscription(uuid, text, timestamptz)
TO authenticated;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.subscription_limits(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_organisation_subscription(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.grant_subscription(uuid, text, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'subscription functions are executable by the wrong roles';
  END IF;
END $$;
