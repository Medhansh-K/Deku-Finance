"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Receipt,
  FileText,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { reportsApi } from "@/api/endpoints";
import { ageBuckets, bucketOf, KpiSnapshot, PartyBalance, toPartyBalances, toRupees } from "@/lib/reports/ledger";

const BUCKETS = [
  { id: "d0_30", label: "0–30 Days" },
  { id: "d31_60", label: "31–60 Days" },
  { id: "d61_90", label: "61–90 Days" },
  { id: "d90_plus", label: "Over 90 Days" },
] as const;

export function CreditorsDpoView() {
  const [orgId, setOrgId] = useState<string>("");
  const [books, setBooks] = useState<{ creditors: PartyBalance[]; kpis: KpiSnapshot } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState<string>("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const asOf = toISODateString();
      const [ageing, kpis] = await Promise.all([
        reportsApi.getPartyAgeing(orgId, "payable", asOf),
        reportsApi.getKpis(orgId, asOf, asOf),
      ]);
      setBooks({ creditors: toPartyBalances(ageing.data ?? []), kpis: kpis.data });
    } catch (e: any) {
      setBooks(null);
      setError(e?.message || "Could not load the books");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  const payablesAccount = books?.kpis.creditors_account ?? null;
  const creditors = useMemo(() => books?.creditors ?? [], [books]);

  const totalPayablesPaise = creditors.reduce((s, c) => s + c.balancePaise, 0);
  const dpo = books?.kpis.dpo_days ?? null;
  const buckets = ageBuckets(creditors);
  const over60Paise = buckets.d61_90 + buckets.d90_plus;
  const owed = creditors.filter((c) => c.balancePaise > 0);

  const filteredCreditors =
    bucketFilter === "all" ? creditors : creditors.filter((c) => bucketOf(c.oldestAgeDays) === bucketFilter);

  const emptyMessage = error
    ? error
    : !books
    ? "Loading the books…"
    : !payablesAccount
    ? "No trade creditors ledger in the chart of accounts (code 2010)."
    : creditors.length === 0
    ? "No vendor bills posted yet."
    : "No vendors in this ageing bucket.";

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Action & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand/10 border border-brand/20 rounded-lg text-brand-strong">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">
              Accounts Payable Aging Analysis &amp; Vendor Bills
            </h3>
            <p className="text-xs text-ink-muted">
              Vendor liability exposure, credit payment terms, aging brackets, and scheduled cash outflows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading} className="text-xs font-semibold">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Link
            href="/vouchers/payment"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-brand hover:bg-brand-soft text-panel-deep shadow-2xs transition-colors"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Issue Payment</span>
          </Link>
        </div>
      </div>

      {/* DPO KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Days Payable Outstanding
            </span>
            <span className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-ink">
            {dpo === null ? "–" : `${dpo} Days`}
          </div>
          <span className="text-[11px] text-ink-muted font-mono mt-1 block">
            {dpo === null ? "No credit purchases posted" : "Payables ÷ credit purchases, last 365 days"}
          </span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Total Payables (AP)
            </span>
            <span className="h-6 w-6 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-700">
            {payablesAccount && books ? formatINR(toRupees(totalPayablesPaise)) : "–"}
          </div>
          <span className="text-[11px] text-ink-muted font-mono mt-1 block">
            {owed.length} {owed.length === 1 ? "vendor" : "vendors"} owed
          </span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Older Than 60 Days
            </span>
            <span className="h-6 w-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700">
            {payablesAccount && books ? formatINR(toRupees(over60Paise)) : "–"}
          </div>
          <span className="text-[11px] text-ink-muted font-mono mt-1 block">
            Unpaid bills by bill date
          </span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Credit Terms Compliance
            </span>
            <span className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-ink">
            –
          </div>
          <span className="text-[11px] text-ink-muted font-mono mt-1 block">
            Vendor credit terms are not recorded
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-surface p-2 rounded-xl border border-line text-xs font-semibold overflow-x-auto shadow-2xs">
        {[
          { id: "all", label: `All Vendors (${creditors.length})` },
          ...BUCKETS.map((b) => ({ id: b.id, label: `Oldest bill ${b.label}` })),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setBucketFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              bucketFilter === tab.id
                ? "bg-brand text-panel-deep font-bold shadow-2xs"
                : "text-ink-soft hover:bg-canvas-sunken"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-ink-muted font-mono px-1">
        Balances from posted entries on {payablesAccount ? `${payablesAccount.code} ${payablesAccount.name}` : "the trade creditors ledger"}.
        Payments are matched to each vendor&apos;s oldest bill first; due dates aren&apos;t recorded, so ageing runs from the bill date.
      </p>

      {/* Creditors List with Expandable Vendor Bills Breakdown */}
      <div className="space-y-3">
        {filteredCreditors.length === 0 && (
          <div className="bg-surface rounded-xl border border-line p-8 text-center text-xs text-ink-muted shadow-2xs">
            {isLoading ? "Loading…" : emptyMessage}
          </div>
        )}
        {filteredCreditors.map((cred) => {
          const key = cred.partyId ?? "none";
          const name = cred.partyName ?? (cred.partyId ? "Unknown party" : "No party on entry");
          const isExpanded = expandedId === key;
          return (
            <div
              key={key}
              className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden transition-all"
            >
              {/* Vendor Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : key)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-canvas-sunken/40 transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-brand/10 text-brand-strong flex items-center justify-center shrink-0 font-bold border border-brand/20">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink">{name}</span>
                      {cred.advancePaise > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-sunken text-ink-soft border border-line">
                          Advance {formatINR(toRupees(cred.advancePaise))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-muted font-mono mt-0.5">
                      <span>GSTIN: {cred.gstin || "–"}</span>
                      {cred.billingAddress?.city && (
                        <>
                          <span>•</span>
                          <span>{[cred.billingAddress.city, cred.billingAddress.state].filter(Boolean).join(", ")}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-semibold text-ink-soft">
                        {cred.openItems.length} unpaid {cred.openItems.length === 1 ? "bill" : "bills"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-2 sm:pt-0 border-line">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-mono text-ink-muted uppercase font-semibold">
                      Oldest Unpaid
                    </div>
                    <div className="text-sm font-black font-mono text-ink">
                      {cred.oldestAgeDays === null ? "–" : `${cred.oldestAgeDays} Days`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-mono text-ink-muted uppercase font-semibold">
                      Total We Owe
                    </div>
                    <div className="text-base font-black font-mono text-rose-700">
                      {formatINR(toRupees(cred.balancePaise))}
                    </div>
                  </div>

                  <div className="h-7 w-7 rounded-md flex items-center justify-center bg-canvas-sunken text-ink-soft border border-line/60">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-brand-strong" : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Vendor Bills Section */}
              {isExpanded && (
                <div className="border-t border-line bg-canvas-sunken/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-strong" />
                      <span>Unpaid Bills from {name}</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-line rounded-lg bg-surface shadow-2xs">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-canvas-sunken border-b border-line text-ink-muted text-[11px] font-semibold">
                        <tr>
                          <th className="p-3">Voucher # / Ref</th>
                          <th className="p-3">Bill Date</th>
                          <th className="p-3 text-right">Bill Total</th>
                          <th className="p-3 text-right">Balance We Owe</th>
                          <th className="p-3">Credit Age</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {cred.openItems.map((bill) => (
                          <tr key={bill.entryId} className="hover:bg-canvas-sunken/50 transition-colors">
                            <td className="p-3 font-bold text-ink">
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-ink-subtle" />
                                <span>{bill.entryNumber}</span>
                              </span>
                              {bill.reference && (
                                <span className="text-[10px] text-ink-muted block mt-0.5">{bill.reference}</span>
                              )}
                            </td>
                            <td className="p-3 text-ink-soft">{formatDateTally(bill.date)}</td>
                            <td className="p-3 text-right text-ink font-semibold">{formatINR(toRupees(bill.amountPaise))}</td>
                            <td className="p-3 text-right font-bold text-rose-700">
                              {formatINR(toRupees(bill.openPaise))}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-ink block">
                                {bill.ageDays} days since bill
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <Link
                                href="/vouchers/payment"
                                className="px-2.5 py-1 text-xs font-bold bg-brand hover:bg-brand-soft text-panel-deep rounded-md shadow-2xs transition-colors inline-block"
                              >
                                Pay
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
