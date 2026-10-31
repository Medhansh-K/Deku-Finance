-- Migration 38: KYC rows are member-readable and service-written, Aadhaar-like numbers and large blobs
-- are refused, and the trust level counts only real (non-sandbox), current checks. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('38000000-0000-4000-8000-0000000000a1', 'kyc-owner@test.local'),
  ('38000000-0000-4000-8000-0000000000b1', 'kyc-other@test.local');
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, email FROM auth.users WHERE email LIKE 'kyc-%@test.local'
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('38100000-0000-4000-8000-000000000001', 'KYC Co', 'kyc-co', '38000000-0000-4000-8000-0000000000a1'),
  ('38100000-0000-4000-8000-000000000002', 'KYC Other Co', 'kyc-other-co', '38000000-0000-4000-8000-0000000000b1');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('38100000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-0000000000a1', 'owner'),
  ('38100000-0000-4000-8000-000000000002', '38000000-0000-4000-8000-0000000000b1', 'owner')
ON CONFLICT (organisation_id, user_id) DO NOTHING;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE
  o1 uuid := '38100000-0000-4000-8000-000000000001';
  o2 uuid := '38100000-0000-4000-8000-000000000002';
  u1 uuid := '38000000-0000-4000-8000-0000000000a1';
  bad text;
BEGIN
  -- Sandbox checks: stored, but never raise the trust level.
  INSERT INTO public.kyc_verifications (organisation_id, subject, method, status, provider, verified_at, raw_minimal)
  VALUES (o1, 'business', 'gstin', 'verified', 'sandbox', now(), '{"sandbox": true}');
  INSERT INTO public.kyc_verifications (organisation_id, subject, user_id, method, status, provider, verified_at)
  VALUES (o1, 'person', u1, 'pan', 'verified', 'sandbox', now());
  ASSERT (SELECT trust_level FROM public.organisation_trust_level WHERE organisation_id = o1) = 0,
    'sandbox checks raised the trust level';

  -- A real business check gives level 1; an expired person check doesn't add to it.
  INSERT INTO public.kyc_verifications (organisation_id, subject, method, status, provider, provider_ref, verified_at, verified_name, raw_minimal)
  VALUES (o1, 'business', 'pan', 'verified', 'acme_kyc', 'ref-6f1c0d2a-9a7e-4a55-8b0e-123456789012', now(), 'KYC CO PVT LTD',
          '{"pan_status": "valid", "request_id": "1b4e28ba-2fa1-11d2-883f-0016d3cca427", "aadhaar_seeded": true}');
  INSERT INTO public.kyc_verifications (organisation_id, subject, user_id, method, status, provider, verified_at, expires_at)
  VALUES (o1, 'person', u1, 'digilocker', 'verified', 'acme_kyc', now() - interval '2 years', now() - interval '1 day');
  ASSERT (SELECT trust_level FROM public.organisation_trust_level WHERE organisation_id = o1) = 1,
    'business check should give trust level 1';

  INSERT INTO public.kyc_verifications (organisation_id, subject, user_id, method, status, provider, verified_at, raw_minimal)
  VALUES (o1, 'person', u1, 'pan', 'verified', 'acme_kyc', now(), '{"masked_aadhaar": "XXXX XXXX 9012"}');
  ASSERT (SELECT trust_level FROM public.organisation_trust_level WHERE organisation_id = o1) = 2,
    'business and person checks should give trust level 2';
  ASSERT (SELECT trust_level FROM public.organisation_trust_level WHERE organisation_id = o2) = 0,
    'org 2 should be unverified';

  -- Aadhaar numbers and Virtual IDs are refused in any shape.
  FOREACH bad IN ARRAY ARRAY[
    '{"aadhaar": "234567890123"}',
    '{"uid": 234567890123}',
    '{"doc": {"number": "2345 6789 0123"}}',
    '{"id": "2345-6789-0123"}',
    '{"vid": "9123 4567 8901 2345"}',
    '["note: 234567890123 seen"]'
  ] LOOP
    BEGIN
      INSERT INTO public.kyc_verifications (organisation_id, subject, method, provider, raw_minimal)
      VALUES (o1, 'business', 'udyam', 'acme_kyc', bad::jsonb);
      RAISE EXCEPTION 'Aadhaar-like value was stored: %', bad;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    INSERT INTO public.kyc_verifications (organisation_id, subject, method, provider, provider_ref)
    VALUES (o1, 'business', 'udyam', 'acme_kyc', '234567890123');
    RAISE EXCEPTION 'Aadhaar-like provider_ref was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- No document images.
  BEGIN
    INSERT INTO public.kyc_verifications (organisation_id, subject, method, provider, raw_minimal)
    VALUES (o1, 'business', 'udyam', 'acme_kyc', jsonb_build_object('photo', repeat('QUJD', 2000)));
    RAISE EXCEPTION 'a large blob was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Subject and method must agree; a person needs a user.
  BEGIN
    INSERT INTO public.kyc_verifications (organisation_id, subject, method, provider)
    VALUES (o1, 'person', 'pan', 'acme_kyc');
    RAISE EXCEPTION 'person without a user was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.kyc_verifications (organisation_id, subject, user_id, method, provider)
    VALUES (o1, 'person', u1, 'udyam', 'acme_kyc');
    RAISE EXCEPTION 'person verified by Udyam was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.kyc_verifications (organisation_id, subject, method, status, provider)
    VALUES (o1, 'business', 'gstin', 'verified', 'acme_kyc');
    RAISE EXCEPTION 'verified without verified_at was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
RESET ROLE;

-- Members read their own company's rows only and can't write.
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('38000000-0000-4000-8000-0000000000b1');
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.kyc_verifications) = 0, 'member sees another company''s KYC';
  ASSERT (SELECT count(*) FROM public.organisation_trust_level) = 1, 'trust view leaks other companies';
  BEGIN
    INSERT INTO public.kyc_verifications (organisation_id, subject, method, status, provider, verified_at)
    VALUES ('38100000-0000-4000-8000-000000000002', 'business', 'gstin', 'verified', 'acme_kyc', now());
    RAISE EXCEPTION 'owner self-verified directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT pg_temp.as_user('38000000-0000-4000-8000-0000000000a1');
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.kyc_verifications) = 5, 'owner should see their 5 checks';
  ASSERT (SELECT trust_level FROM public.organisation_trust_level) = 2, 'owner should see trust level 2';
  BEGIN
    UPDATE public.kyc_verifications SET status = 'verified';
    RAISE EXCEPTION 'owner updated KYC rows directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

ROLLBACK;
\echo 'kyc_test: ok'
