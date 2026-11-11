"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { reportsApi } from "@/api/endpoints";
import { BalanceSheetRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { downloadFile } from "@/lib/download";
import { balanceSheetCsv } from "@/lib/import/export";
import { indiaToday } from "@/lib/reports/date-range";
import { ReportError, ui } from "@/modules/financial-reports/report-ui";

export function BalanceSheetView() {
  const router = useRouter();
  // Null until figures load, and after a failure: nothing to show must not read as zero.
  const [loaded, setLoaded] = useState<BalanceSheetRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("");
  const [asOf, setAsOf] = useState("");
  const latest = useRef(0);

  useEffect(() => {
    setAsOf(indiaToday());
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchBalanceSheet = async () => {
    const request = ++latest.current;
    setLoaded(null);
    setError(null);
    if (!asOf) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await reportsApi.getBalanceSheet(orgId, asOf);
      if (request === latest.current) setLoaded(res.data || []);
    } catch (err: any) {
      if (request === latest.current) setError(err.message || "Failed to load authoritative Balance Sheet report");
    } finally {
      if (request === latest.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchBalanceSheet();
    const handleUpdate = () => fetchBalanceSheet();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId, asOf]);

  const rows = loaded ?? [];
  const money = (v: number) => (loaded ? formatINR(v) : "–");
  const openLedger = (acc: BalanceSheetRow) => {
    if (acc.account_code) router.push(`/day-book?account_code=${acc.account_code}`);
  };
  const assetRows = rows.filter((r) => r.account_type === "asset");
  const liabilityRows = rows.filter((r) => r.account_type === "liability");
  const equityRows = rows.filter((r) => r.account_type === "equity");

  const totalAssets = assetRows.reduce((sum, r) => sum + (r.balance || 0), 0);
  const totalLiabilities = liabilityRows.reduce((sum, r) => sum + (r.balance || 0), 0);
  const totalEquity = equityRows.reduce((sum, r) => sum + (r.balance || 0), 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const difference = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
  const isBalanced = difference === 0;

  const section = (title: string, accounts: BalanceSheetRow[]) => (
    <>
      <div className={ui.band}>{title}</div>
      <table className="w-full text-left border-collapse">
        <tbody className="divide-y divide-line">
          {accounts.map((acc) => (
            <tr
              key={acc.account_id ?? "accumulated-profit"}
              onClick={() => openLedger(acc)}
              className={acc.account_code ? ui.rowLink : ""}
            >
              <td className={`${ui.td} ${ui.code} w-20`}>{acc.account_code}</td>
              <td className={ui.td}>{acc.account_name}</td>
              <td className={`${ui.td} text-right tabular-nums w-32`}>
                {formatINR(acc.balance, { showCurrencySymbol: false })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const side = (title: string, total: number, totalLabel: string, body: React.ReactNode) => (
    <div className={`${ui.panel} flex flex-col justify-between`}>
      <div>
        <div className={ui.panelHead}>
          <h3 className={ui.panelTitle}>{title}</h3>
        </div>
        {body}
      </div>
      <div className="flex items-center justify-between border-t border-line-strong px-3.5 py-3 font-semibold">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{loaded ? <span className="ledger-total">{money(total)}</span> : "–"}</span>
      </div>
    </div>
  );

  return (
    <div className={ui.page}>
      {/* Reporting Toolbar */}
      <div data-tour="balance-sheet-status" className={ui.toolbar}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {loaded ? (
              <Badge variant={isBalanced ? "success" : "warning"}>
                {isBalanced ? "Balance sheet balances" : `Difference: ${formatINR(difference)}`}
              </Badge>
            ) : (
              <Badge variant="warning">Difference: –</Badge>
            )}
            <span className={ui.note}>Double-entry balance sheet from posted ledger entries</span>
          </div>
          <div className="w-36">
            <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          {orgId && !asOf && (
            <p role="alert" className="text-[12.5px] font-medium text-bad">
              Choose a date to load this report.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => loaded && downloadFile(`balance-sheet-as-of-${asOf}.csv`, balanceSheetCsv(loaded, asOf), "text/csv;charset=utf-8")}
            disabled={!loaded}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print statement
          </Button>
          <Button variant="secondary" onClick={fetchBalanceSheet} isLoading={isLoading} disabled={!asOf}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error && <ReportError title="Balance Sheet unavailable" message={error} onRetry={fetchBalanceSheet} />}

      {/* T-Account Two Column Balance Sheet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Side: Liabilities & Equity */}
        {side(
          "Capital and liabilities",
          totalLiabilitiesAndEquity,
          "Total liabilities and equity",
          <>
            {section("Shareholders' funds and capital (equity)", equityRows)}
            {section("Current and non-current liabilities", liabilityRows)}
          </>
        )}

        {/* Right Side: Assets */}
        {side("Assets", totalAssets, "Total assets", section("Current and fixed assets", assetRows))}
      </div>
    </div>
  );
}
