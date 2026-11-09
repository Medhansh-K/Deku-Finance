"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Receipt,
  Scale,
  QrCode,
  FileSpreadsheet,
  FileCheck2,
  Sparkles,
  Clock,
  Send,
  Lock,
  Landmark,
  Smartphone,
  Check,
  AlertTriangle,
  FileCode,
} from "lucide-react";
import { DekuLogo } from "@/components/ui/DekuLogo";

export default function LandingBentoGrid() {
  const [activeMode, setActiveMode] = useState<"non_gst" | "gst">("non_gst");
  const [activeVoucherKey, setActiveVoucherKey] = useState<string>("F8");

  const voucherKeys = [
    { key: "F4", label: "Contra", type: "Bank ⇄ Cash Transfer", desc: "Internal cash deposits and inter-bank transfers." },
    { key: "F5", label: "Payment", type: "Outflow Disbursement", desc: "Vendor settlements, rent, bills & expense payouts." },
    { key: "F6", label: "Receipt", type: "Inward Cash / UPI", desc: "Customer receivables, advances & inward settlements." },
    { key: "F7", label: "Journal", type: "Adjustment Entry", desc: "Depreciation, month-end adjustments & tax provisions." },
    { key: "F8", label: "Sales", type: "Tax / Supply Invoice", desc: "B2B / B2C sales with auto POS, CGST/SGST/IGST & QR." },
    { key: "F9", label: "Purchase", type: "Input Tax Credit (ITC)", desc: "Vendor bills with 17(5) blocked ITC classification." },
  ];

  const currentVoucher = voucherKeys.find((v) => v.key === activeVoucherKey) || voucherKeys[4];

  return (
    <section id="features" className="py-24 bg-canvas border-b border-line-strong scroll-mt-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-1.5 text-xs font-mono font-bold text-white border border-edge shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>High-Precision Financial Operating System</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink">
            Engineered for Frictionless Indian Business
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            Explore Deku Finance’s modular bento architecture — from Section 22 CGST exemption safeguards to lightning-fast keyboard-first ledger postings.
          </p>
        </div>

        {/* Bento Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

          {/* ========================================================================= */}
          {/* BENTO 1: DUAL-MODE STATUTORY ENGINE (Span 7) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 hover:border-brand/60 shadow-xs hover:shadow-xl transition-all duration-300 p-7 sm:p-8 flex flex-col justify-between group overflow-hidden relative">
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-brand/10 text-brand-strong border border-brand/20">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Statutory Architecture
                </span>
                <span className="text-xs font-mono text-slate-500">Dual-Mode Kernel</span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-ink">
                  Dual-Mode Engine: Pure Accounting ⇄ GST Registered
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Operate 100% tax-free under <strong>Section 22 CGST Act</strong> without fake GST numbers, or seamlessly toggle to GST Registered mode with automated CGST, SGST, IGST tax breakdown.
                </p>
              </div>

              {/* Interactive Mode Switcher Simulation */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
                  <button
                    type="button"
                    onClick={() => setActiveMode("non_gst")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      activeMode === "non_gst"
                        ? "bg-white text-ink shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-ink"
                    }`}
                  >
                    <Check className={`h-3.5 w-3.5 ${activeMode === "non_gst" ? "text-emerald-600" : "opacity-0"}`} />
                    <span>Pure Accounting (Sec 22)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode("gst")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      activeMode === "gst"
                        ? "bg-white text-ink shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-ink"
                    }`}
                  >
                    <Check className={`h-3.5 w-3.5 ${activeMode === "gst" ? "text-brand" : "opacity-0"}`} />
                    <span>GST Registered (Enterprise)</span>
                  </button>
                </div>

                {/* Live Mode Preview Box */}
                <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200 text-xs space-y-3 font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Document Issued:</span>
                    <strong className="text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {activeMode === "non_gst" ? "Bill of Supply (Under Sec 22 CGST Act)" : "Tax Invoice (GST Rule 46)"}
                    </strong>
                  </div>

                  {/* Turnover Exemption Meter */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600">Turnover Exemption Meter:</span>
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {activeMode === "non_gst" ? "₹18,40,000 / ₹20,00,000 (92%)" : "Exemption Lifted (GSTIN Active)"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          activeMode === "non_gst" ? "w-[92%] bg-gradient-to-r from-emerald-500 to-amber-500" : "w-full bg-brand"
                        }`}
                      />
                    </div>
                    {activeMode === "non_gst" && (
                      <p className="text-[10px] text-amber-600 font-sans">
                        ⚠️ 92% of statutory ceiling reached. One-click upgrade ready when crossing ₹20L/₹40L threshold.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-brand-strong">
              <Link href="/features" className="inline-flex items-center gap-1.5 hover:text-brand transition-colors">
                <span>View Dual-Mode Architecture Spec</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-slate-400 font-mono text-[11px]">Zero GSTIN Lock-In</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BENTO 2: ALERX 4-TIER DOUBLE-ENTRY TREE (Span 5) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 bg-panel-deep text-white rounded-3xl border border-edge hover:border-brand/60 shadow-xs hover:shadow-xl transition-all duration-300 p-7 sm:p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-brand/20 text-brand-soft border border-brand/30">
                  <Scale className="h-3.5 w-3.5" />
                  Indian GAAP
                </span>
                <span className="text-xs font-mono text-slate-400">ALERX Core</span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  ALERX 4-Tier Mathematical Balance
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                  Assets, Liabilities, Equity, Revenue, Expense. Strict hierarchical posting guard ensures transactions commit only to transacting leaf Labels.
                </p>
              </div>

              {/* Hierarchy Tree Visualization */}
              <div className="rounded-2xl p-4 bg-panel/90 border border-edge text-xs font-mono space-y-2 mt-4">
                <div className="flex items-center justify-between pb-2 border-b border-edge text-[11px] text-slate-400">
                  <span>CHART OF ACCOUNTS TREE</span>
                  <span className="text-brand text-[10px]">ATOMIC TRIGGER GUARD</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="text-brand-soft font-bold flex items-center gap-1.5">
                    <span className="text-slate-500">1.</span> [A] Assets (Master Group)
                  </div>
                  <div className="pl-4 text-slate-300 flex items-center gap-1.5">
                    <span className="text-slate-600">└──</span> Current Assets (Ledger)
                  </div>
                  <div className="pl-8 text-slate-400 flex items-center gap-1.5">
                    <span className="text-slate-600">└──</span> Bank Accounts (Sub-Ledger)
                  </div>
                  <div className="pl-12 text-emerald-400 font-bold flex items-center justify-between bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/40">
                    <span>└── HDFC Bank Current A/c (Leaf Label)</span>
                    <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded text-emerald-300">Active Leaf</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-edge flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Dr/Cr Parity:</span>
                  <span className="text-brand font-bold">Debit ₹1,24,500 = Credit ₹1,24,500</span>
                </div>
              </div>
            </div>

            <div className="pt-6 relative z-10 flex items-center justify-between text-xs font-semibold">
              <a href="#alerx" className="inline-flex items-center gap-1.5 text-brand hover:text-brand-soft transition-colors">
                <span>Explore Interactive ALERX Tree</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <span className="text-slate-400 font-mono text-[11px]">0.00 Ledger Drift</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BENTO 3: INSTANT BHARAT UPI QR ENGINE (Span 4) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 hover:border-brand/60 shadow-xs hover:shadow-xl transition-all duration-300 p-7 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <QrCode className="h-3.5 w-3.5" />
                  Instant Settlement
                </span>
                <Smartphone className="h-4 w-4 text-slate-400" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold text-ink">
                  Dynamic Bharat UPI QR on Every Bill
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Embed your verified UPI VPA into print-ready invoices. Customers scan using GPay, PhonePe, or Paytm with pre-filled amounts.
                </p>
              </div>

              {/* Simulated QR Code Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-4">
                <div className="h-16 w-16 bg-white rounded-xl border border-slate-300 p-1 flex items-center justify-center shrink-0 shadow-xs">
                  <QrCode className="h-12 w-12 text-slate-900" />
                </div>
                <div className="space-y-1 min-w-0 text-xs">
                  <div className="font-mono font-bold text-slate-900 truncate">merchant@okaxis</div>
                  <div className="text-emerald-700 font-bold text-sm">₹24,890.00</div>
                  <div className="text-[10px] text-slate-500 font-mono">Invoice #DK-2026-104</div>
                </div>
              </div>
            </div>

            <div className="pt-6 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Zero Merchant Discount Rate (0% MDR)</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BENTO 4: F4-F9 KEYBOARD VOUCHER MATRIX (Span 8) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 bg-panel rounded-3xl border border-edge hover:border-brand/60 shadow-xs hover:shadow-xl transition-all duration-300 p-7 sm:p-8 flex flex-col justify-between text-white relative overflow-hidden">
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-brand/20 text-brand-soft border border-brand/30">
                  <Zap className="h-3.5 w-3.5" />
                  Speed-of-Light Bookkeeping
                </span>
                <span className="text-xs font-mono text-slate-400">Desktop HUD Shortcuts</span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Keyboard-First Voucher Matrix (F4 to F9)
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                  Fly through hundreds of transactions without touching your mouse. Built for experienced Tally power-users and speed accountants.
                </p>
              </div>

              {/* Interactive Key Buttons Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
                {voucherKeys.map((v) => {
                  const isSelected = activeVoucherKey === v.key;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setActiveVoucherKey(v.key)}
                      className={`p-2.5 rounded-xl border text-left transition-all font-mono ${
                        isSelected
                          ? "bg-brand text-panel-deep border-brand font-bold shadow-md shadow-brand/20 scale-105"
                          : "bg-panel-raised text-slate-300 border-edge hover:border-brand/40"
                      }`}
                    >
                      <div className="text-sm font-black">{v.key}</div>
                      <div className="text-[11px] truncate mt-0.5">{v.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Active Key Explainer Box */}
              <div className="p-4 rounded-2xl bg-panel-raised border border-edge text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-mono text-brand font-bold flex items-center gap-2">
                    <span>{currentVoucher.key} Voucher: {currentVoucher.label}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({currentVoucher.type})</span>
                  </div>
                  <div className="text-slate-300 text-xs">{currentVoucher.desc}</div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 shrink-0">
                  <kbd className="px-2 py-1 rounded bg-panel-deep border border-edge text-brand-soft">Enter</kbd> Next Field
                  <kbd className="px-2 py-1 rounded bg-panel-deep border border-edge text-brand-soft">Ctrl+Enter</kbd> Save
                </div>
              </div>
            </div>

            <div className="pt-6 relative z-10 flex items-center justify-between text-xs font-semibold">
              <Link href="/vouchers" className="inline-flex items-center gap-1.5 text-brand hover:text-brand-soft transition-colors">
                <span>Launch Live Voucher Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-slate-400 font-mono text-[11px]">Alt+G Omni Gateway</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BENTO 5: OFFICIAL GSTR-3B & GSTR-1 OFFLINE JSON (Span 6) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 hover:border-brand/60 shadow-xs hover:shadow-xl transition-all duration-300 p-7 sm:p-8 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  GSTN Schema Validated
                </span>
                <span className="text-xs font-mono text-slate-400">1-Click JSON</span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-ink">
                  Direct GSTR-1 &amp; GSTR-3B Offline JSON
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Compiles Table 3.1 (Outward Supplies) and Table 4 (Eligible ITC) directly into the official GST Portal JSON format. Upload directly to gst.gov.in in under 60 seconds.
                </p>
              </div>

              {/* Mock Code Block */}
              <div className="rounded-2xl p-4 bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 space-y-1">
                <div className="text-slate-500 text-[10px]">// GSTN Official Offline Return Schema</div>
                <div>{"{"}</div>
                <div className="pl-4"><span className="text-slate-400">"gstin":</span> <span className="text-amber-300">"27AABCU9603R1ZM"</span>,</div>
                <div className="pl-4"><span className="text-slate-400">"fp":</span> <span className="text-amber-300">"112026"</span>,</div>
                <div className="pl-4"><span className="text-slate-400">"sec_3_1_taxable":</span> <span className="text-sky-300">1284500.00</span>,</div>
                <div className="pl-4"><span className="text-slate-400">"table_4_itc_eligible":</span> <span className="text-sky-300">231210.00</span></div>
                <div>{"}"}</div>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-brand-strong">
              <Link href="/gst-compliance" className="inline-flex items-center gap-1.5 hover:text-brand transition-colors">
                <span>View Full GST Compliance Flow</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-slate-400 font-mono text-[11px]">Zero Portal Manual Entry</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BENTO 6: MSME SAMADHAAN 45-DAY & WHATSAPP CHASER (Span 6) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 hover:border-brand/60 shadow-xs hover:shadow-xl transition-all duration-300 p-7 sm:p-8 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Clock className="h-3.5 w-3.5 text-emerald-700" />
                  Sec 43B(h) Audit Shield
                </span>
                <span className="text-xs font-mono text-slate-400">MSME Samadhaan</span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-ink">
                  MSME 45-Day Aging &amp; WhatsApp Collect
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Protect deductions under Section 43B(h). Automatically track 15/45-day overdue receivables and send WhatsApp reminders with direct UPI payment links.
                </p>
              </div>

              {/* Simulated WhatsApp Notification Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-emerald-700" />
                    Automated WhatsApp Payment Link
                  </span>
                  <span className="text-emerald-700 font-mono text-[10px]">Day 32 of 45 (Due Soon)</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-slate-700 text-[11px] leading-relaxed shadow-xs">
                  "Dear Apex Corp, Invoice <strong>#DK-2026-084</strong> for <strong>₹48,000</strong> is due in 13 days under MSME Samadhaan guidelines. Tap below to settle instantly via UPI."
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    1-Click WhatsApp Delivery
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Real-time Read Receipts</span>
                </div>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-emerald-800">
              <Link href="/collect" className="inline-flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                <span>Explore Collections Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-slate-400 font-mono text-[11px]">Zero Delayed Debt</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BENTO 7: MAKER-CHECKER & DUAL LOCKER SECURITY (Span 12 / Footer Strip) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-12 bg-gradient-to-r from-panel via-panel-deep to-panel rounded-3xl border border-edge p-7 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-2 max-w-2xl relative z-10">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-brand-soft border border-brand/30">
                  <Lock className="h-3 w-3 text-brand" />
                  Dual-Gate Governance
                </span>
                <span className="text-xs text-slate-400 font-mono">DigiLocker &amp; EntityLocker KYC</span>
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-white">
                Enterprise Maker-Checker Authorization &amp; Statutory Identity
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Subordinate clerks draft vouchers; only authorized business owners or CFOs commit entries to the general ledger. Verify legal identities via Aadhaar DigiLocker, PAN and Udyam registrations.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 relative z-10">
              <Link
                href="/approvals"
                className="px-5 py-3 rounded-xl bg-brand hover:bg-brand-soft text-panel-deep font-bold text-xs transition-transform hover:scale-105 active:scale-95 shadow-md flex items-center gap-2"
              >
                <span>View Approvals Queue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/kyc"
                className="px-5 py-3 rounded-xl bg-panel-raised hover:bg-panel border border-edge text-white font-medium text-xs transition-colors"
              >
                <span>KYC Identity Hub</span>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

