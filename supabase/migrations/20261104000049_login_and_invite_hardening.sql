-- Deku Finance - login and invitation hardening for a single-customer deployment.

-- A vendor address has no place in a customer's database. The row was inert (no user_id) since migration 18.
DELETE FROM public.superadmins WHERE email = 'medhansh@deku.finance' AND user_id IS NULL;

-- Failed logins, counted per address in the database so every backend instance sees the same count.
-- Per address rather than per IP: the frontend proxy hides the client's IP, and it stops the bcrypt work too.
-- shortcut: someone guessing at an address can keep that account locked; add IP limits at the load balancer if that happens.
CREATE TABLE IF NOT EXISTS auth.login_attempts (
  email text PRIMARY KEY,
  failures integer NOT NULL,
  window_start timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION public.auth_login_blocked(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.login_attempts a
    WHERE a.email = lower(trim(p_email)) AND a.failures >= 10 AND a.window_start > now() - interval '15 minutes'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_login_failed(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO auth.login_attempts AS a (email, failures, window_start)
  VALUES (lower(trim(p_email)), 1, now())
  ON CONFLICT (email) DO UPDATE SET
    failures = CASE WHEN a.window_start > now() - interval '15 minutes' THEN a.failures + 1 ELSE 1 END,
    window_start = CASE WHEN a.window_start > now() - interval '15 minutes' THEN a.window_start ELSE now() END;
  -- Addresses that don't exist are counted too, so the table is trimmed as it's written.
  DELETE FROM auth.login_attempts WHERE window_start < now() - interval '1 day';
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_login_succeeded(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  DELETE FROM auth.login_attempts WHERE email = lower(trim(p_email));
$$;

REVOKE EXECUTE ON FUNCTION
  public.auth_login_blocked(text), public.auth_login_failed(text), public.auth_login_succeeded(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.auth_login_blocked(text), public.auth_login_failed(text), public.auth_login_succeeded(text)
TO service_role;

-- An invited address must also present the invitation's token. Signup has no email check, so knowing
-- that someone was invited must not be enough to register as them.
DROP FUNCTION IF EXISTS public.auth_register_guarded(text, text, jsonb, boolean);
CREATE OR REPLACE FUNCTION public.auth_register_guarded(
  p_email text,
  p_password_hash text,
  p_meta jsonb,
  p_first_admin_allowed boolean,
  p_invite_token text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('deku_signup'));
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_invitations i
    WHERE lower(i.email) = lower(trim(p_email)) AND i.token = p_invite_token
      AND i.status = 'pending' AND i.expires_at > now()
  ) AND NOT (
    p_first_admin_allowed
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE NOT public.is_demo_user(u.id))
  ) THEN
    RAISE EXCEPTION 'signup_closed';
  END IF;
  RETURN public.auth_register(p_email, p_password_hash, p_meta);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_register_guarded(text, text, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_register_guarded(text, text, jsonb, boolean, text) TO service_role;
