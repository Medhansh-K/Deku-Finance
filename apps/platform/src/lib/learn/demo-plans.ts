import type { Entitlements, Subscription } from "@/lib/subscription/entitlements";

export type DemoPlanId = "go" | "pro" | "enterprise";

export type CapabilityStatus =
  | "available"
  | "simulated"
  | "requires_provider"
  | "not_yet_available";

export const CAPABILITY_STATUS_LABELS: Record<CapabilityStatus, string> = {
  available: "Available in demo",
  simulated: "Simulated",
  requires_provider: "Requires external provider",
  not_yet_available: "Not yet available",
};

export interface DemoPlanFeatureItem {
  key: string;
  label: string;
  minPlan: DemoPlanId;
  status: CapabilityStatus;
  detailsByPlan: Record<DemoPlanId, string>;
  explanation: string;
}

export interface DemoPlanConfig {
  id: DemoPlanId;
  name: string;
  priceInrYearly: number;
  priceLabel: string;
  tagline: string;
  badge: string;
  annualBillsLimit: number | null;
  catalogueItemsLimit: number | null;
  seatsLimit: number | null;
  allSevenRolesEnabled: boolean;
  makerCheckerEnabled: boolean;
  gstnJsonEnabled: boolean;
  bankReconEnabled: boolean;
  marketplaceEnabled: boolean;
  aiCfoWorkflowsEnabled: boolean;
  multiWarehouseEnabled: boolean;
  irpSandboxAvailable: boolean;
  entitlements: Entitlements;
  upgradeNote: string;
}

export const DEMO_PLANS: Record<DemoPlanId, DemoPlanConfig> = {
  go: {
    id: "go",
    name: "GO",
    priceInrYearly: 24999,
    priceLabel: "₹24,999 / year",
    tagline: "Essential starter for solo studios, freelancers, and early-stage businesses.",
    badge: "Essential Starter",
    annualBillsLimit: 2000,
    catalogueItemsLimit: 100,
    seatsLimit: 2,
    allSevenRolesEnabled: false,
    makerCheckerEnabled: false,
    gstnJsonEnabled: false,
    bankReconEnabled: false,
    marketplaceEnabled: false,
    aiCfoWorkflowsEnabled: false,
    multiWarehouseEnabled: false,
    irpSandboxAvailable: false,
    entitlements: {
      read_only: false,
      max_monthly_invoices: 167,
      seats: 2,
      gstn_json: false,
      direct_filing: false,
      payments: false,
    },
    upgradeNote:
      "GO covers Pure Accounting Mode (Sec 22 tracker), dynamic Bharat UPI QR, ALERX double-entry ledger, up to 2 user seats, 100 catalogue items, and 2,000 bills/year. Upgrade to PRO for GSTR-1/3B offline JSON, 7-role Maker-Checker, Bank Reconciliation, and unlimited billing.",
  },
  pro: {
    id: "pro",
    name: "PRO",
    priceInrYearly: 49999,
    priceLabel: "₹49,999 / year",
    tagline: "Most popular for growing SMEs needing unlimited billing, GST JSON, Bank Recon, and 7-Role RBAC.",
    badge: "Most Popular",
    annualBillsLimit: null,
    catalogueItemsLimit: null,
    seatsLimit: 5,
    allSevenRolesEnabled: true,
    makerCheckerEnabled: true,
    gstnJsonEnabled: true,
    bankReconEnabled: true,
    marketplaceEnabled: true,
    aiCfoWorkflowsEnabled: false,
    multiWarehouseEnabled: false,
    irpSandboxAvailable: false,
    entitlements: {
      read_only: false,
      max_monthly_invoices: null,
      seats: 5,
      gstn_json: true,
      direct_filing: false,
      payments: true,
    },
    upgradeNote:
      "PRO unlocks unlimited bills & catalogue items, 5 user seats, all 7 RBAC roles, Maker-Checker voucher approvals, Rule 88A & Sec 17(5) ITC tracking, CSV Bank Reconciliation, and offline GSTR-1/3B JSON exports. Enterprise adds unlimited seats, AI CFO, multi-warehouse, and GSP/IRP connectors.",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceInrYearly: 119999,
    priceLabel: "₹1,19,999 / year",
    tagline: "Complete suite for multi-entity organisations needing AI CFO, multi-warehouse, and GSP connectors.",
    badge: "Complete Suite",
    annualBillsLimit: null,
    catalogueItemsLimit: null,
    seatsLimit: null,
    allSevenRolesEnabled: true,
    makerCheckerEnabled: true,
    gstnJsonEnabled: true,
    bankReconEnabled: true,
    marketplaceEnabled: true,
    aiCfoWorkflowsEnabled: true,
    multiWarehouseEnabled: true,
    irpSandboxAvailable: true,
    entitlements: {
      read_only: false,
      max_monthly_invoices: null,
      seats: null,
      gstn_json: true,
      direct_filing: true,
      payments: true,
    },
    upgradeNote:
      "Enterprise removes seat/entity caps and unlocks Deku AI CFO (10 departments), multi-warehouse inventory, automated marketplace settlement, and GSP/IRP/E-Way connectors (simulated cleanly without live statutory submission in public demo).",
  },
};

export const DEMO_PLAN_FEATURES: DemoPlanFeatureItem[] = [
  {
    key: "billing_volume",
    label: "Invoicing & Voucher Volume",
    minPlan: "go",
    status: "available",
    detailsByPlan: {
      go: "Up to 2,000 bills/year",
      pro: "Unlimited bills",
      enterprise: "Unlimited (high-throughput)",
    },
    explanation: "Standard commercial & GST double-entry billing powered by ALERX.",
  },
  {
    key: "catalogue_items",
    label: "Master Products & Services Catalogue",
    minPlan: "go",
    status: "available",
    detailsByPlan: {
      go: "Up to 100 items",
      pro: "Unlimited items",
      enterprise: "Unlimited + Multi-Warehouse",
    },
    explanation: "HSN/SAC codes, GST rate defaults, and inventory tracking.",
  },
  {
    key: "seats_rbac",
    label: "Seats & 7-Role Governance",
    minPlan: "go",
    status: "available",
    detailsByPlan: {
      go: "2 seats (Admin + Accountant)",
      pro: "5 seats + all 7 roles + Maker-Checker",
      enterprise: "Unlimited seats + all 7 roles + Maker-Checker",
    },
    explanation: "Switch any of the 7 roles in the Demo Control Bar to preview governance boundaries.",
  },
  {
    key: "gstn_offline_json",
    label: "GSTR-1 & GSTR-3B Offline JSON Export",
    minPlan: "pro",
    status: "available",
    detailsByPlan: {
      go: "Summary view only",
      pro: "1-Click Offline JSON Export",
      enterprise: "Offline JSON + Direct GSP Connector",
    },
    explanation: "Generates schema-aligned GSTR-1 and GSTR-3B summaries & offline JSON preview.",
  },
  {
    key: "bank_reconciliation",
    label: "Bank Statement CSV Reconciliation",
    minPlan: "pro",
    status: "available",
    detailsByPlan: {
      go: "Cash/Bank Book only",
      pro: "CSV Import + Auto-Match & Unmatched Resolution",
      enterprise: "Full Multi-Bank Reconciliation",
    },
    explanation: "Browser-side CSV statement matching with 5-day tolerance & reference pairing.",
  },
  {
    key: "marketplace_settlement",
    label: "Marketplace Settlement (ECO Sec 14 / Table 3.1.1)",
    minPlan: "pro",
    status: "available",
    detailsByPlan: {
      go: "Manual Journal Entry",
      pro: "CSV Marketplace Sheet Parser",
      enterprise: "Automated Multi-Channel Reconciliation",
    },
    explanation: "Parses Amazon/Flipkart/Blinkit/Meesho payouts into net sales and TCS/commission ledgers.",
  },
  {
    key: "multi_warehouse",
    label: "Multi-Warehouse Stock & Transfers",
    minPlan: "enterprise",
    status: "available",
    detailsByPlan: {
      go: "Single location catalogue",
      pro: "Single warehouse inventory",
      enterprise: "Multi-Warehouse valuation & bin movements",
    },
    explanation: "Tracks FIFO stock layers and warehouse-level stock summaries.",
  },
  {
    key: "ai_cfo",
    label: "Deku Consultant AI CFO (10 Departments)",
    minPlan: "enterprise",
    status: "simulated",
    detailsByPlan: {
      go: "Locked (Upgrade to Enterprise)",
      pro: "Locked (Upgrade to Enterprise)",
      enterprise: "10 Departments & 50 Guided Financial Workflows",
    },
    explanation:
      "Demonstrates deterministic financial diagnostics and department scorecards using company sample books without external AI calls.",
  },
  {
    key: "irp_ewb_gsp",
    label: "Direct IRP E-Invoicing, E-Way Bill & GSP Filing",
    minPlan: "enterprise",
    status: "requires_provider",
    detailsByPlan: {
      go: "Unavailable on GO",
      pro: "Offline JSON only",
      enterprise: "Sandbox IRN / EWB Preview (External GSP required in prod)",
    },
    explanation:
      "In the public demo, IRN hashes and E-Way flows are simulated safely with zero live NIC/GSTN submissions.",
  },
  {
    key: "payments_whatsapp",
    label: "Razorpay Payment Links & WhatsApp Dispatch",
    minPlan: "pro",
    status: "requires_provider",
    detailsByPlan: {
      go: "Static Bharat UPI QR",
      pro: "Simulated Payment Link + WhatsApp Preview",
      enterprise: "Simulated Auto-Split Webhooks + Dispatch Preview",
    },
    explanation:
      "External payment gateway webhooks and outbound WhatsApp dispatch are disabled/simulated in public demo mode.",
  },
  {
    key: "live_bank_feeds",
    label: "Live Open-Banking Statement Feeds",
    minPlan: "enterprise",
    status: "not_yet_available",
    detailsByPlan: {
      go: "Use Bank CSV import",
      pro: "Use Bank CSV import",
      enterprise: "CSV import active; automated bank feeds not yet integrated",
    },
    explanation: "Deku currently ingests bank statements via CSV upload rather than live Account Aggregator feeds.",
  },
];

export function getDemoPlanConfig(plan: string | null | undefined): DemoPlanConfig {
  if (plan === "go" || plan === "pro" || plan === "enterprise") {
    return DEMO_PLANS[plan];
  }
  return DEMO_PLANS.pro;
}

export function buildDemoSubscription(
  planId: DemoPlanId,
  usage?: { invoices_this_month?: number; seats_used?: number }
): Subscription {
  const plan = getDemoPlanConfig(planId);
  return {
    plan: {
      code: plan.id,
      name: `Deku ${plan.name} (Demo Preview)`,
      price_paise_monthly: null,
      price_paise_yearly: plan.priceInrYearly * 100,
    },
    status: "active",
    trial_ends_at: null,
    current_period_end: "2027-03-31T23:59:59.000Z",
    provider: "manual",
    entitlements: plan.entitlements,
    usage: {
      invoices_this_month: usage?.invoices_this_month ?? 18,
      seats_used: usage?.seats_used ?? 4,
    },
    server_time: "2026-11-10T12:00:00.000Z",
  };
}

