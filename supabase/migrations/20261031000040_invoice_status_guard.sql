-- Migration 40: invoices can only be issued through issue_sales_invoice
-- Deku Finance
--
-- The update policy from migration 7 checked the row was a draft BEFORE the change but not after,
-- so a signed-in user could UPDATE status to 'issued' (or link any journal) directly, skipping
-- every check issue_sales_invoice enforces: tax split, totals, invoice type, plan limits and the
-- atomic journal. The new row must still be an unlinked draft; issuing and cancelling stay with
-- the SECURITY DEFINER functions, which bypass RLS.

DROP POLICY IF EXISTS "sales_invoices_update_draft" ON public.sales_invoices;
CREATE POLICY "sales_invoices_update_draft"
  ON public.sales_invoices FOR UPDATE TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant', 'member']::public.organisation_role[])
    AND status = 'draft'
    AND journal_entry_id IS NULL
  );

-- Self-check: the policy must now reject issuing by plain UPDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_invoices' AND policyname = 'sales_invoices_update_draft'
      AND with_check LIKE '%status = ''draft''%'
  ) THEN
    RAISE EXCEPTION 'sales_invoices update policy does not pin status to draft';
  END IF;
END $$;
