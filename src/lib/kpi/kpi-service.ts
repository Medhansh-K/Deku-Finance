/**
 * Deku Finance — KPI Service
 * KPI values come from the company's books (see src/lib/reports/kpis.ts). Only the choice of
 * which tiles to show is kept per browser.
 */

import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { accountingApi, invoicesApi, organisationsApi } from "@/api/endpoints";
import { computeKpis, LedgerKpis } from "@/lib/reports/kpis";
import { fyStart, toRupees } from "@/lib/reports/ledger";

export type KpiKey =
  | "turnover"
  | "profit"
  | "billed"
  | "liquid"
  | "debtors"
  | "creditors"
  | "expenses"
  | "gst";

export interface KpiDefinition {
  key: KpiKey;
  label: string;
  detailRoute: string;
}

export const KPI_META: Record<KpiKey, KpiDefinition> = {
  turnover: { key: "turnover", label: "Gross Turnover", detailRoute: "/invoices" },
  profit: { key: "profit", label: "Net Profit", detailRoute: "/reports/profit-loss" },
  billed: { key: "billed", label: "Billed Turnover", detailRoute: "/invoices" },
  liquid: { key: "liquid", label: "Liquid Funds", detailRoute: "/masters/chart-of-accounts?group=asset&filter=liquid" },
  debtors: { key: "debtors", label: "Trade Debtors (AR)", detailRoute: "/reports/debtors" },
  creditors: { key: "creditors", label: "Trade Creditors (AP)", detailRoute: "/reports/creditors" },
  expenses: { key: "expenses", label: "Operating Expenses", detailRoute: "/reports/operating-expenses" },
  gst: { key: "gst", label: "GST Net Payable", detailRoute: "/gst" },
};

export const DEFAULT_QUICK_KPIS: KpiKey[] = ["billed", "liquid", "debtors", "creditors", "expenses", "gst"];

export const SEC22_LIMIT_PAISE = 40_00_000_00;

export interface FormattedKpiProfile {
  hasEntries: boolean;
  periodLabel: string;
  turnover: string;
  profit: string;
  margin: string;
  billed: string;
  billedLimit: string;
  sec22Badge: string;
  sec22Variant: "safe" | "warn" | "corp";
  /** Share of the ₹40L Sec 22 threshold reached, 0-100; null when turnover is unknown. */
  sec22Pct: number | null;
  sec22Sub: string;
  liquid: string;
  liquidBank: string;
  debtors: string;
  debtorsCount: string;
  debtorsAging: string;
  creditors: string;
  creditorsCount: string;
  creditorsTerms: string;
  expenses: string;
  expensesHeads: string;
  expenseRatio: string;
  gst: string;
  gstBreakdown: string;
  gstStatus: string;
  lastEntry: string;
  assets: string;
  liabilities: string;
  equity: string;
  equationText: string;
  balanced: boolean | null;
}

const DASH = "–";
const money = (p: number | null) => (p === null ? DASH : formatINR(toRupees(p), { minimumFractionDigits: 0 }));
const lakhs = (p: number | null) => (p === null ? DASH : `₹${(p / 1e7).toFixed(2)}L`);
const pct = (num: number | null, den: number | null) =>
  num === null || !den ? null : Math.round((num / den) * 1000) / 10;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function formatKpis(kp: LedgerKpis, from: string, asOf: string): FormattedKpiProfile {
  const none = kp.hasEntries ? "" : "No posted entries yet";
  const margin = pct(kp.profitPaise, kp.turnoverPaise);
  const ratio = pct(kp.expensesPaise, kp.turnoverPaise);
  const s22 = kp.turnoverPaise === null ? null : Math.min(100, pct(kp.turnoverPaise, SEC22_LIMIT_PAISE)!);
  const [sec22Badge, sec22Variant] =
    kp.turnoverPaise === null
      ? [DASH, "safe" as const]
      : kp.turnoverPaise <= 30_00_000_00
      ? ["Below Sec 22 limit", "safe" as const]
      : kp.turnoverPaise <= SEC22_LIMIT_PAISE
      ? ["Near Sec 22 limit", "warn" as const]
      : ["Above Sec 22 limit", "corp" as const];
  const sec22Sub = s22 === null ? "Turnover not computed" : `${s22}% of ₹40L limit`;
  const gstNet =
    kp.gstOutputPaise === null && kp.gstInputPaise === null
      ? null
      : (kp.gstOutputPaise ?? 0) - (kp.gstInputPaise ?? 0);

  return {
    hasEntries: kp.hasEntries,
    periodLabel: from ? `${formatDateTally(from)} to ${formatDateTally(asOf)}` : DASH,
    turnover: money(kp.turnoverPaise),
    profit: money(kp.profitPaise),
    margin: margin === null ? DASH : `${margin}%`,
    billed: money(kp.billedPaise),
    billedLimit: kp.billedPaise === null ? "No issued invoices this year" : "Issued invoices this year",
    sec22Badge,
    sec22Variant,
    sec22Pct: s22,
    sec22Sub,
    liquid: money(kp.liquidPaise),
    liquidBank: kp.liquidAccounts.length ? kp.liquidAccounts.join(" + ") : none || "No cash or bank balance",
    debtors: money(kp.debtorsPaise),
    debtorsCount: plural(kp.debtorsCount, "customer owes", "customers owe"),
    debtorsAging: plural(kp.debtorsOver45Count, "aged > 45d", "aged > 45d"),
    creditors: money(kp.creditorsPaise),
    creditorsCount: plural(kp.creditorsCount, "vendor owed", "vendors owed"),
    creditorsTerms: kp.dpoDays === null ? `DPO ${DASH}` : `DPO ${kp.dpoDays} days`,
    expenses: money(kp.expensesPaise),
    expensesHeads: kp.expenseHeads.join(", ") || none || "No expenses this year",
    expenseRatio: ratio === null ? `Expense ratio ${DASH}` : `${ratio}% Expense Ratio`,
    gst: money(gstNet),
    gstBreakdown:
      gstNet === null ? "No GST ledgers" : `Output ${lakhs(kp.gstOutputPaise)} − ITC ${lakhs(kp.gstInputPaise)}`,
    gstStatus: "Ledger balance",
    lastEntry: kp.lastEntryDate ? formatDateTally(kp.lastEntryDate) : DASH,
    assets: money(kp.assetsPaise),
    liabilities: money(kp.liabilitiesPaise),
    equity: money(kp.equityPaise),
    equationText: kp.hasEntries
      ? `Assets (${lakhs(kp.assetsPaise)}) = Liabilities (${lakhs(kp.liabilitiesPaise)}) + Equity (${lakhs(kp.equityPaise)})`
      : "No posted entries yet",
    balanced: kp.balanced,
  };
}

/** Loads the books for an organisation and computes its KPIs for the current financial year. */
export async function loadKpis(orgId: string): Promise<FormattedKpiProfile> {
  const asOf = toISODateString();
  const [org, accounts, journals, invoices] = await Promise.all([
    organisationsApi.get(orgId),
    accountingApi.listAccounts(orgId),
    accountingApi.listJournals(orgId),
    invoicesApi.list(orgId),
  ]);
  const from = fyStart(asOf, org.data?.[0]?.financial_year_start_month || 4);
  const k = computeKpis({
    accounts: accounts.data ?? [],
    journals: journals.data ?? [],
    invoices: invoices.data ?? [],
    from,
    asOf,
  });
  return formatKpis(k, from, asOf);
}

/** Placeholder while loading or when the books can't be read: every figure shows "–". */
export const emptyKpis = () =>
  formatKpis(computeKpis({ accounts: [], journals: [], invoices: [], from: "", asOf: "" }), "", "");

const tilesKey = (orgId: string) => `deku_kpi_tiles_${orgId}`;

export function getQuickKpiKeys(orgId: string): KpiKey[] {
  try {
    const keys = JSON.parse(localStorage.getItem(tilesKey(orgId)) || "null");
    if (Array.isArray(keys) && keys.length) return keys.filter((k): k is KpiKey => k in KPI_META);
  } catch {}
  return DEFAULT_QUICK_KPIS;
}

export function saveQuickKpiKeys(orgId: string, keys: KpiKey[] | null) {
  try {
    if (keys) localStorage.setItem(tilesKey(orgId), JSON.stringify(keys));
    else localStorage.removeItem(tilesKey(orgId));
    // Values once lived here; drop them so nothing stale lingers.
    localStorage.removeItem(`deku_kpi_profile_${orgId}`);
  } catch {}
  window.dispatchEvent(new CustomEvent("deku_kpi_changed", { detail: { orgId } }));
}
