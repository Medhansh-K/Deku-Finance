-- Migration 9: Audit Trail and Performance Optimization
-- Deku Finance - Audit Logging & Database-Wide Index Optimization

-- 1. Audit Events Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Guard Trigger: Strict Immutability for Audit Records
CREATE OR REPLACE FUNCTION public.guard_audit_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: Audit records are permanently append-only and cannot be altered or removed';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_audit_events ON public.audit_events;
CREATE TRIGGER trg_guard_audit_events
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_audit_immutability();

-- 3. Audit Logging Security Definer Helper
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.audit_events (
    organisation_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_org_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 4. Row Level Security for Audit Events
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_events_select"
  ON public.audit_events FOR SELECT TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
  );

CREATE POLICY "audit_events_insert"
  ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organisation_id)
  );

-- 5. Comprehensive Database Performance Indexes

-- Audit Trail Indexes
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created
  ON public.audit_events(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON public.audit_events(organisation_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON public.audit_events(organisation_id, actor_id);

-- Invoicing Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sales_invoices_query
  ON public.sales_invoices(organisation_id, status, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_number_search
  ON public.sales_invoices(organisation_id, invoice_number);

-- Journal & Ledger Performance Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_query
  ON public.journal_entries(organisation_id, status, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_ledger
  ON public.journal_entry_lines(organisation_id, account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_search
  ON public.journal_entry_lines(journal_entry_id, line_number);

-- Master Data Query Indexes
CREATE INDEX IF NOT EXISTS idx_parties_search
  ON public.parties(organisation_id, is_active, display_name);
CREATE INDEX IF NOT EXISTS idx_catalogue_search
  ON public.catalogue_items(organisation_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_accounts_hierarchy
  ON public.accounts(organisation_id, type, code);
