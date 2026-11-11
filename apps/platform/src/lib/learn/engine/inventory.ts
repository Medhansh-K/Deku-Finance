/**
 * Stock movements valued FIFO, mirroring migration 42: stock_fifo_movements, get_stock_summary,
 * get_stock_ledger, stock_assert_available and stock_reverse_document. Movements are immutable;
 * a reversal is a new movement pointing at the one it voids.
 */
import type { StockLedgerRow, StockSourceType, StockSummaryRow } from "@/lib/inventory/stock";
import type { DemoDataset, DemoStockMovement } from "../sample-data";
import { fail, newId, r2 } from "./books";

interface FifoRow {
  m: DemoStockMovement;
  value: number;
  cumIn: number | null;
  cumOut: number | null;
  voided: boolean;
}

const q3 = (n: number) => Math.round(n * 1000) / 1000;
const order = (a: DemoStockMovement, b: DemoStockMovement) =>
  a.movement_date === b.movement_date ? a.seq - b.seq : a.movement_date < b.movement_date ? -1 : 1;

/** stock_fifo_movements: each live movement with its FIFO value; voided pairs valued at their own cost. */
export function fifoMovements(ds: DemoDataset, asOf?: string | null): FifoRow[] {
  const base = ds.stockMovements.filter((m) => !asOf || m.movement_date <= asOf);
  const reversedIds = new Set(base.filter((m) => m.reversal_of).map((m) => m.reversal_of as string));
  const isVoid = (m: DemoStockMovement) => !!m.reversal_of || reversedIds.has(m.id);
  const out: FifoRow[] = [];

  const groups = new Map<string, DemoStockMovement[]>();
  for (const m of base.filter((x) => !isVoid(x))) {
    const k = `${m.item_id}|${m.warehouse_id}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  for (const list of groups.values()) {
    list.sort(order);
    const layers: { lo: number; hi: number; cost: number }[] = [];
    let cIn = 0;
    let cOut = 0;
    for (const m of list) {
      if (m.direction === "in") {
        layers.push({ lo: cIn, hi: q3(cIn + m.qty), cost: m.unit_cost ?? 0 });
        cIn = q3(cIn + m.qty);
        out.push({ m, value: r2(m.qty * (m.unit_cost ?? 0)), cumIn: cIn, cumOut: cOut, voided: false });
      } else {
        const from = cOut;
        cOut = q3(cOut + m.qty);
        let value = 0;
        for (const l of layers) {
          const overlap = Math.min(cOut, l.hi) - Math.max(from, l.lo);
          if (overlap > 0) value += overlap * l.cost;
        }
        out.push({ m, value: r2(value), cumIn: cIn, cumOut: cOut, voided: false });
      }
    }
  }
  for (const m of base.filter(isVoid)) {
    const pairCost =
      m.unit_cost ??
      base.find((x) => x.direction === "in" && (x.id === m.reversal_of || x.reversal_of === m.id))?.unit_cost ??
      0;
    out.push({ m, value: r2(m.qty * pairCost), cumIn: null, cumOut: null, voided: true });
  }
  return out.sort((a, b) => order(a.m, b.m));
}

/** get_stock_summary: quantity and remaining FIFO layers per item and warehouse. */
export function stockSummary(ds: DemoDataset, asOf?: string | null): StockSummaryRow[] {
  const f = fifoMovements(ds, asOf).filter((r) => !r.voided);
  const keys = new Map<string, { item: string; wh: string }>();
  for (const r of f) keys.set(`${r.m.item_id}|${r.m.warehouse_id}`, { item: r.m.item_id, wh: r.m.warehouse_id });
  const rows: StockSummaryRow[] = [];
  for (const { item, wh } of keys.values()) {
    const mine = f.filter((r) => r.m.item_id === item && r.m.warehouse_id === wh);
    const tIn = Math.max(0, ...mine.map((r) => r.cumIn ?? 0));
    const tOut = Math.max(0, ...mine.map((r) => r.cumOut ?? 0));
    const value = mine
      .filter((r) => r.m.direction === "in")
      .reduce((s, r) => s + Math.max(0, (r.cumIn ?? 0) - Math.max((r.cumIn ?? 0) - r.m.qty, tOut)) * (r.m.unit_cost ?? 0), 0);
    const ci = ds.catalogue.find((c) => c.id === item);
    const w = ds.warehouses.find((x) => x.id === wh);
    rows.push({
      item_id: item,
      item_name: ci?.name ?? "Unknown item",
      sku: ci?.sku ?? null,
      unit_code: ci?.unit_code ?? "NOS",
      warehouse_id: wh,
      warehouse_name: w?.name ?? "Unknown warehouse",
      qty_on_hand: q3(tIn - tOut),
      fifo_value: r2(value),
    });
  }
  return rows.sort((a, b) => a.item_name.localeCompare(b.item_name) || a.warehouse_name.localeCompare(b.warehouse_name));
}

export const stockValue = (ds: DemoDataset, asOf?: string | null) =>
  r2(stockSummary(ds, asOf).reduce((s, r) => s + Number(r.fifo_value), 0));

/** get_stock_ledger for one item, with running quantity and value. */
export function stockLedger(ds: DemoDataset, itemId: string, from?: string | null, to?: string | null): StockLedgerRow[] {
  let qty = 0;
  let val = 0;
  const rows: StockLedgerRow[] = [];
  for (const r of fifoMovements(ds, to).filter((x) => x.m.item_id === itemId)) {
    const sign = r.m.direction === "in" ? 1 : -1;
    qty = q3(qty + sign * r.m.qty);
    val = r2(val + sign * r.value);
    if (from && r.m.movement_date < from) continue;
    rows.push({
      movement_id: r.m.id,
      movement_date: r.m.movement_date,
      warehouse_id: r.m.warehouse_id,
      warehouse_name: ds.warehouses.find((w) => w.id === r.m.warehouse_id)?.name ?? "",
      direction: r.m.direction,
      qty: r.m.qty,
      unit_cost: r.m.direction === "in" ? r.m.unit_cost : r.m.qty ? Math.round((r.value / r.m.qty) * 10000) / 10000 : 0,
      value: r.value,
      source_type: r.m.source_type,
      source_id: r.m.source_id,
      narration: r.m.narration,
      reversal_of: r.m.reversal_of,
      balance_qty: qty,
      balance_value: val,
    });
  }
  return rows;
}

export function defaultWarehouse(ds: DemoDataset) {
  return ds.warehouses.find((w) => w.is_default) ?? fail("No default warehouse for this company");
}

/** Appends a movement (seq continues the company's sequence). */
export function addMovement(
  ds: DemoDataset,
  m: Omit<DemoStockMovement, "id" | "seq" | "organisation_id" | "created_at">
): { ds: DemoDataset; movement: DemoStockMovement } {
  const seq = ds.stockMovements.reduce((s, x) => Math.max(s, x.seq), 0) + 1;
  const movement: DemoStockMovement = {
    ...m,
    qty: q3(m.qty),
    id: newId(ds, "stk"),
    seq,
    organisation_id: ds.org.id,
    created_at: new Date().toISOString(),
  };
  return { ds: { ...ds, stockMovements: [...ds.stockMovements, movement] }, movement };
}

/** stock_assert_available: no running balance may go negative on or after `from` (unless the company allows it). */
export function assertAvailable(ds: DemoDataset, itemIds: string[], from: string) {
  if (ds.org.allow_negative_stock) return;
  for (const item of itemIds) {
    const byWh = new Map<string, DemoStockMovement[]>();
    for (const m of ds.stockMovements.filter((x) => x.item_id === item))
      byWh.set(m.warehouse_id, [...(byWh.get(m.warehouse_id) ?? []), m]);
    for (const list of byWh.values()) {
      let bal = 0;
      for (const m of list.sort(order)) {
        bal = q3(bal + (m.direction === "in" ? m.qty : -m.qty));
        if (bal < 0 && m.movement_date >= from) {
          const ci = ds.catalogue.find((c) => c.id === item);
          fail(`Not enough stock of ${ci?.sku || ci?.name || "this item"} on ${m.movement_date}: the sale or adjustment would take it below zero (stock_insufficient)`, 409, "stock_insufficient");
        }
      }
    }
  }
}

/** FIFO value of the given movements combined, per unit (stock_issue_unit_cost). */
export function issueUnitCost(ds: DemoDataset, movementIds: string[]): number {
  const rows = fifoMovements(ds).filter((r) => movementIds.includes(r.m.id));
  const qty = rows.reduce((s, r) => s + r.m.qty, 0);
  return qty ? Math.round((rows.reduce((s, r) => s + r.value, 0) / qty) * 10000) / 10000 : 0;
}

/** stock_reverse_document: one opposite movement per live movement of the document. */
export function reverseDocument(ds: DemoDataset, source: StockSourceType, sourceId: string, date: string, narration: string) {
  let next = ds;
  const live = ds.stockMovements
    .filter((s) => s.source_type === source && s.source_id === sourceId && !s.reversal_of)
    .filter((s) => !ds.stockMovements.some((r) => r.reversal_of === s.id))
    .sort((a, b) => a.seq - b.seq);
  for (const m of live) {
    next = addMovement(next, {
      item_id: m.item_id,
      warehouse_id: m.warehouse_id,
      movement_date: date > m.movement_date ? date : m.movement_date,
      direction: m.direction === "out" ? "in" : "out",
      qty: m.qty,
      unit_cost: m.direction === "out" ? issueUnitCost(ds, [m.id]) : null,
      source_type: source,
      source_id: sourceId,
      narration,
      reversal_of: m.id,
    }).ds;
  }
  return next;
}
