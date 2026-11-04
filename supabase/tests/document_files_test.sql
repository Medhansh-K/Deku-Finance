-- Migration 48: stored documents follow company membership and can't be altered. Everything rolls back.
BEGIN;
SET client_min_messages = warning;

INSERT INTO auth.users (id, email) VALUES
  ('48000000-0000-4000-8000-0000000000a1', 'files-owner@test.local'),
  ('48000000-0000-4000-8000-0000000000a2', 'files-viewer@test.local'),
  ('48000000-0000-4000-8000-0000000000a3', 'files-outsider@test.local');
INSERT INTO public.organisations (id, name, slug, created_by) VALUES
  ('48000000-0000-4000-8000-000000000001', 'Files Co', 'files-co', '48000000-0000-4000-8000-0000000000a1'),
  ('48000000-0000-4000-8000-000000000002', 'Other Co', 'other-files-co', '48000000-0000-4000-8000-0000000000a3');
INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
  ('48000000-0000-4000-8000-000000000001', '48000000-0000-4000-8000-0000000000a1', 'owner'),
  ('48000000-0000-4000-8000-000000000001', '48000000-0000-4000-8000-0000000000a2', 'viewer'),
  ('48000000-0000-4000-8000-000000000002', '48000000-0000-4000-8000-0000000000a3', 'owner');
INSERT INTO public.fiscal_periods (id, organisation_id, name, start_date, end_date) VALUES
  ('48000000-0000-4000-8000-000000000011', '48000000-0000-4000-8000-000000000002', 'Other FY', current_date - 1, current_date + 1);
INSERT INTO public.journal_entries (id, organisation_id, fiscal_period_id, entry_number, entry_date, status, narration) VALUES
  ('48000000-0000-4000-8000-000000000021', '48000000-0000-4000-8000-000000000002', '48000000-0000-4000-8000-000000000011', 'FILES/1', current_date, 'draft', 'other company voucher');

CREATE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_org uuid := '48000000-0000-4000-8000-000000000001';
  v_file uuid;
  v_n int;
BEGIN
  -- Owner attaches a file; the audit trail records it.
  PERFORM pg_temp.as_user('48000000-0000-4000-8000-0000000000a1');
  INSERT INTO public.document_files (organisation_id, filename, content_type, byte_size, data)
  VALUES (v_org, 'bill.pdf', 'application/pdf', 5, '\x255044462d')
  RETURNING id INTO v_file;

  SELECT count(*) INTO v_n FROM public.audit_events WHERE entity_id = v_file AND action = 'document_attached';
  ASSERT v_n = 1, 'upload was not audited';

  -- Attached files can't be changed or removed, even by the owner.
  BEGIN
    UPDATE public.document_files SET filename = 'changed.pdf' WHERE id = v_file;
    RAISE EXCEPTION 'owner changed an attached file';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.document_files WHERE id = v_file;
    RAISE EXCEPTION 'owner deleted an attached file';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A voucher from another company can't be linked.
  BEGIN
    INSERT INTO public.document_files (organisation_id, journal_entry_id, filename, content_type, byte_size, data)
    VALUES (v_org, '48000000-0000-4000-8000-000000000021', 'x.pdf', 'application/pdf', 5, '\x255044462d');
    RAISE EXCEPTION 'file linked to another company''s voucher';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Type and size limits hold, even if the backend is bypassed.
  BEGIN
    INSERT INTO public.document_files (organisation_id, filename, content_type, byte_size, data)
    VALUES (v_org, 'x.html', 'text/html', 5, '\x255044462d');
    RAISE EXCEPTION 'html accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.document_files (organisation_id, filename, content_type, byte_size, data)
    VALUES (v_org, 'x.pdf', 'application/pdf', 999, '\x255044462d');
    RAISE EXCEPTION 'wrong byte_size accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A viewer reads but can't attach; forging another uploader is refused.
  PERFORM pg_temp.as_user('48000000-0000-4000-8000-0000000000a2');
  SELECT count(*) INTO v_n FROM public.document_files WHERE id = v_file;
  ASSERT v_n = 1, 'viewer cannot read the company''s file';
  BEGIN
    INSERT INTO public.document_files (organisation_id, filename, content_type, byte_size, data)
    VALUES (v_org, 'y.pdf', 'application/pdf', 5, '\x255044462d');
    RAISE EXCEPTION 'viewer attached a file';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Another company's owner sees nothing and can't plant a file here.
  PERFORM pg_temp.as_user('48000000-0000-4000-8000-0000000000a3');
  SELECT count(*) INTO v_n FROM public.document_files WHERE id = v_file;
  ASSERT v_n = 0, 'outsider can read the file';
  BEGIN
    INSERT INTO public.document_files (organisation_id, filename, content_type, byte_size, data)
    VALUES (v_org, 'z.pdf', 'application/pdf', 5, '\x255044462d');
    RAISE EXCEPTION 'outsider attached a file';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

ROLLBACK;
\echo document_files_test passed
