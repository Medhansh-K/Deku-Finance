import { describe, it, expect } from "vitest";
import { buildGstr1, buildGstr3b, ReturnInvoice } from "@/lib/gst/returns";
import type { Account, JournalEntry, SalesInvoiceLine } from "@/types/accounting";
import type { PurchaseBill } from "@/lib/purchases/bills";

const OUR = "27AAPFU0939F1ZV"; // Maharashtra
const CUSTOMER = "29AABCT1332L1ZA";
const PERIOD = "102026";

let lineNo = 0;
function line(
  hsn: string,
  qty: number,
  unit: string,
  taxable: number,
  rate: number,
  tax: { cgst?: number; sgst?: number; igst?: number }
): SalesInvoiceLine {
  return {
    line_number: ++lineNo,
    item_name: "item",
    hsn_sac_code: hsn,
    unit_code: unit,
    quantity: qty,
    unit_price: taxable / qty,
    taxable_amount: taxable,
    gst_rate: rate,
    cgst_amount: tax.cgst ?? 0,
    sgst_amount: tax.sgst ?? 0,
    igst_amount: tax.igst ?? 0,
    cess_amount: 0,
    total_amount: taxable + (tax.cgst ?? 0) + (tax.sgst ?? 0) + (tax.igst ?? 0),
  };
}

function invoice(
  num: string,
  date: string,
  status: ReturnInvoice["status"],
  supply: ReturnInvoice["supply_type"],
  pos: string,
  gstin: string | null,
  lines: SalesInvoiceLine[],
  header: { taxable: number; cgst: number; sgst: number; igst: number; total: number }
): ReturnInvoice {
  return {
    id: num,
    organisation_id: "org",
    customer_id: "cust",
    invoice_number: num,
    invoice_date: date,
    due_date: date,
    status,
    supply_type: supply,
    place_of_supply: pos,
    taxable_amount: header.taxable,
    cgst_amount: header.cgst,
    sgst_amount: header.sgst,
    igst_amount: header.igst,
    cess_amount: 0,
    total_amount: header.total,
    parties: { legal_name: "Customer", gstin },
    sales_invoice_lines: lines,
  };
}

// B2B intra-state, two rates; 8471 goods and 9983 services.
const inv1 = invoice("INV-001", "2026-10-05", "issued", "intra_state", "27-Maharashtra", CUSTOMER, [
  line("8471", 2, "NOS", 1000, 18, { cgst: 90, sgst: 90 }),
  line("8471", 1, "NOS", 500, 18, { cgst: 45, sgst: 45 }),
  line("9983", 1, "OTH", 200, 12, { cgst: 12, sgst: 12 }),
], { taxable: 1700, cgst: 147, sgst: 147, igst: 0, total: 1994 });
// B2C inter-state below the B2CL limit.
const inv2 = invoice("INV-002", "2026-10-10", "issued", "inter_state", "07-Delhi", null, [
  line("8471", 1, "NOS", 10000.1, 18, { igst: 1800.02 }),
], { taxable: 10000.1, cgst: 0, sgst: 0, igst: 1800.02, total: 11800.12 });
// B2C intra-state.
const inv3 = invoice("INV-003", "2026-10-12", "issued", "intra_state", "27", null, [
  line("8471", 3, "NOS", 300.1, 18, { cgst: 27.01, sgst: 27.01 }),
], { taxable: 300.1, cgst: 27.01, sgst: 27.01, igst: 0, total: 354.12 });
const cancelled = invoice("INV-004", "2026-10-15", "cancelled", "intra_state", "27", CUSTOMER, [
  line("8471", 1, "NOS", 50000, 18, { cgst: 4500, sgst: 4500 }),
], { taxable: 50000, cgst: 4500, sgst: 4500, igst: 0, total: 59000 });
const outOfPeriod = invoice("INV-005", "2026-09-30", "issued", "intra_state", "27", CUSTOMER, [
  line("8471", 1, "NOS", 70000, 18, { cgst: 6300, sgst: 6300 }),
], { taxable: 70000, cgst: 6300, sgst: 6300, igst: 0, total: 82600 });
const draft = invoice("INV-006", "2026-10-20", "draft", "intra_state", "27", null, [], {
  taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
});
const invoices = [inv1, inv2, inv3, cancelled, outOfPeriod, draft];

const acct = (id: string, name: string) => ({ id, name } as Account);
const accounts = [
  acct("a1", "Input CGST 9%"),
  acct("a2", "Input SGST 9%"),
  acct("a3", "Input IGST 18%"),
  acct("a4", "Purchases"),
];
const jl = (account_id: string, debit: number, credit = 0) => ({ line_number: 1, account_id, debit, credit });
const je = (id: string, date: string, status: JournalEntry["status"], lines: ReturnType<typeof jl>[], reversal_of_id?: string) =>
  ({ id, entry_number: id, entry_date: date, status, reversal_of_id, journal_entry_lines: lines } as JournalEntry);
const journals = [
  je("J1", "2026-10-03", "posted", [jl("a4", 1000), jl("a1", 90), jl("a2", 90)]),
  je("J2", "2026-10-20", "posted", [jl("a3", 180.55)]),
  je("J3", "2026-09-28", "posted", [jl("a1", 50)]), // previous month
  je("J4", "2026-10-21", "reversed", [jl("a1", 10)]), // reversed within the month
  je("J5", "2026-10-22", "posted", [jl("a1", 0, 10)], "J4"),
  je("J6", "2026-10-23", "draft", [jl("a1", 999)]),
];

describe("buildGstr1", () => {
  const r = buildGstr1({ gstin: OUR, retPeriod: PERIOD, invoices });

  it("produces a file with no errors", () => {
    expect(r.errors).toEqual([]);
    expect(r.json).toMatchObject({ gstin: OUR, fp: PERIOD });
  });

  it("puts registered buyers in B2B with items grouped by rate", () => {
    expect(r.json!.b2b).toEqual([
      {
        ctin: CUSTOMER,
        inv: [
          {
            inum: "INV-001",
            idt: "05-10-2026",
            val: 1994,
            pos: "27",
            rchrg: "N",
            inv_typ: "R",
            itms: [
              { num: 1801, itm_det: { rt: 18, txval: 1500, iamt: 0, camt: 135, samt: 135, csamt: 0 } },
              { num: 1201, itm_det: { rt: 12, txval: 200, iamt: 0, camt: 12, samt: 12, csamt: 0 } },
            ],
          },
        ],
      },
    ]);
  });

  it("puts unregistered buyers in B2CS by supply type, place of supply and rate", () => {
    expect(r.json!.b2cs).toEqual([
      { sply_ty: "INTER", pos: "07", typ: "OE", rt: 18, txval: 10000.1, iamt: 1800.02, camt: 0, samt: 0, csamt: 0 },
      { sply_ty: "INTRA", pos: "27", typ: "OE", rt: 18, txval: 300.1, iamt: 0, camt: 27.01, samt: 27.01, csamt: 0 },
    ]);
  });

  it("summarises HSN split by B2B/B2C, with services as NA", () => {
    expect(r.json!.hsn).toEqual({
      hsn_b2b: [
        { num: 1, hsn_sc: "8471", uqc: "NOS", qty: 3, rt: 18, txval: 1500, iamt: 0, camt: 135, samt: 135, csamt: 0 },
        { num: 2, hsn_sc: "9983", uqc: "NA", qty: 0, rt: 12, txval: 200, iamt: 0, camt: 12, samt: 12, csamt: 0 },
      ],
      hsn_b2c: [
        { num: 1, hsn_sc: "8471", uqc: "NOS", qty: 4, rt: 18, txval: 10300.2, iamt: 1800.02, camt: 27.01, samt: 27.01, csamt: 0 },
      ],
    });
  });

  it("excludes cancelled, out-of-period and draft invoices from figures, but counts the cancelled one as a document", () => {
    expect(r.summary[0].amounts!.txval).toBe(1700);
    expect(r.json!.doc_issue).toEqual({
      doc_det: [{ doc_num: 1, docs: [{ num: 1, from: "INV-001", to: "INV-004", totnum: 4, cancel: 1, net_issue: 3 }] }],
    });
  });

  it("blocks when the company has no GSTIN", () => {
    const blocked = buildGstr1({ gstin: null, retPeriod: PERIOD, invoices });
    expect(blocked.json).toBeNull();
    expect(blocked.errors[0]).toMatch(/Company GSTIN is missing/);
  });

  it("flags an intra-state invoice carrying IGST", () => {
    const bad = invoice("INV-007", "2026-10-25", "issued", "intra_state", "27", null, [
      line("8471", 1, "NOS", 100, 18, { igst: 18 }),
    ], { taxable: 100, cgst: 0, sgst: 0, igst: 18, total: 118 });
    const res = buildGstr1({ gstin: OUR, retPeriod: PERIOD, invoices: [...invoices, bad] });
    expect(res.json).toBeNull();
    expect(res.errors).toContain("Invoice INV-007: is intra-state but carries IGST.");
  });

  it("flags header tax that does not equal its lines", () => {
    const bad = { ...inv3, invoice_number: "INV-008", cgst_amount: 27 };
    const res = buildGstr1({ gstin: OUR, retPeriod: PERIOD, invoices: [bad] });
    expect(res.errors).toContain("Invoice INV-008: CGST ₹27.00 does not equal the sum of its lines ₹27.01.");
  });
});

describe("buildGstr3b", () => {
  const r = buildGstr3b({ gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals });

  it("computes 3.1, 3.2 and Table 4 from the books", () => {
    expect(r.errors).toEqual([]);
    expect(r.json).toEqual({
      gstin: OUR,
      ret_period: PERIOD,
      sup_details: {
        osup_det: { txval: 12000.2, iamt: 1800.02, camt: 174.01, samt: 174.01, csamt: 0 },
        osup_zero: { txval: 0, iamt: 0, csamt: 0 },
        osup_nil_exmp: { txval: 0 },
      },
      inter_sup: { unreg_details: [{ pos: "07", txval: 10000.1, iamt: 1800.02 }] },
      itc_elg: {
        itc_avl: [{ ty: "OTH", iamt: 180.55, camt: 90, samt: 90, csamt: 0 }],
        itc_net: { iamt: 180.55, camt: 90, samt: 90, csamt: 0 },
      },
    });
  });

  it("marks ITC not computed and blocks when an Input ledger is credited", () => {
    const setOff = je("J9", "2026-10-31", "posted", [jl("a1", 0, 50)]);
    const res = buildGstr3b({ gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals: [...journals, setOff] });
    expect(res.json).toBeNull();
    expect(res.summary.find((s) => s.section.startsWith("4"))!.amounts).toBeNull();
    expect(res.errors[0]).toMatch(/ITC not computed: entry J9 credits Input CGST 9%/);
  });

  const bill = (over: Partial<PurchaseBill>): PurchaseBill => ({
    id: "b",
    organisation_id: "org",
    party_id: null,
    supplier_name: "Supplier",
    supplier_gstin: "27AABCS1429B1ZU",
    bill_number: "B-1",
    bill_date: "2026-10-05",
    place_of_supply: "27",
    taxable_amount: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    cess: 0,
    total_amount: 1180,
    itc_eligibility: "eligible",
    blocked_reason: null,
    journal_entry_id: null,
    ...over,
  });
  const bills = [
    bill({}),
    bill({ bill_number: "B-2", supplier_gstin: CUSTOMER, cgst: 0, sgst: 0, igst: 180.55, total_amount: 1180.55 }),
    bill({ bill_number: "B-3", itc_eligibility: "blocked_17_5", blocked_reason: "Motor vehicle", cgst: 140, sgst: 140, taxable_amount: 2000 }),
    bill({ bill_number: "B-4", itc_eligibility: "ineligible_other", blocked_reason: "Time-barred u/s 16(4)", cgst: 5, sgst: 5 }),
    bill({ bill_number: "B-5", bill_date: "2026-09-30", cgst: 999, sgst: 999 }), // other period
  ];

  it("takes Table 4 from purchase bills: 17(5) in 4(A) and reversed in 4(B)(1), other ineligible in 4(D)(2)", () => {
    // The set-off credit would block the ledger path; with bills for the period it is not consulted.
    const setOff = je("J9", "2026-10-31", "posted", [jl("a1", 0, 50)]);
    const res = buildGstr3b({ gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals: [...journals, setOff], purchaseBills: bills });
    expect(res.errors).toEqual([]);
    expect(res.json!.itc_elg).toEqual({
      itc_avl: [{ ty: "OTH", iamt: 180.55, camt: 230, samt: 230, csamt: 0 }],
      itc_rev: [{ ty: "RUL", iamt: 0, camt: 140, samt: 140, csamt: 0 }],
      itc_net: { iamt: 180.55, camt: 90, samt: 90, csamt: 0 },
      itc_inelg: [{ ty: "OTH", iamt: 0, camt: 5, samt: 5, csamt: 0 }],
    });
    expect(res.summary.map((s) => s.section)).toContain("4(B)(1) Reversed: blocked u/s 17(5)");
  });

  it("falls back to the ledgers when no bill is dated in the period", () => {
    const res = buildGstr3b({ gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals, purchaseBills: [bills[4]] });
    expect(res.json!.itc_elg).toEqual(r.json!.itc_elg);
  });

  it("blocks on an invalid purchase bill", () => {
    const res = buildGstr3b({
      gstin: OUR, retPeriod: PERIOD, invoices, accounts, journals,
      purchaseBills: [bill({ itc_eligibility: "blocked_17_5", blocked_reason: null })],
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
