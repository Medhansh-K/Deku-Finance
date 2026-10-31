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
import { accountingApi, invoicesApi, partiesApi } from "@/api/endpoints";
import { Account, JournalEntry, Party, SalesInvoice } from "@/types/accounting";
import {
  ageBuckets,
  bucketOf,
  daysOutstanding,
  daysBetween,
  findControlAccount,
  partyBalances,
  toRupees,
} from "@/lib/reports/ledger";

const BUCKETS = [
  { id: "d0_30", label: "0–30 Days" },
  { id: "d31_60", label: "31–60 Days" },
  { id: "d61_90", label: "61–90 Days" },
  { id: "d90_plus", label: "Over 90 Days" },
] as const;

interface Books {
  accounts: Account[];
  journals: JournalEntry[];
  parties: Party[];
  invoices: SalesInvoice[];
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
      const [accounts, journals, parties, invoices] = await Promise.all([
        accountingApi.listAccounts(orgId),
        accountingApi.listJournals(orgId),
        partiesApi.list(orgId),
        invoicesApi.list(orgId),
      ]);
      setBooks({
        accounts: accounts.data ?? [],
        journals: journals.data ?? [],
        parties: parties.data ?? [],
        invoices: invoices.data ?? [],
        asOf: toISODateString(),
      });
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
  const receivablesAccount = useMemo(
    () => (books ? findControlAccount(books.accounts, "receivable") : undefined),
    [books]
  );
  const debtors = useMemo(
    () => (books && receivablesAccount ? partyBalances(books.journals, receivablesAccount.id, "receivable", asOf) : []),
    [books, receivablesAccount, asOf]
  );
  const partyById = useMemo(() => new Map((books?.parties ?? []).map((p) => [p.id, p])), [books]);
  // Issued invoices carry the journal they posted, which is how a due date reaches a ledger item.
  const invoiceByEntry = useMemo(
    () => new Map((books?.invoices ?? []).filter((i) => i.journal_entry_id).map((i) => [i.journal_entry_id!, i])),
    [books]
  );

  const totalReceivablesPaise = debtors.reduce((s, d) => s + d.balancePaise, 0);
  const dso = books && receivablesAccount
    ? daysOutstanding(books.journals, receivablesAccount.id, "receivable", totalReceivablesPaise, asOf)
    : null;
  const owing = debtors.filter((d) => d.balancePaise > 0);
  const overduePaise = debtors.reduce(
    (sum, d) =>
      sum +
      d.openItems
        .filter((i) => {
          const due = invoiceByEntry.get(i.entryId)?.due_date;
          return due && due < asOf;
        })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted font-mono mb-1">
            <Link href="/gateway" className="hover:text-brand transition-colors">
              Gateway
            </Link>
            <ChevronRight className="h-3 w-3 text-ink-subtle" />
            <span className="font-semibold text-ink">Trade Debtors (AR) &amp; DSO Tracking</span>
          </div>
          <h1 className="text-xl font-black text-ink tracking-tight">
            Trade Debtors &amp; Days Sales Outstanding (DSO) Tracker
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Accounts receivable aging analysis, customer exposure, outstanding invoices, and collection velocity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Link
            href="/vouchers/receipt"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-brand hover:bg-brand-soft text-panel-deep shadow-2xs transition-colors"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Record Receipt (F6)</span>
          </Link>
        </div>
      </div>

      {/* DSO KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Days Sales Outstanding
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-ink">
            {dso === null ? "–" : `${dso} Days`}
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            {dso === null ? "No credit sales posted" : "Receivables ÷ credit sales, last 365 days"}
          </span>
        </div>

        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Total Receivables (AR)
            </span>
            <span className="h-5 w-5 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <DollarSign className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-ink">
            {hasLedger ? formatINR(toRupees(totalReceivablesPaise)) : "–"}
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            {owing.length} {owing.length === 1 ? "customer owes" : "customers owe"}
          </span>
        </div>

        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Past Invoice Due Date
            </span>
            <span className="h-5 w-5 rounded bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="h-3 w-3" />
            </span>
          </div>
          <div className={`text-lg font-black font-mono ${overduePaise > 0 ? "text-rose-700" : "text-ink"}`}>
            {hasLedger ? formatINR(toRupees(overduePaise)) : "–"}
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            Only items posted from issued invoices have a due date
          </span>
        </div>

        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Older Than 60 Days
            </span>
            <span className="h-5 w-5 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <ShieldCheck className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-ink">
            {hasLedger ? formatINR(toRupees(buckets.d61_90 + buckets.d90_plus)) : "–"}
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            Unpaid since the invoice date
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-surface p-2.5 rounded-lg border border-line text-xs font-semibold overflow-x-auto">
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
                : "text-ink-soft hover:bg-canvas-sunken"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-ink-muted font-mono px-1">
        Balances from posted entries on {receivablesAccount ? `${receivablesAccount.code} ${receivablesAccount.name}` : "the trade debtors ledger"}.
        Receipts are matched to each customer&apos;s oldest invoice first.
      </p>

      {/* Debtors List with Expandable Invoices Breakdown */}
      <div className="space-y-3">
        {filteredDebtors.length === 0 && (
          <div className="bg-surface rounded-lg border border-line p-6 text-center text-xs text-ink-muted">
            {isLoading ? "Loading…" : emptyMessage}
          </div>
        )}
        {filteredDebtors.map((deb) => {
          const key = deb.partyId ?? "none";
          const party = deb.partyId ? partyById.get(deb.partyId) : undefined;
          const name = party ? party.display_name || party.legal_name : deb.partyId ? "Unknown party" : "No party on entry";
          const isExpanded = expandedId === key;
          return (
            <div
              key={key}
              className="bg-surface rounded-lg border border-line shadow-2xs overflow-hidden transition-all"
            >
              {/* Customer Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : key)}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-canvas transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 font-bold border border-amber-200">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink">{name}</span>
                      {deb.advancePaise > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-sunken text-ink-soft border border-line">
                          Advance {formatINR(toRupees(deb.advancePaise))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-muted font-mono mt-0.5">
                      <span>GSTIN: {party?.gstin || "–"}</span>
                      {party?.billing_address?.city && (
                        <>
                          <span>•</span>
                          <span>{[party.billing_address.city, party.billing_address.state].filter(Boolean).join(", ")}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-bold text-ink-soft">
                        {deb.openItems.length} open {deb.openItems.length === 1 ? "invoice" : "invoices"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-line">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-mono text-ink-muted uppercase font-semibold">
                      Oldest Unpaid
                    </div>
                    <div className="text-sm font-black font-mono text-ink">
                      {deb.oldestAgeDays === null ? "–" : `${deb.oldestAgeDays} Days`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-mono text-ink-muted uppercase font-semibold">
                      Total Balance Owed
                    </div>
                    <div className="text-base font-black font-mono text-amber-800">
                      {formatINR(toRupees(deb.balancePaise))}
                    </div>
                  </div>

                  <div className="h-7 w-7 rounded flex items-center justify-center bg-canvas-sunken text-ink-soft">
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
                <div className="border-t border-line bg-canvas/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-strong" />
                      <span>Outstanding Invoices Owed by {name}</span>
                    </span>
                    <Link
                      href="/gst"
                      className="text-xs text-brand-strong hover:underline font-bold flex items-center gap-1"
                    >
                      <span>View All Invoices</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="overflow-x-auto border border-line rounded bg-surface shadow-2xs">
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
                      <tbody className="divide-y divide-line">
                        {deb.openItems.map((item) => {
                          const inv = invoiceByEntry.get(item.entryId);
                          const overdueDays = inv?.due_date ? daysBetween(inv.due_date, asOf) : null;
                          return (
                            <tr key={item.entryId} className="hover:bg-canvas">
                              <td className="p-2.5 font-bold text-ink">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3 text-ink-subtle" />
                                  <span>{inv?.invoice_number ?? item.reference ?? item.entryNumber}</span>
                                </span>
                              </td>
                              <td className="p-2.5 text-ink-soft">{formatDateTally(item.date)}</td>
                              <td className="p-2.5 text-ink-soft">{inv?.due_date ? formatDateTally(inv.due_date) : "–"}</td>
                              <td className="p-2.5 text-right text-ink-soft">{formatINR(toRupees(item.amountPaise))}</td>
                              <td className="p-2.5 text-right font-bold text-amber-800">
                                {formatINR(toRupees(item.openPaise))}
                              </td>
                              <td className="p-2.5">
                                <span className="font-bold text-ink block">
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
                                  <span className="text-[10px] text-ink-muted">No due date</span>
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
