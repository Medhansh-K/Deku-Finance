-- Migration 42: inventory. FIFO layers, document-driven movements, negative-stock guard,
-- immutability, adjustment journals and RLS. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('42000000-0000-4000-8000-000000000001', 'inv-owner@test.local'),
  ('42000000-0000-4000-8000-000000000002', 'inv-accountant@test.local'),
  ('42000000-0000-4000-8000-000000000003', 'inv-viewer@test.local'),
  ('42000000-0000-4000-8000-000000000004', 'inv-outsider@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('42a00000-0000-4000-8000-000000000001', 'Stock Test', 'stock-test', '42000000-0000-4000-8000-000000000001'),
  ('42a00000-0000-4000-8000-000000000002', 'Stock Other', 'stock-other', '42000000-0000-4000-8000-000000000004');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('42a00000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'owner'),
  ('42a00000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', 'accountant'),
  ('42a00000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000003', 'viewer'),
  ('42a00000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000004', 'owner')
ON CONFLICT (organisation_id, user_id) DO NOTHING;
SELECT public.seed_default_chart_of_accounts('42a00000-0000-4000-8000-000000000001');
INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status)
VALUES ('42a00000-0000-4000-8000-000000000001', 'FY 2026-27', '2026-04-01', '2027-03-31', 'open');
INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name, gstin) VALUES
  ('42c00000-0000-4000-8000-000000000001', '42a00000-0000-4000-8000-000000000001', 'customer', 'Buyer Pvt Ltd', 'Buyer', '27AABCT1332L1ZA');
INSERT INTO public.catalogue_items (id, organisation_id, type, name, sku, track_inventory) VALUES
  ('42e00000-0000-4000-8000-000000000001', '42a00000-0000-4000-8000-000000000001', 'goods', 'Widget', 'WID', true),
  ('42e00000-0000-4000-8000-000000000002', '42a00000-0000-4000-8000-000000000001', 'services', 'Installation', 'SVC', false);

-- New companies get a default warehouse; seeding the chart adds the inventory ledgers.
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.warehouses WHERE organisation_id = '42a00000-0000-4000-8000-000000000001' AND is_default) = 1,
    'no default warehouse for a new company';
  ASSERT (SELECT count(*) FROM public.accounts WHERE organisation_id = '42a00000-0000-4000-8000-000000000001'
          AND code IN ('1050', '3030', '5015')) = 3, 'inventory ledgers missing';
  BEGIN
    UPDATE public.catalogue_items SET track_inventory = true WHERE id = '42e00000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'a service was set to track inventory';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Layers 2 and 3 arrive on purchase bills whose vouchers get linked (as the books' owner would).
INSERT INTO public.purchase_bills (id, organisation_id, supplier_name, supplier_gstin, bill_number, bill_date, place_of_supply,
  taxable_amount, cgst, sgst, total_amount, itc_eligibility, created_by) VALUES
  ('42b10000-0000-4000-8000-000000000002', '42a00000-0000-4000-8000-000000000001', 'Supplier', '27AABCT1332L1ZA', 'PB-2', '2026-10-02', '27',
   1100, 99, 99, 1298, 'eligible', '42000000-0000-4000-8000-000000000001'),
  ('42b10000-0000-4000-8000-000000000003', '42a00000-0000-4000-8000-000000000001', 'Supplier', '27AABCT1332L1ZA', 'PB-3', '2026-10-03', '27',
   1200, 108, 108, 1416, 'eligible', '42000000-0000-4000-8000-000000000001');
INSERT INTO public.purchase_bill_lines (organisation_id, bill_id, item_id, quantity, rate) VALUES
  ('42a00000-0000-4000-8000-000000000001', '42b10000-0000-4000-8000-000000000002', '42e00000-0000-4000-8000-000000000001', 10, 110),
  ('42a00000-0000-4000-8000-000000000001', '42b10000-0000-4000-8000-000000000003', '42e00000-0000-4000-8000-000000000001', 10, 120);
INSERT INTO public.journal_entries (id, organisation_id, fiscal_period_id, entry_number, entry_date, status, narration)
SELECT x.id, '42a00000-0000-4000-8000-000000000001', fp.id, x.num, x.d, 'draft', 'Purchase voucher'
FROM (VALUES ('42f00000-0000-4000-8000-000000000002'::uuid, 'PV-2', '2026-10-02'::date),
             ('42f00000-0000-4000-8000-000000000003'::uuid, 'PV-3', '2026-10-03'::date)) x(id, num, d)
JOIN public.fiscal_periods fp ON fp.organisation_id = '42a00000-0000-4000-8000-000000000001';

-- Invoices: #1 sells 15 widgets plus a service, #2 wants 20, #3 sells 5.
INSERT INTO public.sales_invoices (id, organisation_id, customer_id, invoice_number, invoice_date, due_date, supply_type, place_of_supply)
SELECT x.id, '42a00000-0000-4000-8000-000000000001', '42c00000-0000-4000-8000-000000000001', x.num, '2026-10-10', '2026-10-25', 'intra_state', '27'
FROM (VALUES ('42d00000-0000-4000-8000-000000000001'::uuid, 'INV-S-1'),
             ('42d00000-0000-4000-8000-000000000002'::uuid, 'INV-S-2'),
             ('42d00000-0000-4000-8000-000000000003'::uuid, 'INV-S-3')) x(id, num);
INSERT INTO public.sales_invoice_lines (organisation_id, invoice_id, line_number, item_id, item_name, quantity, unit_price, taxable_amount,
  gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount) VALUES
  ('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000001', 1, '42e00000-0000-4000-8000-000000000001', 'Widget', 15, 200, 3000, 18, 9, 270, 9, 270, 3540),
  ('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000001', 2, '42e00000-0000-4000-8000-000000000002', 'Installation', 1, 500, 500, 18, 9, 45, 9, 45, 590),
  ('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000002', 1, '42e00000-0000-4000-8000-000000000001', 'Widget', 20, 200, 4000, 18, 9, 360, 9, 360, 4720),
  ('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000003', 1, '42e00000-0000-4000-8000-000000000001', 'Widget', 5, 200, 1000, 18, 9, 90, 9, 90, 1180);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Layer 1: opening stock 10 @ 100, journal Dr Inventory / Cr Opening Balance Equity, posted and balanced.
DO $$
DECLARE
  r jsonb;
  j record;
BEGIN
  r := public.record_stock_adjustment('42a00000-0000-4000-8000-000000000001', '42e00000-0000-4000-8000-000000000001',
    'opening', 'in', 10, 100, '2026-10-01');
  ASSERT (r->>'value')::numeric = 1000 AND r->>'journal_status' = 'posted', format('opening stock: %s', r);
  SELECT je.status, sum(l.debit) AS dr, sum(l.credit) AS cr,
         sum(l.debit) FILTER (WHERE a.code = '1050') AS inv_dr, sum(l.credit) FILTER (WHERE a.code = '3030') AS obe_cr
  INTO j
  FROM public.journal_entries je
  JOIN public.journal_entry_lines l ON l.journal_entry_id = je.id
  JOIN public.accounts a ON a.id = l.account_id
  WHERE je.id = (r->>'journal_entry_id')::uuid
  GROUP BY je.status;
  ASSERT j.status = 'posted' AND j.dr = 1000 AND j.cr = 1000 AND j.inv_dr = 1000 AND j.obe_cr = 1000,
    format('opening journal wrong: %s', row_to_json(j));
END $$;

RESET ROLE;
UPDATE public.purchase_bills SET journal_entry_id = '42f00000-0000-4000-8000-000000000002' WHERE id = '42b10000-0000-4000-8000-000000000002';
UPDATE public.purchase_bills SET journal_entry_id = '42f00000-0000-4000-8000-000000000003' WHERE id = '42b10000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;

-- FIFO across three layers: 30 on hand worth 1000 + 1100 + 1200.
DO $$
DECLARE
  s record;
BEGIN
  SELECT * INTO s FROM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2026-12-31');
  ASSERT s.qty_on_hand = 30 AND s.fifo_value = 3300, format('three layers: %s', row_to_json(s));
  -- Bill lines are frozen once the voucher is linked.
  UPDATE public.purchase_bill_lines SET quantity = 99 WHERE bill_id = '42b10000-0000-4000-8000-000000000002';
  ASSERT NOT FOUND, 'lines of a linked bill were edited';
END $$;

-- Issuing #1 takes 15: all of layer 1 and half of layer 2 (COGS 1000 + 550). The service moves nothing.
DO $$
DECLARE
  s record;
  l record;
BEGIN
  PERFORM public.issue_sales_invoice('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000001', true);
  ASSERT (SELECT count(*) FROM public.stock_movements WHERE source_id = '42d00000-0000-4000-8000-000000000001') = 1,
    'expected one out movement for the tracked item only';
  SELECT * INTO s FROM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2026-12-31');
  ASSERT s.qty_on_hand = 15 AND s.fifo_value = 1750, format('after issue: %s', row_to_json(s));
  SELECT * INTO l FROM public.get_stock_ledger('42a00000-0000-4000-8000-000000000001', '42e00000-0000-4000-8000-000000000001',
    '2026-10-10', '2026-10-10');
  ASSERT l.direction = 'out' AND l.qty = 15 AND l.value = 1550 AND l.balance_qty = 15 AND l.balance_value = 1750,
    format('ledger row: %s', row_to_json(l));
  -- As of before the sale, the summary still shows all 30.
  SELECT * INTO s FROM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2026-10-09');
  ASSERT s.qty_on_hand = 30, 'as-of date ignored';
END $$;

-- Negative stock: #2 wants 20 of 15 and is refused, staying a draft with no movement or journal.
DO $$
BEGIN
  BEGIN
    PERFORM public.issue_sales_invoice('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000002', true);
    RAISE EXCEPTION 'issue beyond stock went through';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'stock_insufficient:WID' THEN RAISE; END IF;
  END;
  ASSERT (SELECT status FROM public.sales_invoices WHERE id = '42d00000-0000-4000-8000-000000000002') = 'draft', 'refused invoice changed';
  ASSERT NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE source_id = '42d00000-0000-4000-8000-000000000002'), 'refused invoice moved stock';
END $$;

-- Cancel restores stock: #3 takes 5 of layer 2, cancelling brings them back at 110 each.
DO $$
DECLARE
  s record;
BEGIN
  PERFORM public.issue_sales_invoice('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000003', true);
  SELECT * INTO s FROM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2027-03-31');
  ASSERT s.qty_on_hand = 10 AND s.fifo_value = 1200, format('after #3: %s', row_to_json(s));
  PERFORM public.cancel_sales_invoice('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000003', 'test');
  SELECT * INTO s FROM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2027-03-31');
  ASSERT s.qty_on_hand = 15 AND s.fifo_value = 1750, format('after cancel: %s', row_to_json(s));
  ASSERT (SELECT unit_cost FROM public.stock_movements WHERE source_id = '42d00000-0000-4000-8000-000000000003' AND direction = 'in') = 110,
    'reversal not at the FIFO cost of the issue';
END $$;

-- Sales return: 3 of invoice #1 come back at its FIFO cost (1550 / 15).
INSERT INTO public.sales_notes (id, organisation_id, note_type, original_invoice_id, customer_id, note_number, note_date,
  reason_code, supply_type, place_of_supply)
VALUES ('42d10000-0000-4000-8000-000000000001', '42a00000-0000-4000-8000-000000000001', 'credit', '42d00000-0000-4000-8000-000000000001',
        '42c00000-0000-4000-8000-000000000001', 'CN-S-1', '2026-10-20', 'sales_return', 'intra_state', '27');
INSERT INTO public.sales_note_lines (organisation_id, note_id, line_number, item_id, item_name, quantity, unit_price, taxable_amount,
  gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount)
VALUES ('42a00000-0000-4000-8000-000000000001', '42d10000-0000-4000-8000-000000000001', 1, '42e00000-0000-4000-8000-000000000001',
        'Widget', 3, 200, 600, 18, 9, 54, 9, 54, 708);
DO $$
DECLARE
  m public.stock_movements;
BEGIN
  PERFORM public.issue_sales_note('42a00000-0000-4000-8000-000000000001', '42d10000-0000-4000-8000-000000000001');
  SELECT * INTO m FROM public.stock_movements WHERE source_id = '42d10000-0000-4000-8000-000000000001';
  ASSERT m.direction = 'in' AND m.qty = 3 AND m.unit_cost = 103.3333, format('return movement: %s', row_to_json(m));
  PERFORM public.cancel_sales_note('42a00000-0000-4000-8000-000000000001', '42d10000-0000-4000-8000-000000000001', 'test');
  ASSERT (SELECT sum(CASE WHEN direction = 'in' THEN qty ELSE -qty END) FROM public.stock_movements
          WHERE source_id = '42d10000-0000-4000-8000-000000000001') = 0, 'cancelled return not reversed';
END $$;

-- Adjustment out of 1 widget: Dr Inventory adjustment / Cr Inventory at FIFO (the oldest left is 110).
DO $$
DECLARE
  r jsonb;
  j record;
BEGIN
  r := public.record_stock_adjustment('42a00000-0000-4000-8000-000000000001', '42e00000-0000-4000-8000-000000000001',
    'adjustment', 'out', 1, NULL, '2026-10-21', NULL, 'damaged');
  SELECT sum(l.debit) AS dr, sum(l.credit) AS cr,
         sum(l.debit) FILTER (WHERE a.code = '5015') AS adj_dr, sum(l.credit) FILTER (WHERE a.code = '1050') AS inv_cr
  INTO j
  FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
  WHERE l.journal_entry_id = (r->>'journal_entry_id')::uuid;
  ASSERT (r->>'value')::numeric = 110 AND j.dr = j.cr AND j.adj_dr = 110 AND j.inv_cr = 110, format('adjustment out: %s %s', r, row_to_json(j));
END $$;

-- Immutability: no update or delete, not even by the table owner; members can't insert either.
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.stock_movements SET qty = 1 WHERE organisation_id = '42a00000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'movement updated';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'stock_movement_immutable%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.stock_movements WHERE organisation_id = '42a00000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'movement deleted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'stock_movement_immutable%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.warehouses WHERE organisation_id = '42a00000-0000-4000-8000-000000000001' AND is_default;
    RAISE EXCEPTION 'default warehouse deleted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'The default warehouse cannot be deleted%' THEN RAISE; END IF;
  END;
END $$;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  INSERT INTO public.stock_movements (organisation_id, item_id, warehouse_id, movement_date, direction, qty, unit_cost, source_type)
  SELECT '42a00000-0000-4000-8000-000000000001', '42e00000-0000-4000-8000-000000000001', id, '2026-10-01', 'in', 100, 0, 'adjustment'
  FROM public.warehouses WHERE organisation_id = '42a00000-0000-4000-8000-000000000001' AND is_default;
  RAISE EXCEPTION 'member inserted a movement directly';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- An accountant's adjustment voucher waits for approval instead of posting.
SELECT set_config('request.jwt.claims', '{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.record_stock_adjustment('42a00000-0000-4000-8000-000000000001', '42e00000-0000-4000-8000-000000000001',
    'adjustment', 'in', 2, 90, '2026-10-22', NULL, 'found in count');
  ASSERT r->>'journal_status' = 'pending_approval', format('accountant adjustment: %s', r);
END $$;

-- RLS: a viewer reads but can't adjust; an outsider sees nothing.
SELECT set_config('request.jwt.claims', '{"sub":"42000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2027-03-31')) = 1, 'viewer cannot read stock';
  BEGIN
    PERFORM public.record_stock_adjustment('42a00000-0000-4000-8000-000000000001', '42e00000-0000-4000-8000-000000000001',
      'adjustment', 'in', 1, 1, '2026-10-22');
    RAISE EXCEPTION 'viewer adjusted stock';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Permission denied%' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"42000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE organisation_id = '42a00000-0000-4000-8000-000000000001'), 'outsider sees movements';
  ASSERT NOT EXISTS (SELECT 1 FROM public.warehouses WHERE organisation_id = '42a00000-0000-4000-8000-000000000001'), 'outsider sees warehouses';
  BEGIN
    PERFORM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2027-03-31');
    RAISE EXCEPTION 'outsider read the stock summary';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Permission denied' THEN RAISE; END IF;
  END;
END $$;

-- Override: with allow_negative_stock on, #2 issues and leaves the item at 16 - 20 = -4.
RESET ROLE;
UPDATE public.organisations SET allow_negative_stock = true WHERE id = '42a00000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE
  s record;
BEGIN
  PERFORM public.issue_sales_invoice('42a00000-0000-4000-8000-000000000001', '42d00000-0000-4000-8000-000000000002', true);
  SELECT * INTO s FROM public.get_stock_summary('42a00000-0000-4000-8000-000000000001', '2027-03-31');
  ASSERT s.qty_on_hand = -4 AND s.fifo_value = 0, format('negative stock: %s', row_to_json(s));
END $$;

ROLLBACK;
