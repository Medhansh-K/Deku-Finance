-- Migration: 20261107000059_distributor_and_license_ecosystem.sql
-- Description: Multi-tier licensing ecosystem: Platform Admins, Distributors, Dual-Gate License Requests, Platform Licenses, and Inbound Client Lead Routing.

-- 1. Platform Super-Admins & Sub-Admins Directory
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'super_admin', -- 'super_admin', 'license_manager', 'support_admin'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Medhansh as the Master Super-Admin
INSERT INTO public.platform_admins (email, full_name, role, is_active, created_by)
VALUES ('medhanshk10@gmail.com', 'Medhansh (Deku Master Admin)', 'super_admin', true, 'system_bootstrap')
ON CONFLICT (email) DO UPDATE SET is_active = true, role = 'super_admin';

-- 2. Regional Distributors & Franchise Partners Directory
CREATE TABLE IF NOT EXISTS public.distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_code VARCHAR(32) UNIQUE NOT NULL, -- e.g. 'DIST-MH-001', 'DIST-KA-002'
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    assigned_states TEXT[] NOT NULL DEFAULT '{}', -- e.g. ARRAY['27', 'Maharashtra']
    assigned_pincodes TEXT[] DEFAULT '{}',
    allocated_seat_quota INT NOT NULL DEFAULT 50, -- self-service seat packs distributor can allocate
    available_service_credits INT NOT NULL DEFAULT 100, -- self-service service packs
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'terminated'
    password_hash TEXT, -- for distributor portal authentication
    created_by TEXT REFERENCES public.platform_admins(email) ON UPDATE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distributors_code ON public.distributors(distributor_code);
CREATE INDEX IF NOT EXISTS idx_distributors_email ON public.distributors(email);
CREATE INDEX IF NOT EXISTS idx_distributors_status ON public.distributors(status);

-- 3. Formal License Requests (Condition 1: Distributor Request + Condition 2: Commercial Proof Document)
CREATE TABLE IF NOT EXISTS public.distributor_license_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    company_name TEXT NOT NULL,
    gstin VARCHAR(20),
    request_type VARCHAR(32) NOT NULL DEFAULT 'activation', -- 'activation', 'add_on_module'
    plan_tier VARCHAR(20) NOT NULL, -- 'go', 'pro', 'enterprise'
    module_name VARCHAR(64), -- for add_on_module: 'ai_cfo', 'multi_branch', 'inventory_godown', 'direct_gsp_irp'
    -- Condition 2: Commercial Proof of Contract / Order
    proof_document_type VARCHAR(20) NOT NULL, -- 'invoice', 'mou', 'quote'
    proof_document_number TEXT NOT NULL,
    proof_file_bytes BYTEA,
    proof_file_name TEXT,
    proof_amount NUMERIC(15, 2) NOT NULL,
    -- Workflow Status
    status VARCHAR(32) NOT NULL DEFAULT 'pending_verification', -- 'pending_verification', 'approved_issued', 'rejected'
    generated_license_key VARCHAR(64),
    reviewed_by TEXT REFERENCES public.platform_admins(email),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_req_distributor ON public.distributor_license_requests(distributor_id);
CREATE INDEX IF NOT EXISTS idx_license_req_status ON public.distributor_license_requests(status);
CREATE INDEX IF NOT EXISTS idx_license_req_email ON public.distributor_license_requests(client_email);

-- 4. Platform Licenses (Activation Keys & Add-On Subtypes)
CREATE TABLE IF NOT EXISTS public.platform_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(64) UNIQUE NOT NULL, -- e.g. 'DEKU-PRO-2026-88A1-99B2'
    license_type VARCHAR(20) NOT NULL, -- 'activation', 'add_on'
    plan_tier VARCHAR(20) NOT NULL, -- 'go', 'pro', 'enterprise'
    add_on_category VARCHAR(20), -- 'module', 'seat', 'service' (NULL for activation)
    add_on_module_name VARCHAR(64), -- 'ai_cfo', 'multi_branch', 'inventory_godown'
    extra_seats_count INT DEFAULT 0,
    service_description TEXT,
    managed_by VARCHAR(20) NOT NULL, -- 'company_admin' (activation & modules) | 'distributor' (seats & services)
    allocated_distributor_id UUID REFERENCES public.distributors(id),
    assigned_organisation_id UUID REFERENCES public.organisations(id),
    assigned_client_email TEXT NOT NULL,
    linked_request_id UUID REFERENCES public.distributor_license_requests(id),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    max_seats INT NOT NULL DEFAULT 2,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'revoked'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_licenses_key ON public.platform_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_platform_licenses_email ON public.platform_licenses(assigned_client_email);
CREATE INDEX IF NOT EXISTS idx_platform_licenses_status ON public.platform_licenses(status);
CREATE INDEX IF NOT EXISTS idx_platform_licenses_org ON public.platform_licenses(assigned_organisation_id);

-- 5. Inbound Client Onboarding Requests (Website Leads Routed by Location)
CREATE TABLE IF NOT EXISTS public.client_onboarding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    client_email TEXT NOT NULL,
    company_name TEXT NOT NULL,
    gstin_or_pan VARCHAR(20),
    state_code VARCHAR(10) NOT NULL,
    state_name TEXT NOT NULL,
    city TEXT NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    assigned_distributor_id UUID REFERENCES public.distributors(id),
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'contacted', 'setup_in_progress', 'completed', 'rejected'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_req_state ON public.client_onboarding_requests(state_code);
CREATE INDEX IF NOT EXISTS idx_client_req_pincode ON public.client_onboarding_requests(pincode);
CREATE INDEX IF NOT EXISTS idx_client_req_distributor ON public.client_onboarding_requests(assigned_distributor_id);
CREATE INDEX IF NOT EXISTS idx_client_req_status ON public.client_onboarding_requests(status);

-- 6. Helper Function: Route Inbound Lead to Regional Distributor
CREATE OR REPLACE FUNCTION public.route_inbound_client_request()
RETURNS TRIGGER AS $$
DECLARE
    v_dist_id UUID;
BEGIN
    -- First try matching by pincode
    SELECT id INTO v_dist_id
    FROM public.distributors
    WHERE status = 'active' AND NEW.pincode = ANY(assigned_pincodes)
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no pincode match, match by state_code or state_name
    IF v_dist_id IS NULL THEN
        SELECT id INTO v_dist_id
        FROM public.distributors
        WHERE status = 'active' AND (NEW.state_code = ANY(assigned_states) OR NEW.state_name = ANY(assigned_states))
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- If still no regional distributor, assign to first active distributor or leave null for master admin
    IF v_dist_id IS NOT NULL THEN
        NEW.assigned_distributor_id := v_dist_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_route_client_onboarding_request ON public.client_onboarding_requests;
CREATE TRIGGER trg_route_client_onboarding_request
BEFORE INSERT ON public.client_onboarding_requests
FOR EACH ROW
EXECUTE FUNCTION public.route_inbound_client_request();

-- 7. Stored Procedure: Deku Admin Approves Request & Generates Activation License Key
CREATE OR REPLACE FUNCTION public.approve_distributor_license_request(
    p_request_id UUID,
    p_admin_email TEXT,
    p_valid_days INT DEFAULT 365
)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_license_key TEXT;
    v_random_hash TEXT;
    v_year TEXT;
    v_seats INT;
    v_valid_until TIMESTAMPTZ;
BEGIN
    -- Verify caller is active platform admin
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE email = p_admin_email AND is_active = true) THEN
        RAISE EXCEPTION 'Caller is not an authorized Deku platform admin';
    END IF;

    SELECT * INTO v_req
    FROM public.distributor_license_requests
    WHERE id = p_request_id;

    IF v_req IS NULL THEN
        RAISE EXCEPTION 'License request not found';
    END IF;

    IF v_req.status = 'approved_issued' THEN
        RAISE EXCEPTION 'License request is already approved and issued';
    END IF;

    -- Generate cryptographically random sequential license key
    -- e.g. DEKU-PRO-2026-F98A-B102
    v_year := to_char(NOW(), 'YYYY');
    v_random_hash := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    v_license_key := 'DEKU-' || upper(v_req.plan_tier) || '-' || v_year || '-' || substr(v_random_hash, 1, 4) || '-' || substr(v_random_hash, 5, 4);

    v_seats := CASE 
        WHEN v_req.plan_tier = 'go' THEN 2
        WHEN v_req.plan_tier = 'pro' THEN 5
        ELSE 999
    END;

    v_valid_until := NOW() + (p_valid_days || ' days')::INTERVAL;

    -- Mint the license
    INSERT INTO public.platform_licenses (
        license_key,
        license_type,
        plan_tier,
        add_on_category,
        add_on_module_name,
        managed_by,
        allocated_distributor_id,
        assigned_client_email,
        linked_request_id,
        valid_from,
        valid_until,
        max_seats,
        status
    ) VALUES (
        v_license_key,
        v_req.request_type,
        v_req.plan_tier,
        CASE WHEN v_req.request_type = 'add_on_module' THEN 'module' ELSE NULL END,
        v_req.module_name,
        'company_admin',
        v_req.distributor_id,
        v_req.client_email,
        v_req.id,
        NOW(),
        v_valid_until,
        v_seats,
        'active'
    );

    -- Update request status
    UPDATE public.distributor_license_requests
    SET status = 'approved_issued',
        generated_license_key = v_license_key,
        reviewed_by = p_admin_email,
        reviewed_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'license_key', v_license_key,
        'client_email', v_req.client_email,
        'plan_tier', v_req.plan_tier,
        'valid_until', v_valid_until
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Stored Procedure: Distributor Provisions Extra Seats to Client License
CREATE OR REPLACE FUNCTION public.distributor_provision_client_seats(
    p_distributor_id UUID,
    p_license_key TEXT,
    p_extra_seats INT
)
RETURNS JSONB AS $$
DECLARE
    v_dist RECORD;
    v_lic RECORD;
BEGIN
    SELECT * INTO v_dist FROM public.distributors WHERE id = p_distributor_id AND status = 'active';
    IF v_dist IS NULL THEN
        RAISE EXCEPTION 'Distributor not found or inactive';
    END IF;

    IF v_dist.allocated_seat_quota < p_extra_seats THEN
        RAISE EXCEPTION 'Insufficient seat quota. Available: %, Requested: %', v_dist.allocated_seat_quota, p_extra_seats;
    END IF;

    SELECT * INTO v_lic FROM public.platform_licenses WHERE license_key = p_license_key AND allocated_distributor_id = p_distributor_id;
    IF v_lic IS NULL THEN
        RAISE EXCEPTION 'Client license not found or not managed by this distributor';
    END IF;

    -- Update client license seats
    UPDATE public.platform_licenses
    SET max_seats = max_seats + p_extra_seats
    WHERE id = v_lic.id;

    -- Decrement distributor quota
    UPDATE public.distributors
    SET allocated_seat_quota = allocated_seat_quota - p_extra_seats
    WHERE id = p_distributor_id;

    -- Create audit add-on entry
    INSERT INTO public.platform_licenses (
        license_key,
        license_type,
        plan_tier,
        add_on_category,
        extra_seats_count,
        managed_by,
        allocated_distributor_id,
        assigned_organisation_id,
        assigned_client_email,
        valid_from,
        valid_until,
        status
    ) VALUES (
        'SEAT-ADDON-' || upper(substr(md5(random()::text), 1, 8)),
        'add_on',
        v_lic.plan_tier,
        'seat',
        p_extra_seats,
        'distributor',
        p_distributor_id,
        v_lic.assigned_organisation_id,
        v_lic.assigned_client_email,
        NOW(),
        v_lic.valid_until,
        'active'
    );

    RETURN jsonb_build_object(
        'success', true,
        'license_key', p_license_key,
        'new_total_seats', v_lic.max_seats + p_extra_seats,
        'remaining_distributor_quota', v_dist.allocated_seat_quota - p_extra_seats
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Stored Procedure: Distributor Provisions Service Package to Client
CREATE OR REPLACE FUNCTION public.distributor_provision_client_service(
    p_distributor_id UUID,
    p_license_key TEXT,
    p_service_description TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_dist RECORD;
    v_lic RECORD;
    v_service_key TEXT;
BEGIN
    SELECT * INTO v_dist FROM public.distributors WHERE id = p_distributor_id AND status = 'active';
    IF v_dist IS NULL THEN
        RAISE EXCEPTION 'Distributor not found or inactive';
    END IF;

    SELECT * INTO v_lic FROM public.platform_licenses WHERE license_key = p_license_key AND allocated_distributor_id = p_distributor_id;
    IF v_lic IS NULL THEN
        RAISE EXCEPTION 'Client license not found or not managed by this distributor';
    END IF;

    v_service_key := 'SRV-ADDON-' || upper(substr(md5(random()::text), 1, 8));

    INSERT INTO public.platform_licenses (
        license_key,
        license_type,
        plan_tier,
        add_on_category,
        service_description,
        managed_by,
        allocated_distributor_id,
        assigned_organisation_id,
        assigned_client_email,
        valid_from,
        valid_until,
        status
    ) VALUES (
        v_service_key,
        'add_on',
        v_lic.plan_tier,
        'service',
        p_service_description,
        'distributor',
        p_distributor_id,
        v_lic.assigned_organisation_id,
        v_lic.assigned_client_email,
        NOW(),
        v_lic.valid_until,
        'active'
    );

    RETURN jsonb_build_object(
        'success', true,
        'service_key', v_service_key,
        'service_description', p_service_description
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Verification Function for 3-Field Login (Activation Key + Email + Password)
CREATE OR REPLACE FUNCTION public.validate_login_activation_key(
    p_license_key TEXT,
    p_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_lic RECORD;
BEGIN
    SELECT * INTO v_lic
    FROM public.platform_licenses
    WHERE license_key = p_license_key AND status = 'active';

    IF v_lic IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Activation license key is invalid or inactive');
    END IF;

    IF v_lic.valid_until < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Activation license key has expired. Please contact your regional distributor for renewal.');
    END IF;

    -- License must match the assigned client email or be an unassigned master key
    IF v_lic.assigned_client_email != '' AND lower(v_lic.assigned_client_email) != lower(p_email) THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Activation license key is not assigned to this email address');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'plan_tier', v_lic.plan_tier,
        'max_seats', v_lic.max_seats,
        'valid_until', v_lic.valid_until,
        'organisation_id', v_lic.assigned_organisation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

