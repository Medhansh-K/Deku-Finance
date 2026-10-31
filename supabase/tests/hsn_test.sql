-- HSN/SAC master from migration 33: search ordering, read-only for users, closed to anon.
-- The rows below are made-up test fixtures (codes 00xx are not real chapters) and are rolled back.
BEGIN;

INSERT INTO public.hsn_sac_codes (code, description, source) VALUES
  ('0012',     'Test widgets of steel',             'hsn_test.sql'),
  ('001234',   'Test widgets, painted',             'hsn_test.sql'),
  ('00123456', 'Test widgets, painted blue',        'hsn_test.sql'),
  ('0034',     'Test gadgets containing 0012 parts', 'hsn_test.sql'),
  ('9988',     'Test 100% services_x',              'hsn_test.sql');

DO $$
BEGIN
  ASSERT (SELECT kind || '/' || chapter FROM public.hsn_sac_codes WHERE code = '9988') = 'service/99', 'SAC kind not derived';
  ASSERT (SELECT kind FROM public.hsn_sac_codes WHERE code = '0012') = 'goods', 'HSN kind not derived';

  BEGIN
    INSERT INTO public.hsn_sac_codes (code, description, source) VALUES ('123', 'odd length', 't');
    RAISE EXCEPTION '3-digit code accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.hsn_sac_codes (code, description, source) VALUES ('12AB', 'letters', 't');
    RAISE EXCEPTION 'non-digit code accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"33000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$
BEGIN
  -- Code prefix first, shortest code first; then description hits ('0034' mentions 0012).
  ASSERT (SELECT array_agg(code) FROM public.search_hsn('0012')) = ARRAY['0012', '001234', '00123456', '0034'],
    format('code prefix order wrong: %s', (SELECT array_agg(code) FROM public.search_hsn('0012')));
  ASSERT (SELECT array_agg(match) FROM public.search_hsn('0012')) = ARRAY['code', 'code', 'code', 'description'], 'match labels wrong';
  -- Dots and spaces in a typed code are ignored.
  ASSERT (SELECT array_agg(code) FROM public.search_hsn('0012.34')) = ARRAY['001234', '00123456'], 'dotted code not matched';
  -- Every word must appear, case-insensitively, in any order.
  ASSERT (SELECT array_agg(code) FROM public.search_hsn('PAINTED widgets')) = ARRAY['001234', '00123456'], 'word search wrong';
  -- LIKE wildcards in the query are literal.
  ASSERT (SELECT array_agg(code) FROM public.search_hsn('100%')) = ARRAY['9988'], 'percent not literal';
  ASSERT NOT EXISTS (SELECT 1 FROM public.search_hsn('t_st')), 'underscore treated as wildcard';
  ASSERT NOT EXISTS (SELECT 1 FROM public.search_hsn('   ')), 'blank query returned rows';
  ASSERT (SELECT count(*) FROM public.search_hsn('test', 2)) = 2, 'limit ignored';

  BEGIN
    INSERT INTO public.hsn_sac_codes (code, description, source) VALUES ('7777', 'user insert', 'x');
    RAISE EXCEPTION 'authenticated inserted into the HSN master';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.hsn_sac_codes SET description = 'changed' WHERE code = '0012';
    RAISE EXCEPTION 'authenticated updated the HSN master';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.hsn_sac_rates (code, rate_pct, effective_from, notification_ref, source)
    VALUES ('0012', 18, '2026-01-01', 'x', 'x');
    RAISE EXCEPTION 'authenticated inserted a rate';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM public.search_hsn('0012');
    RAISE EXCEPTION 'anon ran search_hsn';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.hsn_sac_codes;
    RAISE EXCEPTION 'anon read the HSN master';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
ROLLBACK;
