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
  Building2,
  Send,
  Lock,
} from "lucide-react";

export type PlanType = "go" | "pro" | "enterprise" | "freelancer";
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
  initialPlan = "pro",
  onLaunchDemo,
  isLoadingDemo = null,
}: InteractivePlanTutorialModalProps) {
  const [activeTab, setActiveTab] = useState<TutorialTab>("comparison");
  const normalizedInitial: "go" | "pro" | "enterprise" =
    initialPlan === "freelancer" ? "go" : initialPlan === "enterprise" ? "enterprise" : initialPlan === "go" ? "go" : "pro";
  const [simulatorMode, setSimulatorMode] = useState<"go" | "pro" | "enterprise">(normalizedInitial);
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<number>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-6xl rounded-3xl border border-edge bg-panel-deep shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 -mt-16 w-80 h-80 bg-brand/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-1/4 -mt-16 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-edge px-6 py-4 bg-panel/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Deku Finance · Annual Contract License &amp; Module Guide
                </h2>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/20 text-brand border border-brand/30 uppercase tracking-wider font-mono">
                  Annual Licensing
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Compare statutory compliance, ledger mechanics, AI CFO intelligence, and governance across GO (₹24,999/yr), PRO (₹49,999/yr), and Enterprise (₹1,19,999/yr).
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
            <span>1. Plan-Wise Module Comparison</span>
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
              {/* Executive Summary Cards (3 Tiers) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* GO Card */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <User className="h-3.5 w-3.5" />
                        GO
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        ₹24,999 <span className="text-[10px] text-slate-400 font-normal">/yr</span>
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      Section 22 Exemption &amp; Solo Operator Simplicity
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Engineered for freelancers, consultants, and solo studios under the ₹20L/₹40L statutory turnover threshold. Zero GST complexity, dynamic Bharat UPI QR codes, and strict ALERX double-entry parity.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300">
                    <span>2 User Seats</span>
                    <span className="font-bold font-mono">Pure Accounting</span>
                  </div>
                </div>

                {/* PRO Card */}
                <div className="rounded-2xl border border-brand/40 bg-brand/10 p-5 relative overflow-hidden flex flex-col justify-between ring-1 ring-brand/20">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-brand/20 text-brand border border-brand/30">
                        <Building className="h-3.5 w-3.5" />
                        PRO
                      </span>
                      <span className="text-xs font-mono font-black text-brand-soft">
                        ₹49,999 <span className="text-[10px] text-slate-400 font-normal">/yr</span>
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      Full Statutory GST &amp; Maker-Checker Governance
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      For scaling SMEs and B2B traders. Automatic Place of Supply (POS) rules, GSTR-1 &amp; GSTR-3B offline JSON exports, Input Tax Credit (ITC) Rule 88A set-off, bank statement reconciliation, and 7-role RBAC.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-brand/20 flex items-center justify-between text-[11px] text-brand">
                    <span>5 Seats • Most Popular</span>
                    <span className="font-bold font-mono">Full GST Suite</span>
                  </div>
                </div>

                {/* Enterprise Card */}
                <div className="rounded-2xl border border-purple-500/30 bg-purple-950/15 p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        <Building2 className="h-3.5 w-3.5" />
                        Enterprise
                      </span>
                      <span className="text-xs font-mono font-bold text-purple-300">
                        ₹1,19,999 <span className="text-[10px] text-slate-400 font-normal">/yr</span>
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      AI CFO Intelligence &amp; Multi-Branch Corporation
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      For large enterprises and multi-entity corporations. Deku Consultant AI CFO across 10 departments (50 automated workflows), direct IRP E-Invoicing (INV-01) with 64-char IRN, NIC E-Way bills, and unlimited seats.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-purple-500/20 flex items-center justify-between text-[11px] text-purple-300">
                    <span>Unlimited Seats</span>
                    <span className="font-bold font-mono">AI CFO + IRP API</span>
                  </div>
                </div>
              </div>

              {/* Comprehensive Feature Comparison Matrix */}
              <div className="rounded-2xl border border-edge bg-panel/60 overflow-hidden">
                <div className="p-4 border-b border-edge bg-panel-raised/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Architectural &amp; Statutory Capabilities Matrix
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    All licenses billed annually · Zero hidden transaction fees
                  </span>
                </div>

                <div className="divide-y divide-edge text-xs">
                  {/* Row: Annual Pricing */}
                  <div className="grid grid-cols-12 p-3.5 bg-panel-raised/40 font-bold">
                    <div className="col-span-3 text-slate-300">Annual Contract License</div>
                    <div className="col-span-3 text-emerald-400 font-mono">₹24,999 / year</div>
                    <div className="col-span-3 text-brand font-mono">₹49,999 / year</div>
                    <div className="col-span-3 text-purple-300 font-mono">₹1,19,999 / year</div>
                  </div>

                  {/* Row: Legal Statutory Rule */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Statutory Framework</span>
                    </div>
                    <div className="col-span-3 text-emerald-400 font-medium">
                      Section 22 Exemption (&lt; ₹20L/₹40L)
                    </div>
                    <div className="col-span-3 text-brand font-medium">
                      Regular GSTIN B2B Registration
                    </div>
                    <div className="col-span-3 text-purple-300 font-medium">
                      Multi-GSTIN &amp; Corporate Branches
                    </div>
                  </div>

                  {/* Row: Invoices Produced */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Document Formats</span>
                    </div>
                    <div className="col-span-3 text-slate-300">
                      Bills of Supply / Commercial Bills (₹0 Tax)
                    </div>
                    <div className="col-span-3 text-slate-300">
                      Tax Invoices (B2B, B2C, Notes, Export)
                    </div>
                    <div className="col-span-3 text-purple-200">
                      IRP E-Invoices (INV-01) + NIC E-Way Bills
                    </div>
                  </div>

                  {/* Row: Tax Math & POS */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Tax Splits (CGST/SGST/IGST)</span>
                    </div>
                    <div className="col-span-3 text-slate-400 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-slate-500 shrink-0" />
                      <span>Disabled (₹0 Tax Liability)</span>
                    </div>
                    <div className="col-span-3 text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Automatic POS rule engine</span>
                    </div>
                    <div className="col-span-3 text-purple-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                      <span>Advanced POS + Reverse Charge (RCM)</span>
                    </div>
                  </div>

                  {/* Row: GST Returns */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>GSTR-1 &amp; GSTR-3B</span>
                    </div>
                    <div className="col-span-3 text-slate-400">
                      Exempt turnover monitoring only
                    </div>
                    <div className="col-span-3 text-brand">
                      1-Click GSTN Offline JSON export
                    </div>
                    <div className="col-span-3 text-purple-300">
                      Offline JSON + Direct GSP API filing
                    </div>
                  </div>

                  {/* Row: E-Invoicing & E-Way Bills */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>IRP &amp; E-Way Bills</span>
                    </div>
                    <div className="col-span-3 text-slate-400 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-slate-500 shrink-0" />
                      <span>Not applicable</span>
                    </div>
                    <div className="col-span-3 text-slate-300">
                      E-Way Bill export schema
                    </div>
                    <div className="col-span-3 text-purple-300 font-bold">
                      Direct IRP API (64-char IRN &amp; signed QR)
                    </div>
                  </div>

                  {/* Row: Double-Entry Ledger Engine */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>ALERX Parity (ΣDr = ΣCr)</span>
                    </div>
                    <div className="col-span-3 text-emerald-400">
                      Strict trigger enforcement
                    </div>
                    <div className="col-span-3 text-emerald-400">
                      Strict trigger enforcement
                    </div>
                    <div className="col-span-3 text-emerald-400">
                      Strict + Inter-Company Balancing
                    </div>
                  </div>

                  {/* Row: Bank Reconciliation */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Bank Reconciliation</span>
                    </div>
                    <div className="col-span-3 text-slate-300">
                      Direct cash &amp; bank ledger log
                    </div>
                    <div className="col-span-3 text-brand">
                      CSV statement matcher against journals
                    </div>
                    <div className="col-span-3 text-purple-300">
                      Algorithmic matcher + Direct bank feeds
                    </div>
                  </div>

                  {/* Row: Payment Collection */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>UPI &amp; Payments</span>
                    </div>
                    <div className="col-span-3 text-emerald-400">
                      Dynamic Bharat UPI QR code on bills
                    </div>
                    <div className="col-span-3 text-brand">
                      Dynamic UPI + Razorpay webhooks
                    </div>
                    <div className="col-span-3 text-purple-300">
                      Dynamic UPI + Multi-VPA split settlement
                    </div>
                  </div>

                  {/* Row: AI Financial Copilot */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <Bot className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Deku Consultant AI CFO</span>
                    </div>
                    <div className="col-span-3 text-slate-400">
                      Basic ledger health prompts
                    </div>
                    <div className="col-span-3 text-brand">
                      3 Core Depts (FP&amp;A, Cash, Opex)
                    </div>
                    <div className="col-span-3 text-purple-300 font-bold">
                      Full 10 Depts / 50 Workflows
                    </div>
                  </div>

                  {/* Row: User Seats & Controls */}
                  <div className="grid grid-cols-12 p-3.5 hover:bg-panel-raised/30 transition-colors">
                    <div className="col-span-3 font-semibold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Seats &amp; Governance</span>
                    </div>
                    <div className="col-span-3 text-slate-300">
                      2 Seats (Single-operator direct post)
                    </div>
                    <div className="col-span-3 text-brand">
                      5 Seats (7-Role Maker-Checker RBAC)
                    </div>
                    <div className="col-span-3 text-purple-300 font-bold">
                      Unlimited Seats + Custom Hierarchies
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
                    Interactive Document Simulator
                  </h4>
                  <p className="text-xs text-slate-400">
                    Inspect how a ₹50,000 transaction renders under each annual licensing tier:
                  </p>
                </div>

                <div className="flex items-center p-1 bg-panel-deep rounded-xl border border-edge shrink-0">
                  <button
                    onClick={() => setSimulatorMode("go")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      simulatorMode === "go"
                        ? "bg-emerald-500 text-panel-deep shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>GO (₹24,999/yr)</span>
                  </button>

                  <button
                    onClick={() => setSimulatorMode("pro")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      simulatorMode === "pro"
                        ? "bg-brand text-panel-deep shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Building className="h-3.5 w-3.5" />
                    <span>PRO (₹49,999/yr)</span>
                  </button>

                  <button
                    onClick={() => setSimulatorMode("enterprise")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      simulatorMode === "enterprise"
                        ? "bg-purple-500 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Enterprise (₹1,19,999/yr)</span>
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
                        simulatorMode === "go"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : simulatorMode === "pro"
                          ? "bg-brand/20 text-brand border border-brand/30"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      }`}
                    >
                      {simulatorMode === "go"
                        ? "BILL OF SUPPLY"
                        : simulatorMode === "pro"
                        ? "TAX INVOICE (B2B)"
                        : "GOVERNMENT IRP E-INVOICE (INV-01)"}
                    </span>
                    <h3 className="text-xl font-black text-white">
                      {simulatorMode === "go"
                        ? "Aarav Sharma · Digital Consulting"
                        : simulatorMode === "pro"
                        ? "Apex Technologies Private Limited"
                        : "Apex Global Enterprise Corp"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {simulatorMode === "go"
                        ? "PAN: ABCPS1234F · Section 22 Composition / Exempt Supplier"
                        : simulatorMode === "pro"
                        ? "GSTIN: 27AABCU9603R1ZM · Maharashtra (State Code 27)"
                        : "GSTIN: 27AABCU9603R1ZM · Multi-Branch Corporate HQ"}
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <p className="text-xs text-slate-400">Invoice Number</p>
                    <p className="text-sm font-mono font-bold text-white">
                      {simulatorMode === "go"
                        ? "BOS-2026-042"
                        : simulatorMode === "pro"
                        ? "INV-2026-089"
                        : "EINV-2026-9041"}
                    </p>
                    <p className="text-xs text-slate-400">Date: 05 Nov 2026</p>
                    {simulatorMode === "enterprise" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        IRN: 8a4f91...e01b · Signed IRP QR
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
                      {simulatorMode === "go"
                        ? "Bengaluru, Karnataka (Client)"
                        : "GSTIN: 29AAACH1234E1Z5 · Karnataka (State Code 29)"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-edge bg-panel-deep p-3.5 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-400">Statutory Tax Treatment:</p>
                    {simulatorMode === "go" ? (
                      <div className="space-y-0.5">
                        <p className="font-bold text-emerald-400">Section 22 Exemption Active</p>
                        <p className="text-[11px] text-slate-400">
                          Turnover is below statutory limit. ₹0 GST collected.
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
                        {simulatorMode !== "go" && (
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
                          Cloud Infrastructure &amp; Financial Architecture Consulting
                        </td>
                        {simulatorMode !== "go" && (
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

                    {simulatorMode === "go" ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Scan with Google Pay, PhonePe, Paytm, or BHIM. Zero-fee payment straight to your bank account.
                        </p>
                        <div className="p-2.5 rounded-lg bg-panel border border-edge flex items-center justify-between text-xs">
                          <span className="text-slate-400">Bharat UPI VPA:</span>
                          <span className="font-mono text-emerald-400 font-bold">aarav@okhdfcbank</span>
                        </div>
                      </div>
                    ) : simulatorMode === "pro" ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Razorpay link + webhook auto-reconciliation directly to Bank Clearing Account 1110.
                        </p>
                        <div className="p-2.5 rounded-lg bg-panel border border-edge flex items-center justify-between text-xs">
                          <span className="text-slate-400">GSTR-1 Status:</span>
                          <span className="font-mono text-brand font-bold">Table 4A Ready (JSON)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Automated IRP QR + NIC E-Way Bill + Multi-VPA split settlement to Escrow.
                        </p>
                        <div className="p-2.5 rounded-lg bg-panel border border-edge flex items-center justify-between text-xs">
                          <span className="text-slate-400">NIC E-Way Bill:</span>
                          <span className="font-mono text-purple-300 font-bold">EWB-2026-991204</span>
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

                    {simulatorMode === "go" ? (
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
                        {simulatorMode === "go" ? "₹50,000.00" : "₹59,000.00"}
                      </span>
                    </div>

                    {/* Double-Entry Preview Badge */}
                    <div className="pt-2 text-[11px] text-slate-400 font-mono">
                      {simulatorMode === "go" ? (
                        <span>Postings: Dr Bank ₹50k · Cr Revenue ₹50k</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO: Solo Entry
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Enter income or expense transactions in seconds without manual debit/credit selection. Fast Bharat UPI QR invoice issuance.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO: Universal Voucher Desk
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        F-key desk (F4 Contra, F5 Payment, F6 Receipt, F7 Journal, F8 Sales, F9 Purchase) with server sequence numbers and draft editing.
                      </p>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        Enterprise: Automated Feeds
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Automated invoice generation via API, OCR vendor bills, bulk marketplace settlement sheets, and payroll journal auto-posting.
                      </p>
                    </div>
                  </div>
                )}

                {selectedWorkflowStep === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO: Direct Post
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Zero approval bureaucracy. As sole operator, every entry posts immediately into the ALERX double-entry ledger.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO: Maker-Checker RBAC
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Junior entries route to the F9 Approvals Desk. Senior accountants or admins review and authorize before ledger commitment.
                      </p>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        Enterprise: Threshold Policies
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Multi-tier authorization matrices, department budget checks, and confidential employee compensation privacy masking.
                      </p>
                    </div>
                  </div>
                )}

                {selectedWorkflowStep === 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO: Cash &amp; Bank Log
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Track live cash and bank balances with verified transaction entries and instant UPI settlement verification.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO: Statement Matcher
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Upload bank statement CSV/Excel files into the Bank Reconciliation Desk. The engine algorithmically pairs bank lines against ledger legs.
                      </p>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        Enterprise: Automated Recon
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Direct corporate bank feeds with automated settlement of open receivables, payment gateway splits, and discrepancy alerts.
                      </p>
                    </div>
                  </div>
                )}

                {selectedWorkflowStep === 4 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        GO: Instant P&amp;L &amp; BS
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Real-time P&amp;L and Balance Sheet with zero GST filing overhead. Ready for year-end ITR-4 / 44ADA filing.
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Building className="h-4 w-4" />
                        PRO: GSTR-1 &amp; GSTR-3B
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Generate official GSTN offline JSON exports for GSTR-1 and GSTR-3B with Rule 88A ITC optimization.
                      </p>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        Enterprise: AI CFO Close
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Deku Consultant AI CFO runs 50 financial checks, ratios, budget variances, and multi-branch consolidations.
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
                  Experience Deku Finance Workspaces
                </h3>
                <p className="text-xs text-slate-400">
                  Select an environment to explore with pre-loaded sample company ledgers:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
                {/* Launch GO Freelancer */}
                <div className="rounded-2xl border border-emerald-500/30 bg-panel p-6 flex flex-col justify-between space-y-4 hover:border-emerald-500 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">GO Sandbox</h4>
                          <span className="text-[11px] text-emerald-400">Pure Accounting &amp; Section 22</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">₹24,999/yr</span>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Pre-configured consulting &amp; service accounts</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Bills of Supply with ₹0 tax liability</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Dynamic Bharat UPI QR code on invoices</span>
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
                        <span>Initializing GO Workspace…</span>
                      </>
                    ) : (
                      <>
                        <span>Launch GO Sandbox</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Launch PRO Enterprise */}
                <div className="rounded-2xl border border-brand/40 bg-panel p-6 flex flex-col justify-between space-y-4 hover:border-brand transition-all ring-1 ring-brand/20">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center font-bold">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">PRO Sandbox</h4>
                          <span className="text-[11px] text-brand">Full Statutory GST &amp; ALERX</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-brand">₹49,999/yr</span>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                        <span>7-Role RBAC with Maker-Checker sign-offs</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                        <span>GSTR-1 &amp; GSTR-3B offline JSON exports</span>
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
                        <span>Initializing PRO Workspace…</span>
                      </>
                    ) : (
                      <>
                        <span>Launch PRO Sandbox</span>
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
            <span>Annual Contract Licenses include full statutory tax updates &amp; single-tenant isolation.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-panel-raised hover:bg-edge border border-edge text-slate-300 hover:text-white transition-colors"
            >
              Back
            </button>

            {activeTab !== "launch" ? (
              <button
                onClick={() => setActiveTab("launch")}
                className="py-2 px-4 rounded-xl bg-brand hover:bg-brand-hover text-panel-deep font-bold transition-all flex items-center gap-1.5 shadow-md shadow-brand/20"
              >
                <span>Launch Demo Workspaces</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
