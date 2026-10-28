-- Migration 19: Bank reconciliation
-- Deku Finance - record which bank statement line a posted journal line was confirmed against.
-- Posted journal lines are immutable (migration 6), so reconciliation lives in its own table.

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL,
  statement_date date NOT NULL,
  -- Positive = deposit into the bank, negative = withdrawal.
  statement_amount numeric(15, 2) NOT NULL CHECK (statement_amount <> 0),
  statement_reference text,
  statement_narration text,
  journal_entry_line_id uuid NOT NULL,
  reconciled_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_bank_reconciliations_line UNIQUE (organisation_id, journal_entry_line_id),
  CONSTRAINT fk_bank_reconciliations_account FOREIGN KEY (organisation_id, bank_account_id)
    REFERENCES public.accounts(organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_bank_reconciliations_line FOREIGN KEY (organisation_id, journal_entry_line_id)
    REFERENCES public.journal_entry_lines(organisation_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account
  ON public.bank_reconciliations(organisation_id, bank_account_id, statement_date);

-- The API accepts any line id, so the database checks the line really is a posted entry on this
-- bank account with the same amount and direction as the statement line.
CREATE OR REPLACE FUNCTION public.guard_bank_reconciliation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.journal_entry_lines l
    JOIN public.journal_entries e ON e.id = l.journal_entry_id
    WHERE l.id = NEW.journal_entry_line_id
      AND l.organisation_id = NEW.organisation_id
      AND l.account_id = NEW.bank_account_id
      AND e.status = 'posted'
      AND l.debit - l.credit = NEW.statement_amount
  ) THEN
    RAISE EXCEPTION 'Reconciliation Violation: journal line is not a posted entry on this bank account for %', NEW.statement_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_bank_reconciliation ON public.bank_reconciliations;
CREATE TRIGGER trg_guard_bank_reconciliation
  BEFORE INSERT OR UPDATE ON public.bank_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_bank_reconciliation();

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_reconciliations_select"
  ON public.bank_reconciliations FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "bank_reconciliations_insert"
  ON public.bank_reconciliations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
    AND reconciled_by = auth.uid()
  );

-- No UPDATE policy: a wrong match is undone by deleting it and confirming again.
CREATE POLICY "bank_reconciliations_delete"
  ON public.bank_reconciliations FOR DELETE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[])
  );
