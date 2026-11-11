import { describe, it, expect } from "vitest";
import {
  parseMoneyPaise,
  parseStatement,
  parseStatementDate,
  splitCsv,
} from "@/lib/bank/statement-parser";

// HDFC NetBanking export: preamble rows, separate withdrawal/deposit columns, oldest first.
const HDFC = `HDFC BANK Ltd.,,,,,,
Account No :50100123456789,,,,,,
,,,,,,
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
********,********,********,********,********,********,********
01/10/26,OPENING CREDIT,0000000000000000,01/10/26,,"5,00,000.00","5,00,000.00"
03/10/26,"NEFT CR-HDFC0001234-ACME TRADERS, MUMBAI-UTR N276261234567",N276261234567,03/10/26,,"1,18,000.00","6,18,000.00"
05/10/26,CHQ PAID-000123456-CLOUDNINE HOSTING,000123456,05/10/26,"23,600.00",,"5,94,400.00"
31/09/26,BAD DATE ROW,,31/09/26,100.00,,"5,94,300.00"
07/10/26,UPI-SWIGGY-629812345678,629812345678,07/10/26,450.50,,"5,93,000.00"
`;

// Kotak export: single Amount column with a Dr/Cr flag, and a second Dr/Cr after Balance.
const KOTAK = `Sl. No.,Transaction Date,Value Date,Description,Chq / Ref No.,Amount,Dr / Cr,Balance,Dr / Cr
1,02-Oct-2026,02-Oct-2026,"IMPS/P2A/627512345/RENT, OCTOBER",627512345,"45,000.00",DR,"1,55,000.00",CR
2,04-Oct-2026,04-Oct-2026,NEFT GLOBEX INDIA PVT LTD,KKBKH26277000111,"2,500.00",CR,"1,57,500.00",CR
3,06-Oct-2026,06-Oct-2026,CASH WDL,,abc,DR,"1,57,500.00",CR
`;

describe("splitCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside quotes", () => {
    const rows = splitCsv('a,"b, c","say ""hi"""\r\n"multi\nline",x\n');
    expect(rows).toEqual([
      { row: 1, cells: ["a", "b, c", 'say "hi"'] },
      { row: 2, cells: ["multi\nline", "x"] },
    ]);
  });
});

describe("parseStatementDate", () => {
  it.each([
    ["03/10/2026", "2026-10-03"],
    ["03-10-26", "2026-10-03"],
    ["03-Oct-2026", "2026-10-03"],
    ["3 Oct 2026", "2026-10-03"],
    ["03/10/2026 14:22:01", "2026-10-03"],
  ])("%s -> %s", (raw, iso) => expect(parseStatementDate(raw)).toBe(iso));

  it("rejects impossible or unknown dates", () => {
    expect(parseStatementDate("31/09/2026")).toBeNull();
    expect(parseStatementDate("10/2026")).toBeNull();
    expect(parseStatementDate("03-Foo-2026")).toBeNull();
  });
});

describe("parseMoneyPaise", () => {
  it("reads Indian grouping without floating point", () => {
    expect(parseMoneyPaise("1,18,000.00")).toBe(11_800_000);
    expect(parseMoneyPaise("₹ 450.5")).toBe(45_050);
    expect(parseMoneyPaise("1,000.00 Dr")).toBe(-100_000);
    expect(parseMoneyPaise("0.29")).toBe(29);
    expect(parseMoneyPaise("")).toBeNull();
    expect(parseMoneyPaise("12abc")).toBeNaN();
  });
});

describe("parseStatement", () => {
  it("parses an HDFC export and reports the bad row instead of skipping it", () => {
    const { lines, errors, headerRow } = parseStatement(HDFC);
    expect(headerRow).toBe(4);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatchObject({
      row: 7,
      date: "2026-10-03",
      narration: "NEFT CR-HDFC0001234-ACME TRADERS, MUMBAI-UTR N276261234567",
      reference: "N276261234567",
      amountPaise: 11_800_000,
      direction: "in",
      balancePaise: 61_800_000,
      balanceMismatch: false,
    });
    expect(lines[2]).toMatchObject({ direction: "out", amountPaise: 2_360_000 });
    expect(errors).toEqual([
      expect.objectContaining({ row: 9, reason: 'Unreadable date "31/09/26"' }),
    ]);
  });

  it("flags a broken running balance", () => {
    const { lines } = parseStatement(HDFC);
    // 5,94,400.00 - 450.50 = 5,93,949.50, but the file says 5,93,000.00
    expect(lines[3].balanceMismatch).toBe(true);
    expect(lines.slice(0, 3).every((l) => !l.balanceMismatch)).toBe(true);
  });

  it("parses a Kotak export with an amount + Dr/Cr column", () => {
    const { lines, errors } = parseStatement(KOTAK);
    expect(lines.map((l) => [l.date, l.direction, l.amountPaise, l.reference])).toEqual([
      ["2026-10-02", "out", 4_500_000, "627512345"],
      ["2026-10-04", "in", 250_000, "KKBKH26277000111"],
    ]);
    expect(lines[0].narration).toBe("IMPS/P2A/627512345/RENT, OCTOBER");
    expect(lines[1].balanceMismatch).toBe(false);
    expect(errors).toEqual([expect.objectContaining({ row: 4, reason: 'Unreadable amount "abc"' })]);
  });

  it("refuses to guess direction from an unsigned amount", () => {
    const { lines, errors } = parseStatement("Date,Description,Amount\n01/10/2026,Something,500.00\n02/10/2026,Refund,-20\n");
    expect(lines).toEqual([expect.objectContaining({ direction: "out", amountPaise: 2000 })]);
    expect(errors[0].reason).toMatch(/debit or credit/);
  });

  it("reports when no header can be found", () => {
    const { lines, errors } = parseStatement("foo,bar\n1,2\n");
    expect(lines).toEqual([]);
    expect(errors[0].reason).toMatch(/No header row/);
  });
});
