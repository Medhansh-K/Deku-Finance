-- Migration 55: edit_draft_journal. Atomic replace, the states it refuses, roles, tenancy, periods,
-- maker-checker and the send-back round trip. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('55000000-0000-4000-8000-000000000001', 'edit-owner@test.local'),
  ('55000000-0000-4000-8000-000000000002', 'edit-accountant@test.local'),
  ('55000000-0000-4000-8000-000000000003', 'edit-viewer@test.local'),
  ('55000000-0000-4000-8000-000000000004', 'edit-outsider@test.local'),
  ('55000000-0000-4000-8000-000000000005', 'edit-admin@test.local'),
  ('55000000-0000-4000-8000-000000000006', 'edit-cfo@test.local'),
  ('55000000-0000-4000-8000-000000000007', 'edit-auditor@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('55a00000-0000-4000-8000-000000000001', 'Edit Test', 'edit-test', '55000000-0000-4000-8000-000000000001'),
  ('55a00000-0000-4000-8000-000000000002', 'Edit Other', 'edit-other', '55000000-0000-4000-8000-000000000004');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('55a00000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000001', 'owner'),
  ('55a00000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000002', 'accountant'),
  ('55a00000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000003', 'viewer'),
  ('55a00000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000005', 'admin'),
  ('55a00000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000006', 'cfo'),
  ('55a00000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000007', 'auditor'),
  ('55a00000-0000-4000-8000-000000000002', '55000000-0000-4000-8000-000000000004', 'owner')
ON CONFLICT (organisation_id, user_id) DO NOTHING;
SELECT public.seed_default_chart_of_accounts('55a00000-0000-4000-8000-000000000001');
SELECT public.seed_default_chart_of_accounts('55a00000-0000-4000-8000-000000000002');
INSERT INTO public.fiscal_periods (id, organisation_id, name, start_date, end_date, status) VALUES
  ('55f00000-0000-4000-8000-000000000001', '55a00000-0000-4000-8000-000000000001', 'FY 2026-27 H1', '2026-04-01', '2026-09-30', 'open'),
  ('55f00000-0000-4000-8000-000000000002', '55a00000-0000-4000-8000-000000000001', 'FY 2026-27 H2', '2026-10-01', '2027-03-31', 'open'),
  ('55f00000-0000-4000-8000-000000000003', '55a00000-0000-4000-8000-000000000001', 'FY 2025-26', '2025-04-01', '2026-03-31', 'closed'),
  ('55f00000-0000-4000-8000-000000000004', '55a00000-0000-4000-8000-000000000002', 'FY 2026-27', '2026-04-01', '2027-03-31', 'open');
INSERT INTO public.accounts (id, organisation_id, code, name, type, account_group, label) VALUES
  ('55d00000-0000-4000-8000-000000000001', '55a00000-0000-4000-8000-000000000002', '9055', 'Other company ledger', 'expense', 'expense', 'Other company ledger');
INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name) VALUES
  ('55c00000-0000-4000-8000-000000000001', '55a00000-0000-4000-8000-000000000001', 'vendor', 'Vendor', 'Vendor');

-- An older created_at, as for any voucher saved in an earlier request: post_journal_entry treats an
-- entry created in the current transaction as system-generated and skips maker-checker.
INSERT INTO public.journal_entries (id, organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, created_by, created_at)
SELECT ('55e00000-0000-4000-8000-00000000000' || x.n)::uuid, '55a00000-0000-4000-8000-000000000001',
  '55f00000-0000-4000-8000-000000000002', 'JRN-E' || x.n, '2026-10-05', 'draft', 'Before ' || x.n,
  x.maker::uuid, now() - interval '1 day'
FROM (VALUES
  ('1', '55000000-0000-4000-8000-000000000001'), -- edited and posted
  ('2', '55000000-0000-4000-8000-000000000001'), -- posted, then reversed
  ('3', '55000000-0000-4000-8000-000000000002'), -- maker-checker round trip
  ('4', '55000000-0000-4000-8000-000000000001'), -- roles and tenancy
  ('5', '55000000-0000-4000-8000-000000000001')  -- linked to a purchase bill
) x(n, maker);
INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, party_id, debit, credit)
SELECT '55a00000-0000-4000-8000-000000000001', e.id, s.n, a.id, CASE WHEN s.n = 1 THEN '55c00000-0000-4000-8000-000000000001'::uuid END, s.d, s.c
FROM public.journal_entries e
CROSS JOIN (VALUES (1, '5090', 100, 0), (2, '1020', 0, 100)) s(n, code, d, c)
JOIN public.accounts a ON a.organisation_id = e.organisation_id AND a.code = s.code
WHERE e.entry_number LIKE 'JRN-E%';

INSERT INTO public.purchase_bills (organisation_id, supplier_name, supplier_gstin, bill_number, bill_date, place_of_supply,
  taxable_amount, cgst, sgst, total_amount, itc_eligibility, journal_entry_id, created_by)
VALUES ('55a00000-0000-4000-8000-000000000001', 'Supplier', '27AABCT1332L1ZA', 'PB-55', '2026-10-05', '27', 100, 0, 0, 100, 'eligible',
  '55e00000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000001');

CREATE FUNCTION pg_temp.as_user(p_n int) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', '55000000-0000-4000-8000-00000000000' || p_n, 'role', 'authenticated')::text, true);
$$;

-- Dr 5090, Cr 1020.
CREATE FUNCTION pg_temp.lines(p_debit numeric, p_credit numeric) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('line_number', 1, 'debit', p_debit, 'credit', 0, 'party_id', '55c00000-0000-4000-8000-000000000001',
      'account_id', (SELECT id FROM public.accounts WHERE organisation_id = '55a00000-0000-4000-8000-000000000001' AND code = '5090')),
    jsonb_build_object('line_number', 2, 'debit', 0, 'credit', p_credit,
      'account_id', (SELECT id FROM public.accounts WHERE organisation_id = '55a00000-0000-4000-8000-000000000001' AND code = '1020')));
$$;

CREATE FUNCTION pg_temp.must_refuse(p_entry int, p_pattern text, p_org uuid DEFAULT '55a00000-0000-4000-8000-000000000001',
  p_date date DEFAULT '2026-10-06', p_narration text DEFAULT 'After', p_lines jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM public.edit_draft_journal(p_org, ('55e00000-0000-4000-8000-00000000000' || p_entry)::uuid, p_date, p_narration, NULL,
      coalesce(p_lines, pg_temp.lines(1, 1)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE p_pattern THEN
      RAISE EXCEPTION 'edit of entry % refused for the wrong reason: %', p_entry, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'edit of entry % should have been refused (%)', p_entry, p_pattern;
END;
$$;

DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.edit_draft_journal(uuid, uuid, date, text, text, jsonb)', 'EXECUTE'), 'anon can edit';
  ASSERT has_function_privilege('authenticated', 'public.edit_draft_journal(uuid, uuid, date, text, text, jsonb)', 'EXECUTE'), 'authenticated cannot edit';
  ASSERT has_function_privilege('service_role', 'public.edit_draft_journal(uuid, uuid, date, text, text, jsonb)', 'EXECUTE'), 'service_role cannot edit';
END $$;

SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------------------------
-- The edit itself, and balance still being checked at post
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  o uuid := '55a00000-0000-4000-8000-000000000001';
  e1 uuid := '55e00000-0000-4000-8000-000000000001';
  je public.journal_entries;
BEGIN
  PERFORM pg_temp.as_user(1);

  -- Unbalanced saves, like a draft saved the first time, and posting refuses it.
  je := public.edit_draft_journal(o, e1, '2026-09-15', '  After  ', ' REF-1 ', pg_temp.lines(250, 240));
  ASSERT je.entry_date = '2026-09-15' AND je.narration = 'After' AND je.reference = 'REF-1', 'header not replaced';
  ASSERT je.entry_number = 'JRN-E1' AND je.status = 'draft' AND je.created_by = '55000000-0000-4000-8000-000000000001', 'identity changed';
  ASSERT je.fiscal_period_id = '55f00000-0000-4000-8000-000000000001', 'period does not follow the new date';
  ASSERT (SELECT count(*) FROM public.journal_entry_lines WHERE journal_entry_id = e1) = 2, 'old lines left behind';
  ASSERT (SELECT array_agg(line_number ORDER BY line_number) FROM public.journal_entry_lines WHERE journal_entry_id = e1) = ARRAY[1, 2], 'lines misnumbered';
  ASSERT (SELECT party_id FROM public.journal_entry_lines WHERE journal_entry_id = e1 AND line_number = 1) = '55c00000-0000-4000-8000-000000000001', 'party lost';
  ASSERT EXISTS (SELECT 1 FROM public.user_activity_logs WHERE entity_id = e1::text AND action = 'Draft Voucher Edited'
    AND (metadata ->> 'previous_total')::numeric = 100), 'edit not in the activity log';
  BEGIN
    PERFORM public.post_journal_entry(o, e1);
    RAISE EXCEPTION 'posted out of balance';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE 'Out of balance%', 'wrong refusal: ' || SQLERRM;
  END;
  BEGIN
    PERFORM public.submit_journal_for_approval(o, e1);
    RAISE EXCEPTION 'submitted out of balance';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE 'Voucher must have%', 'wrong refusal: ' || SQLERRM;
  END;

  -- Balanced again, the ledger gets the new figures and nothing of the old ones.
  je := public.edit_draft_journal(o, e1, '2026-10-06', 'After', NULL, pg_temp.lines(250, 250));
  ASSERT je.reference IS NULL, 'reference not cleared';
  ASSERT je.fiscal_period_id = '55f00000-0000-4000-8000-000000000002', 'period does not follow the date back';
  je := public.post_journal_entry(o, e1);
  ASSERT je.status = 'posted', 'not posted';
  ASSERT (SELECT sum(debit) FROM public.view_general_ledger WHERE journal_entry_id = e1) = 250, 'ledger has the old figures';

  -- Bad input changes nothing.
  e1 := '55e00000-0000-4000-8000-000000000004';
  PERFORM pg_temp.must_refuse(4, '%at least 2 lines%', p_lines => '[]'::jsonb);
  PERFORM pg_temp.must_refuse(4, '%at least 2 lines%', p_lines => '{"a":1}'::jsonb);
  PERFORM pg_temp.must_refuse(4, '%needs a narration%', p_narration => '   ');
  PERFORM pg_temp.must_refuse(4, '%chk_journal_entry_lines_one_side%', p_lines => pg_temp.lines(0, 1));
  -- Another company's ledger is refused, and failing after the old lines were deleted leaves them in place.
  PERFORM pg_temp.must_refuse(4, '%fk_lines_account%', p_lines =>
    jsonb_set(pg_temp.lines(1, 1), '{0,account_id}', '"55d00000-0000-4000-8000-000000000001"'));
  ASSERT (SELECT sum(debit) FROM public.journal_entry_lines WHERE journal_entry_id = e1) = 100, 'a failed edit changed the lines';
  ASSERT (SELECT narration FROM public.journal_entries WHERE id = e1) = 'Before 4', 'a failed edit changed the header';

  -- Periods: same rule as saving a voucher, an open period has to cover the date.
  PERFORM pg_temp.must_refuse(4, '%No open fiscal period%', p_date => '2026-01-15');
  PERFORM pg_temp.must_refuse(4, '%No open fiscal period%', p_date => '2024-01-15');
END $$;

-- ---------------------------------------------------------------------------------------------
-- Posted and reversed stay untouchable
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  o uuid := '55a00000-0000-4000-8000-000000000001';
  e2 uuid := '55e00000-0000-4000-8000-000000000002';
  v_rev uuid;
BEGIN
  PERFORM pg_temp.as_user(1);
  PERFORM pg_temp.must_refuse(1, 'Only draft vouchers can be edited (status: posted)');

  PERFORM public.post_journal_entry(o, e2);
  PERFORM pg_temp.must_refuse(2, 'Only draft vouchers can be edited (status: posted)');
  v_rev := public.reverse_journal_entry(o, e2, '2026-10-07', 'Undo');
  PERFORM pg_temp.must_refuse(2, 'Only draft vouchers can be edited (status: reversed)');
  BEGIN
    PERFORM public.edit_draft_journal(o, v_rev, '2026-10-07', 'After', NULL, pg_temp.lines(1, 1));
    RAISE EXCEPTION 'edited a reversal entry';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE 'Only draft vouchers%', 'wrong refusal: ' || SQLERRM;
  END;
  ASSERT (SELECT sum(debit) FROM public.journal_entry_lines WHERE journal_entry_id = e2) = 100, 'a reversed entry changed';
END $$;

-- ---------------------------------------------------------------------------------------------
-- Roles and tenancy
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  n int;
BEGIN
  -- Viewer and auditor only read; a CFO approves but can't create a voucher either (migration 5).
  FOREACH n IN ARRAY ARRAY[3, 6, 7] LOOP
    PERFORM pg_temp.as_user(n);
    PERFORM pg_temp.must_refuse(4, 'Permission denied%');
  END LOOP;

  -- Another company's member, naming either company.
  PERFORM pg_temp.as_user(4);
  PERFORM pg_temp.must_refuse(4, 'Permission denied%');
  PERFORM pg_temp.must_refuse(4, 'Journal entry not found', p_org => '55a00000-0000-4000-8000-000000000002');

  -- The roles that may create a voucher may edit one.
  FOREACH n IN ARRAY ARRAY[1, 2, 5] LOOP
    PERFORM pg_temp.as_user(n);
    PERFORM public.edit_draft_journal('55a00000-0000-4000-8000-000000000001', '55e00000-0000-4000-8000-000000000004',
      '2026-10-06', 'By ' || n, NULL, pg_temp.lines(n, n));
  END LOOP;
  ASSERT (SELECT narration FROM public.journal_entries WHERE id = '55e00000-0000-4000-8000-000000000004') = 'By 5', 'an allowed role was blocked';

  -- A voucher that carries a document's figures isn't edited here.
  PERFORM pg_temp.as_user(1);
  PERFORM pg_temp.must_refuse(5, '%comes from an invoice%');
END $$;

-- ---------------------------------------------------------------------------------------------
-- Maker-checker: pending is frozen, a sent-back voucher goes round again
-- ---------------------------------------------------------------------------------------------
RESET ROLE;
UPDATE public.organisations SET require_journal_approval = true WHERE id = '55a00000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  o uuid := '55a00000-0000-4000-8000-000000000001';
  e3 uuid := '55e00000-0000-4000-8000-000000000003';
  je public.journal_entries;
BEGIN
  PERFORM pg_temp.as_user(2);
  je := public.submit_journal_for_approval(o, e3);
  ASSERT je.submitted_at IS NOT NULL, 'not submitted';

  -- Pending: refused for the maker and the checker alike, and the lines can't be changed directly.
  PERFORM pg_temp.must_refuse(3, '%awaiting approval%');
  PERFORM pg_temp.as_user(1);
  PERFORM pg_temp.must_refuse(3, '%awaiting approval%');
  PERFORM pg_temp.as_user(2);
  BEGIN
    UPDATE public.journal_entry_lines SET debit = 999 WHERE journal_entry_id = e3 AND line_number = 1;
    RAISE EXCEPTION 'a pending voucher line was updated';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%awaiting approval%', 'wrong refusal: ' || SQLERRM;
  END;
  BEGIN
    DELETE FROM public.journal_entry_lines WHERE journal_entry_id = e3;
    RAISE EXCEPTION 'a pending voucher line was deleted';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%awaiting approval%', 'wrong refusal: ' || SQLERRM;
  END;
  ASSERT (SELECT sum(debit) FROM public.journal_entry_lines WHERE journal_entry_id = e3) = 100, 'pending figures changed';

  -- Sent back: the checker can't change the figures they will approve; the maker can.
  PERFORM pg_temp.as_user(1);
  je := public.reject_journal_entry(o, e3, 'Wrong amount');
  ASSERT je.rejection_reason = 'Wrong amount' AND je.submitted_at IS NULL, 'not sent back';
  PERFORM pg_temp.must_refuse(3, 'Maker-checker%');
  PERFORM pg_temp.as_user(5);
  PERFORM pg_temp.must_refuse(3, 'Maker-checker%');

  PERFORM pg_temp.as_user(2);
  je := public.edit_draft_journal(o, e3, '2026-10-08', 'Corrected', 'FIXED', pg_temp.lines(400, 400));
  ASSERT je.rejected_at IS NULL AND je.rejected_by IS NULL AND je.rejection_reason IS NULL, 'rejection not cleared';
  ASSERT je.submitted_at IS NULL AND je.status = 'draft', 'edit changed the workflow state';

  -- Still has to go through approval, and the maker still can't approve it.
  BEGIN
    PERFORM public.post_journal_entry(o, e3);
    RAISE EXCEPTION 'accountant posted';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE 'Segregation of Duties%', 'wrong refusal: ' || SQLERRM;
  END;
  PERFORM pg_temp.as_user(1);
  BEGIN
    PERFORM public.post_journal_entry(o, e3);
    RAISE EXCEPTION 'edit got round approval';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE 'Approval required%', 'wrong refusal: ' || SQLERRM;
  END;

  PERFORM pg_temp.as_user(2);
  je := public.submit_journal_for_approval(o, e3);
  ASSERT je.submitted_at IS NOT NULL AND je.submitted_by = '55000000-0000-4000-8000-000000000002', 'not resubmitted';
  PERFORM pg_temp.must_refuse(3, '%awaiting approval%');

  PERFORM pg_temp.as_user(1);
  je := public.post_journal_entry(o, e3);
  ASSERT je.status = 'posted', 'not approved';
  ASSERT (SELECT sum(debit) FROM public.view_general_ledger WHERE journal_entry_id = e3) = 400, 'ledger does not have the corrected figures';
END $$;

RESET ROLE;
ROLLBACK;
