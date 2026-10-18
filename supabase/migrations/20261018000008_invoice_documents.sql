-- Migration 8: Invoice Documents and Private Storage
-- Deku Finance - Document Vault & Storage RLS

-- 1. Invoice Documents Metadata Table
CREATE TABLE IF NOT EXISTS public.invoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  document_type text NOT NULL DEFAULT 'tax_invoice',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uk_invoice_documents_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_invoice_documents_invoice FOREIGN KEY (organisation_id, invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_documents_org ON public.invoice_documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_invoice_documents_invoice ON public.invoice_documents(invoice_id);

-- 2. Row Level Security for Invoice Documents Metadata
ALTER TABLE public.invoice_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_documents_select"
  ON public.invoice_documents FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "invoice_documents_insert"
  ON public.invoice_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "invoice_documents_delete"
  ON public.invoice_documents FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
  );

-- 3. Private Storage Bucket Setup (invoice-vault)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-vault',
  'invoice-vault',
  false,
  10485760, -- 10 MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- 4. Storage Security Policies for invoice-vault
-- Expected path convention: "organisation_id/invoice_id/filename.pdf"

CREATE OR REPLACE FUNCTION public.get_storage_org_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_first_segment text;
BEGIN
  v_first_segment := split_part(p_name, '/', 1);
  RETURN v_first_segment::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS "invoice_vault_select" ON storage.objects;
CREATE POLICY "invoice_vault_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-vault'
    AND public.is_org_member(public.get_storage_org_id(name))
  );

DROP POLICY IF EXISTS "invoice_vault_insert" ON storage.objects;
CREATE POLICY "invoice_vault_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-vault'
    AND public.has_role(
      public.get_storage_org_id(name),
      ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[]
    )
  );

DROP POLICY IF EXISTS "invoice_vault_delete" ON storage.objects;
CREATE POLICY "invoice_vault_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoice-vault'
    AND public.has_role(
      public.get_storage_org_id(name),
      ARRAY['owner', 'admin']::public.organisation_role[]
    )
  );
