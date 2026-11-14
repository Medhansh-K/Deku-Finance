-- Migration: 20261114000068_gsp_live_connector.sql
-- Description: Client-End ERP Kernel: Live GSP Gateway Configuration (Sandbox.co.in / Cleartax / Masters India), E-Invoice IRN & E-Way Bill Auto-Sync.

CREATE TABLE IF NOT EXISTS public.gsp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'sandbox_co_in' CHECK (provider IN ('sandbox_co_in', 'masters_india', 'cleartax', 'iris')),
  gstin TEXT NOT NULL,
  username TEXT,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  auth_token_encrypted TEXT,
  token_expiry TIMESTAMPTZ,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  e_invoice_min_threshold NUMERIC(15, 2) NOT NULL DEFAULT 50000.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_gsp_credentials_org_provider UNIQUE (organisation_id, provider, gstin)
);

CREATE INDEX IF NOT EXISTS idx_gsp_credentials_org ON public.gsp_credentials(organisation_id);

-- Enable RLS
ALTER TABLE public.gsp_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY gsp_credentials_org_isolation ON public.gsp_credentials
  FOR ALL
  USING (organisation_id = (current_setting('app.current_organisation_id', true))::uuid)
  WITH CHECK (organisation_id = (current_setting('app.current_organisation_id', true))::uuid);

-- GSP Transmission Audit Log
CREATE TABLE IF NOT EXISTS public.gsp_transmission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('irn_generation', 'irn_cancellation', 'eway_bill_generation', 'eway_bill_cancellation', 'gstr_sync')),
  reference_id TEXT, -- e.g. invoice id or e-way bill number
  request_payload JSONB,
  response_payload JSONB,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsp_logs_org ON public.gsp_transmission_logs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_gsp_logs_ref ON public.gsp_transmission_logs(reference_id);

-- Enable RLS
ALTER TABLE public.gsp_transmission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY gsp_logs_org_isolation ON public.gsp_transmission_logs
  FOR ALL
  USING (organisation_id = (current_setting('app.current_organisation_id', true))::uuid)
  WITH CHECK (organisation_id = (current_setting('app.current_organisation_id', true))::uuid);
