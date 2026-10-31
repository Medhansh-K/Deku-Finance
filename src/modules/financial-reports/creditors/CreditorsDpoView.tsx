"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
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
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mb-1">
            <Link href="/gateway" className="hover:text-brand transition-colors">
              Gateway
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="font-semibold text-slate-900">Trade Creditors (AP) &amp; DPO Tracking</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Trade Creditors &amp; Days Payable Outstanding (DPO) Tracker
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accounts payable to vendors, invoices issued by them, credit terms utilization, and scheduled payouts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Link
            href="/vouchers/payment"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-brand hover:bg-brand-soft text-ink shadow-2xs transition-colors"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Issue Payment Voucher (F5)</span>
          </Link>
        </div>
      </div>

      {/* DPO KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Days Payable Outstanding
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {dpo === null ? "–" : `${dpo} Days`}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {dpo === null ? "No credit purchases posted" : "Payables ÷ credit purchases, last 365 days"}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Total Payables (AP)
            </span>
            <span className="h-5 w-5 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <DollarSign className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {payablesAccount && books ? formatINR(toRupees(totalPayablesPaise)) : "–"}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {owed.length} {owed.length === 1 ? "vendor" : "vendors"} owed
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Older Than 60 Days
            </span>
            <span className="h-5 w-5 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <AlertTriangle className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-amber-800">
            {payablesAccount && books ? formatINR(toRupees(over60Paise)) : "–"}
          </div>
          <span className="text-[10px] text-amber-700 font-mono">
            Unpaid bills by bill date
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Credit Terms Compliance
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            –
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Vendor credit terms are not recorded
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-semibold overflow-x-auto">
        {[
          { id: "all", label: `All Vendors (${creditors.length})` },
          ...BUCKETS.map((b) => ({ id: b.id, label: `Oldest bill ${b.label}` })),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setBucketFilter(tab.id)}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              bucketFilter === tab.id
                ? "bg-panel text-white font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 font-mono px-1">
        Balances from posted entries on {payablesAccount ? `${payablesAccount.code} ${payablesAccount.name}` : "the trade creditors ledger"}.
        Payments are matched to each vendor&apos;s oldest bill first; due dates aren&apos;t recorded, so ageing runs from the bill date.
      </p>

      {/* Creditors List with Expandable Vendor Bills Breakdown */}
      <div className="space-y-3">
        {filteredCreditors.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-xs text-slate-500">
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
              className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all"
            >
              {/* Vendor Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : key)}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 font-bold border border-slate-200">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{name}</span>
                      {cred.advancePaise > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          Advance {formatINR(toRupees(cred.advancePaise))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span>GSTIN: {cred.gstin || "–"}</span>
                      {cred.billingAddress?.city && (
                        <>
                          <span>•</span>
                          <span>{[cred.billingAddress.city, cred.billingAddress.state].filter(Boolean).join(", ")}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-bold text-slate-700">
                        {cred.openItems.length} unpaid {cred.openItems.length === 1 ? "bill" : "bills"}
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
                      {cred.oldestAgeDays === null ? "–" : `${cred.oldestAgeDays} Days`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      Total We Owe
                    </div>
                    <div className="text-base font-black font-mono text-slate-900">
                      {formatINR(toRupees(cred.balancePaise))}
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

              {/* Expanded Vendor Bills Section */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-strong" />
                      <span>Unpaid Bills from {name}</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded bg-white shadow-2xs">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-panel text-white text-[11px]">
                        <tr>
                          <th className="p-2.5">Voucher # / Ref</th>
                          <th className="p-2.5">Bill Date</th>
                          <th className="p-2.5 text-right">Bill Total</th>
                          <th className="p-2.5 text-right">Balance We Owe</th>
                          <th className="p-2.5">Credit Age</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cred.openItems.map((bill) => (
                          <tr key={bill.entryId} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3 w-3 text-slate-400" />
                                <span>{bill.entryNumber}</span>
                              </span>
                              {bill.reference && (
                                <span className="text-[10px] text-slate-500 block">{bill.reference}</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600">{formatDateTally(bill.date)}</td>
                            <td className="p-2.5 text-right text-slate-700">{formatINR(toRupees(bill.amountPaise))}</td>
                            <td className="p-2.5 text-right font-bold text-slate-950">
                              {formatINR(toRupees(bill.openPaise))}
                            </td>
                            <td className="p-2.5">
                              <span className="font-bold text-slate-800 block">
                                {bill.ageDays} days since bill
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <Link
                                href="/vouchers/payment"
                                className="px-2.5 py-1 text-[10px] font-bold bg-panel text-white hover:bg-brand hover:text-ink rounded transition-colors inline-block"
                              >
                                Pay (F5)
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
