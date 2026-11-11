"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Printer, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { ProfitLossRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { downloadFile } from "@/lib/download";
import { profitLossCsv } from "@/lib/import/export";
import { currentFyRange, rangeProblem } from "@/lib/reports/date-range";
import { ReportDateRange } from "@/modules/financial-reports/ReportDateRange";
import { ReportError, ui } from "@/modules/financial-reports/report-ui";

export function ProfitLossView() {
  const router = useRouter();
  // Null until figures load, and after a failure: nothing to show must not read as zero.
  const [loaded, setLoaded] = useState<ProfitLossRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const latest = useRef(0);
  const problem = rangeProblem(from, to);

  useEffect(() => {
    const range = currentFyRange();
    setFrom(range.from);
    setTo(range.to);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchPnL = async () => {
    const request = ++latest.current;
    setLoaded(null);
    setError(null);
    if (problem) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await reportsApi.getProfitAndLoss(orgId, { from, to });
      if (request === latest.current) setLoaded(res.data || []);
    } catch (err: any) {
      if (request === latest.current) setError(err.message || "Failed to load authoritative Profit & Loss report");
    } finally {
      if (request === latest.current) setIsLoading(false);
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
  }, [orgId, from, to]);

  const rows = loaded ?? [];
  const incomeAccounts = rows.filter((r) => r.account_type === "income");
  const expenseAccounts = rows.filter((r) => r.account_type === "expense");

  const totalIncome = incomeAccounts.reduce((sum, r) => sum + (r.net_amount || 0), 0);
  const totalExpense = expenseAccounts.reduce((sum, r) => sum + (r.net_amount || 0), 0);
  const netProfit = totalIncome - totalExpense;
  const isNetProfit = netProfit >= 0;
  const money = (v: number) => (loaded ? formatINR(v) : "–");

  const side = (title: string, total: number, head: string, accounts: ProfitLossRow[], empty: string) => (
    <div className={ui.panel}>
      <div className={ui.panelHead}>
        <h3 className={ui.panelTitle}>{title}</h3>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className={`${ui.th} w-24`}>Code</th>
            <th className={ui.th}>{head}</th>
            <th className={`${ui.th} text-right`}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {accounts.length > 0 ? (
            accounts.map((acc) => (
              <tr
                key={acc.account_id}
                onClick={() => router.push(`/day-book?account_code=${acc.account_code}`)}
                className={ui.rowLink}
              >
                <td className={`${ui.td} ${ui.code}`}>{acc.account_code}</td>
                <td className={ui.td}>{acc.account_name}</td>
                <td className={`${ui.td} text-right tabular-nums`}>
                  {formatINR(acc.net_amount, { showCurrencySymbol: false })}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="py-6 text-center text-ink-muted">
                {loaded ? empty : "–"}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className={ui.total}>Total</td>
            <td className={`${ui.total} text-right tabular-nums`}>{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className={ui.page}>
      {/* Reporting Toolbar */}
      <div className={ui.toolbar}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {loaded ? (
              <Badge variant={isNetProfit ? "success" : "danger"}>
                {isNetProfit ? "Net profit" : "Net loss"}: {formatINR(Math.abs(netProfit))}
              </Badge>
            ) : (
              <Badge variant="warning">Net result: –</Badge>
            )}
            <span className={ui.note}>From posted ledger entries</span>
          </div>
          <ReportDateRange from={from} to={to} onFrom={setFrom} onTo={setTo} problem={orgId ? problem : null} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => loaded && downloadFile(`profit-and-loss-${from}-to-${to}.csv`, profitLossCsv(loaded, from, to), "text/csv;charset=utf-8")}
            disabled={!loaded}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print statement
          </Button>
          <Button variant="secondary" onClick={fetchPnL} isLoading={isLoading} disabled={!!problem}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error && <ReportError title="Profit & Loss unavailable" message={error} onRetry={fetchPnL} />}

      {/* Summary KPI Strip */}
      <div data-tour="profit-loss-summary" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Revenue and income <ArrowUpRight className="ml-auto h-4 w-4 text-ok" />
          </div>
          <div className={ui.kpiValue}>{money(totalIncome)}</div>
        </div>

        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Expenses and overheads <ArrowDownRight className="ml-auto h-4 w-4 text-bad" />
          </div>
          <div className={ui.kpiValue}>{money(totalExpense)}</div>
        </div>

        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Net result for the period
            {loaded && (
              <Badge variant={isNetProfit ? "success" : "danger"} className="ml-auto">
                {isNetProfit ? "Surplus" : "Deficit"}
              </Badge>
            )}
          </div>
          <div className={`${ui.kpiValue} ${loaded ? (isNetProfit ? "text-ok" : "text-bad") : ""}`}>
            {loaded ? (
              <span className="ledger-total">
                {isNetProfit ? "+" : "-"}
                {formatINR(Math.abs(netProfit))}
              </span>
            ) : (
              "–"
            )}
          </div>
        </div>
      </div>

      {/* Detailed Dual-Column Statement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {side("Expenses and outflows", totalExpense, "Expense head", expenseAccounts, "No expense movements recorded.")}
        {side("Income and inflows", totalIncome, "Revenue head", incomeAccounts, "No revenue movements recorded.")}
      </div>
    </div>
  );
}
