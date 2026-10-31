/** CSV exports built from the existing API responses; toCsv neutralises spreadsheet formulas. */
import { toCsv } from "@/lib/download";
import type { Account, CatalogueItem, GeneralLedgerRow, Party } from "@/types/accounting";

const n = (v: unknown) => Number(v ?? 0).toFixed(2);

export const accountsCsv = (rows: Account[]) =>
  toCsv([
    ["Code", "Name", "Group", "Ledger", "Sub-ledger", "Postable", "Active"],
    ...rows.map((a) => [a.code, a.name, a.account_group, a.ledger, a.sub_ledger, a.is_postable ? "Yes" : "No", a.is_active ? "Yes" : "No"]),
  ]);

export const partiesCsv = (rows: Party[]) =>
  toCsv([
    ["Name", "Type", "GSTIN", "PAN", "Email", "Phone", "State"],
    ...rows.map((p) => [p.legal_name, p.type, p.gstin ?? "", p.pan ?? "", p.email ?? "", p.phone ?? "", p.billing_address?.state ?? ""]),
  ]);

export const itemsCsv = (rows: CatalogueItem[]) =>
  toCsv([
    ["Name", "Type", "SKU", "HSN/SAC", "Unit", "GST rate %", "Price"],
    ...rows.map((i) => [i.name, i.type, i.sku ?? "", i.hsn_sac_code ?? "", i.unit_code, String(i.default_gst_rate), n(i.default_unit_price)]),
  ]);

/** One row per posted line between the two ISO dates (inclusive), oldest first. */
export function dayBookCsv(rows: GeneralLedgerRow[], from: string, to: string) {
  const inRange = rows
    .filter((r) => r.entry_date >= from && r.entry_date <= to)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number) || a.line_number - b.line_number);
  return toCsv([
    ["Date", "Voucher", "Reference", "Account code", "Account", "Party", "Description", "Debit", "Credit"],
    ...inRange.map((r) => [
      r.entry_date,
      r.entry_number,
      r.reference ?? "",
      r.account_code,
      r.account_name,
      r.party_name ?? "",
      r.description ?? "",
      n(r.debit),
      n(r.credit),
    ]),
  ]);
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number | string;
  total_credit: number | string;
  closing_debit?: number | string;
  closing_credit?: number | string;
}

export const trialBalanceCsv = (rows: TrialBalanceRow[]) =>
  toCsv([
    ["Code", "Account", "Type", "Total debit", "Total credit", "Closing debit", "Closing credit"],
    ...rows.map((r) => [r.account_code, r.account_name, r.account_type, n(r.total_debit), n(r.total_credit), n(r.closing_debit), n(r.closing_credit)]),
  ]);
