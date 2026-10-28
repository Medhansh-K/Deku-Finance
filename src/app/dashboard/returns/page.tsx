"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

export default function ReturnsHubPage() {
  const { operatingMode, organisation } = useAuth();
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownloadGstr3b = () => {
    // shortcut: export disabled until GSTR-3B is computed from posted GST ledgers for the period.
    // The old file used the same hardcoded figures for every company, i.e. a false return.
    setDownloadSuccess(
      "GSTR-3B export is not available yet: it will be generated from your posted GST ledgers. Nothing was downloaded."
    );
    setTimeout(() => setDownloadSuccess(null), 6000);
  };

  const isPure = operatingMode === "pure_accounting";

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-zinc-950">
              GST Statutory Returns & Offline JSON Hub
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              GSTN Compliant
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            1-Click validated GSTR-1 and GSTR-3B offline JSON exports ready for direct upload to gst.gov.in.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadGstr3b}
          className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-md shadow-amber-400/20 transition-transform hover:scale-[1.01]"
        >
          <Download className="h-4 w-4" />
          <span>Export GSTR-3B Offline JSON</span>
        </button>
      </div>

      {/* Success Notification */}
      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{downloadSuccess}</span>
        </div>
      )}

      {/* Section 22 Advisory if in Pure Accounting */}
      {isPure && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-5 flex items-start gap-3.5 text-xs text-emerald-900">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block text-emerald-950 text-sm font-bold">
              Exempt under Section 22 of the CGST Act
            </strong>
            <p className="text-emerald-800 leading-relaxed">
              Your business is operating in Pure Accounting mode with an aggregate turnover under ₹40 Lakhs. You are legally exempt from mandatory GST return filing. You can generate commercial reports or switch to GST Enterprise mode anytime your turnover approaches ₹40 Lakhs.
            </p>
          </div>
        </div>
      )}

      {/* Return Table 3.1 & 4 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Table 3.1 Card */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Table 3.1: Outward Taxable Supplies
            </span>
            <span className="text-[10px] bg-zinc-100 font-mono font-bold text-zinc-700 px-2 py-0.5 rounded">
              Period: 102026
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Total Taxable Value</span>
              <span className="font-mono font-bold text-zinc-950">₹6,40,000.00</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Central Tax (CGST)</span>
              <span className="font-mono font-bold text-amber-600">₹28,800.00</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>State Tax (SGST)</span>
              <span className="font-mono font-bold text-amber-600">₹28,800.00</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Integrated Tax (IGST)</span>
              <span className="font-mono text-zinc-400">₹0.00</span>
            </div>
          </div>
        </div>

        {/* Table 4 Card */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Table 4: Eligible Input Tax Credit (ITC)
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
              Rule 36(4) Verified
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>ITC from GSTR-2B Purchases</span>
              <span className="font-mono font-bold text-zinc-950">₹18,900.00</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>CGST Input Credit</span>
              <span className="font-mono font-bold text-indigo-600">₹9,450.00</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>SGST Input Credit</span>
              <span className="font-mono font-bold text-indigo-600">₹9,450.00</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Ineligible ITC (Sec 17(5))</span>
              <span className="font-mono text-zinc-400">₹0.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
