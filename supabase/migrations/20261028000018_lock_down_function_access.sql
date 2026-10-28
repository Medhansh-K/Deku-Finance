-- Migration 18: Lock down function access
-- Deku Finance - close two tenant-isolation holes
--
-- 1. Postgres grants EXECUTE on new functions to PUBLIC, so the `anon` role (anyone holding the
--    public anon key shipped in the frontend) could call SECURITY DEFINER functions directly.
--    Several of them skip their permission check when auth.uid() IS NULL, e.g. issue_sales_invoice.
-- 2. is_superadmin() matched on the JWT email alone. With email confirmation off, anyone could
--    sign up with the superadmin's address before they did and read every tenant.

-- 1. Only signed-in users (and the backend service role) may call functions.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- 2. Superadmin is tied to a specific auth user id, never to a claimed email.
--    To grant it: UPDATE public.superadmins SET user_id = '<auth.users.id>' WHERE email = '...';
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.superadmins
    WHERE user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Self-check: fail the migration if the anon role can still run a money-moving function.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.issue_sales_invoice(uuid, uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute issue_sales_invoice';
  END IF;
END $$;
