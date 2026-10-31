"use client";

import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { accountingApi, catalogueApi, partiesApi, reportsApi } from "@/api/endpoints";
import { downloadFile } from "@/lib/download";
import { accountsCsv, dayBookCsv, itemsCsv, partiesCsv, trialBalanceCsv, TrialBalanceRow } from "@/lib/import/export";

const today = () => new Date().toISOString().slice(0, 10);

export function ExportView() {
  const [orgId, setOrgId] = useState("");
  // Dates are set after mount: the page is prerendered, where the current time is not allowed.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrgId(localStorage.getItem("deku_active_org_id") || "");
    setFrom(`${today().slice(0, 8)}01`);
    setTo(today());
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

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg border border-line bg-canvas p-3 text-sm text-ink">
          {error}
        </p>
      )}
      <section className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-3">
        <h2 className="text-sm font-semibold text-ink">Masters and reports</h2>
        <div className="flex flex-wrap gap-3">
          {exports.map((x) => (
            <Button key={x.id} variant="outline" isLoading={busy === x.id} onClick={() => run(x.id, x.build)}>
              <Download className="mr-2 h-4 w-4" />
              {x.label}
            </Button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-3">
        <h2 className="text-sm font-semibold text-ink">Journal day book</h2>
        <p className="text-xs text-ink-muted">Every posted voucher line between the two dates.</p>
        <div className="flex flex-wrap items-end gap-3">
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
