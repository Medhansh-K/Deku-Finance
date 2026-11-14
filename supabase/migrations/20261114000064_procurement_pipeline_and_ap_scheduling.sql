-- Migration: 20261114000064_procurement_pipeline_and_ap_scheduling.sql
-- Description: Client-End ERP Kernel: Material Requisitions, Purchase Orders, and AP Payment Calendar with Section 43B(h) MSME 45-Day Compliance.

-- 1. Material Requests Table
CREATE TABLE IF NOT EXISTS public.material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_by_date DATE NOT NULL,
  purpose TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'critical')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'po_created', 'rejected')),
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_material_req_num UNIQUE (organisation_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_material_req_org ON public.material_requests(organisation_id);
CREATE INDEX IF NOT EXISTS idx_material_req_status ON public.material_requests(status);

-- 2. Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  vendor_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
  material_request_id UUID REFERENCES public.material_requests(id) ON DELETE SET NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE NOT NULL,
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  tax_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
  grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'billed', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_purchase_orders_num UNIQUE (organisation_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON public.purchase_orders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);

-- 3. Purchase Order Lines Table
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  item_name TEXT NOT NULL,
  hsn_sac_code TEXT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (gst_rate >= 0),
  taxable_amount NUMERIC(15, 2) NOT NULL CHECK (taxable_amount >= 0),
  total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po ON public.purchase_order_lines(purchase_order_id);

-- 4. Extend purchase_bills for AP Scheduling & Section 43B(h) MSME 45-Day Timer
ALTER TABLE public.purchase_bills
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_payment_date DATE,
  ADD COLUMN IF NOT EXISTS msme_payment_due_date DATE;

-- 5. Trigger Function: Compute MSME Payment Due Date (Bill Date + 45 days)
CREATE OR REPLACE FUNCTION public.compute_bill_msme_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_msme_reg TEXT;
BEGIN
  -- Lookup vendor MSME status
  SELECT msme_reg INTO v_msme_reg
  FROM public.parties
  WHERE id = NEW.vendor_id;

  IF v_msme_reg IS NOT NULL AND trim(v_msme_reg) <> '' THEN
    NEW.msme_payment_due_date := NEW.bill_date + INTERVAL '45 days';
  ELSE
    NEW.msme_payment_due_date := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_bill_msme_due_date ON public.purchase_bills;
CREATE TRIGGER trg_compute_bill_msme_due_date
  BEFORE INSERT OR UPDATE OF vendor_id, bill_date ON public.purchase_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_bill_msme_due_date();

-- 6. View: AP Payment Schedule Calendar View
CREATE OR REPLACE VIEW public.view_ap_payment_schedule AS
SELECT
  pb.id AS bill_id,
  pb.organisation_id,
  pb.bill_number,
  pb.vendor_id,
  p.legal_name AS vendor_name,
  p.msme_reg AS vendor_msme_reg,
  pb.bill_date,
  COALESCE(pb.scheduled_payment_date, pb.due_date, pb.bill_date + INTERVAL '30 days') AS effective_payment_date,
  pb.msme_payment_due_date,
  CASE
    WHEN pb.msme_payment_due_date IS NOT NULL AND CURRENT_DATE > pb.msme_payment_due_date THEN true
    ELSE false
  END AS is_msme_overdue,
  CASE
    WHEN pb.msme_payment_due_date IS NOT NULL THEN (pb.msme_payment_due_date - CURRENT_DATE)
    ELSE NULL
  END AS msme_days_remaining,
  pb.total_amount,
  pb.status
FROM public.purchase_bills pb
JOIN public.parties p ON p.id = pb.vendor_id
WHERE pb.status <> 'paid';

-- 7. RLS Policies
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view material requests" ON public.material_requests;
CREATE POLICY "Members can view material requests"
  ON public.material_requests FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage material requests" ON public.material_requests;
CREATE POLICY "Admins can manage material requests"
  ON public.material_requests FOR ALL TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant')));

DROP POLICY IF EXISTS "Members can view purchase orders" ON public.purchase_orders;
CREATE POLICY "Members can view purchase orders"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Admins can manage purchase orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant')));
