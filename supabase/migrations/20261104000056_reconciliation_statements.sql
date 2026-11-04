-- Deku Finance - finishing a bank reconciliation: a statement-level record of the closing balance
-- against the books at that date. The database works out the figures, so a caller can't record its own.
--
-- What the bank must show = everything matched up to the date + statement lines not yet in the books.
-- closing - that = the unexplained difference, which has to be zero or accepted at the exact amount.

CREATE TABLE IF NOT EXISTS public.reconciliation_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL,
  statement_date date NOT NULL,
  closing_balance numeric(15, 2) NOT NULL,
  -- Filled by the trigger below from the ledger and matches.
  book_balance numeric(15, 2) NOT NULL,
  matched_amount numeric(15, 2) NOT NULL,
  uncleared_amount numeric(15, 2) NOT NULL,
  difference numeric(15, 2) NOT NULL,
  unexplained_difference numeric(15, 2) NOT NULL,
  -- From the caller: the statement isn't kept, so only the browser can add up its open lines.
  statement_only_amount numeric(15, 2) NOT NULL DEFAULT 0,
  accepted_difference numeric(15, 2),
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- A snapshot, so the record still says who after they leave the company.
  recorded_by_name text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_reconciliation_statements_date UNIQUE (organisation_id, bank_account_id, statement_date),
  CONSTRAINT fk_reconciliation_statements_account FOREIGN KEY (organisation_id, bank_account_id)
    REFERENCES public.accounts(organisation_id, id) ON DELETE RESTRICT
);

-- Book balance counts posted and reversed entries, as the reports do: a reversal is a posted entry
-- of its own, so the pair nets to zero once both are dated on or before the date. Drafts never count.
-- SECURITY DEFINER: journal_entries RLS hides entries from viewers and analysts, who would see a false
-- zero; they can already read the bank balance in the trial balance. So: membership checked, org filtered.
CREATE OR REPLACE FUNCTION public.bank_reconciliation_position(p_org_id uuid, p_bank_account_id uuid, p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book numeric(15, 2);
  v_uncleared numeric(15, 2);
  v_matched numeric(15, 2);
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not a member of this company';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_bank_account_id AND organisation_id = p_org_id AND type = 'asset' AND is_postable
  ) THEN
    RAISE EXCEPTION 'The bank account is not a postable asset account of this company';
  END IF;

  SELECT
    coalesce(sum(l.debit - l.credit), 0),
    coalesce(sum(l.debit - l.credit) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM public.bank_reconciliations r
      WHERE r.journal_entry_line_id = l.id AND r.statement_date <= p_as_of
    )), 0)
  INTO v_book, v_uncleared
  FROM public.journal_entry_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE l.organisation_id = p_org_id
    AND l.account_id = p_bank_account_id
    AND e.status IN ('posted', 'reversed')
    AND e.entry_date <= p_as_of;

  -- By statement date, so a line the bank shows before its voucher date still counts as matched.
  SELECT coalesce(sum(r.statement_amount), 0) INTO v_matched
  FROM public.bank_reconciliations r
  WHERE r.organisation_id = p_org_id AND r.bank_account_id = p_bank_account_id AND r.statement_date <= p_as_of;

  RETURN jsonb_build_object('book_balance', v_book, 'matched_amount', v_matched, 'uncleared_amount', v_uncleared);
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_reconciliation_statement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_position jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'A completed reconciliation is a permanent record and cannot be changed';
  END IF;

  v_position := public.bank_reconciliation_position(NEW.organisation_id, NEW.bank_account_id, NEW.statement_date);
  NEW.book_balance := (v_position->>'book_balance')::numeric;
  NEW.matched_amount := (v_position->>'matched_amount')::numeric;
  NEW.uncleared_amount := (v_position->>'uncleared_amount')::numeric;
  NEW.difference := NEW.closing_balance - NEW.book_balance;
  NEW.unexplained_difference := NEW.closing_balance - NEW.matched_amount - NEW.statement_only_amount;

  -- The exact amount, so nobody accepts a figure that has moved since they looked at it.
  IF NEW.unexplained_difference = 0 THEN
    NEW.accepted_difference := NULL;
  ELSIF NEW.accepted_difference IS DISTINCT FROM NEW.unexplained_difference THEN
    RAISE EXCEPTION 'difference_not_accepted: % is unexplained', NEW.unexplained_difference;
  END IF;

  NEW.recorded_by := auth.uid();
  NEW.recorded_at := now();
  SELECT coalesce(nullif(p.full_name, ''), p.email) INTO NEW.recorded_by_name FROM public.profiles p WHERE p.id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_reconciliation_statement ON public.reconciliation_statements;
CREATE TRIGGER trg_guard_reconciliation_statement
  BEFORE INSERT OR UPDATE OR DELETE ON public.reconciliation_statements
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_reconciliation_statement();

ALTER TABLE public.reconciliation_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reconciliation_statements_select" ON public.reconciliation_statements;
CREATE POLICY "reconciliation_statements_select"
  ON public.reconciliation_statements FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

-- No UPDATE or DELETE policy: immutable once recorded.
DROP POLICY IF EXISTS "reconciliation_statements_insert" ON public.reconciliation_statements;
CREATE POLICY "reconciliation_statements_insert"
  ON public.reconciliation_statements FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND recorded_by = auth.uid()
  );

REVOKE EXECUTE ON FUNCTION public.bank_reconciliation_position(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bank_reconciliation_position(uuid, uuid, date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_reconciliation_statement() FROM PUBLIC, anon, authenticated;

-- Migration 52 let a CFO confirm a match but not undo one: the delete matched no rows and looked like success.
DROP POLICY IF EXISTS "bank_reconciliations_delete" ON public.bank_reconciliations;
CREATE POLICY "bank_reconciliations_delete"
  ON public.bank_reconciliations FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
  );
