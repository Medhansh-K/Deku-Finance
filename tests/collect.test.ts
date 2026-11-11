import { describe, it, expect } from "vitest";
import type { Party } from "@/types/accounting";
import { collectRows, collectStats, inTab, msmeFlag, CollectInvoice } from "@/lib/collect/receivables";
import { checkIndianMobile, reminderMessage, whatsappUrl } from "@/lib/collect/whatsapp";
import { defaultReturnMonth, fyOf, monthEnd, readStoredMonth, retPeriodOf } from "@/lib/gst/period";
import { toPartyBalances, PartyAgeingRow } from "@/lib/reports/ledger";

// Receivable ageing as get_party_ledger_ageing returns it (rupees, numeric as strings): [entry, amount, open].
const ageing = (items: [string, number, number][]) =>
  toPartyBalances([
    {
      party_id: "p1",
      party_name: "Acme",
      gstin: null,
      billing_address: null,
      balance: String(items.reduce((s, [, , o]) => s + o, 0)),
      advance: "0.00",
      oldest_age_days: 88,
      d0_30: "0", d31_60: "0", d61_90: "0", d90_plus: "0",
      open_items: items.map(([entry_id, amount, open]) => ({
        entry_id, entry_number: entry_id, reference: null, date: "2026-08-01",
        amount: amount.toFixed(2), open: open.toFixed(2), age_days: 0,
        invoice_id: null, invoice_number: null, due_date: null,
      })),
    } satisfies PartyAgeingRow,
  ]);

const inv = (id: string, date: string, due: string | null, total: number, extra: Partial<CollectInvoice> = {}) =>
  ({
    id,
    organisation_id: "o",
    customer_id: "p1",
    invoice_number: `INV-${id}`,
    invoice_date: date,
    due_date: due,
    status: "issued",
    supply_type: "intra_state",
    place_of_supply: "27",
    taxable_amount: total / 1.18,
    total_amount: total,
    journal_entry_id: `j${id}`,
    cgst_amount: 9,
    sgst_amount: 9,
    igst_amount: 0,
    cess_amount: 0,
    parties: { legal_name: "Acme" },
    ...extra,
  }) as CollectInvoice;

const party = { id: "p1", legal_name: "Acme", phone: "98765 43210" } as Party;
const ASOF = "2026-10-28";

describe("collect: settlement and buckets", () => {
  // INV-1 1000 (due 01-Sep) partly paid 400; INV-2 500 due 02-Nov; INV-3 200 paid; INV-4 not posted.
  const invoices = [
    inv("1", "2026-08-01", "2026-09-01", 1000),
    inv("2", "2026-10-20", "2026-11-02", 500),
    inv("3", "2026-10-01", "2026-10-10", 200),
    inv("4", "2026-10-05", "2026-10-25", 300, { journal_entry_id: null }),
    inv("5", "2026-10-05", null, 100, { status: "draft" }),
  ];
  // The server settled a 600 receipt against INV-1 first (oldest); INV-3 and INV-2 stay open.
  const debtors = ageing([["j1", 1000, 400], ["j3", 200, 200], ["j2", 500, 500]]);
  const { rows, hasControlAccount } = collectRows(invoices, debtors, [party], ASOF);
  const by = (n: string) => rows.find((r) => r.invoice.id === n)!;

  it("reads open amounts from the ledger ageing and skips drafts", () => {
    expect(hasControlAccount).toBe(true);
    expect(rows).toHaveLength(4);
    expect(by("1").openPaise).toBe(40000);
    expect(by("3").openPaise).toBe(20000);
    expect(by("2").openPaise).toBe(50000);
    expect(by("4").openPaise).toBeNull();
  });

  it("assigns tabs by due date and settlement", () => {
    expect(inTab(by("1"), "overdue")).toBe(true);
    expect(inTab(by("1"), "partial")).toBe(true);
    expect(inTab(by("2"), "due7")).toBe(true);
    expect(inTab(by("2"), "overdue")).toBe(false);
    expect(inTab(by("4"), "uncollected")).toBe(true);
    expect(inTab(by("4"), "overdue")).toBe(false);
  });

  it("marks a fully settled invoice paid", () => {
    // A later 600 receipt cleared INV-1 and INV-3; only INV-2 is still an open item.
    const paid = collectRows(invoices, ageing([["j2", 500, 500]]), [party], ASOF).rows;
    expect(paid.find((r) => r.invoice.id === "1")!.openPaise).toBe(0);
    expect(paid.find((r) => r.invoice.id === "2")!.openPaise).toBe(50000);
    const r3 = paid.find((r) => r.invoice.id === "3")!;
    expect(r3.openPaise).toBe(0);
    expect(inTab(r3, "paid")).toBe(true);
    expect(inTab(r3, "uncollected")).toBe(false);
  });

  it("flags MSMED 45 days from the invoice date", () => {
    expect(msmeFlag(by("1"))).toBe(true);
    expect(msmeFlag(by("2"))).toBe(false);
  });

  it("sums stats in paise and hides GST at risk when tax is unknown", () => {
    const s = collectStats(rows, "2026-09-30");
    expect(s.uncollectedPaise).toBe(40000 + 50000 + 20000);
    expect(s.overdue15Paise).toBe(40000 + 20000); // INV-3 is 18 days past due
    expect(s.due7Paise).toBe(50000);
    expect(s.gstAtRiskPaise).toBe(1800); // only INV-1 is dated up to Sep
    expect(s.unposted).toBe(1);
    const noTax = collectRows([inv("1", "2026-08-01", "2026-09-01", 1000, { cgst_amount: undefined })], debtors, [party], ASOF);
    expect(collectStats(noTax.rows, "2026-09-30").gstAtRiskPaise).toBeNull();
  });

  it("reports no settlement without a debtors control account", () => {
    const r = collectRows(invoices, null, [party], ASOF);
    expect(r.hasControlAccount).toBe(false);
    expect(r.rows.every((x) => x.openPaise === null)).toBe(true);
  });
});

describe("collect: WhatsApp", () => {
  it("validates Indian mobile numbers", () => {
    expect(checkIndianMobile("98765 43210")).toEqual({ ok: true, waNumber: "919876543210" });
    expect(checkIndianMobile("+91-98765-43210")).toEqual({ ok: true, waNumber: "919876543210" });
    expect(checkIndianMobile("09876543210")).toEqual({ ok: true, waNumber: "919876543210" });
    expect(checkIndianMobile("0091 9876543210")).toEqual({ ok: true, waNumber: "919876543210" });
    expect(checkIndianMobile(null).ok).toBe(false);
    expect(checkIndianMobile("  ").ok).toBe(false);
    expect(checkIndianMobile("022 2345 6789").ok).toBe(false); // landline
    expect(checkIndianMobile("5876543210").ok).toBe(false);
    expect(checkIndianMobile("98765abc10").ok).toBe(false);
    expect(checkIndianMobile("+1 415 555 0100").ok).toBe(false);
  });

  it("builds the message with invoice, amount, due date and UPI only when stored", () => {
    const base = { customerName: "Acme", invoiceNumber: "INV-1", amountDuePaise: 4000050, dueDate: "2026-09-01", msme45: false };
    const m = reminderMessage({ ...base, companyName: "Deku Traders", upiId: "deku@okhdfc" });
    expect(m).toContain("INV-1");
    expect(m).toContain("₹ 40,000.50");
    expect(m).toContain("01-Sep-2026");
    expect(m).toContain("deku@okhdfc");
    expect(m).not.toContain("43B");
    const bare = reminderMessage({ ...base, dueDate: null, upiId: null });
    expect(bare).not.toContain("UPI");
    expect(bare).not.toContain("due date");
    expect(reminderMessage({ ...base, upiId: "not a vpa", msme45: true })).not.toContain("UPI");
    expect(reminderMessage({ ...base, msme45: true })).toContain("43B(h)");
  });

  it("encodes the wa.me URL", () => {
    expect(whatsappUrl("919876543210", "Hi & bye\nok")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye%0Aok");
  });
});

describe("gst return period", () => {
  it("defaults to the previous month, across a year boundary", () => {
    expect(defaultReturnMonth(new Date(2026, 9, 28))).toBe("2026-09");
    expect(defaultReturnMonth(new Date(2027, 0, 5))).toBe("2026-12");
  });
  it("derives FY, MMYYYY and month end", () => {
    expect(fyOf("2026-04")).toBe("2026-27");
    expect(fyOf("2027-03")).toBe("2026-27");
    expect(fyOf("2099-12")).toBe("2099-00");
    expect(retPeriodOf("2026-09")).toBe("092026");
    expect(monthEnd("2028-02")).toBe("2028-02-29");
  });
  it("reads only a valid stored month", () => {
    expect(readStoredMonth(JSON.stringify({ fy: "2026-27", month: "2026-07" }))).toBe("2026-07");
    expect(readStoredMonth("garbage")).toBeNull();
    expect(readStoredMonth(JSON.stringify({ month: "2026-13" }))).toBeNull();
    expect(readStoredMonth(null)).toBeNull();
  });
});
