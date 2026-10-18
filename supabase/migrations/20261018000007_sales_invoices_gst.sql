-- Migration 7: Sales Invoices and GST
-- Deku Finance - GST Sales Invoicing & Accounting Integration

-- 1. Enums for Invoicing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM (
      'draft',
      'issued',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supply_type') THEN
    CREATE TYPE public.supply_type AS ENUM (
      'intra_state',
      'inter_state',
      'export',
      'exempt'
    );
  END IF;
END $$;

-- 2. Sales Invoices Header Table
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  supply_type public.supply_type NOT NULL DEFAULT 'intra_state',
  place_of_supply text NOT NULL,
  seller_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  taxable_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (taxable_amount >= 0),
  cgst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
  sgst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
  igst_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
  cess_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (cess_amount >= 0),
  total_tax numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_tax >= 0),
  discount_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  round_off numeric(15, 2) NOT NULL DEFAULT 0.00,
  total_amount numeric(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  journal_entry_id uuid,
  notes text,
  terms text,
  issued_at timestamptz,
  issued_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancellation_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT uk_sales_invoices_org_num UNIQUE (organisation_id, invoice_number),
  CONSTRAINT uk_sales_invoices_org_id UNIQUE (organisation_id, id),
  CONSTRAINT chk_sales_invoice_dates CHECK (invoice_date <= due_date),
  CONSTRAINT fk_sales_invoices_customer FOREIGN KEY (organisation_id, customer_id)
    REFERENCES public.parties(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_sales_invoices_journal FOREIGN KEY (organisation_id, journal_entry_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_org_date ON public.sales_invoices(organisation_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_org_status ON public.sales_invoices(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON public.sales_invoices(organisation_id, customer_id);

CREATE TRIGGER trg_sales_invoices_updated_at
  BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Sales Invoice Lines Table
CREATE TABLE IF NOT EXISTS public.sales_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
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
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_sales_invoice_lines_org_id UNIQUE (organisation_id, id),
  CONSTRAINT uk_sales_invoice_lines_inv_line UNIQUE (invoice_id, line_number),
  CONSTRAINT fk_sales_lines_invoice FOREIGN KEY (organisation_id, invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_sales_lines_item FOREIGN KEY (organisation_id, item_id)
    REFERENCES public.catalogue_items(organisation_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_org ON public.sales_invoice_lines(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_inv ON public.sales_invoice_lines(invoice_id);

-- 4. Guard Trigger: Prevent Modifying Issued or Cancelled Invoices
CREATE OR REPLACE FUNCTION public.guard_invoice_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Allow status transition from draft -> issued or issued -> cancelled via controlled functions
    IF OLD.status IN ('issued', 'cancelled') AND NEW.status = OLD.status THEN
      RAISE EXCEPTION 'Invoice Violation: Issued or cancelled invoices are immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('issued', 'cancelled') THEN
      RAISE EXCEPTION 'Invoice Violation: Issued or cancelled invoices cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sales_invoices ON public.sales_invoices;
CREATE TRIGGER trg_guard_sales_invoices
  BEFORE UPDATE OR DELETE ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_invoice_immutability();

CREATE OR REPLACE FUNCTION public.guard_invoice_lines_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_status public.invoice_status;
BEGIN
  SELECT status INTO v_inv_status
  FROM public.sales_invoices
  WHERE id = COALESCE(OLD.invoice_id, NEW.invoice_id);

  IF v_inv_status IN ('issued', 'cancelled') THEN
    RAISE EXCEPTION 'Invoice Violation: Lines of an issued or cancelled invoice cannot be modified';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sales_invoice_lines ON public.sales_invoice_lines;
CREATE TRIGGER trg_guard_sales_invoice_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.sales_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_invoice_lines_immutability();

-- 5. Controlled Invoice Issuance Function (Validation & Optional Automatic Journal Sync)
CREATE OR REPLACE FUNCTION public.issue_sales_invoice(
  p_org_id uuid,
  p_invoice_id uuid,
  p_create_journal boolean DEFAULT false
)
RETURNS public.sales_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.sales_invoices;
  v_org public.organisations;
  v_line record;
  v_sum_taxable numeric(15, 2) := 0.00;
  v_sum_cgst numeric(15, 2) := 0.00;
  v_sum_sgst numeric(15, 2) := 0.00;
  v_sum_igst numeric(15, 2) := 0.00;
  v_sum_cess numeric(15, 2) := 0.00;
  v_sum_total numeric(15, 2) := 0.00;
  v_line_count integer := 0;
  v_journal_id uuid := NULL;
  v_fiscal_id uuid := NULL;
  v_ar_account_id uuid;
  v_sales_account_id uuid;
  v_cgst_account_id uuid;
  v_sgst_account_id uuid;
  v_igst_account_id uuid;
  v_line_num integer := 1;
BEGIN
  -- Permission check
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot issue invoices';
  END IF;

  SELECT * INTO v_inv
  FROM public.sales_invoices
  WHERE id = p_invoice_id AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued (Status: %)', v_inv.status;
  END IF;

  SELECT * INTO v_org
  FROM public.organisations
  WHERE id = p_org_id;

  -- Validate all lines & tax splits
  FOR v_line IN
    SELECT *
    FROM public.sales_invoice_lines
    WHERE invoice_id = p_invoice_id
    ORDER BY line_number
  LOOP
    v_line_count := v_line_count + 1;

    -- Verify intra-state vs inter-state tax splits
    IF v_inv.supply_type = 'intra_state' THEN
      IF v_line.igst_amount <> 0.00 OR v_line.igst_rate <> 0.00 THEN
        RAISE EXCEPTION 'Tax Rule Violation: Intra-state line % cannot have IGST', v_line.line_number;
      END IF;
      IF ABS(v_line.cgst_amount - v_line.sgst_amount) > 0.02 THEN
        RAISE EXCEPTION 'Tax Rule Violation: CGST and SGST amounts must be equal for line %', v_line.line_number;
      END IF;
    ELSIF v_inv.supply_type = 'inter_state' THEN
      IF v_line.cgst_amount <> 0.00 OR v_line.sgst_amount <> 0.00 THEN
        RAISE EXCEPTION 'Tax Rule Violation: Inter-state line % cannot have CGST or SGST', v_line.line_number;
      END IF;
    ELSIF v_inv.supply_type IN ('export', 'exempt') THEN
      IF v_line.cgst_amount <> 0.00 OR v_line.sgst_amount <> 0.00 OR v_line.igst_amount <> 0.00 THEN
        RAISE EXCEPTION 'Tax Rule Violation: Exempt/Export line % cannot have tax', v_line.line_number;
      END IF;
    END IF;

    v_sum_taxable := v_sum_taxable + v_line.taxable_amount;
    v_sum_cgst := v_sum_cgst + v_line.cgst_amount;
    v_sum_sgst := v_sum_sgst + v_line.sgst_amount;
    v_sum_igst := v_sum_igst + v_line.igst_amount;
    v_sum_cess := v_sum_cess + v_line.cess_amount;
    v_sum_total := v_sum_total + v_line.total_amount;
  END LOOP;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one line item';
  END IF;

  -- Synchronize header totals
  UPDATE public.sales_invoices
  SET
    taxable_amount = v_sum_taxable,
    cgst_amount = v_sum_cgst,
    sgst_amount = v_sum_sgst,
    igst_amount = v_sum_igst,
    cess_amount = v_sum_cess,
    total_tax = v_sum_cgst + v_sum_sgst + v_sum_igst + v_sum_cess,
    total_amount = v_sum_taxable + (v_sum_cgst + v_sum_sgst + v_sum_igst + v_sum_cess) - discount_amount + round_off,
    status = 'issued',
    issued_at = now(),
    issued_by = auth.uid(),
    updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  -- Optional: Automatically generate and post accounting journal entry
  IF p_create_journal THEN
    -- Find open fiscal period
    SELECT id INTO v_fiscal_id
    FROM public.fiscal_periods
    WHERE organisation_id = p_org_id
      AND status = 'open'
      AND v_inv.invoice_date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_fiscal_id IS NOT NULL THEN
      -- Resolve standard accounts (default chart of accounts)
      SELECT id INTO v_ar_account_id FROM public.accounts WHERE organisation_id = p_org_id AND code = '1030' LIMIT 1;
      SELECT id INTO v_sales_account_id FROM public.accounts WHERE organisation_id = p_org_id AND code = '4010' LIMIT 1;
      SELECT id INTO v_cgst_account_id FROM public.accounts WHERE organisation_id = p_org_id AND code = '2081' LIMIT 1;
      SELECT id INTO v_sgst_account_id FROM public.accounts WHERE organisation_id = p_org_id AND code = '2082' LIMIT 1;
      SELECT id INTO v_igst_account_id FROM public.accounts WHERE organisation_id = p_org_id AND code = '2083' LIMIT 1;

      IF v_ar_account_id IS NOT NULL AND v_sales_account_id IS NOT NULL THEN
        -- Create Journal Header
        INSERT INTO public.journal_entries (
          organisation_id,
          fiscal_period_id,
          entry_number,
          entry_date,
          status,
          narration,
          reference,
          created_by
        )
        VALUES (
          p_org_id,
          v_fiscal_id,
          'JRN-' || v_inv.invoice_number,
          v_inv.invoice_date,
          'draft',
          'Sales Invoice ' || v_inv.invoice_number,
          v_inv.invoice_number,
          auth.uid()
        )
        RETURNING id INTO v_journal_id;

        -- 1. Debit Accounts Receivable (Customer)
        INSERT INTO public.journal_entry_lines (
          organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
        )
        VALUES (
          p_org_id, v_journal_id, v_line_num, v_ar_account_id, v_inv.customer_id,
          'Sales Invoice ' || v_inv.invoice_number, v_inv.total_amount, 0.00
        );
        v_line_num := v_line_num + 1;

        -- 2. Credit Sales Revenue
        INSERT INTO public.journal_entry_lines (
          organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
        )
        VALUES (
          p_org_id, v_journal_id, v_line_num, v_sales_account_id, NULL,
          'Taxable Revenue ' || v_inv.invoice_number, 0.00, v_inv.taxable_amount
        );
        v_line_num := v_line_num + 1;

        -- 3. Credit Output CGST if applicable
        IF v_inv.cgst_amount > 0 AND v_cgst_account_id IS NOT NULL THEN
          INSERT INTO public.journal_entry_lines (
            organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
          )
          VALUES (
            p_org_id, v_journal_id, v_line_num, v_cgst_account_id, NULL,
            'Output CGST ' || v_inv.invoice_number, 0.00, v_inv.cgst_amount
          );
          v_line_num := v_line_num + 1;
        END IF;

        -- 4. Credit Output SGST if applicable
        IF v_inv.sgst_amount > 0 AND v_sgst_account_id IS NOT NULL THEN
          INSERT INTO public.journal_entry_lines (
            organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
          )
          VALUES (
            p_org_id, v_journal_id, v_line_num, v_sgst_account_id, NULL,
            'Output SGST ' || v_inv.invoice_number, 0.00, v_inv.sgst_amount
          );
          v_line_num := v_line_num + 1;
        END IF;

        -- 5. Credit Output IGST if applicable
        IF v_inv.igst_amount > 0 AND v_igst_account_id IS NOT NULL THEN
          INSERT INTO public.journal_entry_lines (
            organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
          )
          VALUES (
            p_org_id, v_journal_id, v_line_num, v_igst_account_id, NULL,
            'Output IGST ' || v_inv.invoice_number, 0.00, v_inv.igst_amount
          );
          v_line_num := v_line_num + 1;
        END IF;

        -- Post Journal Entry
        PERFORM public.post_journal_entry(p_org_id, v_journal_id);

        -- Link Journal to Invoice
        UPDATE public.sales_invoices
        SET journal_entry_id = v_journal_id
        WHERE id = p_invoice_id;

        v_inv.journal_entry_id := v_journal_id;
      END IF;
    END IF;
  END IF;

  RETURN v_inv;
END;
$$;

-- 6. Controlled Invoice Cancellation Function
CREATE OR REPLACE FUNCTION public.cancel_sales_invoice(
  p_org_id uuid,
  p_invoice_id uuid,
  p_reason text
)
RETURNS public.sales_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.sales_invoices;
BEGIN
  -- Permission check
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: Cannot cancel invoices';
  END IF;

  SELECT * INTO v_inv
  FROM public.sales_invoices
  WHERE id = p_invoice_id AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.status <> 'issued' THEN
    RAISE EXCEPTION 'Only issued invoices can be cancelled (Current status: %)', v_inv.status;
  END IF;

  -- If there is a linked journal entry, reverse it
  IF v_inv.journal_entry_id IS NOT NULL THEN
    PERFORM public.reverse_journal_entry(
      p_org_id,
      v_inv.journal_entry_id,
      CURRENT_DATE,
      'Reversal due to cancellation of Invoice ' || v_inv.invoice_number || ': ' || p_reason
    );
  END IF;

  UPDATE public.sales_invoices
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = p_reason,
    updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;

-- 7. Row Level Security Policies
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;

-- Sales Invoices RLS
CREATE POLICY "sales_invoices_select"
  ON public.sales_invoices FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "sales_invoices_insert_draft"
  ON public.sales_invoices FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
  );

CREATE POLICY "sales_invoices_update_draft"
  ON public.sales_invoices FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "sales_invoices_delete_draft"
  ON public.sales_invoices FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
    AND status = 'draft'
  );

-- Sales Invoice Lines RLS
CREATE POLICY "sales_lines_select"
  ON public.sales_invoice_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "sales_lines_insert"
  ON public.sales_invoice_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "sales_lines_update"
  ON public.sales_invoice_lines FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );

CREATE POLICY "sales_lines_delete"
  ON public.sales_invoice_lines FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
  );
