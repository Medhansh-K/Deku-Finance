import { describe, it, expect } from "vitest";
import { noteLine, noteLines } from "@/lib/invoices/notes";
import type { SalesInvoiceLine } from "@/types/accounting";

const line: SalesInvoiceLine = {
  line_number: 3,
  item_name: "Widget",
  hsn_sac_code: "8471",
  unit_code: "NOS",
  quantity: 3,
  unit_price: 100.03,
  taxable_amount: 300.1,
  gst_rate: 18,
  cgst_rate: 9,
  cgst_amount: 27.01,
  sgst_rate: 9,
  sgst_amount: 27.01,
  total_amount: 354.12,
};

describe("noteLine", () => {
  it("reproduces the original line for its full quantity", () => {
    expect(noteLine(line, 3, 1)).toMatchObject({
      line_number: 1, quantity: 3, taxable_amount: 300.1, cgst_amount: 27.01, sgst_amount: 27.01, igst_amount: 0, total_amount: 354.12,
    });
  });

  it("scales each head to the paisa for a partial quantity and keeps CGST equal to SGST", () => {
    const n = noteLine(line, 1, 1);
    expect(n).toMatchObject({ taxable_amount: 100.03, cgst_amount: 9, sgst_amount: 9, total_amount: 118.03 });
  });
});

describe("noteLines", () => {
  it("leaves out lines with no quantity and renumbers the rest", () => {
    const out = noteLines([line, { ...line, item_name: "Other" }], [0, 2]);
    expect(out.map((l) => [l.line_number, l.item_name, l.quantity])).toEqual([[1, "Other", 2]]);
  });
});
