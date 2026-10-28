-- Demo sandbox for Deku Finance.
-- Real Supabase users who are members ONLY of their own demo companies, so row-level security
-- keeps demo visitors out of every real tenant. All names and GSTINs are fictional.
-- Runs on `supabase db reset`; safe to re-run on a hosted project (idempotent).
-- Password for all three accounts: DekuDemo#2026

DO $$
DECLARE
  v_users jsonb := '[
    {"id": "11111111-1111-4111-8111-111111111111", "email": "demo-owner@deku.finance",      "name": "Demo Owner"},
    {"id": "22222222-2222-4222-8222-222222222222", "email": "demo-accountant@deku.finance", "name": "Demo Accountant"},
    {"id": "44444444-4444-4444-8444-444444444444", "email": "demo-freelancer@deku.finance", "name": "Demo Freelancer"}
  ]';
  u jsonb;
  v_org uuid := 'd0000000-0000-4000-8000-000000000001';
  v_studio uuid := 'd0000000-0000-4000-8000-000000000002';
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(v_users) LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid, 'authenticated', 'authenticated',
      u->>'email', crypt('DekuDemo#2026', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u->>'name', 'is_demo', true),
      now(), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      (u->>'id')::uuid, (u->>'id')::uuid, u->>'id',
      jsonb_build_object('sub', u->>'id', 'email', u->>'email', 'email_verified', true),
      'email', now(), now(), now()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.organisations (id, name, legal_name, slug, gstin, pan, created_by) VALUES
    (v_org, 'Demo Traders Pvt Ltd', 'Demo Traders Private Limited', 'demo-traders', '27AABCD1234F1Z6', 'AABCD1234F', '11111111-1111-4111-8111-111111111111'),
    (v_studio, 'Demo Creative Studio', 'Demo Creative Studio', 'demo-creative-studio', NULL, NULL, '44444444-4444-4444-8444-444444444444')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organisation_members (organisation_id, user_id, role) VALUES
    (v_org, '11111111-1111-4111-8111-111111111111', 'owner'),
    (v_org, '22222222-2222-4222-8222-222222222222', 'accountant'),
    (v_studio, '44444444-4444-4444-8444-444444444444', 'owner')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE organisation_id = v_org) THEN
    PERFORM public.seed_default_chart_of_accounts(v_org);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE organisation_id = v_studio) THEN
    PERFORM public.seed_default_chart_of_accounts(v_studio);
  END IF;

  INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date)
  SELECT o, 'FY 2026-27', '2026-04-01', '2027-03-31'
  FROM unnest(ARRAY[v_org, v_studio]) AS o
  WHERE NOT EXISTS (SELECT 1 FROM public.fiscal_periods f WHERE f.organisation_id = o);

  INSERT INTO public.parties (organisation_id, type, legal_name, display_name, gstin)
  SELECT v_org, t, n, n, g
  FROM (VALUES
    ('vendor'::public.party_type, 'Cloudnine Hosting Pvt Ltd', '29AABCT1332L1ZA'),
    ('customer'::public.party_type, 'Fictional Retail LLP', '27AAPFU0939F1ZV')
  ) AS p(t, n, g)
  WHERE NOT EXISTS (SELECT 1 FROM public.parties x WHERE x.organisation_id = v_org AND x.gstin = p.g);
END $$;
