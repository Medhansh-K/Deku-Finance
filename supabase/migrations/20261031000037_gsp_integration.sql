-- Migration 37: GST Suvidha Provider (GSP) integration: portal sessions, e-invoices (IRN), e-way bills
-- Deku Finance - provider-neutral; no GSP has been chosen (docs/IMPLEMENTATION_PLAN.md §6). The backend
-- adapter (backend/src/integrations/gsp.rs) stays switched off until GSP_PROVIDER is set.
--
-- Members read their company's rows. Every write comes from the backend with its service token, after
-- the backend has checked the caller's role with the caller's own token, so authenticated can't write.

-- ---------------------------------------------------------------------------------------------
-- gsp_connections: one per company
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9_]+$'),
  gstin text NOT NULL CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  -- AES-256-GCM (backend/src/crypto.rs) of the portal username and session token. service_role only.
  credentials_enc text,
  session_expires_at timestamptz,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'otp_pending', 'connected', 'error')),
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 500),
  enabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_gsp_connections_connected CHECK (
    status <> 'connected' OR (credentials_enc IS NOT NULL AND session_expires_at IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS trg_gsp_connections_updated_at ON public.gsp_connections;
CREATE TRIGGER trg_gsp_connections_updated_at
  BEFORE UPDATE ON public.gsp_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- e_invoices: IRNs from the Invoice Registration Portal (through the GSP)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.e_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sales_invoice_id uuid NOT NULL,
  provider text NOT NULL,
  irn text NOT NULL UNIQUE,
  ack_no text,
  ack_date timestamptz,
  signed_qr text,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'cancelled')),
  cancel_reason text,
  cancelled_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Composite key: an IRN can only point at an invoice of the same company, and the
  -- invoice can't be deleted while it has one.
  CONSTRAINT fk_e_invoices_invoice FOREIGN KEY (organisation_id, sales_invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id),
  CONSTRAINT chk_e_invoices_cancelled CHECK (
    (status = 'cancelled') = (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL)
  )
);

-- A cancelled IRN can be followed by a new one (on a new invoice number), never two live ones.
CREATE UNIQUE INDEX IF NOT EXISTS uk_e_invoices_live
  ON public.e_invoices(sales_invoice_id) WHERE status = 'generated';
CREATE INDEX IF NOT EXISTS idx_e_invoices_org ON public.e_invoices(organisation_id);

-- ---------------------------------------------------------------------------------------------
-- eway_bills
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eway_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sales_invoice_id uuid NOT NULL,
  provider text NOT NULL,
  ewb_no text NOT NULL UNIQUE,
  valid_upto timestamptz,
  vehicle_no text CHECK (vehicle_no IS NULL OR vehicle_no ~ '^[A-Z0-9]{4,20}$'),
  transporter_id text CHECK (transporter_id IS NULL OR transporter_id ~ '^[0-9A-Z]{15}$'),
  -- The e-way bill system caps the approximate distance at 4000 km.
  distance_km integer NOT NULL CHECK (distance_km BETWEEN 0 AND 4000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancel_reason text,
  cancelled_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_eway_bills_invoice FOREIGN KEY (organisation_id, sales_invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id),
  CONSTRAINT chk_eway_bills_cancelled CHECK (
    (status = 'cancelled') = (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_eway_bills_live
  ON public.eway_bills(sales_invoice_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_eway_bills_org ON public.eway_bills(organisation_id);

-- ---------------------------------------------------------------------------------------------
-- gsp_requests: what Deku asked the GSP and whether it worked. Never request or response bodies,
-- credentials, OTPs or session tokens.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'otp_start', 'otp_verify', 'evc_otp', 'file_return', 'generate_irn', 'cancel_irn', 'generate_ewb', 'cancel_ewb'
  )),
  -- What it was about: "GSTR1:102026" or a sales invoice id.
  ref text CHECK (ref IS NULL OR length(ref) <= 100),
  status text NOT NULL CHECK (status IN ('ok', 'error')),
  error text CHECK (error IS NULL OR length(error) <= 500),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsp_requests_org_at ON public.gsp_requests(organisation_id, at DESC);

-- ---------------------------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON public.gsp_connections, public.e_invoices, public.eway_bills, public.gsp_requests
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.e_invoices, public.eway_bills, public.gsp_requests TO authenticated;
-- Column grant: credentials_enc is left out, so even a member's select of it is refused.
GRANT SELECT (id, organisation_id, provider, gstin, session_expires_at, status, last_error,
              enabled_by, enabled_at, created_at, updated_at)
  ON public.gsp_connections TO authenticated;
GRANT ALL ON public.gsp_connections, public.e_invoices, public.eway_bills, public.gsp_requests TO service_role;

ALTER TABLE public.gsp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.e_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eway_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsp_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gsp_connections', 'e_invoices', 'eway_bills', 'gsp_requests'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(organisation_id))',
      t || '_select', t);
    -- Cloud SQL may create service_role without BYPASSRLS (migration 000), so it needs a policy.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service', t);
  END LOOP;
END $$;
