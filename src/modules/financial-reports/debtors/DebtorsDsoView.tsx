"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Search,
  Receipt,
  FileText,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { partiesApi } from "@/api/endpoints";
import { Party } from "@/types/accounting";

export interface DebtorInvoiceItem {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  balance_due: number;
  days_outstanding: number;
  is_overdue: boolean;
  overdue_days: number;
}

export interface CustomerDebtor {
  id: string;
  customer_name: string;
  legal_name: string;
  gstin?: string;
  city: string;
  state: string;
  total_owed: number;
  dso_days: number;
  credit_terms: string;
  aging_bucket: "0_15" | "16_30" | "31_45" | "over_45";
  invoices: DebtorInvoiceItem[];
}

const DEFAULT_DEBTORS: Record<string, CustomerDebtor[]> = {
  // 1. Deku Financial Technologies (Total: ₹2,60,000.00)
  "b127e064-5da8-437f-94c4-b8d6a0c12927": [
    {
      id: "deb-1",
      customer_name: "Apex Enterprise Systems India Pvt Ltd",
      legal_name: "Apex Enterprise Systems India Pvt Ltd",
      gstin: "27AACDF1234F1Z5",
      city: "Mumbai",
      state: "Maharashtra",
      total_owed: 118000,
      dso_days: 18,
      credit_terms: "Net 30 Days",
      aging_bucket: "16_30",
      invoices: [
        {
          invoice_number: "INV-2026-5360",
          invoice_date: "2026-10-05",
          due_date: "2026-10-25",
          total_amount: 118000,
          balance_due: 118000,
          days_outstanding: 18,
          is_overdue: false,
          overdue_days: 0,
        },
      ],
    },
    {
      id: "deb-2",
      customer_name: "Krypton Cloud Solutions LLP",
      legal_name: "Krypton Cloud Solutions LLP",
      gstin: "27AABCK9981K1Z2",
      city: "Pune",
      state: "Maharashtra",
      total_owed: 142000,
      dso_days: 25,
      credit_terms: "Net 30 Days",
      aging_bucket: "16_30",
      invoices: [
        {
          invoice_number: "INV-2026-5120",
          invoice_date: "2026-09-28",
          due_date: "2026-10-18",
          total_amount: 142000,
          balance_due: 142000,
          days_outstanding: 25,
          is_overdue: true,
          overdue_days: 5,
        },
      ],
    },
  ],

  // 2. All Might Logistics (Total: ₹4,72,000.00)
  "b093d7d9-395a-429b-8c9a-af31b8b270f2": [
    {
      id: "deb-all-1",
      customer_name: "Brimstone Cargo Express",
      legal_name: "Brimstone Cargo Express Pvt Ltd",
      gstin: "07AABCB5511B1ZX",
      city: "New Delhi",
      state: "Delhi",
      total_owed: 472000,
      dso_days: 22,
      credit_terms: "Net 15 Days",
      aging_bucket: "16_30",
      invoices: [
        {
          invoice_number: "INV-2026-4410",
          invoice_date: "2026-10-01",
          due_date: "2026-10-16",
          total_amount: 472000,
          balance_due: 472000,
          days_outstanding: 22,
          is_overdue: true,
          overdue_days: 7,
        },
      ],
    },
  ],
};

export function DebtorsDsoView() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string>("");
  const [debtors, setDebtors] = useState<CustomerDebtor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>("deb-1");
  const [activeBucket, setActiveBucket] = useState<string>("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const partyRes = await partiesApi.list(orgId).catch(() => ({ data: [] as Party[] }));
      const baseDebtors = DEFAULT_DEBTORS[orgId] ?? [];

      // Check if we have dynamic invoices in local storage
      const storageKey = `deku_invoices_${orgId}`;
      let cachedInvoices: any[] = [];
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          try {
            cachedInvoices = JSON.parse(raw);
          } catch (e) {}
        }
      }

      if (cachedInvoices.length > 0) {
        // Build live debtors from open invoices
        const openInvoices = cachedInvoices.filter(
          (inv) => inv.status === "issued" || inv.status === "overdue"
        );
        const map = new Map<string, CustomerDebtor>();

        for (const inv of openInvoices) {
          const custName = inv.customer_name || "Valued Customer";
          const invDate = new Date(inv.invoice_date);
          const now = new Date();
          const daysOut = Math.max(1, Math.round((now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));
          const dueDate = new Date(inv.due_date);
          const isOverdue = now > dueDate;
          const overdueDays = isOverdue ? Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

          const invItem: DebtorInvoiceItem = {
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            due_date: inv.due_date,
            total_amount: inv.total_amount,
            balance_due: inv.balance_due || inv.total_amount,
            days_outstanding: daysOut,
            is_overdue: isOverdue,
            overdue_days: overdueDays,
          };

          if (map.has(custName)) {
            const cur = map.get(custName)!;
            cur.total_owed += invItem.balance_due;
            cur.invoices.push(invItem);
            cur.dso_days = Math.round(
              cur.invoices.reduce((s, i) => s + i.days_outstanding, 0) / cur.invoices.length
            );
          } else {
            let bucket: "0_15" | "16_30" | "31_45" | "over_45" = "16_30";
            if (daysOut <= 15) bucket = "0_15";
            else if (daysOut <= 30) bucket = "16_30";
            else if (daysOut <= 45) bucket = "31_45";
            else bucket = "over_45";

            map.set(custName, {
              id: `deb-${inv.id}`,
              customer_name: custName,
              legal_name: custName,
              gstin: inv.customer_gstin,
              city: "Mumbai",
              state: "Maharashtra",
              total_owed: invItem.balance_due,
              dso_days: daysOut,
              credit_terms: "Net 30 Days",
              aging_bucket: bucket,
              invoices: [invItem],
            });
          }
        }

        if (map.size > 0) {
          setDebtors(Array.from(map.values()));
          setExpandedId(Array.from(map.values())[0]?.id || null);
          setIsLoading(false);
          return;
        }
      }

      setDebtors(baseDebtors);
      setExpandedId(baseDebtors[0]?.id || null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  // Aggregate DSO Metrics
  const totalReceivables = useMemo(() => {
    return debtors.reduce((sum, d) => sum + d.total_owed, 0);
  }, [debtors]);

  const averageDso = useMemo(() => {
    if (debtors.length === 0) return 0;
    return Math.round(debtors.reduce((sum, d) => sum + d.dso_days, 0) / debtors.length);
  }, [debtors]);

  const totalOverdue = useMemo(() => {
    return debtors.reduce((sum, d) => {
      const overdueSum = d.invoices
        .filter((i) => i.is_overdue)
        .reduce((s, i) => s + i.balance_due, 0);
      return sum + overdueSum;
    }, 0);
  }, [debtors]);

  const filteredDebtors = useMemo(() => {
    if (activeBucket === "all") return debtors;
    return debtors.filter((d) => d.aging_bucket === activeBucket);
  }, [debtors, activeBucket]);

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
              Average DSO Velocity
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {averageDso} Days
          </div>
          <span className="text-[10px] text-emerald-700 font-mono font-bold">
            Target &lt; 30d (Healthy Working Capital)
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
            {formatINR(totalReceivables)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {debtors.length} Customers with Open Invoices
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Overdue Past Terms
            </span>
            <span className="h-5 w-5 rounded bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="h-3 w-3" />
            </span>
          </div>
          <div className={`text-lg font-black font-mono ${totalOverdue > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {formatINR(totalOverdue)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {totalOverdue === 0 ? "0 Overdue > Terms" : "Requires Collections Followup"}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Standard Credit Terms
            </span>
            <span className="h-5 w-5 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <ShieldCheck className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            Net 30 Days
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            B2B Enterprise Standard
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-semibold overflow-x-auto">
        {[
          { id: "all", label: `All Debtors (${debtors.length})` },
          { id: "0_15", label: "0–15 Days (Current)" },
          { id: "16_30", label: "16–30 Days (Due Soon)" },
          { id: "31_45", label: "31–45 Days (Grace)" },
          { id: "over_45", label: "Over 45 Days (Critical)" },
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

      {/* Debtors List with Expandable Invoices Breakdown ("which invoices and from how long") */}
      <div className="space-y-3">
        {filteredDebtors.map((deb) => {
          const isExpanded = expandedId === deb.id;
          return (
            <div
              key={deb.id}
              className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all"
            >
              {/* Customer Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : deb.id)}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 font-bold border border-amber-200">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{deb.customer_name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {deb.credit_terms}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span>GSTIN: {deb.gstin || "Unregistered"}</span>
                      <span>•</span>
                      <span>{deb.city}, {deb.state}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-700">
                        {deb.invoices.length} open {deb.invoices.length === 1 ? "invoice" : "invoices"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      Customer DSO
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900">
                      {deb.dso_days} Days
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      Total Balance Owed
                    </div>
                    <div className="text-base font-black font-mono text-amber-800">
                      {formatINR(deb.total_owed)}
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

              {/* Expanded Invoices Section ("which invoices and from how long") */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-strong" />
                      <span>Outstanding Invoices Owed by {deb.customer_name}</span>
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
                          <th className="p-2.5">Invoice #</th>
                          <th className="p-2.5">Issued Date</th>
                          <th className="p-2.5">Due Date</th>
                          <th className="p-2.5 text-right">Invoice Total</th>
                          <th className="p-2.5 text-right">Amount Owed</th>
                          <th className="p-2.5">From How Long (Aging)</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deb.invoices.map((inv) => (
                          <tr key={inv.invoice_number} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">
                              <Link
                                href="/invoices"
                                className="hover:text-brand hover:underline flex items-center gap-1"
                              >
                                <FileText className="h-3 w-3 text-slate-400" />
                                <span>{inv.invoice_number}</span>
                              </Link>
                            </td>
                            <td className="p-2.5 text-slate-600">{formatDateTally(inv.invoice_date)}</td>
                            <td className="p-2.5 text-slate-600">{formatDateTally(inv.due_date)}</td>
                            <td className="p-2.5 text-right text-slate-700">{formatINR(inv.total_amount)}</td>
                            <td className="p-2.5 text-right font-bold text-amber-800">
                              {formatINR(inv.balance_due)}
                            </td>
                            <td className="p-2.5">
                              <span className="font-bold text-slate-800 block">
                                {inv.days_outstanding} days ago
                              </span>
                              {inv.is_overdue ? (
                                <span className="text-[10px] text-rose-600 block">
                                  Overdue by {inv.overdue_days} days
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 block">
                                  Within credit terms
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {inv.is_overdue ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                  OVERDUE
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  CURRENT
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <Link
                                href="/invoices"
                                className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-600 hover:text-white rounded transition-colors inline-block"
                              >
                                Collect / Convert
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
