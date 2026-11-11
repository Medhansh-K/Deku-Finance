-- Migration 30: company profile on the organisation record
-- Deku Finance
--
-- Operating mode, home state, registered address, UPI and bank details, Udyam number,
-- composition scheme and the onboarding timestamp used to live in the browser (localStorage).
-- They now sit on public.organisations, so every device and every member sees the same values.
-- Writes stay owner/admin only through the existing organisations_update_admins policy.
-- No new functions, so nothing to revoke (migration 18/26 rules).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'operating_mode'
  ) THEN
    ALTER TABLE public.organisations
      ADD COLUMN operating_mode text NOT NULL DEFAULT 'pure';
    -- Existing companies: a GSTIN on file means they already run in GST mode.
    UPDATE public.organisations SET operating_mode = 'gst' WHERE gstin IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'onboarded_at'
  ) THEN
    ALTER TABLE public.organisations ADD COLUMN onboarded_at timestamptz;
    -- Companies created before onboarding existed are already in use; don't send them through the wizard.
    UPDATE public.organisations SET onboarded_at = created_at;
  END IF;
END $$;

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS registered_address jsonb,
  ADD COLUMN IF NOT EXISTS upi_vpa text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS bank_beneficiary text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS udyam_number text,
  ADD COLUMN IF NOT EXISTS composition_scheme boolean NOT NULL DEFAULT false;

ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_operating_mode;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_operating_mode
  CHECK (operating_mode IN ('gst', 'pure'));

ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_state_code;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_state_code
  CHECK (state_code IS NULL OR state_code ~ '^[0-9]{2}$');

-- The first two GSTIN digits are the state code, so the two can't disagree.
ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_state_matches_gstin;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_state_matches_gstin
  CHECK (gstin IS NULL OR state_code IS NULL OR left(gstin, 2) = state_code);

ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_registered_address;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_registered_address
  CHECK (registered_address IS NULL OR jsonb_typeof(registered_address) = 'object');

ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_upi_vpa;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_upi_vpa
  CHECK (upi_vpa IS NULL OR upi_vpa ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$');

ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_bank_account_number;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_bank_account_number
  CHECK (bank_account_number IS NULL OR bank_account_number ~ '^[0-9]{9,18}$');

ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_bank_ifsc;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_bank_ifsc
  CHECK (bank_ifsc IS NULL OR bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$');

ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_udyam_number;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_udyam_number
  CHECK (udyam_number IS NULL OR udyam_number ~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$');

-- Only a GST-registered business can opt into the composition scheme.
ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS chk_organisations_composition_needs_gst;
ALTER TABLE public.organisations ADD CONSTRAINT chk_organisations_composition_needs_gst
  CHECK (NOT composition_scheme OR operating_mode = 'gst');
