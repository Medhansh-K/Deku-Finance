import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { decodeTallyBytes, parseTallyXml, resolveGroup, tallyAmountPaise, tallyDate, tallyToBatch, unmappedGroups } from "@/lib/import/tally";
import { csvLineAmount, parseCsv, suggestMapping, csvHeaders, csvUnmappedGroups } from "@/lib/import/csv";
import { emptyBatch, ImportKind, Masters, validateBatch } from "@/lib/import/validate";
import { dayBookCsv } from "@/lib/import/export";

// Synthetic, hand-written fixtures (see the header comment in each file).
const fixture = (f: string) => readFileSync(path.join(__dirname, "fixtures", f), "utf8");
const MASTERS_XML = fixture("tally-masters.synthetic.xml");
const VOUCHERS_XML = fixture("tally-vouchers.synthetic.xml");

const MASTERS: Masters = {
  accounts: [
    { code: "1010", name: "Cash on Hand (Petty Cash Reserve)", is_postable: true },
    { code: "1030", name: "Accounts Receivable (Customer Trade Debtors)", is_postable: true },
    { code: "2010", name: "Accounts Payable (Trade Creditors)", is_postable: true },
    { code: "1000", name: "Assets", is_postable: false },
    { code: "5040", name: "Office & Operational Rent", is_postable: true },
  ],
  parties: [{ legal_name: "Existing Customer", type: "customer", gstin: "29AABCU9603R1ZJ" }],
  items: [{ name: "Existing Item", sku: "EX-1" }],
};
const all = (...k: ImportKind[]) => new Set<ImportKind>(k);

describe("Tally XML reader", () => {
  const file = parseTallyXml(MASTERS_XML);

  it("reads groups, ledgers and stock items, and strips Tally's control-character references", () => {
    expect(file.errors).toEqual([]);
    expect(file.groups).toEqual([
      { name: "Office Overheads", parent: "Indirect Expenses" },
      { name: "Partners Drawings", parent: "Primary" },
    ]);
    expect(file.ledgers.map((l) => l.name)).toContain("Alpha Retail");
    expect(file.stockItems).toEqual([
      { row: 1, name: "Synthetic Widget", baseUnits: "Nos", hsn: "84713010" },
      { row: 2, name: "Synthetic Cable", baseUnits: "Mtr", hsn: undefined },
    ]);
  });

  it("flips Tally's sign: a negative opening balance is a debit", () => {
    const by = Object.fromEntries(file.ledgers.map((l) => [l.name, l]));
    expect(by["Cash"].openingPaise).toBe(2500000);
    expect(by["Synthetic Bank A/c"].openingPaise).toBe(11000050);
    expect(by["Owner Capital"].openingPaise).toBe(-15000000);
    expect(by["Alpha Retail"]).toMatchObject({ gstin: "27AAPFU0939F1ZV", gstRegistrationType: "Regular", state: "Maharashtra", pan: "AAPFU0939F" });
  });

  it("maps primary groups, follows custom groups to their primary, and leaves unknown roots to the user", () => {
    const parents = new Map(file.groups.map((g) => [g.name.toLowerCase(), g.parent]));
    expect(resolveGroup("Sundry Debtors", parents)).toEqual({ kind: "party", party_type: "customer" });
    expect(resolveGroup("Office Overheads", parents)).toMatchObject({ kind: "account", account_group: "expense" });
    expect(resolveGroup("Duties & Taxes", parents)).toMatchObject({ account_group: "liability", ledger: "Statutory & Tax Liabilities" });
    expect(resolveGroup("Partners Drawings", parents)).toBeNull();
    expect(resolveGroup("Suspense A/c", parents)).toBeNull();
    expect(unmappedGroups(file, {})).toEqual(["Partners Drawings"]);
    expect(unmappedGroups(file, { "Partners Drawings": { kind: "account", account_group: "equity", ledger: "x", sub_ledger: "y" } })).toEqual([]);
  });

  it("turns ledgers into accounts, parties and opening balances", () => {
    const batch = tallyToBatch(file, "m.xml", {});
    expect(batch.parties.map((p) => [p.name, p.type])).toEqual([
      ["Alpha Retail", "customer"],
      ["Beta Supplies", "vendor"],
    ]);
    expect(batch.accounts.map((a) => a.name)).toEqual(["Cash", "Synthetic Bank A/c", "Owner Capital", "Sales @ 18%", "Output IGST", "Stationery"]);
    // The unmapped group's ledger is left out until the user maps it.
    expect(batch.openings.find((o) => o.ledger === "Drawings - Partner A")).toBeUndefined();
    expect(batch.items.map((i) => i.unit_code)).toEqual(["NOS", "MTR"]);
  });

  it("reads vouchers: dates, debit/credit sign and invoice-mode allocations", () => {
    const v = parseTallyXml(VOUCHERS_XML);
    expect(v.vouchers).toHaveLength(4);
    expect(v.vouchers[0]).toMatchObject({ date: "2026-10-05", voucherType: "Sales", number: "S-1", narration: "Synthetic sale" });
    expect(v.vouchers[0].lines).toEqual([
      { ledger: "Alpha Retail", debit_paise: 1180000, credit_paise: 0 },
      { ledger: "Sales @ 18%", debit_paise: 0, credit_paise: 1000000 },
      { ledger: "Output IGST", debit_paise: 0, credit_paise: 180000 },
    ]);
    expect(v.vouchers[3].lines.map((l) => l.ledger)).toEqual(["Alpha Retail", "Output IGST", "Sales @ 18%"]);
  });

  it("parses dates, amounts and UTF-16 files", () => {
    expect(tallyDate("20240229")).toBe("2024-02-29");
    expect(tallyDate("20230229")).toBeNull();
    expect(tallyAmountPaise("-1,180.50")).toBe(118050);
    expect(tallyAmountPaise("250.00")).toBe(-25000);
    expect(tallyAmountPaise("")).toBe(0);
    expect(tallyAmountPaise("abc")).toBeNaN();
    const utf16 = new Uint8Array([0xff, 0xfe, ...Array.from("<A/>").flatMap((c) => [c.charCodeAt(0), 0])]);
    expect(decodeTallyBytes(utf16.buffer)).toBe("<A/>");
    expect(parseTallyXml("<NOT>").errors[0].message).toMatch(/not well-formed/);
  });
});

describe("validation", () => {
  const masters = tallyToBatch(parseTallyXml(MASTERS_XML), "m.xml", {});

  it("flags a bad GSTIN check digit and an unbalanced opening, and resolves party ledgers to control accounts", () => {
    const r = validateBatch(masters, MASTERS, all("chart_of_accounts", "parties", "opening_balances"));
    expect(r.errors).toContainEqual({ kind: "parties", row: 5, message: "GSTIN 29AABCU9603R1ZM is not valid (format or check digit)" });
    expect(r.openingDiffPaise).toBe(-999900);
    expect(r.errors.some((e) => e.kind === "opening_balances" && e.row === 0 && /differ by 9999\.00/.test(e.message))).toBe(true);
    expect(r.payload.opening_balances).toContainEqual({ row: 4, account_code: "1030", party_name: "Alpha Retail", debit_paise: 1500000, credit_paise: 0 });
    expect(r.payload.opening_balances).toContainEqual({ row: 1, account_name: "Cash", party_name: undefined, debit_paise: 2500000, credit_paise: 0 });
    const confirmed = validateBatch(masters, MASTERS, all("chart_of_accounts", "parties", "opening_balances"), true);
    expect(confirmed.errors.some((e) => e.kind === "opening_balances")).toBe(false);
  });

  it("refuses references to accounts that are neither in Deku nor in the same import", () => {
    const r = validateBatch(masters, MASTERS, all("opening_balances"));
    expect(r.errors).toContainEqual({ kind: "opening_balances", row: 1, message: 'Ledger "Cash" is not in the chart of accounts or this import' });
  });

  it("checks voucher balance and duplicate names against existing masters", () => {
    const batch = { ...masters, ...tallyToBatch(parseTallyXml(VOUCHERS_XML), "v.xml", {}), accounts: masters.accounts, parties: masters.parties };
    const r = validateBatch(batch, MASTERS, all("chart_of_accounts", "parties", "vouchers"));
    expect(r.errors).toContainEqual({ kind: "vouchers", row: 3, message: "Voucher J-1 does not balance: debits 100.00 vs credits 99.00" });
    expect(r.errors.filter((e) => e.kind === "vouchers")).toHaveLength(1);

    const dup = emptyBatch("csv", "x.csv");
    dup.accounts = [{ row: 2, name: "office & operational rent", account_group: "expense", code: "5040" }];
    dup.parties = [{ row: 3, name: "New Co", type: "customer", gstin: "29AABCU9603R1ZJ" }];
    dup.items = [{ row: 4, name: "Existing item", type: "goods", sku: "EX-1" }];
    const d = validateBatch(dup, MASTERS, all("chart_of_accounts", "parties", "items"));
    expect(d.errors.map((e) => e.message)).toEqual([
      'An account named "office & operational rent" already exists in Deku',
      "Account code 5040 already exists in Deku",
      "A party with GSTIN 29AABCU9603R1ZJ already exists in Deku",
      'An item named "Existing item" already exists in Deku',
      "SKU EX-1 already exists in Deku",
    ]);
  });

  it("refuses posting to a group account", () => {
    const b = emptyBatch("csv", "o.csv");
    b.openings = [{ row: 2, ledger: "1000", debit_paise: 100, credit_paise: 0 }];
    expect(validateBatch(b, MASTERS, all("opening_balances"), true).errors[0].message).toBe("Account 1000 is a group, not a postable ledger");
  });
});

describe("CSV import", () => {
  it("maps columns, reads Dr/Cr amounts and groups multi-line vouchers", () => {
    const csv = [
      "Day book export (synthetic)",
      "Date,Vch No,Vch Type,Particulars,Debit,Credit,Narration",
      "05/10/2026,7,Payment,Office & Operational Rent,\"1,000.00\",,Rent",
      ",,,Cash on Hand (Petty Cash Reserve),,1000",
      "06/10/2026,8,Receipt,Cash on Hand (Petty Cash Reserve),500,,",
      ",,,Existing Customer,,500,",
    ].join("\n");
    const headers = csvHeaders(csv);
    const mapping = suggestMapping("vouchers", headers);
    expect(mapping).toMatchObject({ date: "Date", number: "Vch No", voucher_type: "Vch Type", ledger: "Particulars", debit: "Debit", credit: "Credit" });
    const batch = parseCsv(csv, "d.csv", "vouchers", mapping);
    expect(batch.errors).toEqual([]);
    expect(batch.vouchers).toHaveLength(2);
    expect(batch.vouchers[0]).toMatchObject({ row: 3, date: "2026-10-05", number: "7", voucher_type: "Payment", narration: "Rent" });
    expect(batch.vouchers[0].lines).toEqual([
      { ledger: "Office & Operational Rent", party: undefined, debit_paise: 100000, credit_paise: 0 },
      { ledger: "Cash on Hand (Petty Cash Reserve)", party: undefined, debit_paise: 0, credit_paise: 100000 },
    ]);
    const r = validateBatch(batch, MASTERS, all("vouchers"));
    expect(r.errors).toEqual([]);
    expect((r.payload.vouchers as { lines: unknown[] }[])[1].lines[1]).toEqual({ account_code: "1030", party_name: "Existing Customer", debit_paise: 0, credit_paise: 50000 });
  });

  it("reads a single amount column with Dr/Cr suffixes", () => {
    expect(csvLineAmount("", "", "500 Dr")).toEqual({ debit_paise: 50000, credit_paise: 0 });
    expect(csvLineAmount("", "", "500 Cr")).toEqual({ debit_paise: 0, credit_paise: 50000 });
    expect(csvLineAmount("", "", "-12.5")).toEqual({ debit_paise: 0, credit_paise: 1250 });
    expect(csvLineAmount("x", "", "")).toBe("Debit or credit is not a number");
  });

  it("asks for unknown group values and refuses party groups in a chart of accounts", () => {
    const csv = "Name,Group\nRent,Expenses\nFreight,Indirect Expenses\nMystery,Odd Group\nAcme,Sundry Debtors\n";
    const mapping = suggestMapping("chart_of_accounts", csvHeaders(csv));
    expect(csvUnmappedGroups(csv, mapping, {})).toEqual(["Odd Group"]);
    const batch = parseCsv(csv, "c.csv", "chart_of_accounts", mapping, { "Odd Group": { kind: "account", account_group: "asset", ledger: "", sub_ledger: "" } });
    expect(batch.accounts.map((a) => [a.name, a.account_group])).toEqual([
      ["Rent", "expense"],
      ["Freight", "expense"],
      ["Mystery", "asset"],
    ]);
    expect(batch.errors).toEqual([{ kind: "chart_of_accounts", row: 5, message: '"Sundry Debtors" is a party group; import these rows as parties' }]);
  });

  it("requires the mandatory columns to be mapped", () => {
    const batch = parseCsv("A,B\n1,2\n", "p.csv", "parties", {});
    expect(batch.errors[0].message).toBe("Map the column for: Name");
  });
});

describe("export", () => {
  it("filters the day book by date and neutralises formulas", () => {
    const row = (d: string, desc: string) => ({
      line_id: d, organisation_id: "o", journal_entry_id: "j", entry_number: "JV-1", entry_date: d, status: "posted" as const,
      line_number: 1, account_id: "a", account_code: "1010", account_name: "Cash", account_type: "asset" as const,
      description: desc, debit: 10, credit: 0, fiscal_period_id: "f", fiscal_period_name: "FY",
    });
    const csv = dayBookCsv([row("2026-10-02", "=HYPERLINK()"), row("2026-09-30", "old")], "2026-10-01", "2026-10-31");
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain("'=HYPERLINK()");
  });
});
