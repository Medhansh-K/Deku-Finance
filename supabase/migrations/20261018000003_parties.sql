-- Migration 3: Parties (Customers, Vendors, Counterparties)
-- Deku Finance - Counterparties Module

-- 1. Party Type Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_type') THEN
    CREATE TYPE public.party_type AS ENUM (
      'customer',
      'vendor',
      'both',
      'other'
    );
  END IF;
END $$;

-- 2. Parties Table
CREATE TABLE IF NOT EXISTS public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  type public.party_type NOT NULL DEFAULT 'customer',
  legal_name text NOT NULL,
  display_name text NOT NULL,
  gstin text,
  pan text,
  email text,
  phone text,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uk_parties_org_id UNIQUE (organisation_id, id),
  CONSTRAINT chk_parties_gstin_format CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  CONSTRAINT chk_parties_pan_format CHECK (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parties_org ON public.parties(organisation_id);
CREATE INDEX IF NOT EXISTS idx_parties_org_type ON public.parties(organisation_id, type);
CREATE INDEX IF NOT EXISTS idx_parties_gstin ON public.parties(organisation_id, gstin) WHERE gstin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parties_active ON public.parties(organisation_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER trg_parties_updated_at
  BEFORE UPDATE ON public.parties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Row Level Security Policies
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties_select_org_members"
  ON public.parties
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "parties_insert_permitted"
  ON public.parties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "parties_update_permitted"
  ON public.parties
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "parties_delete_admins"
  ON public.parties
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
  );
