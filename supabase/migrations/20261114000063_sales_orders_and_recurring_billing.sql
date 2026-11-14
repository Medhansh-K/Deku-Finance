-- Migration: 20261114000063_sales_orders_and_recurring_billing.sql
-- Description: Client-End ERP Kernel: Sales Orders Pipeline, Recurring Billing Profiles, and Early-Payment Cash Discount Terms.

-- 1. Sales Orders Table
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL,
  delivery_due_date DATE NOT NULL,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'partially_invoiced', 'completed', 'cancelled')),
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  tax_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
  grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
  terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_sales_orders_org_num UNIQUE (organisation_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_org ON public.sales_orders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_party ON public.sales_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);

-- 2. Sales Order Lines Table
CREATE TABLE IF NOT EXISTS public.sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  item_name TEXT NOT NULL,
  hsn_sac_code TEXT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  invoiced_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.00 CHECK (invoiced_quantity >= 0),
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_pct BETWEEN 0 AND 100),
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (gst_rate >= 0),
  taxable_amount NUMERIC(15, 2) NOT NULL CHECK (taxable_amount >= 0),
  total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_order_lines_order ON public.sales_order_lines(sales_order_id);

-- 3. Recurring Billing Profiles Table
CREATE TABLE IF NOT EXISTS public.recurring_invoice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
  profile_name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annual')),
  start_date DATE NOT NULL,
  next_run_date DATE NOT NULL,
  end_date DATE,
  template_invoice_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  auto_post_ledger BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_profiles_org ON public.recurring_invoice_profiles(organisation_id);
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_run ON public.recurring_invoice_profiles(next_run_date);

-- 4. Extend sales_invoices for Early-Payment Discount Terms & Linked Sales Orders
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS early_payment_discount_pct NUMERIC(5, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS early_payment_discount_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_order ON public.sales_invoices(sales_order_id);

-- 5. Stored Procedure: Convert Sales Order to Invoice
CREATE OR REPLACE FUNCTION public.convert_sales_order_to_invoice(
  p_order_id UUID,
  p_invoice_number TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_new_inv_id UUID;
  v_line RECORD;
BEGIN
  SELECT * INTO v_order
  FROM public.sales_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot convert order with status: %', v_order.status;
  END IF;

  -- Create Sales Invoice Draft
  INSERT INTO public.sales_invoices (
    organisation_id,
    customer_id,
    invoice_number,
    invoice_date,
    due_date,
    status,
    sales_order_id,
    taxable_amount,
    total_amount,
    notes,
    terms
  ) VALUES (
    v_order.organisation_id,
    v_order.party_id,
    p_invoice_number,
    CURRENT_DATE,
    v_order.delivery_due_date,
    'draft',
    p_order_id,
    v_order.subtotal,
    v_order.grand_total,
    v_order.notes,
    v_order.terms
  ) RETURNING id INTO v_new_inv_id;

  -- Copy lines
  FOR v_line IN
    SELECT * FROM public.sales_order_lines WHERE sales_order_id = p_order_id
  LOOP
    INSERT INTO public.sales_invoice_lines (
      invoice_id,
      line_number,
      item_name,
      hsn_sac_code,
      quantity,
      unit_price,
      taxable_amount,
      gst_rate,
      total_amount
    ) VALUES (
      v_new_inv_id,
      v_line.line_number,
      v_line.item_name,
      v_line.hsn_sac_code,
      v_line.quantity,
      v_line.unit_price,
      v_line.taxable_amount,
      v_line.gst_rate,
      v_line.total_amount
    );

    UPDATE public.sales_order_lines
    SET invoiced_quantity = quantity
    WHERE id = v_line.id;
  END LOOP;

  -- Mark Order as Completed
  UPDATE public.sales_orders
  SET status = 'completed',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'invoice_id', v_new_inv_id,
    'invoice_number', p_invoice_number
  );
END;
$$;

-- 6. RLS Policies
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view sales orders" ON public.sales_orders;
CREATE POLICY "Members can view sales orders"
  ON public.sales_orders FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage sales orders" ON public.sales_orders;
CREATE POLICY "Admins can manage sales orders"
  ON public.sales_orders FOR ALL TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant')));

DROP POLICY IF EXISTS "Members can view recurring profiles" ON public.recurring_invoice_profiles;
CREATE POLICY "Members can view recurring profiles"
  ON public.recurring_invoice_profiles FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM public.organisation_memberships WHERE user_id = auth.uid()));
