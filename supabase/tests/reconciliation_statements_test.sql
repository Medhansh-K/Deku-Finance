-- Migration 56: the statement-level record. Book balance counts posted and reversed entries only, the
-- figures come from the database, roles match bank_reconciliations, companies stay apart and a
-- recorded statement can't change. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('56000000-0000-4000-8000-0000000000a1', 'rs-owner@test.local'),
  ('56000000-0000-4000-8000-0000000000a2', 'rs-cfo@test.local'),
  ('56000000-0000-4000-8000-0000000000a3', 'rs-admin@test.local'),
  ('56000000-0000-4000-8000-0000000000a4', 'rs-accountant@test.local'),
  ('56000000-0000-4000-8000-0000000000a5', 'rs-viewer@test.local'),
  ('56000000-0000-4000-8000-0000000000a6', 'rs-auditor@test.local'),
  ('56000000-0000-4000-8000-0000000000b1', 'rs-other-owner@test.local');
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, 'Name of ' || email FROM auth.users WHERE email LIKE 'rs-%@test.local'
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

-- A voucher of [code, debit, credit] lines, entered as a draft and then given its status directly.
CREATE FUNCTION pg_temp.je(p_org uuid, p_number text, p_date date, p_lines jsonb, p_status text DEFAULT 'posted')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  l jsonb;
  i int := 0;
BEGIN
  INSERT INTO public.journal_entries (id, organisation_id, fiscal_period_id, entry_number, entry_date, status, narration)
  SELECT v_id, p_org, f.id, p_number, p_date, 'draft', 'test'
  FROM public.fiscal_periods f WHERE f.organisation_id = p_org;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    i := i + 1;
    INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
    SELECT p_org, v_id, i, a.id, (l->>1)::numeric, (l->>2)::numeric
    FROM public.accounts a WHERE a.organisation_id = p_org AND a.code = l->>0;
  END LOOP;
  IF p_status <> 'draft' THEN
    UPDATE public.journal_entries SET status = p_status::public.journal_entry_status WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION pg_temp.acct(p_org uuid, p_code text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.accounts WHERE organisation_id = p_org AND code = p_code;
$$;
CREATE FUNCTION pg_temp.bank_line(p_entry uuid, p_bank uuid) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.journal_entry_lines WHERE journal_entry_id = p_entry AND account_id = p_bank;
$$;

DO $$
DECLARE
  o1 uuid := '56100000-0000-4000-8000-000000000001';
  o2 uuid := '56100000-0000-4000-8000-000000000002';
  owner uuid := '56000000-0000-4000-8000-0000000000a1';
BEGIN
  INSERT INTO public.organisations (id, name, slug, created_by) VALUES
    (o1, 'Statement Co', 'statement-co', owner),
    (o2, 'Other Statement Co', 'other-statement-co', '56000000-0000-4000-8000-0000000000b1');
  INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
    (o1, owner, 'owner'),
    (o1, '56000000-0000-4000-8000-0000000000a2', 'cfo'),
    (o1, '56000000-0000-4000-8000-0000000000a3', 'admin'),
    (o1, '56000000-0000-4000-8000-0000000000a4', 'accountant'),
    (o1, '56000000-0000-4000-8000-0000000000a5', 'viewer'),
    (o1, '56000000-0000-4000-8000-0000000000a6', 'auditor'),
    (o2, '56000000-0000-4000-8000-0000000000b1', 'owner')
  ON CONFLICT DO NOTHING;
  PERFORM public.seed_default_chart_of_accounts(o1);
  PERFORM public.seed_default_chart_of_accounts(o2);
  INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date) VALUES
    (o1, 'FY 2026-27', '2026-04-01', '2027-03-31'),
    (o2, 'FY 2026-27', '2026-04-01', '2027-03-31');

  -- Company 1, bank 1020, worked by hand:
  --   05 Oct  +10,000.00  posted, matched on the 6th
  --   10 Oct   -2,500.50  posted, the bank clears it on 2 Nov
  --   12 Oct     -300.00  reversed by the entry below, both count until the reversal's date
  --   15 Oct     +300.00  the reversal
  --   20 Oct   -9,999.99  draft, never counts
  --   25 Oct     -100.00  posted to petty cash: another account, never counts
  --   02 Nov     +700.00  posted, the bank showed it on 31 Oct
  PERFORM pg_temp.je(o1, 'RS-1', '2026-10-05', '[["1020",10000,0],["4090",0,10000]]');
  PERFORM pg_temp.je(o1, 'RS-2', '2026-10-10', '[["5090",2500.50,0],["1020",0,2500.50]]');
  PERFORM pg_temp.je(o1, 'RS-3', '2026-10-12', '[["5090",300,0],["1020",0,300]]', 'reversed');
  PERFORM pg_temp.je(o1, 'RS-4', '2026-10-15', '[["1020",300,0],["5090",0,300]]');
  PERFORM pg_temp.je(o1, 'RS-5', '2026-10-20', '[["5090",9999.99,0],["1020",0,9999.99]]', 'draft');
  PERFORM pg_temp.je(o1, 'RS-6', '2026-10-25', '[["5090",100,0],["1010",0,100]]');
  PERFORM pg_temp.je(o1, 'RS-7', '2026-11-02', '[["1020",700,0],["4090",0,700]]');
  -- A company's own money must never show up in another's figures.
  PERFORM pg_temp.je(o2, 'RS-X', '2026-10-05', '[["1020",55555,0],["4090",0,55555]]');
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('56000000-0000-4000-8000-0000000000a1');

DO $$
DECLARE
  o1 uuid := '56100000-0000-4000-8000-000000000001';
  bank uuid := pg_temp.acct(o1, '1020');
  p jsonb;
BEGIN
  INSERT INTO public.bank_reconciliations (organisation_id, bank_account_id, statement_date, statement_amount, journal_entry_line_id)
  SELECT o1, bank, '2026-10-06', 10000, l.id FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE e.organisation_id = o1 AND e.entry_number = 'RS-1' AND l.account_id = bank;
  INSERT INTO public.bank_reconciliations (organisation_id, bank_account_id, statement_date, statement_amount, journal_entry_line_id)
  SELECT o1, bank, '2026-11-02', -2500.50, l.id FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE e.organisation_id = o1 AND e.entry_number = 'RS-2' AND l.account_id = bank;
  INSERT INTO public.bank_reconciliations (organisation_id, bank_account_id, statement_date, statement_amount, journal_entry_line_id)
  SELECT o1, bank, '2026-10-31', 700, l.id FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE e.organisation_id = o1 AND e.entry_number = 'RS-7' AND l.account_id = bank;

  -- Before anything: zero, not an error.
  p := public.bank_reconciliation_position(o1, bank, '2026-10-01');
  ASSERT (p->>'book_balance')::numeric = 0 AND (p->>'matched_amount')::numeric = 0 AND (p->>'uncleared_amount')::numeric = 0, p::text;

  -- 13 Oct: +10,000 - 2,500.50 - 300 (the reversal is still in the future). The draft isn't due yet.
  p := public.bank_reconciliation_position(o1, bank, '2026-10-13');
  ASSERT (p->>'book_balance')::numeric = 7199.50, 'reversed entry not counted before its reversal: ' || p::text;

  -- 31 Oct: the reversal nets out, the draft and petty cash stay out; the 2 Nov voucher isn't in the books yet.
  p := public.bank_reconciliation_position(o1, bank, '2026-10-31');
  ASSERT (p->>'book_balance')::numeric = 7499.50, 'book balance wrong (a draft would make it -2500.49): ' || p::text;
  -- +10,000 cleared on the 6th, +700 shown by the bank on the 31st.
  ASSERT (p->>'matched_amount')::numeric = 10700, p::text;
  -- -2,500.50 not cleared until November, -300 and +300.
  ASSERT (p->>'uncleared_amount')::numeric = -2500.50, p::text;

  -- 2 Nov: the cheque clears, the receipt reaches the books.
  p := public.bank_reconciliation_position(o1, bank, '2026-11-02');
  ASSERT (p->>'book_balance')::numeric = 8199.50 AND (p->>'matched_amount')::numeric = 8199.50 AND (p->>'uncleared_amount')::numeric = 0, p::text;

  BEGIN
    PERFORM public.bank_reconciliation_position(o1, pg_temp.acct(o1, '5090'), '2026-10-31');
    RAISE EXCEPTION 'expense account accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'The bank account is not%', SQLERRM;
  END;
END $$;

-- Recording: the database's figures replace whatever the caller sent.
DO $$
DECLARE
  o1 uuid := '56100000-0000-4000-8000-000000000001';
  bank uuid := pg_temp.acct(o1, '1020');
  s public.reconciliation_statements;
BEGIN
  -- Bank says 10,700 = 10,000 + 700 matched: nothing unexplained, though it is 3,200.50 above the books.
  INSERT INTO public.reconciliation_statements (
    organisation_id, bank_account_id, statement_date, closing_balance,
    book_balance, matched_amount, uncleared_amount, difference, unexplained_difference, recorded_by, recorded_at, recorded_by_name
  ) VALUES (o1, bank, '2026-10-31', 10700, 1, 2, 3, 4, 5, '56000000-0000-4000-8000-0000000000a2', '2000-01-01', 'Someone else')
  RETURNING * INTO s;
  ASSERT s.book_balance = 7499.50, 'caller set the book balance';
  ASSERT s.matched_amount = 10700 AND s.uncleared_amount = -2500.50, 'caller set the matched figures';
  ASSERT s.difference = 3200.50 AND s.unexplained_difference = 0, s::text;
  ASSERT s.recorded_by = '56000000-0000-4000-8000-0000000000a1', 'caller set who';
  ASSERT s.recorded_by_name = 'Name of rs-owner@test.local', s.recorded_by_name;
  ASSERT s.recorded_at > '2020-01-01', 'caller set when';
  ASSERT s.accepted_difference IS NULL, 'nothing to accept';

  -- One record per account and date.
  BEGIN
    INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance)
    VALUES (o1, bank, '2026-10-31', 10700);
    RAISE EXCEPTION 'recorded twice';
  EXCEPTION WHEN unique_violation THEN
    ASSERT SQLERRM LIKE '%uk_reconciliation_statements_date%', SQLERRM;
  END;

  -- 13 Oct: matched is +10,000, and a 500 bank charge is on the statement but not in the books.
  INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance, statement_only_amount)
  VALUES (o1, bank, '2026-10-13', 9500, -500) RETURNING * INTO s;
  ASSERT s.unexplained_difference = 0 AND s.difference = 2300.50 AND s.accepted_difference IS NULL, s::text;

  -- A difference nobody can explain needs accepting, at exactly the amount.
  BEGIN
    INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance)
    VALUES (o1, bank, '2026-10-20', 10000.01);
    RAISE EXCEPTION 'unexplained difference recorded without acceptance';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'difference_not_accepted: 0.01%', SQLERRM;
  END;
  BEGIN
    INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance, accepted_difference)
    VALUES (o1, bank, '2026-10-20', 10000.01, 0.02);
    RAISE EXCEPTION 'a different amount was accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'difference_not_accepted%', SQLERRM;
  END;
  INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance, accepted_difference)
  VALUES (o1, bank, '2026-10-20', 10000.01, 0.01) RETURNING * INTO s;
  ASSERT s.unexplained_difference = 0.01 AND s.accepted_difference = 0.01, s::text;
END $$;

-- Immutable: under RLS an update or delete touches nothing.
DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.reconciliation_statements SET closing_balance = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'a member updated a record';
  DELETE FROM public.reconciliation_statements;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'a member deleted a record';
END $$;

-- And the trigger holds with RLS out of the way.
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.reconciliation_statements SET closing_balance = 1;
    RAISE EXCEPTION 'updated as table owner';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'A completed reconciliation%', SQLERRM;
  END;
  BEGIN
    DELETE FROM public.reconciliation_statements;
    RAISE EXCEPTION 'deleted as table owner';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'A completed reconciliation%', SQLERRM;
  END;
  ASSERT (SELECT count(*) FROM public.reconciliation_statements WHERE closing_balance = 10700) = 1, 'record changed';
END $$;
SET LOCAL ROLE authenticated;

-- Roles: owner, CFO, admin and accountant write; other members only read.
-- Before the 6th nothing is matched, so a closing balance of zero leaves nothing unexplained.
SELECT pg_temp.as_user('56000000-0000-4000-8000-0000000000a2');
INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance)
VALUES ('56100000-0000-4000-8000-000000000001', pg_temp.acct('56100000-0000-4000-8000-000000000001', '1020'), '2026-10-01', 0);
SELECT pg_temp.as_user('56000000-0000-4000-8000-0000000000a3');
INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance)
VALUES ('56100000-0000-4000-8000-000000000001', pg_temp.acct('56100000-0000-4000-8000-000000000001', '1020'), '2026-10-02', 0);
SELECT pg_temp.as_user('56000000-0000-4000-8000-0000000000a4');
INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance)
VALUES ('56100000-0000-4000-8000-000000000001', pg_temp.acct('56100000-0000-4000-8000-000000000001', '1020'), '2026-10-03', 0);

DO $$
DECLARE
  o1 uuid := '56100000-0000-4000-8000-000000000001';
  who uuid;
BEGIN
  ASSERT (SELECT recorded_by_name FROM public.reconciliation_statements WHERE statement_date = '2026-10-03') = 'Name of rs-accountant@test.local', 'who not recorded';
  FOREACH who IN ARRAY ARRAY['56000000-0000-4000-8000-0000000000a5', '56000000-0000-4000-8000-0000000000a6']::uuid[] LOOP
    PERFORM pg_temp.as_user(who);
    ASSERT (SELECT count(*) FROM public.reconciliation_statements) = 6, 'a member can''t read the list';
    ASSERT (public.bank_reconciliation_position(o1, pg_temp.acct(o1, '1020'), '2026-10-31')->>'book_balance')::numeric = 7499.50, 'a member can''t read the position';
    BEGIN
      INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance)
      VALUES (o1, pg_temp.acct(o1, '1020'), '2026-10-04', 0);
      RAISE EXCEPTION 'read-only member recorded a statement';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  -- Regression: migration 52 let a CFO confirm a match but the undo silently matched no rows.
  PERFORM pg_temp.as_user('56000000-0000-4000-8000-0000000000a5');
  DELETE FROM public.bank_reconciliations WHERE statement_amount = 700;
  ASSERT (SELECT count(*) FROM public.bank_reconciliations WHERE statement_amount = 700) = 1, 'a viewer undid a match';
  PERFORM pg_temp.as_user('56000000-0000-4000-8000-0000000000a2');
  DELETE FROM public.bank_reconciliations WHERE statement_amount = 700;
  ASSERT (SELECT count(*) FROM public.bank_reconciliations WHERE statement_amount = 700) = 0, 'a CFO can''t undo a match';
  -- The record is a snapshot: undoing a match later doesn't rewrite it.
  ASSERT (SELECT matched_amount FROM public.reconciliation_statements WHERE closing_balance = 10700) = 10700, 'record moved';
  ASSERT (public.bank_reconciliation_position(o1, pg_temp.acct(o1, '1020'), '2026-10-31')->>'matched_amount')::numeric = 10000, 'position kept the undone match';
END $$;

-- Across companies: nothing to see, nothing to record, and no borrowing another company's account.
SELECT pg_temp.as_user('56000000-0000-4000-8000-0000000000b1');
DO $$
DECLARE
  o1 uuid := '56100000-0000-4000-8000-000000000001';
  o2 uuid := '56100000-0000-4000-8000-000000000002';
  bank1 uuid;
  bank2 uuid := pg_temp.acct(o2, '1020');
BEGIN
  ASSERT (SELECT count(*) FROM public.reconciliation_statements) = 0, 'another company''s records are visible';
  ASSERT (public.bank_reconciliation_position(o2, bank2, '2026-10-31')->>'book_balance')::numeric = 55555, 'own figures wrong';

  RESET ROLE;
  bank1 := pg_temp.acct(o1, '1020');
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.bank_reconciliation_position(o1, bank1, '2026-10-31');
    RAISE EXCEPTION 'read another company''s position';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Permission denied%', SQLERRM;
  END;
  BEGIN
    INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance, accepted_difference)
    VALUES (o1, bank1, '2026-09-30', 0, 0);
    RAISE EXCEPTION 'recorded into another company';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Permission denied%', SQLERRM;
  END;
  -- Own company, the other company's account.
  BEGIN
    PERFORM public.bank_reconciliation_position(o2, bank1, '2026-10-31');
    RAISE EXCEPTION 'read through another company''s account';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'The bank account is not%', SQLERRM;
  END;
  BEGIN
    INSERT INTO public.reconciliation_statements (organisation_id, bank_account_id, statement_date, closing_balance)
    VALUES (o2, bank1, '2026-10-31', 0);
    RAISE EXCEPTION 'recorded against another company''s account';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'The bank account is not%', SQLERRM;
  END;
END $$;

RESET ROLE;
DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.bank_reconciliation_position(uuid, uuid, date)', 'EXECUTE'), 'anon can read the position';
  ASSERT NOT has_function_privilege('anon', 'public.guard_reconciliation_statement()', 'EXECUTE'), 'anon can run the guard';
  ASSERT NOT has_function_privilege('authenticated', 'public.guard_reconciliation_statement()', 'EXECUTE'), 'guard exposed';
  ASSERT has_function_privilege('authenticated', 'public.bank_reconciliation_position(uuid, uuid, date)', 'EXECUTE'), 'members can''t read the position';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname IN ('bank_reconciliation_position', 'guard_reconciliation_statement')
      AND NOT coalesce(proconfig, '{}') @> ARRAY['search_path=public']
  ), 'search_path not set';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reconciliation_statements'::regclass), 'RLS off';
  RAISE NOTICE 'reconciliation_statements_test passed';
END $$;

ROLLBACK;
