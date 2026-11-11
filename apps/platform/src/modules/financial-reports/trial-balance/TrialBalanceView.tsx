"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { AccountBalanceRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { currentFyRange, rangeProblem } from "@/lib/reports/date-range";
import { ReportDateRange } from "@/modules/financial-reports/ReportDateRange";
import { ReportError, ui } from "@/modules/financial-reports/report-ui";

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
    <div className={ui.page}>
      {/* Reporting Toolbar */}
      <div className={ui.toolbar}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={isEquilibrium ? "success" : "warning"}>
              {isEquilibrium ? "Equilibrium verified" : "Verification pending"}
            </Badge>
            <span className={ui.note}>Debits and credits posted between these dates</span>
          </div>
          <p className={`${ui.note} basis-full`}>Leave From blank for balances to date, or set it to see one period&apos;s movements.</p>
          <ReportDateRange from={from} to={to} onFrom={setFrom} onTo={setTo} problem={orgId ? problem : null} />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print statement
          </Button>
          <Button variant="secondary" onClick={fetchTrialBalance} isLoading={isLoading} disabled={!!problem}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error && <ReportError title="Trial Balance unavailable" message={error} onRetry={fetchTrialBalance} />}

      {/* Trial Balance Statement Sheet */}
      <div data-tour="trial-balance-table" className={ui.panel}>
        {/* Statement Header */}
        <div className={`${ui.panelHead} flex-col sm:flex-row sm:items-center`}>
          <div>
            <h2 className={ui.panelTitle}>Trial Balance</h2>
            <p className={ui.panelSub}>Natural balances computed from posted journal entries</p>
          </div>
          <span className={ui.panelSub}>All amounts in INR (₹)</span>
        </div>

        {/* Balance Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className={`${ui.th} w-24`}>Code</th>
                <th className={ui.th}>Particulars</th>
                <th className={`${ui.th} w-32`}>Classification</th>
                <th className={`${ui.th} text-right w-40`}>Debit total (₹)</th>
                <th className={`${ui.th} text-right w-40`}>Credit total (₹)</th>
                <th className={`${ui.th} text-right w-44`}>Balance (₹)</th>
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
                      className={`cursor-pointer transition-colors hover:bg-brand-wash ${
                        hasMovement ? "text-ink" : "text-ink-subtle"
                      }`}
                    >
                      <td className={`${ui.td} font-mono text-[12.5px]`}>
                        {row.account_code}
                      </td>
                      <td className={ui.td}>
                        <span className="block">{row.account_name}</span>
                        {row.sub_ledger && (
                          <span className="text-[12.5px] text-ink-muted">
                            {row.sub_ledger}
                          </span>
                        )}
                      </td>
                      <td className={ui.td}>
                        <span className={`${ui.chip} bg-canvas-sunken text-ink-soft capitalize`}>
                          {row.account_type}
                        </span>
                      </td>
                      <td className={`${ui.td} text-right tabular-nums`}>
                        {row.total_debit > 0 ? formatINR(row.total_debit, { showCurrencySymbol: false }) : "—"}
                      </td>
                      <td className={`${ui.td} text-right tabular-nums`}>
                        {row.total_credit > 0 ? formatINR(row.total_credit, { showCurrencySymbol: false }) : "—"}
                      </td>
                      <td className={`${ui.td} text-right tabular-nums font-medium`}>
                        {/* Debit minus credit, so the Dr or Cr beside it is true for every account type. */}
                        {formatINR(Math.round((row.total_debit - row.total_credit) * 100) / 100, { showDrCr: true })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    {rows ? "No account balance records available." : "–"}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              {/* Grand Totals */}
              <tr>
                <td colSpan={3} className={ui.total}>
                  Total
                </td>
                <td className={`${ui.total} text-right tabular-nums`}>
                  {rows ? <span className="ledger-total">{formatINR(totalDebit)}</span> : "–"}
                </td>
                <td className={`${ui.total} text-right tabular-nums`}>
                  {rows ? <span className="ledger-total">{formatINR(totalCredit)}</span> : "–"}
                </td>
                <td className={`${ui.total} text-right`}>
                  {!rows ? (
                    "–"
                  ) : difference === 0 ? (
                    <span className="text-ok flex items-center justify-end gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Balanced (0.00)
                    </span>
                  ) : (
                    <span className="text-bad">Difference: {formatINR(difference)}</span>
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
