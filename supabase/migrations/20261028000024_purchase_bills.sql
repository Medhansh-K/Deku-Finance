-- Migration 24: Purchase bill register
-- Deku Finance - the supplier's bill as received, with its ITC eligibility.
-- GSTR-3B Table 4 is computed from these rows; the ledger only sees a bill through the
-- purchase voucher whose id is linked in journal_entry_id.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itc_eligibility') THEN
    CREATE TYPE public.itc_eligibility AS ENUM (
      'eligible',
      'blocked_17_5',
      'ineligible_other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  -- Null when the bill came from a bulk upload for a supplier not yet in Parties.
  party_id uuid,
  supplier_name text NOT NULL CHECK (btrim(supplier_name) <> ''),
  supplier_gstin text NOT NULL,
  bill_number text NOT NULL CHECK (btrim(bill_number) <> ''),
  bill_date date NOT NULL,
  -- Two-digit state code (01-38, 97 Other Territory).
  place_of_supply text NOT NULL,
  taxable_amount numeric(15, 2) NOT NULL CHECK (taxable_amount >= 0),
  cgst numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cgst >= 0),
  sgst numeric(15, 2) NOT NULL DEFAULT 0 CHECK (sgst >= 0),
  igst numeric(15, 2) NOT NULL DEFAULT 0 CHECK (igst >= 0),
  cess numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cess >= 0),
  total_amount numeric(15, 2) NOT NULL,
  itc_eligibility public.itc_eligibility NOT NULL,
  blocked_reason text,
  journal_entry_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_purchase_bills_supplier_bill UNIQUE (organisation_id, supplier_gstin, bill_number),
  CONSTRAINT fk_purchase_bills_party FOREIGN KEY (organisation_id, party_id)
    REFERENCES public.parties(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_bills_journal FOREIGN KEY (organisation_id, journal_entry_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_bills_gstin_format
    CHECK (supplier_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  CONSTRAINT chk_purchase_bills_pos
    CHECK (place_of_supply ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$'),
  CONSTRAINT chk_purchase_bills_total
    CHECK (total_amount = taxable_amount + cgst + sgst + igst + cess),
  -- Same split rules as issue_sales_invoice (migration 10): supplier's state = place of supply is
  -- intra-state (CGST = SGST, no IGST), otherwise inter-state (IGST only).
  CONSTRAINT chk_purchase_bills_tax_split CHECK (
    CASE WHEN left(supplier_gstin, 2) = place_of_supply
      THEN igst = 0 AND abs(cgst - sgst) <= 0.02
      ELSE cgst = 0 AND sgst = 0
    END
  ),
  CONSTRAINT chk_purchase_bills_blocked_reason CHECK (
    itc_eligibility = 'eligible' OR (blocked_reason IS NOT NULL AND btrim(blocked_reason) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_org_date
  ON public.purchase_bills(organisation_id, bill_date);

DROP TRIGGER IF EXISTS trg_purchase_bills_updated_at ON public.purchase_bills;
CREATE TRIGGER trg_purchase_bills_updated_at
  BEFORE UPDATE ON public.purchase_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_bills_select"
  ON public.purchase_bills FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "purchase_bills_insert"
  ON public.purchase_bills FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND created_by = auth.uid()
  );

-- Once a voucher is linked the bill is part of the books: correct it by reversing the voucher.
CREATE POLICY "purchase_bills_update"
  ON public.purchase_bills FOR UPDATE TO authenticated
  USING (
    journal_entry_id IS NULL
    AND public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  );

CREATE POLICY "purchase_bills_delete"
  ON public.purchase_bills FOR DELETE TO authenticated
  USING (
    journal_entry_id IS NULL
    AND public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  );

-- No new functions here; migration 18's default privileges already keep anon off any added later.
