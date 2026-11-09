"use client";

import React from "react";
import Link from "next/link";
import {
  Check,
  Zap,
  Sparkles,
  QrCode,
  Sliders,
  ShieldCheck,
  Building2,
  UserCheck,
  Clock,
  ArrowRight,
  HelpCircle,
  FileCheck,
  FileText,
  Bot,
  Scale,
  Users,
  Server,
  Headphones,
  Lock,
} from "lucide-react";

export default function PricingPlansSection() {
  const plans = [
    {
      id: "go",
      name: "GO",
      tagline: "For freelancers, solo studios, and early-stage companies operating under Section 22 CGST exemption (< ₹20L/₹40L) or single GSTIN.",
      badge: "🌱 Essential Starter",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      price: 24999,
      priceFormatted: "24,999",
      billingPeriod: "/ year",
      contractNote: "Annual contract license • 1 Year Commitment",
      ctaText: "Get Started with GO",
      ctaHref: "/signup?plan=go",
      isPopular: false,
      highlights: [
        "Annual Contract License with dedicated deployment",
        "Pure Accounting Mode (Section 22 Exemption Tracker against ₹20L/₹40L)",
        "Standard Commercial Invoices & Bills of Supply",
        "Embedded Dynamic Bharat UPI QR Code on every bill",
        "ALERX 4-Tier Double-Entry General Ledger with mathematical parity",
        "Real-Time Balance Sheet, Profit & Loss, & Trial Balance",
        "Day Book & Cash/Bank Book with server-issued sequential voucher numbers",
        "Draft voucher editing & in-line review before posting",
        "2 User Seats (1 Admin + 1 Accountant)",
        "Standard Email & Help Centre support",
      ],
    },
    {
      id: "pro",
      name: "PRO",
      tagline: "For scaling SMEs, high-volume traders, and multi-user businesses requiring full statutory GST, ITC, and bank reconciliation.",
      badge: "⚡ Most Popular for Growth",
      badgeColor: "bg-brand/15 text-brand-soft border-brand/30",
      price: 49999,
      priceFormatted: "49,999",
      billingPeriod: "/ year",
      contractNote: "Annual contract license • Most Popular",
      ctaText: "Get Started with PRO",
      ctaHref: "/signup?plan=pro",
      isPopular: true,
      highlights: [
        "Everything in GO, plus unlimited invoicing volume",
        "Full Statutory GST Mode with real-time Place of Supply (POS) tax math",
        "GSTR-1 & GSTR-3B offline JSON exports ready for upload to gst.gov.in",
        "Input Tax Credit register: Section 17(5) blocked credit & Rule 88A set-off",
        "Bank Reconciliation engine: statement import, auto-match & discrepancy flags",
        "7-Role Maker-Checker RBAC: dual authorization for high-value vouchers",
        "Employee salary & compensation data privacy masking",
        "HSN/SAC master catalogue with product rate auto-fill",
        "5 User Seats with custom granular permissions",
        "Priority VIP Helpline & WhatsApp support (+91 7506461004)",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      tagline: "For multi-entity organizations, high-volume enterprises, and corporations requiring AI CFO automation and custom deployment.",
      badge: "🏢 Complete Enterprise Suite",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      price: 119999,
      priceFormatted: "1,19,999",
      billingPeriod: "/ year",
      contractNote: "Annual contract license • Custom SLA & Setup",
      ctaText: "Deploy Enterprise",
      ctaHref: "https://wa.me/917506461004?text=Hi%20Deku%20Finance%2C%20I%20would%20like%20to%20discuss%20the%20Enterprise%20Annual%20Contract%20License%20(₹1,19,999/yr)",
      isPopular: false,
      highlights: [
        "Everything in PRO, with multi-entity & multi-branch organization support",
        "Deku Consultant AI CFO: 10 Departments & 50 Automated Financial Workflows",
        "Direct IRP E-Invoicing (INV-01 with 64-char IRN hash & signed IRP QR)",
        "Automated NIC E-Way Bill generation with vehicle tracking",
        "Automated GSP (GST Suvidha Provider) & GST Portal API integration",
        "Marketplace Settlement Engine (Amazon, Flipkart, Blinkit, Meesho ECO Table 3.1.1)",
        "MSME 45-Day Payment Recovery (Section 43B(h) Income Tax Act statutory tracker)",
        "Payment Gateway Webhooks & Razorpay auto-split settlements",
        "Unlimited User Seats & dedicated cloud instance or on-prem deployment",
        "24/7 Dedicated Account Manager & chartered accountant onboarding SLA",
      ],
    },
  ];

  const featureBreakup = [
    {
      category: "1. Invoicing, Billing & Cash Collections",
      features: [
        {
          name: "Annual Invoicing Volume",
          description: "Number of commercial bills of supply, tax invoices, and credit/debit notes per year.",
          go: "Up to 2,000 bills / year",
          pro: "Unlimited bills / year",
          enterprise: "Unlimited (High-Throughput)",
        },
        {
          name: "Embedded Bharat UPI QR Code",
          description: "Dynamic Bharat UPI QR code pre-filled with exact amount and invoice reference for zero-fee instant settlement.",
          go: "Included (Standard Dynamic UPI)",
          pro: "Included (Dynamic UPI + Webhooks)",
          enterprise: "Included (Dynamic UPI + Multi-VPA Routing)",
        },
        {
          name: "Invoice Field Customizer & Metadata",
          description: "Configurable fields: PO Number, Vehicle Number, Transporter ID, Terms of Delivery, Dispatch details.",
          go: "Standard Fields (PO, Terms)",
          pro: "Advanced Field Customizer",
          enterprise: "Full White-Label Schema + Custom Attributes",
        },
        {
          name: "Master Products & Services Catalogue",
          description: "Pre-configured HSN/SAC master with unit of measurement (UOM) and linked revenue accounts.",
          go: "Up to 100 items",
          pro: "Unlimited Catalogue Items",
          enterprise: "Unlimited + Multi-Warehouse Inventory",
        },
        {
          name: "MSME 45-Day Payment Recovery (Sec 43B(h))",
          description: "Automated tracking of buyer settlement timelines under Section 43B(h) with WhatsApp payment follow-up triggers.",
          go: "Manual WhatsApp Trigger",
          pro: "Automated Aging Alerts + WhatsApp",
          enterprise: "Full Statutory Interest Calculator + Auto Recovery Workflows",
        },
        {
          name: "Marketplace Settlement Engine (Section 14 ECO)",
          description: "Parse and reconcile bulk settlement sheets from Amazon, Flipkart, Blinkit, and Meesho into Table 3.1.1 ledgers.",
          go: "Manual Journal Entry",
          pro: "CSV Marketplace Sheet Parser",
          enterprise: "Automated Multi-Channel Marketplace Reconciliation",
        },
      ],
    },
    {
      category: "2. GST & Statutory Compliance Engine",
      features: [
        {
          name: "Section 22 Non-GST Pure Accounting Mode",
          description: "Legally compliant non-GST operations with zero tax overhead under Section 22 of the CGST Act.",
          go: "✓ Full Support",
          pro: "✓ Full Support",
          enterprise: "✓ Full Support (Multi-Branch Non-GST/GST)",
        },
        {
          name: "Turnover Exemption Tracker",
          description: "Real-time visual monitoring against the ₹20L/₹40L statutory registration thresholds.",
          go: "✓ Included (Live Gauge)",
          pro: "✓ Included (Live Gauge)",
          enterprise: "✓ Multi-GSTIN Consolidated Turnover Monitor",
        },
        {
          name: "Statutory Tax Math & Place of Supply (POS)",
          description: "Automatic intra-state (CGST+SGST) vs inter-state (IGST) tax calculation and GSTIN check digit verification.",
          go: "Basic Intra/Inter-State Split",
          pro: "Full POS Rule Engine + Check Digit Validator",
          enterprise: "Full POS Engine + Multi-State Reverse Charge & SEZ",
        },
        {
          name: "GSTR-1 & GSTR-3B Offline JSON Export",
          description: "GSTN-validated offline JSON files ready to upload straight into the government portal (gst.gov.in).",
          go: "Standard Tax Summary View",
          pro: "1-Click Direct GSTN Offline JSON",
          enterprise: "1-Click Direct JSON + Direct GSP API Filing",
        },
        {
          name: "Input Tax Credit (ITC) Register & Rule 88A",
          description: "Separation of eligible vs Section 17(5) blocked credit, with automated Rule 88A optimal set-off computation.",
          go: "Basic Purchase Register",
          pro: "Rule 88A Set-off + Sec 17(5) Blocked ITC",
          enterprise: "Full GSTR-2B Auto-Recon + Automated Dispute Notices",
        },
        {
          name: "IRP E-Invoicing (INV-01) & E-Way Bills",
          description: "Direct generation of 64-character IRN hashes, digitally signed IRP QR codes, and NIC E-Way bills.",
          go: "Optional Manual Entry",
          pro: "JSON Export for Offline NIC Tools",
          enterprise: "Direct Automated IRP API & NIC E-Way Generation",
        },
      ],
    },
    {
      category: "3. ALERX Double-Entry Accounting & Ledger Engine",
      features: [
        {
          name: "4-Tier ALERX Chart of Accounts",
          description: "Rigorous database trigger enforcement across Account Group ➔ Ledger ➔ Sub-Ledger ➔ Leaf Label.",
          go: "Standard 25 GAAP Accounts",
          pro: "Custom Hierarchy & Sub-Ledgers",
          enterprise: "Multi-Entity Custom Chart of Accounts",
        },
        {
          name: "Mathematical Parity Enforcement (Σ Dr = Σ Cr)",
          description: "PostgreSQL trigger-level validation preventing unbalanced vouchers from ever entering the day book.",
          go: "✓ Strict Parity Enforced",
          pro: "✓ Strict Parity Enforced",
          enterprise: "✓ Strict Parity Enforced + Inter-Company Balancing",
        },
        {
          name: "Server-Issued Sequential Voucher Numbers",
          description: "PostgreSQL sequence-driven numbering ensuring gapless, tamper-free financial records.",
          go: "✓ Included",
          pro: "✓ Included",
          enterprise: "✓ Multi-Branch Prefix Sequences",
        },
        {
          name: "Draft Voucher Review & In-Line Editing",
          description: "Modify draft vouchers before final posting without leaving orphaned audit entries.",
          go: "✓ Included",
          pro: "✓ Included",
          enterprise: "✓ Included with Multi-Level Draft Approvals",
        },
        {
          name: "Bank Reconciliation & Statement Import",
          description: "Upload bank statements (CSV/Excel) and automatically match transactions against ledger entries.",
          go: "Manual Cash/Bank Matching",
          pro: "Automated Statement Match Engine",
          enterprise: "Auto Match Engine + Direct Bank Feed API (ICICI/HDFC)",
        },
        {
          name: "General Ledger Account Drill-Down & CSV Export",
          description: "Full transaction history per account with running balances, opening/closing figures, and CSV export.",
          go: "Standard Account View",
          pro: "Full Account Drill-Down + CSV",
          enterprise: "Full Drill-Down + Custom Date Range CSV/Excel/API",
        },
      ],
    },
    {
      category: "4. Financial Intelligence & AI CFO (Deku Consultant)",
      features: [
        {
          name: "Real-Time Balance Sheet & Profit and Loss",
          description: "Instantly computed financial statements driven directly by verified double-entry balances.",
          go: "✓ Real-Time BS & P&L",
          pro: "✓ Real-Time BS & P&L + Custom Date Range",
          enterprise: "✓ Real-Time Consolidated Multi-Branch Statements",
        },
        {
          name: "Trial Balance & Financial Ratio Analysis",
          description: "Instant trial balance verification and key ratios (Current, Quick, Debt-to-Equity, Net Margin).",
          go: "Standard Trial Balance",
          pro: "Trial Balance + Core Financial Ratios",
          enterprise: "Trial Balance + Comprehensive Ratio & Solvency Dashboard",
        },
        {
          name: "Deku Consultant AI CFO Intelligence",
          description: "Autonomous financial intelligence engine across 10 corporate departments with 50 automated financial workflows.",
          go: "Basic Health Insights",
          pro: "3 Core Departments (FP&A, Cash, Opex)",
          enterprise: "Full 10 Departments / 50 Workflows (Working Capital, Taxes, Audit, Forecasts)",
        },
        {
          name: "Cash Flow Statement (Operating, Investing, Financing)",
          description: "Classified cash flow analysis identifying liquidity velocity and burn rate.",
          go: "Basic Cash Inflow/Outflow",
          pro: "Standard 3-Pillar Cash Flow Statement",
          enterprise: "Advanced Cash Flow Forecast + Runway Simulation",
        },
      ],
    },
    {
      category: "5. Governance, Security & Deployment",
      features: [
        {
          name: "User Seats Included",
          description: "Number of concurrent team members, accountants, and administrators allowed on the workspace.",
          go: "2 Seats (1 Admin + 1 Accountant)",
          pro: "5 Seats (Custom Permissions)",
          enterprise: "Unlimited Seats",
        },
        {
          name: "Role-Based Access Control (RBAC)",
          description: "Pre-built roles: Owner, Admin, Accountant, Approver, Cashier, Auditor, Viewer.",
          go: "2 Standard Roles",
          pro: "7 Pre-Built Roles",
          enterprise: "Custom Granular Roles + Department-Level Scoping",
        },
        {
          name: "Maker-Checker Dual Authorization",
          description: "High-value vouchers require approval by a second authorized user before posting to the ledger.",
          go: "Single Operator Direct Post",
          pro: "Maker-Checker for Journals & Payments",
          enterprise: "Multi-Tier Maker-Checker with Threshold Workflows",
        },
        {
          name: "Employee Salary & Payroll Privacy",
          description: "Cryptographic masking of employee payroll entries to prevent unauthorized internal salary leaks.",
          go: "Standard Access",
          pro: "✓ Confidential Payroll Masking",
          enterprise: "✓ Confidential Payroll Masking + Automated Journal Posting",
        },
        {
          name: "Append-Only SHA-256 Audit Trail",
          description: "Cryptographically verified, tamper-evident record of all system events, logins, and approvals.",
          go: "Basic Activity Log",
          pro: "Full SHA-256 Tamper-Evident Trail",
          enterprise: "Enterprise Audit Trail with External Log Forwarding",
        },
        {
          name: "Deployment Architecture",
          description: "Hosting model and server infrastructure options.",
          go: "Shared Multi-Tenant Cloud",
          pro: "Dedicated Virtual Cloud Tenant",
          enterprise: "Dedicated Single-Tenant Instance / On-Prem / Local Docker",
        },
        {
          name: "Support SLA & Assistance",
          description: "Turnaround time and channels for technical and accounting assistance.",
          go: "Email + Help Centre (48h SLA)",
          pro: "VIP Helpline + WhatsApp (+91 7506461004) (12h SLA)",
          enterprise: "24/7 Dedicated Account Manager & CA Onboarding SLA (2h SLA)",
        },
      ],
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-white text-slate-900 border-b border-line-strong scroll-mt-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-1.5 text-xs font-mono font-bold text-brand-soft border border-edge shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>Annual Contract-Based Licensing • 100% Transparent</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-ink">
            Predictable Plans,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-panel via-brand-strong to-brand">
              Annual Contract Pricing.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Deku Finance is licensed as an <strong>Annual Contract-Based License</strong>. Enjoy predictable, contract-backed software with dedicated deployment, statutory GST updates, and zero surprise transaction fees.
          </p>

          {/* Annual Contract Highlight Pill */}
          <div className="pt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>All licenses include 1-year statutory tax updates & dedicated single-tenant data isolation</span>
          </div>
        </div>

        {/* 3 Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative ${
                plan.isPopular
                  ? "bg-panel text-white border-2 border-brand shadow-2xl ring-4 ring-brand/10 lg:-translate-y-2"
                  : "bg-canvas text-slate-900 border border-slate-200 shadow-sm hover:shadow-md"
              }`}
            >
              {/* Badge */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${plan.badgeColor}`}
                >
                  {plan.badge}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    plan.isPopular
                      ? "text-brand-soft bg-brand/10 border-brand/30"
                      : "text-slate-600 bg-slate-100 border-slate-200"
                  }`}
                >
                  Annual License
                </span>
              </div>

              {/* Plan Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black tracking-tight">{plan.name}</h3>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-black/10 text-slate-400">
                    Tier {plan.id.toUpperCase()}
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed min-h-[48px] ${
                    plan.isPopular ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {plan.tagline}
                </p>

                {/* Pricing Box */}
                <div className="pt-3 pb-1 border-y border-slate-200/50 dark:border-edge/50">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold">₹</span>
                    <span className="text-4xl sm:text-5xl font-black tracking-tight font-mono">
                      {plan.priceFormatted}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        plan.isPopular ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {plan.billingPeriod}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] font-medium pt-1 ${
                      plan.isPopular ? "text-brand-soft" : "text-slate-500"
                    }`}
                  >
                    {plan.contractNote}
                  </p>
                </div>
              </div>

              {/* Feature Highlights List */}
              <div className="py-6 space-y-3 flex-1">
                <div
                  className={`text-xs font-mono font-bold uppercase tracking-wider ${
                    plan.isPopular ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Key Capabilities
                </div>
                <ul className="space-y-2.5 text-xs">
                  {plan.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div
                        className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          plan.isPopular
                            ? "bg-brand text-ink font-bold"
                            : "bg-emerald-500 text-white"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span
                        className={
                          plan.isPopular ? "text-slate-200" : "text-slate-700"
                        }
                      >
                        {h}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <div className="pt-4">
                <Link
                  href={plan.ctaHref}
                  className={`w-full py-3.5 px-6 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-md ${
                    plan.isPopular
                      ? "bg-brand hover:bg-brand-soft text-ink shadow-brand/20"
                      : "bg-panel hover:bg-panel-deep text-white border border-edge"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p
                  className={`text-center text-[10px] mt-2.5 ${
                    plan.isPopular ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {plan.id === "go" && "Instant setup in 60s • Section 22 Ready"}
                  {plan.id === "pro" && "Dedicated CA onboarding • GSTR-1 & 3B Included"}
                  {plan.id === "enterprise" && "Custom single-tenant deployment • 24/7 SLA"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Plan Feature Breakup Table (3 Columns) */}
        <div className="pt-10 space-y-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-ink-soft">
              Functional Capability Matrix
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-950">
              Comprehensive Module Comparison: GO vs PRO vs Enterprise
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
              Compare statutory compliance, ledger mechanics, AI CFO intelligence, and governance capabilities across all three annual licensing tiers.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead>
                  <tr className="bg-panel text-white text-[11px] font-bold uppercase tracking-wider border-b border-edge">
                    <th className="py-4 px-5 w-2/5">Capabilities & Module Specifications</th>
                    <th className="py-4 px-4 text-center w-1/5 bg-panel border-l border-edge">
                      GO (₹24,999/yr)
                      <span className="block text-[10px] text-emerald-400 font-normal lowercase font-mono">
                        (solo &amp; small business)
                      </span>
                    </th>
                    <th className="py-4 px-4 text-center w-1/5 text-brand-soft bg-panel-deep border-x border-edge">
                      PRO (₹49,999/yr)
                      <span className="block text-[10px] text-brand font-normal lowercase font-mono">
                        (scaling B2B &amp; GST)
                      </span>
                    </th>
                    <th className="py-4 px-4 text-center w-1/5 text-purple-300 bg-panel border-r border-edge">
                      Enterprise (₹1,19,999/yr)
                      <span className="block text-[10px] text-purple-400 font-normal lowercase font-mono">
                        (AI CFO &amp; multi-branch)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {featureBreakup.map((cat, catIdx) => (
                    <React.Fragment key={catIdx}>
                      {/* Category Header Row */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900">
                        <td colSpan={4} className="py-3 px-5 text-[11px] font-mono uppercase tracking-wider text-slate-700 bg-slate-100">
                          {cat.category}
                        </td>
                      </tr>

                      {/* Feature Item Rows */}
                      {cat.features.map((feat, fIdx) => (
                        <tr key={fIdx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-5">
                            <span className="font-bold text-slate-900 block">{feat.name}</span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">{feat.description}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium text-slate-700 bg-slate-50/50 border-l border-slate-200">
                            {feat.go}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-950 bg-brand/5 border-x border-slate-200">
                            {feat.pro}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-900 bg-purple-50/30 border-r border-slate-200">
                            {feat.enterprise}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Support Callout inside Breakup */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  All tiers feature strict ALERX double-entry parity ($\sum Dr - \sum Cr = 0$), tamper-evident audit logs, and zero password sharing.
                </span>
              </div>
              <div className="text-zinc-500 text-[11px]">
                Annual Licensing Desk &amp; Assistance: <strong>+91 7506461004</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
