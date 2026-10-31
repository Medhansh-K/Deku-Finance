import { describe, it, expect } from "vitest";
import {
  ColumnMap,
  parseSettlement,
  readHeader,
  saveBlockers,
  settlementPayload,
  SettlementMeta,
} from "@/lib/marketplace/parsers";

// Synthetic layout with made-up headers: the parser knows no channel's format, only the mapping.
const REPORT = `Seller payout report,,,,,,,,
Generated,31/10/2026,,,,,,,
Settlement,Posted,Order,Item,Kind,Sale value,Fee,Tax on fee,Withheld GST,Withheld IT,Paid out
S-77,02/10/2026,O-1,SKU-A,Order,"1,000.00",-120.00,-21.60,-10.00,-1.00,847.40
S-77,03/10/2026,O-2,SKU-B,Order,500.50,-60.00,-10.80,-5.00,-0.50,424.20
S-77,04/10/2026,O-1,SKU-A,Refund,-200.00,12.00,2.16,2.00,0.20,-183.64
S-77,05/10/2026,O-3,SKU-C,Order,abc,-1.00,,,,
S-77,31/09/2026,O-4,SKU-D,Order,10.00,,,,,10.00
,,,,,,,,,,
`;

const MAP: ColumnMap = {
  deductions_negative: true,
  mapping: {
    settlement_ref: "Settlement",
    txn_date: "Posted",
    order_id: "Order",
    sku: "Item",
    description: "Kind",
    gross_sales: "Sale value",
    commission: "Fee",
    gst_on_fees: "Tax on fee",
    tcs_amount: "Withheld GST",
    tds_amount: "Withheld IT",
    net_payout: "Paid out",
  },
};

const META: SettlementMeta = {
  channel: "amazon",
  settlement_ref: "S-77",
  period_from: "2026-10-02",
  period_to: "2026-10-04",
  fee_gst_split: "igst",
  source_filename: "payout.csv",
};

describe("readHeader", () => {
  it("skips the preamble and takes the widest row as the header when nothing is mapped yet", () => {
    const h = readHeader(REPORT);
    expect(h.rows[h.headerIndex].row).toBe(3);
    expect(h.headers).toContain("Sale value");
  });

  it("with a saved mapping, finds the row holding every mapped header", () => {
    const wideNote = `a,b,c,d,e,f,g,h,i,j,k,l,m\n${REPORT}`;
    const h = readHeader(wideNote, MAP.mapping);
    expect(h.rows[h.headerIndex].row).toBe(4);
  });
});

describe("parseSettlement", () => {
  const p = parseSettlement(REPORT, MAP);

  it("totals each canonical field with deductions positive; sales stay signed", () => {
    expect(p.fileError).toBeNull();
    expect(p.totals).toEqual({
      gross_sales: 130050, // 1000 + 500.50 - 200
      refunds: 0,
      commission: 16800, // 120 + 60 - 12 (commission refunded on the return)
      other_fees: 0,
      gst_on_fees: 3024,
      tcs_amount: 1300,
      tds_amount: 130,
    });
    expect(p.computedNetPaise).toBe(108796);
    expect(p.fileNetPaise).toBe(108796);
  });

  it("lists rows that do not parse, with reasons, and leaves them out of the totals", () => {
    expect(p.errors.map((e) => [e.row, e.reason])).toEqual([
      [7, 'Unreadable sales (principal) "abc"'],
      [8, 'Unreadable date "31/09/2026"'],
    ]);
  });

  it("keeps one line per non-zero amount with the row's order, SKU and date", () => {
    expect(p.lines).toHaveLength(15);
    expect(p.lines[0]).toEqual({
      row: 4,
      txn_date: "2026-10-02",
      order_id: "O-1",
      sku: "SKU-A",
      description: "Order",
      line_type: "gross_sales",
      amountPaise: 100000,
    });
    expect(p.refs).toEqual(["S-77"]);
    expect([p.periodFrom, p.periodTo]).toEqual(["2026-10-02", "2026-10-04"]);
  });

  it("reads deductions as printed when the report shows them positive", () => {
    const positive = parseSettlement(
      "Ref,Sales,Fees\nR1,100.00,15.00\n",
      { deductions_negative: false, mapping: { gross_sales: "Sales", other_fees: "Fees" } }
    );
    expect(positive.totals.other_fees).toBe(1500);
    expect(positive.computedNetPaise).toBe(8500);
  });

  it("asks for an amount column before parsing", () => {
    expect(parseSettlement(REPORT, { deductions_negative: true, mapping: { order_id: "Order" } }).fileError).toMatch(
      /at least one amount/
    );
  });

  it("reports a mapping that no longer matches the file", () => {
    const r = parseSettlement(REPORT, { ...MAP, mapping: { ...MAP.mapping, commission: "Commission" } });
    expect(r.fileError).toBe('The file has no column "Commission". Check the mapping for this file.');
  });
});

describe("saveBlockers and settlementPayload", () => {
  const p = parseSettlement(REPORT, MAP);

  it("allows saving when the file's net equals sales less deductions", () => {
    expect(saveBlockers(p, META)).toEqual([]);
  });

  it("blocks a net mismatch, several settlement IDs and a missing period", () => {
    const off = { ...p, fileNetPaise: p.computedNetPaise + 1, refs: ["A", "B"] };
    expect(saveBlockers(off, { ...META, period_from: "" })).toEqual([
      "The file holds 2 settlement IDs; upload one settlement at a time.",
      "Enter the settlement period.",
      "The file's net payout does not equal sales less deductions; check the mapping and the rows with errors.",
    ]);
  });

  it("sends rupees and the net the database CHECK expects", () => {
    const body = settlementPayload(p, META);
    expect(body.settlement).toMatchObject({
      gross_sales: 1300.5,
      commission: 168,
      gst_on_fees: 30.24,
      tcs_amount: 13,
      tds_amount: 1.3,
      net_payout: 1087.96,
      fee_gst_split: "igst",
    });
    expect(body.lines[0]).toMatchObject({ row_number: 4, line_type: "gross_sales", amount: 1000 });
    const byType = (t: string) => body.lines.filter((l) => l.line_type === t).reduce((s, l) => s + Math.round(l.amount * 100), 0);
    expect(byType("commission")).toBe(16800);
  });
});
