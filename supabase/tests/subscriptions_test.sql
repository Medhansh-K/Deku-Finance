-- Plans, trials and limits (migration 39). Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('39000000-0000-4000-8000-0000000000a1', 'sub-owner@test.local'),
  ('39000000-0000-4000-8000-0000000000a2', 'sub-second@test.local'),
  ('39000000-0000-4000-8000-0000000000a3', 'sub-third@test.local'),
  ('39000000-0000-4000-8000-0000000000b1', 'sub-outsider@test.local'),
  ('39000000-0000-4000-8000-0000000000c1', 'sub-superadmin@test.local');
INSERT INTO public.superadmins (user_id, email, name)
VALUES ('39000000-0000-4000-8000-0000000000c1', 'sub-superadmin@test.local', 'Test Superadmin');

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p IS NULL THEN '' ELSE json_build_object('sub', p, 'role', 'authenticated')::text END, true);
$$;

CREATE TABLE pg_temp.ctx (org uuid, customer uuid);
GRANT SELECT ON pg_temp.ctx TO authenticated;

-- 1. The trial starts on the server when the company is created.
DO $$
DECLARE
  v_org uuid;
  s public.subscriptions;
BEGIN
  -- shortcut: inserted directly because create_organisation() is refused by protect_membership_changes
  -- for a signed-in caller (pre-existing); switch to create_organisation() once that is fixed.
  INSERT INTO public.organisations (name, slug, created_by)
  VALUES ('Subscription Test Co', 'subscription-test-co', '39000000-0000-4000-8000-0000000000a1')
  RETURNING id INTO v_org;
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org, '39000000-0000-4000-8000-0000000000a1', 'owner');
  SELECT * INTO s FROM public.subscriptions WHERE organisation_id = v_org;
  ASSERT s.plan_code = 'go' AND s.status = 'trialing' AND s.provider = 'manual', 'no GO trial on creation';
  ASSERT abs(extract(epoch FROM s.trial_ends_at - (now() + interval '15 days'))) < 5, 'trial is not 15 days';
  ASSERT abs(extract(epoch FROM s.current_period_end - (now() + interval '20 days'))) < 5, 'grace is not 5 days';
  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000a1');
  ASSERT (public.organisation_entitlements(v_org)->>'max_monthly_invoices')::int = 150, 'trial limits are not GO';
  INSERT INTO pg_temp.ctx VALUES (v_org, gen_random_uuid());
END $$;

-- 2. Seats: GO allows 2 (the owner plus one).
DO $$
DECLARE v_org uuid := (SELECT org FROM pg_temp.ctx);
BEGIN
  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000a1');
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org, '39000000-0000-4000-8000-0000000000a2', 'accountant');
  -- Re-inserting an existing member is not a new seat.
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org, '39000000-0000-4000-8000-0000000000a2', 'accountant') ON CONFLICT DO NOTHING;
  BEGIN
    INSERT INTO public.organisation_members (organisation_id, user_id, role)
    VALUES (v_org, '39000000-0000-4000-8000-0000000000a3', 'viewer');
    RAISE EXCEPTION 'third seat accepted on GO';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'plan_limit:seats' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.check_org_seat_availability(v_org);
    RAISE EXCEPTION 'invite allowed past the seat limit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'plan_limit:seats' THEN RAISE; END IF;
  END;
END $$;

-- 3. Invoices: the 151st this month is refused on GO.
DO $$
DECLARE
  v_org uuid := (SELECT org FROM pg_temp.ctx);
  v_cust uuid := (SELECT customer FROM pg_temp.ctx);
  v_inv uuid;
BEGIN
  PERFORM pg_temp.as_user(NULL); -- fixtures as the database owner, which limits don't bind
  INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name)
  VALUES (v_cust, v_org, 'customer', 'Limit Customer', 'Limit Customer');
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, status, place_of_supply, total_amount, issued_at)
  SELECT v_org, v_cust, 'LIM-' || g, current_date, current_date + 30, 'issued', '27', 100, now()
    FROM generate_series(1, 150) g;
  -- Last month's invoices don't count.
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, status, place_of_supply, total_amount, issued_at, created_at)
  VALUES (v_org, v_cust, 'LIM-OLD', current_date - 40, current_date, 'issued', '27', 100, now() - interval '40 days', now() - interval '40 days');
  ASSERT public.invoices_issued_this_month(v_org) = 150, 'monthly count is wrong';

  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply)
  VALUES (v_org, v_cust, 'LIM-151', current_date, current_date + 30, 'intra_state', '27') RETURNING id INTO v_inv;
  INSERT INTO public.sales_invoice_lines (organisation_id, invoice_id, line_number, item_name, quantity, unit_price, taxable_amount, gst_rate, total_amount)
  VALUES (v_org, v_inv, 1, 'Service', 1, 100, 100, 0, 100);

  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000a1');
  BEGIN
    PERFORM public.issue_sales_invoice(v_org, v_inv, false);
    RAISE EXCEPTION '151st invoice issued on GO';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'plan_limit:max_monthly_invoices' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, status, place_of_supply, total_amount)
    VALUES (v_org, v_cust, 'LIM-DIRECT', current_date, current_date + 30, 'issued', '27', 100);
    RAISE EXCEPTION 'an issued invoice was inserted past the limit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'plan_limit:max_monthly_invoices' THEN RAISE; END IF;
  END;
  -- Drafts are not limited.
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, place_of_supply)
  VALUES (v_org, v_cust, 'LIM-DRAFT', current_date, current_date + 30, '27');
END $$;

-- 4. Only a superadmin grants a plan; PRO lifts both limits.
DO $$
DECLARE
  v_org uuid := (SELECT org FROM pg_temp.ctx);
  v_inv uuid := (SELECT id FROM public.sales_invoices WHERE invoice_number = 'LIM-151');
  s public.subscriptions;
BEGIN
  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000a1');
  BEGIN
    PERFORM public.grant_subscription(v_org, 'pro', now() + interval '1 year');
    RAISE EXCEPTION 'owner granted themselves a plan';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;

  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000c1');
  BEGIN
    PERFORM public.grant_subscription(v_org, 'pro', now() - interval '1 day');
    RAISE EXCEPTION 'grant in the past accepted';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  s := public.grant_subscription(v_org, 'pro', now() + interval '1 year');
  ASSERT s.status = 'active' AND s.plan_code = 'pro', 'grant did not activate PRO';
  ASSERT (SELECT count(*) FROM public.subscriptions WHERE organisation_id = v_org AND status = 'cancelled') = 1,
    'the trial was not closed';

  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000a1');
  PERFORM public.issue_sales_invoice(v_org, v_inv, false);
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org, '39000000-0000-4000-8000-0000000000a3', 'viewer');
END $$;

-- 5. As the API role: members read their own subscription, nobody writes it, outsiders see nothing.
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_org uuid := (SELECT org FROM pg_temp.ctx);
  j jsonb;
BEGIN
  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000a1');
  j := public.get_organisation_subscription(v_org);
  ASSERT j->'plan'->>'code' = 'pro' AND j->>'status' = 'active', 'owner does not see PRO';
  ASSERT (j->'usage'->>'invoices_this_month')::int = 151 AND (j->'usage'->>'seats_used')::int = 3, 'usage is wrong';
  ASSERT j->'entitlements'->'max_monthly_invoices' = 'null'::jsonb, 'PRO invoices are not unlimited';
  ASSERT (SELECT count(*) FROM public.plans) >= 2, 'plans not readable';
  BEGIN
    UPDATE public.subscriptions SET current_period_end = now() + interval '10 years' WHERE organisation_id = v_org;
    RAISE EXCEPTION 'owner extended their own subscription';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.subscriptions (organisation_id, plan_code, status) VALUES (v_org, 'pro', 'active');
    RAISE EXCEPTION 'owner inserted a subscription';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$
DECLARE v_org uuid := (SELECT org FROM pg_temp.ctx);
BEGIN
  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000b1');
  ASSERT (SELECT count(*) FROM public.subscriptions WHERE organisation_id = v_org) = 0, 'outsider sees the subscription';
  BEGIN
    PERFORM public.get_organisation_subscription(v_org);
    RAISE EXCEPTION 'outsider read the subscription';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.organisation_entitlements(v_org);
    RAISE EXCEPTION 'outsider read the entitlements';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.subscription_limits(v_org);
    RAISE EXCEPTION 'authenticated can call the unchecked helper';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;

-- 6. Once the period ends the company is read-only, and nothing is executable by anon.
DO $$
DECLARE v_org uuid := (SELECT org FROM pg_temp.ctx);
BEGIN
  UPDATE public.subscriptions SET current_period_end = now() - interval '1 second'
   WHERE organisation_id = v_org AND status = 'active';
  ASSERT (public.subscription_limits(v_org)->>'read_only')::boolean, 'expired plan still grants limits';
  ASSERT (public.subscription_limits(v_org)->>'max_monthly_invoices')::int = 0, 'expired plan can still issue';
  PERFORM pg_temp.as_user('39000000-0000-4000-8000-0000000000a1');
  ASSERT public.get_organisation_subscription(v_org)->>'status' = 'expired', 'ended plan not reported as expired';

  ASSERT NOT has_function_privilege('anon', 'public.get_organisation_subscription(uuid)', 'EXECUTE');
  ASSERT NOT has_function_privilege('anon', 'public.organisation_entitlements(uuid)', 'EXECUTE');
  ASSERT NOT has_function_privilege('anon', 'public.grant_subscription(uuid, text, timestamptz)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.invoices_issued_this_month(uuid)', 'EXECUTE');
  ASSERT to_regprocedure('public.issue_organisation_license(uuid, text, text, text, integer)') IS NULL,
    'the old licence issuer still exists';
END $$;

ROLLBACK;
