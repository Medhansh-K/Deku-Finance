"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { reportsApi } from "@/api/endpoints";
import { BalanceSheetRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { downloadFile } from "@/lib/download";
import { balanceSheetCsv } from "@/lib/import/export";
import { indiaToday } from "@/lib/reports/date-range";

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

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Reporting Toolbar */}
      <div data-tour="balance-sheet-status" className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-surface p-3 rounded border border-line">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {loaded ? (
              <Badge variant={isBalanced ? "success" : "warning"}>
                {isBalanced ? "Balance Sheet Equated" : `Difference: ${formatINR(difference)}`}
              </Badge>
            ) : (
              <Badge variant="warning">Difference: –</Badge>
            )}
            <span className="text-ink-muted font-mono text-[11px]">
              ALERX Double-Entry Balance Sheet
            </span>
          </div>
          <div className="w-36">
            <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          {orgId && !asOf && (
            <p role="alert" className="text-xs font-medium text-rose-700">
              Choose a date to load this report.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loaded && downloadFile(`balance-sheet-as-of-${asOf}.csv`, balanceSheetCsv(loaded, asOf), "text/csv;charset=utf-8")}
            disabled={!loaded}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
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
            disabled={!asOf}
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
        <div className="bg-surface border border-edge rounded-lg shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-panel px-4 py-2 border-b border-edge text-white flex items-center justify-between font-mono">
              <span>Capital & Liabilities</span>
              <span className="text-slate-300 font-bold">
                {money(totalLiabilitiesAndEquity)}
              </span>
            </div>

            {/* Equity Section */}
            <div className="p-2 bg-canvas border-b border-line font-mono text-[11px] font-bold text-ink-soft">
              Shareholders&apos; Funds & Capital (Equity)
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-line">
                {equityRows.map((acc) => (
                  <tr
                    key={acc.account_id ?? "accumulated-profit"}
                    onClick={() => openLedger(acc)}
                    className={acc.account_code ? "hover:bg-canvas cursor-pointer" : ""}
                  >
                    <td className="py-2 px-3 font-mono font-bold text-ink-soft w-20">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-ink">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-ink w-32">
                      {formatINR(acc.balance, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Liabilities Section */}
            <div className="p-2 bg-canvas border-y border-line font-mono text-[11px] font-bold text-ink-soft mt-2">
              Current & Non-Current Liabilities
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-line">
                {liabilityRows.map((acc) => (
                  <tr
                    key={acc.account_id}
                    onClick={() =>
                      router.push(`/day-book?account_code=${acc.account_code}`)
                    }
                    className="hover:bg-canvas cursor-pointer"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-ink-soft w-20">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-ink">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-ink w-32">
                      {formatINR(acc.balance, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-panel text-white p-3 border-t-2 border-edge flex items-center justify-between font-mono font-bold">
            <span>Total Liabilities & Equity</span>
            <span className="text-emerald-400">
              {money(totalLiabilitiesAndEquity)}
            </span>
          </div>
        </div>

        {/* Right Side: Assets */}
        <div className="bg-surface border border-edge rounded-lg shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-panel px-4 py-2 border-b border-edge text-white flex items-center justify-between font-mono">
              <span>Assets (Property & Liquid Capital)</span>
              <span className="text-emerald-400 font-bold">
                {money(totalAssets)}
              </span>
            </div>

            <div className="p-2 bg-canvas border-b border-line font-mono text-[11px] font-bold text-ink-soft">
              Current & Fixed Assets
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-line">
                {assetRows.map((acc) => (
                  <tr
                    key={acc.account_id}
                    onClick={() =>
                      router.push(`/day-book?account_code=${acc.account_code}`)
                    }
                    className="hover:bg-canvas cursor-pointer"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-ink-soft w-20">
                      {acc.account_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-ink">
                      {acc.account_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-ink w-32">
                      {formatINR(acc.balance, { showCurrencySymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-panel text-white p-3 border-t-2 border-edge flex items-center justify-between font-mono font-bold">
            <span>Total Assets</span>
            <span className="text-emerald-400">{money(totalAssets)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
