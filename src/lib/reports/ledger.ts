/**
 * Ledger report shapes. The aggregation runs in Postgres (migration 029: get_party_ledger_ageing,
 * get_kpi_snapshot, get_expense_breakdown); this file only converts its rupee figures to paise.
 */
import type { Address } from "@/types/accounting";

export const toPaise = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);
export const toRupees = (paise: number) => paise / 100;
const paiseOrNull = (v: number | string | null | undefined) => (v === null || v === undefined ? null : toPaise(v));

const DAY_MS = 86_400_000;
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);

/** First day of the financial year containing `asOf` (startMonth 1-12, India: 4). */
export function fyStart(asOf: string, startMonth = 4) {
  const y = Number(asOf.slice(0, 4));
  const m = Number(asOf.slice(5, 7));
  const year = m >= startMonth ? y : y - 1;
  return `${year}-${String(startMonth).padStart(2, "0")}-01`;
}

export type ControlKind = "receivable" | "payable";
type Money = number | string;

/** One row of get_party_ledger_ageing, as returned by GET /reports/party-ageing. */
export interface PartyAgeingRow {
  party_id: string | null;
  party_name: string | null;
  gstin: string | null;
  billing_address: Address | null;
  balance: Money;
  advance: Money;
  oldest_age_days: number | null;
  d0_30: Money;
  d31_60: Money;
  d61_90: Money;
  d90_plus: Money;
  open_items: {
    entry_id: string;
    entry_number: string;
    reference: string | null;
    date: string;
    amount: Money;
    open: Money;
    age_days: number;
    invoice_id: string | null;
    invoice_number: string | null;
    due_date: string | null;
  }[];
}

export interface OpenItem {
  entryId: string;
  entryNumber: string;
  reference: string | null;
  date: string;
  amountPaise: number;
  openPaise: number;
  ageDays: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
  dueDate: string | null;
}

export interface AgeBuckets {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export interface PartyBalance {
  partyId: string | null;
  partyName: string | null;
  gstin: string | null;
  billingAddress: Address | null;
  balancePaise: number;
  /** Payments not yet matched to a bill/invoice (balance in the other direction). */
  advancePaise: number;
  openItems: OpenItem[];
  oldestAgeDays: number | null;
  buckets: AgeBuckets;
}

export const toPartyBalances = (rows: PartyAgeingRow[]): PartyBalance[] =>
  rows.map((r) => ({
    partyId: r.party_id,
    partyName: r.party_name,
    gstin: r.gstin,
    billingAddress: r.billing_address,
    balancePaise: toPaise(r.balance),
    advancePaise: toPaise(r.advance),
    oldestAgeDays: r.oldest_age_days,
    buckets: { d0_30: toPaise(r.d0_30), d31_60: toPaise(r.d31_60), d61_90: toPaise(r.d61_90), d90_plus: toPaise(r.d90_plus) },
    openItems: r.open_items.map((i) => ({
      entryId: i.entry_id,
      entryNumber: i.entry_number,
      reference: i.reference,
      date: i.date,
      amountPaise: toPaise(i.amount),
      openPaise: toPaise(i.open),
      ageDays: i.age_days,
      invoiceId: i.invoice_id,
      invoiceNumber: i.invoice_number,
      dueDate: i.due_date,
    })),
  }));

export function ageBuckets(parties: PartyBalance[]): AgeBuckets {
  const b: AgeBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const p of parties) for (const k of Object.keys(b) as (keyof AgeBuckets)[]) b[k] += p.buckets[k];
  return b;
}

export const bucketOf = (ageDays: number | null) =>
  ageDays === null ? null : ageDays <= 30 ? "d0_30" : ageDays <= 60 ? "d31_60" : ageDays <= 90 ? "d61_90" : "d90_plus";

/** get_kpi_snapshot as returned by GET /reports/kpis (rupees). */
export interface KpiSnapshot {
  has_entries: boolean;
  last_entry_date: string | null;
  turnover: Money | null;
  profit: Money | null;
  billed: Money | null;
  liquid: Money | null;
  liquid_accounts: string[];
  debtors_account: { id: string; code: string; name: string } | null;
  debtors: Money | null;
  debtors_count: number;
  debtors_over_45_count: number;
  dso_days: number | null;
  creditors_account: { id: string; code: string; name: string } | null;
  creditors: Money | null;
  creditors_count: number;
  dpo_days: number | null;
  expenses: Money | null;
  expense_heads: string[];
  gst_output: Money | null;
  gst_input: Money | null;
  assets: Money | null;
  liabilities: Money | null;
  equity: Money | null;
  balanced: boolean | null;
}

/** Ledger KPIs in paise. Null means the books don't hold what's needed to compute it. */
export interface LedgerKpis {
  hasEntries: boolean;
  lastEntryDate: string | null;
  turnoverPaise: number | null;
  profitPaise: number | null;
  billedPaise: number | null;
  liquidPaise: number | null;
  liquidAccounts: string[];
  debtorsPaise: number | null;
  debtorsCount: number;
  debtorsOver45Count: number;
  dsoDays: number | null;
  creditorsPaise: number | null;
  creditorsCount: number;
  dpoDays: number | null;
  expensesPaise: number | null;
  expenseHeads: string[];
  gstOutputPaise: number | null;
  gstInputPaise: number | null;
  assetsPaise: number | null;
  liabilitiesPaise: number | null;
  /** Equity including profit not yet closed to retained earnings. */
  equityPaise: number | null;
  balanced: boolean | null;
}

export const toLedgerKpis = (k: KpiSnapshot): LedgerKpis => ({
  hasEntries: k.has_entries,
  lastEntryDate: k.last_entry_date,
  turnoverPaise: paiseOrNull(k.turnover),
  profitPaise: paiseOrNull(k.profit),
  billedPaise: paiseOrNull(k.billed),
  liquidPaise: paiseOrNull(k.liquid),
  liquidAccounts: k.liquid_accounts,
  debtorsPaise: paiseOrNull(k.debtors),
  debtorsCount: k.debtors_count,
  debtorsOver45Count: k.debtors_over_45_count,
  dsoDays: k.dso_days,
  creditorsPaise: paiseOrNull(k.creditors),
  creditorsCount: k.creditors_count,
  dpoDays: k.dpo_days,
  expensesPaise: paiseOrNull(k.expenses),
  expenseHeads: k.expense_heads,
  gstOutputPaise: paiseOrNull(k.gst_output),
  gstInputPaise: paiseOrNull(k.gst_input),
  assetsPaise: paiseOrNull(k.assets),
  liabilitiesPaise: paiseOrNull(k.liabilities),
  equityPaise: paiseOrNull(k.equity),
  balanced: k.balanced,
});

/** Placeholder while loading or when the books can't be read: every figure is unknown. */
export const EMPTY_KPI_SNAPSHOT: KpiSnapshot = {
  has_entries: false, last_entry_date: null, turnover: null, profit: null, billed: null, liquid: null,
  liquid_accounts: [], debtors_account: null, debtors: null, debtors_count: 0, debtors_over_45_count: 0,
  dso_days: null, creditors_account: null, creditors: null, creditors_count: 0, dpo_days: null,
  expenses: null, expense_heads: [], gst_output: null, gst_input: null, assets: null, liabilities: null,
  equity: null, balanced: null,
};
export const EMPTY_KPIS = toLedgerKpis(EMPTY_KPI_SNAPSHOT);
