import { describe, it, expect } from "vitest";
import {
  BuilderForm,
  canConvert,
  formErrors,
  fromDocument,
  toSavePayload,
  type BusinessDocument,
} from "@/lib/builder/business-documents";

const form = (over: Partial<BuilderForm> = {}): BuilderForm => ({
  docType: "quotation",
  docNumber: " QT-1 ",
  docDate: "2026-10-01",
  dueDate: "2026-10-31",
  partyId: "p1",
  party: { name: "Buyer" },
  placeOfSupply: "27-Maharashtra",
  interState: false,
  notes: "",
  details: {},
  items: [
    { id: "a", description: "Widget", hsn: "8471", qty: 10, unit: "NOS", rate: 100, discountPct: 10, gstRate: 18 },
    { id: "b", description: "Service", hsn: "", qty: 1, unit: "", rate: 500.3, discountPct: 0, gstRate: 5 },
  ],
  ...over,
});

describe("toSavePayload", () => {
  it("builds lines whose amounts satisfy the database checks", () => {
    const { doc, lines } = toSavePayload(form());
    expect(doc).toMatchObject({
      doc_number: "QT-1", valid_until: "2026-10-31", due_date: null, supply_type: "intra_state", party_id: "p1",
    });
    expect(lines[0]).toMatchObject({
      line_number: 1, item_name: "Widget", discount_amount: 100, taxable_amount: 900, cgst_rate: 9, cgst_amount: 81,
      sgst_amount: 81, igst_amount: 0, total_amount: 1062, unit_code: "NOS",
    });
    expect(lines[1]).toMatchObject({ unit_code: "OTH", hsn_sac_code: null, taxable_amount: 500.3 });
    for (const l of lines) {
      expect(l.total_amount).toBeCloseTo(l.taxable_amount + l.cgst_amount + l.sgst_amount + l.igst_amount + l.cess_amount, 2);
      expect(l.cgst_amount).toBe(l.sgst_amount);
    }
    // 1062 + 500.30 + 25.02 = 1587.32, rounded to 1587.
    expect(doc.round_off).toBeCloseTo(-0.32, 2);
  });

  it("charges only IGST inter-state and keeps due dates off quotations", () => {
    const { doc, lines } = toSavePayload(form({ docType: "purchase_order", interState: true }));
    expect(doc).toMatchObject({ supply_type: "inter_state", valid_until: null, due_date: "2026-10-31" });
    expect(lines[0]).toMatchObject({ cgst_amount: 0, sgst_amount: 0, igst_rate: 18, igst_amount: 162 });
  });
});

describe("fromDocument", () => {
  it("round-trips a saved document back into the form", () => {
    const f = form({ docNumber: "QT-1" });
    const { doc, lines } = toSavePayload(f);
    const saved = { ...doc, id: "d1", status: "draft", business_document_lines: lines } as unknown as BusinessDocument;
    const back = fromDocument(saved);
    expect(back).toMatchObject({ docNumber: "QT-1", dueDate: "2026-10-31", partyId: "p1", interState: false });
    expect(back.items.map(({ description, qty, rate, discountPct, gstRate, unit }) => ({ description, qty, rate, discountPct, gstRate, unit })))
      .toEqual(f.items.map(({ description, qty, rate, discountPct, gstRate, unit }) => ({ description, qty, rate, discountPct, gstRate, unit })));
  });
});

describe("rules", () => {
  it("only quotations and proformas convert, and only while open", () => {
    expect(canConvert({ doc_type: "quotation", status: "accepted" })).toBe(true);
    expect(canConvert({ doc_type: "proforma", status: "draft" })).toBe(true);
    expect(canConvert({ doc_type: "quotation", status: "converted" })).toBe(false);
    expect(canConvert({ doc_type: "purchase_order", status: "draft" })).toBe(false);
    expect(canConvert({ doc_type: "delivery_challan", status: "sent" })).toBe(false);
  });

  it("reports missing number and empty lines", () => {
    const errs = formErrors(form({ docNumber: " ", items: [{ id: "x", description: "", hsn: "", qty: 0, unit: "", rate: 1, discountPct: 0, gstRate: 0 }] }));
    expect(errs).toEqual(["Enter a document number.", "Line 1: enter the item or service.", "Line 1: quantity must be more than zero."]);
  });
});
