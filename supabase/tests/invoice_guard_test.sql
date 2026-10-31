-- Migration 40: a signed-in user cannot issue (or link a journal to) an invoice by plain UPDATE.
BEGIN;

INSERT INTO public.sales_invoices (organisation_id, customer_id, invoice_number, invoice_date, due_date, status,
                                   supply_type, place_of_supply, taxable_amount, total_amount)
SELECT 'd0000000-0000-4000-8000-000000000001', id, 'GUARD-1', current_date, current_date, 'draft',
       'intra_state', '27', 0, 0
FROM public.parties WHERE organisation_id = 'd0000000-0000-4000-8000-000000000001' LIMIT 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

DO $$
DECLARE
  v_n int;
BEGIN
  -- Editing a draft is still allowed.
  UPDATE public.sales_invoices SET notes = 'edited' WHERE invoice_number = 'GUARD-1';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'owner could not edit a draft invoice'; END IF;

  BEGIN
    UPDATE public.sales_invoices SET status = 'issued' WHERE invoice_number = 'GUARD-1';
    RAISE EXCEPTION 'plain UPDATE issued the invoice';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

ROLLBACK;
\echo invoice_guard_test passed
