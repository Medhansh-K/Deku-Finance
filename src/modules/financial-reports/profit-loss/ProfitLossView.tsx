"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, RefreshCw, Printer, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { ProfitLossRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";

export function ProfitLossView() {
  const router = useRouter();
  const [rows, setRows] = useState<ProfitLossRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchPnL = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getProfitAndLoss(orgId);
      setRows(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load authoritative Profit & Loss report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchPnL();
    const handleUpdate = () => fetchPnL();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId]);

  const incomeAccounts = rows.filter((r) => r.account_type === "income");
  const expenseAccounts = rows.filter((r) => r.account_type === "expense");

  const totalIncome = incomeAccounts.reduce((sum, r) => sum + (r.net_amount || 0), 0);
  const totalExpense = expenseAccounts.reduce((sum, r) => sum + (r.net_amount || 0), 0);
  const netProfit = totalIncome - totalExpense;
  const isNetProfit = netProfit >= 0;

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Reporting Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded border border-line">
        <div className="flex items-center gap-2">
          <Badge variant={isNetProfit ? "success" : "danger"}>
            {isNetProfit ? "Net Profit" : "Net Loss"}: {formatINR(Math.abs(netProfit))}
          </Badge>
          <span className="text-ink-muted font-mono text-[11px]">
            Fiscal Period FY 2026-27
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
            onClick={fetchPnL}
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
              <p className="font-bold">Authoritative Report Unavailable</p>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchPnL} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface p-3.5 rounded border border-line shadow-xs">
          <span className="text-ink-subtle font-mono text-[10px] uppercase block">
            Operating Revenue & Income
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold font-mono text-ink">
              {formatINR(totalIncome)}
            </span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </div>
        </div>

        <div className="bg-surface p-3.5 rounded border border-line shadow-xs">
          <span className="text-ink-subtle font-mono text-[10px] uppercase block">
            Operating Expenses & Overhead
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold font-mono text-ink">
              {formatINR(totalExpense)}
            </span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
        </div>

        <div className="bg-surface p-3.5 rounded border border-line shadow-xs">
          <span className="text-ink-subtle font-mono text-[10px] uppercase block">
            Net Result for Period
          </span>
          <div className="flex items-center justify-between mt-1">
            <span
              className={`text-base font-bold font-mono ${
                isNetProfit ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {isNetProfit ? "+" : "-"}
              {formatINR(Math.abs(netProfit))}
            </span>
            <Badge variant={isNetProfit ? "success" : "danger"}>
              {isNetProfit ? "Surplus" : "Deficit"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Detailed Dual-Column Statement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Expenses Side */}
        <div className="bg-surface border border-edge rounded-lg shadow-xs overflow-hidden">
          <div className="bg-panel px-4 py-2 border-b border-edge text-white flex items-center justify-between font-mono">
            <span>Expenses & Outflows</span>
            <span className="text-slate-300 font-bold">{formatINR(totalExpense)}</span>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas-sunken border-b border-line font-mono text-[10px] text-ink-muted">
                <th className="py-2 px-3">Code</th>
                <th className="py-2 px-3">Expense Head</th>
                <th className="py-2 px-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {expenseAccounts.length > 0 ? (
                expenseAccounts.map((acc) => (
                  <tr
                    key={acc.account_id}
                    onClick={() =>
                      router.push(`/day-book?account_code=${acc.account_code}`)
                    }
                    className="hover:bg-canvas cursor-pointer"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-ink-soft">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-ink">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-ink">
                      {formatINR(acc.net_amount, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-ink-subtle font-mono">
                    No expense movements recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Income / Revenue Side */}
        <div className="bg-surface border border-edge rounded-lg shadow-xs overflow-hidden">
          <div className="bg-panel px-4 py-2 border-b border-edge text-white flex items-center justify-between font-mono">
            <span>Income & Inflows</span>
            <span className="text-emerald-400 font-bold">{formatINR(totalIncome)}</span>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas-sunken border-b border-line font-mono text-[10px] text-ink-muted">
                <th className="py-2 px-3">Code</th>
                <th className="py-2 px-3">Revenue Head</th>
                <th className="py-2 px-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {incomeAccounts.length > 0 ? (
                incomeAccounts.map((acc) => (
                  <tr
                    key={acc.account_id}
                    onClick={() =>
                      router.push(`/day-book?account_code=${acc.account_code}`)
                    }
                    className="hover:bg-canvas cursor-pointer"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-ink-soft">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-ink">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-ink">
                      {formatINR(acc.net_amount, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-ink-subtle font-mono">
                    No revenue movements recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
