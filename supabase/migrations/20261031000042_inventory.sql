-- Migration 42: Inventory (M12) - warehouses, immutable stock movements, FIFO valuation in SQL
-- Deku Finance
--
-- Stock moves only because a document did something:
--   * a sales invoice going draft -> issued issues its tracked goods (out) from the default warehouse,
--     and issued -> cancelled reverses those movements;
--   * a purchase bill getting its voucher linked receives its item lines (in) at the line rate;
--   * a credit note for a sales return going draft -> issued brings the goods back (in) at the FIFO cost
--     they left at, and cancelling the note reverses that;
--   * record_stock_adjustment books opening stock and adjustments together with their journal.
--
-- Why triggers on status transitions instead of redefining issue_sales_invoice again: that function has
-- been copied forward five times (7, 10, 25, 32, 41) and every copy risks dropping an earlier fix. The
-- status change is the one thing every issuing or cancelling path must do, an AFTER trigger runs inside
-- the same transaction, and raising there (stock_insufficient) rolls back the journal and the status
-- change together, so issuance stays atomic without touching the function.
--
-- Valuation is FIFO per item and warehouse, computed from the movements at read time: each `in` is a
-- layer on the cumulative-quantity line, each `out` consumes the stretch of that line it covers.
-- Nothing is stored that could drift from the movements.

-- ---------------------------------------------------------------------------------------------
-- Settings and catalogue flag
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS allow_negative_stock boolean NOT NULL DEFAULT false;

ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_catalogue_items_track_goods_only') THEN
    ALTER TABLE public.catalogue_items
      ADD CONSTRAINT chk_catalogue_items_track_goods_only CHECK (NOT track_inventory OR type = 'goods');
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Warehouses
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  code text NOT NULL CHECK (btrim(code) <> ''),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_warehouses_org_code UNIQUE (organisation_id, code),
  CONSTRAINT uk_warehouses_org_id UNIQUE (organisation_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_one_default
  ON public.warehouses(organisation_id) WHERE is_default;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Making a warehouse the default takes the flag off the old one; the default itself can't be dropped
-- or un-flagged directly, because every document movement lands there.
CREATE OR REPLACE FUNCTION public.guard_warehouse_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default AND EXISTS (SELECT 1 FROM public.organisations WHERE id = OLD.organisation_id) THEN
      RAISE EXCEPTION 'The default warehouse cannot be deleted; make another warehouse the default first';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_default AND NOT NEW.is_default THEN
    RAISE EXCEPTION 'Make another warehouse the default instead of clearing the flag';
  END IF;
  IF NEW.is_default AND (TG_OP = 'INSERT' OR NOT OLD.is_default) THEN
    UPDATE public.warehouses SET is_default = false
    WHERE organisation_id = NEW.organisation_id AND is_default AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_warehouse_default ON public.warehouses;
CREATE TRIGGER trg_guard_warehouse_default
  BEFORE INSERT OR UPDATE OR DELETE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.guard_warehouse_default();

CREATE OR REPLACE FUNCTION public.create_default_warehouse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.warehouses (organisation_id, name, code, is_default)
  VALUES (NEW.id, 'Main warehouse', 'MAIN', true)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_organisations_default_warehouse ON public.organisations;
CREATE TRIGGER trg_organisations_default_warehouse
  AFTER INSERT ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_warehouse();

INSERT INTO public.warehouses (organisation_id, name, code, is_default)
SELECT o.id, 'Main warehouse', 'MAIN', true
FROM public.organisations o
WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.organisation_id = o.id AND w.is_default)
ON CONFLICT DO NOTHING;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
CREATE POLICY "warehouses_select"
  ON public.warehouses FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "warehouses_insert" ON public.warehouses;
CREATE POLICY "warehouses_insert"
  ON public.warehouses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]));

DROP POLICY IF EXISTS "warehouses_update" ON public.warehouses;
CREATE POLICY "warehouses_update"
  ON public.warehouses FOR UPDATE TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]))
  WITH CHECK (public.has_role(organisation_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]));

-- A warehouse with movements can't be deleted either: the movements' foreign key refuses it.
DROP POLICY IF EXISTS "warehouses_delete" ON public.warehouses;
CREATE POLICY "warehouses_delete"
  ON public.warehouses FOR DELETE TO authenticated
  USING (public.has_role(organisation_id, ARRAY['owner', 'admin']::public.organisation_role[]));

-- ---------------------------------------------------------------------------------------------
-- Stock movements
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tie-breaker for FIFO order within a day.
  seq bigint GENERATED ALWAYS AS IDENTITY,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  movement_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  qty numeric(18, 3) NOT NULL CHECK (qty > 0),
  -- Outs are costed by FIFO when read, so they carry no cost of their own.
  unit_cost numeric(15, 4) CHECK (unit_cost >= 0),
  source_type text NOT NULL CHECK (source_type IN ('purchase_bill', 'sales_invoice', 'sales_note', 'opening', 'adjustment', 'transfer')),
  source_id uuid,
  narration text,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversal_of uuid REFERENCES public.stock_movements(id),
  CONSTRAINT chk_stock_movements_in_cost CHECK (direction = 'out' OR unit_cost IS NOT NULL),
  CONSTRAINT fk_stock_movements_item FOREIGN KEY (organisation_id, item_id)
    REFERENCES public.catalogue_items(organisation_id, id),
  CONSTRAINT fk_stock_movements_warehouse FOREIGN KEY (organisation_id, warehouse_id)
    REFERENCES public.warehouses(organisation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_order
  ON public.stock_movements(organisation_id, item_id, warehouse_id, movement_date, seq);
CREATE INDEX IF NOT EXISTS idx_stock_movements_source
  ON public.stock_movements(organisation_id, source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_one_reversal
  ON public.stock_movements(reversal_of) WHERE reversal_of IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_stock_movement_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deleting the whole company cascades here; nothing else may remove a movement.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = OLD.organisation_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'stock_movement_immutable: post a reversing movement instead';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_guard_stock_movements
  BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_stock_movement_immutability();

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Read-only to members; rows are written only by the document triggers and record_stock_adjustment.
DROP POLICY IF EXISTS "stock_movements_select" ON public.stock_movements;
CREATE POLICY "stock_movements_select"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stock_movements FROM authenticated, anon;

-- ---------------------------------------------------------------------------------------------
-- Purchase bill item lines (bills from migration 24 carry only totals)
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_purchase_bills_org_id') THEN
    ALTER TABLE public.purchase_bills ADD CONSTRAINT uk_purchase_bills_org_id UNIQUE (organisation_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_bill_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  bill_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity numeric(18, 3) NOT NULL CHECK (quantity > 0),
  -- Taxable cost per unit; this becomes the FIFO layer cost.
  rate numeric(15, 4) NOT NULL CHECK (rate >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_purchase_bill_lines_bill FOREIGN KEY (organisation_id, bill_id)
    REFERENCES public.purchase_bills(organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_bill_lines_item FOREIGN KEY (organisation_id, item_id)
    REFERENCES public.catalogue_items(organisation_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_bill_lines_bill ON public.purchase_bill_lines(bill_id);

ALTER TABLE public.purchase_bill_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_bill_lines_select" ON public.purchase_bill_lines;
CREATE POLICY "purchase_bill_lines_select"
  ON public.purchase_bill_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

-- Lines change only while the bill has no voucher, matching the bill's own update policy.
DROP POLICY IF EXISTS "purchase_bill_lines_write" ON public.purchase_bill_lines;
CREATE POLICY "purchase_bill_lines_write"
  ON public.purchase_bill_lines FOR ALL TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND EXISTS (SELECT 1 FROM public.purchase_bills b WHERE b.id = bill_id AND b.journal_entry_id IS NULL)
  )
  WITH CHECK (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[])
    AND EXISTS (SELECT 1 FROM public.purchase_bills b WHERE b.id = bill_id AND b.journal_entry_id IS NULL)
  );

-- ---------------------------------------------------------------------------------------------
-- FIFO core
-- ---------------------------------------------------------------------------------------------
-- Every movement up to p_as_of (NULL = all) with its value: qty x cost for an in, FIFO cost for an out.
-- An out covering cumulative-out stretch (lo, hi] takes, from each in layer covering cumulative-in
-- stretch (lo', hi'], the overlap of the two at that layer's cost.
-- A movement and its reversal (both dated by p_as_of) are void: they drop out of the layers, so a
-- cancelled document leaves FIFO exactly as if it never happened, and both show at the in side's cost.
CREATE OR REPLACE FUNCTION public.stock_fifo_movements(p_org_id uuid, p_as_of date DEFAULT NULL)
RETURNS TABLE (
  movement_id uuid, item_id uuid, warehouse_id uuid, movement_date date, seq bigint,
  direction text, qty numeric, unit_cost numeric, value numeric, cum_in numeric, cum_out numeric, voided boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT s.*,
      s.reversal_of IS NOT NULL OR EXISTS (
        SELECT 1 FROM public.stock_movements r
        WHERE r.reversal_of = s.id AND (p_as_of IS NULL OR r.movement_date <= p_as_of)
      ) AS is_void
    FROM public.stock_movements s
    WHERE s.organisation_id = p_org_id AND (p_as_of IS NULL OR s.movement_date <= p_as_of)
  ),
  m AS (
    SELECT b.*,
      sum(CASE WHEN b.direction = 'in' THEN b.qty ELSE 0 END) OVER w AS c_in,
      sum(CASE WHEN b.direction = 'out' THEN b.qty ELSE 0 END) OVER w AS c_out
    FROM base b
    WHERE NOT b.is_void
    WINDOW w AS (PARTITION BY b.item_id, b.warehouse_id ORDER BY b.movement_date, b.seq ROWS UNBOUNDED PRECEDING)
  ),
  layers AS (
    SELECT m.item_id, m.warehouse_id, m.c_in - m.qty AS lo, m.c_in AS hi, m.unit_cost FROM m WHERE m.direction = 'in'
  )
  SELECT m.id, m.item_id, m.warehouse_id, m.movement_date, m.seq, m.direction, m.qty, m.unit_cost,
    CASE WHEN m.direction = 'in' THEN round(m.qty * m.unit_cost, 2)
    ELSE round(coalesce((
      SELECT sum((least(m.c_out, l.hi) - greatest(m.c_out - m.qty, l.lo)) * l.unit_cost)
      FROM layers l
      WHERE l.item_id = m.item_id AND l.warehouse_id = m.warehouse_id
        AND l.lo < m.c_out AND l.hi > m.c_out - m.qty
    ), 0), 2) END,
    m.c_in, m.c_out, false
  FROM m
  UNION ALL
  SELECT b.id, b.item_id, b.warehouse_id, b.movement_date, b.seq, b.direction, b.qty, b.unit_cost,
    round(b.qty * coalesce(b.unit_cost, (
      SELECT x.unit_cost FROM public.stock_movements x
      WHERE x.direction = 'in' AND (x.id = b.reversal_of OR x.reversal_of = b.id) LIMIT 1
    ), 0), 2),
    NULL, NULL, true
  FROM base b
  WHERE b.is_void;
$$;

-- Average FIFO cost per unit of the outs a document issued for an item (used to cost returns and
-- reversals at what the goods left at). NULL when the document issued none.
CREATE OR REPLACE FUNCTION public.stock_issue_unit_cost(p_org_id uuid, p_movement_ids uuid[])
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT round(sum(f.value) / nullif(sum(f.qty), 0), 4)
  FROM public.stock_fifo_movements(p_org_id) f
  WHERE f.movement_id = ANY (p_movement_ids);
$$;

-- Refuses movements that leave an item below zero on any day from p_from onward (a backdated issue
-- can't borrow stock that only arrives later), unless the company allows negative stock. Earlier
-- negative history, recorded while the override was on, doesn't block new documents. Locks the item
-- rows so concurrent issues serialise.
CREATE OR REPLACE FUNCTION public.stock_assert_available(p_org_id uuid, p_item_ids uuid[], p_from date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF (SELECT allow_negative_stock FROM public.organisations WHERE id = p_org_id) THEN
    RETURN;
  END IF;
  PERFORM 1 FROM public.catalogue_items WHERE organisation_id = p_org_id AND id = ANY (p_item_ids) FOR UPDATE;

  SELECT coalesce(ci.sku, ci.name) INTO v_code
  FROM (
    SELECT s.item_id, s.movement_date,
      sum(CASE WHEN s.direction = 'in' THEN s.qty ELSE -s.qty END)
        OVER (PARTITION BY s.item_id, s.warehouse_id ORDER BY s.movement_date, s.seq ROWS UNBOUNDED PRECEDING) AS bal
    FROM public.stock_movements s
    WHERE s.organisation_id = p_org_id AND s.item_id = ANY (p_item_ids)
  ) b
  JOIN public.catalogue_items ci ON ci.id = b.item_id
  WHERE b.bal < 0 AND b.movement_date >= p_from
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RAISE EXCEPTION 'stock_insufficient:%', v_code;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stock_default_warehouse(p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.warehouses WHERE organisation_id = p_org_id AND is_default;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No default warehouse for this company';
  END IF;
  RETURN v_id;
END;
$$;

-- Reverses every unreversed movement a document made, each at the warehouse it touched.
-- A reversed out comes back at its FIFO cost; a reversed in leaves as an out (FIFO-costed).
CREATE OR REPLACE FUNCTION public.stock_reverse_document(p_org_id uuid, p_source_type text, p_source_id uuid, p_date date, p_narration text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m record;
BEGIN
  FOR v_m IN
    SELECT s.* FROM public.stock_movements s
    WHERE s.organisation_id = p_org_id AND s.source_type = p_source_type AND s.source_id = p_source_id
      AND s.reversal_of IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.stock_movements r WHERE r.reversal_of = s.id)
    ORDER BY s.seq
  LOOP
    INSERT INTO public.stock_movements (organisation_id, item_id, warehouse_id, movement_date, direction, qty,
      unit_cost, source_type, source_id, narration, reversal_of)
    VALUES (p_org_id, v_m.item_id, v_m.warehouse_id, greatest(p_date, v_m.movement_date),
      CASE WHEN v_m.direction = 'out' THEN 'in' ELSE 'out' END, v_m.qty,
      CASE WHEN v_m.direction = 'out' THEN coalesce(public.stock_issue_unit_cost(p_org_id, ARRAY[v_m.id]), 0) END,
      p_source_type, p_source_id, p_narration, v_m.id);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Document triggers
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_on_sales_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items uuid[];
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'issued' THEN
    WITH ins AS (
      INSERT INTO public.stock_movements (organisation_id, item_id, warehouse_id, movement_date, direction, qty,
        source_type, source_id, narration)
      SELECT NEW.organisation_id, l.item_id, public.stock_default_warehouse(NEW.organisation_id), NEW.invoice_date, 'out',
        round(sum(l.quantity), 3), 'sales_invoice', NEW.id, 'Sales invoice ' || NEW.invoice_number
      FROM public.sales_invoice_lines l
      JOIN public.catalogue_items ci ON ci.organisation_id = l.organisation_id AND ci.id = l.item_id
      WHERE l.invoice_id = NEW.id AND ci.track_inventory
      GROUP BY l.item_id
      HAVING round(sum(l.quantity), 3) > 0
      RETURNING item_id
    )
    SELECT array_agg(item_id) INTO v_items FROM ins;
    IF v_items IS NOT NULL THEN
      PERFORM public.stock_assert_available(NEW.organisation_id, v_items, NEW.invoice_date);
    END IF;
  ELSIF OLD.status = 'issued' AND NEW.status = 'cancelled' THEN
    PERFORM public.stock_reverse_document(NEW.organisation_id, 'sales_invoice', NEW.id, CURRENT_DATE,
      'Cancelled sales invoice ' || NEW.invoice_number);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_invoices_stock ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_stock
  AFTER UPDATE OF status ON public.sales_invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.stock_on_sales_invoice_status();

CREATE OR REPLACE FUNCTION public.stock_on_sales_note_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_l record;
  v_outs uuid[];
  v_wh uuid;
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'issued' AND NEW.note_type = 'credit' AND NEW.reason_code = 'sales_return' THEN
    FOR v_l IN
      SELECT l.item_id, round(sum(l.quantity), 3) AS qty
      FROM public.sales_note_lines l
      JOIN public.catalogue_items ci ON ci.organisation_id = l.organisation_id AND ci.id = l.item_id
      WHERE l.note_id = NEW.id AND ci.track_inventory
      GROUP BY l.item_id
    LOOP
      SELECT array_agg(s.id ORDER BY s.seq), (array_agg(s.warehouse_id ORDER BY s.seq))[1] INTO v_outs, v_wh
      FROM public.stock_movements s
      WHERE s.organisation_id = NEW.organisation_id AND s.source_type = 'sales_invoice'
        AND s.source_id = NEW.original_invoice_id AND s.item_id = v_l.item_id
        AND s.direction = 'out' AND s.reversal_of IS NULL;
      -- Goods the invoice never took out of stock (not tracked back then) don't come back into it.
      CONTINUE WHEN v_outs IS NULL OR v_l.qty <= 0;
      INSERT INTO public.stock_movements (organisation_id, item_id, warehouse_id, movement_date, direction, qty,
        unit_cost, source_type, source_id, narration)
      VALUES (NEW.organisation_id, v_l.item_id, v_wh, NEW.note_date, 'in', v_l.qty,
        coalesce(public.stock_issue_unit_cost(NEW.organisation_id, v_outs), 0),
        'sales_note', NEW.id, 'Sales return ' || NEW.note_number);
    END LOOP;
  ELSIF OLD.status = 'issued' AND NEW.status = 'cancelled' THEN
    PERFORM public.stock_reverse_document(NEW.organisation_id, 'sales_note', NEW.id, CURRENT_DATE,
      'Cancelled sales return ' || NEW.note_number);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_notes_stock ON public.sales_notes;
CREATE TRIGGER trg_sales_notes_stock
  AFTER UPDATE OF status ON public.sales_notes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.stock_on_sales_note_status();

CREATE OR REPLACE FUNCTION public.stock_on_purchase_bill_linked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_movements (organisation_id, item_id, warehouse_id, movement_date, direction, qty,
    unit_cost, source_type, source_id, narration)
  SELECT NEW.organisation_id, l.item_id, public.stock_default_warehouse(NEW.organisation_id), NEW.bill_date, 'in',
    l.quantity, l.rate, 'purchase_bill', NEW.id, 'Purchase bill ' || NEW.bill_number
  FROM public.purchase_bill_lines l
  JOIN public.catalogue_items ci ON ci.organisation_id = l.organisation_id AND ci.id = l.item_id
  WHERE l.bill_id = NEW.id AND ci.track_inventory
  ORDER BY l.created_at, l.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_bills_stock ON public.purchase_bills;
CREATE TRIGGER trg_purchase_bills_stock
  AFTER UPDATE OF journal_entry_id ON public.purchase_bills
  FOR EACH ROW
  WHEN (OLD.journal_entry_id IS NULL AND NEW.journal_entry_id IS NOT NULL)
  EXECUTE FUNCTION public.stock_on_purchase_bill_linked();

-- ---------------------------------------------------------------------------------------------
-- Inventory ledgers (same approach as 1025 in migration 36: no redefinition of the chart seed)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_inventory_accounts(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (organisation_id, code, name, type, account_group, ledger, sub_ledger, label, is_postable, is_system, description)
  VALUES
    (p_org_id, '1050', 'Inventory (Stock-in-Trade)', 'asset', 'asset', 'Current Assets & Receivables', 'Inventory',
     'Inventory', true, true, 'Stock on hand at FIFO cost, from opening stock and stock adjustments'),
    (p_org_id, '3030', 'Opening Balance Equity', 'equity', 'equity', 'Owner / Contributed Capital', 'Opening Balances',
     'Opening Balance Equity', true, true, 'Counter-entry for opening balances such as opening stock'),
    (p_org_id, '5015', 'Inventory Adjustment', 'expense', 'expense', 'Cost of Sales / Direct Delivery', 'Inventory Adjustment',
     'Inventory Adjustment', true, true, 'Stock found, lost, damaged or written off')
  ON CONFLICT (organisation_id, code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_add_inventory_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.add_inventory_accounts(NEW.organisation_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_add_inventory ON public.accounts;
CREATE TRIGGER trg_accounts_add_inventory
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  WHEN (NEW.code = '1020')
  EXECUTE FUNCTION public.trg_add_inventory_accounts();

SELECT public.add_inventory_accounts(organisation_id) FROM public.accounts WHERE code = '1020';

-- ---------------------------------------------------------------------------------------------
-- Opening stock and adjustments
-- ---------------------------------------------------------------------------------------------
-- p_kind 'opening' (always in; Cr Opening Balance Equity) or 'adjustment' (in: Cr Inventory Adjustment,
-- out: Dr Inventory Adjustment, valued at FIFO). Owners/admins post the voucher; an accountant's
-- voucher waits, submitted, for an owner/CFO/admin to approve.
CREATE OR REPLACE FUNCTION public.record_stock_adjustment(
  p_org_id uuid,
  p_item_id uuid,
  p_kind text,
  p_direction text,
  p_qty numeric,
  p_unit_cost numeric DEFAULT NULL,
  p_date date DEFAULT CURRENT_DATE,
  p_warehouse_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.catalogue_items;
  v_wh uuid;
  v_id uuid;
  v_value numeric(15, 2);
  v_fiscal uuid;
  v_inv uuid;
  v_contra uuid;
  v_entry uuid;
  v_status text;
  v_label text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(p_org_id, ARRAY['owner', 'admin', 'accountant']::public.organisation_role[]) THEN
    RAISE EXCEPTION 'Permission denied: cannot record stock adjustments';
  END IF;
  IF p_kind NOT IN ('opening', 'adjustment') OR p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'kind must be opening or adjustment and direction in or out';
  END IF;
  IF p_kind = 'opening' AND p_direction <> 'in' THEN
    RAISE EXCEPTION 'Opening stock is always an inward movement';
  END IF;
  IF p_qty IS NULL OR round(p_qty, 3) <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;
  IF p_direction = 'in' AND (p_unit_cost IS NULL OR p_unit_cost < 0) THEN
    RAISE EXCEPTION 'A unit cost is required for inward stock';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'A date is required';
  END IF;

  SELECT * INTO v_item FROM public.catalogue_items WHERE id = p_item_id AND organisation_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF NOT v_item.track_inventory THEN
    RAISE EXCEPTION 'Turn on inventory tracking for % first', v_item.name;
  END IF;

  IF p_warehouse_id IS NULL THEN
    v_wh := public.stock_default_warehouse(p_org_id);
  ELSE
    SELECT id INTO v_wh FROM public.warehouses WHERE id = p_warehouse_id AND organisation_id = p_org_id;
    IF v_wh IS NULL THEN
      RAISE EXCEPTION 'Warehouse not found';
    END IF;
  END IF;

  SELECT id INTO v_fiscal FROM public.fiscal_periods
  WHERE organisation_id = p_org_id AND status = 'open' AND p_date BETWEEN start_date AND end_date
  LIMIT 1;
  IF v_fiscal IS NULL THEN
    RAISE EXCEPTION 'No open fiscal period covers %', p_date;
  END IF;

  v_label := initcap(p_kind) || ' stock ' || CASE WHEN p_kind = 'adjustment' THEN p_direction || ' ' ELSE '' END
    || coalesce(v_item.sku, v_item.name) || coalesce(': ' || nullif(btrim(p_reason), ''), '');

  INSERT INTO public.stock_movements (organisation_id, item_id, warehouse_id, movement_date, direction, qty,
    unit_cost, source_type, narration)
  VALUES (p_org_id, p_item_id, v_wh, p_date, p_direction, round(p_qty, 3),
    CASE WHEN p_direction = 'in' THEN p_unit_cost END, p_kind, v_label)
  RETURNING id INTO v_id;

  IF p_direction = 'out' THEN
    PERFORM public.stock_assert_available(p_org_id, ARRAY[p_item_id], p_date);
  END IF;

  SELECT f.value INTO v_value FROM public.stock_fifo_movements(p_org_id) f WHERE f.movement_id = v_id;

  PERFORM public.add_inventory_accounts(p_org_id);
  SELECT id INTO v_inv FROM public.accounts WHERE organisation_id = p_org_id AND code = '1050';
  SELECT id INTO v_contra FROM public.accounts WHERE organisation_id = p_org_id
    AND code = CASE WHEN p_kind = 'opening' THEN '3030' ELSE '5015' END;

  -- A zero-value movement (free stock, or an out with no cost layers left) has nothing to journal.
  IF v_value > 0 THEN
    INSERT INTO public.journal_entries (organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, reference, created_by)
    VALUES (p_org_id, v_fiscal, 'STK-' || upper(left(replace(v_id::text, '-', ''), 12)), p_date, 'draft', v_label,
      'stock:' || v_id::text, auth.uid())
    RETURNING id INTO v_entry;

    INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, description, debit, credit)
    VALUES
      (p_org_id, v_entry, 1, CASE WHEN p_direction = 'in' THEN v_inv ELSE v_contra END, v_label, v_value, 0),
      (p_org_id, v_entry, 2, CASE WHEN p_direction = 'in' THEN v_contra ELSE v_inv END, v_label, 0, v_value);

    IF auth.uid() IS NULL OR public.has_role(p_org_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[]) THEN
      PERFORM public.post_journal_entry(p_org_id, v_entry);
      v_status := 'posted';
    ELSE
      UPDATE public.journal_entries SET submitted_at = now(), submitted_by = auth.uid() WHERE id = v_entry;
      v_status := 'pending_approval';
    END IF;
  END IF;

  RETURN jsonb_build_object('movement_id', v_id, 'value', v_value, 'journal_entry_id', v_entry, 'journal_status', v_status);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------------------------
-- Qty on hand and FIFO value per item and warehouse as of a date. Value is what's left of the in
-- layers after the cumulative outs, so it is exactly zero when the quantity is.
CREATE OR REPLACE FUNCTION public.get_stock_summary(p_org_id uuid, p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  item_id uuid, item_name text, sku text, unit_code text, warehouse_id uuid, warehouse_name text,
  qty_on_hand numeric, fifo_value numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
  WITH f AS (SELECT * FROM public.stock_fifo_movements(p_org_id, p_as_of)),
  totals AS (
    SELECT f.item_id, f.warehouse_id, coalesce(max(f.cum_in), 0) AS t_in, coalesce(max(f.cum_out), 0) AS t_out
    FROM f GROUP BY f.item_id, f.warehouse_id
  )
  SELECT t.item_id, ci.name, ci.sku, ci.unit_code, t.warehouse_id, w.name,
    t.t_in - t.t_out,
    round(coalesce((
      SELECT sum(greatest(0, f.cum_in - greatest(f.cum_in - f.qty, t.t_out)) * f.unit_cost)
      FROM f WHERE f.item_id = t.item_id AND f.warehouse_id = t.warehouse_id AND f.direction = 'in' AND NOT f.voided
    ), 0), 2)
  FROM totals t
  JOIN public.catalogue_items ci ON ci.id = t.item_id
  JOIN public.warehouses w ON w.id = t.warehouse_id
  ORDER BY ci.name, w.name;
END;
$$;

-- Movements of one item between two dates with the FIFO value of each (cost of goods issued for outs)
-- and the running quantity and value across all warehouses.
CREATE OR REPLACE FUNCTION public.get_stock_ledger(p_org_id uuid, p_item_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE (
  movement_id uuid, movement_date date, warehouse_id uuid, warehouse_name text, direction text, qty numeric,
  unit_cost numeric, value numeric, source_type text, source_id uuid, narration text, reversal_of uuid,
  balance_qty numeric, balance_value numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
  SELECT x.movement_id, x.movement_date, x.warehouse_id, x.warehouse_name, x.direction, x.qty, x.unit_cost,
    x.value, x.source_type, x.source_id, x.narration, x.reversal_of, x.balance_qty, x.balance_value
  FROM (
    SELECT f.movement_id, f.movement_date, f.seq, f.warehouse_id, wh.name AS warehouse_name, f.direction, f.qty,
      CASE WHEN f.direction = 'in' THEN f.unit_cost ELSE round(f.value / f.qty, 4) END AS unit_cost,
      f.value, s.source_type, s.source_id, s.narration, s.reversal_of,
      sum(CASE WHEN f.direction = 'in' THEN f.qty ELSE -f.qty END) OVER run AS balance_qty,
      sum(CASE WHEN f.direction = 'in' THEN f.value ELSE -f.value END) OVER run AS balance_value
    FROM public.stock_fifo_movements(p_org_id, p_to) f
    JOIN public.stock_movements s ON s.id = f.movement_id
    JOIN public.warehouses wh ON wh.id = f.warehouse_id
    WHERE f.item_id = p_item_id
    WINDOW run AS (ORDER BY f.movement_date, f.seq ROWS UNBOUNDED PRECEDING)
  ) x
  WHERE p_from IS NULL OR x.movement_date >= p_from
  ORDER BY x.movement_date, x.seq;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges (migration 18/26 rules)
-- ---------------------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.guard_warehouse_default(),
  public.create_default_warehouse(),
  public.guard_stock_movement_immutability(),
  public.stock_fifo_movements(uuid, date),
  public.stock_issue_unit_cost(uuid, uuid[]),
  public.stock_assert_available(uuid, uuid[], date),
  public.stock_default_warehouse(uuid),
  public.stock_reverse_document(uuid, text, uuid, date, text),
  public.stock_on_sales_invoice_status(),
  public.stock_on_sales_note_status(),
  public.stock_on_purchase_bill_linked(),
  public.add_inventory_accounts(uuid),
  public.trg_add_inventory_accounts()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.record_stock_adjustment(uuid, uuid, text, text, numeric, numeric, date, uuid, text),
  public.get_stock_summary(uuid, date),
  public.get_stock_ledger(uuid, uuid, date, date)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.record_stock_adjustment(uuid, uuid, text, text, numeric, numeric, date, uuid, text),
  public.get_stock_summary(uuid, date),
  public.get_stock_ledger(uuid, uuid, date, date)
TO authenticated, service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_stock_summary(uuid, date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.stock_fifo_movements(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'inventory function privileges are too wide';
  END IF;
END $$;
