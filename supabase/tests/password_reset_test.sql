-- Migration 51: who can create a reset link, and what a link can do. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email, encrypted_password) VALUES
  ('51000000-0000-4000-8000-0000000000a1', 'reset-owner@test.local', 'owner-hash'),
  ('51000000-0000-4000-8000-0000000000a2', 'reset-admin@test.local', 'admin-hash'),
  ('51000000-0000-4000-8000-0000000000a3', 'reset-viewer@test.local', 'viewer-hash'),
  ('51000000-0000-4000-8000-0000000000a4', 'reset-outsider@test.local', 'outsider-hash');
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('51000000-0000-4000-8000-000000000001', 'Reset Co', 'reset-co', '51000000-0000-4000-8000-0000000000a1');
INSERT INTO public.organisation_members (id, organisation_id, user_id, role) VALUES
  ('51000000-0000-4000-8000-0000000000b1', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-0000000000a1', 'owner'),
  ('51000000-0000-4000-8000-0000000000b2', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-0000000000a2', 'admin'),
  ('51000000-0000-4000-8000-0000000000b3', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-0000000000a3', 'viewer');

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

DO $$
DECLARE
  v_org uuid := '51000000-0000-4000-8000-000000000001';
  v_owner_member uuid := '51000000-0000-4000-8000-0000000000b1';
  v_viewer_member uuid := '51000000-0000-4000-8000-0000000000b3';
  v_viewer uuid := '51000000-0000-4000-8000-0000000000a3';
BEGIN
  -- A viewer and an outsider can't create links.
  PERFORM pg_temp.as_user(v_viewer);
  BEGIN
    PERFORM public.create_password_reset(v_org, v_viewer_member, 'hash-x');
    RAISE EXCEPTION 'viewer created a reset link';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.as_user('51000000-0000-4000-8000-0000000000a4');
  BEGIN
    PERFORM public.create_password_reset(v_org, v_viewer_member, 'hash-x');
    RAISE EXCEPTION 'outsider created a reset link';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;

  -- An admin can't take over the owner, but an owner can reset an owner, and an admin a viewer.
  PERFORM pg_temp.as_user('51000000-0000-4000-8000-0000000000a2');
  BEGIN
    PERFORM public.create_password_reset(v_org, v_owner_member, 'hash-x');
    RAISE EXCEPTION 'admin created a link for the owner';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;
  PERFORM public.create_password_reset(v_org, v_viewer_member, 'hash-first');
  PERFORM pg_temp.as_user('51000000-0000-4000-8000-0000000000a1');
  PERFORM public.create_password_reset(v_org, v_owner_member, 'hash-owner');

  -- A member id from outside this company is refused.
  BEGIN
    PERFORM public.create_password_reset(v_org, gen_random_uuid(), 'hash-x');
    RAISE EXCEPTION 'link created for a non-member';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'That person%' THEN RAISE; END IF;
  END;

  -- A newer link replaces the older one.
  PERFORM public.create_password_reset(v_org, v_viewer_member, 'hash-second');
  ASSERT public.auth_consume_password_reset('hash-first', 'new-hash') IS NULL, 'replaced link still works';

  -- Using a link sets the password, ends sessions and clears a login lock, once.
  INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at) VALUES (v_viewer, 'session-hash', now() + interval '1 day');
  INSERT INTO auth.login_attempts (email, failures, window_start) VALUES ('reset-viewer@test.local', 10, now());
  ASSERT public.auth_consume_password_reset('hash-second', 'new-hash') = v_viewer, 'valid link refused';
  ASSERT (SELECT encrypted_password FROM auth.users WHERE id = v_viewer) = 'new-hash', 'password not changed';
  ASSERT (SELECT revoked_at IS NOT NULL FROM auth.refresh_tokens WHERE token_hash = 'session-hash'), 'old session survived';
  ASSERT NOT public.auth_login_blocked('reset-viewer@test.local'), 'login lock survived';
  ASSERT public.auth_consume_password_reset('hash-second', 'other-hash') IS NULL, 'link worked twice';
  ASSERT (SELECT encrypted_password FROM auth.users WHERE id = v_viewer) = 'new-hash', 'used link changed the password';

  -- An expired link does nothing.
  UPDATE auth.password_resets SET expires_at = now() - interval '1 minute' WHERE token_hash = 'hash-owner';
  ASSERT public.auth_consume_password_reset('hash-owner', 'bad-hash') IS NULL, 'expired link worked';
  ASSERT (SELECT encrypted_password FROM auth.users WHERE id = '51000000-0000-4000-8000-0000000000a1') = 'owner-hash', 'expired link changed the password';
END $$;

-- Setting a password directly is for the backend only.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.auth_change_password('51000000-0000-4000-8000-0000000000a1', 'x');
    RAISE EXCEPTION 'authenticated set a password';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.auth_consume_password_reset('x', 'y');
    RAISE EXCEPTION 'authenticated consumed a reset link';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

ROLLBACK;
\echo password_reset_test passed
