-- Login primitives from migration 000: registration, lookup, refresh rotation and reuse detection.
BEGIN;

DO $$
DECLARE
  v_user uuid;
  v_got uuid;
  v_live int;
BEGIN
  v_user := public.auth_register('  New.User@Example.com ', 'bcrypt-hash', '{"full_name":"N","is_demo":true}');

  ASSERT (SELECT email FROM auth.users WHERE id = v_user) = 'new.user@example.com', 'email not lowercased';
  ASSERT (SELECT meta ? 'is_demo' FROM public.auth_credentials('NEW.USER@example.com')) = false, 'signup kept is_demo';
  ASSERT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user), 'profile trigger did not fire';

  BEGIN
    PERFORM public.auth_register('new.user@example.com', 'x', '{}');
    RAISE EXCEPTION 'duplicate email accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'email_taken', 'unexpected message ' || SQLERRM;
  END;

  PERFORM public.auth_store_refresh(v_user, 'h1', now() + interval '30 days');
  PERFORM public.auth_store_refresh(v_user, 'other-device', now() + interval '30 days');

  v_got := public.auth_rotate_refresh('h1', 'h2', now() + interval '30 days');
  ASSERT v_got = v_user, 'rotation returned wrong user';

  -- Replaying h1 revokes every session of the user, including h2 and the other device.
  v_got := public.auth_rotate_refresh('h1', 'h3', now() + interval '30 days');
  ASSERT v_got IS NULL, 'reused token was accepted';
  SELECT count(*) INTO v_live FROM auth.refresh_tokens WHERE user_id = v_user AND revoked_at IS NULL;
  ASSERT v_live = 0, 'reuse did not revoke all sessions';

  ASSERT public.auth_rotate_refresh('unknown', 'h4', now() + interval '30 days') IS NULL, 'unknown token accepted';

  PERFORM public.auth_store_refresh(v_user, 'old', now() - interval '1 second');
  ASSERT public.auth_rotate_refresh('old', 'h5', now() + interval '30 days') IS NULL, 'expired token accepted';
  ASSERT NOT EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE token_hash = 'h5'), 'expired token was rotated';

  PERFORM public.auth_store_refresh(v_user, 'h6', now() + interval '30 days');
  PERFORM public.auth_revoke_refresh('h6');
  ASSERT (SELECT revoked_at IS NOT NULL FROM auth.refresh_tokens WHERE token_hash = 'h6'), 'logout did not revoke';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  ASSERT auth.uid() = v_user AND auth.role() = 'authenticated', 'auth.uid()/auth.role() ignore request.jwt.claims';

  RAISE NOTICE 'platform_auth_test passed';
END $$;

ROLLBACK;
