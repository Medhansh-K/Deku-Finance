-- Migration 38: KYC and identity verification
-- Deku Finance - provider-neutral; no KYC provider has been chosen (docs/IMPLEMENTATION_PLAN.md §6). The
-- backend adapter (backend/src/integrations/kyc.rs) stays switched off until KYC_PROVIDER is set.
--
-- Deku keeps the outcome of a check and the provider's reference, never the documents themselves.
-- Members read their company's rows; writes come only from the backend's service token.

CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (subject IN ('person', 'business')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('pan', 'udyam', 'gstin', 'digilocker', 'entitylocker')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9_]+$'),
  provider_ref text CHECK (provider_ref IS NULL OR length(provider_ref) <= 200),
  verified_name text CHECK (verified_name IS NULL OR length(verified_name) <= 200),
  verified_at timestamptz,
  expires_at timestamptz,
  failure_reason text CHECK (failure_reason IS NULL OR length(failure_reason) <= 500),
  raw_minimal jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_kyc_subject_user CHECK ((subject = 'person') = (user_id IS NOT NULL)),
  CONSTRAINT chk_kyc_method_subject CHECK (
    (subject = 'person' AND method IN ('pan', 'digilocker'))
    OR (subject = 'business' AND method IN ('pan', 'udyam', 'gstin', 'entitylocker'))
  ),
  CONSTRAINT chk_kyc_verified CHECK (status <> 'verified' OR verified_at IS NOT NULL),
  -- The Aadhaar Act (s.29) and UIDAI rules bar storing Aadhaar numbers outside a licensed vault, so a
  -- 12-digit (Aadhaar) or 16-digit (Virtual ID) run, with or without spaces or dashes, is refused
  -- wherever a provider's reply could carry it. Keep only a masked form or the provider's reference.
  -- Letters and dashes next to the digits make it part of a longer token, so UUIDs still pass.
  CONSTRAINT chk_kyc_no_aadhaar CHECK (
    raw_minimal::text !~ '(^|[^0-9A-Za-z-])[0-9]{4}([ -]?[0-9]{4}){2,3}([^0-9A-Za-z-]|$)'
    AND coalesce(provider_ref, '') !~ '(^|[^0-9A-Za-z-])[0-9]{4}([ -]?[0-9]{4}){2,3}([^0-9A-Za-z-]|$)'
  ),
  -- Small enough that a scanned document or photo (base64) can't be stashed here.
  CONSTRAINT chk_kyc_raw_minimal_small CHECK (octet_length(raw_minimal::text) <= 4096)
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_org ON public.kyc_verifications(organisation_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_kyc_verifications_updated_at ON public.kyc_verifications;
CREATE TRIGGER trg_kyc_verifications_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON public.kyc_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.kyc_verifications TO authenticated;
GRANT ALL ON public.kyc_verifications TO service_role;

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_verifications_select" ON public.kyc_verifications;
CREATE POLICY "kyc_verifications_select"
  ON public.kyc_verifications FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

-- Cloud SQL may create service_role without BYPASSRLS (migration 000), so it needs a policy.
DROP POLICY IF EXISTS "kyc_verifications_service" ON public.kyc_verifications;
CREATE POLICY "kyc_verifications_service"
  ON public.kyc_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trust level from current (verified, unexpired) checks:
--   0 unverified, 1 the business is verified, 2 the business and at least one member are verified.
-- Sandbox checks never count: they verify nothing. security_invoker keeps the caller's RLS.
CREATE OR REPLACE VIEW public.organisation_trust_level WITH (security_invoker = true) AS
SELECT
  o.id AS organisation_id,
  coalesce(bool_or(v.subject = 'business'), false) AS business_verified,
  coalesce(bool_or(v.subject = 'person'), false) AS person_verified,
  CASE
    WHEN coalesce(bool_or(v.subject = 'business'), false) AND coalesce(bool_or(v.subject = 'person'), false) THEN 2
    WHEN coalesce(bool_or(v.subject = 'business'), false) THEN 1
    ELSE 0
  END AS trust_level,
  array_remove(array_agg(DISTINCT v.method), NULL) AS verified_methods
FROM public.organisations o
LEFT JOIN public.kyc_verifications v
  ON v.organisation_id = o.id
 AND v.status = 'verified'
 AND (v.expires_at IS NULL OR v.expires_at > now())
 AND v.provider <> 'sandbox'
GROUP BY o.id;

REVOKE ALL ON public.organisation_trust_level FROM PUBLIC, anon;
GRANT SELECT ON public.organisation_trust_level TO authenticated, service_role;
