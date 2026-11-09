/** CSV exports built from the existing API responses; toCsv neutralises spreadsheet formulas. */
import { toCsv } from "@/lib/download";
import { toPaise, toRupees } from "@/lib/reports/ledger";
import type { Ledger } from "@/lib/reports/general-ledger";
import type { Account, BalanceSheetRow, CatalogueItem, GeneralLedgerRow, Party, ProfitLossRow } from "@/types/accounting";

const n = (v: unknown) => Number(v ?? 0).toFixed(2);
const total = (values: (number | string)[]) => n(toRupees(values.reduce<number>((sum, v) => sum + toPaise(v), 0)));

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

const drCr = (balance: number) => (balance > 0 ? "Dr" : balance < 0 ? "Cr" : "");

export const generalLedgerCsv = ({ opening, lines }: Ledger, from: string) =>
  toCsv([
    ["Date", "Voucher", "Narration", "Party", "Debit", "Credit", "Balance", "Dr/Cr"],
    ...(opening === null ? [] : [[from, "", "Opening balance", "", "", "", n(Math.abs(opening)), drCr(opening)]]),
    ...lines.map((l) => [l.entry_date, l.entry_number, l.text, l.party_name ?? "", n(l.debit), n(l.credit), n(Math.abs(l.balance)), drCr(l.balance)]),
  ]);

export function profitLossCsv(rows: ProfitLossRow[], from: string, to: string) {
  const income = rows.filter((r) => r.account_type === "income");
  const expense = rows.filter((r) => r.account_type === "expense");
  const totalIncome = total(income.map((r) => r.net_amount));
  const totalExpense = total(expense.map((r) => r.net_amount));
  const line = (section: string) => (r: ProfitLossRow) => [section, r.account_code, r.account_name, n(r.net_amount)];
  return toCsv([
    ["Profit & Loss", "From", from, "To", to],
    ["Section", "Code", "Account", "Amount"],
    ...income.map(line("Income")),
    ["Total income", "", "", totalIncome],
    ...expense.map(line("Expense")),
    ["Total expenses", "", "", totalExpense],
    ["Net profit / (loss)", "", "", n(toRupees(toPaise(totalIncome) - toPaise(totalExpense)))],
  ]);
}

export function balanceSheetCsv(rows: BalanceSheetRow[], asOf: string) {
  const section = (type: BalanceSheetRow["account_type"], label: string) => {
    const of = rows.filter((r) => r.account_type === type);
    return [
      ...of.map((r) => [label, r.account_code ?? "", r.account_name, n(r.balance)]),
      [`Total ${label.toLowerCase()}`, "", "", total(of.map((r) => r.balance))],
    ];
  };
  return toCsv([
    ["Balance Sheet", "As of", asOf],
    ["Section", "Code", "Account", "Balance"],
    ...section("asset", "Assets"),
    ...section("liability", "Liabilities"),
    ...section("equity", "Equity"),
  ]);
}

/** A figure the server didn't send stays blank, never 0.00. */
export function cashFlowCsv(data: any, from: string, to: string) {
  const v = (x: unknown) => (x === null || x === undefined ? "" : n(x));
  const operating = data?.operating_activities;
  return toCsv([
    ["Cash Flow Statement", "From", from, "To", to],
    ["Line", "Amount"],
    ["Opening cash and bank", v(data?.opening_cash_equivalents)],
    ["Cash received from customers", v(operating?.cash_receipts_from_sales)],
    ["Cash paid for operations", v(operating?.cash_paid_for_operations)],
    ["Net cash from operating activities", v(operating?.net_cash_from_operating_activities)],
    ["Net cash from investing activities", v(data?.investing_activities?.net_cash_used_in_investing)],
    ["Net cash from financing activities", v(data?.financing_activities?.net_cash_from_financing)],
    ["Net change in cash", v(data?.net_change_in_cash)],
    ["Closing cash and bank", v(data?.closing_cash_equivalents)],
  ]);
}
