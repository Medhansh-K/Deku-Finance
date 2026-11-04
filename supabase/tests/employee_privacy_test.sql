-- Migration 57: pay details follow the people who run payroll. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('57000000-0000-4000-8000-0000000000a1', 'pay-owner@test.local'),
  ('57000000-0000-4000-8000-0000000000a2', 'pay-viewer@test.local'),
  ('57000000-0000-4000-8000-0000000000a3', 'pay-accountant@test.local'),
  ('57000000-0000-4000-8000-0000000000a4', 'pay-outsider@test.local');
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('57000000-0000-4000-8000-000000000001', 'Pay Co', 'pay-co', '57000000-0000-4000-8000-0000000000a1');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-0000000000a1', 'owner'),
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-0000000000a2', 'viewer'),
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-0000000000a3', 'accountant');
DELETE FROM public.employees WHERE organisation_id = '57000000-0000-4000-8000-000000000001';
INSERT INTO public.employees (organisation_id, user_id, name, email, designation, pan) VALUES
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-0000000000a2', 'Viewer', 'pay-viewer@test.local', 'Clerk', 'AAAPL1234C'),
  ('57000000-0000-4000-8000-000000000001', NULL, 'Someone Else', 'pay-else@test.local', 'Manager', 'BBBPL1234C');

CREATE FUNCTION pg_temp.seen(p uuid) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.employees WHERE organisation_id = '57000000-0000-4000-8000-000000000001';
  RESET ROLE;
  RETURN n;
END;
$$;

DO $$
BEGIN
  ASSERT pg_temp.seen('57000000-0000-4000-8000-0000000000a1') = 2, 'owner should see everyone';
  ASSERT pg_temp.seen('57000000-0000-4000-8000-0000000000a2') = 1, 'viewer should see only their own row';
  ASSERT pg_temp.seen('57000000-0000-4000-8000-0000000000a3') = 0, 'accountant with no employee row should see none';
  ASSERT pg_temp.seen('57000000-0000-4000-8000-0000000000a4') = 0, 'outsider should see none';
END $$;

ROLLBACK;
\echo employee_privacy_test passed
