"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { GSTR1_NOT_COVERED, GSTR3B_NOT_COVERED } from "@/lib/gst/returns";
import { useReturnPeriod } from "@/lib/gst/period";
import { useReturnBooks } from "@/lib/gst/useReturnBooks";
import { downloadJson } from "@/lib/download";
import { ReturnCard } from "@/modules/gst/ReturnCard";

export default function ReturnsHubPage() {
  const { operatingMode } = useAuth();
  const { month, setMonth, fy, retPeriod } = useReturnPeriod();
  const { orgId, books, loading, loadError, gstr1, gstr3b } = useReturnBooks(retPeriod);

  const isPure = operatingMode === "pure_accounting";

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-zinc-950">GST Returns: GSTR-1 & GSTR-3B</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Offline JSON built from your issued sales invoices and Input GST ledgers. Exports stay locked until every check passes.
          </p>
        </div>
        <div className="w-44">
          <Input label={fy ? `Return period (FY ${fy})` : "Return period"} id="return-period" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

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

      {!orgId && <p className="text-xs text-zinc-500">Select a company first.</p>}
      {loading && <p className="text-xs text-zinc-500">Loading invoices and ledgers…</p>}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{loadError}. Nothing can be exported.</span>
        </div>
      )}

      {gstr1 && gstr3b && books && (
        <div className="grid grid-cols-1 gap-5">
          <ReturnCard
            title="GSTR-1"
            result={gstr1}
            notCovered={GSTR1_NOT_COVERED}
            onDownload={() => downloadJson(`GSTR1_${books.gstin}_${retPeriod}.json`, gstr1.json)}
          />
          <ReturnCard
            title="GSTR-3B"
            result={gstr3b}
            notCovered={GSTR3B_NOT_COVERED}
            onDownload={() => downloadJson(`GSTR3B_${books.gstin}_${retPeriod}.json`, gstr3b.json)}
          />
        </div>
      )}
    </div>
  );
}
