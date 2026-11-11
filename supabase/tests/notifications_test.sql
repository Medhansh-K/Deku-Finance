-- Migration 34: generate_notifications is idempotent, filed returns suppress reminders, RLS keeps
-- organisations apart and a user can only mark their own reads. Dates are relative to today, so
-- the compliance calendar is moved (inside this rolled-back transaction) to put a due date 1-5
-- days ahead. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('34000000-0000-4000-8000-0000000000a1', 'ntf-owner@test.local'),
  ('34000000-0000-4000-8000-0000000000a2', 'ntf-viewer@test.local'),
  ('34000000-0000-4000-8000-0000000000a3', 'ntf-accountant@test.local'),
  ('34000000-0000-4000-8000-0000000000b1', 'ntf-other-owner@test.local');
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, email FROM auth.users WHERE email LIKE 'ntf-%@test.local'
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.today() RETURNS date LANGUAGE sql AS
  $$ SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date $$;

-- Nearest day 1-5 ahead whose day of month exists in every month (calendar due_day <= 28).
CREATE FUNCTION pg_temp.target() RETURNS date LANGUAGE sql AS $$
  SELECT min(pg_temp.today() + k) FROM generate_series(1, 5) k
  WHERE extract(day FROM pg_temp.today() + k) <= 28
$$;

CREATE FUNCTION pg_temp.ret_period() RETURNS text LANGUAGE sql AS
  $$ SELECT to_char(date_trunc('month', pg_temp.target()) - interval '1 month', 'MMYYYY') $$;

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

DO $$
DECLARE
  o1 uuid := '34100000-0000-4000-8000-000000000001';
  o2 uuid := '34100000-0000-4000-8000-000000000002';
  c uuid := '34c00000-0000-4000-8000-000000000001';
  t date := pg_temp.today();
  fp1 uuid;
  fp2 uuid;
  je_ar uuid := gen_random_uuid();
  je_rc uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.organisations (id, name, slug, created_by, operating_mode) VALUES
    (o1, 'Notify GST Co', 'notify-gst-co', '34000000-0000-4000-8000-0000000000a1', 'gst'),
    (o2, 'Notify Pure Co', 'notify-pure-co', '34000000-0000-4000-8000-0000000000b1', 'pure');
  INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
    (o1, '34000000-0000-4000-8000-0000000000a1', 'owner'),
    (o1, '34000000-0000-4000-8000-0000000000a2', 'viewer'),
    (o1, '34000000-0000-4000-8000-0000000000a3', 'accountant'),
    (o2, '34000000-0000-4000-8000-0000000000b1', 'owner')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;

  -- Periods end in 5 days, so both companies get a period-ending reminder.
  INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status)
  VALUES (o1, 'Test period', t - 90, t + 5, 'open') RETURNING id INTO fp1;
  INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status)
  VALUES (o2, 'Test period', t - 90, t + 5, 'open') RETURNING id INTO fp2;

  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, label) VALUES
    (o1, '1020', 'Operating Bank Account', 'asset', 'asset', 'Bank'),
    (o1, '1030', 'Accounts Receivable (Customer Trade Debtors)', 'asset', 'asset', 'Debtors'),
    (o1, '4010', 'Sales Revenue', 'income', 'revenue', 'Sales');
  INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name)
  VALUES (c, o1, 'customer', 'Customer One', 'C One');

  -- Invoice of 1000 booked 40 days ago, due 10 days ago, 400 received: 600 is overdue.
  INSERT INTO public.journal_entries (id, organisation_id, fiscal_period_id, entry_number, entry_date, status, narration) VALUES
    (je_ar, o1, fp1, 'JRN-0001', t - 40, 'draft', 'invoice'),
    (je_rc, o1, fp1, 'JRN-0002', t - 5, 'draft', 'receipt');
  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, party_id, debit, credit)
  SELECT o1, je_ar, 1, id, c, 1000, 0 FROM public.accounts WHERE organisation_id = o1 AND code = '1030'
  UNION ALL SELECT o1, je_ar, 2, id, NULL, 0, 1000 FROM public.accounts WHERE organisation_id = o1 AND code = '4010'
  UNION ALL SELECT o1, je_rc, 1, id, NULL, 400, 0 FROM public.accounts WHERE organisation_id = o1 AND code = '1020'
  UNION ALL SELECT o1, je_rc, 2, id, c, 0, 400 FROM public.accounts WHERE organisation_id = o1 AND code = '1030';
  UPDATE public.journal_entries SET status = 'posted' WHERE id IN (je_ar, je_rc);
  INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, status, place_of_supply, total_amount, journal_entry_id)
  VALUES (o1, c, 'INV-34-1', t - 40, t - 10, 'issued', '27', 1000, je_ar);

  -- Vouchers waiting for approval: one for 25 hours (reminded), one for 2 hours (not yet).
  INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, submitted_at) VALUES
    (o1, fp1, 'JRN-0003', t, 'draft', 'old', now() - interval '25 hours'),
    (o1, fp1, 'JRN-0004', t, 'draft', 'fresh', now() - interval '2 hours'),
    (o2, fp2, 'JRN-0001', t, 'draft', 'old', now() - interval '30 hours');

  -- Both returns due on the target day; GSTR-1 for that period is already filed.
  UPDATE public.compliance_calendar SET due_day = extract(day FROM pg_temp.target());
  PERFORM pg_temp.as_user('34000000-0000-4000-8000-0000000000a1');
  INSERT INTO public.gst_return_filings (organisation_id, ret_period, return_type, json, summary)
  VALUES (o1, pg_temp.ret_period(), 'GSTR1', '{}', '{}');
  UPDATE public.gst_return_filings SET status = 'filed', filed_arn = 'AA2710260000001'
  WHERE organisation_id = o1 AND return_type = 'GSTR1';
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- Generation (as the backend's service token)
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE
  o1 uuid := '34100000-0000-4000-8000-000000000001';
  o2 uuid := '34100000-0000-4000-8000-000000000002';
  n int;
  v_lead int := CASE WHEN pg_temp.target() - pg_temp.today() = 1 THEN 1 ELSE 5 END;
BEGIN
  n := public.generate_notifications();
  ASSERT (SELECT count(*) FROM public.notifications WHERE organisation_id = o1) = 4,
    format('org 1 should get 4 notifications, got %s', (SELECT string_agg(dedupe_key, ', ') FROM public.notifications WHERE organisation_id = o1));
  ASSERT (SELECT count(*) FROM public.notifications WHERE organisation_id = o2) = 2, 'org 2 should get approval + period';
  ASSERT n >= 6, 'generate_notifications should report what it inserted';

  -- Idempotent: a second run inserts nothing.
  ASSERT public.generate_notifications() = 0, 'second run inserted notifications';
  ASSERT public.generate_notifications(o1) = 0, 'single-org run inserted notifications';

  -- Filed GSTR-1 suppresses its reminder; GSTR-3B for the same period is reminded once.
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE organisation_id = o1 AND payload->>'return_type' = 'GSTR1'),
    'filed GSTR-1 was reminded';
  ASSERT (SELECT dedupe_key FROM public.notifications WHERE organisation_id = o1 AND kind = 'gst_due')
    = 'gst_due:GSTR3B:' || pg_temp.ret_period() || ':' || v_lead, 'GSTR-3B reminder missing or wrong lead';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE organisation_id = o2 AND kind = 'gst_due'),
    'non-GST company got a GST reminder';

  ASSERT (SELECT (payload->>'open')::numeric FROM public.notifications WHERE organisation_id = o1 AND kind = 'invoice_overdue') = 600,
    'overdue invoice should carry the open balance';
  ASSERT (SELECT count(*) FROM public.notifications WHERE organisation_id = o1 AND kind = 'approval_waiting') = 1,
    'only the voucher waiting > 24h is reminded';
  ASSERT current_setting('request.jwt.claim.sub', true) = '', 'job identity leaked after reading the ledger';
END $$;
RESET ROLE;

-- A personal notification for the owner only.
INSERT INTO public.notifications (organisation_id, user_id, kind, title, dedupe_key)
VALUES ('34100000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-0000000000a1', 'gst_due', 'Personal', 'personal-test');
-- Read here: RLS hides it from most of the users below.
SELECT set_config('test.personal_id', id::text, true) FROM public.notifications WHERE dedupe_key = 'personal-test';

-- ---------------------------------------------------------------------------------------------
-- RLS and reads
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  o1 uuid := '34100000-0000-4000-8000-000000000001';
  o2 uuid := '34100000-0000-4000-8000-000000000002';
  v_personal uuid := current_setting('test.personal_id')::uuid;
  v_all uuid[];
BEGIN
  -- Other company's owner sees only their own company.
  PERFORM pg_temp.as_user('34000000-0000-4000-8000-0000000000b1');
  ASSERT (SELECT count(*) FROM public.notifications) = 2, 'org 2 owner sees another company''s notifications';
  ASSERT (SELECT count(*) FROM public.list_notifications(o1)) = 0, 'list_notifications leaks across companies';
  ASSERT public.mark_notifications_read((SELECT array_agg(id) FROM public.list_notifications(o2))) = 2, 'org 2 owner cannot mark own';

  -- Viewer isn't in the finance audience and doesn't see the owner's personal row.
  PERFORM pg_temp.as_user('34000000-0000-4000-8000-0000000000a2');
  ASSERT (SELECT count(*) FROM public.notifications) = 0, 'viewer sees finance-only notifications';

  -- Accountant sees the 3 finance rows (approvals go to approvers only), not the owner's personal one.
  PERFORM pg_temp.as_user('34000000-0000-4000-8000-0000000000a3');
  ASSERT (SELECT count(*) FROM public.list_notifications(o1, true)) = 3, 'accountant should see 3 unread';
  ASSERT public.mark_notifications_read(ARRAY[v_personal]) = 0, 'accountant marked the owner''s notification';
  BEGIN
    INSERT INTO public.notification_reads (notification_id, user_id) VALUES (v_personal, '34000000-0000-4000-8000-0000000000a1');
    RAISE EXCEPTION 'accountant inserted a read for another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.notifications SET read_at = now() WHERE id = v_personal;
    RAISE EXCEPTION 'accountant updated a notification directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_all := (SELECT array_agg(id) FROM public.list_notifications(o1));
  ASSERT public.mark_notifications_read(v_all) = 3, 'accountant should mark 3 read';
  ASSERT public.mark_notifications_read(v_all) = 0, 'marking twice should be a no-op';
  ASSERT (SELECT count(*) FROM public.list_notifications(o1, true)) = 0, 'accountant still has unread';

  -- The owner's reads are separate: 4 org-wide + 1 personal still unread.
  PERFORM pg_temp.as_user('34000000-0000-4000-8000-0000000000a1');
  ASSERT (SELECT count(*) FROM public.list_notifications(o1, true)) = 5, 'owner should still have 5 unread';
  ASSERT (SELECT count(*) FROM public.notification_reads) = 0, 'owner sees the accountant''s reads';
  ASSERT public.mark_notifications_read(ARRAY[v_personal]) = 1, 'owner cannot mark own personal notification';
  ASSERT (SELECT read_at IS NOT NULL FROM public.list_notifications(o1) WHERE id = v_personal), 'personal read_at not set';
  -- Unread rows sort first.
  ASSERT (SELECT read_at IS NULL FROM public.list_notifications(o1) LIMIT 1), 'unread notifications should come first';

  -- The scheduler function is not callable by users.
  BEGIN
    PERFORM public.generate_notifications();
    RAISE EXCEPTION 'authenticated user ran generate_notifications';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.generate_notifications(uuid)', 'EXECUTE'), 'anon can generate';
  ASSERT NOT has_function_privilege('authenticated', 'public.generate_notifications(uuid)', 'EXECUTE'), 'authenticated can generate';
  ASSERT has_function_privilege('service_role', 'public.generate_notifications(uuid)', 'EXECUTE'), 'service_role cannot generate';
  ASSERT NOT has_function_privilege('anon', 'public.mark_notifications_read(uuid[])', 'EXECUTE'), 'anon can mark read';
  ASSERT NOT has_function_privilege('anon', 'public.list_notifications(uuid, boolean, integer)', 'EXECUTE'), 'anon can list';
  RAISE WARNING 'notifications_test passed';
END $$;

ROLLBACK;
