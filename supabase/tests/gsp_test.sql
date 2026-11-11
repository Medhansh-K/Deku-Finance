-- Migration 37: members read only their company's GSP rows, never the encrypted credentials, and only
-- the backend's service role writes. An IRN must point at an invoice of the same company. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('37000000-0000-4000-8000-0000000000a1', 'gsp-owner@test.local'),
  ('37000000-0000-4000-8000-0000000000b1', 'gsp-other@test.local');
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, email FROM auth.users WHERE email LIKE 'gsp-%@test.local'
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

DO $$
DECLARE
  o1 uuid := '37100000-0000-4000-8000-000000000001';
  o2 uuid := '37100000-0000-4000-8000-000000000002';
BEGIN
  INSERT INTO public.organisations (id, name, slug, created_by) VALUES
    (o1, 'GSP Co', 'gsp-co', '37000000-0000-4000-8000-0000000000a1'),
    (o2, 'GSP Other Co', 'gsp-other-co', '37000000-0000-4000-8000-0000000000b1');
  INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
    (o1, '37000000-0000-4000-8000-0000000000a1', 'owner'),
    (o2, '37000000-0000-4000-8000-0000000000b1', 'owner')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;
  INSERT INTO public.parties (id, organisation_id, type, legal_name, display_name) VALUES
    ('37c00000-0000-4000-8000-000000000001', o1, 'customer', 'Cust 1', 'C1'),
    ('37c00000-0000-4000-8000-000000000002', o2, 'customer', 'Cust 2', 'C2');
  INSERT INTO public.sales_invoices (id, organisation_id, customer_id, invoice_number, invoice_date, due_date, place_of_supply) VALUES
    ('37d00000-0000-4000-8000-000000000001', o1, '37c00000-0000-4000-8000-000000000001', 'INV-37-1', current_date, current_date, '27'),
    ('37d00000-0000-4000-8000-000000000002', o2, '37c00000-0000-4000-8000-000000000002', 'INV-37-2', current_date, current_date, '27'),
    ('37d00000-0000-4000-8000-000000000003', o2, '37c00000-0000-4000-8000-000000000002', 'INV-37-3', current_date, current_date, '27');
END $$;

-- ---------------------------------------------------------------------------------------------
-- The backend's service role writes
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
INSERT INTO public.gsp_connections (organisation_id, provider, gstin, credentials_enc, session_expires_at, status) VALUES
  ('37100000-0000-4000-8000-000000000001', 'sandbox', '27AAAAA0000A1Z5', 'ciphertext-1', now() + interval '6 hours', 'connected'),
  ('37100000-0000-4000-8000-000000000002', 'sandbox', '27BBBBB0000B1Z5', 'ciphertext-2', now() + interval '6 hours', 'connected');
INSERT INTO public.e_invoices (organisation_id, sales_invoice_id, provider, irn) VALUES
  ('37100000-0000-4000-8000-000000000001', '37d00000-0000-4000-8000-000000000001', 'sandbox', 'SANDBOX-IRN-1'),
  ('37100000-0000-4000-8000-000000000002', '37d00000-0000-4000-8000-000000000002', 'sandbox', 'SANDBOX-IRN-2');
INSERT INTO public.eway_bills (organisation_id, sales_invoice_id, provider, ewb_no, distance_km) VALUES
  ('37100000-0000-4000-8000-000000000001', '37d00000-0000-4000-8000-000000000001', 'sandbox', 'SANDBOX-EWB-1', 120);
INSERT INTO public.gsp_requests (organisation_id, provider, kind, ref, status) VALUES
  ('37100000-0000-4000-8000-000000000001', 'sandbox', 'generate_irn', '37d00000-0000-4000-8000-000000000001', 'ok'),
  ('37100000-0000-4000-8000-000000000002', 'sandbox', 'generate_irn', '37d00000-0000-4000-8000-000000000002', 'ok');

DO $$
BEGIN
  -- Org 1's IRN can't point at org 2's invoice.
  BEGIN
    INSERT INTO public.e_invoices (organisation_id, sales_invoice_id, provider, irn)
    VALUES ('37100000-0000-4000-8000-000000000001', '37d00000-0000-4000-8000-000000000003', 'sandbox', 'SANDBOX-X');
    RAISE EXCEPTION 'cross-company IRN was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  -- One live IRN per invoice.
  BEGIN
    INSERT INTO public.e_invoices (organisation_id, sales_invoice_id, provider, irn)
    VALUES ('37100000-0000-4000-8000-000000000001', '37d00000-0000-4000-8000-000000000001', 'sandbox', 'SANDBOX-IRN-1B');
    RAISE EXCEPTION 'second live IRN was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- A cancelled IRN needs a reason.
  BEGIN
    UPDATE public.e_invoices SET status = 'cancelled' WHERE irn = 'SANDBOX-IRN-1';
    RAISE EXCEPTION 'cancellation without a reason was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Connected needs a session.
  BEGIN
    UPDATE public.gsp_connections SET session_expires_at = NULL
    WHERE organisation_id = '37100000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'connected without a session was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- An invoice with an IRN can't be deleted.
  BEGIN
    DELETE FROM public.sales_invoices WHERE id = '37d00000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'invoice with an IRN was deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------------------------------
-- A member reads their own company's rows, without the credentials column
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('37000000-0000-4000-8000-0000000000a1');
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.gsp_connections) = 1, 'member sees another company''s connection';
  ASSERT (SELECT status FROM public.gsp_connections) = 'connected', 'member cannot read the status';
  ASSERT (SELECT count(*) FROM public.e_invoices) = 1, 'member sees another company''s IRN';
  ASSERT (SELECT count(*) FROM public.eway_bills) = 1, 'member cannot read their e-way bill';
  ASSERT (SELECT count(*) FROM public.gsp_requests) = 1, 'member sees another company''s GSP log';

  BEGIN
    PERFORM credentials_enc FROM public.gsp_connections;
    RAISE EXCEPTION 'authenticated read credentials_enc';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.gsp_connections;
    RAISE EXCEPTION 'select * reached credentials_enc';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- No writes for members, not even the owner.
  BEGIN
    UPDATE public.gsp_connections SET status = 'disconnected';
    RAISE EXCEPTION 'owner updated gsp_connections directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.e_invoices (organisation_id, sales_invoice_id, provider, irn)
    VALUES ('37100000-0000-4000-8000-000000000001', '37d00000-0000-4000-8000-000000000001', 'sandbox', 'FORGED');
    RAISE EXCEPTION 'owner inserted an IRN directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.gsp_requests (organisation_id, provider, kind, status)
    VALUES ('37100000-0000-4000-8000-000000000001', 'sandbox', 'file_return', 'ok');
    RAISE EXCEPTION 'owner wrote the GSP log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.eway_bills;
    RAISE EXCEPTION 'owner deleted e-way bills';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Anonymous callers see nothing at all.
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.e_invoices;
    RAISE EXCEPTION 'anon read e_invoices';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

ROLLBACK;
\echo 'gsp_test: ok'
