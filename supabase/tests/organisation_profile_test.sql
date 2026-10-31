-- Company profile columns from migration 30: format CHECKs and owner/admin-only updates.
BEGIN;

DO $$
DECLARE
  v_owner uuid := 'a0a0a0a0-0000-4000-8000-000000000001';
  v_viewer uuid := 'a0a0a0a0-0000-4000-8000-000000000002';
  v_org uuid := 'a0a0a0a0-0000-4000-8000-0000000000aa';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'profile-owner@test.local'), (v_viewer, 'profile-viewer@test.local');
  INSERT INTO public.organisations (id, name, slug, created_by) VALUES (v_org, 'Profile Test Co', 'profile-test-co', v_owner);
  INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES (v_org, v_owner, 'owner'), (v_org, v_viewer, 'viewer');

  ASSERT (SELECT operating_mode = 'pure' AND onboarded_at IS NULL AND NOT composition_scheme
          FROM public.organisations WHERE id = v_org), 'unexpected defaults for a new company';

  -- Valid values are accepted.
  UPDATE public.organisations
     SET operating_mode = 'gst', gstin = '27AABCD1234F1Z6', state_code = '27',
         upi_vpa = 'shop.name@okhdfc', bank_ifsc = 'HDFC0001234', bank_account_number = '50200012345678',
         udyam_number = 'UDYAM-MH-01-0001234', composition_scheme = true,
         registered_address = '{"line1":"1 Main Rd","city":"Pune","pincode":"411001"}'
   WHERE id = v_org;

  BEGIN
    UPDATE public.organisations SET bank_ifsc = 'HDFC1001234' WHERE id = v_org; -- 5th char must be 0
    RAISE EXCEPTION 'bad IFSC accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET bank_ifsc = 'hdfc0001234' WHERE id = v_org;
    RAISE EXCEPTION 'lowercase IFSC accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET upi_vpa = 'no-at-sign' WHERE id = v_org;
    RAISE EXCEPTION 'bad UPI accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET upi_vpa = 'name@1bank' WHERE id = v_org;
    RAISE EXCEPTION 'UPI handle starting with a digit accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET udyam_number = 'UDYAM-MH-1-0001234' WHERE id = v_org;
    RAISE EXCEPTION 'bad Udyam accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET bank_account_number = '12AB' WHERE id = v_org;
    RAISE EXCEPTION 'bad account number accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET state_code = '29' WHERE id = v_org;
    RAISE EXCEPTION 'state code that disagrees with the GSTIN accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET operating_mode = 'other' WHERE id = v_org;
    RAISE EXCEPTION 'unknown operating mode accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET operating_mode = 'pure', gstin = NULL WHERE id = v_org;
    RAISE EXCEPTION 'composition scheme kept in pure mode';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.organisations SET registered_address = '"just text"' WHERE id = v_org;
    RAISE EXCEPTION 'non-object address accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- As the API role: a viewer's update matches no rows (RLS), the owner's goes through.
SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claims = '{"sub":"a0a0a0a0-0000-4000-8000-000000000002","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  UPDATE public.organisations SET upi_vpa = 'viewer@okaxis' WHERE id = 'a0a0a0a0-0000-4000-8000-0000000000aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'a viewer updated the company profile';
END $$;

SET LOCAL request.jwt.claims = '{"sub":"a0a0a0a0-0000-4000-8000-000000000001","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  UPDATE public.organisations SET upi_vpa = 'owner@okaxis', onboarded_at = now() WHERE id = 'a0a0a0a0-0000-4000-8000-0000000000aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'the owner could not update the company profile';
END $$;

RESET ROLE;

DO $$
BEGIN
  ASSERT (SELECT upi_vpa = 'owner@okaxis' AND onboarded_at IS NOT NULL
          FROM public.organisations WHERE id = 'a0a0a0a0-0000-4000-8000-0000000000aa'), 'owner update not stored';
  RAISE NOTICE 'organisation_profile_test passed';
END $$;

ROLLBACK;
