"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { BalanceSheetRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";

export function BalanceSheetView() {
  const router = useRouter();
  const [rows, setRows] = useState<BalanceSheetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("b127e064-5da8-437f-94c4-b8d6a0c12927");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchBalanceSheet = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getBalanceSheet(orgId);
      setRows(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load authoritative Balance Sheet report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
    const handleUpdate = () => fetchBalanceSheet();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId]);

  const assetRows = rows.filter((r) => r.account_type === "asset");
  const liabilityRows = rows.filter((r) => r.account_type === "liability");
  const equityRows = rows.filter((r) => r.account_type === "equity");

  const totalAssets = assetRows.reduce((sum, r) => sum + (r.balance || 0), 0);
  const totalLiabilities = liabilityRows.reduce((sum, r) => sum + (r.balance || 0), 0);
  const totalEquity = equityRows.reduce((sum, r) => sum + (r.balance || 0), 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const difference = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
  const isBalanced = difference === 0;

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Reporting Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200">
        <div className="flex items-center gap-2">
          <Badge variant={isBalanced ? "success" : "warning"}>
            {isBalanced ? "Balance Sheet Equated" : `Difference: ${formatINR(difference)}`}
          </Badge>
          <span className="text-slate-500 font-mono text-[11px]">
            ALERX Double-Entry Balance Sheet
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" /> Print Statement
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBalanceSheet}
            isLoading={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Authoritative Balance Sheet Unavailable</p>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchBalanceSheet} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* T-Account Two Column Balance Sheet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Side: Liabilities & Equity */}
        <div className="bg-white border border-[#3E4848] rounded-lg shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#1F2324] px-4 py-2 border-b border-[#3E4848] text-white flex items-center justify-between font-mono">
              <span>Capital & Liabilities</span>
              <span className="text-slate-300 font-bold">
                {formatINR(totalLiabilitiesAndEquity)}
              </span>
            </div>

            {/* Equity Section */}
            <div className="p-2 bg-slate-50 border-b border-slate-200 font-mono text-[11px] font-bold text-slate-700">
              Shareholders&apos; Funds & Capital (Equity)
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-slate-100">
                {equityRows.map((acc) => (
                  <tr
                    key={acc.account_id}
                    onClick={() =>
                      router.push(`/day-book?account_code=${acc.account_code}`)
                    }
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-slate-700 w-20">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 w-32">
                      {formatINR(acc.balance, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Liabilities Section */}
            <div className="p-2 bg-slate-50 border-y border-slate-200 font-mono text-[11px] font-bold text-slate-700 mt-2">
              Current & Non-Current Liabilities
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-slate-100">
                {liabilityRows.map((acc) => (
                  <tr
                    key={acc.account_id}
                    onClick={() =>
                      router.push(`/day-book?account_code=${acc.account_code}`)
                    }
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-slate-700 w-20">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 w-32">
                      {formatINR(acc.balance, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[#1F2324] text-white p-3 border-t-2 border-[#3E4848] flex items-center justify-between font-mono font-bold">
            <span>Total Liabilities & Equity</span>
            <span className="text-emerald-400">
              {formatINR(totalLiabilitiesAndEquity)}
            </span>
          </div>
        </div>

        {/* Right Side: Assets */}
        <div className="bg-white border border-[#3E4848] rounded-lg shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#1F2324] px-4 py-2 border-b border-[#3E4848] text-white flex items-center justify-between font-mono">
              <span>Assets (Property & Liquid Capital)</span>
              <span className="text-emerald-400 font-bold">
                {formatINR(totalAssets)}
              </span>
            </div>

            <div className="p-2 bg-slate-50 border-b border-slate-200 font-mono text-[11px] font-bold text-slate-700">
              Current & Fixed Assets
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-slate-100">
                {assetRows.map((acc) => (
                  <tr
                    key={acc.account_id}
                    onClick={() =>
                      router.push(`/day-book?account_code=${acc.account_code}`)
                    }
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-slate-700 w-20">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 w-32">
                      {formatINR(acc.balance, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[#1F2324] text-white p-3 border-t-2 border-[#3E4848] flex items-center justify-between font-mono font-bold">
            <span>Total Assets</span>
            <span className="text-emerald-400">{formatINR(totalAssets)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
