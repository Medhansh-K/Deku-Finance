"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { accountingApi, reportsApi } from "@/api/endpoints";
import { downloadFile } from "@/lib/download";
import { formatINR } from "@/lib/formatters/currency";
import { generalLedgerCsv } from "@/lib/import/export";
import { buildLedger } from "@/lib/reports/general-ledger";
import { ReportDateRange } from "@/modules/financial-reports/ReportDateRange";
import type { Account, GeneralLedgerRow } from "@/types/accounting";

const amount = (v: number) => (v > 0 ? formatINR(v, { showCurrencySymbol: false }) : "—");
const balance = (v: number) => formatINR(v, { showDrCr: true });

export function GeneralLedgerView() {
  const [orgId, setOrgId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Null until an account's rows load, and after a failure: nothing to show must not read as zero.
  const [rows, setRows] = useState<GeneralLedgerRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  // Dates are optional here, so only a reversed pair is a problem.
  const problem = from && to && from > to ? "From must be on or before To." : null;

  useEffect(() => {
    const saved = localStorage.getItem("deku_active_org_id");
    if (!saved) return;
    setOrgId(saved);
    accountingApi
      .listAccounts(saved)
      .then((res) => setAccounts(res.data || []))
      .catch((err) => setError(err.message || "Failed to load the chart of accounts"));
  }, []);

  const fetchLedger = async () => {
    const request = ++latest.current;
    setRows(null);
    setError(null);
    if (!accountId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // shortcut: the whole account's history comes to the browser for the opening balance; add a server total if an account outgrows this.
      const res = await reportsApi.getGeneralLedger(orgId, accountId);
      if (request === latest.current) setRows(res.data || []);
    } catch (err: any) {
      if (request === latest.current) setError(err.message || "Failed to load the General Ledger");
    } finally {
      if (request === latest.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchLedger();
    const handleUpdate = () => fetchLedger();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId, accountId]);

  const ledger = rows && !problem ? buildLedger(rows, from, to) : null;
  const account = accounts.find((a) => a.id === accountId);

  return (
    <div className="space-y-4 font-sans text-xs">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-surface p-3 rounded border border-line">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="ledger-account" className="block text-xs font-medium text-ink-soft">
              Account
            </label>
            <select
              id="ledger-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 min-w-64 max-w-full rounded-md border border-line-strong bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Choose an account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
          </div>
          <ReportDateRange from={from} to={to} onFrom={setFrom} onTo={setTo} problem={problem} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              ledger && downloadFile(`general-ledger-${account?.code ?? "account"}.csv`, generalLedgerCsv(ledger, from), "text/csv;charset=utf-8")
            }
            disabled={!ledger}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print Statement
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLedger} isLoading={isLoading} disabled={!accountId} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">General Ledger Unavailable</p>
              <p>{error}</p>
            </div>
          </div>
          {accountId && (
            <button onClick={fetchLedger} className="font-bold underline">
              Retry
            </button>
          )}
        </div>
      )}

      <div className="bg-surface border border-edge rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas-sunken border-b border-line-strong font-mono text-[11px] text-ink-soft">
                <th className="py-2 px-4 w-24">Date</th>
                <th className="py-2 px-4 w-36">Voucher No.</th>
                <th className="py-2 px-4">Narration</th>
                <th className="py-2 px-4">Party</th>
                <th className="py-2 px-4 text-right w-32">Debit (₹)</th>
                <th className="py-2 px-4 text-right w-32">Credit (₹)</th>
                <th className="py-2 px-4 text-right w-40">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ledger && ledger.opening !== null && (
                <tr className="bg-canvas font-medium text-ink">
                  <td className="py-2 px-4 font-mono">{from}</td>
                  <td className="py-2 px-4" />
                  <td className="py-2 px-4" colSpan={4}>
                    Opening balance
                  </td>
                  <td className="py-2 px-4 text-right font-mono font-bold">{balance(ledger.opening)}</td>
                </tr>
              )}
              {ledger?.lines.map((l) => (
                <tr key={l.line_id} className="text-ink">
                  <td className="py-2 px-4 font-mono">{l.entry_date}</td>
                  <td className="py-2 px-4 font-mono font-bold">{l.entry_number}</td>
                  <td className="py-2 px-4">{l.text}</td>
                  <td className="py-2 px-4">{l.party_name}</td>
                  <td className="py-2 px-4 text-right font-mono">{amount(l.debit)}</td>
                  <td className="py-2 px-4 text-right font-mono">{amount(l.credit)}</td>
                  <td className="py-2 px-4 text-right font-mono font-bold">{balance(l.balance)}</td>
                </tr>
              ))}
              {!ledger?.lines.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted font-mono">
                    {!accountId
                      ? "Choose an account to see its ledger."
                      : isLoading
                        ? "Loading ledger..."
                        : ledger
                          ? "No posted entries for this account in these dates."
                          : "–"}
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
