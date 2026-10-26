"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  Building2,
  UserCheck,
  ArrowRight,
  QrCode,
  Zap,
  TrendingUp,
  FileSpreadsheet,
  Sliders,
} from "lucide-react";

export default function InteractiveModePreview() {
  const [activeMode, setActiveMode] = useState<"pure" | "gst">("pure");
  const [customFields, setCustomFields] = useState({
    showPoNumber: true,
    showEwayBill: false,
    showPaymentTerms: true,
    showPaymentQr: true,
  });

  return (
    <div className="w-full bg-[#1F2324] rounded-3xl p-6 sm:p-10 border border-[#3E4848] shadow-2xl text-white relative overflow-hidden font-sans">
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-[#5BB5BB]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header and Mode Selector Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-[#3E4848]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#5BB5BB]/15 px-2.5 py-0.5 text-xs font-mono font-semibold text-[#91D7D2] border border-[#5BB5BB]/30">
              <Zap className="h-3 w-3 text-[#5BB5BB]" />
              Interactive Architecture Demo
            </span>
            <span className="text-xs text-slate-400">Toggle mode to see real-time engine shift</span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-white">
            One Core Engine. Two Operating Modes.
          </h3>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Freelancer under ₹20L or high-growth B2B enterprise? Deku Finance adapts your legal document generation, tax splitting, and ledger posting seamlessly.
          </p>
        </div>

        {/* The 2 Mode Toggles */}
        <div className="flex items-center bg-[#0A0A0A] p-1.5 rounded-2xl border border-[#3E4848] self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode("pure")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeMode === "pure"
                ? "bg-[#5BB5BB] text-[#0A0A0A] shadow-md font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Pure Accounting (Non-GST)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("gst")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeMode === "gst"
                ? "bg-[#5BB5BB] text-[#0A0A0A] shadow-md font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>GST Registered Enterprise</span>
          </button>
        </div>
      </div>

      {/* Dynamic Content Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Mode Explanation & Status Metrics (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {activeMode === "pure" ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#0A0A0A] border border-[#3E4848] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#5BB5BB]">
                    Legal Protection
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    100% Tax-Exempt & Legal
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">
                  Section 22 of the CGST Act Exemption
                </h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  Ideal for Freelancers, Creators & Startups under ₹20L (Services) or ₹40L (Goods). Invoices are legally generated as <strong>Bills of Supply & Commercial Invoices</strong> without charging tax or requiring GST portal filings.
                </p>
              </div>

              {/* Turnover Tracker Box */}
              <div className="rounded-2xl bg-[#0A0A0A] border border-[#3E4848] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Turnover Exemption Tracker</span>
                  <span className="text-[#91D7D2] font-mono font-bold">16% of ₹40L Utilized</span>
                </div>
                <div className="w-full bg-[#181B1C] h-2.5 rounded-full overflow-hidden border border-[#3E4848]">
                  <div className="bg-[#5BB5BB] h-full rounded-full w-[16%] transition-all duration-500" />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Current FY: ₹6,40,000</span>
                  <span>Threshold Limit: ₹40,00,000</span>
                </div>
                <div className="pt-2 border-t border-[#3E4848]/80 flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>No GSTIN or monthly GSTR returns required.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#0A0A0A] border border-[#3E4848] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#5BB5BB]">
                    Compliance Status
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Active GSTN Entity
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">
                  Multi-State GST Compliance Suite
                </h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  Tailored for B2B vendors, D2C brands, and marketplace sellers on Amazon, Flipkart, Blinkit & Meesho. Full automated CGST/SGST/IGST splitting and Section 14 ECO compliance.
                </p>
              </div>

              {/* GST Returns Readiness Box */}
              <div className="rounded-2xl bg-[#0A0A0A] border border-[#3E4848] p-5 space-y-3">
                <span className="text-xs text-slate-400 font-medium">Auto Return Preparation</span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#121617] rounded-xl p-3 border border-[#3E4848]">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">GSTR-1 Outward</span>
                    <span className="text-sm font-bold text-emerald-400">Offline JSON Ready</span>
                  </div>
                  <div className="bg-[#121617] rounded-xl p-3 border border-[#3E4848]">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">GSTR-3B Tax Match</span>
                    <span className="text-sm font-bold text-[#91D7D2]">ITC Offset Computed</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#3E4848]/80 flex items-center gap-2 text-xs text-slate-400">
                  <FileSpreadsheet className="h-4 w-4 text-[#5BB5BB] shrink-0" />
                  <span>Validated directly against GSTN Portal specifications.</span>
                </div>
              </div>
            </div>
          )}

          {/* Instant UPI Scan-To-Pay Feature Callout */}
          <div className="rounded-2xl bg-gradient-to-r from-[#5BB5BB]/15 to-[#5BB5BB]/5 border border-[#3E4848] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-[#5BB5BB] text-[#0A0A0A] flex items-center justify-center font-bold shrink-0">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                Instant Scan-to-Pay Bharat UPI
              </span>
              <span className="text-[11px] text-slate-400">
                Every generated bill prints your verified UPI VPA for zero-delay payment settlement.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Document & Invoice Simulation (7 cols) */}
        <div className="lg:col-span-7 bg-white text-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
          {/* Interactive Invoice Customization Bar */}
          <div className="bg-[#F8FAFC] rounded-xl p-3 border border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Sliders className="h-3.5 w-3.5 text-[#2D7A7A]" />
                Live Invoice Field Customizer (Interactive)
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Click to toggle fields</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCustomFields((prev) => ({ ...prev, showPoNumber: !prev.showPoNumber }))
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                  customFields.showPoNumber
                    ? "bg-[#5BB5BB] text-[#0A0A0A] border-[#5BB5BB] font-bold shadow-xs"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span>{customFields.showPoNumber ? "✓" : "+"} PO Number</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCustomFields((prev) => ({ ...prev, showEwayBill: !prev.showEwayBill }))
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                  customFields.showEwayBill
                    ? "bg-[#5BB5BB] text-[#0A0A0A] border-[#5BB5BB] font-bold shadow-xs"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span>{customFields.showEwayBill ? "✓" : "+"} E-Way / Vehicle No</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCustomFields((prev) => ({ ...prev, showPaymentTerms: !prev.showPaymentTerms }))
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                  customFields.showPaymentTerms
                    ? "bg-[#5BB5BB] text-[#0A0A0A] border-[#5BB5BB] font-bold shadow-xs"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span>{customFields.showPaymentTerms ? "✓" : "+"} Due Date & Terms</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCustomFields((prev) => ({ ...prev, showPaymentQr: !prev.showPaymentQr }))
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                  customFields.showPaymentQr
                    ? "bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <QrCode className="h-3 w-3" />
                <span>{customFields.showPaymentQr ? "✓ Bharat UPI QR Active" : "+ Add UPI QR"}</span>
              </button>
            </div>
          </div>

          {/* Invoice Document Box */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs space-y-4">
            {/* Invoice Header Mock */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848]">
                  {activeMode === "pure" ? "Pure Accounting Bill" : "Standard Tax Document"}
                </span>
                <h4 className="text-lg font-black text-slate-950">
                  {activeMode === "pure" ? "Bill of Supply (Exempt / Nil)" : "GST TAX INVOICE"}
                </h4>
                <span className="text-xs font-mono text-slate-500">
                  {activeMode === "pure" ? "BOS/2026-27/0014" : "INV/2026-27/0088"}
                </span>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-mono font-extrabold uppercase tracking-wide bg-slate-100 text-slate-800 border border-slate-300">
                  {activeMode === "pure" ? "Sec 22 CGST Exempt" : "GST & E-Way Ready"}
                </span>
                <span className="text-xs font-mono text-slate-500 block mt-1">Date: 19-10-2026</span>
              </div>
            </div>

            {/* Party details */}
            <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-100 text-xs">
              <div>
                <span className="font-semibold text-slate-400 block text-[10px] uppercase font-mono">Billed From</span>
                <span className="font-bold text-slate-900 block">Datalis Infoedge Pvt Ltd</span>
                <span className="text-slate-600 block font-mono text-[11px]">
                  {activeMode === "pure" ? "GSTIN: Unregistered / Exempt" : "GSTIN: 27AABCD1234F1Z5"}
                </span>
                <span className="text-slate-500 block">Mumbai, Maharashtra (27)</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block text-[10px] uppercase font-mono">Billed To</span>
                <span className="font-bold text-slate-900 block">Apex Growth Solutions LLP</span>
                <span className="text-slate-600 block font-mono text-[11px]">
                  {activeMode === "pure" ? "PAN: AADCA4502K" : "GSTIN: 27XYZAB9876C1Z3"}
                </span>
                <span className="text-slate-500 block">Pune, Maharashtra (27)</span>
              </div>
            </div>

            {/* Dynamic Custom Fields Metadata Strip (When Activated) */}
            {(customFields.showPoNumber || customFields.showEwayBill || customFields.showPaymentTerms) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {customFields.showPoNumber && (
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono font-semibold">
                      PO / Order Ref #
                    </span>
                    <span className="font-mono font-bold text-slate-900">PO-2026-OCT-892</span>
                  </div>
                )}
                {customFields.showEwayBill && (
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono font-semibold">
                      E-Way / Vehicle No
                    </span>
                    <span className="font-mono font-bold text-slate-900">2819-4820-9182 (MH-02-EE-4501)</span>
                  </div>
                )}
                {customFields.showPaymentTerms && (
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono font-semibold">
                      Payment Terms & Due
                    </span>
                    <span className="font-bold text-slate-900">Net 15 Days (Due: 03-Nov-2026)</span>
                  </div>
                )}
              </div>
            )}

            {/* Line Item Table */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left font-medium">
                    <th className="pb-2">Item / SAC</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">GST Rate</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5">
                      <span className="font-semibold text-slate-900 block">Enterprise Software License</span>
                      <span className="text-[10px] text-slate-500 font-mono">SAC: 997331</span>
                    </td>
                    <td className="py-2.5 text-right font-mono">1</td>
                    <td className="py-2.5 text-right font-mono">₹50,000</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                          activeMode === "pure"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-[#5BB5BB]/15 text-[#1F2324] font-bold"
                        }`}
                      >
                        {activeMode === "pure" ? "0% (Exempt)" : "18% (9+9%)"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold font-mono">₹50,000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tax Computation Summary */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount</span>
                <span className="font-mono">₹50,000.00</span>
              </div>
              {activeMode === "gst" ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Central GST (CGST 9%)</span>
                    <span className="font-mono font-medium text-[#2D7A7A]">+₹4,500.00</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>State GST (SGST 9%)</span>
                    <span className="font-mono font-medium text-[#2D7A7A]">+₹4,500.00</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-500 italic">
                  <span>Taxes Charged</span>
                  <span>₹0.00 (Exempt under Sec 22)</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-950">
                <span>Grand Total</span>
                <span className="font-mono text-base text-[#0A0A0A]">
                  {activeMode === "pure" ? "₹50,000.00" : "₹59,000.00"}
                </span>
              </div>
            </div>

            {/* Direct Bharat UPI Payment QR Block Embedded on Invoice */}
            {customFields.showPaymentQr && (
              <div className="p-3.5 bg-gradient-to-r from-slate-50 via-slate-50/80 to-[#5BB5BB]/10 rounded-xl border border-[#CBD5E1] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* High Contrast Rendered QR Visual */}
                  <div className="bg-white p-2 rounded-lg border border-slate-300 shadow-xs shrink-0">
                    <svg
                      viewBox="0 0 100 100"
                      className="w-16 h-16 text-slate-950"
                      fill="currentColor"
                      aria-label="Bharat UPI Payment QR Code"
                    >
                      {/* Outer Position Detection Boxes */}
                      <rect x="0" y="0" width="30" height="30" rx="3" />
                      <rect x="6" y="6" width="18" height="18" fill="white" />
                      <rect x="10" y="10" width="10" height="10" />

                      <rect x="70" y="0" width="30" height="30" rx="3" />
                      <rect x="76" y="6" width="18" height="18" fill="white" />
                      <rect x="80" y="10" width="10" height="10" />

                      <rect x="0" y="70" width="30" height="30" rx="3" />
                      <rect x="6" y="76" width="18" height="18" fill="white" />
                      <rect x="10" y="80" width="10" height="10" />

                      {/* Mock QR Data Matrix Dots */}
                      <rect x="36" y="10" width="6" height="6" />
                      <rect x="46" y="10" width="6" height="6" />
                      <rect x="56" y="10" width="6" height="6" />
                      <rect x="36" y="24" width="6" height="6" />
                      <rect x="46" y="24" width="6" height="6" />
                      <rect x="56" y="36" width="6" height="6" />
                      <rect x="10" y="36" width="6" height="6" />
                      <rect x="24" y="46" width="6" height="6" />
                      <rect x="36" y="46" width="6" height="6" />
                      <rect x="46" y="46" width="6" height="6" />
                      <rect x="66" y="46" width="6" height="6" />
                      <rect x="80" y="36" width="6" height="6" />
                      <rect x="36" y="60" width="6" height="6" />
                      <rect x="46" y="60" width="6" height="6" />
                      <rect x="66" y="60" width="6" height="6" />
                      <rect x="80" y="60" width="6" height="6" />
                      <rect x="36" y="76" width="6" height="6" />
                      <rect x="56" y="76" width="6" height="6" />
                      <rect x="76" y="76" width="6" height="6" />
                      <rect x="46" y="86" width="6" height="6" />
                      <rect x="66" y="86" width="6" height="6" />
                      <rect x="86" y="86" width="6" height="6" />
                    </svg>
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded">
                        Bharat UPI Scan-to-Pay
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">Instant 0% MDR</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900">
                      VPA: 7506461004@paytm
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Amount pre-encoded:{" "}
                      <strong className="text-slate-900 font-mono">
                        {activeMode === "pure" ? "₹50,000.00" : "₹59,000.00"}
                      </strong>
                    </div>
                    <div className="text-[9px] text-slate-500 flex items-center gap-1">
                      <span>Supported:</span>
                      <span className="font-semibold text-slate-700">
                        GPay • PhonePe • Paytm • BHIM • Cred
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-500 block">Bank A/C Verified</span>
                  <span className="text-xs font-mono font-bold text-slate-800 block">
                    HDFC Bank • ••••5678
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    Auto-reconciles to Ledger
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Live Ledger State Reflection */}
          <div className="p-3 bg-[#0A0A0A] border border-[#3E4848] text-slate-300 rounded-xl text-[11px] font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#5BB5BB] animate-ping" />
              <span>ALERX Ledger Posting:</span>
            </div>
            <span className="text-[#91D7D2] truncate max-w-xs font-bold">
              {activeMode === "pure"
                ? "Dr Trade Debtors ₹50k ⇄ Cr Revenue ₹50k"
                : "Dr AR ₹59k ⇄ Cr Revenue ₹50k + Output GST ₹9k"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
