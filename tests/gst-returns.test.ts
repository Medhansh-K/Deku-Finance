import { describe, it, expect } from "vitest";
import { buildGstr1, buildGstr3b, ReturnInvoice } from "@/lib/gst/returns";
import type { Account, JournalEntry } from "@/types/accounting";
import type { PurchaseBill } from "@/lib/purchases/bills";
// Shared with the Rust port (backend/src/gst/mod.rs tests), so both must produce the same JSON.
// The fixture's zero-rated invoice and credit/debit note cases are tested in Rust only, the authority.
import fixture from "../backend/tests/fixtures/gst_returns.json";

const f = fixture as unknown as {
  gstin: string;
  ret_period: string;
  invoices: ReturnInvoice[];
  accounts: Account[];
  journals: JournalEntry[];
  cases: {
    intra_state_with_igst: ReturnInvoice;
    set_off_journal: JournalEntry;
    purchase_bills: PurchaseBill[];
    bill_missing_reason: PurchaseBill;
  };
  expected: { gstr1: unknown; gstr3b: unknown; gstr3b_eco: unknown; gstr3b_bills_itc_elg: unknown };
};
const OUR = f.gstin;
const PERIOD = f.ret_period;
const { invoices, accounts, journals } = f;
const bills = f.cases.purchase_bills;

describe("buildGstr1", () => {
  const r = buildGstr1({ gstin: OUR, retPeriod: PERIOD, invoices });

  it("produces the shared fixture's JSON: B2B by rate, B2CS, HSN split with services as NA, doc count", () => {
    expect(r.errors).toEqual([]);
    expect(r.json).toEqual(f.expected.gstr1);
  });

  it("excludes cancelled, out-of-period and draft invoices from figures", () => {
    expect(r.summary[0].amounts!.txval).toBe(1700);
  });

  it("blocks when the company has no GSTIN", () => {
    const blocked = buildGstr1({ gstin: null, retPeriod: PERIOD, invoices });
    expect(blocked.json).toBeNull();
    expect(blocked.errors[0]).toMatch(/Company GSTIN is missing/);
  });

  it("flags an intra-state invoice carrying IGST", () => {
    const res = buildGstr1({ gstin: OUR, retPeriod: PERIOD, invoices: [...invoices, f.cases.intra_state_with_igst] });
    expect(res.json).toBeNull();
    expect(res.errors).toContain("Invoice INV-007: is intra-state but carries IGST.");
  });

  it("flags header tax that does not equal its lines", () => {
    const bad = { ...invoices[2], invoice_number: "INV-008", cgst_amount: 27 };
    const res = buildGstr1({ gstin: OUR, retPeriod: PERIOD, invoices: [bad] });
    expect(res.errors).toContain("Invoice INV-008: CGST ₹27.00 does not equal the sum of its lines ₹27.01.");
  });
});

describe("buildGstr3b", () => {
  const r = buildGstr3b({ gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals });

  it("computes 3.1, 3.2 and Table 4 from the books", () => {
    expect(r.errors).toEqual([]);
    expect(r.json).toEqual(f.expected.gstr3b);
  });

  it("reports marketplace sales under 3.1.1 as information, leaving the JSON unchanged", () => {
    expect(r.summary.find((s) => s.section.startsWith("3.1.1"))!.amounts).toEqual(f.expected.gstr3b_eco);
  });

  it("marks ITC not computed and blocks when an Input ledger is credited", () => {
    const res = buildGstr3b({ gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals: [...journals, f.cases.set_off_journal] });
    expect(res.json).toBeNull();
    expect(res.summary.find((s) => s.section.startsWith("4"))!.amounts).toBeNull();
    expect(res.errors[0]).toMatch(/ITC not computed: entry J9 credits Input CGST 9%/);
  });

  it("takes Table 4 from purchase bills: 17(5) in 4(A) and reversed in 4(B)(1), other ineligible in 4(D)(2)", () => {
    // The set-off credit would block the ledger path; with bills for the period it is not consulted.
    const res = buildGstr3b({
      gstin: OUR, retPeriod: PERIOD, invoices, accounts,
      journals: [...journals, f.cases.set_off_journal], purchaseBills: bills,
    });
    expect(res.errors).toEqual([]);
    expect(res.json!.itc_elg).toEqual(f.expected.gstr3b_bills_itc_elg);
    expect(res.summary.map((s) => s.section)).toContain("4(B)(1) Reversed: blocked u/s 17(5)");
  });

  it("falls back to the ledgers when no bill is dated in the period", () => {
    const res = buildGstr3b({ gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals, purchaseBills: [bills[4]] });
    expect(res.json!.itc_elg).toEqual(r.json!.itc_elg);
  });

  it("blocks on an invalid purchase bill", () => {
    const res = buildGstr3b({
      gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals,
      purchaseBills: [f.cases.bill_missing_reason],
    });
    expect(res.json).toBeNull();
    expect(res.errors).toContain("Purchase bill B-1 (27AABCS1429B1ZU): Give the reason ITC is blocked or ineligible.");
  });

  it("blocks when the company has no GSTIN", () => {
    const res = buildGstr3b({ gstin: "", retPeriod: PERIOD, invoices, accounts, journals });
    expect(res.json).toBeNull();
    expect(res.errors[0]).toMatch(/Company GSTIN is missing/);
  });
});
