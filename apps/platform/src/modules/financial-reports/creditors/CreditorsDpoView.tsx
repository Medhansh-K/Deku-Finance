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
  { id: "d0_30", label: "0–30 days" },
  { id: "d31_60", label: "31–60 days" },
  { id: "d61_90", label: "61–90 days" },
  { id: "d90_plus", label: "over 90 days" },
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-panel border border-line bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">
              Accounts payable ageing and vendor bills
            </h3>
            <p className="text-[13px] text-ink-muted">
              Vendor exposure, payment terms, ageing brackets and scheduled cash outflows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link
            href="/vouchers/payment"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-ctl bg-ink text-white text-[13.5px] font-medium hover:bg-panel-raised transition-colors"
          >
            <Receipt className="h-4 w-4" />
            <span>Issue payment</span>
          </Link>
        </div>
      </div>

      {/* DPO KPI Summary Cards */}
      <div data-tour="creditors-summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Days payable outstanding</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {dpo === null ? "–" : `${dpo} days`}
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            {dpo === null ? "No credit purchases posted" : "Payables ÷ credit purchases, last 365 days"}
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Total payables (AP)</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {payablesAccount && books ? formatINR(toRupees(totalPayablesPaise)) : "–"}
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            {owed.length} {owed.length === 1 ? "vendor" : "vendors"} owed
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Older than 60 days</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {payablesAccount && books ? formatINR(toRupees(over60Paise)) : "–"}
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            Unpaid bills by bill date
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Credit terms compliance</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            –
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            Vendor credit terms are not recorded
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-0.5 p-[3px] rounded-[10px] bg-canvas-sunken text-[13.5px] overflow-x-auto w-fit max-w-full">
        {[
          { id: "all", label: `All vendors (${creditors.length})` },
          ...BUCKETS.map((b) => ({ id: b.id, label: `Oldest bill ${b.label}` })),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setBucketFilter(tab.id)}
            className={`px-3 py-1.5 rounded-[7px] transition-colors whitespace-nowrap cursor-pointer ${
              bucketFilter === tab.id
                ? "bg-surface text-ink font-medium shadow-[0_1px_2px_rgb(14_27_25/0.08)]"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] text-ink-muted px-1">
        Balances from posted entries on {payablesAccount ? `${payablesAccount.code} ${payablesAccount.name}` : "the trade creditors ledger"}.
        Payments are matched to each vendor&apos;s oldest bill first; due dates aren&apos;t recorded, so ageing runs from the bill date.
      </p>

      {/* Creditors List with Expandable Vendor Bills Breakdown */}
      <div className="space-y-3">
        {filteredCreditors.length === 0 && (
          <div className="rounded-panel border border-line bg-surface p-8 text-center text-[13.5px] text-ink-muted">
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
              className="rounded-panel border border-line bg-surface overflow-hidden"
            >
              {/* Vendor Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : key)}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-brand-wash/60 transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{name}</span>
                      {cred.advancePaise > 0 && (
                        <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-brand-wash text-brand-strong">
                          Advance {formatINR(toRupees(cred.advancePaise))}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted mt-0.5">
                      <span>GSTIN <span className="font-mono">{cred.gstin || "–"}</span></span>
                      {cred.billingAddress?.city && (
                        <>
                          <span>•</span>
                          <span>{[cred.billingAddress.city, cred.billingAddress.state].filter(Boolean).join(", ")}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-medium text-ink-soft">
                        {cred.openItems.length} unpaid {cred.openItems.length === 1 ? "bill" : "bills"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-2 sm:pt-0 border-line">
                  <div className="text-left sm:text-right">
                    <div className="text-[12.5px] text-ink-muted">
                      Oldest unpaid
                    </div>
                    <div className="text-[14px] font-semibold tabular-nums text-ink">
                      {cred.oldestAgeDays === null ? "–" : `${cred.oldestAgeDays} days`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[12.5px] text-ink-muted">
                      Total we owe
                    </div>
                    <div className="text-[15px] font-semibold tabular-nums text-ink">
                      {formatINR(toRupees(cred.balancePaise))}
                    </div>
                  </div>

                  <div className="h-7 w-7 rounded-ctl grid place-items-center text-ink-muted">
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
                <div className="border-t border-line bg-canvas-sunken/40 px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink-soft flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-strong" />
                      <span>Unpaid bills from {name}</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-line rounded-ctl bg-surface">
                    <table className="w-full text-left text-[13.5px]">
                      <thead className="bg-canvas-sunken/50 border-b border-line text-ink-muted text-[12.5px] font-medium">
                        <tr>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Voucher / ref</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Bill date</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap text-right">Bill total</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap text-right">Balance we owe</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Credit age</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {cred.openItems.map((bill) => (
                          <tr key={bill.entryId} className="hover:bg-brand-wash/60 transition-colors">
                            <td className="px-3.5 py-2.5 font-mono text-[12.5px] text-ink">
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-ink-subtle" />
                                <span>{bill.entryNumber}</span>
                              </span>
                              {bill.reference && (
                                <span className="font-sans text-[12.5px] text-ink-muted block mt-0.5">{bill.reference}</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-soft">{formatDateTally(bill.date)}</td>
                            <td className="px-3.5 py-2.5 text-right text-ink font-semibold">{formatINR(toRupees(bill.amountPaise))}</td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-ink">
                              {formatINR(toRupees(bill.openPaise))}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="text-ink block">
                                {bill.ageDays} days since bill
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <Link
                                href="/vouchers/payment"
                                className="inline-flex items-center h-7 px-2.5 rounded-ctl border border-line-strong bg-surface text-[13px] font-medium text-ink hover:bg-canvas transition-colors"
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
