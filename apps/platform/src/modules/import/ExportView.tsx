"use client";

import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { accountingApi, catalogueApi, partiesApi, reportsApi } from "@/api/endpoints";
import { downloadFile } from "@/lib/download";
import { accountsCsv, balanceSheetCsv, cashFlowCsv, dayBookCsv, itemsCsv, partiesCsv, profitLossCsv, trialBalanceCsv, TrialBalanceRow } from "@/lib/import/export";
import { currentFyRange, rangeProblem } from "@/lib/reports/date-range";

const today = () => new Date().toISOString().slice(0, 10);

export function ExportView() {
  const [orgId, setOrgId] = useState("");
  // Dates are set after mount: the page is prerendered, where the current time is not allowed.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrgId(localStorage.getItem("deku_active_org_id") || "");
    setFrom(`${today().slice(0, 8)}01`);
    setTo(today());
    const range = currentFyRange();
    setStatementFrom(range.from);
    setStatementTo(range.to);
  }, []);

  if (!orgId) return <p className="text-sm text-ink-muted">Select a company to export its data.</p>;

  const run = async (id: string, build: () => Promise<string>) => {
    setBusy(id);
    setError(null);
    try {
      downloadFile(`${id}-${today()}.csv`, await build(), "text/csv;charset=utf-8");
    } catch (e) {
      setError((e as Error).message || "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const exports = [
    { id: "chart-of-accounts", label: "Chart of accounts", build: async () => accountsCsv((await accountingApi.listAccounts(orgId)).data || []) },
    { id: "parties", label: "Parties", build: async () => partiesCsv((await partiesApi.list(orgId)).data || []) },
    { id: "items", label: "Items", build: async () => itemsCsv((await catalogueApi.list(orgId)).data || []) },
    {
      id: "trial-balance",
      label: "Trial balance",
      build: async () => trialBalanceCsv(((await reportsApi.getTrialBalance(orgId)).data || []) as TrialBalanceRow[]),
    },
  ];

  const period = { from: statementFrom, to: statementTo };
  const statements = [
    {
      id: "profit-and-loss",
      label: "Profit & loss",
      build: async () => profitLossCsv((await reportsApi.getProfitAndLoss(orgId, period)).data || [], statementFrom, statementTo),
    },
    {
      id: "balance-sheet",
      label: "Balance sheet as of To",
      build: async () => balanceSheetCsv((await reportsApi.getBalanceSheet(orgId, statementTo)).data || [], statementTo),
    },
    {
      id: "cash-flow",
      label: "Cash flow",
      build: async () =>
        cashFlowCsv((await reportsApi.getCashFlow(orgId, { start_date: statementFrom, end_date: statementTo })).data, statementFrom, statementTo),
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg border border-line bg-canvas p-3 text-sm text-ink">
          {error}
        </p>
      )}
      <section className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-3">
        <h2 className="text-sm font-semibold text-ink">Masters and reports</h2>
        <div data-tour="export-masters" className="flex flex-wrap gap-3">
          {exports.map((x) => (
            <Button key={x.id} variant="outline" isLoading={busy === x.id} onClick={() => run(x.id, x.build)}>
              <Download className="mr-2 h-4 w-4" />
              {x.label}
            </Button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-3">
        <h2 className="text-sm font-semibold text-ink">Financial statements</h2>
        <p className="text-xs text-ink-muted">Posted entries between the two dates. The balance sheet is as of the To date.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Input id="statement-from" label="From" type="date" value={statementFrom} onChange={(e) => setStatementFrom(e.target.value)} />
          </div>
          <div className="w-44">
            <Input id="statement-to" label="To" type="date" value={statementTo} onChange={(e) => setStatementTo(e.target.value)} />
          </div>
          {statements.map((x) => (
            <Button
              key={x.id}
              variant="outline"
              disabled={!!rangeProblem(statementFrom, statementTo)}
              isLoading={busy === x.id}
              onClick={() => run(x.id, x.build)}
            >
              <Download className="mr-2 h-4 w-4" />
              {x.label}
            </Button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-3">
        <h2 className="text-sm font-semibold text-ink">Journal day book</h2>
        <p className="text-xs text-ink-muted">Every posted voucher line between the two dates.</p>
        <div data-tour="export-day-book" className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-44">
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button
            variant="outline"
            disabled={!from || !to || from > to}
            isLoading={busy === "day-book"}
            onClick={() => run("day-book", async () => dayBookCsv((await reportsApi.getGeneralLedger(orgId)).data || [], from, to))}
          >
            <Download className="mr-2 h-4 w-4" />
            Day book
          </Button>
        </div>
      </section>
      <p className="text-xs text-ink-muted">Files are built in your browser from your own data. Tally XML export of vouchers is not available yet.</p>
    </div>
  );
}
