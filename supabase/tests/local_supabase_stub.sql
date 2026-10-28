-- Minimal stand-in for what Supabase provides, so migrations can run on plain Postgres in CI
-- or locally (see supabase/tests/run_local.sh). Not used in real Supabase projects.
-- auth.uid()/auth.jwt()/auth.role() read the same request.jwt.* settings PostgREST sets,
-- so tests impersonate a user with: SELECT set_config('request.jwt.claim.sub', '<uuid>', true);

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  instance_id uuid,
  id uuid PRIMARY KEY,
  aud text,
  role text,
  email text UNIQUE,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change text,
  email_change_token_new text
);

CREATE TABLE auth.identities (
  id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  PRIMARY KEY (provider_id, provider)
);

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text)
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
