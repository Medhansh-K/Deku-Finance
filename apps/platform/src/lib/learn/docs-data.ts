/**
 * Structured, version-controlled Documentation Centre catalogue covering all 8 manual categories.
 * Avoids relying on any unpersisted admin store while giving complete cross-linking into the
 * Interactive Demo and guided workflows.
 */

import type { DemoCompanySlug } from "./companies";

export type DocCategorySlug =
  | "getting-started"
  | "accounting"
  | "operations"
  | "gst-compliance"
  | "roles-and-governance"
  | "financial-intelligence"
  | "plans-and-utilisation"
  | "technical";

export interface DocCategory {
  slug: DocCategorySlug;
  order: string;
  title: string;
  summary: string;
}

export interface DocSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: { tone: "info" | "warning" | "compliance"; title: string; body: string };
}

export interface DocDemoLink {
  label: string;
  companySlug: DemoCompanySlug;
  targetRoute: string;
  workflowHint?: string;
}

export interface DocArticle {
  slug: string;
  category: DocCategorySlug;
  title: string;
  summary: string;
  tags: string[];
  version: string;
  lastUpdated: string;
  readMinutes: number;
  demoLink?: DocDemoLink;
  relatedSlugs?: { category: DocCategorySlug; slug: string }[];
  sections: DocSection[];
}

export const DOC_CATEGORIES: DocCategory[] = [
  {
    slug: "getting-started",
    order: "01",
    title: "Getting Started",
    summary: "Introduction to Deku Financial OS, company setup, desktop Gateway navigation, keyboard shortcuts, and dual-mode GST vs Pure Accounting.",
  },
  {
    slug: "accounting",
    order: "02",
    title: "Financial & Accounting Manuals",
    summary: "ALERX 4-Tier Chart of Accounts, ledgers, voucher types (F4–F9), double-entry parity rules, Day Book, Trial Balance, P&L, Balance Sheet, and Cash Flow.",
  },
  {
    slug: "operations",
    order: "03",
    title: "Operational Manuals",
    summary: "Parties master, product catalogue, FIFO multi-warehouse inventory, sales, purchases, UPI/WhatsApp collections, bank reconciliation, payroll, marketplace, and Document Builder.",
  },
  {
    slug: "gst-compliance",
    order: "04",
    title: "GST & Compliance",
    summary: "Pure Accounting (Sec 22) vs GST Registered mode, CGST/SGST/IGST math, Input Tax Credit (Rule 88A & Sec 17(5)), GSTR-1 & GSTR-3B offline JSON, and GSP adapter seams.",
  },
  {
    slug: "roles-and-governance",
    order: "05",
    title: "Roles & Governance",
    summary: "The 7-role RBAC matrix (Owner to Viewer), permission enforcement across SQL RLS and Rust, Maker-Checker dual authorization, departments, and immutable audit trails.",
  },
  {
    slug: "financial-intelligence",
    order: "06",
    title: "Financial Intelligence",
    summary: "Financial statements, FP&A dashboards, Operating/Investing/Financing Cash Flow, DSO/DPO working capital metrics, and on-premise Deku Konsultant.",
  },
  {
    slug: "plans-and-utilisation",
    order: "07",
    title: "Plans & Utilisation",
    summary: "Understanding GO, PRO, and Enterprise capabilities, user seat tracking, monthly/annual invoice usage, feature entitlements, and single-tenant deployment scope.",
  },
  {
    slug: "technical",
    order: "08",
    title: "Technical Documentation",
    summary: "Core-Kernel-Shell architecture, Next.js App Router shell, Rust/Axum API layer, PostgreSQL 16 + PostgREST RLS tenancy, external integration seams, and Docker runtime.",
  },
];

export const DOC_ARTICLES: DocArticle[] = [
  // 01. Getting Started
  {
    slug: "introduction-to-deku",
    category: "getting-started",
    title: "Introduction to Deku Finance & Dual-Mode Architecture",
    summary: "How Deku unifies Indian GST billing, operational registers, and strict ALERX double-entry bookkeeping in one keyboard-first workspace.",
    tags: ["overview", "dual-mode", "sec-22", "gateway"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 4,
    demoLink: {
      label: "Open Aster Trading Co. in Interactive Demo",
      companySlug: "aster-trading",
      targetRoute: "/gateway",
    },
    relatedSlugs: [
      { category: "getting-started", slug: "gateway-and-keyboard-shortcuts" },
      { category: "accounting", slug: "alerx-chart-of-accounts" },
    ],
    sections: [
      {
        id: "what-is-deku",
        heading: "1. What Deku Finance Does",
        paragraphs: [
          "Deku Finance is an integrated accounting and operations ERP built for Indian businesses. Unlike standalone invoicing tools that create tax records disconnected from ledger balances, every posted commercial event in Deku—whether a sales invoice, purchase bill, payroll run, or marketplace settlement—generates a balanced double-entry journal inside the same database transaction.",
        ],
        bullets: [
          "Pure Accounting (Section 22 CGST Exempt) mode for sub-threshold businesses issuing commercial bills with Bharat UPI QR codes and tracking revenue against the ₹20L / ₹40L GST threshold.",
          "GST Registered mode for full CGST, SGST, and IGST computation, Input Tax Credit (ITC) registers, and GSTR-1 / GSTR-3B offline JSON generation.",
        ],
      },
      {
        id: "real-vs-simulated",
        heading: "2. What Runs Natively vs. Vendor-Configured Integrations",
        paragraphs: [
          "Accounting, inventory FIFO valuation, bank CSV reconciliation, offline GSTR-1/3B JSON exports, department budgets, payroll posting, and on-premise Deku Konsultant analytics run natively on the core stack.",
        ],
        callout: {
          tone: "info",
          title: "External Integration Transparency",
          body: "Direct GSP IRN/E-Way Bill/GST portal filing, DigiLocker/PAN KYC verification, and Razorpay OAuth payment links are architectural integration seams that require live provider credentials in production and remain strictly simulated inside the public Learn Demo.",
        },
      },
    ],
  },
  {
    slug: "gateway-and-keyboard-shortcuts",
    category: "getting-started",
    title: "Gateway Navigation & Unified Keyboard Shortcuts (F1–F11, Esc, Ctrl+K)",
    summary: "Move through Deku at Tally-inspired speed using function keys, single-letter Gateway hotkeys, and the Ctrl+K command palette.",
    tags: ["shortcuts", "gateway", "navigation", "f-keys"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 4,
    demoLink: {
      label: "Practice Navigation in the Gateway",
      companySlug: "aster-trading",
      targetRoute: "/gateway",
    },
    sections: [
      {
        id: "global-function-keys",
        heading: "1. Global Function Keys (F1–F11 & Esc)",
        paragraphs: [
          "When F-Keys mode is active in the top bar (and cursor focus is outside form inputs), function keys jump instantly across core workspaces:",
        ],
        bullets: [
          "F1: Executive Dashboard · F2: Deku Konsultant · F3: Vouchers Hub",
          "F4: Contra · F5: Payment · F6: Receipt · F7: Journal · F8: Sales · F9: Purchase",
          "F10: Bank Reconciliation · F11: File GST Return · Esc: Return to Gateway of Deku · Ctrl+K / Alt+G: Command Palette",
        ],
      },
      {
        id: "gateway-letters",
        heading: "2. Gateway Alphabet Hotkeys",
        paragraphs: [
          "While on the Gateway of Deku screen, pressing single letter keys opens individual menus directly (e.g., A for Chart of Accounts, P for Parties, I for Stock & Services, V for Vouchers, D for Day Book, B for Balance Sheet, O for P&L, T for Trial Balance, G for GST, M for Departments & Members, S for Settings).",
        ],
      },
    ],
  },

  // 02. Financial & Accounting Manuals
  {
    slug: "alerx-chart-of-accounts",
    category: "accounting",
    title: "ALERX 4-Tier Chart of Accounts & Double-Entry Rules",
    summary: "Understand how Assets, Liabilities, Equity, Revenue, and Expenses enforce balance parity inside PostgreSQL.",
    tags: ["alerx", "coa", "double-entry", "ledgers"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 5,
    demoLink: {
      label: "Inspect ALERX Chart of Accounts",
      companySlug: "aster-trading",
      targetRoute: "/masters/chart-of-accounts",
    },
    sections: [
      {
        id: "five-pillars",
        heading: "1. The ALERX Taxonomy",
        paragraphs: [
          "Every company starts with a seeded Indian GAAP Chart of Accounts grouped into five primary buckets: Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Revenue (4xxx), and Expenses (5xxx–6xxx). Group headers roll up child balances while only Postable Leaf accounts may appear on voucher lines.",
        ],
      },
      {
        id: "strict-parity",
        heading: "2. Mathematical Parity Enforcement (Σ Debits = Σ Credits)",
        paragraphs: [
          "Voucher numbers are assigned server-side using sequential locks. Before any draft journal transitions to posted status, database triggers verify that total debits equal total credits to the paise, fiscal period boundaries are open, and closed/locked dates cannot be altered.",
        ],
      },
    ],
  },
  {
    slug: "vouchers-and-day-book",
    category: "accounting",
    title: "Vouchers (F4–F9), Day Book & Trial Balance",
    summary: "Create Contra, Payment, Receipt, Journal, Sales, and Purchase vouchers, inspect drafts, and trace posted entries to the Day Book and Trial Balance.",
    tags: ["vouchers", "day-book", "trial-balance", "f4-f9"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 5,
    demoLink: {
      label: "Open Vouchers Desk in Aster Trading Co.",
      companySlug: "aster-trading",
      targetRoute: "/vouchers",
    },
    sections: [
      {
        id: "voucher-types",
        heading: "1. Voucher Taxonomy (F4 to F9)",
        paragraphs: [
          "Deku standardises the six core accounting voucher families across keyboard and mouse flows: Contra (F4 cash/bank internal moves), Payment (F5 outflows), Receipt (F6 inflows), Journal (F7 adjustments/accruals), Sales (F8), and Purchase (F9).",
        ],
      },
      {
        id: "lifecycle",
        heading: "2. Draft → Approval → Posted → Reversal",
        paragraphs: [
          "Unposted drafts can be edited in place and do not affect financial statements. Posted vouchers cannot be silently deleted; corrections happen via audited reversal entries that preserve the original voucher record.",
        ],
      },
    ],
  },

  // 03. Operational Manuals
  {
    slug: "sales-invoicing-and-collections",
    category: "operations",
    title: "Sales Invoices, Document Builder & Receivables Collection",
    summary: "Convert Quotations or Proformas to tax invoices, generate dynamic Bharat UPI QR codes, and follow up overdue bills via WhatsApp links.",
    tags: ["invoices", "builder", "upi", "whatsapp", "msme"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 6,
    demoLink: {
      label: "Explore Service Invoicing in Northstar Consulting",
      companySlug: "northstar-consulting",
      targetRoute: "/gst",
    },
    sections: [
      {
        id: "quote-to-invoice",
        heading: "1. From Quotation / Proforma to Issued Invoice",
        paragraphs: [
          "Using Document Builder (`/builder`), sales teams draft Quotations, Proforma Invoices, Purchase Orders, and Delivery Challans. Approved quotations or proformas convert into GST Tax Invoices without re-entering line items.",
        ],
      },
      {
        id: "atomic-issuance",
        heading: "2. Atomic Ledger & Stock Impact on Issue",
        paragraphs: [
          "Issuing a sales invoice posts Debit Accounts Receivable (1030), Credit Revenue (4xxx), and Credit Output CGST/SGST/IGST (2081–2083), and automatically creates outbound FIFO inventory movements for tracked goods.",
        ],
      },
      {
        id: "collect-and-msme",
        heading: "3. UPI QR & WhatsApp Payment Reminders",
        paragraphs: [
          "Invoices embed a Bharat UPI payment QR string using the company's verified VPA. The Collect desk highlights 15/30/45+ day receivables (flagging Section 43B(h) MSME timelines) and opens pre-filled `wa.me` links from the user's own browser—no automated server messaging is triggered.",
        ],
      },
    ],
  },
  {
    slug: "inventory-and-multi-warehouse",
    category: "operations",
    title: "Inventory, Warehouses & FIFO Valuation",
    summary: "Track goods across multiple warehouses with immutable stock movement logs and FIFO cost layers.",
    tags: ["inventory", "warehouses", "fifo", "cogs"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 5,
    demoLink: {
      label: "Open Multi-Warehouse Inventory in Meridian Retail",
      companySlug: "meridian-retail",
      targetRoute: "/inventory",
    },
    sections: [
      {
        id: "fifo-engine",
        heading: "1. Immutable Stock Movements & SQL FIFO",
        paragraphs: [
          "Stock balances in Deku are derived directly from immutable `stock_movements` records (`in` / `out`), priced using FIFO per `(item_id, warehouse_id)` so reported closing stock never drifts from movement history.",
        ],
      },
      {
        id: "warehouse-rules",
        heading: "2. Multi-Warehouse Scope",
        paragraphs: [
          "Organisations can create multiple warehouses and record opening balances or manual adjustments per warehouse. Automated invoice issuance deducts tracked goods from the organisation's designated default warehouse.",
        ],
      },
    ],
  },
  {
    slug: "banking-and-marketplace-recon",
    category: "operations",
    title: "Bank Reconciliation & E-Commerce Marketplace Settlements",
    summary: "Match CSV/OFX bank statements against ledger postings and split Amazon/Flipkart/Blinkit/Meesho settlements into commissions, fees, and TCS.",
    tags: ["banking", "reconciliation", "marketplace", "tcs"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 5,
    demoLink: {
      label: "Inspect Marketplace Recon in UrbanNest Retail",
      companySlug: "urbannest-retail",
      targetRoute: "/reconciliation",
    },
    sections: [
      {
        id: "bank-matching",
        heading: "1. Statement Import & Reconciliation",
        paragraphs: [
          "Upload CSV or OFX bank statements to auto-match against posted bank ledger transactions by date, amount, and reference. Unmatched lines stay visible for manual reconciliation or voucher creation.",
        ],
      },
      {
        id: "marketplace-splits",
        heading: "2. E-Commerce Settlement Splits (Section 52 TCS & ECO)",
        paragraphs: [
          "The Marketplace parser maps custom channel columns from Amazon, Flipkart, Blinkit, or Meesho sheets and posts gross sales, marketplace commissions, GST on fees, refunds, and TCS deductions transparently to their respective ledgers.",
        ],
      },
    ],
  },

  // 04. GST & Compliance
  {
    slug: "gst-pos-itc-and-returns",
    category: "gst-compliance",
    title: "GST Place of Supply, Input Tax Credit & Offline GSTR-1 / GSTR-3B JSON",
    summary: "How Deku computes intra-state vs inter-state GST, handles Rule 88A ITC set-off, and builds offline GSTN JSON files.",
    tags: ["gst", "gstr1", "gstr3b", "itc", "rule-88a", "gsp"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 6,
    demoLink: {
      label: "Inspect GSTR-1 & 3B Returns in Aster Trading Co.",
      companySlug: "aster-trading",
      targetRoute: "/gst/returns",
    },
    sections: [
      {
        id: "pos-rules",
        heading: "1. Place of Supply & Tax Splits",
        paragraphs: [
          "When supplier state matches customer Place of Supply, tax lines split equally into CGST and SGST. Cross-state supplies apply IGST automatically. GSTIN check digits are validated server-side before saving parties or invoices.",
        ],
      },
      {
        id: "itc-and-json",
        heading: "2. ITC Register & Offline JSON Export",
        paragraphs: [
          "Purchase bills separate eligible ITC from Section 17(5) blocked credits and compute Rule 88A set-offs cleanly. Deku exports verified GSTR-1 and GSTR-3B JSON schemas ready for manual upload on `gst.gov.in`.",
        ],
        callout: {
          tone: "compliance",
          title: "Direct GSP API Filing Disclosure",
          body: "Automated direct IRP (INV-01 IRN), NIC E-Way Bills, and OTP GST portal filing require configuring a live GSP provider. Inside the Learn Demo, GSP routes remain strictly simulated.",
        },
      },
    ],
  },

  // 05. Roles & Governance
  {
    slug: "seven-roles-and-maker-checker",
    category: "roles-and-governance",
    title: "The Seven-Role RBAC Matrix, Maker-Checker & Audit Trail",
    summary: "Understand permissions across Owner, CFO, Admin, Accountant, Analyst, Auditor, and Viewer—enforced by Postgres RLS and Rust APIs.",
    tags: ["rbac", "roles", "maker-checker", "audit", "governance"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 6,
    demoLink: {
      label: "Test Governance & Approvals in Northstar Consulting",
      companySlug: "northstar-consulting",
      targetRoute: "/approvals",
    },
    sections: [
      {
        id: "seven-roles",
        heading: "1. Formal Seven-Role Responsibility Matrix",
        paragraphs: [
          "Deku enforces role checks at UI, Rust route, RPC, and PostgreSQL Row-Level Security levels:",
        ],
        bullets: [
          "Owner: Root authority, licence & org settings, member/role assignment, approvals, and full ledger/payroll access.",
          "CFO: Final financial sign-off, voucher approvals, invitations, payroll runs, budgets, FP&A, and cash flow.",
          "Admin: Operations configuration, member invitations, department setup, payroll execution, and document management.",
          "Accountant: Party/Item masters, invoices, purchase bills, draft vouchers, GST returns, inventory, and bank reconciliation.",
          "Analyst: Read-only financial reporting, cash flow, FP&A ratios, DSO/DPO, and Deku Konsultant analytics.",
          "Auditor: Independent read-only review of audit logs, user activity trails, vouchers, and supporting files.",
          "Viewer: Passive stakeholder read-only visibility across permitted KPIs and financial statements.",
        ],
      },
      {
        id: "maker-checker",
        heading: "2. Maker-Checker Dual Authorization",
        paragraphs: [
          "When Maker-Checker approval rules are enabled, operational staff create draft vouchers that queue in `/approvals`. Only an authorised Owner, CFO, or Admin can approve and post them, writing immutable records to the audit log.",
        ],
      },
    ],
  },

  // 06. Financial Intelligence
  {
    slug: "reports-fpa-and-deku-konsultant",
    category: "financial-intelligence",
    title: "Financial Reports, FP&A Metrics & On-Premise Deku Konsultant",
    summary: "How Trial Balance, P&L, Balance Sheet, Cash Flow, AR/AP ageing, and Deku Konsultant compute figures directly from posted ledger lines.",
    tags: ["reports", "fpa", "konsultant", "cash-flow"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 5,
    demoLink: {
      label: "Open Deku Konsultant & FP&A in Northstar Consulting",
      companySlug: "northstar-consulting",
      targetRoute: "/consultant",
    },
    sections: [
      {
        id: "sql-grounding",
        heading: "1. Zero-Hallucination Deterministic Analytics",
        paragraphs: [
          "Deku Konsultant does not send private financial books to external third-party LLM APIs. Instead, the Rust backend calls database reporting RPCs (`get_fpa_corporate_metrics`, `get_cash_flow_statement`, `get_ar_ap_aging_analysis`, `budget_variance`) and formats deterministic answers grounded strictly in posted ledger figures (showing `–` when a metric has no data).",
        ],
      },
    ],
  },

  // 07. Plans & Utilisation
  {
    slug: "go-pro-enterprise-entitlements",
    category: "plans-and-utilisation",
    title: "GO, PRO & Enterprise Plans, Seat Limits & Entitlement Enforcement",
    summary: "Compare commercial tiers, see how invoice and seat limits are enforced, and learn what changes when switching plans inside the Interactive Demo.",
    tags: ["plans", "go", "pro", "enterprise", "seats", "limits"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 5,
    demoLink: {
      label: "Test Plan Switching Inside Demo Workspace",
      companySlug: "aster-trading",
      targetRoute: "/settings/license",
    },
    sections: [
      {
        id: "plan-tiers",
        heading: "1. Commercial Plan Summary",
        paragraphs: [
          "Deku commercial packages are structured across three annual contract tiers: GO (₹24,999/yr), PRO (₹49,999/yr), and Enterprise (₹1,19,999/yr).",
        ],
        bullets: [
          "GO: 2 user seats, up to 100 catalogue items, 2,000 bills/year, standard role access, Pure Accounting & standard GST summaries.",
          "PRO: 5 user seats, unlimited billing volume, offline GSTR-1/3B JSON exports, all 7 RBAC roles, Maker-Checker approvals, and bank CSV reconciliation.",
          "Enterprise: Unlimited seats, full AI CFO / 10-department scope, multi-warehouse inventory, marketplace settlement automation, and IRP/E-Way Bill integration readiness.",
        ],
      },
      {
        id: "demo-vs-single-org",
        heading: "2. Infrastructure Capabilities & Honest Disclosure",
        paragraphs: [
          "Features that depend on external contracts or infrastructure (dedicated single-tenant hosting, on-premise Docker/Cloud SQL deployment, live GSP e-invoicing, or Razorpay payment gateway webhooks) are explained transparently inside the Learn Demo rather than triggering real provisioning.",
        ],
      },
    ],
  },

  // 08. Technical Documentation
  {
    slug: "core-kernel-shell-architecture",
    category: "technical",
    title: "Core–Kernel–Shell Architecture, Rust API & Postgres RLS Tenancy",
    summary: "Technical reference covering Next.js 16 proxy authentication, Rust/Axum endpoints, PostgREST JWT switching, and demo session isolation.",
    tags: ["architecture", "rust", "postgres", "rls", "docker", "security"],
    version: "2.0",
    lastUpdated: "2026-11-10",
    readMinutes: 7,
    demoLink: {
      label: "Inspect Live Audit Logs in Demo",
      companySlug: "aster-trading",
      targetRoute: "/audit",
    },
    sections: [
      {
        id: "three-layers",
        heading: "1. Stack Overview",
        paragraphs: [
          "Browser traffic terminates at the Next.js 16 App Router (`frontend-platform`), which stores `deku_at` / `deku_rt` inside `httpOnly` cookies and proxies API requests via `/api/backend/*` to the Rust/Axum server (`backend-platform`). Rust executes statutory math, GST validations, and encryption before forwarding requests to PostgREST and PostgreSQL 16.",
        ],
      },
      {
        id: "security-and-isolation",
        heading: "2. Multi-Tenant & Public Demo Isolation",
        paragraphs: [
          "Every company row is scoped by `organisation_id` and guarded by PostgreSQL RLS helpers (`is_org_member`, `has_role`). Public Learn Demo sessions issue short-lived, demo-scoped tokens bound exclusively to ephemeral template-cloned organisations so anonymous visitors can never read each other's sessions or reach production tenants.",
        ],
      },
    ],
  },
];

export function getDocCategory(slug: string): DocCategory | undefined {
  return DOC_CATEGORIES.find((c) => c.slug === slug);
}

export function getArticlesForCategory(category: DocCategorySlug): DocArticle[] {
  return DOC_ARTICLES.filter((a) => a.category === category);
}

export function getDocArticle(category: string, slug: string): DocArticle | undefined {
  return DOC_ARTICLES.find((a) => a.category === category && a.slug === slug);
}

export function getAdjacentArticles(article: DocArticle): {
  prev: DocArticle | null;
  next: DocArticle | null;
} {
  const index = DOC_ARTICLES.findIndex(
    (a) => a.category === article.category && a.slug === article.slug
  );
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? DOC_ARTICLES[index - 1] : null,
    next: index < DOC_ARTICLES.length - 1 ? DOC_ARTICLES[index + 1] : null,
  };
}

export function searchDocArticles(query: string): DocArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return DOC_ARTICLES;
  return DOC_ARTICLES.filter((a) => {
    const haystack = [
      a.title,
      a.summary,
      ...a.tags,
      ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
