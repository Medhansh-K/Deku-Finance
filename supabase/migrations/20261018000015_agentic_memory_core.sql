-- Migration 15: Agentic Memory Core, Document Extractions, GSTR-2B & Webhooks
-- Deku Finance - Core Data Foundation

-- 0. Relax invoice_documents constraint to support standalone commercial documents (vendor bills, biltis, bank statements)
DO $$
BEGIN
  -- Make invoice_id nullable so raw commercial files can be vaulted prior to invoice creation
  ALTER TABLE public.invoice_documents ALTER COLUMN invoice_id DROP NOT NULL;

  -- Relax strict foreign key constraint to permit NULLs
  ALTER TABLE public.invoice_documents DROP CONSTRAINT IF EXISTS fk_invoice_documents_invoice;
  ALTER TABLE public.invoice_documents
    ADD CONSTRAINT fk_invoice_documents_invoice
    FOREIGN KEY (organisation_id, invoice_id)
    REFERENCES public.sales_invoices(organisation_id, id) ON DELETE SET NULL;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Expand invoice-vault storage bucket to support commercial document image formats (PNG, JPG, WEBP) alongside PDF
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
WHERE id = 'invoice-vault';

-- 1. Document Extractions Table (Layer 1: Document Memory)
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  document_id uuid,
  storage_path text NOT NULL,
  sha256_hash text NOT NULL,
  sarvam_job_id text,
  document_nature text NOT NULL CHECK (document_nature IN ('printed', 'handwritten', 'mixed')) DEFAULT 'mixed',
  detected_language text DEFAULT 'en-IN',
  raw_markdown_output text NOT NULL DEFAULT '',
  ufo_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric(4,3) NOT NULL DEFAULT 1.000,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_doc_extractions_org UNIQUE (organisation_id, id),
  CONSTRAINT fk_doc_extractions_document FOREIGN KEY (organisation_id, document_id)
    REFERENCES public.invoice_documents(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_extractions_org_hash ON public.document_extractions(organisation_id, sha256_hash);
CREATE INDEX IF NOT EXISTS idx_doc_extractions_doc_id ON public.document_extractions(document_id);

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_extractions_select" ON public.document_extractions;
CREATE POLICY "doc_extractions_select"
  ON public.document_extractions FOR SELECT TO authenticated
  USING (
    public.is_org_member(organisation_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "doc_extractions_all" ON public.document_extractions;
CREATE POLICY "doc_extractions_all"
  ON public.document_extractions FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    OR auth.role() = 'service_role'
  );

-- 2. Agent Sessions (Layer 2: Event Memory)
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  document_id uuid,
  goal_prompt text NOT NULL DEFAULT 'Process commercial document to ALERX voucher',
  status text NOT NULL CHECK (status IN (
    'planning', 
    'extracting_sarvam', 
    'reasoning', 
    'waiting_human_approval', 
    'approved', 
    'rejected', 
    'posted'
  )) DEFAULT 'planning',
  overall_confidence numeric(4,3) DEFAULT 1.000,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_agent_sessions_org UNIQUE (organisation_id, id),
  CONSTRAINT fk_agent_sessions_document FOREIGN KEY (organisation_id, document_id)
    REFERENCES public.invoice_documents(organisation_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_org_status ON public.agent_sessions(organisation_id, status);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_sessions_select" ON public.agent_sessions;
CREATE POLICY "agent_sessions_select"
  ON public.agent_sessions FOR SELECT TO authenticated
  USING (
    public.is_org_member(organisation_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "agent_sessions_all" ON public.agent_sessions;
CREATE POLICY "agent_sessions_all"
  ON public.agent_sessions FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    OR auth.role() = 'service_role'
  );

-- 3. Agent Events (Layer 2: Episodic Thought & Tool Trajectory)
CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  step_index int NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('thought', 'plan', 'tool_call', 'tool_result', 'human_edit', 'verification')),
  title text NOT NULL,
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_agent_events_step UNIQUE (session_id, step_index),
  CONSTRAINT uk_agent_events_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_agent_events_session FOREIGN KEY (organisation_id, session_id)
    REFERENCES public.agent_sessions(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_events_session ON public.agent_events(session_id, step_index);

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_events_select" ON public.agent_events;
CREATE POLICY "agent_events_select"
  ON public.agent_events FOR SELECT TO authenticated
  USING (
    public.is_org_member(organisation_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "agent_events_all" ON public.agent_events;
CREATE POLICY "agent_events_all"
  ON public.agent_events FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    OR auth.role() = 'service_role'
  );

-- 4. Agent Staging Voucher Proposals (Bridge between Layer 2 and Layer 3)
CREATE TABLE IF NOT EXISTS public.agent_voucher_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  document_id uuid NOT NULL,
  voucher_type text NOT NULL CHECK (voucher_type IN ('contra', 'payment', 'receipt', 'journal', 'sales', 'purchase')),
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  party_id uuid,
  header_memo text,
  proposed_lines jsonb NOT NULL,
  total_debit numeric(15,2) NOT NULL DEFAULT 0.00,
  total_credit numeric(15,2) NOT NULL DEFAULT 0.00,
  is_balanced boolean GENERATED ALWAYS AS (total_debit = total_credit) STORED,
  approval_status text NOT NULL CHECK (approval_status IN ('waiting_approval', 'approved', 'rejected')) DEFAULT 'waiting_approval',
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  posted_journal_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_agent_voucher_proposals_org UNIQUE (organisation_id, id),
  CONSTRAINT fk_voucher_proposals_session FOREIGN KEY (organisation_id, session_id)
    REFERENCES public.agent_sessions(organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_proposals_document FOREIGN KEY (organisation_id, document_id)
    REFERENCES public.invoice_documents(organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_proposals_party FOREIGN KEY (organisation_id, party_id)
    REFERENCES public.parties(organisation_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_voucher_proposals_journal FOREIGN KEY (organisation_id, posted_journal_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_voucher_proposals_org_status ON public.agent_voucher_proposals(organisation_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_voucher_proposals_doc_id ON public.agent_voucher_proposals(document_id);

ALTER TABLE public.agent_voucher_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_voucher_proposals_select" ON public.agent_voucher_proposals;
CREATE POLICY "agent_voucher_proposals_select"
  ON public.agent_voucher_proposals FOR SELECT TO authenticated
  USING (
    public.is_org_member(organisation_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "agent_voucher_proposals_all" ON public.agent_voucher_proposals;
CREATE POLICY "agent_voucher_proposals_all"
  ON public.agent_voucher_proposals FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    OR auth.role() = 'service_role'
  );

-- 5. GSTR-2B Inward Supplies Table (Statutory Tax Matching Engine)
CREATE TABLE IF NOT EXISTS public.gst_inward_supplies_2b (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  return_period text NOT NULL, -- Format: MMYYYY (e.g. 102026)
  supplier_gstin text NOT NULL,
  supplier_trade_name text,
  invoice_number text NOT NULL,
  invoice_type text NOT NULL DEFAULT 'R',
  invoice_date date NOT NULL,
  invoice_value numeric(15,2) NOT NULL DEFAULT 0.00,
  place_of_supply text NOT NULL,
  reverse_charge boolean NOT NULL DEFAULT false,
  taxable_value numeric(15,2) NOT NULL DEFAULT 0.00,
  igst_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  cgst_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  sgst_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  cess_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  itc_available text NOT NULL CHECK (itc_available IN ('Y', 'N')) DEFAULT 'Y',
  itc_reason text,
  reconciliation_status text NOT NULL CHECK (reconciliation_status IN ('pending', 'matched', 'mismatched', 'missing_in_books')) DEFAULT 'pending',
  matched_voucher_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_gst_2b_item UNIQUE (organisation_id, return_period, supplier_gstin, invoice_number),
  CONSTRAINT uk_gst_2b_org_id UNIQUE (organisation_id, id),
  CONSTRAINT fk_gst_2b_matched_journal FOREIGN KEY (organisation_id, matched_voucher_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gst_2b_org_period ON public.gst_inward_supplies_2b(organisation_id, return_period);
CREATE INDEX IF NOT EXISTS idx_gst_2b_supplier_gstin ON public.gst_inward_supplies_2b(supplier_gstin);

ALTER TABLE public.gst_inward_supplies_2b ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gst_2b_select" ON public.gst_inward_supplies_2b;
CREATE POLICY "gst_2b_select"
  ON public.gst_inward_supplies_2b FOR SELECT TO authenticated
  USING (
    public.is_org_member(organisation_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "gst_2b_all" ON public.gst_inward_supplies_2b;
CREATE POLICY "gst_2b_all"
  ON public.gst_inward_supplies_2b FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
    OR auth.role() = 'service_role'
  );

-- 6. Integration Webhooks Idempotency & Audit Table
CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('razorpay', 'gsp', 'cashfree', 'custom')),
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('received', 'processed', 'failed', 'ignored')) DEFAULT 'received',
  error_message text,
  journal_entry_id uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_integration_webhooks_event UNIQUE (provider, event_id),
  CONSTRAINT uk_integration_webhooks_org_id UNIQUE (id),
  CONSTRAINT fk_webhooks_journal FOREIGN KEY (organisation_id, journal_entry_id)
    REFERENCES public.journal_entries(organisation_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhooks_provider_status ON public.integration_webhooks(provider, status);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON public.integration_webhooks(organisation_id);

ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_webhooks_select" ON public.integration_webhooks;
CREATE POLICY "integration_webhooks_select"
  ON public.integration_webhooks FOR SELECT TO authenticated
  USING (
    organisation_id IS NULL OR public.is_org_member(organisation_id) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "integration_webhooks_all" ON public.integration_webhooks;
CREATE POLICY "integration_webhooks_all"
  ON public.integration_webhooks FOR ALL TO authenticated
  USING (
    auth.role() = 'service_role'
    OR (organisation_id IS NOT NULL AND public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]))
  );

