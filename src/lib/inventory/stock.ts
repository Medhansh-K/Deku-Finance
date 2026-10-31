/**
 * Inventory (migration 42): shapes of the FIFO reports, the adjustment form -> API payload, and
 * readable stock errors. Valuation itself is done in SQL; nothing here prices stock.
 */

/** A row of get_stock_summary; numeric columns arrive as numbers or strings. */
export interface StockSummaryRow {
  item_id: string;
  item_name: string;
  sku: string | null;
  unit_code: string;
  warehouse_id: string;
  warehouse_name: string;
  qty_on_hand: number | string;
  fifo_value: number | string;
}

/** A row of get_stock_ledger: `value` is the layer cost for an in, FIFO cost of goods issued for an out. */
export interface StockLedgerRow {
  movement_id: string;
  movement_date: string;
  warehouse_id: string;
  warehouse_name: string;
  direction: "in" | "out";
  qty: number | string;
  unit_cost: number | string | null;
  value: number | string;
  source_type: StockSourceType;
  source_id: string | null;
  narration: string | null;
  reversal_of: string | null;
  balance_qty: number | string;
  balance_value: number | string;
}

export type StockSourceType = "purchase_bill" | "sales_invoice" | "sales_note" | "opening" | "adjustment" | "transfer";

export const SOURCE_LABEL: Record<StockSourceType, string> = {
  purchase_bill: "Purchase bill",
  sales_invoice: "Sales invoice",
  sales_note: "Sales return",
  opening: "Opening stock",
  adjustment: "Adjustment",
  transfer: "Transfer",
};

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  is_default: boolean;
}

export interface AdjustmentForm {
  item_id: string;
  kind: "opening" | "adjustment";
  direction: "in" | "out";
  qty: string;
  unit_cost: string;
  date: string;
  warehouse_id: string;
  reason: string;
}

export interface AdjustmentPayload {
  item_id: string;
  kind: "opening" | "adjustment";
  direction: "in" | "out";
  qty: number;
  unit_cost: number | null;
  date: string;
  warehouse_id: string | null;
  reason: string | null;
}

/** Validates the form; returns the API payload or an error. The database re-checks everything. */
export function adjustmentPayload(f: AdjustmentForm): { payload: AdjustmentPayload } | { error: string } {
  if (!f.item_id) return { error: "Choose an item" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return { error: "Enter a date" };
  const direction = f.kind === "opening" ? "in" : f.direction;
  const qty = Number(f.qty);
  if (!f.qty.trim() || !Number.isFinite(qty) || qty <= 0) return { error: "Quantity must be more than zero" };
  let unitCost: number | null = null;
  if (direction === "in") {
    unitCost = Number(f.unit_cost);
    if (!f.unit_cost.trim() || !Number.isFinite(unitCost) || unitCost < 0) {
      return { error: "Enter the unit cost of the stock coming in" };
    }
  }
  return {
    payload: {
      item_id: f.item_id,
      kind: f.kind,
      direction,
      qty,
      unit_cost: unitCost,
      date: f.date,
      warehouse_id: f.warehouse_id || null,
      reason: f.reason.trim() || null,
    },
  };
}

/** Turns the database's stock error codes into a sentence; other messages pass through. */
export function stockErrorMessage(message: string): string {
  const m = /stock_insufficient:(\S+)/.exec(message);
  if (m) {
    return `Not enough stock of ${m[1]}. Record the purchase or an adjustment first, or allow negative stock in settings.`;
  }
  return message;
}

/** Grand total of the server's FIFO values, in paise. */
export const totalValuePaise = (rows: StockSummaryRow[]) =>
  rows.reduce((sum, r) => sum + Math.round(Number(r.fifo_value) * 100), 0);
