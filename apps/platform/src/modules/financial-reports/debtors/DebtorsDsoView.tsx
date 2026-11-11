"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Receipt,
  FileText,
  DollarSign,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { reportsApi } from "@/api/endpoints";
import { ageBuckets, bucketOf, daysBetween, KpiSnapshot, PartyBalance, toPartyBalances, toRupees } from "@/lib/reports/ledger";

const BUCKETS = [
  { id: "d0_30", label: "0–30 days" },
  { id: "d31_60", label: "31–60 days" },
  { id: "d61_90", label: "61–90 days" },
  { id: "d90_plus", label: "over 90 days" },
] as const;

interface Books {
  debtors: PartyBalance[];
  kpis: KpiSnapshot;
  asOf: string;
}

export function DebtorsDsoView() {
  const [orgId, setOrgId] = useState<string>("");
  const [books, setBooks] = useState<Books | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<string>("all");

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
        reportsApi.getPartyAgeing(orgId, "receivable", asOf),
        reportsApi.getKpis(orgId, asOf, asOf),
      ]);
      setBooks({ debtors: toPartyBalances(ageing.data ?? []), kpis: kpis.data, asOf });
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

  const asOf = books?.asOf ?? "";
  const receivablesAccount = books?.kpis.debtors_account ?? null;
  const debtors = useMemo(() => books?.debtors ?? [], [books]);

  const totalReceivablesPaise = debtors.reduce((s, d) => s + d.balancePaise, 0);
  const dso = books?.kpis.dso_days ?? null;
  const owing = debtors.filter((d) => d.balancePaise > 0);
  const overduePaise = debtors.reduce(
    (sum, d) =>
      sum +
      d.openItems
        .filter((i) => i.dueDate && i.dueDate < asOf)
        .reduce((s, i) => s + i.openPaise, 0),
    0
  );
  const buckets = ageBuckets(debtors);
  const hasLedger = !!(books && receivablesAccount);

  const filteredDebtors =
    activeBucket === "all" ? debtors : debtors.filter((d) => bucketOf(d.oldestAgeDays) === activeBucket);

  const emptyMessage = error
    ? error
    : !books
    ? "Loading the books…"
    : !receivablesAccount
    ? "No trade debtors ledger in the chart of accounts (code 1030)."
    : debtors.length === 0
    ? "No customer invoices posted yet."
    : "No customers in this ageing bucket.";

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Action & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-panel border border-line bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">
              Accounts receivable ageing and invoices
            </h3>
            <p className="text-[13px] text-ink-muted">
              Customer exposure, overdue ageing brackets, outstanding invoices and collection speed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link
            href="/vouchers/receipt"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-ctl bg-ink text-white text-[13.5px] font-medium hover:bg-panel-raised transition-colors"
          >
            <Receipt className="h-4 w-4" />
            <span>Record receipt</span>
          </Link>
        </div>
      </div>

      {/* DSO KPI Summary Cards */}
      <div data-tour="debtors-summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Days sales outstanding</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {dso === null ? "–" : `${dso} days`}
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            {dso === null ? "No credit sales posted" : "Receivables ÷ credit sales, last 365 days"}
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Total receivables (AR)</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {hasLedger ? formatINR(toRupees(totalReceivablesPaise)) : "–"}
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            {owing.length} {owing.length === 1 ? "customer owes" : "customers owe"}
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Past invoice due date</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className={`mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums ${overduePaise > 0 ? "text-bad" : "text-ink"}`}>
            {hasLedger ? formatINR(toRupees(overduePaise)) : "–"}
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            Only items posted from issued invoices have a due date
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Older than 60 days</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {hasLedger ? formatINR(toRupees(buckets.d61_90 + buckets.d90_plus)) : "–"}
          </div>
          <span className="text-[12.5px] text-ink-muted block">
            Unpaid since the invoice date
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-0.5 p-[3px] rounded-[10px] bg-canvas-sunken text-[13.5px] overflow-x-auto w-fit max-w-full">
        {[
          { id: "all", label: `All debtors (${debtors.length})` },
          ...BUCKETS.map((b) => ({ id: b.id, label: `Oldest invoice ${b.label}` })),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveBucket(tab.id)}
            className={`px-3 py-1.5 rounded-[7px] transition-colors whitespace-nowrap cursor-pointer ${
              activeBucket === tab.id
                ? "bg-surface text-ink font-medium shadow-[0_1px_2px_rgb(14_27_25/0.08)]"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] text-ink-muted px-1">
        Balances from posted entries on {receivablesAccount ? `${receivablesAccount.code} ${receivablesAccount.name}` : "the trade debtors ledger"}.
        Receipts are matched to each customer&apos;s oldest invoice first.
      </p>

      {/* Debtors List with Expandable Invoices Breakdown */}
      <div className="space-y-3">
        {filteredDebtors.length === 0 && (
          <div className="rounded-panel border border-line bg-surface p-8 text-center text-[13.5px] text-ink-muted">
            {isLoading ? "Loading…" : emptyMessage}
          </div>
        )}
        {filteredDebtors.map((deb) => {
          const key = deb.partyId ?? "none";
          const name = deb.partyName ?? (deb.partyId ? "Unknown party" : "No party on entry");
          const isExpanded = expandedId === key;
          return (
            <div
              key={key}
              className="rounded-panel border border-line bg-surface overflow-hidden"
            >
              {/* Customer Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : key)}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-brand-wash/60 transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{name}</span>
                      {deb.advancePaise > 0 && (
                        <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-brand-wash text-brand-strong">
                          Advance {formatINR(toRupees(deb.advancePaise))}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted mt-0.5">
                      <span>GSTIN <span className="font-mono">{deb.gstin || "–"}</span></span>
                      {deb.billingAddress?.city && (
                        <>
                          <span>•</span>
                          <span>{[deb.billingAddress.city, deb.billingAddress.state].filter(Boolean).join(", ")}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-medium text-ink-soft">
                        {deb.openItems.length} open {deb.openItems.length === 1 ? "invoice" : "invoices"}
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
                      {deb.oldestAgeDays === null ? "–" : `${deb.oldestAgeDays} days`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[12.5px] text-ink-muted">
                      Balance owed
                    </div>
                    <div className="text-[15px] font-semibold tabular-nums text-ink">
                      {formatINR(toRupees(deb.balancePaise))}
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

              {/* Expanded Invoices Section */}
              {isExpanded && (
                <div className="border-t border-line bg-canvas-sunken/40 px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink-soft flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-strong" />
                      <span>Outstanding invoices owed by {name}</span>
                    </span>
                    <Link
                      href="/gst"
                      className="text-[13px] text-brand-strong hover:underline font-medium flex items-center gap-1"
                    >
                      <span>View all invoices</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="overflow-x-auto border border-line rounded-ctl bg-surface">
                    <table className="w-full text-left text-[13.5px]">
                      <thead className="bg-canvas-sunken/50 border-b border-line text-ink-muted text-[12.5px] font-medium">
                        <tr>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Invoice / voucher no.</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Issued</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Due date</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap text-right">Invoice total</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap text-right">Amount owed</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Ageing</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {deb.openItems.map((item) => {
                          const overdueDays = item.dueDate ? daysBetween(item.dueDate, asOf) : null;
                          return (
                            <tr key={item.entryId} className="hover:bg-brand-wash/60 transition-colors">
                              <td className="px-3.5 py-2.5 font-mono text-[12.5px] text-ink">
                                <span className="flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-ink-subtle" />
                                  <span>{item.invoiceNumber ?? item.reference ?? item.entryNumber}</span>
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-ink-soft">{formatDateTally(item.date)}</td>
                              <td className="px-3.5 py-2.5 text-ink-soft">{item.dueDate ? formatDateTally(item.dueDate) : "–"}</td>
                              <td className="px-3.5 py-2.5 text-right text-ink font-semibold">{formatINR(toRupees(item.amountPaise))}</td>
                              <td className="px-3.5 py-2.5 text-right font-semibold text-ink">
                                {formatINR(toRupees(item.openPaise))}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <span className="text-ink block">
                                  {item.ageDays} days ago
                                </span>
                                {overdueDays !== null && overdueDays > 0 && (
                                  <span className="text-[12.5px] text-bad block">
                                    Overdue by {overdueDays} days
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                {overdueDays === null ? (
                                  <span className="text-[12.5px] text-ink-muted">No due date</span>
                                ) : overdueDays > 0 ? (
                                  <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-bad-wash text-bad">
                                    Overdue
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-ok-wash text-ok">
                                    Current
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
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
