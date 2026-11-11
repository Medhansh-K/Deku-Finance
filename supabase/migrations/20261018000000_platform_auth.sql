-- Migration 0: Platform identity layer (replaces what Supabase used to provide)
-- Deku Finance - see docs/PLATFORM_ARCHITECTURE.md. Runs on a fresh Postgres 16 before 001.
-- Passwords for login roles are never set here; db/migrate.sh sets authenticator's from env.

-- 1. Roles PostgREST switches into
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    BEGIN
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      -- Managed Postgres (Cloud SQL) may refuse BYPASSRLS. service_role only calls the
      -- SECURITY DEFINER auth_* functions below, which do not depend on it.
      RAISE WARNING 'cannot grant BYPASSRLS here; creating service_role without it';
      CREATE ROLE service_role NOLOGIN;
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;

-- pgcrypto stays in public: seed.sql calls crypt()/gen_salt() and migration 016 calls
-- gen_random_bytes() with search_path = public.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. auth schema
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}',
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Legacy Supabase columns, kept only so supabase/seed.sql inserts unchanged
  instance_id uuid,
  aud text,
  role text,
  confirmation_token text,
  recovery_token text,
  email_change text,
  email_change_token_new text
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  identity_data jsonb,
  provider text NOT NULL,
  last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (provider_id, provider)
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON auth.refresh_tokens(user_id);

-- 3. Request identity, from the claims PostgREST sets per request. The legacy
--    request.jwt.claim.* settings are still honoured so SQL tests can impersonate with set_config.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(auth.jwt() ->> 'sub', ''),
    nullif(current_setting('request.jwt.claim.sub', true), '')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_user::text
  )
$$;

-- RLS policies call auth.uid()/auth.role() as the request role; the tables stay private.
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role() TO anon, authenticated, service_role;

-- 4. Storage metadata (migration 008 adds the invoice-vault bucket and policies; bytes go to GCS)
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA storage TO authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;

-- 5. public grants. RLS policies remain the real gate; anon gets no table access.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- 6. Login primitives for the Rust backend (service_role only). Hashing happens in Rust (bcrypt);
--    refresh tokens arrive as SHA-256 hex, never in clear.
CREATE OR REPLACE FUNCTION public.auth_register(p_email text, p_password_hash text, p_meta jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- is_demo marks the seeded sandbox accounts; a signup must never claim it.
  INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, raw_app_meta_data, aud, role)
  VALUES (
    lower(trim(p_email)), p_password_hash, coalesce(p_meta, '{}') - 'is_demo',
    '{"provider":"email","providers":["email"]}', 'authenticated', 'authenticated'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'email_taken';
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_credentials(p_email text)
RETURNS TABLE (id uuid, password_hash text, email text, meta jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.encrypted_password, u.email, u.raw_user_meta_data
  FROM auth.users u
  WHERE u.email = lower(trim(p_email))
$$;

CREATE OR REPLACE FUNCTION public.auth_user(p_id uuid)
RETURNS TABLE (id uuid, email text, meta jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email, u.raw_user_meta_data FROM auth.users u WHERE u.id = p_id
$$;

CREATE OR REPLACE FUNCTION public.auth_store_refresh(p_user uuid, p_token_hash text, p_expires timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at) VALUES (p_user, p_token_hash, p_expires)
$$;

CREATE OR REPLACE FUNCTION public.auth_rotate_refresh(p_old_hash text, p_new_hash text, p_expires timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_tok auth.refresh_tokens;
BEGIN
  SELECT * INTO v_tok FROM auth.refresh_tokens WHERE token_hash = p_old_hash FOR UPDATE;

  -- Every failure returns NULL (backend answers 401 invalid_refresh): raising through PostgREST
  -- would roll back the reuse revocation below.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_tok.revoked_at IS NOT NULL THEN
    -- Reuse of a rotated token: assume it was stolen and end every session of that user.
    UPDATE auth.refresh_tokens SET revoked_at = now()
    WHERE user_id = v_tok.user_id AND revoked_at IS NULL;
    RETURN NULL;
  END IF;

  IF v_tok.expires_at <= now() THEN
    RETURN NULL;
  END IF;

  UPDATE auth.refresh_tokens SET revoked_at = now() WHERE id = v_tok.id;
  INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at) VALUES (v_tok.user_id, p_new_hash, p_expires);
  RETURN v_tok.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_revoke_refresh(p_token_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  UPDATE auth.refresh_tokens SET revoked_at = now() WHERE token_hash = p_token_hash AND revoked_at IS NULL
$$;

REVOKE EXECUTE ON FUNCTION
  public.auth_register(text, text, jsonb),
  public.auth_credentials(text),
  public.auth_user(uuid),
  public.auth_store_refresh(uuid, text, timestamptz),
  public.auth_rotate_refresh(text, text, timestamptz),
  public.auth_revoke_refresh(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.auth_register(text, text, jsonb),
  public.auth_credentials(text),
  public.auth_user(uuid),
  public.auth_store_refresh(uuid, text, timestamptz),
  public.auth_rotate_refresh(text, text, timestamptz),
  public.auth_revoke_refresh(text)
TO service_role;
