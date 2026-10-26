-- Migration 16: Superadmin Watcher Tier, 7-Role Enterprise RBAC & Workbench Invitations Engine
-- Deku Finance - Core Data Foundation
-- Architecture Alignment: Platform Superadmin -> Organisation Tenant (GO/PRO) -> 7 Roles -> Departments & Member Invitations

-- ============================================================================
-- 1. Expand public.organisation_role Enum to All 7 Formal Roles
-- ============================================================================
-- Target 7 Roles:
--   1. 'owner'           - License holder, creator, root authority
--   2. 'cfo'             - Finance Manager, final sign-off, budget & payout approval
--   3. 'admin'           - Operations Manager, member invitations, document management
--   4. 'accountant'      - Bookkeeper, CA, data entry, draft vouchers, reconciliation
--   5. 'analyst'         - FP&A, Investor metrics, DSO/DPO analysis, AI chat
--   6. 'auditor'         - Independent Review, full read-only audit & ledger inspection
--   7. 'viewer'          - Passive Stakeholder, macro KPIs and financial reports ONLY
DO $$
BEGIN
  ALTER TYPE public.organisation_role ADD VALUE IF NOT EXISTS 'cfo';
  ALTER TYPE public.organisation_role ADD VALUE IF NOT EXISTS 'analyst';
  ALTER TYPE public.organisation_role ADD VALUE IF NOT EXISTS 'auditor';
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Update employee role constraint in public.employees to support all 7 formal roles
DO $$
BEGIN
  ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
  ALTER TABLE public.employees ADD CONSTRAINT employees_role_check
    CHECK (role IN ('owner', 'cfo', 'admin', 'accountant', 'analyst', 'auditor', 'viewer', 'manager', 'member'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 2. Platform Superadmin Watcher Table & Functions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.superadmins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT 'Platform Superadmin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is Superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.superadmins
    WHERE (
      user_id = auth.uid() 
      OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
    AND is_active = true
  );
$$;

DROP POLICY IF EXISTS "superadmins_read" ON public.superadmins;
CREATE POLICY "superadmins_read"
  ON public.superadmins FOR SELECT TO authenticated
  USING (public.is_superadmin() OR auth.role() = 'service_role');

-- Upgrade is_org_member to grant Superadmin universal watcher visibility
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members
    WHERE organisation_id = p_org_id
      AND user_id = auth.uid()
  ) OR public.is_superadmin();
$$;

-- Upgrade has_role to recognize Superadmin as Owner for emergency diagnostics
CREATE OR REPLACE FUNCTION public.has_role(p_org_id uuid, p_roles public.organisation_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members
    WHERE organisation_id = p_org_id
      AND user_id = auth.uid()
      AND role = ANY(p_roles)
  ) OR (public.is_superadmin() AND 'owner' = ANY(p_roles));
$$;

-- ============================================================================
-- 3. Organisation Invitations Engine
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organisation_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.organisation_role NOT NULL DEFAULT 'viewer',
  designation text NOT NULL DEFAULT 'Team Member',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token text UNIQUE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')) DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_org_invitations_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_status 
  ON public.organisation_invitations(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email 
  ON public.organisation_invitations(lower(email));

ALTER TABLE public.organisation_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_invitations_select" ON public.organisation_invitations;
CREATE POLICY "org_invitations_select"
  ON public.organisation_invitations FOR SELECT TO authenticated
  USING (
    public.is_org_member(organisation_id)
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    OR public.is_superadmin()
  );

DROP POLICY IF EXISTS "org_invitations_modify" ON public.organisation_invitations;
CREATE POLICY "org_invitations_modify"
  ON public.organisation_invitations FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[])
    OR public.is_superadmin()
  );

-- ============================================================================
-- 4. License Seat Limit Enforcement Function (GO vs PRO Tier)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_org_seat_availability(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license_seats int;
  v_current_members int;
  v_pending_invites int;
BEGIN
  -- Superadmin is exempt from seat constraints
  IF public.is_superadmin() THEN
    RETURN true;
  END IF;

  -- Read active license tier seat allocation
  SELECT COALESCE((features->>'seats')::int, 2)
  INTO v_license_seats
  FROM public.organisation_licenses
  WHERE organisation_id = p_org_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Default to 2 (GO tier trial) if no license row is active
  IF v_license_seats IS NULL THEN
    v_license_seats := 2;
  END IF;

  -- -1 designates PRO tier with unlimited seats
  IF v_license_seats = -1 THEN
    RETURN true;
  END IF;

  -- Tally current active members + active pending invites
  SELECT COUNT(*) INTO v_current_members
  FROM public.organisation_members
  WHERE organisation_id = p_org_id;

  SELECT COUNT(*) INTO v_pending_invites
  FROM public.organisation_invitations
  WHERE organisation_id = p_org_id AND status = 'pending' AND expires_at > now();

  IF (v_current_members + v_pending_invites) >= v_license_seats THEN
    RAISE EXCEPTION 'License Seat Limit Exceeded: Your GO plan allows up to % seats. You currently have % active members and % pending invites. Upgrade to PRO for unlimited seats.', 
      v_license_seats, v_current_members, v_pending_invites;
  END IF;

  RETURN true;
END;
$$;

-- ============================================================================
-- 5. Stored Procedure: invite_user_to_organisation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.invite_user_to_organisation(
  p_org_id uuid,
  p_email text,
  p_role public.organisation_role DEFAULT 'viewer',
  p_designation text DEFAULT 'Team Member',
  p_department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.organisation_role;
  v_token text;
  v_invitation_id uuid;
  v_existing_member_id uuid;
  v_org_name text;
BEGIN
  v_caller_id := auth.uid();
  p_email := lower(trim(p_email));

  -- Validate caller authority (Owner, CFO, Admin, or Superadmin)
  IF NOT public.is_superadmin() THEN
    SELECT role INTO v_caller_role
    FROM public.organisation_members
    WHERE organisation_id = p_org_id AND user_id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'cfo', 'admin') THEN
      RAISE EXCEPTION 'Permission Denied: Only Owners, CFOs, or Admins can invite team members';
    END IF;

    -- Admins and CFOs cannot grant the Owner role
    IF v_caller_role <> 'owner' AND p_role = 'owner' THEN
      RAISE EXCEPTION 'Permission Denied: Only the current Owner can invite or assign the Owner role';
    END IF;
  END IF;

  -- Validate email structure
  IF p_email NOT ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email address: %', p_email;
  END IF;

  -- Enforce plan seat quota
  PERFORM public.check_org_seat_availability(p_org_id);

  -- Fetch organisation name
  SELECT name INTO v_org_name FROM public.organisations WHERE id = p_org_id;

  -- Check if user is already an active member of this organisation
  SELECT m.id INTO v_existing_member_id
  FROM auth.users u
  JOIN public.organisation_members m ON m.user_id = u.id
  WHERE lower(u.email) = p_email AND m.organisation_id = p_org_id;

  IF v_existing_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'User % is already an active member of %', p_email, v_org_name;
  END IF;

  -- Expire any previous pending invitation for this email in this organisation
  UPDATE public.organisation_invitations
  SET status = 'expired', updated_at = now()
  WHERE organisation_id = p_org_id AND lower(email) = p_email AND status = 'pending';

  -- Generate cryptographically secure token
  v_token := 'deku-inv-' || encode(gen_random_bytes(24), 'hex');

  -- Create invitation row
  INSERT INTO public.organisation_invitations (
    organisation_id,
    email,
    role,
    designation,
    department_id,
    invited_by,
    token,
    status,
    expires_at
  )
  VALUES (
    p_org_id,
    p_email,
    p_role,
    p_designation,
    p_department_id,
    v_caller_id,
    v_token,
    'pending',
    now() + interval '7 days'
  )
  RETURNING id INTO v_invitation_id;

  -- Also synchronize into public.employees directory
  INSERT INTO public.employees (
    organisation_id,
    name,
    email,
    designation,
    department_id,
    role,
    status,
    is_owner,
    is_lead
  )
  VALUES (
    p_org_id,
    split_part(p_email, '@', 1),
    p_email,
    p_designation,
    p_department_id,
    p_role::text,
    'active',
    (p_role = 'owner'),
    false
  )
  ON CONFLICT (organisation_id, email) DO UPDATE
  SET 
    role = EXCLUDED.role,
    designation = EXCLUDED.designation,
    department_id = COALESCE(EXCLUDED.department_id, public.employees.department_id),
    updated_at = now();

  -- Log security event to MCA Rule 3(1) activity log
  PERFORM public.record_user_activity(
    p_org_id,
    'SECURITY',
    'Member Invitation Issued',
    format('Invited %s to workbench as %s (%s)', p_email, upper(p_role::text), p_designation),
    'invitation',
    v_invitation_id::text,
    'Admin / Owner',
    'Admin',
    'success',
    jsonb_build_object('email', p_email, 'role', p_role, 'token', v_token)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'organisation_id', p_org_id,
    'organisation_name', v_org_name,
    'email', p_email,
    'role', p_role,
    'designation', p_designation,
    'token', v_token,
    'invite_url', '/join?token=' || v_token,
    'expires_at', (now() + interval '7 days')
  );
END;
$$;

-- ============================================================================
-- 6. Stored Procedure: accept_organisation_invitation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_organisation_invitation(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invitation public.organisation_invitations;
  v_org_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication Required: Please sign in or create an account to accept this invitation';
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invitation
  FROM public.organisation_invitations
  WHERE token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or previously redeemed invitation token';
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE public.organisation_invitations SET status = 'expired', updated_at = now() WHERE id = v_invitation.id;
    RAISE EXCEPTION 'This invitation has expired. Please request a new invite from the organisation administrator';
  END IF;

  -- Ensure seat quota is available
  PERFORM public.check_org_seat_availability(v_invitation.organisation_id);

  SELECT name INTO v_org_name FROM public.organisations WHERE id = v_invitation.organisation_id;

  -- Insert into organisation_members
  INSERT INTO public.organisation_members (
    organisation_id,
    user_id,
    role,
    invited_by
  )
  VALUES (
    v_invitation.organisation_id,
    v_user_id,
    v_invitation.role,
    v_invitation.invited_by
  )
  ON CONFLICT (organisation_id, user_id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    updated_at = now();

  -- Link auth user_id in employees directory
  UPDATE public.employees
  SET 
    user_id = v_user_id,
    status = 'active',
    updated_at = now()
  WHERE organisation_id = v_invitation.organisation_id AND lower(email) = lower(v_invitation.email);

  -- Mark invitation as accepted
  UPDATE public.organisation_invitations
  SET status = 'accepted', updated_at = now()
  WHERE id = v_invitation.id;

  -- Log security event
  PERFORM public.record_user_activity(
    v_invitation.organisation_id,
    'SECURITY',
    'Member Joined Workbench',
    format('User %s accepted invitation and joined as %s', COALESCE(v_user_email, 'Team Member'), upper(v_invitation.role::text)),
    'membership',
    v_user_id::text,
    COALESCE(v_user_email, 'New Member'),
    v_invitation.role::text,
    'success',
    jsonb_build_object('invitation_id', v_invitation.id, 'role', v_invitation.role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'organisation_id', v_invitation.organisation_id,
    'organisation_name', v_org_name,
    'role', v_invitation.role,
    'message', format('Successfully joined %s as %s', v_org_name, upper(v_invitation.role::text))
  );
END;
$$;

-- ============================================================================
-- 7. Strict Role Segregation of Duties in RLS
-- ============================================================================

-- A. Parties (Customers & Vendors):
-- Viewers and Analysts CANNOT view raw counterparties (customer lists, phone numbers, addresses)
DROP POLICY IF EXISTS "parties_select" ON public.parties;
CREATE POLICY "parties_select"
  ON public.parties FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant', 'auditor']::public.organisation_role[])
  );

-- B. Journal Entries (Operational Double-Entry Ledger):
-- Viewers cannot inspect raw day-to-day voucher lines (they view macro KPIs and Financial Statements instead)
-- Accountants can create/stage drafts; only Owner, CFO, and Admin can sign off and post
DROP POLICY IF EXISTS "journal_entries_select" ON public.journal_entries;
CREATE POLICY "journal_entries_select"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant', 'auditor']::public.organisation_role[])
  );

-- Update post_journal_entry stored procedure to restrict final posting strictly to Owner, CFO, Admin, or Superadmin
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_org_id uuid, p_entry_id uuid)
RETURNS public.journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.journal_entries;
  v_lines_count int;
  v_is_balanced boolean;
BEGIN
  -- Strict Segregation of Duties: Only Owner, CFO, Admin, or Superadmin can commit immutable ledger entries
  IF auth.uid() IS NOT NULL AND NOT (
    public.is_superadmin() 
    OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[])
  ) THEN
    RAISE EXCEPTION 'Segregation of Duties Violation: Only the Owner, CFO, or Admin can approve and post vouchers to the immutable ledger. Accountants may only create drafts.';
  END IF;

  SELECT * INTO v_entry
  FROM public.journal_entries
  WHERE id = p_entry_id AND organisation_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF v_entry.status = 'posted' THEN
    RAISE EXCEPTION 'Journal entry is already posted';
  END IF;

  -- Verify line counts & balance parity
  SELECT COUNT(*), (COALESCE(SUM(debit), 0) = COALESCE(SUM(credit), 0))
  INTO v_lines_count, v_is_balanced
  FROM public.journal_entry_lines
  WHERE journal_entry_id = p_entry_id AND organisation_id = p_org_id;

  IF v_lines_count < 2 THEN
    RAISE EXCEPTION 'Cannot post journal entry: must have at least 2 lines';
  END IF;

  IF NOT v_is_balanced THEN
    RAISE EXCEPTION 'Cannot post journal entry: debits and credits do not balance';
  END IF;

  -- Transition status to posted
  UPDATE public.journal_entries
  SET 
    status = 'posted',
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  -- Record audit trail
  PERFORM public.record_user_activity(
    p_org_id,
    'VOUCHER',
    'Voucher Posted to Universal Ledger',
    format('Posted %s voucher %s to immutable general ledger', upper(v_entry.narration), v_entry.entry_number),
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

-- ============================================================================
-- 8. Superadmin Watcher Diagnostics & Emergency Repair Functions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.superadmin_diagnose_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_license record;
  v_member_count int;
  v_vouchers_count int;
  v_is_balanced boolean;
  v_pending_agent_sessions int;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform superadmins can run diagnostic inspects';
  END IF;

  SELECT * INTO v_org FROM public.organisations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Organisation not found');
  END IF;

  SELECT * INTO v_license FROM public.organisation_licenses WHERE organisation_id = p_org_id ORDER BY created_at DESC LIMIT 1;
  SELECT COUNT(*) INTO v_member_count FROM public.organisation_members WHERE organisation_id = p_org_id;
  SELECT COUNT(*) INTO v_vouchers_count FROM public.journal_entries WHERE organisation_id = p_org_id AND status = 'posted';
  
  -- Check Trial Balance parity across the entire org
  SELECT (COALESCE(SUM(debit), 0) = COALESCE(SUM(credit), 0))
  INTO v_is_balanced
  FROM public.journal_entry_lines
  WHERE organisation_id = p_org_id;

  SELECT COUNT(*) INTO v_pending_agent_sessions
  FROM public.agent_sessions
  WHERE organisation_id = p_org_id AND status NOT IN ('approved', 'posted', 'rejected');

  RETURN jsonb_build_object(
    'organisation_id', v_org.id,
    'name', v_org.name,
    'slug', v_org.slug,
    'gstin', v_org.gstin,
    'active_license', jsonb_build_object(
      'plan_tier', v_license.plan_tier,
      'status', v_license.status,
      'expires_at', v_license.expires_at,
      'seats_allowed', v_license.features->>'seats'
    ),
    'members_count', v_member_count,
    'posted_vouchers', v_vouchers_count,
    'books_balanced', COALESCE(v_is_balanced, true),
    'pending_ai_sessions', v_pending_agent_sessions
  );
END;
$$;

-- Seed Platform Superadmin Record for Medhansh K.
INSERT INTO public.superadmins (email, name, is_active)
VALUES 
  ('medhansh@deku.finance', 'Medhansh K. (Founder & Superadmin)', true)
ON CONFLICT (email) DO UPDATE
SET is_active = true;
