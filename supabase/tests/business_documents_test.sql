-- Migration 44: business documents (save, status paths, convert to a draft invoice, immutability, RLS).
-- Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('44000000-0000-4000-8000-000000000001', 'docs-owner@test.local'),
  ('44000000-0000-4000-8000-000000000002', 'docs-viewer@test.local'),
  ('44000000-0000-4000-8000-000000000003', 'docs-outsider@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('44a00000-0000-4000-8000-000000000001', 'Docs Test', 'docs-test', '44000000-0000-4000-8000-000000000001'),
  ('44a00000-0000-4000-8000-000000000002', 'Docs Other', 'docs-other', '44000000-0000-4000-8000-000000000003');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('44a00000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', 'owner'),
  ('44a00000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000002', 'viewer'),
  ('44a00000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000003', 'owner')
ON CONFLICT (organisation_id, user_id) DO NOTHING;
INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name, gstin) VALUES
  ('44c00000-0000-4000-8000-000000000001', '44a00000-0000-4000-8000-000000000001', 'customer', 'Buyer Pvt Ltd', 'Buyer', '27AABCT1332L1ZA');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"44000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Quotation: two intra-state lines, 1000 @18% and 500 @5%, round-off -0.50.
CREATE TEMP TABLE q AS
SELECT * FROM public.save_business_document(
  '44a00000-0000-4000-8000-000000000001',
  '{"doc_type":"quotation","doc_number":"QT-1","doc_date":"2026-10-01","valid_until":"2026-10-31",
    "party_id":"44c00000-0000-4000-8000-000000000001","party_snapshot":{"name":"Buyer Pvt Ltd"},
    "place_of_supply":"27-Maharashtra","supply_type":"intra_state","round_off":-0.50,"terms":"Net 15"}',
  '[{"line_number":1,"item_name":"Widget","hsn_sac_code":"8471","unit_code":"NOS","quantity":10,"unit_price":100,
     "taxable_amount":1000,"gst_rate":18,"cgst_rate":9,"cgst_amount":90,"sgst_rate":9,"sgst_amount":90,"total_amount":1180},
    {"line_number":2,"item_name":"Service","quantity":1,"unit_price":500,
     "taxable_amount":500,"gst_rate":5,"cgst_rate":2.5,"cgst_amount":12.5,"sgst_rate":2.5,"sgst_amount":12.5,"total_amount":525}]'
);

DO $$
DECLARE d record;
BEGIN
  SELECT * INTO d FROM q;
  ASSERT d.status = 'draft' AND d.taxable_amount = 1500 AND d.total_tax = 205 AND d.total_amount = 1704.50
    AND d.created_by = '44000000-0000-4000-8000-000000000001', format('bad saved quotation %s', row_to_json(d));
END $$;

-- Re-saving replaces the lines and recomputes the header.
DO $$
DECLARE d public.business_documents;
BEGIN
  d := public.save_business_document('44a00000-0000-4000-8000-000000000001',
    jsonb_build_object('id', (SELECT id FROM q), 'doc_type', 'quotation', 'doc_number', 'QT-1', 'doc_date', '2026-10-01',
      'party_id', '44c00000-0000-4000-8000-000000000001', 'place_of_supply', '27-Maharashtra', 'supply_type', 'intra_state',
      'round_off', -0.50, 'terms', 'Net 15'),
    '[{"line_number":1,"item_name":"Widget","hsn_sac_code":"8471","unit_code":"NOS","quantity":10,"unit_price":100,
       "taxable_amount":1000,"gst_rate":18,"cgst_rate":9,"cgst_amount":90,"sgst_rate":9,"sgst_amount":90,"total_amount":1180},
      {"line_number":2,"item_name":"Service","quantity":1,"unit_price":500,
       "taxable_amount":500,"gst_rate":5,"cgst_rate":2.5,"cgst_amount":12.5,"sgst_rate":2.5,"sgst_amount":12.5,"total_amount":525}]');
  ASSERT d.total_amount = 1704.50 AND (SELECT count(*) FROM public.business_document_lines WHERE document_id = d.id) = 2,
    'resave did not replace lines';
END $$;

-- IGST on an intra-state document is refused.
DO $$
BEGIN
  PERFORM public.save_business_document('44a00000-0000-4000-8000-000000000001',
    '{"doc_type":"quotation","doc_number":"QT-BAD","doc_date":"2026-10-01","supply_type":"intra_state"}',
    '[{"line_number":1,"item_name":"X","quantity":1,"unit_price":100,"taxable_amount":100,"gst_rate":18,"igst_rate":18,"igst_amount":18,"total_amount":118}]');
  RAISE EXCEPTION 'split check missing';
EXCEPTION WHEN raise_exception THEN
  ASSERT SQLERRM LIKE 'Tax Rule Violation%', SQLERRM;
END $$;

-- 'converted' can't be set by hand.
DO $$
BEGIN
  UPDATE public.business_documents SET status = 'converted' WHERE id = (SELECT id FROM q);
  RAISE EXCEPTION 'manual convert allowed';
EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL;
END $$;

-- Status path: draft -> sent -> accepted; a sent document's content is frozen.
UPDATE public.business_documents SET status = 'sent' WHERE id = (SELECT id FROM q);
DO $$
BEGIN
  UPDATE public.business_documents SET notes = 'changed' WHERE id = (SELECT id FROM q);
  RAISE EXCEPTION 'sent document edited';
EXCEPTION WHEN raise_exception THEN
  ASSERT SQLERRM LIKE 'Document Violation: only draft%', SQLERRM;
END $$;
DO $$
BEGIN
  UPDATE public.business_documents SET status = 'draft' WHERE id = (SELECT id FROM q);
  RAISE EXCEPTION 'sent -> draft allowed';
EXCEPTION WHEN raise_exception THEN NULL;
END $$;
UPDATE public.business_documents SET status = 'accepted' WHERE id = (SELECT id FROM q);

-- A viewer can read but not convert.
SELECT set_config('request.jwt.claims', '{"sub":"44000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.business_documents WHERE id = (SELECT id FROM q)) = 1, 'viewer cannot read';
  PERFORM public.convert_business_document('44a00000-0000-4000-8000-000000000001', (SELECT id FROM q), 'INV-Q-1');
  RAISE EXCEPTION 'viewer converted';
EXCEPTION WHEN raise_exception THEN
  ASSERT SQLERRM LIKE 'Permission denied%', SQLERRM;
END $$;

-- An outsider sees nothing and cannot convert.
SELECT set_config('request.jwt.claims', '{"sub":"44000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.business_documents WHERE organisation_id = '44a00000-0000-4000-8000-000000000001') = 0,
    'outsider sees documents';
  ASSERT (SELECT count(*) FROM public.business_document_lines WHERE organisation_id = '44a00000-0000-4000-8000-000000000001') = 0,
    'outsider sees lines';
  PERFORM public.convert_business_document('44a00000-0000-4000-8000-000000000001', (SELECT id FROM q), 'INV-Q-1');
  RAISE EXCEPTION 'outsider converted';
EXCEPTION WHEN raise_exception THEN
  ASSERT SQLERRM LIKE 'Permission denied%', SQLERRM;
END $$;

-- Owner converts: a draft invoice with the same party, place of supply, lines and totals, linked both ways.
SELECT set_config('request.jwt.claims', '{"sub":"44000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE
  d public.business_documents;
  inv public.sales_invoices;
  diff integer;
BEGIN
  d := public.convert_business_document('44a00000-0000-4000-8000-000000000001', (SELECT id FROM q), 'INV-Q-1');
  ASSERT d.status = 'converted' AND d.converted_to_type = 'sales_invoice' AND d.converted_to_id IS NOT NULL, 'doc not marked';
  SELECT * INTO inv FROM public.sales_invoices WHERE id = d.converted_to_id;
  ASSERT inv.status = 'draft' AND inv.journal_entry_id IS NULL AND inv.source_document_id = d.id
    AND inv.customer_id = d.party_id AND inv.place_of_supply = '27-Maharashtra' AND inv.supply_type = 'intra_state'
    AND inv.invoice_number = 'INV-Q-1' AND inv.taxable_amount = 1500 AND inv.total_tax = 205
    AND inv.round_off = -0.50 AND inv.total_amount = 1704.50 AND inv.terms = 'Net 15',
    format('bad converted invoice %s', row_to_json(inv));
  SELECT count(*) INTO diff FROM (
    (SELECT line_number, item_name, hsn_sac_code, unit_code, quantity, unit_price, taxable_amount, gst_rate,
            cgst_amount, sgst_amount, igst_amount, total_amount
     FROM public.business_document_lines WHERE document_id = d.id
     EXCEPT
     SELECT line_number, item_name, hsn_sac_code, unit_code, quantity, unit_price, taxable_amount, gst_rate,
            cgst_amount, sgst_amount, igst_amount, total_amount
     FROM public.sales_invoice_lines WHERE invoice_id = inv.id)
    UNION ALL
    (SELECT line_number, item_name, hsn_sac_code, unit_code, quantity, unit_price, taxable_amount, gst_rate,
            cgst_amount, sgst_amount, igst_amount, total_amount
     FROM public.sales_invoice_lines WHERE invoice_id = inv.id
     EXCEPT
     SELECT line_number, item_name, hsn_sac_code, unit_code, quantity, unit_price, taxable_amount, gst_rate,
            cgst_amount, sgst_amount, igst_amount, total_amount
     FROM public.business_document_lines WHERE document_id = d.id)
  ) x;
  ASSERT diff = 0, format('%s lines differ', diff);
  ASSERT NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organisation_id = '44a00000-0000-4000-8000-000000000001'),
    'conversion posted a journal';
END $$;

-- Double convert refused.
DO $$
BEGIN
  PERFORM public.convert_business_document('44a00000-0000-4000-8000-000000000001', (SELECT id FROM q), 'INV-Q-2');
  RAISE EXCEPTION 'double convert allowed';
EXCEPTION WHEN raise_exception THEN
  ASSERT SQLERRM LIKE '%already converted%', SQLERRM;
END $$;

-- Converted is immutable: no edit, no status move, no line change, no delete, no re-save.
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.business_documents SET notes = 'x' WHERE id = (SELECT id FROM q);
    RAISE EXCEPTION 'converted edited';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Document Violation%', SQLERRM; END;
  BEGIN
    UPDATE public.business_documents SET status = 'cancelled' WHERE id = (SELECT id FROM q);
    RAISE EXCEPTION 'converted cancelled';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Document Violation%', SQLERRM; END;
  BEGIN
    UPDATE public.business_document_lines SET quantity = 2 WHERE document_id = (SELECT id FROM q);
    RAISE EXCEPTION 'converted lines edited';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Document Violation%', SQLERRM; END;
  BEGIN
    DELETE FROM public.business_documents WHERE id = (SELECT id FROM q);
    RAISE EXCEPTION 'converted deleted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Document Violation%', SQLERRM; END;
END $$;

SET LOCAL ROLE authenticated;
-- Purchase orders and delivery challans don't convert.
DO $$
DECLARE po public.business_documents; dc public.business_documents;
BEGIN
  po := public.save_business_document('44a00000-0000-4000-8000-000000000001',
    '{"doc_type":"purchase_order","doc_number":"PO-1","doc_date":"2026-10-01","party_id":"44c00000-0000-4000-8000-000000000001","place_of_supply":"27-Maharashtra"}',
    '[{"line_number":1,"item_name":"Steel","quantity":1,"unit_price":100,"taxable_amount":100,"gst_rate":0,"total_amount":100}]');
  dc := public.save_business_document('44a00000-0000-4000-8000-000000000001',
    '{"doc_type":"delivery_challan","doc_number":"DC-1","doc_date":"2026-10-01","details":{"vehicle":"V1"}}',
    '[{"line_number":1,"item_name":"Steel","quantity":1,"unit_price":100,"taxable_amount":100,"gst_rate":0,"total_amount":100}]');
  BEGIN
    PERFORM public.convert_business_document('44a00000-0000-4000-8000-000000000001', po.id, 'INV-PO');
    RAISE EXCEPTION 'po converted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Purchase orders do not convert%', SQLERRM; END;
  BEGIN
    PERFORM public.convert_business_document('44a00000-0000-4000-8000-000000000001', dc.id, 'INV-DC');
    RAISE EXCEPTION 'challan converted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Delivery challans%', SQLERRM; END;

  -- A sent challan can still be linked to its invoice.
  UPDATE public.business_documents SET status = 'sent' WHERE id = dc.id;
  UPDATE public.business_documents
  SET linked_invoice_id = (SELECT b.converted_to_id FROM public.business_documents b WHERE b.id = (SELECT id FROM q))
  WHERE id = dc.id;
  ASSERT (SELECT linked_invoice_id FROM public.business_documents WHERE id = dc.id) IS NOT NULL, 'challan link lost';

  -- Owner deletes a draft PO; its lines go with it.
  DELETE FROM public.business_documents WHERE id = po.id;
  ASSERT NOT EXISTS (SELECT 1 FROM public.business_document_lines WHERE document_id = po.id), 'lines left behind';
END $$;

-- Document numbers are unique per type, not across types.
DO $$
BEGIN
  PERFORM public.save_business_document('44a00000-0000-4000-8000-000000000001',
    '{"doc_type":"proforma","doc_number":"QT-1","doc_date":"2026-10-01"}',
    '[{"line_number":1,"item_name":"A","quantity":1,"unit_price":1,"taxable_amount":1,"gst_rate":0,"total_amount":1}]');
  BEGIN
    PERFORM public.save_business_document('44a00000-0000-4000-8000-000000000001',
      '{"doc_type":"quotation","doc_number":"QT-1","doc_date":"2026-10-01"}',
      '[{"line_number":1,"item_name":"A","quantity":1,"unit_price":1,"taxable_amount":1,"gst_rate":0,"total_amount":1}]');
    RAISE EXCEPTION 'duplicate quotation number allowed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- Anon cannot call the functions.
RESET ROLE;
DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.convert_business_document(uuid, uuid, text)', 'EXECUTE'), 'anon can convert';
  ASSERT NOT has_function_privilege('anon', 'public.save_business_document(uuid, jsonb, jsonb)', 'EXECUTE'), 'anon can save';
  ASSERT has_function_privilege('authenticated', 'public.convert_business_document(uuid, uuid, text)', 'EXECUTE'), 'authenticated cannot convert';
END $$;

ROLLBACK;
