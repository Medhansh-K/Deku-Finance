-- Migration 41: founders can create their company, invitees can join, outsiders still can't.
BEGIN;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaa1-0000-4000-8000-000000000001', 'founder@example.test', 'x', now(), '{}', now(), now()),
  ('aaaaaaa1-0000-4000-8000-000000000002', 'invitee@example.test', 'x', now(), '{}', now(), now()),
  ('aaaaaaa1-0000-4000-8000-000000000003', 'outsider@example.test', 'x', now(), '{}', now(), now());

SET LOCAL ROLE authenticated;

-- 1. A signed-in founder can create a company and becomes its owner.
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaa1-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.create_organisation('Founder Co', 'founder-co-test');
  IF NOT EXISTS (SELECT 1 FROM public.organisation_members
                 WHERE organisation_id = v_org AND user_id = 'aaaaaaa1-0000-4000-8000-000000000001' AND role = 'owner') THEN
    RAISE EXCEPTION 'founder is not the owner';
  END IF;
  PERFORM set_config('test.org', v_org::text, true);

  INSERT INTO public.organisation_invitations (organisation_id, email, role, invited_by, token)
  VALUES (v_org, 'invitee@example.test', 'accountant', 'aaaaaaa1-0000-4000-8000-000000000001', 'tok-invitee'),
         (v_org, 'someone-else@example.test', 'viewer', 'aaaaaaa1-0000-4000-8000-000000000001', 'tok-other');
END $$;

-- 2. An outsider cannot add themselves, even as a non-owner.
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaa1-0000-4000-8000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.organisation_members (organisation_id, user_id, role)
    VALUES (current_setting('test.org')::uuid, 'aaaaaaa1-0000-4000-8000-000000000003', 'viewer');
    RAISE EXCEPTION 'outsider joined a company';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN
    IF SQLERRM = 'outsider joined a company' THEN RAISE; END IF;
  END;
  -- Nor redeem an invitation addressed to someone else.
  BEGIN
    PERFORM public.accept_organisation_invitation('tok-other');
    RAISE EXCEPTION 'outsider redeemed another email''s invitation';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN
    IF SQLERRM LIKE 'outsider redeemed%' THEN RAISE; END IF;
  END;
END $$;

-- The trial plan has 2 seats and pending invitations count towards them; free one up.
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaa1-0000-4000-8000-000000000001","role":"authenticated"}', true);
UPDATE public.organisation_invitations SET status = 'revoked' WHERE token = 'tok-other';

-- 3. The invitee can accept their own invitation and gets exactly the invited role.
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaa1-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$
BEGIN
  PERFORM public.accept_organisation_invitation('tok-invitee');
  IF NOT EXISTS (SELECT 1 FROM public.organisation_members
                 WHERE organisation_id = current_setting('test.org')::uuid
                   AND user_id = 'aaaaaaa1-0000-4000-8000-000000000002' AND role = 'accountant') THEN
    RAISE EXCEPTION 'invitee did not join as accountant';
  END IF;
END $$;

ROLLBACK;
\echo membership_bootstrap_test passed
