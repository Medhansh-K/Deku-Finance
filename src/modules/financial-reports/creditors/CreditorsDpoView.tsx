"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
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
  ArrowDownRight,
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

export interface CreditorBillItem {
  bill_number: string;
  bill_date: string;
  due_date: string;
  total_amount: number;
  balance_owed: number;
  days_elapsed: number;
  is_overdue: boolean;
  terms: string;
}

export interface VendorCreditor {
  id: string;
  vendor_name: string;
  legal_name: string;
  gstin?: string;
  city: string;
  state: string;
  total_owed: number;
  dpo_days: number;
  agreed_terms: string;
  timing_status: "within_terms" | "due_soon" | "overdue";
  bills: CreditorBillItem[];
}

const DEFAULT_CREDITORS: Record<string, VendorCreditor[]> = {
  // 1. Deku Financial Technologies (Total: ₹1,15,000.00)
  "b127e064-5da8-437f-94c4-b8d6a0c12927": [
    {
      id: "cred-1",
      vendor_name: "Amazon Web Services India Pvt Ltd",
      legal_name: "Amazon Web Services India Pvt Ltd",
      gstin: "27AACA01234A1Z1",
      city: "Mumbai",
      state: "Maharashtra",
      total_owed: 42500,
      dpo_days: 22,
      agreed_terms: "Net 30 Days",
      timing_status: "within_terms",
      bills: [
        {
          bill_number: "AWS-INV-9921",
          bill_date: "2026-10-01",
          due_date: "2026-10-31",
          total_amount: 42500,
          balance_owed: 42500,
          days_elapsed: 22,
          is_overdue: false,
          terms: "Net 30",
        },
      ],
    },
    {
      id: "cred-2",
      vendor_name: "Dell India Technologies",
      legal_name: "Dell International Services India Pvt Ltd",
      gstin: "29AABCD3301D1Z4",
      city: "Bengaluru",
      state: "Karnataka",
      total_owed: 45000,
      dpo_days: 28,
      agreed_terms: "Net 30 Days",
      timing_status: "due_soon",
      bills: [
        {
          bill_number: "DELL-PO-3301",
          bill_date: "2026-09-25",
          due_date: "2026-10-25",
          total_amount: 185000,
          balance_owed: 45000,
          days_elapsed: 28,
          is_overdue: false,
          terms: "Net 30 (Remaining Balance)",
        },
      ],
    },
    {
      id: "cred-3",
      vendor_name: "Airtel Enterprise Telecommunications",
      legal_name: "Bharti Airtel Ltd",
      gstin: "27AAACB2882B1Z8",
      city: "Mumbai",
      state: "Maharashtra",
      total_owed: 27500,
      dpo_days: 14,
      agreed_terms: "Net 30 Days",
      timing_status: "within_terms",
      bills: [
        {
          bill_number: "AIRTEL-CORP-440",
          bill_date: "2026-10-09",
          due_date: "2026-11-08",
          total_amount: 27500,
          balance_owed: 27500,
          days_elapsed: 14,
          is_overdue: false,
          terms: "Net 30",
        },
      ],
    },
  ],

  // 2. All Might Logistics
  "b093d7d9-395a-429b-8c9a-af31b8b270f2": [
    {
      id: "cred-all-1",
      vendor_name: "Apollo Tyres Commercial",
      legal_name: "Apollo Tyres Ltd",
      gstin: "27AAACA7721A1ZQ",
      city: "Pune",
      state: "Maharashtra",
      total_owed: 190000,
      dpo_days: 15,
      agreed_terms: "Net 30 Days",
      timing_status: "within_terms",
      bills: [
        {
          bill_number: "APL-INV-772",
          bill_date: "2026-10-08",
          due_date: "2026-11-07",
          total_amount: 190000,
          balance_owed: 190000,
          days_elapsed: 15,
          is_overdue: false,
          terms: "Net 30",
        },
      ],
    },
    {
      id: "cred-all-2",
      vendor_name: "Indian Oil Fleet Services",
      legal_name: "Indian Oil Corporation Ltd",
      gstin: "27AAACI1681G1Z6",
      city: "Mumbai",
      state: "Maharashtra",
      total_owed: 145000,
      dpo_days: 12,
      agreed_terms: "Net 15 Days",
      timing_status: "due_soon",
      bills: [
        {
          bill_number: "IOCL-BULK-21",
          bill_date: "2026-10-11",
          due_date: "2026-10-26",
          total_amount: 345000,
          balance_owed: 145000,
          days_elapsed: 12,
          is_overdue: false,
          terms: "Net 15",
        },
      ],
    },
  ],
};

export function CreditorsDpoView() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string>("b127e064-5da8-437f-94c4-b8d6a0c12927");
  const [creditors, setCreditors] = useState<VendorCreditor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>("cred-1");
  const [timingFilter, setTimingFilter] = useState<string>("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const baseCreditors =
        DEFAULT_CREDITORS[orgId] || DEFAULT_CREDITORS["b127e064-5da8-437f-94c4-b8d6a0c12927"];
      setCreditors(baseCreditors);
      setExpandedId(baseCreditors[0]?.id || null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  // Aggregate DPO Metrics
  const totalPayables = useMemo(() => {
    return creditors.reduce((sum, c) => sum + c.total_owed, 0);
  }, [creditors]);

  const averageDpo = useMemo(() => {
    if (creditors.length === 0) return 0;
    return Math.round(creditors.reduce((sum, c) => sum + c.dpo_days, 0) / creditors.length);
  }, [creditors]);

  const dueSoonTotal = useMemo(() => {
    return creditors
      .filter((c) => c.timing_status === "due_soon")
      .reduce((sum, c) => sum + c.total_owed, 0);
  }, [creditors]);

  const filteredCreditors = useMemo(() => {
    if (timingFilter === "all") return creditors;
    return creditors.filter((c) => c.timing_status === timingFilter);
  }, [creditors, timingFilter]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mb-1">
            <Link href="/gateway" className="hover:text-[#5BB5BB] transition-colors">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-[#5BB5BB] hover:bg-[#91D7D2] text-[#0A0A0A] shadow-2xs transition-colors"
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
              Average DPO Velocity
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {averageDpo} Days
          </div>
          <span className="text-[10px] text-emerald-700 font-mono font-bold">
            Target 30–45d (Optimal Working Capital)
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
            {formatINR(totalPayables)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {creditors.length} Active Vendor Accounts
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Due This Week
            </span>
            <span className="h-5 w-5 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <AlertTriangle className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-amber-800">
            {formatINR(dueSoonTotal)}
          </div>
          <span className="text-[10px] text-amber-700 font-mono">
            Scheduled for Payout
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
          <div className="text-lg font-black font-mono text-emerald-700">
            100% On-Time
          </div>
          <span className="text-[10px] text-emerald-700 font-mono">
            Zero Default / Zero Penalty
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-semibold overflow-x-auto">
        {[
          { id: "all", label: `All Vendors (${creditors.length})` },
          { id: "within_terms", label: "Within Agreed Terms" },
          { id: "due_soon", label: "Due This Week" },
          { id: "overdue", label: "Overdue" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTimingFilter(tab.id)}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              timingFilter === tab.id
                ? "bg-[#1F2324] text-white font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Creditors List with Expandable Vendor Bills Breakdown ("invoices which are issued by them") */}
      <div className="space-y-3">
        {filteredCreditors.map((cred) => {
          const isExpanded = expandedId === cred.id;
          return (
            <div
              key={cred.id}
              className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all"
            >
              {/* Vendor Row Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : cred.id)}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 font-bold border border-slate-200">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{cred.vendor_name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {cred.agreed_terms}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span>GSTIN: {cred.gstin || "Unregistered"}</span>
                      <span>•</span>
                      <span>{cred.city}, {cred.state}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-700">
                        {cred.bills.length} vendor {cred.bills.length === 1 ? "bill" : "bills"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      DPO Velocity
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900">
                      {cred.dpo_days} Days
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      Total We Owe
                    </div>
                    <div className="text-base font-black font-mono text-slate-900">
                      {formatINR(cred.total_owed)}
                    </div>
                  </div>

                  <div className="h-7 w-7 rounded flex items-center justify-center bg-slate-100 text-slate-600">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-[#2D7A7A]" : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Vendor Bills Section ("invoices which are issued by them") */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-[#2D7A7A]" />
                      <span>Vendor Invoices Issued by {cred.vendor_name}</span>
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Payable against Goods &amp; Services received
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded bg-white shadow-2xs">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#1F2324] text-white text-[11px]">
                        <tr>
                          <th className="p-2.5">Vendor Bill / Inv #</th>
                          <th className="p-2.5">Bill Date</th>
                          <th className="p-2.5">Due Date</th>
                          <th className="p-2.5 text-right">Bill Total</th>
                          <th className="p-2.5 text-right">Balance We Owe</th>
                          <th className="p-2.5">Credit Age</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cred.bills.map((bill) => (
                          <tr key={bill.bill_number} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                              <FileText className="h-3 w-3 text-slate-400" />
                              <span>{bill.bill_number}</span>
                            </td>
                            <td className="p-2.5 text-slate-600">{formatDateTally(bill.bill_date)}</td>
                            <td className="p-2.5 text-slate-600">{formatDateTally(bill.due_date)}</td>
                            <td className="p-2.5 text-right text-slate-700">{formatINR(bill.total_amount)}</td>
                            <td className="p-2.5 text-right font-bold text-slate-950">
                              {formatINR(bill.balance_owed)}
                            </td>
                            <td className="p-2.5">
                              <span className="font-bold text-slate-800 block">
                                {bill.days_elapsed} days elapsed
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                Terms: {bill.terms}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                WITHIN TERMS
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <Link
                                href="/vouchers/payment"
                                className="px-2.5 py-1 text-[10px] font-bold bg-[#1F2324] text-white hover:bg-[#5BB5BB] hover:text-[#0A0A0A] rounded transition-colors inline-block"
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
