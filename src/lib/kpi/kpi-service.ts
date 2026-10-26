/**
 * Deku Finance — KPI Service & Dynamic Storage
 * Manages numerical business KPIs, local overrides, and detail route metadata.
 */

import { formatINR } from "@/lib/formatters/currency";

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
  shortLabel: string;
  detailRoute: string;
  description: string;
  category: "revenue" | "profit" | "liquidity" | "receivables" | "payables" | "expenses" | "statutory";
}

export const KPI_META: Record<KpiKey, KpiDefinition> = {
  turnover: {
    key: "turnover",
    label: "Gross Turnover",
    shortLabel: "Turnover (FY 26-27)",
    detailRoute: "/invoices",
    description: "Annual turnover, invoicing & sales register",
    category: "revenue",
  },
  profit: {
    key: "profit",
    label: "Net Profit (EBITDA)",
    shortLabel: "Net Profit (EBITDA)",
    detailRoute: "/reports/profit-loss",
    description: "Operating bottom-line from Profit & Loss statement",
    category: "profit",
  },
  billed: {
    key: "billed",
    label: "Billed Turnover",
    shortLabel: "Billed Turnover",
    detailRoute: "/invoices",
    description: "Invoiced billing, conversions & sales register",
    category: "revenue",
  },
  liquid: {
    key: "liquid",
    label: "Liquid Funds",
    shortLabel: "Cash & Bank",
    detailRoute: "/masters/chart-of-accounts?group=asset&filter=liquid",
    description: "Chart of Accounts asset ledgers for cash & bank liquidity",
    category: "liquidity",
  },
  debtors: {
    key: "debtors",
    label: "Trade Debtors (AR)",
    shortLabel: "Trade Debtors",
    detailRoute: "/reports/debtors",
    description: "Accounts receivable from customer ledgers tracked as per DSO",
    category: "receivables",
  },
  creditors: {
    key: "creditors",
    label: "Trade Creditors (AP)",
    shortLabel: "Trade Creditors",
    detailRoute: "/reports/creditors",
    description: "Accounts payable to vendors tracked as per DPO & bills issued",
    category: "payables",
  },
  expenses: {
    key: "expenses",
    label: "Operating Expenses",
    shortLabel: "Operating Expenses",
    detailRoute: "/reports/operating-expenses",
    description: "Payment vouchers issued to entities and department-wise expenses",
    category: "expenses",
  },
  gst: {
    key: "gst",
    label: "GST Net Payable",
    shortLabel: "GST Net Liability",
    detailRoute: "/gst",
    description: "Net tax liability after Input Tax Credit (ITC) offset",
    category: "statutory",
  },
};

export interface RawKpiData {
  turnover: number;
  profit: number;
  billed: number;
  liquid: number;
  debtors: number;
  creditors: number;
  expenses: number;
  gst: number;
  // Qualitative context notes
  liquidBank?: string;
  debtorsCount?: string;
  debtorsAging?: string;
  creditorsCount?: string;
  creditorsTerms?: string;
  expensesHeads?: string;
  gstBreakdown?: string;
  gstStatus?: string;
  // Selected quick KPIs to display in Column 3
  quickKpiKeys?: KpiKey[];
}

export interface FormattedKpiProfile {
  raw: RawKpiData;
  turnover: string;
  profit: string;
  margin: string;
  billed: string;
  billedLimit: string;
  sec22Badge: string;
  sec22Variant: "safe" | "warn" | "corp";
  sec22Progress: string;
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
  activeAccounts: number;
  quickKpiKeys: KpiKey[];
}

export const DEFAULT_QUICK_KPIS: KpiKey[] = [
  "billed",
  "liquid",
  "debtors",
  "creditors",
  "expenses",
  "gst",
];

const KNOWN_DEFAULT_KPIS: Record<string, RawKpiData> = {
  // 1. Deku Financial Technologies
  "b127e064-5da8-437f-94c4-b8d6a0c12927": {
    turnover: 1245000,
    profit: 825000,
    billed: 1245000,
    liquid: 640000,
    debtors: 260000,
    creditors: 115000,
    expenses: 420000,
    gst: 48600,
    liquidBank: "HDFC Current + Cash",
    debtorsCount: "14 Active Accounts",
    debtorsAging: "0 overdue > 45d",
    creditorsCount: "6 Vendor Accounts",
    creditorsTerms: "Terms: Net 30d",
    expensesHeads: "Infra, Tech & Salary",
    gstBreakdown: "Outward ₹92k − ITC ₹44k",
    gstStatus: "GSTR-3B Ready",
    quickKpiKeys: DEFAULT_QUICK_KPIS,
  },
  // 2. All Might Logistics & Warehousing
  "b093d7d9-395a-429b-8c9a-af31b8b270f2": {
    turnover: 3870000,
    profit: 1420000,
    billed: 3870000,
    liquid: 1180000,
    debtors: 845000,
    creditors: 590000,
    expenses: 2450000,
    gst: 162400,
    liquidBank: "SBI Commercial + Cash",
    debtorsCount: "28 Active Accounts",
    debtorsAging: "2 overdue > 45d",
    creditorsCount: "19 Vendor Accounts",
    creditorsTerms: "Terms: Net 15d",
    expensesHeads: "Fleet Fuel & Storage",
    gstBreakdown: "Outward ₹4.20L − ITC ₹2.58L",
    gstStatus: "GSTR-3B Ready",
    quickKpiKeys: DEFAULT_QUICK_KPIS,
  },
  // 3. Endeavor Energy & Tech Solutions
  "8aec2336-5531-459e-baba-6a37128cffa2": {
    turnover: 7250000,
    profit: 3180000,
    billed: 7250000,
    liquid: 2415000,
    debtors: 1630000,
    creditors: 980000,
    expenses: 4070000,
    gst: 312000,
    liquidBank: "ICICI Corporate + Treasury",
    debtorsCount: "42 Enterprise Clients",
    debtorsAging: "0 overdue > 45d",
    creditorsCount: "12 Vendor Accounts",
    creditorsTerms: "Terms: Net 45d",
    expensesHeads: "R&D, Cloud & Solar",
    gstBreakdown: "Outward ₹8.50L − ITC ₹5.38L",
    gstStatus: "Advance Tax Settled",
    quickKpiKeys: DEFAULT_QUICK_KPIS,
  },
};

/**
 * Returns deterministic defaults for custom orgs
 */
function getCustomOrgDefaults(orgId: string, orgName: string): RawKpiData {
  let hash = 0;
  for (let i = 0; i < orgName.length; i++) {
    hash = (hash * 31 + orgName.charCodeAt(i)) & 0xffffff;
  }
  const turnoverVal = 1500000 + (hash % 4500000);
  const profitVal = Math.round(turnoverVal * 0.42);
  const expensesVal = turnoverVal - profitVal;
  const liquidVal = Math.round(turnoverVal * 0.35);
  const debtorsVal = Math.round(turnoverVal * 0.18);
  const creditorsVal = Math.round(turnoverVal * 0.09);
  const gstVal = Math.round(turnoverVal * 0.045);

  return {
    turnover: turnoverVal,
    profit: profitVal,
    billed: turnoverVal,
    liquid: liquidVal,
    debtors: debtorsVal,
    creditors: creditorsVal,
    expenses: expensesVal,
    gst: gstVal,
    liquidBank: "Operational Bank + Cash",
    debtorsCount: `${12 + (hash % 20)} Active Accounts`,
    debtorsAging: "0 overdue > 45d",
    creditorsCount: `${5 + (hash % 10)} Vendor Accounts`,
    creditorsTerms: "Terms: Net 30d",
    expensesHeads: "Operational Overheads",
    gstBreakdown: "Tax Engine Balanced",
    gstStatus: "GSTR-3B Ready",
    quickKpiKeys: DEFAULT_QUICK_KPIS,
  };
}

/**
 * Formats a raw KPI data record into displayable strings with currency formatting
 */
export function formatKpiProfile(raw: RawKpiData): FormattedKpiProfile {
  const turnover = raw.turnover || 0;
  const profit = raw.profit || 0;
  const billed = raw.billed || raw.turnover || 0;
  const liquid = raw.liquid || 0;
  const debtors = raw.debtors || 0;
  const creditors = raw.creditors || 0;
  const expenses = raw.expenses || 0;
  const gst = raw.gst || 0;

  const margin = turnover > 0 ? `${Math.round((profit / turnover) * 1000) / 10}%` : "0.0%";
  const expenseRatio = turnover > 0 ? `${Math.round((expenses / turnover) * 1000) / 10}% Expense Ratio` : "0.0%";

  let sec22Badge = "ALERX Audited";
  let sec22Variant: "safe" | "warn" | "corp" = "safe";
  let sec22Progress = "w-[31.1%]";
  let sec22Sub = "Sec 22 Limit: Enterprise Standard";
  let billedLimit = "Sec 22 Limit: Enterprise Standard";

  if (billed <= 3000000) {
    const pct = Math.round((billed / 4000000) * 1000) / 10;
    sec22Badge = "Sec 22 Safe";
    sec22Variant = "safe";
    sec22Progress = `w-[${pct}%]`;
    sec22Sub = `${pct}% of ₹40L limit`;
    billedLimit = `Sec 22 Limit: ${pct}% of ₹40L`;
  } else if (billed <= 4000000) {
    const pct = Math.round((billed / 4000000) * 1000) / 10;
    sec22Badge = "GST Due";
    sec22Variant = "warn";
    sec22Progress = `w-[${pct}%]`;
    sec22Sub = `${pct}% of ₹40L limit`;
    billedLimit = `Sec 22 Limit: ${pct}% of ₹40L`;
  } else {
    sec22Badge = "Corporate Active";
    sec22Variant = "corp";
    sec22Progress = "w-[100%]";
    sec22Sub = "Corporate Turnover > ₹40L";
    billedLimit = "Corporate Turnover > ₹40L";
  }

  return {
    raw,
    turnover: formatINR(turnover),
    profit: formatINR(profit),
    margin,
    billed: formatINR(billed, { minimumFractionDigits: 0 }),
    billedLimit,
    sec22Badge,
    sec22Variant,
    sec22Progress,
    sec22Sub,
    liquid: formatINR(liquid, { minimumFractionDigits: 0 }),
    liquidBank: raw.liquidBank || "Operational Bank + Cash",
    debtors: formatINR(debtors, { minimumFractionDigits: 0 }),
    debtorsCount: raw.debtorsCount || "Active Debtors",
    debtorsAging: raw.debtorsAging || "0 overdue > 45d",
    creditors: formatINR(creditors, { minimumFractionDigits: 0 }),
    creditorsCount: raw.creditorsCount || "Vendor Accounts",
    creditorsTerms: raw.creditorsTerms || "Terms: Net 30d",
    expenses: formatINR(expenses, { minimumFractionDigits: 0 }),
    expensesHeads: raw.expensesHeads || "Operational Overheads",
    expenseRatio,
    gst: formatINR(gst, { minimumFractionDigits: 0 }),
    gstBreakdown: raw.gstBreakdown || "Tax Engine Balanced",
    gstStatus: raw.gstStatus || "GSTR-3B Ready",
    lastEntry: "20-Oct-2026",
    activeAccounts: 30,
    quickKpiKeys: raw.quickKpiKeys && raw.quickKpiKeys.length > 0 ? raw.quickKpiKeys : DEFAULT_QUICK_KPIS,
  };
}

/**
 * Get the current KPI profile for an organization, incorporating localStorage overrides
 */
export function getKpiProfile(orgId: string, orgName: string = ""): FormattedKpiProfile {
  let base: RawKpiData = KNOWN_DEFAULT_KPIS[orgId] || getCustomOrgDefaults(orgId, orgName);

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`deku_kpi_profile_${orgId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        base = { ...base, ...parsed };
      }
    } catch {
      // Use fallback base
    }
  }

  return formatKpiProfile(base);
}

/**
 * Save updated KPI profile for an organization and broadcast the change event
 */
export function saveKpiProfile(orgId: string, updates: Partial<RawKpiData>): FormattedKpiProfile {
  let currentRaw = KNOWN_DEFAULT_KPIS[orgId] || getCustomOrgDefaults(orgId, "Company");

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`deku_kpi_profile_${orgId}`);
      if (stored) {
        currentRaw = { ...currentRaw, ...JSON.parse(stored) };
      }
    } catch {}

    const updatedRaw: RawKpiData = {
      ...currentRaw,
      ...updates,
    };

    localStorage.setItem(`deku_kpi_profile_${orgId}`, JSON.stringify(updatedRaw));

    // Dispatch global event for instant reactive update across all open tabs/views
    window.dispatchEvent(
      new CustomEvent("deku_kpi_changed", {
        detail: { orgId, data: updatedRaw },
      })
    );

    return formatKpiProfile(updatedRaw);
  }

  return formatKpiProfile({ ...currentRaw, ...updates });
}

/**
 * Reset KPI profile to verified defaults
 */
export function resetKpiProfile(orgId: string, orgName: string = ""): FormattedKpiProfile {
  if (typeof window !== "undefined") {
    localStorage.removeItem(`deku_kpi_profile_${orgId}`);
    window.dispatchEvent(
      new CustomEvent("deku_kpi_changed", {
        detail: { orgId },
      })
    );
  }
  const base = KNOWN_DEFAULT_KPIS[orgId] || getCustomOrgDefaults(orgId, orgName);
  return formatKpiProfile(base);
}
