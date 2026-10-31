-- Migration 36: Razorpay payment links on each company's own Razorpay account (OAuth)
-- Deku Finance
--
-- A company connects its own Razorpay account through OAuth; the backend stores the tokens AES-GCM
-- encrypted (backend/src/crypto.rs) and only service_role can read them back. Payment links are
-- created per invoice; Razorpay's signed webhook reports the payment, and record_gateway_payment
-- books the receipt voucher (or submits it for approval when maker-checker is on).

-- ---------------------------------------------------------------------------------------------
-- Razorpay clearing account
-- ---------------------------------------------------------------------------------------------
-- seed_default_chart_of_accounts is not redefined (other migrations may redefine it). Instead one
-- helper adds account 1025 and is called by (a) the backfill below, (b) a trigger that fires when the
-- default chart's bank account 1020 is inserted, i.e. whenever the default chart is seeded, and
-- (c) record_gateway_payment, so a company with a custom chart still gets it on its first payment.
CREATE OR REPLACE FUNCTION public.add_razorpay_clearing_account(p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES (p_org_id, '1025', 'Razorpay Clearing', 'asset', 'asset', 'Cash & Liquid Capital', 'Payment Gateway Clearing',
          'Razorpay Clearing', true, true, 'Online payments collected by Razorpay and not yet settled to the bank')
  ON CONFLICT (organisation_id, code) DO NOTHING;
  SELECT id INTO v_id FROM public.accounts WHERE organisation_id = p_org_id AND code = '1025';
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_add_razorpay_clearing_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.add_razorpay_clearing_account(NEW.organisation_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_add_razorpay_clearing ON public.accounts;
CREATE TRIGGER trg_accounts_add_razorpay_clearing
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  WHEN (NEW.code = '1020')
  EXECUTE FUNCTION public.trg_add_razorpay_clearing_account();

SELECT public.add_razorpay_clearing_account(organisation_id)
FROM public.accounts WHERE code = '1020';

REVOKE EXECUTE ON FUNCTION public.add_razorpay_clearing_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_add_razorpay_clearing_account() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
  razorpay_account_id text NOT NULL,
  -- base64(nonce || AES-256-GCM ciphertext); NULL once revoked.
  access_token_enc text,
  refresh_token_enc text,
  public_token text,
  expires_at timestamptz,
  mode text NOT NULL CHECK (mode IN ('test', 'live')),
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'revoked', 'error')),
  connected_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_payment_connections_org_provider UNIQUE (organisation_id, provider),
  CONSTRAINT chk_payment_connections_tokens CHECK (status <> 'connected' OR (access_token_enc IS NOT NULL AND refresh_token_enc IS NOT NULL))
);
-- One Razorpay account feeds one company, so a webhook's account_id names exactly one organisation.
CREATE UNIQUE INDEX IF NOT EXISTS uk_payment_connections_account_connected
  ON public.payment_connections(razorpay_account_id) WHERE status = 'connected';

DROP TRIGGER IF EXISTS trg_payment_connections_updated_at ON public.payment_connections;
CREATE TRIGGER trg_payment_connections_updated_at
  BEFORE UPDATE ON public.payment_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY CHECK (length(state) >= 32),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
  mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
    CHECK (expires_at <= created_at + interval '1 hour')
);

CREATE TABLE IF NOT EXISTS public.invoice_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
  link_id text NOT NULL UNIQUE,
  short_url text NOT NULL CHECK (short_url ~ '^https://'),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'cancelled', 'expired')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_invoice_payment_links_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_invoice_payment_links_invoice FOREIGN KEY (organisation_id, invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_invoice_payment_links_active
  ON public.invoice_payment_links(organisation_id, invoice_id) WHERE status = 'created';

DROP TRIGGER IF EXISTS trg_invoice_payment_links_updated_at ON public.invoice_payment_links;
CREATE TRIGGER trg_invoice_payment_links_updated_at
  BEFORE UPDATE ON public.invoice_payment_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.gateway_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
  payment_id text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL,
  payment_link_id uuid,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  -- Razorpay's fee excluding GST, and the GST on it; the merchant receives the rest.
  fee_paise bigint NOT NULL DEFAULT 0 CHECK (fee_paise >= 0),
  tax_on_fee_paise bigint NOT NULL DEFAULT 0 CHECK (tax_on_fee_paise >= 0),
  method text,
  captured_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  journal_entry_id uuid,
  -- Why no voucher was booked (no open period, missing ledger); the payment is still kept.
  journal_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_gateway_payments_split CHECK (fee_paise + tax_on_fee_paise <= amount_paise),
  CONSTRAINT fk_gateway_payments_invoice FOREIGN KEY (organisation_id, invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gateway_payments_link FOREIGN KEY (organisation_id, payment_link_id)
    REFERENCES public.invoice_payment_links(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gateway_payments_journal FOREIGN KEY (organisation_id, journal_entry_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_gateway_payments_invoice ON public.gateway_payments(organisation_id, invoice_id);

-- ---------------------------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.payment_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_payments ENABLE ROW LEVEL SECURITY;

-- Column privileges: members see the connection, never the encrypted tokens.
REVOKE ALL ON public.payment_connections FROM anon, authenticated;
GRANT SELECT (id, organisation_id, provider, razorpay_account_id, public_token, expires_at, mode, status,
              connected_by, created_at, updated_at)
  ON public.payment_connections TO authenticated;
REVOKE ALL ON public.oauth_states FROM anon, authenticated;
GRANT SELECT, INSERT ON public.oauth_states TO authenticated;
REVOKE ALL ON public.invoice_payment_links FROM anon, authenticated;
GRANT SELECT, INSERT ON public.invoice_payment_links TO authenticated;
REVOKE ALL ON public.gateway_payments FROM anon, authenticated;
GRANT SELECT ON public.gateway_payments TO authenticated;

DROP POLICY IF EXISTS "payment_connections_select" ON public.payment_connections;
CREATE POLICY "payment_connections_select" ON public.payment_connections
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "oauth_states_insert" ON public.oauth_states;
CREATE POLICY "oauth_states_insert" ON public.oauth_states
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]));
DROP POLICY IF EXISTS "oauth_states_select_own" ON public.oauth_states;
CREATE POLICY "oauth_states_select_own" ON public.oauth_states
  FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "invoice_payment_links_select" ON public.invoice_payment_links;
CREATE POLICY "invoice_payment_links_select" ON public.invoice_payment_links
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
DROP POLICY IF EXISTS "invoice_payment_links_insert" ON public.invoice_payment_links;
CREATE POLICY "invoice_payment_links_insert" ON public.invoice_payment_links
  FOR INSERT TO authenticated
  WITH CHECK (status = 'created'
              AND public.has_role(organisation_id, ARRAY['owner', 'admin', 'cfo', 'accountant']::public.organisation_role[]));

DROP POLICY IF EXISTS "gateway_payments_select" ON public.gateway_payments;
CREATE POLICY "gateway_payments_select" ON public.gateway_payments
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));

-- ---------------------------------------------------------------------------------------------
-- Functions called with the user's token
-- ---------------------------------------------------------------------------------------------

-- Everything the backend needs to create a payment link, after checking the caller may.
-- Customer contact fields are NULL when not saved; the backend sends only what is present.
CREATE OR REPLACE FUNCTION public.payment_link_invoice(p_org_id uuid, p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.sales_invoices;
  v_party public.parties;
  v_link public.invoice_payment_links;
BEGIN
  IF NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'cfo', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: cannot create payment links';
  END IF;
  SELECT * INTO v_inv FROM public.sales_invoices WHERE id = p_invoice_id AND organisation_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  IF v_inv.status <> 'issued' THEN
    RAISE EXCEPTION 'Only issued invoices can get a payment link (status: %)', v_inv.status;
  END IF;
  SELECT * INTO v_party FROM public.parties WHERE id = v_inv.customer_id AND organisation_id = p_org_id;
  SELECT * INTO v_link FROM public.invoice_payment_links
  WHERE organisation_id = p_org_id AND invoice_id = p_invoice_id AND status = 'created';

  RETURN jsonb_build_object(
    'invoice_id', v_inv.id,
    'invoice_number', v_inv.invoice_number,
    'amount_paise', round(v_inv.total_amount * 100)::bigint,
    'customer_name', nullif(trim(v_party.legal_name), ''),
    'customer_email', nullif(trim(v_party.email), ''),
    'customer_phone', nullif(trim(v_party.phone), ''),
    'existing_link', CASE WHEN v_link.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_link.id, 'link_id', v_link.link_id, 'short_url', v_link.short_url,
      'amount_paise', v_link.amount_paise, 'status', v_link.status) END
  );
END;
$$;

-- One-time: deletes the state and returns its company, only for the user who started the flow,
-- before it expires and while they are still owner/admin. NULL otherwise.
CREATE OR REPLACE FUNCTION public.consume_payment_oauth_state(p_state text)
RETURNS TABLE (organisation_id uuid, mode text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.oauth_states;
BEGIN
  DELETE FROM public.oauth_states s
  WHERE s.state = p_state AND s.created_by = auth.uid()
  RETURNING * INTO v_row;
  -- Expired states of anyone are garbage either way.
  DELETE FROM public.oauth_states s WHERE s.expires_at < now();
  IF v_row.state IS NULL OR v_row.expires_at < now()
     OR NOT public.has_role(v_row.organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]) THEN
    RETURN;
  END IF;
  organisation_id := v_row.organisation_id;
  mode := v_row.mode;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.disconnect_payment_connection(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(p_org_id, ARRAY['owner', 'admin']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: only the owner or an admin can disconnect payments';
  END IF;
  UPDATE public.payment_connections
  SET status = 'revoked', access_token_enc = NULL, refresh_token_enc = NULL, public_token = NULL
  WHERE organisation_id = p_org_id AND provider = 'razorpay';
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Functions for the backend's service token only
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_payment_connection(
  p_org_id uuid, p_user_id uuid, p_account_id text, p_access_token_enc text, p_refresh_token_enc text,
  p_public_token text, p_expires_at timestamptz, p_mode text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.payment_connections AS c (organisation_id, provider, razorpay_account_id, access_token_enc,
    refresh_token_enc, public_token, expires_at, mode, status, connected_by)
  VALUES (p_org_id, 'razorpay', p_account_id, p_access_token_enc, p_refresh_token_enc, p_public_token,
          p_expires_at, p_mode, 'connected', p_user_id)
  ON CONFLICT (organisation_id, provider) DO UPDATE SET
    razorpay_account_id = EXCLUDED.razorpay_account_id,
    access_token_enc = EXCLUDED.access_token_enc,
    refresh_token_enc = EXCLUDED.refresh_token_enc,
    public_token = EXCLUDED.public_token,
    expires_at = EXCLUDED.expires_at,
    mode = EXCLUDED.mode,
    status = 'connected',
    connected_by = coalesce(EXCLUDED.connected_by, c.connected_by);
$$;

CREATE OR REPLACE FUNCTION public.payment_connection_secrets(p_org_id uuid)
RETURNS TABLE (razorpay_account_id text, access_token_enc text, refresh_token_enc text,
               expires_at timestamptz, mode text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.razorpay_account_id, c.access_token_enc, c.refresh_token_enc, c.expires_at, c.mode, c.status
  FROM public.payment_connections c
  WHERE c.organisation_id = p_org_id AND c.provider = 'razorpay';
$$;

-- Razorpay's account.app.authorization_revoked webhook.
CREATE OR REPLACE FUNCTION public.revoke_razorpay_account(p_account_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.payment_connections
  SET status = 'revoked', access_token_enc = NULL, refresh_token_enc = NULL, public_token = NULL
  WHERE provider = 'razorpay' AND razorpay_account_id = p_account_id AND status <> 'revoked';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Records a captured payment once per payment id and books the receipt voucher:
--   Dr Razorpay clearing (amount - fee - tax), Dr Bank charges (fee), Dr Input GST (tax),
--   Cr Trade debtors (amount, party = invoice customer).
-- The company comes from the payment link, else from the Razorpay account id; the invoice from the
-- link, else p_invoice_id, else p_invoice_number. Returns {status: recorded|duplicate|unmatched, ...}
-- rather than raising, so a webhook for something Deku doesn't know is acknowledged and dropped.
CREATE OR REPLACE FUNCTION public.record_gateway_payment(
  p_account_id text,
  p_payment_id text,
  p_link_id text,
  p_invoice_id uuid,
  p_invoice_number text,
  p_amount_paise bigint,
  p_fee_paise bigint,
  p_tax_on_fee_paise bigint,
  p_method text,
  p_captured_at timestamptz,
  p_raw jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.gateway_payments;
  v_org uuid;
  v_link public.invoice_payment_links;
  v_inv public.sales_invoices;
  v_gp_id uuid;
  v_entry_id uuid;
  v_fiscal uuid;
  v_date date := (coalesce(p_captured_at, now()) AT TIME ZONE 'Asia/Kolkata')::date;
  v_net bigint := p_amount_paise - coalesce(p_fee_paise, 0) - coalesce(p_tax_on_fee_paise, 0);
  v_tax bigint := coalesce(p_tax_on_fee_paise, 0);
  v_clearing uuid;
  v_charges uuid;
  v_debtors uuid;
  v_cgst uuid;
  v_sgst uuid;
  v_igst uuid;
  v_state text;
  v_approval boolean;
  v_line integer := 0;
  v_journal_status text;
  v_error text;
  v_label text;
BEGIN
  IF coalesce(trim(p_payment_id), '') = '' THEN
    RAISE EXCEPTION 'payment id is required';
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise <= 0 OR coalesce(p_fee_paise, 0) < 0 OR v_tax < 0 OR v_net < 0 THEN
    RAISE EXCEPTION 'Invalid payment amounts (amount %, fee %, tax %)', p_amount_paise, p_fee_paise, p_tax_on_fee_paise;
  END IF;

  SELECT * INTO v_existing FROM public.gateway_payments WHERE payment_id = p_payment_id;
  IF FOUND THEN
    UPDATE public.invoice_payment_links SET status = 'paid'
    WHERE link_id = p_link_id AND organisation_id = v_existing.organisation_id AND status = 'created';
    RETURN jsonb_build_object('status', 'duplicate', 'id', v_existing.id, 'journal_entry_id', v_existing.journal_entry_id);
  END IF;

  IF p_account_id IS NOT NULL THEN
    SELECT c.organisation_id INTO v_org FROM public.payment_connections c
    WHERE c.provider = 'razorpay' AND c.razorpay_account_id = p_account_id
    ORDER BY (c.status = 'connected') DESC, c.updated_at DESC
    LIMIT 1;
  END IF;
  IF p_link_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.invoice_payment_links WHERE link_id = p_link_id;
    IF v_link.id IS NOT NULL THEN
      IF v_org IS NOT NULL AND v_org <> v_link.organisation_id THEN
        RETURN jsonb_build_object('status', 'unmatched', 'reason', 'payment link belongs to another account');
      END IF;
      v_org := v_link.organisation_id;
    END IF;
  END IF;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('status', 'unmatched', 'reason', 'unknown account or payment link');
  END IF;

  IF coalesce(v_link.invoice_id, p_invoice_id) IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.sales_invoices
    WHERE id = coalesce(v_link.invoice_id, p_invoice_id) AND organisation_id = v_org;
  ELSIF p_invoice_number IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.sales_invoices
    WHERE invoice_number = p_invoice_number AND organisation_id = v_org;
  END IF;
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('status', 'unmatched', 'reason', 'invoice not found');
  END IF;

  INSERT INTO public.gateway_payments (organisation_id, payment_id, invoice_id, payment_link_id, amount_paise,
    fee_paise, tax_on_fee_paise, method, captured_at, raw)
  VALUES (v_org, p_payment_id, v_inv.id, v_link.id, p_amount_paise, coalesce(p_fee_paise, 0), v_tax,
          p_method, coalesce(p_captured_at, now()), coalesce(p_raw, '{}'::jsonb))
  ON CONFLICT (payment_id) DO NOTHING
  RETURNING id INTO v_gp_id;
  IF v_gp_id IS NULL THEN
    -- A concurrent delivery of the same payment won the insert.
    RETURN jsonb_build_object('status', 'duplicate');
  END IF;

  IF v_link.id IS NOT NULL THEN
    UPDATE public.invoice_payment_links SET status = 'paid' WHERE id = v_link.id AND status = 'created';
  END IF;

  -- A failed voucher must not lose the payment: the sub-block rolls back only the journal.
  BEGIN
    SELECT id INTO v_fiscal FROM public.fiscal_periods
    WHERE organisation_id = v_org AND status = 'open' AND v_date BETWEEN start_date AND end_date
    LIMIT 1;
    IF v_fiscal IS NULL THEN
      RAISE EXCEPTION 'No open fiscal period covers %', v_date;
    END IF;

    v_clearing := public.add_razorpay_clearing_account(v_org);
    SELECT id INTO v_debtors FROM public.accounts WHERE organisation_id = v_org AND code = '1030';
    SELECT id INTO v_charges FROM public.accounts WHERE organisation_id = v_org AND code = '5090';
    SELECT id INTO v_cgst FROM public.accounts WHERE organisation_id = v_org AND code = '1081';
    SELECT id INTO v_sgst FROM public.accounts WHERE organisation_id = v_org AND code = '1082';
    SELECT id INTO v_igst FROM public.accounts WHERE organisation_id = v_org AND code = '1083';
    SELECT state_code, require_journal_approval INTO v_state, v_approval FROM public.organisations WHERE id = v_org;

    IF v_debtors IS NULL THEN
      RAISE EXCEPTION 'Trade debtors ledger (1030) is missing';
    END IF;
    IF coalesce(p_fee_paise, 0) > 0 AND v_charges IS NULL THEN
      RAISE EXCEPTION 'Bank charges ledger (5090) is missing';
    END IF;
    -- Razorpay is registered in Karnataka (29): GST on its fee is CGST+SGST for a Karnataka company,
    -- IGST otherwise. verify against Razorpay's tax invoice for the account.
    IF v_tax > 0 AND (CASE WHEN v_state = '29' THEN v_cgst IS NULL OR v_sgst IS NULL ELSE v_igst IS NULL END) THEN
      RAISE EXCEPTION 'Input GST ledger (1081/1082/1083) is missing';
    END IF;

    v_label := 'Razorpay ' || p_payment_id || ' for ' || v_inv.invoice_number;
    INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reference)
    VALUES (v_org, v_fiscal, 'RZP-' || p_payment_id, v_date, 'draft', 'Online receipt ' || v_label, v_inv.invoice_number)
    RETURNING id INTO v_entry_id;

    IF v_net > 0 THEN
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (v_org, v_entry_id, v_line, v_clearing, v_label, v_net / 100.0, 0);
    END IF;
    IF coalesce(p_fee_paise, 0) > 0 THEN
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (v_org, v_entry_id, v_line, v_charges, 'Razorpay fee ' || p_payment_id, p_fee_paise / 100.0, 0);
    END IF;
    IF v_tax > 0 AND v_state = '29' THEN
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (v_org, v_entry_id, v_line, v_cgst, 'CGST on Razorpay fee ' || p_payment_id, (v_tax / 2) / 100.0, 0);
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (v_org, v_entry_id, v_line, v_sgst, 'SGST on Razorpay fee ' || p_payment_id, (v_tax - v_tax / 2) / 100.0, 0);
    ELSIF v_tax > 0 THEN
      v_line := v_line + 1;
      INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
      VALUES (v_org, v_entry_id, v_line, v_igst, 'IGST on Razorpay fee ' || p_payment_id, v_tax / 100.0, 0);
    END IF;
    v_line := v_line + 1;
    INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit)
    VALUES (v_org, v_entry_id, v_line, v_debtors, v_inv.customer_id, v_label, 0, p_amount_paise / 100.0);

    IF v_approval THEN
      -- Maker is the system, so any owner/CFO/admin may approve it.
      UPDATE public.journal_entries SET submitted_at = now() WHERE id = v_entry_id;
      v_journal_status := 'pending_approval';
    ELSE
      PERFORM public.post_journal_entry(v_org, v_entry_id);
      v_journal_status := 'posted';
    END IF;

    UPDATE public.gateway_payments SET journal_entry_id = v_entry_id WHERE id = v_gp_id;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    v_entry_id := NULL;
    v_journal_status := NULL;
    UPDATE public.gateway_payments SET journal_error = v_error WHERE id = v_gp_id;
  END;

  RETURN jsonb_build_object('status', 'recorded', 'id', v_gp_id, 'organisation_id', v_org,
    'journal_entry_id', v_entry_id, 'journal_status', v_journal_status, 'journal_error', v_error);
END;
$$;

-- Migration 18/26 rules: nothing for PUBLIC or anon; user functions for authenticated; the rest service_role only.
REVOKE EXECUTE ON FUNCTION public.payment_link_invoice(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_payment_oauth_state(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.disconnect_payment_connection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_link_invoice(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_payment_oauth_state(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_payment_connection(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.store_payment_connection(uuid, uuid, text, text, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payment_connection_secrets(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_razorpay_account(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_gateway_payment(text, text, text, uuid, text, bigint, bigint, bigint, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_payment_connection(uuid, uuid, text, text, text, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_connection_secrets(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_razorpay_account(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_gateway_payment(text, text, text, uuid, text, bigint, bigint, bigint, text, timestamptz, jsonb) TO service_role;
