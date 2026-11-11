import { describe, it, expect } from "vitest";
import type { ProfitLossRow, SalesInvoice } from "@/types/accounting";
import { expenseShares, groupInvoices, invoiceState } from "@/modules/executive/ActivityPanels";

const inv = (id: string, status: SalesInvoice["status"], due: string, total: number) =>
  ({ id, status, due_date: due, total_amount: total, invoice_number: id }) as SalesInvoice;

describe("executive: invoices in progress", () => {
  const today = "2026-11-11";

  it("marks an issued invoice overdue only after its due date", () => {
    expect(invoiceState(inv("a", "issued", "2026-11-10", 1), today)).toBe("overdue");
    expect(invoiceState(inv("b", "issued", "2026-11-11", 1), today)).toBe("awaiting");
    expect(invoiceState(inv("c", "cancelled", "2026-01-01", 1), today)).toBeNull();
  });

  it("counts and sums each state, leaves cancelled out, lists open ones overdue first", () => {
    const { groups, open } = groupInvoices(
      [
        inv("draft", "draft", "2026-12-01", 100),
        inv("late", "issued", "2026-11-04", 472000),
        inv("soon", "issued", "2026-11-16", 50),
        inv("paid", "paid", "2026-11-09", 708000),
        inv("void", "cancelled", "2026-11-01", 999),
      ],
      today
    );
    expect(groups).toEqual({
      draft: { count: 1, total: 100 },
      awaiting: { count: 1, total: 50 },
      overdue: { count: 1, total: 472000 },
      paid: { count: 1, total: 708000 },
    });
    expect(open.map((i) => i.id)).toEqual(["late", "soon", "draft"]);
  });
});

describe("executive: where the money goes", () => {
  const row = (name: string, type: ProfitLossRow["account_type"], net: number) =>
    ({ account_id: name, account_code: name, account_name: name, account_type: type, net_amount: net }) as ProfitLossRow;

  it("shares only expense heads with a debit balance, largest first", () => {
    const { total, heads } = expenseShares([
      row("Rent", "expense", 75),
      row("Sales", "income", 1000),
      row("Wages", "expense", 25),
      row("Discount reversed", "expense", -10),
    ]);
    expect(total).toBe(100);
    expect(heads.map((h) => [h.name, h.pct])).toEqual([
      ["Rent", 75],
      ["Wages", 25],
    ]);
  });
});
