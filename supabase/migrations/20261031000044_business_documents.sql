-- Migration 44: business documents from the Document Builder (M35)
-- Deku Finance
--
-- Quotations, proforma invoices, purchase orders and delivery challans. None of them touches the
-- ledger or a GST return. A quotation or proforma converts into a DRAFT sales invoice; issuing it
-- (tax checks, plan limits, journal) stays with issue_sales_invoice.
--
-- Purchase orders do not convert: purchase_bills (migration 24) is the supplier's bill as received.
-- It has no draft state, needs the supplier's own bill number and GSTIN, and every row feeds
-- GSTR-3B Table 4 ITC, so a bill made from a PO would claim credit for a bill nobody has received.

CREATE TABLE IF NOT EXISTS public.business_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('quotation', 'proforma', 'purchase_order', 'delivery_challan')),
  doc_number text NOT NULL CHECK (btrim(doc_number) <> ''),
  doc_date date NOT NULL,
  valid_until date,
  due_date date,
  party_id uuid,
  -- Name, GSTIN, address, phone and email as printed; filled from the party or typed for a prospect.
  party_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  place_of_supply text,
  supply_type public.supply_type NOT NULL DEFAULT 'intra_state' CHECK (supply_type IN ('intra_state', 'inter_state')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled')),
  taxable_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (taxable_amount >= 0),
  cgst_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (sgst_amount >= 0),
  igst_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (igst_amount >= 0),
  cess_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cess_amount >= 0),
  total_tax numeric(15, 2) NOT NULL DEFAULT 0 CHECK (total_tax >= 0),
  round_off numeric(15, 2) NOT NULL DEFAULT 0 CHECK (abs(round_off) < 1),
  total_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text,
  terms text,
  -- Type-specific print fields, e.g. a challan's transport reason, vehicle and e-way bill number.
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  converted_to_type text CHECK (converted_to_type IN ('sales_invoice', 'purchase_bill')),
  converted_to_id uuid,
  converted_at timestamptz,
  -- A challan's goods are billed later; this points at that invoice.
  linked_invoice_id uuid,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_business_documents_number UNIQUE (organisation_id, doc_type, doc_number),
  CONSTRAINT uk_business_documents_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_business_documents_party FOREIGN KEY (organisation_id, party_id)
    REFERENCES public.parties(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_business_documents_linked_invoice FOREIGN KEY (organisation_id, linked_invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_business_documents_valid_until CHECK (valid_until IS NULL OR valid_until >= doc_date),
  CONSTRAINT chk_business_documents_converted CHECK ((status = 'converted') = (converted_to_id IS NOT NULL)),
  CONSTRAINT chk_business_documents_converted_type CHECK ((converted_to_id IS NULL) = (converted_to_type IS NULL)),
  CONSTRAINT chk_business_documents_challan_no_convert CHECK (doc_type <> 'delivery_challan' OR converted_to_id IS NULL),
  CONSTRAINT chk_business_documents_link_challan CHECK (doc_type = 'delivery_challan' OR linked_invoice_id IS NULL),
  CONSTRAINT chk_business_documents_total CHECK (total_amount = taxable_amount + total_tax + round_off)
);

CREATE INDEX IF NOT EXISTS idx_business_documents_org_type ON public.business_documents(organisation_id, doc_type, status);
CREATE INDEX IF NOT EXISTS idx_business_documents_org_date ON public.business_documents(organisation_id, doc_date);

DROP TRIGGER IF EXISTS trg_business_documents_updated_at ON public.business_documents;
CREATE TRIGGER trg_business_documents_updated_at
  BEFORE UPDATE ON public.business_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Same shape as sales_invoice_lines so conversion is a straight copy.
CREATE TABLE IF NOT EXISTS public.business_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  document_id uuid NOT NULL,
  line_number integer NOT NULL,
  item_id uuid,
  item_name text NOT NULL CHECK (btrim(item_name) <> ''),
  description text,
  hsn_sac_code text,
  unit_code text NOT NULL DEFAULT 'OTH',
  quantity numeric(15, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(15, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (taxable_amount >= 0),
  gst_rate numeric(5, 2) NOT NULL DEFAULT 0 CHECK (gst_rate >= 0 AND gst_rate <= 100),
  cgst_rate numeric(5, 2) NOT NULL DEFAULT 0 CHECK (cgst_rate >= 0),
  cgst_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_rate numeric(5, 2) NOT NULL DEFAULT 0 CHECK (sgst_rate >= 0),
  sgst_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (sgst_amount >= 0),
  igst_rate numeric(5, 2) NOT NULL DEFAULT 0 CHECK (igst_rate >= 0),
  igst_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (igst_amount >= 0),
  cess_rate numeric(5, 2) NOT NULL DEFAULT 0 CHECK (cess_rate >= 0),
  cess_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cess_amount >= 0),
  total_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_business_document_lines_org_id UNIQUE (organisation_id, id),
  CONSTRAINT uk_business_document_lines_doc_line UNIQUE (document_id, line_number),
  CONSTRAINT fk_business_document_lines_doc FOREIGN KEY (organisation_id, document_id)
    REFERENCES public.business_documents(organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_business_document_lines_item FOREIGN KEY (organisation_id, item_id)
    REFERENCES public.catalogue_items(organisation_id, id) ON DELETE SET NULL,
  CONSTRAINT chk_business_document_lines_total
    CHECK (total_amount = taxable_amount + cgst_amount + sgst_amount + igst_amount + cess_amount)
);

CREATE INDEX IF NOT EXISTS idx_business_document_lines_doc ON public.business_document_lines(document_id);

-- The invoice side of the two-way link; the unique index also stops a second invoice per document.
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS source_document_id uuid;
ALTER TABLE public.sales_invoices DROP CONSTRAINT IF EXISTS fk_sales_invoices_source_document;
ALTER TABLE public.sales_invoices ADD CONSTRAINT fk_sales_invoices_source_document
  FOREIGN KEY (organisation_id, source_document_id)
  REFERENCES public.business_documents(organisation_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoices_source_document
  ON public.sales_invoices(source_document_id) WHERE source_document_id IS NOT NULL;

-- Drafts change freely. After that only the status moves (along the allowed paths) and a challan
-- may be linked to its invoice; converted and cancelled documents never change. Only drafts delete.
CREATE OR REPLACE FUNCTION public.guard_business_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_free text[] := ARRAY['status', 'updated_at', 'linked_invoice_id', 'converted_to_type', 'converted_to_id', 'converted_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Document Violation: only draft documents can be deleted (% is %)', OLD.doc_number, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('converted', 'cancelled') THEN
    RAISE EXCEPTION 'Document Violation: % is % and cannot change', OLD.doc_number, OLD.status;
  END IF;
  IF OLD.status <> 'draft' AND (to_jsonb(NEW) - v_free) IS DISTINCT FROM (to_jsonb(OLD) - v_free) THEN
    RAISE EXCEPTION 'Document Violation: only draft documents can be edited (% is %)', OLD.doc_number, OLD.status;
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status IN ('sent', 'cancelled', 'converted'))
    OR (OLD.status = 'sent' AND NEW.status IN ('accepted', 'rejected', 'cancelled', 'converted'))
    OR (OLD.status = 'accepted' AND NEW.status IN ('cancelled', 'converted'))
    OR (OLD.status = 'rejected' AND NEW.status = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Document Violation: % cannot move from % to %', OLD.doc_number, OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_business_documents ON public.business_documents;
CREATE TRIGGER trg_guard_business_documents
  BEFORE UPDATE OR DELETE ON public.business_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_business_document();

-- SECURITY DEFINER so the parent's status is read even where RLS would hide it.
CREATE OR REPLACE FUNCTION public.guard_business_document_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.business_documents WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  -- No parent row means the document itself is being deleted (cascade), which its guard allowed.
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'Document Violation: lines of a % document cannot be modified', v_status;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.document_id <> OLD.document_id
     AND (SELECT status FROM public.business_documents WHERE id = OLD.document_id) <> 'draft' THEN
    RAISE EXCEPTION 'Document Violation: lines cannot move off a non-draft document';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_business_document_lines ON public.business_document_lines;
CREATE TRIGGER trg_guard_business_document_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.business_document_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_business_document_lines();

-- Creates (no "id" in p_doc) or updates a draft and replaces its lines in one transaction; header
-- totals are always the sum of the lines. Runs as the caller, so RLS decides who may write.
CREATE OR REPLACE FUNCTION public.save_business_document(p_org_id uuid, p_doc jsonb, p_lines jsonb)
RETURNS public.business_documents
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_doc public.business_documents;
  v_bad integer;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'A document needs at least one line';
  END IF;

  IF p_doc->>'id' IS NULL THEN
    INSERT INTO public.business_documents (
      organisation_id, doc_type, doc_number, doc_date, valid_until, due_date, party_id, party_snapshot,
      place_of_supply, supply_type, notes, terms, details
    ) VALUES (
      p_org_id, p_doc->>'doc_type', btrim(p_doc->>'doc_number'), (p_doc->>'doc_date')::date,
      (p_doc->>'valid_until')::date, (p_doc->>'due_date')::date, (p_doc->>'party_id')::uuid,
      COALESCE(p_doc->'party_snapshot', '{}'::jsonb), NULLIF(btrim(p_doc->>'place_of_supply'), ''),
      COALESCE(p_doc->>'supply_type', 'intra_state')::public.supply_type, p_doc->>'notes', p_doc->>'terms',
      COALESCE(p_doc->'details', '{}'::jsonb)
    )
    RETURNING * INTO v_doc;
  ELSE
    SELECT * INTO v_doc FROM public.business_documents
    WHERE id = (p_doc->>'id')::uuid AND organisation_id = p_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document not found';
    END IF;
    IF v_doc.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft documents can be edited (% is %)', v_doc.doc_number, v_doc.status;
    END IF;
    -- doc_type is fixed once created: the number series is per type.
    UPDATE public.business_documents SET
      doc_number = btrim(p_doc->>'doc_number'),
      doc_date = (p_doc->>'doc_date')::date,
      valid_until = (p_doc->>'valid_until')::date,
      due_date = (p_doc->>'due_date')::date,
      party_id = (p_doc->>'party_id')::uuid,
      party_snapshot = COALESCE(p_doc->'party_snapshot', '{}'::jsonb),
      place_of_supply = NULLIF(btrim(p_doc->>'place_of_supply'), ''),
      supply_type = COALESCE(p_doc->>'supply_type', 'intra_state')::public.supply_type,
      notes = p_doc->>'notes',
      terms = p_doc->>'terms',
      details = COALESCE(p_doc->'details', '{}'::jsonb)
    WHERE id = v_doc.id
    RETURNING * INTO v_doc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Permission denied: cannot edit this document';
    END IF;
    DELETE FROM public.business_document_lines WHERE document_id = v_doc.id;
  END IF;

  INSERT INTO public.business_document_lines (
    organisation_id, document_id, line_number, item_id, item_name, description, hsn_sac_code, unit_code,
    quantity, unit_price, discount_amount, taxable_amount, gst_rate, cgst_rate, cgst_amount, sgst_rate,
    sgst_amount, igst_rate, igst_amount, cess_rate, cess_amount, total_amount
  )
  SELECT p_org_id, v_doc.id, l.line_number, l.item_id, btrim(l.item_name), l.description, NULLIF(btrim(l.hsn_sac_code), ''),
         COALESCE(NULLIF(btrim(l.unit_code), ''), 'OTH'), l.quantity, l.unit_price, COALESCE(l.discount_amount, 0),
         l.taxable_amount, l.gst_rate, COALESCE(l.cgst_rate, 0), COALESCE(l.cgst_amount, 0), COALESCE(l.sgst_rate, 0),
         COALESCE(l.sgst_amount, 0), COALESCE(l.igst_rate, 0), COALESCE(l.igst_amount, 0), COALESCE(l.cess_rate, 0),
         COALESCE(l.cess_amount, 0), l.total_amount
  FROM jsonb_to_recordset(p_lines) AS l(
    line_number integer, item_id uuid, item_name text, description text, hsn_sac_code text, unit_code text,
    quantity numeric, unit_price numeric, discount_amount numeric, taxable_amount numeric, gst_rate numeric,
    cgst_rate numeric, cgst_amount numeric, sgst_rate numeric, sgst_amount numeric, igst_rate numeric,
    igst_amount numeric, cess_rate numeric, cess_amount numeric, total_amount numeric
  );

  -- Same split rule issue_sales_invoice applies, so a converted draft can be issued as is.
  SELECT count(*) INTO v_bad FROM public.business_document_lines
  WHERE document_id = v_doc.id AND CASE v_doc.supply_type
    WHEN 'intra_state' THEN igst_amount <> 0 OR abs(cgst_amount - sgst_amount) > 0.02
    ELSE cgst_amount <> 0 OR sgst_amount <> 0
  END;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Tax Rule Violation: % lines do not match the % supply split', v_bad, v_doc.supply_type;
  END IF;

  -- round_off is set here, with the totals, so the total CHECK holds at every step.
  UPDATE public.business_documents d SET
    round_off = COALESCE((p_doc->>'round_off')::numeric, 0),
    taxable_amount = s.taxable, cgst_amount = s.cgst, sgst_amount = s.sgst, igst_amount = s.igst,
    cess_amount = s.cess, total_tax = s.cgst + s.sgst + s.igst + s.cess,
    total_amount = s.taxable + s.cgst + s.sgst + s.igst + s.cess + COALESCE((p_doc->>'round_off')::numeric, 0)
  FROM (
    SELECT sum(taxable_amount) AS taxable, sum(cgst_amount) AS cgst, sum(sgst_amount) AS sgst,
           sum(igst_amount) AS igst, sum(cess_amount) AS cess
    FROM public.business_document_lines WHERE document_id = v_doc.id
  ) s
  WHERE d.id = v_doc.id
  RETURNING d.* INTO v_doc;

  RETURN v_doc;
END;
$$;

-- Quotation or proforma -> draft sales invoice with the same party, place of supply, lines and
-- totals. Never issues or posts. SECURITY DEFINER because the caller's RLS forbids setting
-- 'converted' directly; the role check below stands in for it.
CREATE OR REPLACE FUNCTION public.convert_business_document(p_org_id uuid, p_doc_id uuid, p_invoice_number text)
RETURNS public.business_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.business_documents;
  v_inv_id uuid;
BEGIN
  IF NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: cannot convert documents';
  END IF;

  SELECT * INTO v_doc FROM public.business_documents
  WHERE id = p_doc_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF v_doc.status = 'converted' THEN
    RAISE EXCEPTION 'Document % is already converted', v_doc.doc_number;
  END IF;
  IF v_doc.status IN ('rejected', 'cancelled') THEN
    RAISE EXCEPTION 'A % document cannot be converted', v_doc.status;
  END IF;
  IF v_doc.doc_type = 'delivery_challan' THEN
    RAISE EXCEPTION 'Delivery challans are dispatch records and do not convert; link the invoice to the challan instead';
  END IF;
  IF v_doc.doc_type = 'purchase_order' THEN
    RAISE EXCEPTION 'Purchase orders do not convert: record the supplier''s bill in Purchases when it arrives';
  END IF;
  IF v_doc.party_id IS NULL THEN
    RAISE EXCEPTION 'Choose a customer from Parties before converting %', v_doc.doc_number;
  END IF;
  IF v_doc.place_of_supply IS NULL THEN
    RAISE EXCEPTION 'Set the place of supply before converting %', v_doc.doc_number;
  END IF;
  IF p_invoice_number IS NULL OR btrim(p_invoice_number) = '' THEN
    RAISE EXCEPTION 'Enter the invoice number to use';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_document_lines WHERE document_id = v_doc.id) THEN
    RAISE EXCEPTION 'Document % has no lines', v_doc.doc_number;
  END IF;

  INSERT INTO public.sales_invoices (
    organisation_id, customer_id, invoice_number, invoice_date, due_date, status, supply_type, place_of_supply,
    customer_snapshot, taxable_amount, cgst_amount, sgst_amount, igst_amount, cess_amount, total_tax,
    round_off, total_amount, notes, terms, source_document_id, created_by
  ) VALUES (
    p_org_id, v_doc.party_id, btrim(p_invoice_number), CURRENT_DATE, GREATEST(CURRENT_DATE, COALESCE(v_doc.due_date, CURRENT_DATE)),
    'draft', v_doc.supply_type, v_doc.place_of_supply, v_doc.party_snapshot, v_doc.taxable_amount, v_doc.cgst_amount,
    v_doc.sgst_amount, v_doc.igst_amount, v_doc.cess_amount, v_doc.total_tax, v_doc.round_off, v_doc.total_amount,
    v_doc.notes, v_doc.terms, v_doc.id, auth.uid()
  )
  RETURNING id INTO v_inv_id;

  INSERT INTO public.sales_invoice_lines (
    organisation_id, invoice_id, line_number, item_id, item_name, description, hsn_sac_code, unit_code, quantity,
    unit_price, discount_amount, taxable_amount, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
    igst_rate, igst_amount, cess_rate, cess_amount, total_amount
  )
  SELECT p_org_id, v_inv_id, line_number, item_id, item_name, description, hsn_sac_code, unit_code, quantity,
         unit_price, discount_amount, taxable_amount, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
         igst_rate, igst_amount, cess_rate, cess_amount, total_amount
  FROM public.business_document_lines
  WHERE document_id = v_doc.id;

  UPDATE public.business_documents
  SET status = 'converted', converted_to_type = 'sales_invoice', converted_to_id = v_inv_id, converted_at = now()
  WHERE id = v_doc.id
  RETURNING * INTO v_doc;

  RETURN v_doc;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.guard_business_document(),
  public.guard_business_document_lines(),
  public.save_business_document(uuid, jsonb, jsonb),
  public.convert_business_document(uuid, uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.save_business_document(uuid, jsonb, jsonb),
  public.convert_business_document(uuid, uuid, text)
TO authenticated, service_role;

ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_document_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_documents_select" ON public.business_documents;
CREATE POLICY "business_documents_select"
  ON public.business_documents FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "business_documents_insert_draft" ON public.business_documents;
CREATE POLICY "business_documents_insert_draft"
  ON public.business_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
    AND converted_to_id IS NULL
  );

-- Status moves happen here (the guard checks the path); 'converted' needs a converted_to_id,
-- which WITH CHECK forbids, so only convert_business_document can convert.
DROP POLICY IF EXISTS "business_documents_update" ON public.business_documents;
CREATE POLICY "business_documents_update"
  ON public.business_documents FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status IN ('draft', 'sent', 'accepted', 'rejected')
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND converted_to_id IS NULL
  );

DROP POLICY IF EXISTS "business_documents_delete_draft" ON public.business_documents;
CREATE POLICY "business_documents_delete_draft"
  ON public.business_documents FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
    AND status = 'draft'
  );

DROP POLICY IF EXISTS "business_document_lines_select" ON public.business_document_lines;
CREATE POLICY "business_document_lines_select"
  ON public.business_document_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "business_document_lines_write" ON public.business_document_lines;
CREATE POLICY "business_document_lines_write"
  ON public.business_document_lines FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );
