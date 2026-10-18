-- Migration 4: Product and Service Catalogue
-- Deku Finance - Catalogue Module

-- 1. Item Type Enum (Goods vs Services)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalogue_item_type') THEN
    CREATE TYPE public.catalogue_item_type AS ENUM (
      'goods',
      'services'
    );
  END IF;
END $$;

-- 2. Catalogue Items Table
CREATE TABLE IF NOT EXISTS public.catalogue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  type public.catalogue_item_type NOT NULL DEFAULT 'services',
  name text NOT NULL,
  description text,
  sku text,
  hsn_sac_code text,
  unit_code text NOT NULL DEFAULT 'OTH',
  default_unit_price numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (default_unit_price >= 0),
  default_gst_rate numeric(5, 2) NOT NULL DEFAULT 0.00 CHECK (default_gst_rate >= 0 AND default_gst_rate <= 100),
  is_taxable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uk_catalogue_items_org_id UNIQUE (organisation_id, id)
);

-- Organization-scoped uniqueness for SKU allowing multiple nulls
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogue_items_org_sku
  ON public.catalogue_items (organisation_id, sku)
  WHERE sku IS NOT NULL;

-- Supporting Indexes
CREATE INDEX IF NOT EXISTS idx_catalogue_items_org ON public.catalogue_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_org_type ON public.catalogue_items(organisation_id, type);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_org_hsn ON public.catalogue_items(organisation_id, hsn_sac_code);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_active ON public.catalogue_items(organisation_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER trg_catalogue_items_updated_at
  BEFORE UPDATE ON public.catalogue_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Row Level Security Policies
ALTER TABLE public.catalogue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogue_select_org_members"
  ON public.catalogue_items
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "catalogue_insert_permitted"
  ON public.catalogue_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "catalogue_update_permitted"
  ON public.catalogue_items
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "catalogue_delete_admins"
  ON public.catalogue_items
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
  );
