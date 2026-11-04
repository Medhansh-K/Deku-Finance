-- Migration 47: one customer per deployment. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

DO $$
DECLARE
  v_admin uuid;
  v_invited uuid;
  v_org uuid;
  s public.subscriptions;
BEGIN
  -- Signup without permission to bootstrap, and no invitation.
  BEGIN
    PERFORM public.auth_register_guarded('stranger@test.local', 'h', '{}', false);
    RAISE EXCEPTION 'signup allowed with no invitation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'signup_closed' THEN RAISE; END IF;
  END;

  -- First administrator; the demo users in the seed don't count as a first user.
  v_admin := public.auth_register_guarded('first@test.local', 'h', '{}', true);
  ASSERT v_admin IS NOT NULL, 'first administrator refused';
  BEGIN
    PERFORM public.auth_register_guarded('second@test.local', 'h', '{}', true);
    RAISE EXCEPTION 'a second first administrator got in';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'signup_closed' THEN RAISE; END IF;
  END;

  -- The company has no trial and no end date.
  INSERT INTO public.profiles (id, email, full_name) VALUES (v_admin, 'first@test.local', 'First') ON CONFLICT (id) DO NOTHING;
  PERFORM pg_temp.as_user(v_admin);
  v_org := public.create_organisation('Only Co', 'only-co-test');
  ASSERT (SELECT count(*) FROM public.accounts WHERE organisation_id = v_org) > 10, 'company has no chart of accounts';
  ASSERT (SELECT name FROM public.accounts WHERE organisation_id = v_org AND code = '1020') = 'Operating Bank Account', 'chart names a specific bank';
  SELECT * INTO s FROM public.subscriptions WHERE organisation_id = v_org;
  ASSERT s.plan_code = 'single_org' AND s.status = 'active' AND s.current_period_end IS NULL, 'company started on a trial';
  ASSERT public.subscription_limits(v_org)->>'max_monthly_invoices' IS NULL, 'invoice limit applies';
  ASSERT public.subscription_limits(v_org)->>'seats' IS NULL, 'seat limit applies';

  -- One company per deployment.
  BEGIN
    PERFORM public.create_organisation('Second Co', 'second-co-test');
    RAISE EXCEPTION 'a second company was created';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'single_organisation' THEN RAISE; END IF;
  END;

  -- A pending invitation opens signup for that address only, until it expires.
  INSERT INTO public.organisation_invitations (organisation_id, email, role, token, status, expires_at)
  VALUES (v_org, 'Invited@test.local', 'viewer', 'single-customer-test-a', 'pending', now() + interval '1 day'),
         (v_org, 'expired@test.local', 'viewer', 'single-customer-test-b', 'pending', now() - interval '1 day');
  -- Knowing the address isn't enough; the invitation's token is what proves it reached this person.
  BEGIN
    PERFORM public.auth_register_guarded('invited@test.local', 'h', '{}', false);
    RAISE EXCEPTION 'signup allowed with no invitation token';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'signup_closed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.auth_register_guarded('invited@test.local', 'h', '{}', false, 'single-customer-test-b');
    RAISE EXCEPTION 'signup allowed with another invitation''s token';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'signup_closed' THEN RAISE; END IF;
  END;
  v_invited := public.auth_register_guarded(' invited@TEST.local ', 'h', '{}', false, 'single-customer-test-a');
  ASSERT v_invited IS NOT NULL, 'invited address refused';
  BEGIN
    PERFORM public.auth_register_guarded('expired@test.local', 'h', '{}', false, 'single-customer-test-b');
    RAISE EXCEPTION 'an expired invitation opened signup';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'signup_closed' THEN RAISE; END IF;
  END;

  -- Ten failures lock an address for everyone; a success or another address is unaffected.
  FOR i IN 1..9 LOOP
    PERFORM public.auth_login_failed(' Locked@test.local ');
  END LOOP;
  ASSERT NOT public.auth_login_blocked('locked@test.local'), 'locked after nine failures';
  PERFORM public.auth_login_failed('locked@test.local');
  ASSERT public.auth_login_blocked('LOCKED@test.local'), 'not locked after ten failures';
  ASSERT NOT public.auth_login_blocked('other@test.local'), 'lock spilled to another address';
  UPDATE auth.login_attempts SET window_start = now() - interval '16 minutes' WHERE email = 'locked@test.local';
  ASSERT NOT public.auth_login_blocked('locked@test.local'), 'lock outlasted its window';
  PERFORM public.auth_login_failed('locked@test.local');
  ASSERT (SELECT failures FROM auth.login_attempts WHERE email = 'locked@test.local') = 1, 'old failures still counted';
  PERFORM public.auth_login_succeeded('locked@test.local');
  ASSERT NOT EXISTS (SELECT 1 FROM auth.login_attempts WHERE email = 'locked@test.local'), 'success kept the count';

  ASSERT NOT EXISTS (SELECT 1 FROM public.superadmins WHERE email = 'medhansh@deku.finance'), 'vendor superadmin still seeded';
END $$;

-- Only the backend's service role can register, and a signed-in user can't insert a company directly.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.auth_register_guarded('x@test.local', 'h', '{}', true);
    RAISE EXCEPTION 'authenticated can call auth_register_guarded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.auth_login_succeeded('x@test.local');
    RAISE EXCEPTION 'authenticated can clear a login lock';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.organisations (name, slug) VALUES ('Direct Co', 'direct-co-test');
    RAISE EXCEPTION 'authenticated inserted a company directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

ROLLBACK;
\echo single_customer_test passed
