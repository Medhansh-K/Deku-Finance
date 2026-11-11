-- Migration 35: marketplace settlements - net CHECK, line reconciliation, balanced summary journal,
-- missing-account error, RLS and the maker-checker submit path.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'mkt-owner@example.com'),
  ('b1000000-0000-0000-0000-000000000002', 'mkt-accountant@example.com'),
  ('b1000000-0000-0000-0000-000000000003', 'mkt-outsider@example.com');
INSERT INTO public.organisations (id, name, slug, created_by)
VALUES ('b2000000-0000-0000-0000-000000000001', 'Marketplace Test', 'marketplace-test', 'b1000000-0000-0000-0000-000000000001');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'owner'),
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'accountant')
ON CONFLICT DO NOTHING;
SELECT public.seed_default_chart_of_accounts('b2000000-0000-0000-0000-000000000001');
INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date)
VALUES ('b2000000-0000-0000-0000-000000000001', 'FY 2026-27', '2026-04-01', '2027-03-31');

-- Builds the RPC arguments for a settlement with one line per amount type.
CREATE FUNCTION pg_temp.lines(g numeric, r numeric, c numeric, f numeric, gst numeric, tcs numeric, tds numeric)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object('row_number', n, 'line_type', t, 'amount', a, 'order_id', 'ORD-' || n))
  FROM (VALUES (1, 'gross_sales', g), (2, 'refunds', r), (3, 'commission', c), (4, 'other_fees', f),
               (5, 'gst_on_fees', gst), (6, 'tcs_amount', tcs), (7, 'tds_amount', tds)) v(n, t, a)
  WHERE a <> 0;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

DO $$
DECLARE
  v_org uuid := 'b2000000-0000-0000-0000-000000000001';
  v_s public.marketplace_settlements;
  v_je public.journal_entries;
  v_dr numeric;
  v_cr numeric;
  n int;
BEGIN
  -- CHECK: net must equal gross less every deduction, to the paisa.
  BEGIN
    INSERT INTO public.marketplace_settlements (organisation_id, channel, settlement_ref, period_from, period_to, gross_sales, commission, net_payout)
    VALUES (v_org, 'amazon', 'BAD-1', '2026-10-01', '2026-10-14', 1000, 100, 900.01);
    RAISE EXCEPTION 'net CHECK did not fire';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM LIKE '%chk_marketplace_settlements_net%', SQLERRM;
  END;

  -- Lines must add up to the header per type.
  BEGIN
    PERFORM public.create_marketplace_settlement(v_org,
      '{"channel":"amazon","settlement_ref":"BAD-2","period_from":"2026-10-01","period_to":"2026-10-14","gross_sales":1000,"commission":100,"net_payout":900}',
      pg_temp.lines(1000, 0, 99, 0, 0, 0, 0));
    RAISE EXCEPTION 'line reconciliation did not fire';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Settlement lines do not add up%commission lines 99.00 vs header 100.00%', SQLERRM;
  END;

  -- A valid settlement posts one balanced summary journal.
  v_s := public.create_marketplace_settlement(v_org,
    '{"channel":"amazon","settlement_ref":"AMZ-1001","period_from":"2026-10-01","period_to":"2026-10-14","gross_sales":10000,"refunds":1000,"commission":1200,"other_fees":300,"gst_on_fees":270,"tcs_amount":90,"tds_amount":9,"net_payout":7131,"source_filename":"amz.csv"}',
    pg_temp.lines(10000, 1000, 1200, 300, 270, 90, 9));
  ASSERT v_s.imported_by = 'b1000000-0000-0000-0000-000000000001', 'imported_by not stamped';
  ASSERT (SELECT count(*) FROM public.marketplace_settlement_lines WHERE settlement_id = v_s.id) = 7, 'lines not stored';

  v_je := public.post_marketplace_settlement(v_org, v_s.id);
  ASSERT v_je.status = 'posted', 'owner without maker-checker should post, got ' || v_je.status;
  SELECT sum(debit), sum(credit) INTO v_dr, v_cr FROM public.journal_entry_lines WHERE journal_entry_id = v_je.id;
  ASSERT v_dr = v_cr AND v_dr = 9000, format('journal not balanced at gross - refunds: %s / %s', v_dr, v_cr);
  ASSERT (SELECT debit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.code = '1020') = 7131, 'bank not debited with net';
  ASSERT (SELECT sum(debit) FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.code = '5091') = 1500, 'fees not debited';
  ASSERT (SELECT debit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.code = '1083') = 270, 'IGST on fees not debited';
  ASSERT (SELECT debit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.code = '1084') = 90, 'TCS not debited';
  ASSERT (SELECT debit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.code = '1085') = 9, 'TDS not debited';
  ASSERT (SELECT credit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.code = '1040') = 9000, 'clearing not credited';
  ASSERT (SELECT journal_entry_id FROM public.marketplace_settlements WHERE id = v_s.id) = v_je.id, 'journal not linked';

  -- Posting twice is refused; a posted settlement cannot be deleted.
  BEGIN
    PERFORM public.post_marketplace_settlement(v_org, v_s.id);
    RAISE EXCEPTION 'posted twice';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%already has a voucher', SQLERRM;
  END;
  DELETE FROM public.marketplace_settlements WHERE id = v_s.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'posted settlement deleted';

  -- Intra-state fee GST splits into CGST and SGST halves; a draft can be deleted with its lines.
  v_s := public.create_marketplace_settlement(v_org,
    '{"channel":"flipkart","settlement_ref":"FK-1","period_from":"2026-10-01","period_to":"2026-10-07","gross_sales":500,"commission":50,"gst_on_fees":9.01,"fee_gst_split":"cgst_sgst","net_payout":440.99}',
    pg_temp.lines(500, 0, 50, 0, 9.01, 0, 0));
  DELETE FROM public.marketplace_settlements WHERE id = v_s.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'draft settlement not deleted';
  ASSERT (SELECT count(*) FROM public.marketplace_settlement_lines WHERE settlement_id = v_s.id) = 0, 'lines not cascaded';

  v_s := public.create_marketplace_settlement(v_org,
    '{"channel":"flipkart","settlement_ref":"FK-2","period_from":"2026-10-01","period_to":"2026-10-07","gross_sales":500,"commission":50,"gst_on_fees":9.01,"fee_gst_split":"cgst_sgst","net_payout":440.99}',
    pg_temp.lines(500, 0, 50, 0, 9.01, 0, 0));
  v_je := public.post_marketplace_settlement(v_org, v_s.id);
  ASSERT (SELECT string_agg(a.code || ':' || l.debit, ',' ORDER BY a.code) FROM public.journal_entry_lines l
          JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = v_je.id AND a.code IN ('1081', '1082')) = '1081:4.51,1082:4.50', 'fee GST split wrong';

  -- Column map: one per company and channel.
  INSERT INTO public.marketplace_column_maps (organisation_id, channel, mapping)
  VALUES (v_org, 'amazon', '{"gross_sales":"product sales"}');
  INSERT INTO public.marketplace_column_maps (organisation_id, channel, mapping)
  VALUES (v_org, 'amazon', '{"gross_sales":"principal"}')
  ON CONFLICT (organisation_id, channel) DO UPDATE SET mapping = EXCLUDED.mapping;
  ASSERT (SELECT mapping->>'gross_sales' FROM public.marketplace_column_maps WHERE channel = 'amazon') = 'principal', 'map not replaced';
END $$;

-- Missing (here: deactivated) accounts are named in the error.
RESET ROLE;
UPDATE public.accounts SET is_active = false
WHERE organisation_id = 'b2000000-0000-0000-0000-000000000001' AND code IN ('1084', '1085');
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_s public.marketplace_settlements;
BEGIN
  v_s := public.create_marketplace_settlement('b2000000-0000-0000-0000-000000000001',
    '{"channel":"meesho","settlement_ref":"MS-1","period_from":"2026-10-01","period_to":"2026-10-07","gross_sales":100,"tcs_amount":1,"tds_amount":0.1,"net_payout":98.9}',
    pg_temp.lines(100, 0, 0, 0, 0, 1, 0.1));
  BEGIN
    PERFORM public.post_marketplace_settlement('b2000000-0000-0000-0000-000000000001', v_s.id);
    RAISE EXCEPTION 'posted without TCS/TDS accounts';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Missing accounts for marketplace settlement: 1084 TCS Receivable (Section 52 CGST), 1085 TDS Receivable (Section 194-O).%', SQLERRM;
  END;
END $$;

-- Outsider: sees nothing, cannot import, post or read maps.
SELECT set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.marketplace_settlements) = 0, 'outsider reads settlements';
  ASSERT (SELECT count(*) FROM public.marketplace_settlement_lines) = 0, 'outsider reads lines';
  ASSERT (SELECT count(*) FROM public.marketplace_column_maps) = 0, 'outsider reads maps';
  BEGIN
    PERFORM public.create_marketplace_settlement('b2000000-0000-0000-0000-000000000001',
      '{"channel":"amazon","settlement_ref":"X-1","period_from":"2026-10-01","period_to":"2026-10-01","gross_sales":1,"net_payout":1}',
      pg_temp.lines(1, 0, 0, 0, 0, 0, 0));
    RAISE EXCEPTION 'outsider imported a settlement';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.post_marketplace_settlement('b2000000-0000-0000-0000-000000000001', gen_random_uuid());
    RAISE EXCEPTION 'outsider reached post';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Permission denied%', SQLERRM;
  END;
END $$;

-- Maker-checker on: the accountant's import is submitted for approval, not posted.
RESET ROLE;
UPDATE public.organisations SET require_journal_approval = true WHERE id = 'b2000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE
  v_s public.marketplace_settlements;
  v_je public.journal_entries;
BEGIN
  v_s := public.create_marketplace_settlement('b2000000-0000-0000-0000-000000000001',
    '{"channel":"amazon","settlement_ref":"AMZ-1002","period_from":"2026-10-15","period_to":"2026-10-28","gross_sales":2000,"commission":200,"net_payout":1800}',
    pg_temp.lines(2000, 0, 200, 0, 0, 0, 0));
  v_je := public.post_marketplace_settlement('b2000000-0000-0000-0000-000000000001', v_s.id);
  ASSERT v_je.status = 'draft' AND v_je.submitted_at IS NOT NULL
    AND v_je.submitted_by = 'b1000000-0000-0000-0000-000000000002', 'not submitted for approval';
END $$;

RESET ROLE;
DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.post_marketplace_settlement(uuid, uuid, uuid)', 'EXECUTE'), 'anon can post';
  ASSERT NOT has_function_privilege('anon', 'public.create_marketplace_settlement(uuid, jsonb, jsonb)', 'EXECUTE'), 'anon can create';
  ASSERT NOT has_function_privilege('authenticated', 'public._marketplace_account(uuid, text, text)', 'EXECUTE'), 'helper exposed';
  RAISE NOTICE 'marketplace_test passed';
END $$;

ROLLBACK;
