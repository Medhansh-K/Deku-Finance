-- Migration 26: Keep the login primitives service_role-only
-- Migration 018 ran GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, which also
-- reached the auth_* functions from migration 000 (auth_credentials returns password hashes).

REVOKE EXECUTE ON FUNCTION
  public.auth_register(text, text, jsonb),
  public.auth_credentials(text),
  public.auth_user(uuid),
  public.auth_store_refresh(uuid, text, timestamptz),
  public.auth_rotate_refresh(text, text, timestamptz),
  public.auth_revoke_refresh(text)
FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.auth_register(text, text, jsonb)',
    'public.auth_credentials(text)',
    'public.auth_user(uuid)',
    'public.auth_store_refresh(uuid, text, timestamptz)',
    'public.auth_rotate_refresh(text, text, timestamptz)',
    'public.auth_revoke_refresh(text)'
  ] LOOP
    IF has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION '% is still executable by anon/authenticated', f;
    END IF;
    IF NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      RAISE EXCEPTION '% is not executable by service_role', f;
    END IF;
  END LOOP;
END $$;
