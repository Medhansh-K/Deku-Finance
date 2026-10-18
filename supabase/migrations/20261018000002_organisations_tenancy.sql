-- Migration 2: Organisations and Tenancy
-- Deku Finance - Tenancy & Multi-tenant Access Control

-- 1. Organisation Roles Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organisation_role') THEN
    CREATE TYPE public.organisation_role AS ENUM (
      'owner',
      'admin',
      'accountant',
      'member',
      'viewer'
    );
  END IF;
END $$;

-- 2. Organisations Table
CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  slug text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  gstin text,
  pan text,
  financial_year_start_month smallint NOT NULL DEFAULT 4 CHECK (financial_year_start_month BETWEEN 1 AND 12),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT uk_organisations_slug UNIQUE (slug),
  CONSTRAINT uk_organisations_id_slug UNIQUE (id, slug)
);

CREATE TRIGGER trg_organisations_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Organisation Members Table
CREATE TABLE IF NOT EXISTS public.organisation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.organisation_role NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uk_organisation_members_org_user UNIQUE (organisation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organisation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON public.organisation_members(organisation_id, role);

CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON public.organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Access Control Security Definer Helpers (Fixed safe search_path)
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
  );
$$;

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
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id
  FROM public.organisation_members
  WHERE user_id = auth.uid();
$$;

-- 5. Membership Privilege Escalation Guard Trigger
CREATE OR REPLACE FUNCTION public.protect_membership_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.organisation_role;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();

  -- Allow internal operations if no auth context (e.g., initial system seed or migrations)
  IF v_caller_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Fetch caller role in the affected organization
  SELECT role INTO v_caller_role
  FROM public.organisation_members
  WHERE organisation_id = COALESCE(NEW.organisation_id, OLD.organisation_id)
    AND user_id = v_caller_id;

  IF TG_OP = 'INSERT' THEN
    -- Only owners or admins can add members
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Permission denied: Only owners and admins can invite members';
    END IF;

    -- Admins cannot create owners
    IF v_caller_role = 'admin' AND NEW.role = 'owner' THEN
      RAISE EXCEPTION 'Permission denied: Admins cannot assign the owner role';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Cannot change own role
    IF OLD.user_id = v_caller_id AND OLD.role <> NEW.role THEN
      RAISE EXCEPTION 'Permission denied: You cannot modify your own role';
    END IF;

    -- Only owners and admins can update memberships
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Permission denied: Only owners and admins can update memberships';
    END IF;

    -- Admins cannot modify owners or promote to owner
    IF v_caller_role = 'admin' AND (OLD.role = 'owner' OR NEW.role = 'owner') THEN
      RAISE EXCEPTION 'Permission denied: Only owners can modify or grant owner status';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- A user can leave the organization (self-delete), provided they are not the sole owner
    IF OLD.user_id = v_caller_id THEN
      IF OLD.role = 'owner' THEN
        IF (SELECT COUNT(*) FROM public.organisation_members WHERE organisation_id = OLD.organisation_id AND role = 'owner') <= 1 THEN
          RAISE EXCEPTION 'Permission denied: The sole owner cannot leave the organisation without transferring ownership';
        END IF;
      END IF;
      RETURN OLD;
    END IF;

    -- Only owners and admins can remove other members
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Permission denied: Only owners and admins can remove members';
    END IF;

    -- Admins cannot remove owners
    IF v_caller_role = 'admin' AND OLD.role = 'owner' THEN
      RAISE EXCEPTION 'Permission denied: Admins cannot remove an owner';
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_membership_changes ON public.organisation_members;
CREATE TRIGGER trg_protect_membership_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_membership_changes();

-- 6. Atomic Organisation Creation Function
CREATE OR REPLACE FUNCTION public.create_organisation(
  p_name text,
  p_slug text,
  p_currency text DEFAULT 'INR',
  p_timezone text DEFAULT 'Asia/Kolkata',
  p_gstin text DEFAULT NULL,
  p_pan text DEFAULT NULL,
  p_fy_start_month smallint DEFAULT 4
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create an organisation';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Organisation name cannot be empty';
  END IF;

  IF trim(p_slug) = '' THEN
    RAISE EXCEPTION 'Organisation slug cannot be empty';
  END IF;

  -- Create organisation
  INSERT INTO public.organisations (
    name,
    slug,
    currency,
    timezone,
    gstin,
    pan,
    financial_year_start_month,
    created_by
  )
  VALUES (
    p_name,
    p_slug,
    COALESCE(p_currency, 'INR'),
    COALESCE(p_timezone, 'Asia/Kolkata'),
    p_gstin,
    p_pan,
    COALESCE(p_fy_start_month, 4),
    v_user_id
  )
  RETURNING id INTO v_org_id;

  -- Add caller as owner atomically
  INSERT INTO public.organisation_members (
    organisation_id,
    user_id,
    role,
    invited_by
  )
  VALUES (
    v_org_id,
    v_user_id,
    'owner',
    v_user_id
  );

  RETURN v_org_id;
END;
$$;

-- 7. Row Level Security Policies

-- Organisations RLS
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organisations_select_members"
  ON public.organisations
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY "organisations_update_admins"
  ON public.organisations
  FOR UPDATE
  TO authenticated
  USING (public.has_role(id, ARRAY['owner', 'admin']::public.organisation_role[]))
  WITH CHECK (public.has_role(id, ARRAY['owner', 'admin']::public.organisation_role[]));

CREATE POLICY "organisations_delete_owner"
  ON public.organisations
  FOR DELETE
  TO authenticated
  USING (public.has_role(id, ARRAY['owner']::public.organisation_role[]));

-- Organisation Members RLS
ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_peer"
  ON public.organisation_members
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "org_members_insert_admin"
  ON public.organisation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]));

CREATE POLICY "org_members_update_admin"
  ON public.organisation_members
  FOR UPDATE
  TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]));

CREATE POLICY "org_members_delete_admin_or_self"
  ON public.organisation_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[])
  );

-- Update profiles policy to allow peers in same organisation to view each other
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_peers"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT m.user_id
      FROM public.organisation_members m
      WHERE m.organisation_id IN (SELECT public.get_user_org_ids())
    )
  );
