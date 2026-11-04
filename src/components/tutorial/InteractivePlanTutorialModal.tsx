"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Zap,
  Building,
  User,
  ShieldCheck,
  FileText,
  CreditCard,
  QrCode,
  ArrowRight,
  Sparkles,
  Bot,
  Scale,
  SlidersHorizontal,
  X,
  Loader2,
  HelpCircle,
  Layers,
  TrendingUp,
  Receipt,
  FileCheck,
  BadgeCheck,
} from "lucide-react";

export type PlanType = "freelancer" | "enterprise";
export type TutorialTab = "comparison" | "simulator" | "workflows" | "launch";

export interface InteractivePlanTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: PlanType;
  onLaunchDemo?: (type: "owner" | "freelancer") => Promise<void>;
  isLoadingDemo?: string | null;
}

export function InteractivePlanTutorialModal({
  isOpen,
  onClose,
  initialPlan = "enterprise",
  onLaunchDemo,
  isLoadingDemo = null,
}: InteractivePlanTutorialModalProps) {
  const [activeTab, setActiveTab] = useState<TutorialTab>("comparison");
  const [simulatorMode, setSimulatorMode] = useState<PlanType>(initialPlan);
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<number>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl rounded-3xl border border-edge bg-panel-deep shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 -mt-16 w-80 h-80 bg-brand/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-1/4 -mt-16 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-edge px-6 py-4.5 bg-panel/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Deku Finance · Interactive Plan & Architecture Guide
                </h2>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/20 text-brand border border-brand/30 uppercase tracking-wider">
                  Interactive Guide
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Understand the statutory, architectural, and workflow differences between plans before entering.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-panel-raised transition-colors"
            title="Close Tutorial (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Interactive Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-edge bg-panel/40 shrink-0 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab("comparison")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "comparison"
                ? "bg-brand text-panel-deep font-bold shadow-md shadow-brand/20"
                : "text-slate-400 hover:text-white hover:bg-panel-raised"
            }`}
          >
            <Scale className="h-4 w-4" />
            <span>1. Side-by-Side Comparison</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "simulator"
                ? "bg-brand text-panel-deep font-bold shadow-md shadow-brand/20"
                : "text-slate-400 hover:text-white hover:bg-panel-raised"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>2. Live Document Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab("workflows")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "workflows"
                ? "bg-brand text-panel-deep font-bold shadow-md shadow-brand/20"
                : "text-slate-400 hover:text-white hover:bg-panel-raised"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>3. Daily Workflow Tour</span>
          </button>

          <button
            onClick={() => setActiveTab("launch")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "launch"
                ? "bg-brand text-panel-deep font-bold shadow-md shadow-brand/20"
                : "text-slate-400 hover:text-white hover:bg-panel-raised"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>4. Explore Workspaces</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: SIDE-BY-SIDE COMPARISON */}
          {activeTab === "comparison" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* GO Freelancer Card */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <User className="h-3.5 w-3.5" />
                        GO Freelancer
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400/90 font-semibold">
                        Pure Accounting Mode
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      Section 22 Exemption & Solo Operator Simplicity
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Engineered for freelancers, consultants, and creators under the ₹20L/₹40L statutory turnover threshold. Eliminates GST compliance, CGST/SGST splits, and e-invoicing overhead while delivering authoritative ALERX financial statements.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
                    <span>Target: Solo & Small Traders</span>
                    <span className="font-bold">₹0 Statutory GST Liability</span>
                  </div>
                </div>

                {/* PRO Enterprise Card */}
                <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-brand/20 text-brand border border-brand/30">
                        <Building className="h-3.5 w-3.5" />
                        PRO Enterprise
                      </span>
                      <span className="text-[11px] font-mono text-brand font-semibold">
                        Full Statutory GST Mode
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      Full Statutory GST, E-Invoicing & Multi-User Governance
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Engineered for GST-registered SMEs, agencies, manufacturers, and enterprises. Features real-time Place of Supply tax math, IRP E-Invoicing (INV-01), E-Way bills, 7-role RBAC with Maker-Checker sign-offs, and Deku Consultant AI CFO.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-brand/20 flex items-center justify-between text-xs text-brand">
                    <span>Target: Growing Teams & Enterprises</span>
                    <span className="font-bold">Automated GSP / IRP / NIC Pipe</span>
                  </div>
                </div>
              </div>

              {/* Comprehensive Feature Comparison Matrix */}
              <div className="rounded-2xl border border-edge bg-panel/60 overflow-hidden">
                <div className="p-4 border-b border-edge bg-panel-raised/50 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Architectural & Statutory Capabilities Matrix
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Verified against PostgreSQL migrations 000–046
                  </span>
                </div>

                <div className="divide-y divide-edge text-xs">
                  {/* Row: Legal Framework */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Legal Statutory Rule</span>
                    </div>
                    <div className="col-span-4 text-emerald-400 font-medium">
                      GST Act Section 22 Exemption (Turnover &lt; ₹20L/₹40L)
                    </div>
                    <div className="col-span-4 text-brand font-medium">
                      Mandatory GST Registration (B2B Taxable Supplies)
                    </div>
                  </div>

                  {/* Row: Invoices Produced */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Invoices Produced</span>
                    </div>
                    <div className="col-span-4 text-slate-300">
                      <strong>Bills of Supply</strong> / Commercial Invoices with ₹0 Tax
                    </div>
                    <div className="col-span-4 text-slate-300">
                      <strong>Tax Invoices</strong> (B2B, B2C, Export, SEZ, Notes)
                    </div>
                  </div>

                  {/* Row: GST Tax Computation */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Tax Splits (CGST/SGST/IGST)</span>
                    </div>
                    <div className="col-span-4 text-slate-400 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-slate-500" />
                      <span>Disabled (Zero tax liability)</span>
                    </div>
                    <div className="col-span-4 text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Automatic Place of Supply (POS) rules</span>
                    </div>
                  </div>

                  {/* Row: E-Invoicing & E-Way Bills */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>E-Invoicing & E-Way Bills</span>
                    </div>
                    <div className="col-span-4 text-slate-400 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-slate-500" />
                      <span>Not applicable</span>
                    </div>
                    <div className="col-span-4 text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>IRP INV-01 IRN hash, signed QR &amp; NIC E-Way</span>
                    </div>
                  </div>

                  {/* Row: Governance & Maker-Checker */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Governance &amp; Controls</span>
                    </div>
                    <div className="col-span-4 text-slate-300">
                      Single-operator direct voucher posting
                    </div>
                    <div className="col-span-4 text-slate-300">
                      <strong>7-Role RBAC</strong> &amp; Maker-Checker dual sign-off
                    </div>
                  </div>

                  {/* Row: Double-Entry Ledger Engine */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Double-Entry Invariant</span>
                    </div>
                    <div className="col-span-4 text-emerald-400">
                      ALERX Core: <code className="text-[11px]">ΣDr = ΣCr</code>
                    </div>
                    <div className="col-span-4 text-emerald-400">
                      ALERX Core: <code className="text-[11px]">ΣDr = ΣCr</code>
                    </div>
                  </div>

                  {/* Row: Bank Reconciliation */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Banking Reconciliation</span>
                    </div>
                    <div className="col-span-4 text-slate-300">
                      Direct cash &amp; bank ledger tracker
                    </div>
                    <div className="col-span-4 text-slate-300">
                      Automated statement CSV matcher against journals
                    </div>
                  </div>

                  {/* Row: Payment Collection */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Payment Links &amp; UPI QR</span>
                    </div>
                    <div className="col-span-4 text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Dynamic Bharat UPI QR code on bills</span>
                    </div>
                    <div className="col-span-4 text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Razorpay links + webhook auto-reconciliation</span>
                    </div>
                  </div>

                  {/* Row: AI Financial Copilot */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                      <Bot className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Deku Consultant AI</span>
                    </div>
                    <div className="col-span-4 text-slate-300">
                      Invoice OCR &amp; basic financial prompts
                    </div>
                    <div className="col-span-4 text-brand font-semibold">
                      Full Virtual CFO: 10 Departments / 50 Workflows
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE INVOICE SIMULATOR */}
          {activeTab === "simulator" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Simulator Mode Switcher Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-edge bg-panel/80">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-brand" />
                    Interactive Invoice Simulator
                  </h4>
                  <p className="text-xs text-slate-400">
                    Toggle below to inspect how the exact same ₹50,000 transaction renders in each mode:
                  </p>
                </div>

                <div className="flex items-center p-1 bg-panel-deep rounded-xl border border-edge shrink-0">
                  <button
                    onClick={() => setSimulatorMode("freelancer")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      simulatorMode === "freelancer"
                        ? "bg-emerald-500 text-panel-deep shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>GO Freelancer Mode</span>
                  </button>

                  <button
                    onClick={() => setSimulatorMode("enterprise")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      simulatorMode === "enterprise"
                        ? "bg-brand text-panel-deep shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Building className="h-3.5 w-3.5" />
                    <span>PRO Enterprise Mode</span>
                  </button>
                </div>
              </div>

              {/* Rendered Invoice Mockup */}
              <div className="rounded-2xl border border-edge bg-panel p-6 space-y-6 shadow-xl">
                {/* Invoice Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-edge">
                  <div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 ${
                        simulatorMode === "freelancer"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-brand/20 text-brand border border-brand/30"
                      }`}
                    >
                      {simulatorMode === "freelancer"
                        ? "BILL OF SUPPLY"
                        : "TAX INVOICE (B2B)"}
                    </span>
                    <h3 className="text-xl font-black text-white">
                      {simulatorMode === "freelancer"
                        ? "Aarav Sharma · Digital Consulting"
                        : "Apex Technologies Private Limited"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {simulatorMode === "freelancer"
                        ? "PAN: ABCPS1234F · Composition / Exempt Supplier"
                        : "GSTIN: 27AABCU9603R1ZM · Maharashtra (State Code 27)"}
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <p className="text-xs text-slate-400">Invoice Number</p>
                    <p className="text-sm font-mono font-bold text-white">
                      {simulatorMode === "freelancer" ? "BOS-2026-042" : "INV-2026-089"}
                    </p>
                    <p className="text-xs text-slate-400">Date: 04 Nov 2026</p>
                    {simulatorMode === "enterprise" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                        IRN Verified · Signed
                      </span>
                    )}
                  </div>
                </div>

                {/* Counterparty & Statutory Rules */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-edge bg-panel-deep p-3.5 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-400">Billed To:</p>
                    <p className="font-bold text-white">Horizon Retail Partners</p>
                    <p className="text-slate-400">
                      {simulatorMode === "freelancer"
                        ? "Bengaluru, Karnataka (Client)"
                        : "GSTIN: 29AAACH1234E1Z5 · Karnataka (State Code 29)"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-edge bg-panel-deep p-3.5 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-400">Statutory Tax Treatment:</p>
                    {simulatorMode === "freelancer" ? (
                      <div className="space-y-0.5">
                        <p className="font-bold text-emerald-400">Section 22 Exemption Active</p>
                        <p className="text-[11px] text-slate-400">
                          Supplier turnover is below statutory limit. ₹0 GST collected.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="font-bold text-brand">Inter-State Supply (Place of Supply: 29)</p>
                        <p className="text-[11px] text-slate-400">
                          Supplier State 27 ≠ Buyer State 29 → 18% Integrated GST (IGST)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="rounded-xl border border-edge overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-panel-raised text-slate-400 border-b border-edge font-semibold">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Description</th>
                        {simulatorMode === "enterprise" && (
                          <th className="py-2.5 px-4 text-left">HSN/SAC</th>
                        )}
                        <th className="py-2.5 px-4 text-right">Qty</th>
                        <th className="py-2.5 px-4 text-right">Rate</th>
                        <th className="py-2.5 px-4 text-right">Taxable Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge">
                      <tr>
                        <td className="py-3 px-4 font-medium text-white">
                          Cloud Infrastructure & Financial Architecture Consulting
                        </td>
                        {simulatorMode === "enterprise" && (
                          <td className="py-3 px-4 text-slate-400 font-mono">998311</td>
                        )}
                        <td className="py-3 px-4 text-right text-slate-300">1</td>
                        <td className="py-3 px-4 text-right text-slate-300 font-mono">₹50,000</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          ₹50,000
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tax Calculation & Settlement Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Left: Settlement Info */}
                  <div className="rounded-xl border border-edge bg-panel-deep p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <QrCode className="h-4 w-4 text-brand" />
                      <span>Direct Payment Settlement</span>
                    </div>

                    {simulatorMode === "freelancer" ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Scan with Google Pay, PhonePe, Paytm, or BHIM. Funds land directly in your registered bank account.
                        </p>
                        <div className="p-2.5 rounded-lg bg-panel border border-edge flex items-center justify-between text-xs">
                          <span className="text-slate-400">UPI VPA:</span>
                          <span className="font-mono text-emerald-400 font-bold">aarav@okhdfcbank</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Integrated Razorpay checkout link with webhook auto-reconciliation directly to Bank Clearing Account 1110.
                        </p>
                        <div className="p-2.5 rounded-lg bg-panel border border-edge flex items-center justify-between text-xs">
                          <span className="text-slate-400">E-Way Bill:</span>
                          <span className="font-mono text-brand font-bold">EWB-2026-991204</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Calculations */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal (Taxable Value):</span>
                      <span className="font-mono text-white font-medium">₹50,000.00</span>
                    </div>

                    {simulatorMode === "freelancer" ? (
                      <div className="flex justify-between text-emerald-400 font-medium">
                        <span>GST (Sec 22 Exempted):</span>
                        <span className="font-mono">₹0.00</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-brand font-medium">
                          <span>18% Integrated GST (IGST):</span>
                          <span className="font-mono">+₹9,000.00</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>CGST (0%) / SGST (0%):</span>
                          <span className="font-mono">₹0.00</span>
                        </div>
                      </>
                    )}

                    <div className="border-t border-edge pt-2.5 flex justify-between items-center text-sm font-bold text-white">
                      <span>Total Amount Payable:</span>
                      <span className="font-mono text-base text-brand font-black">
                        {simulatorMode === "freelancer" ? "₹50,000.00" : "₹59,000.00"}
                      </span>
                    </div>

                    {/* Double-Entry Preview Badge */}
                    <div className="pt-2 text-[11px] text-slate-400 font-mono">
                      {simulatorMode === "freelancer" ? (
                        <span>Postings: Dr Bank/Receivable ₹50k · Cr Revenue ₹50k</span>
                      ) : (
                        <span>Postings: Dr AR ₹59k · Cr Revenue ₹50k · Cr IGST ₹9k</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DAILY WORKFLOW TOUR */}
          {activeTab === "workflows" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="text-center max-w-xl mx-auto space-y-1">
                <h3 className="text-base font-bold text-white">
                  How Daily Operations Flow in Each Plan
                </h3>
                <p className="text-xs text-slate-400">
                  Select a workflow step below to compare the operational sequence:
                </p>
              </div>

              {/* Step Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { step: 1, title: "1. Voucher Entry", icon: Receipt },
                  { step: 2, title: "2. Approvals & Rules", icon: ShieldCheck },
                  { step: 3, title: "3. Bank Reconciliation", icon: CreditCard },
                  { step: 4, title: "4. Month-End Close", icon: TrendingUp },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.step}
                      onClick={() => setSelectedWorkflowStep(s.step)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 ${
                        selectedWorkflowStep === s.step
                          ? "border-brand bg-brand/10 text-brand shadow-sm"
                          : "border-edge bg-panel hover:bg-panel-raised text-slate-300"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{s.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Step Detail Comparison Card */}
              <div className="rounded-2xl border border-edge bg-panel p-5 space-y-4">
                {selectedWorkflowStep === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO Freelancer: Single-Operator Flow
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Enter client income or business expenses in seconds. No complex debit/credit choices needed—select cash or bank, specify the client or category, and save. Instantly reflects in your receivables and net income.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO Enterprise: Universal Voucher Desk
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Access full Tally-style F-key voucher modes (F4 Contra, F5 Payment, F6 Receipt, F7 Journal, F8 Sales, F9 Purchase). Database triggers enforce mathematical parity (<code className="text-[11px]">ΣDr - ΣCr = 0</code>) and prevent unposted lines from corrupting reports.
                      </p>
                    </div>
                  </div>
                )}

                {selectedWorkflowStep === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO Freelancer: Instant Posting
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Zero bureaucracy. You are the sole operator and owner; every entry is directly committed without requiring secondary approvals or threshold verification.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO Enterprise: Maker-Checker Governance
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Entries drafted by junior accountants or exceeding the organisation threshold route automatically to the <strong>F9 Approvals Desk</strong> for CFO sign-off before entering the general ledger.
                      </p>
                    </div>
                  </div>
                )}

                {selectedWorkflowStep === 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO Freelancer: Simple Bank Ledger
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Track your bank balance and cash on hand with simple transaction logging. Quick UPI QR code generation lets your clients pay you instantly via their preferred mobile app.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO Enterprise: Algorithmic Matcher
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Upload bank statement CSV/Excel files directly into the <strong>F10 Bank Reconciliation Matcher</strong>. The engine algorithmically pairs bank lines against posted ledger legs with anomaly detection.
                      </p>
                    </div>
                  </div>
                )}

                {selectedWorkflowStep === 4 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO Freelancer: 1-Click P&amp;L
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        View real-time Profit &amp; Loss, Balance Sheet, and Client Outstanding balances with zero statutory tax reporting headaches. No GSTR-1, GSTR-3B, or GSTR-2B filings needed.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO Enterprise: Direct GSP &amp; IRP Filing
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Execute automated GSTR-2B purchase register reconciliation, compile GSTR-1 outward tables, calculate GSTR-3B tax payment set-offs, and file directly through the ASP ➔ GSP tunnel.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LAUNCH WORKSPACES */}
          {activeTab === "launch" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="text-center max-w-xl mx-auto space-y-1">
                <h3 className="text-base font-bold text-white">
                  Ready to Experience Deku Finance?
                </h3>
                <p className="text-xs text-slate-400">
                  Select which workspace environment you want to explore with pre-loaded fictional company data:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Launch GO Freelancer */}
                <div className="rounded-2xl border border-emerald-500/30 bg-panel p-6 flex flex-col justify-between space-y-4 hover:border-emerald-500 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">GO Freelancer Sandbox</h4>
                        <span className="text-[11px] text-emerald-400">Pure Accounting &amp; Section 22</span>
                      </div>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Pre-configured with Freelancer consulting accounts</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Bills of Supply with ₹0 tax rate</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Clean Bharat UPI payment QR on invoices</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => onLaunchDemo && onLaunchDemo("freelancer")}
                    disabled={isLoadingDemo !== null}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-panel-deep font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isLoadingDemo === "freelancer" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Initializing Freelancer Workspace…</span>
                      </>
                    ) : (
                      <>
                        <span>Launch GO Freelancer Workspace</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Launch PRO Enterprise */}
                <div className="rounded-2xl border border-brand/30 bg-panel p-6 flex flex-col justify-between space-y-4 hover:border-brand transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center font-bold">
                        <Building className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">PRO Enterprise Sandbox</h4>
                        <span className="text-[11px] text-brand">Full Statutory GST &amp; ALERX Core</span>
                      </div>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                        <span>7-Role RBAC with Maker-Checker sign-offs</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                        <span>Full Indian GST engine with POS &amp; E-Invoicing</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                        <span>Bank statement reconciliation &amp; Deku Consultant</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => onLaunchDemo && onLaunchDemo("owner")}
                    disabled={isLoadingDemo !== null}
                    className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-panel-deep font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/25"
                  >
                    {isLoadingDemo === "owner" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Initializing Enterprise Workspace…</span>
                      </>
                    ) : (
                      <>
                        <span>Launch PRO Enterprise Workspace</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="border-t border-edge px-6 py-3.5 bg-panel/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Fictional sample data · Isolated multi-tenant sandbox</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-panel-raised hover:bg-edge border border-edge text-slate-300 hover:text-white transition-colors"
            >
              Back to Login
            </button>

            {activeTab !== "launch" ? (
              <button
                onClick={() => setActiveTab("launch")}
                className="py-2 px-4 rounded-xl bg-brand hover:bg-brand-hover text-panel-deep font-bold transition-all flex items-center gap-1.5 shadow-md shadow-brand/20"
              >
                <span>Choose &amp; Launch Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

