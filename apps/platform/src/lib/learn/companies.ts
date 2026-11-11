/**
 * Authoritative catalogue of the four fictional industry demonstration companies
 * exposed in the public Deku Learn Centre.
 *
 * Notice: No user credentials, database provisioning, or login sessions are required.
 * Reconciled sample datasets run cleanly inside the frontend Learn Demo workspace.
 */

export type DemoCompanySlug =
  | "aster-trading"
  | "northstar-consulting"
  | "urbannest-retail"
  | "meridian-retail";

export type DemoPlanTier = "go" | "pro" | "enterprise";

export interface DemoCompanyTemplate {
  slug: DemoCompanySlug;
  industry: string;
  legalName: string;
  tradeName: string;
  gstin: string | null;
  stateCode: string;
  stateName: string;
  operatingMode: "gst" | "pure";
  recommendedPlan: DemoPlanTier;
  summary: string;
  keyModules: string[];
  workflowIds: string[];
  defaultLandingRoute: string;
  highlights: { label: string; value: string }[];
  disclosures?: string[];
}

export const DEMO_COMPANIES: DemoCompanyTemplate[] = [
  {
    slug: "aster-trading",
    industry: "Wholesale & Distribution",
    legalName: "Aster Trading Co. LLP",
    tradeName: "Aster Trading Co.",
    gstin: "27AAZFA0001A1Z2",
    stateCode: "27",
    stateName: "Maharashtra",
    operatingMode: "gst",
    recommendedPlan: "pro",
    summary:
      "B2B electrical and industrial hardware distributor buying from inter-state/intra-state suppliers, managing inventory, issuing GST tax invoices and credit notes, collecting payments, and reconciling bank statements.",
    keyModules: [
      "Parties & Masters",
      "Products & HSN/SAC",
      "Purchase Bills & ITC",
      "Inventory (FIFO)",
      "Sales Invoices & GST",
      "Credit / Debit Notes",
      "Customer Collections & Bank Recon",
      "Trial Balance, P&L & Balance Sheet",
    ],
    workflowIds: ["purchase-to-payment", "order-to-collection", "financial-close", "gst-compliance", "bank-reconciliation"],
    defaultLandingRoute: "/gateway",
    highlights: [
      { label: "Tax Regime", value: "Regular GST (Maharashtra)" },
      { label: "Primary Flow", value: "B2B Wholesale + Inventory" },
      { label: "Fictional GSTIN", value: "27AAZFA0001A1Z2 (Demo)" },
    ],
  },
  {
    slug: "northstar-consulting",
    industry: "Professional Services",
    legalName: "Northstar Consulting Private Limited",
    tradeName: "Northstar Consulting Pvt. Ltd.",
    gstin: "29AABCN0002B1ZC",
    stateCode: "29",
    stateName: "Karnataka",
    operatingMode: "gst",
    recommendedPlan: "pro",
    summary:
      "Advisory and technology consulting firm issuing quotations and proforma invoices, converting them to GST service invoices, tracking department budgets, running monthly payroll with privacy masking, and analysing profitability.",
    keyModules: [
      "Document Builder (Quotes & Proformas)",
      "Service Invoices (SAC 9983)",
      "Expense Vouchers & Approvals",
      "Departments & Budgets",
      "Confidential Payroll Run",
      "AR Ageing & Collections",
      "FP&A & Cash Flow",
      "Deku Consultant",
    ],
    workflowIds: ["order-to-collection", "team-governance", "financial-close", "financial-intelligence"],
    defaultLandingRoute: "/gateway",
    highlights: [
      { label: "Tax Regime", value: "Regular GST (Karnataka)" },
      { label: "Primary Flow", value: "Quotes → Service Invoices + Payroll" },
      { label: "Fictional GSTIN", value: "29AABCN0002B1ZC (Demo)" },
    ],
    disclosures: [
      "Focuses on quotes, proformas, service billing, department budgets, payroll, and profitability; standalone timesheet/PM tracking is not part of Deku ERP.",
    ],
  },
  {
    slug: "urbannest-retail",
    industry: "D2C & E-Commerce",
    legalName: "UrbanNest Retail Private Limited",
    tradeName: "UrbanNest Retail Pvt. Ltd.",
    gstin: "07AABCU0003C1Z8",
    stateCode: "07",
    stateName: "Delhi",
    operatingMode: "gst",
    recommendedPlan: "enterprise",
    summary:
      "Home & lifestyle D2C brand selling across direct online orders and marketplace channels, importing marketplace settlement files, splitting commissions and TCS (Sec 52 / ECO Table 3.1.1), and tracking FIFO inventory.",
    keyModules: [
      "SKU Catalogue & Inventory",
      "D2C Sales Invoices",
      "Marketplace Settlement Parser",
      "Commission, Fees & TCS Ledger Splits",
      "Payment Reconciliation",
      "GSTR-1 & GSTR-3B JSON",
      "Cash Flow & Profitability",
    ],
    workflowIds: ["marketplace-settlement", "order-to-collection", "gst-compliance", "financial-intelligence"],
    defaultLandingRoute: "/gateway",
    highlights: [
      { label: "Tax Regime", value: "Regular GST (Delhi)" },
      { label: "Primary Flow", value: "D2C SKUs + Marketplace ECO" },
      { label: "Fictional GSTIN", value: "07AABCU0003C1Z8 (Demo)" },
    ],
  },
  {
    slug: "meridian-retail",
    industry: "Retail & Multi-Warehouse",
    legalName: "Meridian Retail Private Limited",
    tradeName: "Meridian Retail Pvt. Ltd.",
    gstin: "27AABCM0004D1ZB",
    stateCode: "27",
    stateName: "Maharashtra",
    operatingMode: "gst",
    recommendedPlan: "enterprise",
    summary:
      "Multi-godown consumer goods retailer maintaining stock across regional warehouses, recording stock adjustments and purchase receipts, issuing GST retail/B2B bills and credit notes, and reconciling bank accounts.",
    keyModules: [
      "Multi-Warehouse Masters",
      "Opening Stock & Warehouse Adjustments",
      "FIFO Stock Valuation per Warehouse",
      "Purchases & Sales GST Billing",
      "Credit Notes (Sales Returns)",
      "Bank Reconciliation",
      "Financial Statements",
    ],
    workflowIds: ["purchase-to-payment", "order-to-collection", "bank-reconciliation", "financial-close"],
    defaultLandingRoute: "/gateway",
    highlights: [
      { label: "Tax Regime", value: "Regular GST (Maharashtra)" },
      { label: "Primary Flow", value: "Multi-Warehouse Stock + GST Billing" },
      { label: "Fictional GSTIN", value: "27AABCM0004D1ZB (Demo)" },
    ],
    disclosures: [
      "Supports multi-warehouse FIFO stock tracking and warehouse-specific adjustments; sales invoices deduct stock from the active default warehouse.",
    ],
  },
];

export function getDemoCompany(slug: string | null | undefined): DemoCompanyTemplate | undefined {
  return DEMO_COMPANIES.find((c) => c.slug === slug);
}
