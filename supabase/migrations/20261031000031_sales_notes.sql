-- Migration 31: Sales credit and debit notes (Section 34 CGST Act)
-- Deku Finance - a note always points at an issued invoice of the same company. Customer,
-- supply type and place of supply are copied from that invoice by trigger, so the tax split of
-- a note can't drift from the original. issue_sales_note validates and posts the journal in one
-- transaction; issued and cancelled notes are immutable.

CREATE TABLE IF NOT EXISTS public.sales_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  note_type text NOT NULL CHECK (note_type IN ('credit', 'debit')),
  original_invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  note_number text NOT NULL CHECK (btrim(note_number) <> ''),
  note_date date NOT NULL,
  reason_code text NOT NULL CHECK (reason_code IN (
    'sales_return', 'post_sale_discount', 'deficiency_in_service', 'correction_in_invoice',
    'change_in_pos', 'finalisation_of_provisional_assessment', 'others'
  )),
  reason text,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  supply_type public.supply_type NOT NULL,
  place_of_supply text NOT NULL,
  taxable_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (taxable_amount >= 0),
  cgst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
  sgst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
  igst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
  cess_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (cess_amount >= 0),
  total_tax numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_tax >= 0),
  total_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  journal_entry_id uuid,
  issued_at timestamptz,
  issued_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT uk_sales_notes_org_num UNIQUE (organisation_id, note_number),
  CONSTRAINT uk_sales_notes_org_id UNIQUE (organisation_id, id),
  -- Composite keys keep the invoice, customer and journal inside the same company.
  CONSTRAINT fk_sales_notes_invoice FOREIGN KEY (organisation_id, original_invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_sales_notes_customer FOREIGN KEY (organisation_id, customer_id)
    REFERENCES public.parties(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_sales_notes_journal FOREIGN KEY (organisation_id, journal_entry_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_notes_org_date ON public.sales_notes(organisation_id, note_date);
CREATE INDEX IF NOT EXISTS idx_sales_notes_invoice ON public.sales_notes(organisation_id, original_invoice_id);

DROP TRIGGER IF EXISTS trg_sales_notes_updated_at ON public.sales_notes;
CREATE TRIGGER trg_sales_notes_updated_at
  BEFORE UPDATE ON public.sales_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.sales_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  note_id uuid NOT NULL,
  line_number integer NOT NULL,
  item_id uuid,
  item_name text NOT NULL,
  description text,
  hsn_sac_code text,
  unit_code text NOT NULL DEFAULT 'OTH',
  quantity numeric(15, 4) NOT NULL DEFAULT 1.0000 CHECK (quantity > 0),
  unit_price numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
  discount_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  taxable_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (taxable_amount >= 0),
  gst_rate numeric(5, 2) NOT NULL DEFAULT 0.00 CHECK (gst_rate >= 0 AND gst_rate <= 100),
  cgst_rate numeric(5, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_rate >= 0),
  cgst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
  sgst_rate numeric(5, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_rate >= 0),
  sgst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
  igst_rate numeric(5, 2) NOT NULL DEFAULT 0.00 CHECK (igst_rate >= 0),
  igst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
  cess_rate numeric(5, 2) NOT NULL DEFAULT 0.00 CHECK (cess_rate >= 0),
  cess_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (cess_amount >= 0),
  total_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_sales_note_lines_org_id UNIQUE (organisation_id, id),
  CONSTRAINT uk_sales_note_lines_note_line UNIQUE (note_id, line_number),
  CONSTRAINT fk_sales_note_lines_note FOREIGN KEY (organisation_id, note_id)
    REFERENCES public.sales_notes(organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_sales_note_lines_item FOREIGN KEY (organisation_id, item_id)
    REFERENCES public.catalogue_items(organisation_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_note_lines_note ON public.sales_note_lines(note_id);

-- Copies customer, supply type and place of supply from the original invoice; the client's
-- values are ignored. Runs as the caller, so RLS on sales_invoices still applies.
CREATE OR REPLACE FUNCTION public.sales_notes_copy_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inv public.sales_invoices;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN
    RETURN NEW; -- the immutability guard decides
  END IF;
  SELECT * INTO v_inv FROM public.sales_invoices
  WHERE id = NEW.original_invoice_id AND organisation_id = NEW.organisation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original invoice not found in this company';
  END IF;
  IF v_inv.status <> 'issued' THEN
    RAISE EXCEPTION 'A note can only be raised against an issued invoice (invoice % is %)', v_inv.invoice_number, v_inv.status;
  END IF;
  NEW.customer_id := v_inv.customer_id;
  NEW.supply_type := v_inv.supply_type;
  NEW.place_of_supply := v_inv.place_of_supply;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_notes_copy_from_invoice ON public.sales_notes;
CREATE TRIGGER trg_sales_notes_copy_from_invoice
  BEFORE INSERT OR UPDATE ON public.sales_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_notes_copy_from_invoice();

-- Drafts change freely. An issued note may only become cancelled (and only its cancellation
-- fields change); a cancelled note never changes. Neither can be deleted.
CREATE OR REPLACE FUNCTION public.guard_sales_note_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cancel_cols text[] := ARRAY['status', 'cancelled_at', 'cancelled_by', 'cancellation_reason', 'updated_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Note Violation: Issued or cancelled notes cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'issued' AND NEW.status = 'cancelled'
     AND (to_jsonb(NEW) - v_cancel_cols) = (to_jsonb(OLD) - v_cancel_cols) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Note Violation: Issued or cancelled notes are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sales_notes ON public.sales_notes;
CREATE TRIGGER trg_guard_sales_notes
  BEFORE UPDATE OR DELETE ON public.sales_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sales_note_immutability();

CREATE OR REPLACE FUNCTION public.guard_sales_note_lines_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.invoice_status;
BEGIN
  SELECT status INTO v_status FROM public.sales_notes
  WHERE id = COALESCE(NEW.note_id, OLD.note_id);
  IF v_status IN ('issued', 'cancelled')
     OR (TG_OP = 'UPDATE' AND NEW.note_id <> OLD.note_id
         AND (SELECT status FROM public.sales_notes WHERE id = OLD.note_id) <> 'draft') THEN
    RAISE EXCEPTION 'Note Violation: Lines of an issued or cancelled note cannot be modified';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sales_note_lines ON public.sales_note_lines;
CREATE TRIGGER trg_guard_sales_note_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.sales_note_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sales_note_lines_immutability();

CREATE OR REPLACE FUNCTION public.issue_sales_note(p_org_id uuid, p_note_id uuid)
RETURNS public.sales_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note public.sales_notes;
  v_inv public.sales_invoices;
  v_line record;
  v_type text;
  v_taxable numeric(15, 2) := 0.00;
  v_cgst numeric(15, 2) := 0.00;
  v_sgst numeric(15, 2) := 0.00;
  v_igst numeric(15, 2) := 0.00;
  v_cess numeric(15, 2) := 0.00;
  v_tax numeric(15, 2);
  v_total numeric(15, 2);
  v_count integer := 0;
  v_prior record;
  v_fiscal_id uuid;
  v_ar uuid;
  v_sales uuid;
  v_cgst_acc uuid;
  v_sgst_acc uuid;
  v_igst_acc uuid;
  v_journal_id uuid;
  v_credit boolean;
  v_label text;
  v_n integer := 0;
  v_l record;
BEGIN
  -- Same roles as issue_sales_invoice.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot issue notes';
  END IF;

  SELECT * INTO v_note FROM public.sales_notes
  WHERE id = p_note_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found';
  END IF;
  IF v_note.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft notes can be issued (Status: %)', v_note.status;
  END IF;

  -- Locking the invoice serialises concurrent notes against it, so the cumulative cap holds.
  SELECT * INTO v_inv FROM public.sales_invoices
  WHERE id = v_note.original_invoice_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF v_inv.status <> 'issued' THEN
    RAISE EXCEPTION 'The original invoice % is %; notes need an issued invoice', v_inv.invoice_number, v_inv.status;
  END IF;
  IF v_note.note_date < v_inv.invoice_date THEN
    RAISE EXCEPTION 'Note date % is before the invoice date %', v_note.note_date, v_inv.invoice_date;
  END IF;
  IF v_note.supply_type <> v_inv.supply_type OR v_note.place_of_supply <> v_inv.place_of_supply THEN
    RAISE EXCEPTION 'Tax Rule Violation: the note must keep the invoice''s supply type and place of supply';
  END IF;

  v_type := COALESCE(to_jsonb(v_inv)->>'invoice_type', 'tax_invoice');

  -- Same split rules as the original invoice (issue_sales_invoice, migrations 25 and 32).
  FOR v_line IN
    SELECT * FROM public.sales_note_lines WHERE note_id = p_note_id ORDER BY line_number
  LOOP
    v_count := v_count + 1;
    IF v_type IN ('bill_of_supply', 'export_without_payment', 'sez_without_payment') OR v_inv.supply_type = 'exempt'
       OR (v_inv.supply_type = 'export' AND v_type <> 'export_with_payment') THEN
      IF v_line.cgst_amount <> 0 OR v_line.sgst_amount <> 0 OR v_line.igst_amount <> 0 OR v_line.cess_amount <> 0 THEN
        RAISE EXCEPTION 'Tax Rule Violation: line % cannot carry tax on a % invoice', v_line.line_number, v_type;
      END IF;
    ELSIF v_inv.supply_type = 'intra_state' THEN
      IF v_line.igst_amount <> 0.00 OR v_line.igst_rate <> 0.00 THEN
        RAISE EXCEPTION 'Tax Rule Violation: Intra-state line % cannot have IGST', v_line.line_number;
      END IF;
      IF ABS(v_line.cgst_amount - v_line.sgst_amount) > 0.02 THEN
        RAISE EXCEPTION 'Tax Rule Violation: CGST and SGST amounts must be equal for line %', v_line.line_number;
      END IF;
    ELSE -- inter_state, and exports with payment
      IF v_line.cgst_amount <> 0.00 OR v_line.sgst_amount <> 0.00 THEN
        RAISE EXCEPTION 'Tax Rule Violation: Inter-state line % cannot have CGST or SGST', v_line.line_number;
      END IF;
    END IF;

    v_taxable := v_taxable + v_line.taxable_amount;
    v_cgst := v_cgst + v_line.cgst_amount;
    v_sgst := v_sgst + v_line.sgst_amount;
    v_igst := v_igst + v_line.igst_amount;
    v_cess := v_cess + v_line.cess_amount;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Note must have at least one line item';
  END IF;
  v_tax := v_cgst + v_sgst + v_igst + v_cess;
  v_total := v_taxable + v_tax;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Note must have a value';
  END IF;
  IF v_cess <> 0 THEN
    -- Invoice issuance posts no cess ledger either, so there is nothing to reverse it against.
    RAISE EXCEPTION 'Notes with cess are not supported yet';
  END IF;

  v_credit := v_note.note_type = 'credit';
  IF v_credit THEN
    SELECT COALESCE(sum(taxable_amount), 0) AS taxable, COALESCE(sum(cgst_amount), 0) AS cgst,
           COALESCE(sum(sgst_amount), 0) AS sgst, COALESCE(sum(igst_amount), 0) AS igst,
           COALESCE(sum(cess_amount), 0) AS cess
    INTO v_prior
    FROM public.sales_notes
    WHERE organisation_id = p_org_id AND original_invoice_id = v_inv.id
      AND note_type = 'credit' AND status = 'issued' AND id <> p_note_id;
    IF v_prior.taxable + v_taxable > v_inv.taxable_amount THEN
      RAISE EXCEPTION 'Credit notes against % would exceed its taxable value (% already credited of %)',
        v_inv.invoice_number, v_prior.taxable, v_inv.taxable_amount;
    END IF;
    IF v_prior.cgst + v_cgst > v_inv.cgst_amount OR v_prior.sgst + v_sgst > v_inv.sgst_amount
       OR v_prior.igst + v_igst > v_inv.igst_amount OR v_prior.cess + v_cess > v_inv.cess_amount THEN
      RAISE EXCEPTION 'Credit notes against % would exceed the tax charged on it', v_inv.invoice_number;
    END IF;
  END IF;

  SELECT id INTO v_fiscal_id FROM public.fiscal_periods
  WHERE organisation_id = p_org_id AND status = 'open'
    AND v_note.note_date BETWEEN start_date AND end_date
  LIMIT 1;
  IF v_fiscal_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal period covers the note date %', v_note.note_date;
  END IF;

  SELECT id INTO v_ar FROM public.accounts WHERE organisation_id = p_org_id AND code = '1030' LIMIT 1;
  SELECT id INTO v_sales FROM public.accounts WHERE organisation_id = p_org_id AND code = '4010' LIMIT 1;
  SELECT id INTO v_cgst_acc FROM public.accounts WHERE organisation_id = p_org_id AND code = '2081' LIMIT 1;
  SELECT id INTO v_sgst_acc FROM public.accounts WHERE organisation_id = p_org_id AND code = '2082' LIMIT 1;
  SELECT id INTO v_igst_acc FROM public.accounts WHERE organisation_id = p_org_id AND code = '2083' LIMIT 1;
  IF v_ar IS NULL OR v_sales IS NULL
     OR (v_cgst > 0 AND v_cgst_acc IS NULL) OR (v_sgst > 0 AND v_sgst_acc IS NULL) OR (v_igst > 0 AND v_igst_acc IS NULL) THEN
    RAISE EXCEPTION 'The chart of accounts is missing a ledger the note posts to (1030, 4010, 2081, 2082 or 2083)';
  END IF;

  v_label := CASE WHEN v_credit THEN 'Credit Note ' ELSE 'Debit Note ' END || v_note.note_number;
  INSERT INTO public.journal_entries (
    organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reference, created_by
  )
  VALUES (
    p_org_id, v_fiscal_id, 'JRN-' || CASE WHEN v_credit THEN 'CN-' ELSE 'DN-' END || v_note.note_number,
    v_note.note_date, 'draft', v_label || ' against ' || v_inv.invoice_number, v_note.note_number, auth.uid()
  )
  RETURNING id INTO v_journal_id;

  -- Credit note: Dr Sales, Dr Output GST, Cr Debtor. Debit note: the reverse.
  FOR v_l IN
    SELECT * FROM (VALUES
      (v_sales, NULL::uuid, 'Sales ' || v_label, v_taxable),
      (v_cgst_acc, NULL::uuid, 'Output CGST ' || v_label, v_cgst),
      (v_sgst_acc, NULL::uuid, 'Output SGST ' || v_label, v_sgst),
      (v_igst_acc, NULL::uuid, 'Output IGST ' || v_label, v_igst),
      (v_ar, v_note.customer_id, v_label, -v_total)
    ) AS x(account_id, party_id, description, amount)
    WHERE amount <> 0
  LOOP
    v_n := v_n + 1;
    INSERT INTO public.journal_entry_lines (
      organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
    )
    VALUES (
      p_org_id, v_journal_id, v_n, v_l.account_id, v_l.party_id, v_l.description,
      CASE WHEN (v_l.amount > 0) = v_credit THEN abs(v_l.amount) ELSE 0.00 END,
      CASE WHEN (v_l.amount > 0) = v_credit THEN 0.00 ELSE abs(v_l.amount) END
    );
  END LOOP;

  PERFORM public.post_journal_entry(p_org_id, v_journal_id);

  UPDATE public.sales_notes
  SET taxable_amount = v_taxable,
      cgst_amount = v_cgst,
      sgst_amount = v_sgst,
      igst_amount = v_igst,
      cess_amount = v_cess,
      total_tax = v_tax,
      total_amount = v_total,
      status = 'issued',
      journal_entry_id = v_journal_id,
      issued_at = now(),
      issued_by = auth.uid()
  WHERE id = p_note_id
  RETURNING * INTO v_note;

  RETURN v_note;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_sales_note(p_org_id uuid, p_note_id uuid, p_reason text)
RETURNS public.sales_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note public.sales_notes;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot cancel notes';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to cancel a note';
  END IF;

  SELECT * INTO v_note FROM public.sales_notes
  WHERE id = p_note_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found';
  END IF;
  IF v_note.status <> 'issued' THEN
    RAISE EXCEPTION 'Only issued notes can be cancelled (Current status: %)', v_note.status;
  END IF;

  IF v_note.journal_entry_id IS NOT NULL THEN
    PERFORM public.reverse_journal_entry(
      p_org_id, v_note.journal_entry_id, CURRENT_DATE,
      'Reversal due to cancellation of note ' || v_note.note_number || ': ' || p_reason
    );
  END IF;

  UPDATE public.sales_notes
  SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = btrim(p_reason)
  WHERE id = p_note_id
  RETURNING * INTO v_note;
  RETURN v_note;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.sales_notes_copy_from_invoice(),
  public.guard_sales_note_immutability(),
  public.guard_sales_note_lines_immutability(),
  public.issue_sales_note(uuid, uuid),
  public.cancel_sales_note(uuid, uuid, text)
FROM PUBLIC, anon;

ALTER TABLE public.sales_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_note_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_notes_select" ON public.sales_notes;
CREATE POLICY "sales_notes_select"
  ON public.sales_notes FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "sales_notes_insert_draft" ON public.sales_notes;
CREATE POLICY "sales_notes_insert_draft"
  ON public.sales_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
  );

-- Unlike the invoice policy, WITH CHECK keeps status = 'draft': only issue_sales_note issues.
DROP POLICY IF EXISTS "sales_notes_update_draft" ON public.sales_notes;
CREATE POLICY "sales_notes_update_draft"
  ON public.sales_notes FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
  );

DROP POLICY IF EXISTS "sales_notes_delete_draft" ON public.sales_notes;
CREATE POLICY "sales_notes_delete_draft"
  ON public.sales_notes FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
    AND status = 'draft'
  );

DROP POLICY IF EXISTS "sales_note_lines_select" ON public.sales_note_lines;
CREATE POLICY "sales_note_lines_select"
  ON public.sales_note_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "sales_note_lines_insert" ON public.sales_note_lines;
CREATE POLICY "sales_note_lines_insert"
  ON public.sales_note_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

DROP POLICY IF EXISTS "sales_note_lines_update" ON public.sales_note_lines;
CREATE POLICY "sales_note_lines_update"
  ON public.sales_note_lines FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

DROP POLICY IF EXISTS "sales_note_lines_delete" ON public.sales_note_lines;
CREATE POLICY "sales_note_lines_delete"
  ON public.sales_note_lines FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.issue_sales_note(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.cancel_sales_note(uuid, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute the sales note functions';
  END IF;
END $$;
