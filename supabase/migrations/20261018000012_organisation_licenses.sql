-- Migration 12: Organisation Licenses and Activation Governance
-- Deku Finance - License Management & Access Control

-- 1. Create Organisation Licenses Table
CREATE TABLE IF NOT EXISTS public.organisation_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  license_key text UNIQUE NOT NULL,
  license_type text NOT NULL CHECK (license_type IN ('temp', 'plan')),
  plan_tier text NOT NULL CHECK (plan_tier IN ('go', 'pro')),
  owner_email text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz, -- 15 days for temp license
  grace_period_ends_at timestamptz, -- 20 days for temp license (15d trial + 5d migration)
  expires_at timestamptz NOT NULL, -- Final hard termination timestamp
  status text NOT NULL CHECK (status IN ('pending_activation', 'active', 'grace_period', 'expired', 'revoked')) DEFAULT 'pending_activation',
  activated_at timestamptz,
  activated_by_email text,
  last_email_sent_at timestamptz DEFAULT now(),
  features jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_org_active_license UNIQUE (organisation_id, license_key),
  CONSTRAINT uk_organisation_licenses_org_id UNIQUE (organisation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_licenses_org_status ON public.organisation_licenses(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_licenses_owner_email ON public.organisation_licenses(owner_email);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.organisation_licenses(license_key);

-- 2. Trigger for updated_at
CREATE TRIGGER trg_org_licenses_updated_at
  BEFORE UPDATE ON public.organisation_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. License Key Generator Function
CREATE OR REPLACE FUNCTION public.generate_license_key(p_type text, p_tier text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_random text;
BEGIN
  v_random := upper(substr(md5(random()::text), 1, 4) || '-' || substr(md5(random()::text), 5, 4));
  RETURN 'DEKU-' || upper(p_type) || '-' || upper(p_tier) || '-' || v_random;
END;
$$;

-- 4. Function to Issue New License for an Organisation
CREATE OR REPLACE FUNCTION public.issue_organisation_license(
  p_org_id uuid,
  p_owner_email text,
  p_type text DEFAULT 'temp',
  p_tier text DEFAULT 'go',
  p_tenure_days int DEFAULT 30
)
RETURNS public.organisation_licenses
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license_key text;
  v_trial_ends timestamptz := NULL;
  v_grace_ends timestamptz := NULL;
  v_expires timestamptz;
  v_result public.organisation_licenses;
BEGIN
  v_license_key := public.generate_license_key(p_type, p_tier);

  IF p_type = 'temp' THEN
    -- 15 days unrestricted trial + 5 days migration/purchase grace period = 20 days total access
    v_trial_ends := now() + INTERVAL '15 days';
    v_grace_ends := now() + INTERVAL '20 days';
    v_expires := v_grace_ends;
  ELSE
    -- Plan license: terminates strictly as per plan tenure
    v_expires := now() + (p_tenure_days || ' days')::interval;
  END IF;

  INSERT INTO public.organisation_licenses (
    organisation_id,
    license_key,
    license_type,
    plan_tier,
    owner_email,
    issued_at,
    trial_ends_at,
    grace_period_ends_at,
    expires_at,
    status,
    features
  )
  VALUES (
    p_org_id,
    v_license_key,
    p_type,
    p_tier,
    p_owner_email,
    now(),
    v_trial_ends,
    v_grace_ends,
    v_expires,
    'pending_activation',
    jsonb_build_object(
      'max_monthly_bills', CASE WHEN p_tier = 'go' THEN 150 ELSE -1 END,
      'has_gstn_json', CASE WHEN p_tier = 'pro' THEN true ELSE false END,
      'has_custom_fields', true,
      'has_upi_qr', true,
      'seats', CASE WHEN p_tier = 'go' THEN 2 ELSE -1 END
    )
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 5. Function to Activate Organisation License with Key and Credentials
CREATE OR REPLACE FUNCTION public.activate_organisation_license(
  p_license_key text,
  p_owner_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license public.organisation_licenses;
  v_effective_status text;
BEGIN
  SELECT * INTO v_license
  FROM public.organisation_licenses
  WHERE license_key = p_license_key
    AND lower(owner_email) = lower(p_owner_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid license key or owner email mismatch. Please check your activation email.'
    );
  END IF;

  -- Determine effective status based on timestamps
  IF now() > v_license.expires_at THEN
    v_effective_status := 'expired';
  ELSIF v_license.license_type = 'temp' AND now() > v_license.trial_ends_at AND now() <= v_license.grace_period_ends_at THEN
    v_effective_status := 'grace_period';
  ELSE
    v_effective_status := 'active';
  END IF;

  IF v_effective_status = 'expired' THEN
    UPDATE public.organisation_licenses
    SET status = 'expired', updated_at = now()
    WHERE id = v_license.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'This license has expired (20-day access limit exceeded). Please purchase a regular plan.'
    );
  END IF;

  -- Mark as activated
  UPDATE public.organisation_licenses
  SET
    status = v_effective_status,
    activated_at = COALESCE(activated_at, now()),
    activated_by_email = p_owner_email,
    updated_at = now()
  WHERE id = v_license.id
  RETURNING * INTO v_license;

  RETURN jsonb_build_object(
    'success', true,
    'license_id', v_license.id,
    'organisation_id', v_license.organisation_id,
    'license_key', v_license.license_key,
    'license_type', v_license.license_type,
    'plan_tier', v_license.plan_tier,
    'status', v_license.status,
    'trial_ends_at', v_license.trial_ends_at,
    'grace_period_ends_at', v_license.grace_period_ends_at,
    'expires_at', v_license.expires_at
  );
END;
$$;

-- 6. Row Level Security (RLS) for Organisation Licenses
ALTER TABLE public.organisation_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organisation_licenses_select" ON public.organisation_licenses;
CREATE POLICY "organisation_licenses_select"
  ON public.organisation_licenses FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "organisation_licenses_admin_manage" ON public.organisation_licenses;
CREATE POLICY "organisation_licenses_admin_manage"
  ON public.organisation_licenses FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
  );

-- 7. Seed Default Active GO License for Organisations
DO $$
DECLARE
  v_org RECORD;
BEGIN
  -- 1. Ensure the default organisation 'b127e064-5da8-437f-94c4-b8d6a0c12927' (Deku Financial Technologies) has an active GO license
  IF EXISTS (SELECT 1 FROM public.organisations WHERE id = 'b127e064-5da8-437f-94c4-b8d6a0c12927') THEN
    IF NOT EXISTS (SELECT 1 FROM public.organisation_licenses WHERE organisation_id = 'b127e064-5da8-437f-94c4-b8d6a0c12927') THEN
      INSERT INTO public.organisation_licenses (
        organisation_id,
        license_key,
        license_type,
        plan_tier,
        owner_email,
        issued_at,
        trial_ends_at,
        grace_period_ends_at,
        expires_at,
        status,
        activated_at,
        activated_by_email,
        features
      )
      VALUES (
        'b127e064-5da8-437f-94c4-b8d6a0c12927',
        'DEKU-PLAN-GO-9601-ROOT',
        'plan',
        'go',
        'admin@deku.finance',
        now(),
        now() + interval '15 days',
        now() + interval '20 days',
        now() + interval '365 days',
        'active',
        now(),
        'admin@deku.finance',
        jsonb_build_object(
          'max_monthly_bills', 150,
          'has_gstn_json', false,
          'has_custom_fields', true,
          'has_upi_qr', true,
          'seats', 2
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 2. Ensure all other existing organisations also get an active GO tier license by default
  FOR v_org IN 
    SELECT id FROM public.organisations WHERE id != 'b127e064-5da8-437f-94c4-b8d6a0c12927'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.organisation_licenses WHERE organisation_id = v_org.id
    ) THEN
      INSERT INTO public.organisation_licenses (
        organisation_id,
        license_key,
        license_type,
        plan_tier,
        owner_email,
        issued_at,
        trial_ends_at,
        grace_period_ends_at,
        expires_at,
        status,
        activated_at,
        activated_by_email,
        features
      )
      VALUES (
        v_org.id,
        public.generate_license_key('plan', 'go'),
        'plan',
        'go',
        'admin@deku.finance',
        now(),
        now() + interval '15 days',
        now() + interval '20 days',
        now() + interval '365 days',
        'active',
        now(),
        'admin@deku.finance',
        jsonb_build_object(
          'max_monthly_bills', 150,
          'has_gstn_json', false,
          'has_custom_fields', true,
          'has_upi_qr', true,
          'seats', 2
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

