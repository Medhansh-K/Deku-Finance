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
  { id: "d0_30", label: "0–30 Days" },
  { id: "d31_60", label: "31–60 Days" },
  { id: "d61_90", label: "61–90 Days" },
  { id: "d90_plus", label: "Over 90 Days" },
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
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mb-1">
            <Link href="/gateway" className="hover:text-brand transition-colors">
              Gateway
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="font-semibold text-slate-900">Trade Debtors (AR) &amp; DSO Tracking</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Trade Debtors &amp; Days Sales Outstanding (DSO) Tracker
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accounts receivable aging analysis, customer exposure, outstanding invoices, and collection velocity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Link
            href="/vouchers/receipt"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-brand hover:bg-brand-soft text-ink shadow-2xs transition-colors"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Record Receipt (F6)</span>
          </Link>
        </div>
      </div>

      {/* DSO KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Days Sales Outstanding
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {dso === null ? "–" : `${dso} Days`}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {dso === null ? "No credit sales posted" : "Receivables ÷ credit sales, last 365 days"}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Total Receivables (AR)
            </span>
            <span className="h-5 w-5 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <DollarSign className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {hasLedger ? formatINR(toRupees(totalReceivablesPaise)) : "–"}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {owing.length} {owing.length === 1 ? "customer owes" : "customers owe"}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Past Invoice Due Date
            </span>
            <span className="h-5 w-5 rounded bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="h-3 w-3" />
            </span>
          </div>
          <div className={`text-lg font-black font-mono ${overduePaise > 0 ? "text-rose-700" : "text-slate-900"}`}>
            {hasLedger ? formatINR(toRupees(overduePaise)) : "–"}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Only items posted from issued invoices have a due date
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Older Than 60 Days
            </span>
            <span className="h-5 w-5 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <ShieldCheck className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {hasLedger ? formatINR(toRupees(buckets.d61_90 + buckets.d90_plus)) : "–"}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Unpaid since the invoice date
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-semibold overflow-x-auto">
        {[
          { id: "all", label: `All Debtors (${debtors.length})` },
          ...BUCKETS.map((b) => ({ id: b.id, label: `Oldest invoice ${b.label}` })),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveBucket(tab.id)}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeBucket === tab.id
                ? "bg-panel text-white font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 font-mono px-1">
        Balances from posted entries on {receivablesAccount ? `${receivablesAccount.code} ${receivablesAccount.name}` : "the trade debtors ledger"}.
        Receipts are matched to each customer&apos;s oldest invoice first.
      </p>

      {/* Debtors List with Expandable Invoices Breakdown */}
      <div className="space-y-3">
        {filteredDebtors.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-xs text-slate-500">
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
              className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all"
            >
              {/* Customer Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : key)}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 font-bold border border-amber-200">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{name}</span>
                      {deb.advancePaise > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          Advance {formatINR(toRupees(deb.advancePaise))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span>GSTIN: {deb.gstin || "–"}</span>
                      {deb.billingAddress?.city && (
                        <>
                          <span>•</span>
                          <span>{[deb.billingAddress.city, deb.billingAddress.state].filter(Boolean).join(", ")}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-bold text-slate-700">
                        {deb.openItems.length} open {deb.openItems.length === 1 ? "invoice" : "invoices"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      Oldest Unpaid
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900">
                      {deb.oldestAgeDays === null ? "–" : `${deb.oldestAgeDays} Days`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      Total Balance Owed
                    </div>
                    <div className="text-base font-black font-mono text-amber-800">
                      {formatINR(toRupees(deb.balancePaise))}
                    </div>
                  </div>

                  <div className="h-7 w-7 rounded flex items-center justify-center bg-slate-100 text-slate-600">
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
                <div className="border-t border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-strong" />
                      <span>Outstanding Invoices Owed by {name}</span>
                    </span>
                    <Link
                      href="/invoices"
                      className="text-xs text-brand-strong hover:underline font-bold flex items-center gap-1"
                    >
                      <span>View All Invoices</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded bg-white shadow-2xs">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-panel text-white text-[11px]">
                        <tr>
                          <th className="p-2.5">Invoice / Voucher #</th>
                          <th className="p-2.5">Issued Date</th>
                          <th className="p-2.5">Due Date</th>
                          <th className="p-2.5 text-right">Invoice Total</th>
                          <th className="p-2.5 text-right">Amount Owed</th>
                          <th className="p-2.5">From How Long (Aging)</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deb.openItems.map((item) => {
                          const overdueDays = item.dueDate ? daysBetween(item.dueDate, asOf) : null;
                          return (
                            <tr key={item.entryId} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-900">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3 text-slate-400" />
                                  <span>{item.invoiceNumber ?? item.reference ?? item.entryNumber}</span>
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600">{formatDateTally(item.date)}</td>
                              <td className="p-2.5 text-slate-600">{item.dueDate ? formatDateTally(item.dueDate) : "–"}</td>
                              <td className="p-2.5 text-right text-slate-700">{formatINR(toRupees(item.amountPaise))}</td>
                              <td className="p-2.5 text-right font-bold text-amber-800">
                                {formatINR(toRupees(item.openPaise))}
                              </td>
                              <td className="p-2.5">
                                <span className="font-bold text-slate-800 block">
                                  {item.ageDays} days ago
                                </span>
                                {overdueDays !== null && overdueDays > 0 && (
                                  <span className="text-[10px] text-rose-600 block">
                                    Overdue by {overdueDays} days
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                {overdueDays === null ? (
                                  <span className="text-[10px] text-slate-500">No due date</span>
                                ) : overdueDays > 0 ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                    OVERDUE
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                    CURRENT
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
