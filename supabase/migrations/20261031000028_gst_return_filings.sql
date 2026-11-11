-- Migration 28: Prepared and filed GST returns
-- Deku Finance - the GSTR-1 / GSTR-3B JSON the backend computed (backend/src/gst), recorded as
-- prepared, then marked filed with the portal's ARN. A filed row never changes again.

CREATE TABLE IF NOT EXISTS public.gst_return_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  ret_period char(6) NOT NULL CHECK (ret_period ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
  return_type text NOT NULL CHECK (return_type IN ('GSTR1', 'GSTR3B')),
  json jsonb NOT NULL,
  -- Summary rows and, for GSTR-3B, the Table 6 set-off as computed when recorded.
  summary jsonb NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'filed')),
  prepared_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  filed_arn text CHECK (filed_arn ~ '^[A-Z0-9]+$'),
  filed_at timestamptz,
  filed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT uk_gst_return_filings UNIQUE (organisation_id, ret_period, return_type),
  CONSTRAINT chk_gst_return_filings_filed CHECK (
    (status = 'prepared' AND filed_arn IS NULL AND filed_at IS NULL AND filed_by IS NULL)
    OR (status = 'filed' AND filed_arn IS NOT NULL AND filed_at IS NOT NULL AND filed_by IS NOT NULL)
  )
);

-- Stamps who prepared or filed from the caller's token (the client never supplies these) and
-- keeps filed rows immutable, including for roles that bypass RLS.
CREATE OR REPLACE FUNCTION public.gst_return_filings_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'filed' THEN
    RAISE EXCEPTION 'GST return % for % is filed and cannot be changed', OLD.return_type, OLD.ret_period;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.status = 'prepared' THEN
    NEW.prepared_by := auth.uid();
    NEW.prepared_at := now();
  ELSIF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Record the prepared return before marking it filed';
  ELSE
    -- Filing freezes exactly what was prepared.
    NEW.json := OLD.json;
    NEW.summary := OLD.summary;
    NEW.prepared_by := OLD.prepared_by;
    NEW.prepared_at := OLD.prepared_at;
    NEW.filed_by := auth.uid();
    NEW.filed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gst_return_filings_guard() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_gst_return_filings_guard ON public.gst_return_filings;
CREATE TRIGGER trg_gst_return_filings_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.gst_return_filings
  FOR EACH ROW
  EXECUTE FUNCTION public.gst_return_filings_guard();

ALTER TABLE public.gst_return_filings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gst_return_filings_select" ON public.gst_return_filings;
CREATE POLICY "gst_return_filings_select"
  ON public.gst_return_filings FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "gst_return_filings_insert" ON public.gst_return_filings;
CREATE POLICY "gst_return_filings_insert"
  ON public.gst_return_filings FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  );

DROP POLICY IF EXISTS "gst_return_filings_update" ON public.gst_return_filings;
CREATE POLICY "gst_return_filings_update"
  ON public.gst_return_filings FOR UPDATE TO authenticated
  USING (
    status = 'prepared'
    AND public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  );

-- No delete policy: a prepared return is replaced by recording it again, a filed one stays.
