-- Deku Finance - edit a draft voucher: replace its header fields and lines in one step.
--
-- SECURITY DEFINER, so it passes row-level security and guard_journal_workflow (migration 20) and must
-- make their checks itself. The immutability triggers (migrations 6 and 27) still apply underneath.

-- A voucher awaiting approval keeps the figures the checker is reviewing. Every system flow writes its
-- lines before it submits (migrations 35, 36, 42, 43), so none of them meets this.
CREATE OR REPLACE FUNCTION public.guard_journal_lines_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_status public.journal_entry_status;
  v_parent_submitted_at timestamptz;
BEGIN
  SELECT status, submitted_at INTO v_parent_status, v_parent_submitted_at
  FROM public.journal_entries
  WHERE id = COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);

  IF v_parent_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'Accounting Violation: Lines belonging to a posted or reversed entry cannot be modified or deleted';
  END IF;
  IF v_parent_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Accounting Violation: Lines of a voucher awaiting approval cannot be modified or deleted';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_draft_journal(
  p_org_id uuid,
  p_entry_id uuid,
  p_entry_date date,
  p_narration text,
  p_reference text,
  p_lines jsonb
)
RETURNS public.journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.journal_entries;
  v_fiscal_id uuid;
  v_previous_total numeric(15, 2);
BEGIN
  -- The roles of the insert policies on journal_entries and journal_entry_lines (migration 5).
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: cannot edit vouchers';
  END IF;

  -- Taken by post, submit and reject too, so none of them can overlap an edit.
  SELECT * INTO v_entry FROM public.journal_entries
  WHERE id = p_entry_id AND organisation_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  IF v_entry.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft vouchers can be edited (status: %)', v_entry.status;
  END IF;
  IF v_entry.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This voucher is awaiting approval and cannot be edited. The approver can send it back first.';
  END IF;

  -- post_journal_entry only knows the maker and the submitter: a checker who changed the figures
  -- could otherwise approve their own numbers once the maker resubmits.
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_entry.created_by
     AND (SELECT require_journal_approval FROM public.organisations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Maker-checker: only the person who made this voucher can edit it';
  END IF;

  -- These vouchers carry a document's or stock movement's figures, which an edit would leave disagreeing.
  IF v_entry.entry_number LIKE 'STK-%'
     OR EXISTS (SELECT 1 FROM public.sales_invoices WHERE organisation_id = p_org_id AND journal_entry_id = p_entry_id)
     OR EXISTS (SELECT 1 FROM public.sales_notes WHERE organisation_id = p_org_id AND journal_entry_id = p_entry_id)
     OR EXISTS (SELECT 1 FROM public.purchase_bills WHERE organisation_id = p_org_id AND journal_entry_id = p_entry_id)
     OR EXISTS (SELECT 1 FROM public.marketplace_settlements WHERE organisation_id = p_org_id AND journal_entry_id = p_entry_id)
     OR EXISTS (SELECT 1 FROM public.gateway_payments WHERE organisation_id = p_org_id AND journal_entry_id = p_entry_id) THEN
    RAISE EXCEPTION 'This voucher comes from an invoice, note, bill, settlement, payment or stock movement, so it cannot be edited here.';
  END IF;

  IF coalesce(btrim(p_narration), '') = '' THEN
    RAISE EXCEPTION 'A voucher needs a narration';
  END IF;
  -- Balance is checked at submit and post, as it is for a draft saved the first time.
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'A voucher needs at least 2 lines';
  END IF;

  SELECT id INTO v_fiscal_id FROM public.fiscal_periods
  WHERE organisation_id = p_org_id AND status = 'open' AND p_entry_date BETWEEN start_date AND end_date
  LIMIT 1;
  IF v_fiscal_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal period covers %. Add or reopen one in Settings.', p_entry_date;
  END IF;

  SELECT coalesce(sum(debit), 0) INTO v_previous_total
  FROM public.journal_entry_lines WHERE journal_entry_id = p_entry_id;

  DELETE FROM public.journal_entry_lines WHERE journal_entry_id = p_entry_id;

  -- The composite foreign keys keep accounts and parties inside this company.
  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, party_id, description, debit, credit)
  SELECT p_org_id, p_entry_id, t.ord, (t.line ->> 'account_id')::uuid, nullif(t.line ->> 'party_id', '')::uuid, t.line ->> 'description',
    coalesce((t.line ->> 'debit')::numeric, 0), coalesce((t.line ->> 'credit')::numeric, 0)
  FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(line, ord);

  UPDATE public.journal_entries
  SET entry_date = p_entry_date, fiscal_period_id = v_fiscal_id, narration = btrim(p_narration),
      reference = nullif(btrim(p_reference), ''),
      rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL, updated_at = now()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  PERFORM public.record_user_activity(
    p_org_id,
    'VOUCHER',
    'Draft Voucher Edited',
    format('Edited draft voucher %s', v_entry.entry_number),
    'journal_entry',
    v_entry.id::text,
    'Authenticated User',
    'Member',
    'success',
    jsonb_build_object('entry_number', v_entry.entry_number, 'previous_total', v_previous_total)
  );

  RETURN v_entry;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edit_draft_journal(uuid, uuid, date, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_draft_journal(uuid, uuid, date, text, text, jsonb) TO authenticated, service_role;
