"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { accountingApi, reportsApi } from "@/api/endpoints";
import { downloadFile } from "@/lib/download";
import { formatINR } from "@/lib/formatters/currency";
import { generalLedgerCsv } from "@/lib/import/export";
import { buildLedger } from "@/lib/reports/general-ledger";
import { ReportDateRange } from "@/modules/financial-reports/ReportDateRange";
import { ReportError, ui } from "@/modules/financial-reports/report-ui";
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
    <div className={ui.page}>
      <div className={ui.toolbar}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="ledger-account" className="block text-[13px] font-medium text-ink-soft">
              Account
            </label>
            <select data-tour="general-ledger-account"
              id="ledger-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={`${ui.select} min-w-64 max-w-full`}
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
            variant="secondary"
            onClick={() =>
              ledger && downloadFile(`general-ledger-${account?.code ?? "account"}.csv`, generalLedgerCsv(ledger, from), "text/csv;charset=utf-8")
            }
            disabled={!ledger}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print statement
          </Button>
          <Button variant="secondary" onClick={fetchLedger} isLoading={isLoading} disabled={!accountId}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error && <ReportError title="General Ledger unavailable" message={error} onRetry={accountId ? fetchLedger : undefined} />}

      <div className={ui.panel}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className={`${ui.th} w-24`}>Date</th>
                <th className={`${ui.th} w-36`}>Voucher no.</th>
                <th className={ui.th}>Narration</th>
                <th className={ui.th}>Party</th>
                <th className={`${ui.th} text-right w-32`}>Debit (₹)</th>
                <th className={`${ui.th} text-right w-32`}>Credit (₹)</th>
                <th className={`${ui.th} text-right w-40`}>Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ledger && ledger.opening !== null && (
                <tr className="bg-canvas-sunken/50 font-semibold">
                  <td className={`${ui.td} whitespace-nowrap`}>{from}</td>
                  <td className={ui.td} />
                  <td className={ui.td} colSpan={4}>
                    Opening balance
                  </td>
                  <td className={`${ui.td} text-right tabular-nums`}>{balance(ledger.opening)}</td>
                </tr>
              )}
              {ledger?.lines.map((l) => (
                <tr key={l.line_id}>
                  <td className={`${ui.td} whitespace-nowrap`}>{l.entry_date}</td>
                  <td className={`${ui.td} ${ui.code}`}>{l.entry_number}</td>
                  <td className={ui.td}>{l.text}</td>
                  <td className={ui.td}>{l.party_name}</td>
                  <td className={`${ui.td} text-right tabular-nums`}>{amount(l.debit)}</td>
                  <td className={`${ui.td} text-right tabular-nums`}>{amount(l.credit)}</td>
                  <td className={`${ui.td} text-right tabular-nums font-medium`}>{balance(l.balance)}</td>
                </tr>
              ))}
              {!ledger?.lines.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
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
