"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Printer, Wallet, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";
import { downloadFile } from "@/lib/download";
import { cashFlowCsv } from "@/lib/import/export";
import { currentFyRange, rangeProblem } from "@/lib/reports/date-range";
import { ReportDateRange } from "@/modules/financial-reports/ReportDateRange";
import { ReportError, ui } from "@/modules/financial-reports/report-ui";

export function CashFlowView() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const latest = useRef(0);
  const problem = rangeProblem(startDate, endDate);

  useEffect(() => {
    const range = currentFyRange();
    setStartDate(range.from);
    setEndDate(range.to);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchCashFlow = async () => {
    const request = ++latest.current;
    setData(null);
    setError(null);
    if (problem) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await reportsApi.getCashFlow(orgId, {
        start_date: startDate,
        end_date: endDate,
      });
      if (request === latest.current) setData(res.data);
    } catch (err: any) {
      if (request === latest.current) setError(err.message || "Failed to load Cash Flow Statement");
    } finally {
      if (request === latest.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchCashFlow();
    const handleUpdate = () => fetchCashFlow();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId, startDate, endDate]);

  // Keys from get_cash_flow_statement (migration 023). Nothing loaded shows "–", never a zero.
  const money = (v: number | undefined) => (v == null ? "–" : formatINR(v));
  const operating = {
    inflows: data?.operating_activities?.cash_receipts_from_sales as number | undefined,
    outflows: data?.operating_activities?.cash_paid_for_operations as number | undefined,
    net_operating_cash: data?.operating_activities?.net_cash_from_operating_activities as number | undefined,
  };
  const investing = { net_investing_cash: data?.investing_activities?.net_cash_used_in_investing as number | undefined };
  const financing = { net_financing_cash: data?.financing_activities?.net_cash_from_financing as number | undefined };
  const summary = {
    opening_cash: data?.opening_cash_equivalents as number | undefined,
    net_cash_flow: data?.net_change_in_cash as number | undefined,
    closing_cash: data?.closing_cash_equivalents as number | undefined,
  };

  const sign = (v: number | undefined, pos = "text-ok", neg = "text-bad") => (v == null ? "" : v >= 0 ? pos : neg);
  const activity = (title: string, net: number | undefined, netClass: string, lines: [string, React.ReactNode, string][]) => (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between text-[14px] font-semibold mb-2">
        <span>{title}</span>
        <span className={`tabular-nums ${netClass}`}>{money(net)}</span>
      </div>
      <div className="divide-y divide-line pl-4 border-l-2 border-line">
        {lines.map(([label, value, cls]) => (
          <div key={label} className="flex justify-between items-center gap-4 py-1.5">
            <span className="text-ink-soft">{label}</span>
            <span className={`tabular-nums font-medium ${cls}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`${ui.page} max-w-7xl mx-auto`}>
      {/* Top Action & Control Bar */}
      <div className={ui.toolbar}>
        <div className="flex items-start gap-3">
          <span className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <h3 className={ui.panelTitle}>Cash flow statement (direct method)</h3>
            <p className={ui.panelSub}>
              Operating, investing and financing activities from posted ledger journals
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div data-tour="cash-flow-period">
            <ReportDateRange from={startDate} to={endDate} onFrom={setStartDate} onTo={setEndDate} problem={orgId ? problem : null} />
          </div>
          <Button variant="secondary" onClick={fetchCashFlow} disabled={isLoading || !!problem}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={() => data && downloadFile(`cash-flow-${startDate}-to-${endDate}.csv`, cashFlowCsv(data, startDate, endDate), "text/csv;charset=utf-8")}
            disabled={!data}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {error && <ReportError title="Cash flow statement unavailable" message={error} onRetry={fetchCashFlow} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>Opening cash and bank</div>
          <div className={ui.kpiValue}>{money(summary.opening_cash)}</div>
          <div className={ui.kpiNote}>Balance at period start</div>
        </div>

        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Operating cash flow
            {operating.net_operating_cash == null ? null : operating.net_operating_cash >= 0 ? (
              <span className={`${ui.chip} ml-auto bg-ok-wash text-ok`}>
                <ArrowUpRight className="h-3 w-3" /> Positive
              </span>
            ) : (
              <span className={`${ui.chip} ml-auto bg-bad-wash text-bad`}>
                <ArrowDownRight className="h-3 w-3" /> Negative
              </span>
            )}
          </div>
          <div className={`${ui.kpiValue} ${sign(operating.net_operating_cash)}`}>{money(operating.net_operating_cash)}</div>
          <div className={ui.kpiNote}>Core business operations</div>
        </div>

        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>Net cash change</div>
          <div className={`${ui.kpiValue} ${sign(summary.net_cash_flow, "text-ink", "text-warn")}`}>{money(summary.net_cash_flow)}</div>
          <div className={ui.kpiNote}>Operating + investing + financing</div>
        </div>

        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Closing cash and bank <Badge variant="teal" className="ml-auto">Closing</Badge>
          </div>
          <div className={ui.kpiValue}>{money(summary.closing_cash)}</div>
          <div className={ui.kpiNote}>From posted ledger entries</div>
        </div>
      </div>

      {/* Main Statement Breakdown Table */}
      <div className={ui.panel}>
        <div className={`${ui.panelHead} border-b border-line`}>
          <h4 className={ui.panelTitle}>Statement of cash flows (direct method)</h4>
        </div>

        <div className="divide-y divide-line">
          {/* 1. Operating Activities */}
          {activity("A. Cash flows from operating activities", operating.net_operating_cash, sign(operating.net_operating_cash), [
            ["Cash receipts from customers and debtors (receivables collected)", operating.inflows == null ? "–" : `+${money(operating.inflows)}`, "text-ok"],
            ["Cash paid to suppliers, vendors and operating expenditure", operating.outflows == null ? "–" : `-${money(operating.outflows)}`, "text-bad"],
          ])}

          {/* 2. Investing Activities */}
          {activity("B. Cash flows from investing activities", investing.net_investing_cash, "", [
            ["Capital expenditure, office equipment and fixed asset additions", money(investing.net_investing_cash), ""],
          ])}

          {/* 3. Financing Activities */}
          {activity("C. Cash flows from financing activities", financing.net_financing_cash, "", [
            ["Capital contributions, partner drawings, debt financing and bank borrowings", money(financing.net_financing_cash), ""],
          ])}

          {/* Reconciliation Footers */}
          <div className="px-5 py-4 space-y-2.5">
            <div className="flex justify-between items-center gap-4 font-semibold">
              <span>Net increase / (decrease) in cash and cash equivalents (A + B + C)</span>
              <span className={`tabular-nums ${sign(summary.net_cash_flow)}`}>{money(summary.net_cash_flow)}</span>
            </div>
            <div className="flex justify-between items-center gap-4 text-ink-muted">
              <span>Cash and cash equivalents at beginning of period</span>
              <span className="tabular-nums text-ink-soft">{money(summary.opening_cash)}</span>
            </div>
            <div className="flex justify-between items-center gap-4 pt-3 border-t border-line-strong font-semibold text-[14px]">
              <span>Cash and cash equivalents at end of period</span>
              <span className="tabular-nums">
                {summary.closing_cash == null ? "–" : <span className="ledger-total">{money(summary.closing_cash)}</span>}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
