import { describe, it, expect } from "vitest";
import type { Account, JournalEntry, JournalStatus, Party, SalesInvoice } from "@/types/accounting";
import {
  ageBuckets,
  daysOutstanding,
  findControlAccount,
  fyStart,
  partyBalances,
} from "@/lib/reports/ledger";
import { operatingExpenses } from "@/lib/reports/expenses";
import { computeKpis } from "@/lib/reports/kpis";
import { journalToVoucher } from "@/lib/reports/vouchers";

const acct = (id: string, code: string, name: string, group: Account["account_group"], extra: Partial<Account> = {}): Account => ({
  id,
  organisation_id: "org",
  code,
  name,
  type: group === "revenue" ? "income" : group,
  account_group: group,
  ledger: "",
  sub_ledger: "",
  label: name,
  is_postable: true,
  is_active: true,
  is_system: true,
  ...extra,
});

const ACCOUNTS = [
  acct("bank", "1020", "Operating Bank Account", "asset"),
  acct("ar", "1030", "Accounts Receivable (Customer Trade Debtors)", "asset"),
  acct("itc", "1081", "Input CGST 9%", "asset"),
  acct("ap", "2010", "Accounts Payable (Trade Creditors)", "liability"),
  acct("ogst", "2081", "Output CGST Payable (9%)", "liability"),
  acct("cap", "3010", "Owner Capital", "equity"),
  acct("sales", "4010", "Sales Revenue", "revenue"),
  acct("cogs", "5010", "Cost of Goods Sold (COGS)", "expense"),
  acct("rent", "5040", "Office Rent", "expense"),
  acct("cloud", "5030", "Cloud Infrastructure", "expense"),
];

const PARTIES: Party[] = [
  { id: "v1", organisation_id: "org", type: "vendor", legal_name: "Vendor One" },
  { id: "c1", organisation_id: "org", type: "customer", legal_name: "Customer One", display_name: "C One" },
];

let n = 0;
type L = [account: string, debit: number, credit: number, party?: string];
function je(date: string, lines: L[], status: JournalStatus = "posted", extra: Partial<JournalEntry> = {}): JournalEntry {
  const id = extra.id ?? `je${++n}`;
  return {
    id,
    organisation_id: "org",
    fiscal_period_id: "fp",
    entry_number: extra.entry_number ?? `JRN-${String(n).padStart(4, "0")}`,
    entry_date: date,
    status,
    narration: "test",
    journal_entry_lines: lines.map(([account_id, debit, credit, party_id], i) => ({
      line_number: i + 1,
      account_id,
      debit,
      credit,
      party_id: party_id ?? null,
    })),
    ...extra,
  };
}

const ASOF = "2026-10-28";

describe("empty books", () => {
  it("has no party balances, no DSO and only null KPIs", () => {
    expect(partyBalances([], "ap", "payable", ASOF)).toEqual([]);
    expect(daysOutstanding([], "ap", "payable", 0, ASOF)).toBeNull();
    expect(ageBuckets([])).toEqual({ d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 });
    expect(operatingExpenses([], ACCOUNTS, PARTIES, "2026-04-01", ASOF)).toEqual({ vouchers: [], byHead: [], totalPaise: 0 });

    const k = computeKpis({ accounts: ACCOUNTS, journals: [], invoices: [], from: "2026-04-01", asOf: ASOF });
    expect(k.hasEntries).toBe(false);
    for (const key of ["turnoverPaise", "profitPaise", "billedPaise", "liquidPaise", "debtorsPaise", "creditorsPaise", "expensesPaise", "assetsPaise", "equityPaise"] as const)
      expect(k[key]).toBeNull();
    expect(k.balanced).toBeNull();
  });

  it("treats drafts as not booked", () => {
    const draft = je("2026-10-01", [["rent", 500, 0], ["bank", 0, 500]], "draft");
    const k = computeKpis({ accounts: ACCOUNTS, journals: [draft], invoices: [], from: "2026-04-01", asOf: ASOF });
    expect(k.hasEntries).toBe(false);
    expect(operatingExpenses([draft], ACCOUNTS, PARTIES, "2026-04-01", ASOF).vouchers).toEqual([]);
  });
});

describe("control accounts", () => {
  it("finds the seeded debtor and creditor ledgers and not GST payables", () => {
    expect(findControlAccount(ACCOUNTS, "receivable")?.id).toBe("ar");
    expect(findControlAccount(ACCOUNTS, "payable")?.id).toBe("ap");
    const noCodes = ACCOUNTS.filter((a) => a.id !== "ap").concat(acct("ap2", "2999", "Sundry Creditors", "liability"));
    expect(findControlAccount(noCodes, "payable")?.id).toBe("ap2");
    expect(findControlAccount([ACCOUNTS[4]], "payable")).toBeUndefined();
  });
});

describe("per-party payables", () => {
  it("ages vendor bills first-in-first-out and sums in paise", () => {
    const journals = [
      je("2026-07-01", [["cloud", 100.1, 0], ["ap", 0, 100.1, "v1"]]),
      je("2026-09-15", [["rent", 200.2, 0], ["ap", 0, 200.2, "v1"]]),
      je("2026-10-01", [["ap", 150.15, 0, "v1"], ["bank", 0, 150.15]]),
    ];
    const [v] = partyBalances(journals, "ap", "payable", ASOF);
    expect(v.partyId).toBe("v1");
    expect(v.balancePaise).toBe(15015);
    // The payment cleared the July bill and half of the September one.
    expect(v.openItems.map((i) => [i.date, i.openPaise, i.ageDays])).toEqual([["2026-09-15", 15015, 43]]);
    expect(ageBuckets([v])).toEqual({ d0_30: 0, d31_60: 15015, d61_90: 0, d90_plus: 0 });
  });

  it("drops a reversed bill together with its reversal", () => {
    const bill = je("2026-08-01", [["rent", 500, 0], ["ap", 0, 500, "v1"]], "reversed", { id: "b1" });
    const rev = je("2026-08-05", [["ap", 500, 0, "v1"], ["rent", 0, 500]], "posted", { reversal_of_id: "b1" });
    const keep = je("2026-10-20", [["rent", 80, 0], ["ap", 0, 80, "v1"]]);
    const [v] = partyBalances([bill, rev, keep], "ap", "payable", ASOF);
    expect(v.balancePaise).toBe(8000);
    expect(v.openItems).toHaveLength(1);
    expect(v.openItems[0].entryId).toBe(keep.id);
  });

  it("keeps an overpayment as an advance and lines without a party apart", () => {
    const journals = [
      je("2026-10-01", [["ap", 300, 0, "v1"], ["bank", 0, 300]]),
      je("2026-10-10", [["rent", 100, 0], ["ap", 0, 100, "v1"]]),
      je("2026-10-11", [["rent", 40, 0], ["ap", 0, 40]]),
    ];
    const ps = partyBalances(journals, "ap", "payable", ASOF);
    const v1 = ps.find((p) => p.partyId === "v1")!;
    expect(v1.balancePaise).toBe(-20000);
    expect(v1.advancePaise).toBe(20000);
    expect(v1.openItems).toEqual([]);
    expect(ps.find((p) => p.partyId === null)!.balancePaise).toBe(4000);
  });
});

describe("days outstanding", () => {
  it("uses the age of the books when younger than a year", () => {
    const journals = [
      je("2026-08-30", [["ar", 1000, 0, "c1"], ["sales", 0, 1000]]),
      je("2026-10-28", [["bank", 500, 0], ["ar", 0, 500, "c1"]]),
    ];
    // 60-day window, ₹1,000 of credit sales, ₹500 outstanding: 30 days.
    expect(daysOutstanding(journals, "ar", "receivable", 50000, ASOF)).toBe(30);
    expect(daysOutstanding(journals, "ap", "payable", 0, ASOF)).toBeNull();
  });
});

describe("operating expenses", () => {
  const journals = [
    je("2026-03-31", [["rent", 999, 0], ["bank", 0, 999]]),
    je("2026-05-01", [["rent", 1000, 0], ["itc", 90, 0], ["ap", 0, 1090, "v1"]]),
    je("2026-06-01", [["cloud", 250.5, 0], ["bank", 0, 250.5]]),
    je("2026-06-02", [["cogs", 700, 0], ["bank", 0, 700]]),
    je("2026-06-03", [["bank", 10000, 0], ["sales", 0, 10000]]),
  ];

  it("totals by head for the period, excluding cost of sales", () => {
    const r = operatingExpenses(journals, ACCOUNTS, PARTIES, "2026-04-01", ASOF);
    expect(r.totalPaise).toBe(125050);
    expect(r.byHead.map((h) => [h.name, h.amountPaise, h.entries])).toEqual([
      ["Office Rent", 100000, 1],
      ["Cloud Infrastructure", 25050, 1],
    ]);
    const bill = r.vouchers.find((v) => v.date === "2026-05-01")!;
    expect(bill.partyName).toBe("Vendor One");
    expect(bill.sources).toEqual(["Accounts Payable (Trade Creditors)"]);
    expect(bill.amountPaise).toBe(100000);
  });

  it("feeds the KPIs", () => {
    const invoices = [
      { status: "issued", invoice_date: "2026-06-03", total_amount: 11800 },
      { status: "draft", invoice_date: "2026-06-04", total_amount: 5000 },
      { status: "cancelled", invoice_date: "2026-06-05", total_amount: 5000 },
    ] as SalesInvoice[];
    const k = computeKpis({ accounts: ACCOUNTS, journals, invoices, from: "2026-04-01", asOf: ASOF });
    expect(k.turnoverPaise).toBe(1000000);
    expect(k.expensesPaise).toBe(125050);
    expect(k.profitPaise).toBe(1000000 - 125050 - 70000);
    expect(k.billedPaise).toBe(1180000);
    expect(k.liquidPaise).toBe(1000000 - 99900 - 25050 - 70000);
    expect(k.creditorsPaise).toBe(109000);
    expect(k.creditorsCount).toBe(1);
    expect(k.gstInputPaise).toBe(9000);
    expect(k.gstOutputPaise).toBe(0);
    expect(k.balanced).toBe(true);
    expect(k.assetsPaise).toBe(k.liabilitiesPaise! + k.equityPaise!);
    expect(k.lastEntryDate).toBe("2026-06-03");
  });
});

describe("financial year", () => {
  it("starts in April by default", () => {
    expect(fyStart("2026-10-28")).toBe("2026-04-01");
    expect(fyStart("2027-02-01")).toBe("2026-04-01");
    expect(fyStart("2026-10-28", 1)).toBe("2026-01-01");
  });
});

describe("day book rows", () => {
  it("names accounts and parties from the books and invents nothing", () => {
    const j = je("2026-10-01", [["ar", 118, 0, "c1"], ["sales", 0, 100], ["ogst", 0, 18]], "posted", {
      entry_number: "SLS-0001",
    });
    const v = journalToVoucher(j, new Map(ACCOUNTS.map((a) => [a.id, a])), new Map(PARTIES.map((p) => [p.id, p])), "sec22");
    expect(v.voucher_type).toBe("sales");
    expect(v.source_document).toBe("Bill of Supply");
    expect(v.party_name).toBe("C One");
    expect(v.amount).toBe(118);
    expect(v.ledger_folio).toBe("1030");
    expect(v.entry_time).toBe("");
    expect(v.lines.map((l) => [l.account_name, l.category])).toEqual([
      ["Accounts Receivable (Customer Trade Debtors)", "Asset"],
      ["Sales Revenue", "Revenue"],
      ["Output CGST Payable (9%)", "Liability"],
    ]);
    const none = journalToVoucher(je("2026-10-02", []), new Map(), new Map());
    expect([none.amount, none.party_name, none.ledger_folio]).toEqual([0, "–", "–"]);
  });
});
