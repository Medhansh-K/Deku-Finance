"use client";

import React, { useState } from "react";
import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import {
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Receipt,
  Scale,
  FileSpreadsheet,
  Users,
  Clock,
  Sparkles,
  ChevronRight,
  Lock,
  Landmark,
} from "lucide-react";

type FeatureTab = "dual_mode" | "alerx" | "vouchers" | "banking" | "reports" | "governance";

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<FeatureTab>("dual_mode");

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-brand/30 selection:text-ink">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-line-strong bg-gradient-to-b from-brand/10 via-canvas to-white">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-1.5 text-xs font-mono font-bold text-white border border-edge shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>Deku Platform Feature Matrix</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink max-w-4xl mx-auto leading-tight">
            Engineered for Indian Commerce.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-panel via-[#2F6B6B] to-brand">
              Powered by ALERX.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            From Section 22 CGST Act turnover exemptions to strict double-entry balance enforcers, explore every capability built into Deku Finance.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/gateway"
              className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-soft px-6 py-3 text-sm font-bold text-ink shadow-md shadow-brand/20 transition-all hover:scale-105 active:scale-95"
            >
              <Layers className="h-4 w-4" />
              <span>Open Desktop Gateway</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-xl bg-panel hover:bg-panel-deep border border-edge px-6 py-3 text-sm font-semibold text-white transition-all shadow-md"
            >
              <Zap className="h-4 w-4 text-brand" />
              <span>Explore Interactive Learn Hub</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Navigation Tabs */}
      <section className="sticky top-18 z-40 bg-white/95 backdrop-blur-md border-b border-line-strong py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: "dual_mode" as const, label: "Dual Modes", icon: Sparkles },
            { id: "alerx" as const, label: "ALERX Ledger", icon: Scale },
            { id: "vouchers" as const, label: "Voucher Suite (F4-F9)", icon: Receipt },
            { id: "banking" as const, label: "Bank Reconciliation", icon: Landmark },
            { id: "reports" as const, label: "Financial Reports", icon: FileSpreadsheet },
            { id: "governance" as const, label: "Governance & RBAC", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-panel text-white shadow-sm border border-edge"
                    : "text-slate-600 hover:text-ink hover:bg-slate-100"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-brand" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tabbed Feature Deep Dives */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ========================================================================= */}
        {/* Tab 1: Dual Operating Modes                                               */}
        {/* ========================================================================= */}
        {activeTab === "dual_mode" && (
          <div className="space-y-12 animate-fade-in">
            <div className="max-w-3xl">
              <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
                Regulatory Flexibility
              </span>
              <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
                Two Operating Modes. Zero Forced Overhead.
              </h2>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Most accounting packages force small businesses and freelancers into complex tax calculations from day one. Deku lets you start in Pure Accounting Mode under Section 22 of the CGST Act, and seamlessly scale to full GST Enterprise mode.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Mode A */}
              <div className="p-6 rounded-2xl border border-line-strong bg-surface shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-mono font-bold border border-blue-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Mode A: Pure Accounting Mode</span>
                  </div>
                  <h3 className="text-xl font-bold text-ink">Turnover Below ₹20L/₹40L Exemption</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Designed for freelancers, creative professionals, and micro-suppliers who are legally exempt from GST registration under Section 22 of the Central Goods &amp; Services Tax Act.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-700 pt-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Issues clean <strong>Bills of Supply &amp; Commercial Invoices</strong> with zero tax lines.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Embeds your verified <strong>Bharat UPI QR code</strong> for instant customer settlements.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Full double-entry books maintained for income tax and financial reporting.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-canvas-sunken rounded-xl border border-line text-[11px] text-ink-soft font-mono">
                  Statutory Rule: CGST Act 2017 Section 22 (1) — Registration threshold limit.
                </div>
              </div>

              {/* Mode B */}
              <div className="p-6 rounded-2xl border border-line-strong bg-surface shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-mono font-bold border border-emerald-300">
                    <Zap className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Mode B: GST Registered Enterprise Mode</span>
                  </div>
                  <h3 className="text-xl font-bold text-ink">B2B Commercial Tax Invoices</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Once your business crosses the turnover threshold or opts for voluntary registration, switch modes in one click to enable the complete statutory tax engine.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-700 pt-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Automatic <strong>Intra-State (CGST + SGST)</strong> vs <strong>Inter-State (IGST)</strong> splits.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>HSN (Goods) &amp; SAC (Services) catalog validation with statutory tax rates.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>1-click <strong>GSTR-1 &amp; GSTR-3B offline JSON</strong> exports ready for gst.gov.in.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-canvas-sunken rounded-xl border border-line text-[11px] text-ink-soft font-mono">
                  Future-Ready: Plug-and-play GSP API Bridge for instant e-Way Bill &amp; e-Invoicing (IRN).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 2: ALERX Ledger                                                      */}
        {/* ========================================================================= */}
        {activeTab === "alerx" && (
          <div className="space-y-12 animate-fade-in">
            <div className="max-w-3xl">
              <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
                Double-Entry Rigor
              </span>
              <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
                The ALERX 4-Tier Ledger Engine
              </h2>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Deku is not an invoice generator with a spreadsheet attached. It is built strictly on the classical ALERX double-entry hierarchy, enforcing mathematical debit-credit balance before any voucher can post.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { code: "1000", letter: "A", title: "Assets", desc: "What your business owns or is owed (Cash, Bank, Debtors, Inventory). Normal Balance: Debit." },
                { code: "2000", letter: "L", title: "Liabilities", desc: "What your business owes to suppliers, lenders, and GST authorities. Normal Balance: Credit." },
                { code: "3000", letter: "E", title: "Equity", desc: "Capital invested, retained earnings, and owner draws. Normal Balance: Credit." },
                { code: "4000", letter: "R", title: "Revenue", desc: "Operating income earned from invoices, consulting, and products. Normal Balance: Credit." },
                { code: "5000", letter: "X", title: "Expenses", desc: "Operating costs, rent, payroll, and processing fees. Normal Balance: Debit." },
              ].map((item) => (
                <div key={item.code} className="p-5 rounded-2xl border border-line-strong bg-surface shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="h-8 w-8 rounded-lg bg-panel text-brand-soft font-mono font-black flex items-center justify-center text-sm">
                      {item.letter}
                    </span>
                    <span className="text-[10px] font-mono text-ink-muted">Code {item.code}</span>
                  </div>
                  <h4 className="font-bold text-ink text-sm">{item.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-6 rounded-2xl border border-line-strong bg-canvas-sunken space-y-3">
              <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>The 4-Tier Hierarchy: Zero Accidental Postings</span>
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Deku divides accounts into: <strong>Group Header ➔ Ledger ➔ Sub-Ledger ➔ Postable Leaf</strong>. Vouchers can only post to leaf accounts. Group headers automatically compute mathematical sums in real-time, preventing orphaned journal records.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 3: Full Voucher Suite (F4-F9)                                         */}
        {/* ========================================================================= */}
        {activeTab === "vouchers" && (
          <div className="space-y-12 animate-fade-in">
            <div className="max-w-3xl">
              <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
                Keyboard-Driven Speed
              </span>
              <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
                The Complete Voucher Suite (F4 to F9)
              </h2>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Tally and ERP9 bookkeepers are the fastest typists in the world. Deku honors this speed with full function-key jumping, zero mouse dependency, and immediate balance validation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { fkey: "F4", name: "Contra Voucher", purpose: "Bank-to-cash deposits, ATM withdrawals, and inter-bank transfers with zero revenue impact." },
                { fkey: "F5", name: "Payment Voucher", purpose: "Vendor disbursements, expense payments, contractor fees, and office rent payouts." },
                { fkey: "F6", name: "Receipt Voucher", purpose: "Customer invoice settlements, Bharat UPI inbound collections, and sundry income." },
                { fkey: "F7", name: "Journal Voucher", purpose: "Non-cash adjustments, year-end provisions, asset depreciation, and period-closing accruals." },
                { fkey: "F8", name: "Sales Invoice", purpose: "Tax Invoices and Bills of Supply with automatic Trade Debtors (AR) ledger updates." },
                { fkey: "F9", name: "Purchase Bill", purpose: "Inward supplier bills, Input Tax Credit (ITC) tracking, and Trade Creditors (AP) logging." },
              ].map((v) => (
                <div key={v.fkey} className="p-5 rounded-xl border border-line-strong bg-surface shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-panel text-brand-soft border border-edge">
                      {v.fkey}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Standardized
                    </span>
                  </div>
                  <h4 className="font-bold text-ink text-sm">{v.name}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{v.purpose}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 4: Bank Reconciliation                                               */}
        {/* ========================================================================= */}
        {activeTab === "banking" && (
          <div className="space-y-12 animate-fade-in">
            <div className="max-w-3xl">
              <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
                Cash Certainty
              </span>
              <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
                Frictionless Bank Statement Reconciliation
              </h2>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Bank accounts in Deku are real double-entry ledgers under Code 1020. Never manually check off printed bank statements with a pencil again.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  1
                </div>
                <h4 className="font-bold text-ink text-base">Import Bank File</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Export statement directly from HDFC, ICICI, SBI, Axis, or Kotak in standard CSV or OFX format and drop it into Deku.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  2
                </div>
                <h4 className="font-bold text-ink text-base">Auto-Match Algorithms</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Deku compares transaction date windows, debit/credit values, and reference IDs with your posted receipts and payments.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
                <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  3
                </div>
                <h4 className="font-bold text-ink text-base">Zero-Variance Sign-Off</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Confirm matched lines in one batch. Generate an unallocated variance report and lock the reconciled period with zero discrepancies.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 5: Financial Reports                                                  */}
        {/* ========================================================================= */}
        {activeTab === "reports" && (
          <div className="space-y-12 animate-fade-in">
            <div className="max-w-3xl">
              <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
                Executive Clarity
              </span>
              <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
                Real-Time Financial Reports &amp; Registers
              </h2>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Financial statements in Deku are never pre-baked or cached out of date. Every report recomputes dynamically from the immutable posted voucher ledger.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: "Day Book (Chronological Log)", desc: "View every single transaction entered across your organization with instant date, voucher type, and party filters." },
                { title: "Trial Balance Equilibrium", desc: "Mathematical verification that total debits strictly equal total credits across all active accounts with zero variance." },
                { title: "Accrual-Based Profit & Loss", desc: "Live calculation of Gross Margin, Operating Expenses, and Net Profit formatted according to Indian accounting standards." },
                { title: "Asset-Liability Balance Sheet", desc: "Structured Schedule III statement of financial position showing Working Capital, Fixed Assets, and Net Worth." },
                { title: "Cash Flow (Working Capital Method)", desc: "Operating, investing, and financing cash flows showing exact liquidity movement across bank accounts." },
                { title: "Open Export Formats (Zero Lock-in)", desc: "Download full reports in clean Excel (.xlsx), CSV, and vector-crisp PDF for tax consultants and audits." },
              ].map((r) => (
                <div key={r.title} className="p-5 rounded-xl border border-line-strong bg-surface space-y-2">
                  <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{r.title}</span>
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed pl-6">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 6: Governance, Security & RBAC                                       */}
        {/* ========================================================================= */}
        {activeTab === "governance" && (
          <div className="space-y-12 animate-fade-in">
            <div className="max-w-3xl">
              <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
                Enterprise Integrity
              </span>
              <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
                Maker-Checker Authorization &amp; Data Isolation
              </h2>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Protect your company from internal accounting errors and unauthorized payouts with dual-gate approvals and strict role-based access control.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
                <div className="h-9 w-9 rounded-xl bg-panel text-brand-soft flex items-center justify-center font-bold">
                  <Users className="h-4 w-4 text-brand" />
                </div>
                <h4 className="font-bold text-ink text-base">Maker-Checker Protocol</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Accountants draft vouchers with attached receipts. The voucher remains uncommitted until an authorized Approver (Owner, CFO, or Admin) signs off.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
                <div className="h-9 w-9 rounded-xl bg-panel text-brand-soft flex items-center justify-center font-bold">
                  <Lock className="h-4 w-4 text-brand" />
                </div>
                <h4 className="font-bold text-ink text-base">Row-Level Security (RLS)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Database-level tenant isolation prevents any cross-organization leakage. Your financial books are strictly isolated from all other companies.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
                <div className="h-9 w-9 rounded-xl bg-panel text-brand-soft flex items-center justify-center font-bold">
                  <Clock className="h-4 w-4 text-brand" />
                </div>
                <h4 className="font-bold text-ink text-base">Immutable Audit Logs</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every user login, invoice creation, voucher reversal, and configuration change is recorded in an append-only cryptographic audit trail.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Interactive Learn Hub Callout Banner */}
      <section className="bg-panel text-white py-14 border-t border-edge">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-panel-raised px-4 py-1.5 text-xs font-mono text-brand border border-edge">
            <span>PUBLIC SANDBOX • ZERO REGISTRATION</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white max-w-2xl mx-auto">
            Test Every Feature in the Public Learn Centre
          </h2>

          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Follow hands-on, step-by-step tutorials across all 9 learning paths. No login, no credit card, and zero risk to real accounts.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-soft px-7 py-3.5 text-sm font-bold text-ink shadow-lg shadow-brand/20 transition-all hover:scale-105"
            >
              <Zap className="h-4 w-4 text-ink" />
              <span>Enter Public Learn Centre</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/gst-compliance"
              className="inline-flex items-center gap-2 rounded-xl bg-panel-raised hover:bg-panel border border-edge px-6 py-3.5 text-sm font-semibold text-white transition-all"
            >
              <span>Explore GST Architecture</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

