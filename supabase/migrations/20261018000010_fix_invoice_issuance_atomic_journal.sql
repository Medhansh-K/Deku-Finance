-- Migration 10: Fix Invoice Issuance Atomic Journal & Immutability Trigger
-- Deku Finance - Fix immutability trigger and atomic journal sync during invoice issuance

-- 1. Update Guard Trigger Function to permit journal linking when invoice is issued
CREATE OR REPLACE FUNCTION public.guard_invoice_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Allow updating journal_entry_id if previously null during invoice issuance
    IF OLD.status = 'issued' AND NEW.status = 'issued' AND OLD.journal_entry_id IS NULL AND NEW.journal_entry_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

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

-- 2. Update issue_sales_invoice to post journal first and update invoice atomically
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
  v_calculated_tax numeric(15, 2) := 0.00;
  v_calculated_total numeric(15, 2) := 0.00;
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
  END LOOP;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one line item';
  END IF;

  v_calculated_tax := v_sum_cgst + v_sum_sgst + v_sum_igst + v_sum_cess;
  v_calculated_total := v_sum_taxable + v_calculated_tax - COALESCE(v_inv.discount_amount, 0.00) + COALESCE(v_inv.round_off, 0.00);

  -- Optional: Automatically generate and post accounting journal entry BEFORE invoice status update
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
          'Sales Invoice ' || v_inv.invoice_number, v_calculated_total, 0.00
        );
        v_line_num := v_line_num + 1;

        -- 2. Credit Sales Revenue
        INSERT INTO public.journal_entry_lines (
          organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
        )
        VALUES (
          p_org_id, v_journal_id, v_line_num, v_sales_account_id, NULL,
          'Taxable Revenue ' || v_inv.invoice_number, 0.00, v_sum_taxable
        );
        v_line_num := v_line_num + 1;

        -- 3. Credit Output CGST if applicable
        IF v_sum_cgst > 0 AND v_cgst_account_id IS NOT NULL THEN
          INSERT INTO public.journal_entry_lines (
            organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
          )
          VALUES (
            p_org_id, v_journal_id, v_line_num, v_cgst_account_id, NULL,
            'Output CGST ' || v_inv.invoice_number, 0.00, v_sum_cgst
          );
          v_line_num := v_line_num + 1;
        END IF;

        -- 4. Credit Output SGST if applicable
        IF v_sum_sgst > 0 AND v_sgst_account_id IS NOT NULL THEN
          INSERT INTO public.journal_entry_lines (
            organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
          )
          VALUES (
            p_org_id, v_journal_id, v_line_num, v_sgst_account_id, NULL,
            'Output SGST ' || v_inv.invoice_number, 0.00, v_sum_sgst
          );
          v_line_num := v_line_num + 1;
        END IF;

        -- 5. Credit Output IGST if applicable
        IF v_sum_igst > 0 AND v_igst_account_id IS NOT NULL THEN
          INSERT INTO public.journal_entry_lines (
            organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit
          )
          VALUES (
            p_org_id, v_journal_id, v_line_num, v_igst_account_id, NULL,
            'Output IGST ' || v_inv.invoice_number, 0.00, v_sum_igst
          );
          v_line_num := v_line_num + 1;
        END IF;

        -- Post Journal Entry
        PERFORM public.post_journal_entry(p_org_id, v_journal_id);
      END IF;
    END IF;
  END IF;

  -- Synchronize header totals, mark issued, and link journal in one single atomic update
  UPDATE public.sales_invoices
  SET
    taxable_amount = v_sum_taxable,
    cgst_amount = v_sum_cgst,
    sgst_amount = v_sum_sgst,
    igst_amount = v_sum_igst,
    cess_amount = v_sum_cess,
    total_tax = v_calculated_tax,
    total_amount = v_calculated_total,
    status = 'issued',
    journal_entry_id = v_journal_id,
    issued_at = now(),
    issued_by = auth.uid(),
    updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;
