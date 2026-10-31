-- Migration 28: gst_return_filings RLS (member vs non-member vs viewer) and filed rows immutable.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'gst-owner@example.com'),
  ('a1000000-0000-0000-0000-000000000002', 'gst-viewer@example.com'),
  ('a1000000-0000-0000-0000-000000000003', 'gst-outsider@example.com');
INSERT INTO public.organisations (id, name, slug, created_by)
VALUES ('a2000000-0000-0000-0000-000000000001', 'GST Filing Test', 'gst-filing-test', 'a1000000-0000-0000-0000-000000000001');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'owner'),
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'viewer')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- Owner records a prepared return; who prepared it comes from the token.
SELECT set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
INSERT INTO public.gst_return_filings (organisation_id, ret_period, return_type, json, summary)
VALUES ('a2000000-0000-0000-0000-000000000001', '102026', 'GSTR3B', '{"v":1}', '{"rows":[]}');
DO $$
BEGIN
  ASSERT (SELECT prepared_by FROM public.gst_return_filings WHERE ret_period = '102026')
    = 'a1000000-0000-0000-0000-000000000001', 'prepared_by not stamped';
END $$;

-- Re-recording a prepared return replaces it.
INSERT INTO public.gst_return_filings (organisation_id, ret_period, return_type, json, summary)
VALUES ('a2000000-0000-0000-0000-000000000001', '102026', 'GSTR3B', '{"v":2}', '{"rows":[]}')
ON CONFLICT (organisation_id, ret_period, return_type)
DO UPDATE SET json = EXCLUDED.json, summary = EXCLUDED.summary, status = 'prepared';

-- Non-member sees nothing and cannot write.
SELECT set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.gst_return_filings) = 0, 'non-member can read filings';
  BEGIN
    INSERT INTO public.gst_return_filings (organisation_id, ret_period, return_type, json, summary)
    VALUES ('a2000000-0000-0000-0000-000000000001', '092026', 'GSTR1', '{}', '{}');
    RAISE EXCEPTION 'non-member inserted a filing';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Viewer reads but cannot change.
SELECT set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE n int;
BEGIN
  ASSERT (SELECT json->>'v' FROM public.gst_return_filings WHERE ret_period = '102026') = '2', 'viewer cannot read / upsert did not replace';
  UPDATE public.gst_return_filings SET json = '{"v":3}' WHERE ret_period = '102026';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'viewer updated a filing';
  BEGIN
    INSERT INTO public.gst_return_filings (organisation_id, ret_period, return_type, json, summary)
    VALUES ('a2000000-0000-0000-0000-000000000001', '092026', 'GSTR1', '{}', '{}');
    RAISE EXCEPTION 'viewer inserted a filing';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Owner marks it filed: content is frozen, filer stamped.
SELECT set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.gst_return_filings (organisation_id, ret_period, return_type, json, summary, status, filed_arn)
    VALUES ('a2000000-0000-0000-0000-000000000001', '092026', 'GSTR1', '{}', '{}', 'filed', 'AA270926000001X');
    RAISE EXCEPTION 'a return was inserted as filed';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Record the prepared return%', SQLERRM;
  END;

  UPDATE public.gst_return_filings SET status = 'filed', filed_arn = 'AA271026000001X', json = '{"v":"sneaky"}'
  WHERE ret_period = '102026';
  ASSERT (SELECT filed_by = 'a1000000-0000-0000-0000-000000000001' AND filed_at IS NOT NULL AND json->>'v' = '2'
          FROM public.gst_return_filings WHERE ret_period = '102026'), 'filing did not stamp or freeze the return';

  -- RLS hides filed rows from updates...
  UPDATE public.gst_return_filings SET filed_arn = 'OTHER' WHERE ret_period = '102026';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'owner changed a filed return';
END $$;

-- ...and the trigger blocks even roles that bypass RLS.
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.gst_return_filings SET filed_arn = 'OTHER' WHERE ret_period = '102026';
    RAISE EXCEPTION 'superuser changed a filed return';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%is filed and cannot be changed', SQLERRM;
  END;
  BEGIN
    DELETE FROM public.gst_return_filings WHERE ret_period = '102026';
    RAISE EXCEPTION 'superuser deleted a filed return';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%is filed and cannot be changed', SQLERRM;
  END;
  ASSERT NOT has_function_privilege('anon', 'public.gst_return_filings_guard()', 'EXECUTE'), 'anon can execute the guard';
  RAISE NOTICE 'gst_filings_test passed';
END $$;

ROLLBACK;
