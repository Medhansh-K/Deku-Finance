"use client";

import React, { useState, useEffect, useRef } from "react";
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
import { currentFyRange, rangeProblem } from "@/lib/reports/date-range";
import { ReportDateRange } from "@/modules/financial-reports/ReportDateRange";

export function TrialBalanceView() {
  const router = useRouter();
  // Null until figures load, and after a failure: nothing to show must not read as zero.
  const [rows, setRows] = useState<AccountBalanceRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const latest = useRef(0);
  const problem = rangeProblem(from || "1900-01-01", to);

  useEffect(() => {
    setTo(currentFyRange().to);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchTrialBalance = async () => {
    const request = ++latest.current;
    setRows(null);
    setError(null);
    if (problem) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await reportsApi.getTrialBalance(orgId, from ? { from, to } : { to });
      if (request === latest.current) setRows((res.data || []) as any);
    } catch (err: any) {
      if (request === latest.current) setError(err.message || "Failed to load authoritative Trial Balance");
    } finally {
      if (request === latest.current) setIsLoading(false);
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
  }, [orgId, from, to]);

  // Compute total debits and credits from backend rows
  let totalDebit = 0;
  let totalCredit = 0;

  (rows ?? []).forEach((r) => {
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-surface p-3 rounded border border-line">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={isEquilibrium ? "success" : "warning"}>
              {isEquilibrium ? "Equilibrium Verified" : "Verification Pending"}
            </Badge>
            <span className="text-ink-muted font-mono text-[11px]">
              Debits and credits posted between these dates
            </span>
          </div>
          <p className="text-[11px] text-ink-muted basis-full">Leave From blank for balances to date, or set it to see one period&apos;s movements.</p>
          <ReportDateRange from={from} to={to} onFrom={setFrom} onTo={setTo} problem={orgId ? problem : null} />
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
            disabled={!!problem}
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
      <div data-tour="trial-balance-table" className="bg-surface border border-edge rounded-lg shadow-sm overflow-hidden">
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
              <tr className="bg-canvas-sunken border-b border-line-strong font-mono text-[11px] text-ink-soft">
                <th className="py-2 px-4 w-24">Code</th>
                <th className="py-2 px-4">Particulars / Account Title</th>
                <th className="py-2 px-4 w-32">Classification</th>
                <th className="py-2 px-4 text-right w-40">Debit Total (₹)</th>
                <th className="py-2 px-4 text-right w-40">Credit Total (₹)</th>
                <th className="py-2 px-4 text-right w-44">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    Computing general ledger balances...
                  </td>
                </tr>
              ) : rows && rows.length > 0 ? (
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
                          ? "hover:bg-brand/10 font-medium text-ink"
                          : "text-ink-subtle hover:bg-canvas"
                      }`}
                    >
                      <td className="py-2 px-4 font-mono font-bold">
                        {row.account_code}
                      </td>
                      <td className="py-2 px-4">
                        <span className="block">{row.account_name}</span>
                        {row.sub_ledger && (
                          <span className="text-[10px] text-ink-subtle font-mono">
                            {row.sub_ledger}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-canvas-sunken border border-line">
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
                        {/* Debit minus credit, so the Dr or Cr beside it is true for every account type. */}
                        {formatINR(Math.round((row.total_debit - row.total_credit) * 100) / 100, { showDrCr: true })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted font-mono">
                    {rows ? "No account balance records available." : "–"}
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
                  {rows ? formatINR(totalDebit) : "–"}
                </td>
                <td className="py-3 px-4 text-right text-emerald-400">
                  {rows ? formatINR(totalCredit) : "–"}
                </td>
                <td className="py-3 px-4 text-right">
                  {!rows ? (
                    "–"
                  ) : difference === 0 ? (
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
