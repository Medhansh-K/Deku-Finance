-- Migration 20: Maker-checker approval for vouchers
-- Deku Finance
--
-- 1. Per-company switch `require_journal_approval`: when on, a voucher must be submitted for
--    approval and posted by a different person (owner/CFO/admin) than the one who made it.
-- 2. `created_by` is stamped from the session and can't be forged, so "who made it" is reliable.
-- 3. Restores the safeguards migration 16 dropped from post_journal_entry: only drafts can be
--    posted (a reversed voucher could be re-posted), closed fiscal periods are respected,
--    the entry date must sit inside its period, and the total must be positive.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS require_journal_approval boolean NOT NULL DEFAULT false;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_journal_entries_pending
  ON public.journal_entries(organisation_id, submitted_at)
  WHERE status = 'draft' AND submitted_at IS NOT NULL;

-- Workflow columns change only through the functions below, never by a direct client UPDATE.
-- Direct PostgREST writes run as role `authenticated`; SECURITY DEFINER functions run as their owner.
CREATE OR REPLACE FUNCTION public.guard_journal_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF current_user IN ('authenticated', 'anon') THEN
      NEW.submitted_at := NULL;
      NEW.submitted_by := NULL;
      NEW.rejected_at := NULL;
      NEW.rejected_by := NULL;
      NEW.rejection_reason := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF current_user IN ('authenticated', 'anon') AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.posted_by IS DISTINCT FROM OLD.posted_by
    OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
    OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
    OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
  ) THEN
    RAISE EXCEPTION 'Voucher status and approval fields can only change through submit, approve or reject';
  END IF;

  -- Editing a submitted voucher sends it back to the maker's draft stage.
  IF current_user IN ('authenticated', 'anon') AND OLD.submitted_at IS NOT NULL THEN
    NEW.submitted_at := NULL;
    NEW.submitted_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_journal_workflow ON public.journal_entries;
CREATE TRIGGER trg_guard_journal_workflow
  BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_journal_workflow();

CREATE OR REPLACE FUNCTION public.submit_journal_for_approval(p_org_id uuid, p_entry_id uuid)
RETURNS public.journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.journal_entries;
  v_lines int;
  v_debit numeric(15, 2);
  v_credit numeric(15, 2);
BEGIN
  IF NOT public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: cannot submit vouchers for approval';
  END IF;

  SELECT * INTO v_entry FROM public.journal_entries
  WHERE id = p_entry_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  IF v_entry.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft vouchers can be submitted (status: %)', v_entry.status;
  END IF;

  SELECT count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  INTO v_lines, v_debit, v_credit
  FROM public.journal_entry_lines
  WHERE journal_entry_id = p_entry_id AND organisation_id = p_org_id;
  IF v_lines < 2 OR v_debit <= 0 OR v_debit <> v_credit THEN
    RAISE EXCEPTION 'Voucher must have at least 2 lines and balance before it can be submitted';
  END IF;

  UPDATE public.journal_entries
  SET submitted_at = now(), submitted_by = auth.uid(),
      rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;
  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_journal_entry(p_org_id uuid, p_entry_id uuid, p_reason text)
RETURNS public.journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.journal_entries;
BEGIN
  IF NOT (public.is_superadmin() OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[])) THEN
    RAISE EXCEPTION 'Permission denied: only the owner, CFO or admin can reject vouchers';
  END IF;
  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to reject a voucher';
  END IF;

  SELECT * INTO v_entry FROM public.journal_entries
  WHERE id = p_entry_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  IF v_entry.status <> 'draft' OR v_entry.submitted_at IS NULL THEN
    RAISE EXCEPTION 'Only vouchers awaiting approval can be rejected';
  END IF;

  UPDATE public.journal_entries
  SET rejected_at = now(), rejected_by = auth.uid(), rejection_reason = trim(p_reason),
      submitted_at = NULL, submitted_by = NULL
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;
  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_journal_entry(p_org_id uuid, p_entry_id uuid)
RETURNS public.journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.journal_entries;
  v_fiscal public.fiscal_periods;
  v_require_approval boolean;
  v_lines int;
  v_debit numeric(15, 2);
  v_credit numeric(15, 2);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.is_superadmin()
    OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[])
  ) THEN
    RAISE EXCEPTION 'Segregation of Duties Violation: Only the Owner, CFO, or Admin can approve and post vouchers to the immutable ledger. Accountants may only create drafts.';
  END IF;

  SELECT * INTO v_entry FROM public.journal_entries
  WHERE id = p_entry_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  IF v_entry.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft entries can be posted (Current status: %)', v_entry.status;
  END IF;

  SELECT require_journal_approval INTO v_require_approval FROM public.organisations WHERE id = p_org_id;
  -- Entries created earlier in this same transaction are system-generated (invoice issuance,
  -- reversals) and post immediately; a person's approval always arrives in a later request.
  IF v_require_approval AND auth.uid() IS NOT NULL AND v_entry.created_at < now() THEN
    IF v_entry.submitted_at IS NULL THEN
      RAISE EXCEPTION 'Approval required: submit this voucher for approval before posting';
    END IF;
    IF auth.uid() IN (v_entry.created_by, v_entry.submitted_by) THEN
      RAISE EXCEPTION 'Maker-checker: you cannot approve a voucher you created or submitted';
    END IF;
  END IF;

  SELECT * INTO v_fiscal FROM public.fiscal_periods
  WHERE id = v_entry.fiscal_period_id AND organisation_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned fiscal period not found';
  END IF;
  IF v_fiscal.status <> 'open' THEN
    RAISE EXCEPTION 'Cannot post into a closed fiscal period (%)', v_fiscal.name;
  END IF;
  IF v_entry.entry_date < v_fiscal.start_date OR v_entry.entry_date > v_fiscal.end_date THEN
    RAISE EXCEPTION 'Entry date (%) falls outside fiscal period bounds (% to %)',
      v_entry.entry_date, v_fiscal.start_date, v_fiscal.end_date;
  END IF;

  SELECT count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  INTO v_lines, v_debit, v_credit
  FROM public.journal_entry_lines
  WHERE journal_entry_id = p_entry_id AND organisation_id = p_org_id;
  IF v_lines < 2 THEN
    RAISE EXCEPTION 'Double-entry failure: A posted journal entry must have at least 2 lines (Found %)', v_lines;
  END IF;
  IF v_debit <= 0 THEN
    RAISE EXCEPTION 'Double-entry failure: Total entry value must be strictly positive';
  END IF;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Out of balance: Total debits (%) do not equal total credits (%)', v_debit, v_credit;
  END IF;

  UPDATE public.journal_entries
  SET status = 'posted', posted_at = now(), posted_by = auth.uid(), updated_at = now()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  PERFORM public.record_user_activity(
    p_org_id,
    'VOUCHER',
    'Voucher Posted to Universal Ledger',
    format('Posted voucher %s to the general ledger', v_entry.entry_number),
    'journal_entry',
    v_entry.id::text,
    'Finance Authority',
    'CFO / Admin',
    'success',
    jsonb_build_object('entry_number', v_entry.entry_number, 'entry_date', v_entry.entry_date)
  );

  RETURN v_entry;
END;
$$;

-- New functions follow migration 18: signed-in users only.
REVOKE EXECUTE ON FUNCTION public.submit_journal_for_approval(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_journal_entry(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.post_journal_entry(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_journal_for_approval(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_journal_entry(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(uuid, uuid) TO authenticated, service_role;

-- GST returns read the company GSTIN; reject malformed values at the source.
-- NOT VALID: existing rows aren't re-checked, so this migration can't fail on old data.
ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_gstin_format;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_gstin_format
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') NOT VALID;
