import { describe, it, expect } from "vitest";
import {
  BillDraft,
  billKey,
  billPayload,
  computeTax,
  itcTotals,
  monthBounds,
  parseBillsCsv,
  PurchaseBill,
  purchaseVoucherLines,
  validateBill,
} from "@/lib/purchases/bills";

const OUR = "27AAPFU0939F1ZV"; // Maharashtra
const LOCAL = "27AABCS1429B1ZU"; // Maharashtra supplier
const KA = "29AABCT1332L1ZA"; // Karnataka supplier

const draft = (over: Partial<BillDraft> = {}): BillDraft => ({
  party_id: null,
  supplier_name: "Supplier",
  supplier_gstin: LOCAL,
  bill_number: "B-1",
  bill_date: "2026-10-05",
  place_of_supply: "27",
  taxable: 100000,
  cgst: 9000,
  sgst: 9000,
  igst: 0,
  cess: 0,
  itc_eligibility: "eligible",
  blocked_reason: "",
  ...over,
});

describe("validateBill", () => {
  it("accepts a valid intra-state bill", () => {
    expect(validateBill(draft())).toEqual([]);
  });

  it("rejects missing values instead of filling them", () => {
    const errs = validateBill(draft({ supplier_gstin: "", bill_number: " ", bill_date: "", taxable: null }));
    expect(errs).toEqual(
      expect.arrayContaining([
        "Supplier GSTIN is missing",
        "Bill number is missing",
        "Bill date is missing or unreadable",
        "Taxable value is missing",
      ])
    );
  });

  it("checks GSTIN check digit and the tax split", () => {
    expect(validateBill(draft({ supplier_gstin: "27AABCS1429B1ZA" }))[0]).toMatch(/not valid/);
    expect(validateBill(draft({ igst: 100 }))).toContain(
      "Supplier is in the place-of-supply state, so the bill cannot carry IGST"
    );
    expect(validateBill(draft({ sgst: 8000 }))).toContain("CGST and SGST must be equal");
    expect(validateBill(draft({ supplier_gstin: KA }))).toContain(
      "Supplier is in another state, so the bill carries IGST, not CGST/SGST"
    );
    expect(validateBill(draft({ supplier_gstin: KA, cgst: 0, sgst: 0, igst: 18000 }))).toEqual([]);
  });

  it("requires a reason for blocked ITC and catches duplicates", () => {
    expect(validateBill(draft({ itc_eligibility: "blocked_17_5" }))).toContain(
      "Give the reason ITC is blocked or ineligible"
    );
    expect(validateBill(draft(), new Set([billKey(LOCAL, "B-1")]))[0]).toMatch(/already in the register/);
  });
});

describe("computeTax and payload", () => {
  it("splits intra-state tax evenly and inter-state as IGST, in paise", () => {
    expect(computeTax(100001, 18, true)).toEqual({ cgst: 9000, sgst: 9000, igst: 0 });
    expect(computeTax(100001, 18, false)).toEqual({ cgst: 0, sgst: 0, igst: 18000 });
  });

  it("sends rupees with an exact total and drops the reason when eligible", () => {
    expect(billPayload(draft({ blocked_reason: "x" }))).toMatchObject({
      taxable_amount: 1000,
      cgst: 90,
      sgst: 90,
      total_amount: 1180,
      blocked_reason: null,
    });
  });

  it("knows the last day of each month", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2028-02").to).toBe("2028-02-29");
  });
});

describe("parseBillsCsv", () => {
  const header = "Supplier GSTIN,Supplier Name,Invoice No,Invoice Date,Taxable Value,CGST,SGST,IGST";

  it("reports missing columns for the whole file", () => {
    expect(parseBillsCsv("GSTIN,Name\n").fileError).toBe(
      "Missing columns: Supplier Name, Invoice No, Invoice Date, Taxable Value, CGST, SGST, IGST"
    );
  });

  it("maps good rows and flags bad ones with reasons", () => {
    const csv = [
      header,
      `${LOCAL},Local Traders,L-1,05/10/2026,"1,000.00",90,90,`,
      `${KA},Karnataka Co,K-1,2026-10-07,2000,,,360`,
      `${KA},Karnataka Co,K-1,2026-10-07,2000,,,360`, // duplicate in file
      `27AABCS1429B1ZA,Bad Gstin,X-1,05/10/2026,100,9,9,`,
      `${LOCAL},No Date,L-2,,100,9,9,`,
      `${LOCAL},Text Amount,L-3,05/10/2026,abc,9,9,`,
      `${LOCAL},,,05/10/2026,100,9,9,`,
    ].join("\n");
    const { rows, fileError } = parseBillsCsv(csv, { companyGstin: OUR });
    expect(fileError).toBeNull();
    expect(rows.map((r) => r.errors.length === 0)).toEqual([true, true, false, false, false, false, false]);
    expect(rows[0].draft).toMatchObject({ bill_date: "2026-10-05", taxable: 100000, cgst: 9000, igst: 0, place_of_supply: "27" });
    // IGST bill without a Place of Supply column is taken as supplied to the company's state.
    expect(rows[1].draft).toMatchObject({ place_of_supply: "27", igst: 36000, cgst: 0 });
    expect(rows[2].errors[0]).toMatch(/already in the register/);
    expect(rows[3].errors[0]).toMatch(/GSTIN 27AABCS1429B1ZA is not valid/);
    expect(rows[4].errors).toContain("Bill date is missing or unreadable");
    expect(rows[5].errors[0]).toBe('Taxable value "abc" is not a number');
    expect(rows[6].errors).toEqual(expect.arrayContaining(["Supplier name is missing", "Bill number is missing"]));
  });

  it("reads blocked ITC from optional columns and needs its reason", () => {
    const csv = [
      `${header},ITC Eligibility,Reason`,
      `${LOCAL},Caterer,C-1,05/10/2026,1000,25,25,,Blocked,Food and beverages 17(5)(b)`,
      `${LOCAL},Caterer,C-2,05/10/2026,1000,25,25,,Blocked,`,
      `${LOCAL},Caterer,C-3,05/10/2026,1000,25,25,,maybe,`,
    ].join("\n");
    const { rows } = parseBillsCsv(csv, { companyGstin: OUR });
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].draft.itc_eligibility).toBe("blocked_17_5");
    expect(rows[1].errors).toContain("Give the reason ITC is blocked or ineligible");
    expect(rows[2].errors[0]).toMatch(/ITC eligibility "maybe"/);
  });

  it("will not guess the place of supply without the company GSTIN", () => {
    const { rows } = parseBillsCsv(`${header}\n${KA},Karnataka Co,K-1,07/10/2026,2000,,,360`);
    expect(rows[0].errors).toContain("No Place of Supply column and the company GSTIN is not set");
  });
});

const row = (over: Partial<PurchaseBill>): PurchaseBill => ({
  id: "b",
  organisation_id: "org",
  party_id: null,
  supplier_name: "S",
  supplier_gstin: LOCAL,
  bill_number: "1",
  bill_date: "2026-10-05",
  place_of_supply: "27",
  taxable_amount: "1000.00",
  cgst: "90.00",
  sgst: "90.00",
  igst: 0,
  cess: 0,
  total_amount: "1180.00",
  itc_eligibility: "eligible",
  blocked_reason: null,
  journal_entry_id: null,
  ...over,
});

describe("itcTotals", () => {
  it("sums by eligibility for the month only, in paise", () => {
    const t = itcTotals(
      [
        row({}),
        row({ supplier_gstin: KA, cgst: 0, sgst: 0, igst: "180.55", taxable_amount: "1003.06" }),
        row({ itc_eligibility: "blocked_17_5", blocked_reason: "Motor car", cgst: "14.01", sgst: "14.01" }),
        row({ itc_eligibility: "ineligible_other", blocked_reason: "Time-barred", cgst: 5, sgst: 5 }),
        row({ bill_date: "2026-09-30", cgst: 999, sgst: 999 }),
      ],
      "2026-10"
    );
    expect(t.count).toBe(4);
    expect(t.eligible).toEqual({ txval: 200306, iamt: 18055, camt: 9000, samt: 9000, csamt: 0 });
    expect(t.blocked).toEqual({ txval: 100000, iamt: 0, camt: 1401, samt: 1401, csamt: 0 });
    expect(t.ineligible.camt).toBe(500);
  });
});

describe("purchaseVoucherLines", () => {
  const acc = { expense: "exp", payable: "cred", input: { camt: "icg", samt: "isg", iamt: "iig" } };

  it("debits purchase and Input GST, credits the supplier", () => {
    const { lines, errors } = purchaseVoucherLines(draft({ party_id: "p1" }), acc);
    expect(errors).toEqual([]);
    expect(lines.map((l) => [l.line_number, l.account_id, l.debit, l.credit])).toEqual([
      [1, "exp", 1000, 0],
      [2, "icg", 90, 0],
      [3, "isg", 90, 0],
      [4, "cred", 0, 1180],
    ]);
    expect(lines[3].party_id).toBe("p1");
  });

  it("books blocked tax as cost, not Input GST", () => {
    const { lines } = purchaseVoucherLines(draft({ itc_eligibility: "blocked_17_5", blocked_reason: "r" }), acc);
    expect(lines.map((l) => [l.account_id, l.debit, l.credit])).toEqual([
      ["exp", 1180, 0],
      ["cred", 0, 1180],
    ]);
  });

  it("refuses when an Input ledger or chosen account is missing", () => {
    const { errors } = purchaseVoucherLines(draft({ cess: 100 }), { expense: "", payable: "c", input: {} });
    expect(errors).toEqual(
      expect.arrayContaining([
        "Choose the purchase ledger to debit",
        'The chart of accounts has no "Input CGST" ledger',
        'The chart of accounts has no "Input Cess" ledger',
      ])
    );
  });
});
