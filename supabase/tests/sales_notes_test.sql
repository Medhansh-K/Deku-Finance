-- Migrations 31 and 32: credit/debit notes (cap, tax split, journal, immutability, RLS) and
-- invoice-type rules on issue_sales_invoice. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('31000000-0000-4000-8000-000000000001', 'notes-owner@test.local'),
  ('31000000-0000-4000-8000-000000000002', 'notes-viewer@test.local'),
  ('31000000-0000-4000-8000-000000000003', 'notes-outsider@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('31a00000-0000-4000-8000-000000000001', 'Notes Test', 'notes-test', '31000000-0000-4000-8000-000000000001'),
  ('31a00000-0000-4000-8000-000000000002', 'Notes Other', 'notes-other', '31000000-0000-4000-8000-000000000003');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('31a00000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'owner'),
  ('31a00000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 'viewer'),
  ('31a00000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003', 'owner')
ON CONFLICT (organisation_id, user_id) DO NOTHING;
SELECT public.seed_default_chart_of_accounts('31a00000-0000-4000-8000-000000000001');
INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status)
VALUES ('31a00000-0000-4000-8000-000000000001', 'FY 2026-27', '2026-04-01', '2027-03-31', 'open');
INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name, gstin) VALUES
  ('31c00000-0000-4000-8000-000000000001', '31a00000-0000-4000-8000-000000000001', 'customer', 'Buyer Pvt Ltd', 'Buyer', '29AABCT1332L1ZA');

-- Intra-state invoice: 1000 taxable, CGST 90, SGST 90, issued with its journal.
INSERT INTO public.sales_invoices (id, organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply)
VALUES ('31b00000-0000-4000-8000-000000000001', '31a00000-0000-4000-8000-000000000001', '31c00000-0000-4000-8000-000000000001',
        'INV-N-1', '2026-10-05', '2026-10-20', 'intra_state', '27-Maharashtra');
INSERT INTO public.sales_invoice_lines (organisation_id, invoice_id, line_number, item_name, quantity, unit_price, taxable_amount,
  gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount)
VALUES ('31a00000-0000-4000-8000-000000000001', '31b00000-0000-4000-8000-000000000001', 1, 'Widget', 10, 100, 1000, 18, 9, 90, 9, 90, 1180);
SELECT public.issue_sales_invoice('31a00000-0000-4000-8000-000000000001', '31b00000-0000-4000-8000-000000000001', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Note: client-sent supply type and place of supply are replaced by the invoice's.
INSERT INTO public.sales_notes (id, organisation_id, note_type, original_invoice_id, customer_id, note_number, note_date,
  reason_code, supply_type, place_of_supply)
VALUES ('31d00000-0000-4000-8000-000000000001', '31a00000-0000-4000-8000-000000000001', 'credit', '31b00000-0000-4000-8000-000000000001',
        '31c00000-0000-4000-8000-000000000001', 'CN-1', '2026-10-25', 'sales_return', 'inter_state', '07-Delhi');
INSERT INTO public.sales_note_lines (organisation_id, note_id, line_number, item_name, quantity, unit_price, taxable_amount,
  gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount)
VALUES ('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000001', 1, 'Widget', 6, 100, 600, 18, 9, 54, 9, 54, 708);

DO $$
DECLARE
  n public.sales_notes;
  j record;
BEGIN
  SELECT * INTO n FROM public.sales_notes WHERE id = '31d00000-0000-4000-8000-000000000001';
  ASSERT n.supply_type = 'intra_state' AND n.place_of_supply = '27-Maharashtra', 'supply not copied from the invoice';

  n := public.issue_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000001');
  ASSERT n.status = 'issued' AND n.total_amount = 708 AND n.cgst_amount = 54 AND n.journal_entry_id IS NOT NULL, format('bad issued note %s', row_to_json(n));

  -- Credit note journal: Dr Sales 600, Dr CGST 54, Dr SGST 54, Cr Debtor 708, posted and balanced.
  SELECT je.status, sum(l.debit) AS dr, sum(l.credit) AS cr,
         sum(l.debit) FILTER (WHERE a.code = '4010') AS sales_dr,
         sum(l.debit) FILTER (WHERE a.code IN ('2081', '2082')) AS gst_dr,
         sum(l.credit) FILTER (WHERE a.code = '1030' AND l.party_id = n.customer_id) AS ar_cr
  INTO j
  FROM public.journal_entries je
  JOIN public.journal_entry_lines l ON l.journal_entry_id = je.id
  JOIN public.accounts a ON a.id = l.account_id
  WHERE je.id = n.journal_entry_id
  GROUP BY je.status;
  ASSERT j.status = 'posted' AND j.dr = 708 AND j.cr = 708 AND j.sales_dr = 600 AND j.gst_dr = 108 AND j.ar_cr = 708,
    format('credit note journal wrong: %s', row_to_json(j));
END $$;

-- Over-crediting: 600 already credited, 500 more exceeds the 1000 taxable value.
INSERT INTO public.sales_notes (id, organisation_id, note_type, original_invoice_id, customer_id, note_number, note_date,
  reason_code, supply_type, place_of_supply)
VALUES ('31d00000-0000-4000-8000-000000000002', '31a00000-0000-4000-8000-000000000001', 'credit', '31b00000-0000-4000-8000-000000000001',
        '31c00000-0000-4000-8000-000000000001', 'CN-2', '2026-10-26', 'post_sale_discount', 'intra_state', '27');
INSERT INTO public.sales_note_lines (organisation_id, note_id, line_number, item_name, quantity, unit_price, taxable_amount,
  gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount)
VALUES ('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000002', 1, 'Widget', 5, 100, 500, 18, 9, 45, 9, 45, 590);
DO $$
BEGIN
  PERFORM public.issue_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'over-credit was issued';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'Credit notes against INV-N-1 would exceed its taxable value%' THEN RAISE; END IF;
END $$;

-- Tax over-credit with taxable value inside the cap: 300 taxable but 50 + 50 tax (36 + 36 left).
UPDATE public.sales_note_lines SET taxable_amount = 300, cgst_amount = 50, sgst_amount = 50, total_amount = 400
WHERE note_id = '31d00000-0000-4000-8000-000000000002';
DO $$
BEGIN
  PERFORM public.issue_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'tax over-credit was issued';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%would exceed the tax charged on it' THEN RAISE; END IF;
END $$;

-- Tax split follows the original: IGST on an intra-state invoice's note is rejected.
UPDATE public.sales_note_lines SET taxable_amount = 100, cgst_amount = 0, sgst_amount = 0, cgst_rate = 0, sgst_rate = 0,
  igst_rate = 18, igst_amount = 18, total_amount = 118
WHERE note_id = '31d00000-0000-4000-8000-000000000002';
DO $$
BEGIN
  PERFORM public.issue_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'IGST note on an intra-state invoice was issued';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Intra-state line 1 cannot have IGST%' THEN RAISE; END IF;
END $$;

-- A note dated before its invoice is rejected.
UPDATE public.sales_note_lines SET cgst_rate = 9, sgst_rate = 9, cgst_amount = 9, sgst_amount = 9, igst_rate = 0, igst_amount = 0
WHERE note_id = '31d00000-0000-4000-8000-000000000002';
UPDATE public.sales_notes SET note_date = '2026-10-01' WHERE id = '31d00000-0000-4000-8000-000000000002';
DO $$
BEGIN
  PERFORM public.issue_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'note dated before its invoice was issued';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'Note date 2026-10-01 is before the invoice date 2026-10-05' THEN RAISE; END IF;
END $$;

-- Only issue_sales_note issues: a direct status change on a draft fails RLS.
DO $$
BEGIN
  UPDATE public.sales_notes SET status = 'issued' WHERE id = '31d00000-0000-4000-8000-000000000002';
  RAISE EXCEPTION 'draft note was issued by a plain UPDATE';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Debit note: the journal runs the other way (Dr Debtor 118, Cr Sales 100, Cr CGST/SGST 18).
UPDATE public.sales_notes SET note_type = 'debit', note_number = 'DN-1', note_date = '2026-10-27', reason_code = 'correction_in_invoice'
WHERE id = '31d00000-0000-4000-8000-000000000002';
DO $$
DECLARE
  n public.sales_notes;
  j record;
BEGIN
  n := public.issue_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000002');
  SELECT sum(l.debit) FILTER (WHERE a.code = '1030') AS ar_dr, sum(l.credit) FILTER (WHERE a.code = '4010') AS sales_cr,
         sum(l.credit) FILTER (WHERE a.code IN ('2081', '2082')) AS gst_cr, sum(l.debit) AS dr, sum(l.credit) AS cr
  INTO j
  FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
  WHERE l.journal_entry_id = n.journal_entry_id;
  ASSERT j.ar_dr = 118 AND j.sales_cr = 100 AND j.gst_cr = 18 AND j.dr = j.cr, format('debit note journal wrong: %s', row_to_json(j));
END $$;

-- Immutability: an issued note, and its lines, don't change and can't be deleted.
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.sales_notes SET reason = 'edited' WHERE id = '31d00000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'issued note was edited';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Note Violation: Issued or cancelled notes are immutable' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.sales_notes SET status = 'cancelled', taxable_amount = 1 WHERE id = '31d00000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'cancelling changed the amounts';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Note Violation:%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.sales_notes WHERE id = '31d00000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'issued note was deleted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Note Violation: Issued or cancelled notes cannot be deleted' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.sales_note_lines SET quantity = 1 WHERE note_id = '31d00000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'issued note line was edited';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Note Violation: Lines%' THEN RAISE; END IF;
  END;
END $$;

-- Cancelling reverses the journal and frees the cap: a 900 credit note then fits.
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  n public.sales_notes;
BEGIN
  n := public.cancel_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000001', 'raised in error');
  ASSERT n.status = 'cancelled', 'note not cancelled';
  ASSERT (SELECT status FROM public.journal_entries WHERE id = n.journal_entry_id) = 'reversed', 'note journal not reversed';
END $$;
-- As the API sends it: customer, supply type and place of supply left to the trigger.
INSERT INTO public.sales_notes (id, organisation_id, note_type, original_invoice_id, note_number, note_date, reason_code)
VALUES ('31d00000-0000-4000-8000-000000000003', '31a00000-0000-4000-8000-000000000001', 'credit', '31b00000-0000-4000-8000-000000000001',
        'CN-3', '2026-10-28', 'sales_return');
INSERT INTO public.sales_note_lines (organisation_id, note_id, line_number, item_name, quantity, unit_price, taxable_amount,
  gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount)
VALUES ('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000003', 1, 'Widget', 9, 100, 900, 18, 9, 81, 9, 81, 1062);
SELECT public.issue_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000003');

-- RLS: a viewer can read but not write or issue; an outsider sees nothing and can't borrow the invoice.
SELECT set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.sales_notes) = 3, 'viewer cannot read notes';
  BEGIN
    INSERT INTO public.sales_notes (organisation_id, note_type, original_invoice_id, customer_id, note_number, note_date,
      reason_code, supply_type, place_of_supply)
    VALUES ('31a00000-0000-4000-8000-000000000001', 'credit', '31b00000-0000-4000-8000-000000000001',
            '31c00000-0000-4000-8000-000000000001', 'CN-V', '2026-10-28', 'others', 'intra_state', '27');
    RAISE EXCEPTION 'viewer inserted a note';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.cancel_sales_note('31a00000-0000-4000-8000-000000000001', '31d00000-0000-4000-8000-000000000003', 'x');
    RAISE EXCEPTION 'viewer cancelled a note';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.sales_notes) = 0, 'outsider can read notes';
  ASSERT (SELECT count(*) FROM public.sales_note_lines) = 0, 'outsider can read note lines';
  BEGIN
    INSERT INTO public.sales_notes (organisation_id, note_type, original_invoice_id, customer_id, note_number, note_date,
      reason_code, supply_type, place_of_supply)
    VALUES ('31a00000-0000-4000-8000-000000000002', 'credit', '31b00000-0000-4000-8000-000000000001',
            '31c00000-0000-4000-8000-000000000001', 'CN-X', '2026-10-28', 'others', 'intra_state', '27');
    RAISE EXCEPTION 'outsider raised a note on another company''s invoice';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Original invoice not found in this company' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.issue_sales_note(uuid, uuid)', 'EXECUTE'), 'anon can issue notes';
  ASSERT NOT has_function_privilege('anon', 'public.cancel_sales_note(uuid, uuid, text)', 'EXECUTE'), 'anon can cancel notes';
  ASSERT has_function_privilege('authenticated', 'public.issue_sales_note(uuid, uuid)', 'EXECUTE'), 'members cannot issue notes';
END $$;

-- Invoice types (migration 32), issued as the owner.
SELECT set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE
  v_org uuid := '31a00000-0000-4000-8000-000000000001';
  v_cust uuid := '31c00000-0000-4000-8000-000000000001';
  v_inv uuid;
BEGIN
  -- Bill of supply with tax is rejected at issue.
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply, invoice_type)
  VALUES (v_org, v_cust, 'BOS-1', '2026-10-06', '2026-10-06', 'intra_state', '27', 'bill_of_supply') RETURNING id INTO v_inv;
  INSERT INTO public.sales_invoice_lines (organisation_id, invoice_id, line_number, item_name, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount)
  VALUES (v_org, v_inv, 1, 'Item', 100, 18, 9, 9, 118);
  BEGIN
    PERFORM public.issue_sales_invoice(v_org, v_inv, false);
    RAISE EXCEPTION 'taxed bill of supply was issued';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%cannot carry tax on a bill_of_supply invoice' THEN RAISE; END IF;
  END;

  -- Export with payment carries IGST; an export with the default type is refused.
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply,
    invoice_type, shipping_bill_number, shipping_bill_date, port_code)
  VALUES (v_org, v_cust, 'EXP-1', '2026-10-06', '2026-10-06', 'export', '96-Other Country', 'export_with_payment', '1234567', '2026-10-07', 'INNSA1')
  RETURNING id INTO v_inv;
  INSERT INTO public.sales_invoice_lines (organisation_id, invoice_id, line_number, item_name, taxable_amount, gst_rate, igst_rate, igst_amount, total_amount)
  VALUES (v_org, v_inv, 1, 'Item', 1000, 18, 18, 180, 1180);
  PERFORM public.issue_sales_invoice(v_org, v_inv, false);
  ASSERT (SELECT igst_amount FROM public.sales_invoices WHERE id = v_inv) = 180, 'export with payment lost its IGST';

  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply)
  VALUES (v_org, v_cust, 'EXP-2', '2026-10-06', '2026-10-06', 'export', '96') RETURNING id INTO v_inv;
  INSERT INTO public.sales_invoice_lines (organisation_id, invoice_id, line_number, item_name, taxable_amount, gst_rate, total_amount)
  VALUES (v_org, v_inv, 1, 'Item', 1000, 0, 1000);
  BEGIN
    PERFORM public.issue_sales_invoice(v_org, v_inv, false);
    RAISE EXCEPTION 'export issued as a tax invoice';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'An export invoice needs the invoice type%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply, invoice_type)
    VALUES (v_org, v_cust, 'EXP-3', '2026-10-06', '2026-10-06', 'intra_state', '27', 'export_without_payment');
    RAISE EXCEPTION 'export type accepted on an intra-state supply';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply, invoice_type)
    VALUES (v_org, v_cust, 'SEZ-1', '2026-10-06', '2026-10-06', 'intra_state', '27', 'sez_with_payment');
    RAISE EXCEPTION 'SEZ type accepted on an intra-state supply';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply,
      invoice_type, igst_amount)
    VALUES (v_org, v_cust, 'SEZ-2', '2026-10-06', '2026-10-06', 'inter_state', '29', 'sez_without_payment', 10);
    RAISE EXCEPTION 'SEZ without payment accepted with tax';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

ROLLBACK;
