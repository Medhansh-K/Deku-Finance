/**
 * Purchase bill register: validation, CSV import mapping, ITC totals and the purchase voucher.
 * Pure functions, no I/O. Amounts are paise (integers) everywhere except the API payload.
 * Rule: never invent a value. A missing cell stays blank and becomes a validation error.
 */
import { isValidGstin } from "@/lib/vouchers/invoice-text-parser";
import { parseMoneyPaise, parseStatementDate, splitCsv } from "@/lib/bank/statement-parser";
import type { CreateJournalLineRequest } from "@/types/accounting";

export type ItcEligibility = "eligible" | "blocked_17_5" | "ineligible_other";

export const ITC_ELIGIBILITY_LABEL: Record<ItcEligibility, string> = {
  eligible: "Eligible",
  blocked_17_5: "Blocked u/s 17(5)",
  ineligible_other: "Ineligible (other)",
};

/** A row of public.purchase_bills (migration 24); numeric columns arrive as numbers or strings. */
export interface PurchaseBill {
  id: string;
  organisation_id: string;
  party_id: string | null;
  supplier_name: string;
  supplier_gstin: string;
  bill_number: string;
  bill_date: string;
  place_of_supply: string;
  taxable_amount: number | string;
  cgst: number | string;
  sgst: number | string;
  igst: number | string;
  cess: number | string;
  total_amount: number | string;
  itc_eligibility: ItcEligibility;
  blocked_reason: string | null;
  journal_entry_id: string | null;
  created_at?: string;
}

/** A bill being entered or imported. Amounts in paise; null = not provided. */
export interface BillDraft {
  party_id: string | null;
  supplier_name: string;
  supplier_gstin: string;
  bill_number: string;
  bill_date: string; // ISO yyyy-mm-dd, "" if missing
  place_of_supply: string; // two-digit state code
  taxable: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  cess: number | null;
  itc_eligibility: ItcEligibility;
  blocked_reason: string;
}

export const paise = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);
export const billKey = (gstin: string, billNumber: string) =>
  `${gstin.trim().toUpperCase()}|${billNumber.trim()}`;

// 01-38 are states/UTs, 97 is "Other Territory" (same rule as the GST returns and migration 24).
export const isStateCode = (c: string) => /^(0[1-9]|[12][0-9]|3[0-8]|97)$/.test(c);

/** Intra-state when the supplier's state is the place of supply (CGST + SGST), else IGST. */
export function isIntraState(gstin: string, pos: string): boolean {
  return gstin.trim().slice(0, 2) === pos;
}

/** Tax at `ratePercent` on a taxable value, split the way the supply requires. */
export function computeTax(taxable: number, ratePercent: number, intra: boolean) {
  if (intra) {
    const half = Math.round((taxable * ratePercent) / 200);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: Math.round((taxable * ratePercent) / 100) };
}

export function billTotal(d: Pick<BillDraft, "taxable" | "cgst" | "sgst" | "igst" | "cess">): number {
  return (d.taxable ?? 0) + (d.cgst ?? 0) + (d.sgst ?? 0) + (d.igst ?? 0) + (d.cess ?? 0);
}

/** Every reason the bill can't be saved; empty means valid. `existing` holds billKey()s already registered. */
export function validateBill(d: BillDraft, existing: Set<string> = new Set()): string[] {
  const errs: string[] = [];
  const gstin = d.supplier_gstin.trim().toUpperCase();
  if (!d.supplier_name.trim()) errs.push("Supplier name is missing");
  if (!gstin) errs.push("Supplier GSTIN is missing");
  else if (!isValidGstin(gstin)) errs.push(`Supplier GSTIN ${gstin} is not valid (check digit or format)`);
  if (!d.bill_number.trim()) errs.push("Bill number is missing");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.bill_date)) errs.push("Bill date is missing or unreadable");
  if (!isStateCode(d.place_of_supply)) errs.push("Place of supply needs a two-digit state code");

  const amounts: [keyof BillDraft, string][] = [
    ["taxable", "Taxable value"],
    ["cgst", "CGST"],
    ["sgst", "SGST"],
    ["igst", "IGST"],
    ["cess", "Cess"],
  ];
  for (const [k, label] of amounts) {
    const v = d[k] as number | null;
    if (v === null) {
      if (k === "taxable") errs.push("Taxable value is missing");
    } else if (!Number.isInteger(v)) errs.push(`${label} is not a valid amount`);
    else if (v < 0) errs.push(`${label} cannot be negative`);
  }
  if (d.taxable !== null && d.taxable === 0 && billTotal(d) === 0) errs.push("Bill has no value");

  if (gstin && isStateCode(d.place_of_supply)) {
    if (isIntraState(gstin, d.place_of_supply)) {
      if (d.igst) errs.push("Supplier is in the place-of-supply state, so the bill cannot carry IGST");
      // Same 2 paise tolerance as issue_sales_invoice (migration 10).
      if (Math.abs((d.cgst ?? 0) - (d.sgst ?? 0)) > 2) errs.push("CGST and SGST must be equal");
    } else if (d.cgst || d.sgst) {
      errs.push("Supplier is in another state, so the bill carries IGST, not CGST/SGST");
    }
  }

  if (d.itc_eligibility !== "eligible" && !d.blocked_reason.trim())
    errs.push("Give the reason ITC is blocked or ineligible");
  if (gstin && d.bill_number.trim() && existing.has(billKey(gstin, d.bill_number)))
    errs.push(`Bill ${d.bill_number.trim()} from ${gstin} is already in the register`);
  return errs;
}

/** Body for POST /purchases (rupees, as the numeric columns expect). */
export function billPayload(d: BillDraft, journalEntryId: string | null = null) {
  return {
    party_id: d.party_id,
    supplier_name: d.supplier_name.trim(),
    supplier_gstin: d.supplier_gstin.trim().toUpperCase(),
    bill_number: d.bill_number.trim(),
    bill_date: d.bill_date,
    place_of_supply: d.place_of_supply,
    taxable_amount: (d.taxable ?? 0) / 100,
    cgst: (d.cgst ?? 0) / 100,
    sgst: (d.sgst ?? 0) / 100,
    igst: (d.igst ?? 0) / 100,
    cess: (d.cess ?? 0) / 100,
    total_amount: billTotal(d) / 100,
    itc_eligibility: d.itc_eligibility,
    blocked_reason: d.itc_eligibility === "eligible" ? null : d.blocked_reason.trim(),
    journal_entry_id: journalEntryId,
  };
}

export function billToDraft(b: PurchaseBill): BillDraft {
  return {
    party_id: b.party_id,
    supplier_name: b.supplier_name,
    supplier_gstin: b.supplier_gstin,
    bill_number: b.bill_number,
    bill_date: b.bill_date,
    place_of_supply: b.place_of_supply,
    taxable: paise(b.taxable_amount),
    cgst: paise(b.cgst),
    sgst: paise(b.sgst),
    igst: paise(b.igst),
    cess: paise(b.cess),
    itc_eligibility: b.itc_eligibility,
    blocked_reason: b.blocked_reason ?? "",
  };
}

// ---------- CSV import ----------

export interface CsvBillRow {
  row: number;
  draft: BillDraft;
  errors: string[];
}

const COLUMNS = {
  gstin: /^(supplier )?gstin( of supplier)?$/,
  name: /^(supplier|trade|legal)( legal| trade)? name$|^supplier$/,
  number: /^(invoice|bill) (no|number)$/,
  date: /^(invoice|bill) date$/,
  taxable: /^taxable (value|amount)$/,
  cgst: /^cgst( amount)?$/,
  sgst: /^(sgst|utgst|sgst utgst)( amount)?$/,
  igst: /^igst( amount)?$/,
  // Optional columns:
  cess: /^cess( amount)?$/,
  pos: /^place of supply$|^pos$/,
  eligibility: /^itc eligibility$|^eligibility$/,
  reason: /^(blocked )?reason$/,
};
const REQUIRED = ["gstin", "name", "number", "date", "taxable", "cgst", "sgst", "igst"] as const;
const HEADER_LABEL: Record<(typeof REQUIRED)[number], string> = {
  gstin: "Supplier GSTIN",
  name: "Supplier Name",
  number: "Invoice No",
  date: "Invoice Date",
  taxable: "Taxable Value",
  cgst: "CGST",
  sgst: "SGST",
  igst: "IGST",
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function parseEligibility(raw: string): ItcEligibility | null {
  const s = norm(raw);
  if (s === "" || s === "eligible" || s === "yes") return "eligible";
  if (/^(blocked|blocked 17 5|17 5)$/.test(s)) return "blocked_17_5";
  if (/^(ineligible|ineligible other|no)$/.test(s)) return "ineligible_other";
  return null;
}

/**
 * Maps a purchase-register CSV (Supplier GSTIN, Supplier Name, Invoice No, Invoice Date,
 * Taxable Value, CGST, SGST, IGST; optional Cess, Place of Supply, ITC Eligibility, Reason)
 * to drafts with their validation errors.
 */
export function parseBillsCsv(
  text: string,
  opts: { companyGstin?: string | null; existing?: Set<string> } = {}
): { rows: CsvBillRow[]; fileError: string | null } {
  const all = splitCsv(text).filter((r) => r.cells.some((c) => c.trim() !== ""));
  if (all.length === 0) return { rows: [], fileError: "The file is empty" };
  const headers = all[0].cells.map(norm);
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([k, re]) => [k, headers.findIndex((h) => re.test(h))])
  ) as Record<keyof typeof COLUMNS, number>;
  const missing = REQUIRED.filter((k) => col[k] === -1).map((k) => HEADER_LABEL[k]);
  if (missing.length) return { rows: [], fileError: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` };

  const ownState = (opts.companyGstin ?? "").trim().slice(0, 2);
  const seen = new Set(opts.existing ?? []);
  const rows: CsvBillRow[] = [];
  for (const { row, cells } of all.slice(1)) {
    const cell = (k: keyof typeof COLUMNS) => (col[k] === -1 ? "" : (cells[col[k]] ?? "").trim());
    const errors: string[] = [];
    const money = (k: keyof typeof COLUMNS, label: string, blankIsZero: boolean): number | null => {
      const v = parseMoneyPaise(cell(k));
      if (v === null) return blankIsZero ? 0 : null;
      if (Number.isNaN(v)) {
        errors.push(`${label} "${cell(k)}" is not a number`);
        return null;
      }
      return v;
    };
    const dateRaw = cell("date");
    const date = dateRaw ? parseStatementDate(dateRaw) : null;
    if (dateRaw && !date) errors.push(`Invoice date "${dateRaw}" is unreadable`);

    // A blank tax cell means no tax of that kind; a blank taxable value is missing data.
    const taxable = money("taxable", "Taxable value", false);
    const cgst = money("cgst", "CGST", true);
    const sgst = money("sgst", "SGST", true);
    const igst = money("igst", "IGST", true);
    const cess = money("cess", "Cess", true);

    const gstin = cell("gstin").toUpperCase();
    let pos = cell("pos").match(/^(\d{1,2})(?!\d)/)?.[1]?.padStart(2, "0") ?? "";
    if (!pos) {
      // GST law fixes the split: CGST/SGST means the supplier's own state is the place of supply.
      // An IGST or untaxed bill is taken as supplied to the company's registered state.
      if (cgst || sgst) pos = gstin.slice(0, 2);
      else if (ownState) pos = ownState;
      else errors.push("No Place of Supply column and the company GSTIN is not set");
    }

    const eligibility = parseEligibility(cell("eligibility"));
    if (!eligibility) errors.push(`ITC eligibility "${cell("eligibility")}" is not eligible, blocked or ineligible`);

    const draft: BillDraft = {
      party_id: null,
      supplier_name: cell("name"),
      supplier_gstin: gstin,
      bill_number: cell("number"),
      bill_date: date ?? "",
      place_of_supply: pos,
      taxable,
      cgst,
      sgst,
      igst,
      cess,
      itc_eligibility: eligibility ?? "eligible",
      blocked_reason: cell("reason"),
    };
    for (const e of validateBill(draft, seen)) if (!errors.includes(e)) errors.push(e);
    if (draft.bill_number && gstin) seen.add(billKey(gstin, draft.bill_number));
    rows.push({ row, draft, errors });
  }
  return { rows, fileError: null };
}

// ---------- ITC totals ----------

/** Paise per GSTR-3B column. */
export interface ItcAmounts {
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface ItcTotals {
  eligible: ItcAmounts;
  blocked: ItcAmounts; // section 17(5)
  ineligible: ItcAmounts; // any other reason
  count: number;
}

const zero = (): ItcAmounts => ({ txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 });

/** Inclusive first and last date of a yyyy-mm month. */
export function monthBounds(month: string): { from: string; to: string } {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Bills dated in the month (yyyy-mm). */
export function billsInMonth<T extends { bill_date: string }>(bills: T[], month: string): T[] {
  return bills.filter((b) => b.bill_date.slice(0, 7) === month);
}

// shortcut: ITC is placed in the month of the bill date; bills received or reported in GSTR-2B later
// need the receipt period instead once that date is captured.
export function itcTotals(bills: PurchaseBill[], month: string): ItcTotals {
  const t: ItcTotals = { eligible: zero(), blocked: zero(), ineligible: zero(), count: 0 };
  for (const b of billsInMonth(bills, month)) {
    const to =
      b.itc_eligibility === "eligible" ? t.eligible : b.itc_eligibility === "blocked_17_5" ? t.blocked : t.ineligible;
    to.txval += paise(b.taxable_amount);
    to.iamt += paise(b.igst);
    to.camt += paise(b.cgst);
    to.samt += paise(b.sgst);
    to.csamt += paise(b.cess);
    t.count++;
  }
  return t;
}

export const itcTax = (a: ItcAmounts) => a.iamt + a.camt + a.samt + a.csamt;

// ---------- Purchase voucher ----------

export interface VoucherAccounts {
  expense: string; // purchase / expense ledger
  payable: string; // supplier's creditor ledger
  input: Partial<Record<"camt" | "samt" | "iamt" | "csamt", string>>; // Input GST ledgers
}

/**
 * Journal lines for the bill: Dr purchase, Dr Input GST, Cr supplier. Blocked or ineligible
 * tax is a cost, so it goes into the purchase ledger instead of Input GST.
 */
export function purchaseVoucherLines(
  d: BillDraft,
  acc: VoucherAccounts
): { lines: CreateJournalLineRequest[]; errors: string[] } {
  const errors: string[] = [];
  if (!acc.expense) errors.push("Choose the purchase ledger to debit");
  if (!acc.payable) errors.push("Choose the supplier ledger to credit");
  const claim = d.itc_eligibility === "eligible";
  const taxes: ["camt" | "samt" | "iamt" | "csamt", number, string][] = [
    ["camt", d.cgst ?? 0, "CGST"],
    ["samt", d.sgst ?? 0, "SGST"],
    ["iamt", d.igst ?? 0, "IGST"],
    ["csamt", d.cess ?? 0, "Cess"],
  ];
  let expense = d.taxable ?? 0;
  const lines: CreateJournalLineRequest[] = [];
  const desc = `Bill ${d.bill_number.trim()} from ${d.supplier_name.trim()}`;
  for (const [k, amt, label] of taxes) {
    if (!amt) continue;
    if (!claim) expense += amt;
    else if (!acc.input[k]) errors.push(`The chart of accounts has no "Input ${label}" ledger`);
    else lines.push({ line_number: 0, account_id: acc.input[k]!, description: `Input ${label} on ${desc}`, debit: amt / 100, credit: 0 });
  }
  lines.unshift({ line_number: 0, account_id: acc.expense, description: desc, debit: expense / 100, credit: 0 });
  lines.push({ line_number: 0, account_id: acc.payable, party_id: d.party_id, description: desc, debit: 0, credit: billTotal(d) / 100 });
  return { lines: lines.map((l, i) => ({ ...l, line_number: i + 1 })), errors };
}
