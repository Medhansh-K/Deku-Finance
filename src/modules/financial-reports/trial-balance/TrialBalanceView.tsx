"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { AccountBalanceRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";

export function TrialBalanceView() {
  const router = useRouter();
  const [rows, setRows] = useState<AccountBalanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchTrialBalance = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getTrialBalance(orgId);
      setRows((res.data || []) as any);
    } catch (err: any) {
      try {
        const fallback = await reportsApi.getAccountBalances(orgId);
        setRows(fallback.data || []);
      } catch (fErr: any) {
        setError(fErr.message || "Failed to load authoritative Trial Balance");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchTrialBalance();
    const handleUpdate = () => fetchTrialBalance();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId]);

  // Compute total debits and credits from backend rows
  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach((r) => {
    totalDebit += r.total_debit || 0;
    totalCredit += r.total_credit || 0;
  });

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const isEquilibrium = totalDebit > 0 && totalDebit === totalCredit;

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Reporting Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200">
        <div className="flex items-center gap-2">
          <Badge variant={isEquilibrium ? "success" : "warning"}>
            {isEquilibrium ? "Equilibrium Verified" : "Verification Pending"}
          </Badge>
          <span className="text-slate-500 font-mono text-[11px]">
            ALERX Double-Entry Trial Balance
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
            onClick={fetchTrialBalance}
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
              <p className="font-bold">Authoritative Data Unavailable</p>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchTrialBalance} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Trial Balance Statement Sheet */}
      <div className="bg-white border border-edge rounded-lg shadow-sm overflow-hidden">
        {/* Statement Header */}
        <div className="bg-panel text-white p-4 border-b border-edge flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase font-mono">
              Trial Balance Statement
            </h2>
            <p className="text-[11px] text-brand-soft">
              As computed by PostgreSQL ALERX Natural Balance Engine
            </p>
          </div>
          <div className="text-right font-mono text-[11px] text-slate-300">
            <div>All amounts in INR (₹)</div>
          </div>
        </div>

        {/* Balance Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] text-slate-700">
                <th className="py-2 px-4 w-24">Code</th>
                <th className="py-2 px-4">Particulars / Account Title</th>
                <th className="py-2 px-4 w-32">Classification</th>
                <th className="py-2 px-4 text-right w-40">Debit Total (₹)</th>
                <th className="py-2 px-4 text-right w-40">Credit Total (₹)</th>
                <th className="py-2 px-4 text-right w-44">Natural Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Computing general ledger balances...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row) => {
                  const hasMovement = row.total_debit > 0 || row.total_credit > 0;
                  return (
                    <tr
                      key={row.account_id}
                      onClick={() =>
                        router.push(`/day-book?account_code=${row.account_code}`)
                      }
                      className={`cursor-pointer transition-colors ${
                        hasMovement
                          ? "hover:bg-brand/10 font-medium text-slate-900"
                          : "text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-2 px-4 font-mono font-bold">
                        {row.account_code}
                      </td>
                      <td className="py-2 px-4">
                        <span className="block">{row.account_name}</span>
                        {row.sub_ledger && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {row.sub_ledger}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {row.account_type}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {row.total_debit > 0 ? formatINR(row.total_debit, { showCurrencySymbol: false }) : "—"}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {row.total_credit > 0 ? formatINR(row.total_credit, { showCurrencySymbol: false }) : "—"}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-ink">
                        {formatINR(row.natural_balance, { showDrCr: true })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                    No account balance records available.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              {/* Grand Totals */}
              <tr className="bg-panel text-white border-t-2 border-edge font-mono font-bold text-xs">
                <td colSpan={3} className="py-3 px-4 uppercase tracking-wider">
                  Total Trial Balance Equilibrium
                </td>
                <td className="py-3 px-4 text-right text-emerald-400">
                  {formatINR(totalDebit)}
                </td>
                <td className="py-3 px-4 text-right text-emerald-400">
                  {formatINR(totalCredit)}
                </td>
                <td className="py-3 px-4 text-right">
                  {difference === 0 ? (
                    <span className="text-emerald-400 flex items-center justify-end gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Balanced (0.00)
                    </span>
                  ) : (
                    <span className="text-rose-400">Diff: {formatINR(difference)}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
