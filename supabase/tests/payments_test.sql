-- Migration 36: Razorpay tokens are unreadable by signed-in users, OAuth states are one-time and
-- bound to their creator, payments are recorded once with a balanced receipt voucher (or submitted
-- for approval under maker-checker), and RLS keeps companies apart. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('36000000-0000-4000-8000-0000000000a1', 'pay-owner@test.local'),
  ('36000000-0000-4000-8000-0000000000a2', 'pay-viewer@test.local'),
  ('36000000-0000-4000-8000-0000000000a3', 'pay-accountant@test.local'),
  ('36000000-0000-4000-8000-0000000000a4', 'pay-cfo@test.local'),
  ('36000000-0000-4000-8000-0000000000b1', 'pay-other-owner@test.local');
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, email FROM auth.users WHERE email LIKE 'pay-%@test.local'
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

DO $$
DECLARE
  o1 uuid := '36100000-0000-4000-8000-000000000001';
  o2 uuid := '36100000-0000-4000-8000-000000000002';
  t date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  INSERT INTO public.organisations (id, name, slug, created_by, state_code) VALUES
    (o1, 'Pay Co', 'pay-co', '36000000-0000-4000-8000-0000000000a1', '27'),
    (o2, 'Other Pay Co', 'other-pay-co', '36000000-0000-4000-8000-0000000000b1', NULL);
  INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
    (o1, '36000000-0000-4000-8000-0000000000a1', 'owner'),
    (o1, '36000000-0000-4000-8000-0000000000a2', 'viewer'),
    (o1, '36000000-0000-4000-8000-0000000000a3', 'accountant'),
    (o1, '36000000-0000-4000-8000-0000000000a4', 'cfo'),
    (o2, '36000000-0000-4000-8000-0000000000b1', 'owner')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;

  PERFORM public.seed_default_chart_of_accounts(o1);
  PERFORM public.seed_default_chart_of_accounts(o2);
  ASSERT (SELECT count(*) FROM public.accounts WHERE code = '1025' AND organisation_id IN (o1, o2)) = 2,
    'seeding the default chart should add the Razorpay clearing account';

  INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status) VALUES
    (o1, 'Test period', t - 30, t + 30, 'open'),
    (o2, 'Test period', t - 30, t + 30, 'open');
  INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name, email, phone) VALUES
    ('36c00000-0000-4000-8000-000000000001', o1, 'customer', 'Asha Traders', 'Asha', 'asha@example.com', NULL),
    ('36c00000-0000-4000-8000-000000000002', o2, 'customer', 'Other Buyer', 'Other', NULL, NULL);
  INSERT INTO public.sales_invoices (id, organisation_id, customer_id, invoice_number, invoice_date, due_date, status, place_of_supply, total_amount) VALUES
    ('36e00000-0000-4000-8000-000000000001', o1, '36c00000-0000-4000-8000-000000000001', 'INV-36-1', t, t + 15, 'issued', '27', 1180),
    ('36e00000-0000-4000-8000-000000000002', o1, '36c00000-0000-4000-8000-000000000001', 'INV-36-2', t, t + 15, 'draft', '27', 500),
    ('36e00000-0000-4000-8000-000000000003', o2, '36c00000-0000-4000-8000-000000000002', 'INV-36-3', t, t + 15, 'issued', '27', 2000);
  UPDATE public.organisations SET require_journal_approval = true WHERE id = o2;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Backend (service token): store connections
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.store_payment_connection('36100000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-0000000000a1',
  'acc_O1', 'enc-access-1', 'enc-refresh-1', 'rzp_test_oauth_pub1', now() + interval '90 days', 'test');
SELECT public.store_payment_connection('36100000-0000-4000-8000-000000000002', '36000000-0000-4000-8000-0000000000b1',
  'acc_O2', 'enc-access-2', 'enc-refresh-2', NULL, now() + interval '90 days', 'live');
DO $$
BEGIN
  ASSERT (SELECT access_token_enc FROM public.payment_connection_secrets('36100000-0000-4000-8000-000000000001')) = 'enc-access-1',
    'service_role should read the encrypted token back';
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------------------------------
-- Signed-in users: tokens, OAuth states, links, RLS
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  o1 uuid := '36100000-0000-4000-8000-000000000001';
  o2 uuid := '36100000-0000-4000-8000-000000000002';
  st text := repeat('s', 40);
  v jsonb;
  denied boolean;
BEGIN
  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000a1');
  ASSERT (SELECT status FROM public.payment_connections WHERE organisation_id = o1) = 'connected', 'owner sees the connection';
  ASSERT NOT EXISTS (SELECT 1 FROM public.payment_connections WHERE organisation_id = o2), 'RLS: other company connection visible';

  denied := false;
  BEGIN
    PERFORM access_token_enc FROM public.payment_connections;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated could read access_token_enc';
  denied := false;
  BEGIN
    PERFORM refresh_token_enc FROM public.payment_connections;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated could read refresh_token_enc';
  denied := false;
  BEGIN
    PERFORM * FROM public.payment_connection_secrets(o1);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated could call payment_connection_secrets';
  denied := false;
  BEGIN
    PERFORM public.record_gateway_payment('acc_O1', 'pay_forged', NULL, NULL, 'INV-36-1', 100, 0, 0, 'upi', now());
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated could record a gateway payment';
  denied := false;
  BEGIN
    UPDATE public.payment_connections SET status = 'revoked' WHERE organisation_id = o1;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated could update a connection';

  -- OAuth state: owner may start, viewer may not; only the creator consumes it, once.
  INSERT INTO public.oauth_states (state, organisation_id, mode) VALUES (st, o1, 'test');
  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000a2');
  denied := false;
  BEGIN
    INSERT INTO public.oauth_states (state, organisation_id) VALUES (repeat('v', 40), o1);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'viewer could start a Razorpay connection';
  ASSERT NOT EXISTS (SELECT 1 FROM public.consume_payment_oauth_state(st)), 'another user consumed the state';
  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000a1');
  ASSERT (SELECT organisation_id FROM public.consume_payment_oauth_state(st)) = o1, 'creator could not consume the state';
  ASSERT NOT EXISTS (SELECT 1 FROM public.consume_payment_oauth_state(st)), 'state was consumed twice';

  -- Expired states are refused.
  INSERT INTO public.oauth_states (state, organisation_id, created_at, expires_at)
  VALUES (repeat('x', 40), o1, now() - interval '20 minutes', now() - interval '10 minutes');
  ASSERT NOT EXISTS (SELECT 1 FROM public.consume_payment_oauth_state(repeat('x', 40))), 'expired state accepted';

  -- Link data: only present contact fields, issued invoices only, no viewer access.
  v := public.payment_link_invoice(o1, '36e00000-0000-4000-8000-000000000001');
  ASSERT (v->>'amount_paise')::bigint = 118000, 'amount should be the invoice total in paise';
  ASSERT v->>'customer_email' = 'asha@example.com' AND v->'customer_phone' = 'null'::jsonb, 'contact fields wrong';
  denied := false;
  BEGIN
    PERFORM public.payment_link_invoice(o1, '36e00000-0000-4000-8000-000000000002');
  EXCEPTION WHEN raise_exception THEN denied := true;
  END;
  ASSERT denied, 'draft invoice got a payment link';

  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000a3');
  INSERT INTO public.invoice_payment_links (organisation_id, invoice_id, link_id, short_url, amount_paise)
  VALUES (o1, '36e00000-0000-4000-8000-000000000001', 'plink_O1', 'https://rzp.io/i/abc', 118000);
  ASSERT (public.payment_link_invoice(o1, '36e00000-0000-4000-8000-000000000001')->'existing_link'->>'link_id') = 'plink_O1',
    'existing link not returned';

  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000a2');
  denied := false;
  BEGIN
    PERFORM public.payment_link_invoice(o1, '36e00000-0000-4000-8000-000000000001');
  EXCEPTION WHEN raise_exception THEN denied := true;
  END;
  ASSERT denied, 'viewer got payment link data';
  ASSERT (SELECT count(*) FROM public.invoice_payment_links WHERE organisation_id = o1) = 1, 'viewer should still see links';

  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000b1');
  ASSERT NOT EXISTS (SELECT 1 FROM public.invoice_payment_links WHERE organisation_id = o1), 'RLS: other company link visible';
  denied := false;
  BEGIN
    INSERT INTO public.invoice_payment_links (organisation_id, invoice_id, link_id, short_url, amount_paise)
    VALUES (o1, '36e00000-0000-4000-8000-000000000001', 'plink_evil', 'https://rzp.io/i/evil', 100);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'outsider created a link';
  INSERT INTO public.invoice_payment_links (organisation_id, invoice_id, link_id, short_url, amount_paise)
  VALUES (o2, '36e00000-0000-4000-8000-000000000003', 'plink_O2', 'https://rzp.io/i/o2', 200000);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------------------------------
-- Webhook (service token): record payments
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE
  o1 uuid := '36100000-0000-4000-8000-000000000001';
  o2 uuid := '36100000-0000-4000-8000-000000000002';
  r jsonb;
  r2 jsonb;
  je public.journal_entries;
BEGIN
  -- 1180.00 paid, fee 23.60 = 20.00 + 3.60 GST: clearing gets 1156.40.
  r := public.record_gateway_payment('acc_O1', 'pay_A', 'plink_O1', NULL, NULL, 118000, 2000, 360, 'upi', now(), '{"id":"pay_A"}');
  ASSERT r->>'status' = 'recorded' AND r->>'journal_status' = 'posted', format('first record: %s', r);

  r2 := public.record_gateway_payment('acc_O1', 'pay_A', 'plink_O1', NULL, NULL, 118000, 2000, 360, 'upi', now(), '{}');
  ASSERT r2->>'status' = 'duplicate', 'second delivery should be a duplicate';
  ASSERT (SELECT count(*) FROM public.gateway_payments WHERE payment_id = 'pay_A') = 1, 'payment stored twice';
  ASSERT (SELECT count(*) FROM public.journal_entries WHERE organisation_id = o1 AND entry_number = 'RZP-pay_A') = 1, 'voucher booked twice';

  SELECT * INTO je FROM public.journal_entries WHERE id = (r->>'journal_entry_id')::uuid;
  ASSERT je.status = 'posted', 'voucher should be posted';
  ASSERT (SELECT sum(debit) = sum(credit) AND sum(debit) = 1180 FROM public.journal_entry_lines WHERE journal_entry_id = je.id),
    'voucher unbalanced';
  ASSERT (SELECT l.debit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = je.id AND a.code = '1025') = 1156.40, 'clearing amount wrong';
  ASSERT (SELECT l.debit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = je.id AND a.code = '5090') = 20.00, 'bank charges wrong';
  -- Maharashtra company: IGST on Razorpay's fee.
  ASSERT (SELECT l.debit FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = je.id AND a.code = '1083') = 3.60, 'input GST wrong';
  ASSERT (SELECT l.party_id FROM public.journal_entry_lines l JOIN public.accounts a ON a.id = l.account_id
          WHERE l.journal_entry_id = je.id AND a.code = '1030' AND l.credit = 1180) = '36c00000-0000-4000-8000-000000000001',
    'debtors credit should carry the customer';
  ASSERT (SELECT status FROM public.invoice_payment_links WHERE link_id = 'plink_O1') = 'paid', 'link not marked paid';

  -- payment.captured without a link: matched by account + invoice number (a partial payment here).
  r := public.record_gateway_payment('acc_O1', 'pay_B', NULL, NULL, 'INV-36-1', 10000, 0, 0, 'card', now());
  ASSERT r->>'status' = 'recorded', format('invoice-number match: %s', r);
  ASSERT (SELECT count(*) FROM public.journal_entry_lines WHERE journal_entry_id = (r->>'journal_entry_id')::uuid) = 2,
    'zero fee should give two lines';

  -- Unknown account, or a link of another company claimed by this account: acknowledged, not booked.
  ASSERT public.record_gateway_payment('acc_nobody', 'pay_C', NULL, NULL, 'INV-36-1', 100, 0, 0, 'upi', now())->>'status' = 'unmatched',
    'unknown account should be unmatched';
  ASSERT public.record_gateway_payment('acc_O1', 'pay_D', 'plink_O2', NULL, NULL, 100, 0, 0, 'upi', now())->>'status' = 'unmatched',
    'cross-company link should be unmatched';
  ASSERT NOT EXISTS (SELECT 1 FROM public.gateway_payments WHERE payment_id IN ('pay_C', 'pay_D')), 'unmatched payment stored';

  -- Bad split is refused.
  BEGIN
    PERFORM public.record_gateway_payment('acc_O1', 'pay_E', NULL, NULL, 'INV-36-1', 100, 90, 20, 'upi', now());
    RAISE EXCEPTION 'fee above amount accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'fee above amount accepted' THEN RAISE; END IF;
  END;

  -- Maker-checker company: the voucher waits for approval instead of posting.
  r := public.record_gateway_payment('acc_O2', 'pay_F', 'plink_O2', NULL, NULL, 200000, 4000, 720, 'netbanking', now());
  SELECT * INTO je FROM public.journal_entries WHERE id = (r->>'journal_entry_id')::uuid;
  ASSERT r->>'journal_status' = 'pending_approval' AND je.status = 'draft' AND je.submitted_at IS NOT NULL,
    format('maker-checker path: %s', r);
  PERFORM set_config('test.pending_entry', je.id::text, true);

  -- No open period: the payment is kept with the reason, no voucher.
  UPDATE public.fiscal_periods SET status = 'closed' WHERE organisation_id = o1;
  r := public.record_gateway_payment('acc_O1', 'pay_G', NULL, '36e00000-0000-4000-8000-000000000001', NULL, 5000, 0, 0, 'upi', now());
  ASSERT r->>'status' = 'recorded' AND r->>'journal_entry_id' IS NULL
    AND (SELECT journal_error FROM public.gateway_payments WHERE payment_id = 'pay_G') LIKE 'No open fiscal period%',
    format('closed period: %s', r);
  UPDATE public.fiscal_periods SET status = 'open' WHERE organisation_id = o1;

  -- Revocation webhook clears the tokens.
  ASSERT public.revoke_razorpay_account('acc_O1') = 1, 'revoke should hit one connection';
  ASSERT (SELECT status = 'revoked' AND access_token_enc IS NULL FROM public.payment_connection_secrets(o1)), 'tokens kept after revoke';
END $$;
RESET ROLE;

-- The other company's owner approves the system-made voucher; members see their payments only.
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  o2 uuid := '36100000-0000-4000-8000-000000000002';
BEGIN
  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000b1');
  PERFORM public.post_journal_entry(o2, current_setting('test.pending_entry')::uuid);
  ASSERT (SELECT status FROM public.journal_entries WHERE id = current_setting('test.pending_entry')::uuid) = 'posted',
    'approver could not post the gateway voucher';
  ASSERT (SELECT count(*) FROM public.gateway_payments) = 1, 'RLS: other company payments visible';

  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000a2');
  ASSERT (SELECT count(*) FROM public.gateway_payments) = 3, 'viewer should see its company payments';
  BEGIN
    PERFORM public.disconnect_payment_connection('36100000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'viewer disconnected payments';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'viewer disconnected payments' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.as_user('36000000-0000-4000-8000-0000000000b1');
  PERFORM public.disconnect_payment_connection(o2);
  ASSERT (SELECT status FROM public.payment_connections WHERE organisation_id = o2) = 'revoked', 'owner could not disconnect';
END $$;
RESET ROLE;

ROLLBACK;
