-- Deku Finance - changing and recovering passwords, without an email provider.
-- An owner or admin creates a one-time link and passes it on; the member sets their own password, so
-- nobody else ever learns it. db/issue_password_reset.sh covers an owner with nobody to ask.

CREATE TABLE IF NOT EXISTS auth.password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON auth.password_resets(user_id);

CREATE OR REPLACE FUNCTION public.create_password_reset(p_org_id uuid, p_member_id uuid, p_token_hash text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target uuid;
  v_target_role public.organisation_role;
  v_expires timestamptz := now() + interval '24 hours';
BEGIN
  IF NOT public.has_role(p_org_id, ARRAY['owner', 'admin']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: only an owner or admin can create a password reset link';
  END IF;

  SELECT m.user_id, m.role INTO v_target, v_target_role
  FROM public.organisation_members m
  WHERE m.id = p_member_id AND m.organisation_id = p_org_id;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'That person is not a member of this company';
  END IF;
  -- Otherwise an admin could take over an owner's account with a link they created themselves.
  IF v_target_role = 'owner' AND NOT public.has_role(p_org_id, ARRAY['owner']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: only an owner can reset an owner''s password';
  END IF;

  DELETE FROM auth.password_resets WHERE user_id = v_target AND used_at IS NULL;
  INSERT INTO auth.password_resets (token_hash, user_id, created_by, expires_at)
  VALUES (p_token_hash, v_target, auth.uid(), v_expires);

  PERFORM public.log_audit_event(p_org_id, 'password_reset_link_created', 'organisation_member', p_member_id, '{}'::jsonb);
  RETURN v_expires;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_password_reset(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_password_reset(uuid, uuid, text) TO authenticated, service_role;

-- Sets the password and ends the user's other sessions.
CREATE OR REPLACE FUNCTION public.auth_change_password(p_user uuid, p_password_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users SET encrypted_password = p_password_hash, updated_at = now() WHERE id = p_user;
  UPDATE auth.refresh_tokens SET revoked_at = now() WHERE user_id = p_user AND revoked_at IS NULL;
  DELETE FROM auth.login_attempts a USING auth.users u WHERE u.id = p_user AND a.email = lower(u.email);
END;
$$;

-- NULL when the link is unknown, used or expired. Never raises, like auth_rotate_refresh.
CREATE OR REPLACE FUNCTION public.auth_consume_password_reset(p_token_hash text, p_password_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user uuid;
BEGIN
  UPDATE auth.password_resets SET used_at = now()
  WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()
  RETURNING user_id INTO v_user;
  IF v_user IS NOT NULL THEN
    PERFORM public.auth_change_password(v_user, p_password_hash);
  END IF;
  RETURN v_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.auth_change_password(uuid, text), public.auth_consume_password_reset(text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.auth_change_password(uuid, text), public.auth_consume_password_reset(text, text)
TO service_role;
