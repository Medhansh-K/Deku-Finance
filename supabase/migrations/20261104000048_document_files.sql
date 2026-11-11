-- Deku Finance - supporting documents for vouchers, stored in Postgres.
-- In the database so one backup covers the books and their evidence, and local Docker and GCP behave the
-- same. Files are capped at 10 MB. They are evidence, so they can't be changed or removed once attached.
-- shortcut: bytes in Postgres grow the database and its backups; move to object storage if volumes get large.

CREATE TABLE IF NOT EXISTS public.document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 255),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  byte_size integer NOT NULL,
  category text,
  reference text,
  data bytea NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_document_files_size CHECK (octet_length(data) BETWEEN 1 AND 10485760 AND byte_size = octet_length(data))
);

CREATE INDEX IF NOT EXISTS idx_document_files_org_journal
  ON public.document_files(organisation_id, journal_entry_id);

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE, TRUNCATE ON public.document_files FROM authenticated;

DROP POLICY IF EXISTS "document_files_select" ON public.document_files;
CREATE POLICY "document_files_select"
  ON public.document_files FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "document_files_insert" ON public.document_files;
CREATE POLICY "document_files_insert"
  ON public.document_files FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND uploaded_by = auth.uid()
    AND (
      journal_entry_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.journal_entries e
        WHERE e.id = journal_entry_id AND e.organisation_id = document_files.organisation_id
      )
    )
  );

CREATE OR REPLACE FUNCTION public.audit_document_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_audit_event(
    NEW.organisation_id, 'document_attached', 'document_file', NEW.id,
    jsonb_build_object('filename', NEW.filename, 'byte_size', NEW.byte_size, 'journal_entry_id', NEW.journal_entry_id)
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_document_file() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_document_files_audit ON public.document_files;
CREATE TRIGGER trg_document_files_audit
  AFTER INSERT ON public.document_files
  FOR EACH ROW EXECUTE FUNCTION public.audit_document_file();
