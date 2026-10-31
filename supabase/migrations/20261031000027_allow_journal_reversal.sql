-- Migration 27: let reverse_journal_entry mark the original entry 'reversed'
-- Deku Finance
--
-- guard_journal_immutability (migration 6) blocks every UPDATE of a posted entry, including the
-- one reverse_journal_entry makes to set status = 'reversed', so no reversal could ever succeed.
-- Allow exactly that transition: posted -> reversed with nothing else changed but updated_at.
-- Direct client updates still can't do it: guard_journal_workflow (migration 20) blocks status
-- changes from the API roles, so only the SECURITY DEFINER reversal function reaches this path.

CREATE OR REPLACE FUNCTION public.guard_journal_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'posted' AND NEW.status = 'reversed'
       AND (to_jsonb(NEW) - 'status' - 'updated_at') = (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RETURN NEW;
    END IF;
    IF OLD.status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION 'Accounting Violation: Posted or reversed journal entries are immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION 'Accounting Violation: Posted or reversed journal entries cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_journal_immutability() FROM PUBLIC, anon;
