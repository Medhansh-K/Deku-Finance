import { describe, it, expect } from "vitest";
import { adjustmentPayload, stockErrorMessage, totalValuePaise, AdjustmentForm, StockSummaryRow } from "@/lib/inventory/stock";

const form = (patch: Partial<AdjustmentForm> = {}): AdjustmentForm => ({
  item_id: "i1",
  kind: "adjustment",
  direction: "in",
  qty: "2.5",
  unit_cost: "110",
  date: "2026-10-01",
  warehouse_id: "",
  reason: "  count ",
  ...patch,
});

describe("adjustmentPayload", () => {
  it("maps an inward adjustment", () => {
    expect(adjustmentPayload(form())).toEqual({
      payload: {
        item_id: "i1", kind: "adjustment", direction: "in", qty: 2.5, unit_cost: 110,
        date: "2026-10-01", warehouse_id: null, reason: "count",
      },
    });
  });

  it("forces opening stock inward and needs its cost", () => {
    const r = adjustmentPayload(form({ kind: "opening", direction: "out", unit_cost: "" }));
    expect(r).toEqual({ error: "Enter the unit cost of the stock coming in" });
    const ok = adjustmentPayload(form({ kind: "opening", direction: "out" }));
    expect("payload" in ok && ok.payload.direction).toBe("in");
  });

  it("sends no cost for an outward adjustment (FIFO prices it)", () => {
    const r = adjustmentPayload(form({ direction: "out", unit_cost: "999" }));
    expect("payload" in r && r.payload.unit_cost).toBeNull();
  });

  it("rejects missing item, bad qty and missing date", () => {
    expect(adjustmentPayload(form({ item_id: "" }))).toEqual({ error: "Choose an item" });
    expect(adjustmentPayload(form({ qty: "0" }))).toEqual({ error: "Quantity must be more than zero" });
    expect(adjustmentPayload(form({ qty: "" }))).toEqual({ error: "Quantity must be more than zero" });
    expect(adjustmentPayload(form({ date: "" }))).toEqual({ error: "Enter a date" });
  });
});

describe("stock helpers", () => {
  it("explains stock_insufficient and passes other errors through", () => {
    expect(stockErrorMessage("stock_insufficient:WID-01")).toMatch(/^Not enough stock of WID-01\./);
    expect(stockErrorMessage("Permission denied")).toBe("Permission denied");
  });

  it("totals the server's FIFO values in paise", () => {
    const rows = [{ fifo_value: "1750.10" }, { fifo_value: 0.2 }] as StockSummaryRow[];
    expect(totalValuePaise(rows)).toBe(175030);
  });
});
