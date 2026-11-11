import { describe, it, expect } from "vitest";
import type { Account, JournalEntry, JournalStatus, Party } from "@/types/accounting";
import { ageBuckets, bucketOf, EMPTY_KPI_SNAPSHOT, fyStart, toLedgerKpis, toPartyBalances } from "@/lib/reports/ledger";
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


// Ledger aggregation (ageing, DSO/DPO, expenses, KPIs) runs in Postgres; its cases live in
// supabase/tests/ledger_functions_test.sql. Here only the conversion of its rupee output is checked.
describe("server report mapping", () => {
  it("converts rupees to paise and keeps unknown figures null", () => {
    expect(toLedgerKpis({ ...EMPTY_KPI_SNAPSHOT, has_entries: true, turnover: "10000.00", liquid: 8050.5 })).toMatchObject({
      hasEntries: true,
      turnoverPaise: 1000000,
      liquidPaise: 805050,
      profitPaise: null,
      balanced: null,
    });
    const [p] = toPartyBalances([
      {
        party_id: "v1", party_name: "Vendor One", gstin: null, billing_address: null,
        balance: "150.15", advance: "0.00", oldest_age_days: 43,
        d0_30: "0.00", d31_60: "150.15", d61_90: "0.00", d90_plus: "0.00",
        open_items: [{ entry_id: "je2", entry_number: "JRN-0002", reference: null, date: "2026-09-15", amount: "200.20",
          open: "150.15", age_days: 43, invoice_id: null, invoice_number: null, due_date: null }],
      },
    ]);
    expect(p.balancePaise).toBe(15015);
    expect(p.openItems.map((i) => [i.amountPaise, i.openPaise])).toEqual([[20020, 15015]]);
    expect(ageBuckets([p, p])).toEqual({ d0_30: 0, d31_60: 30030, d61_90: 0, d90_plus: 0 });
    expect(bucketOf(p.oldestAgeDays)).toBe("d31_60");
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
