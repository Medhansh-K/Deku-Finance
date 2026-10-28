"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingDown,
  Layers,
  Receipt,
  Building2,
  User,
  Clock,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Briefcase,
  PieChart,
  Eye,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Printer,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { accountingApi } from "@/api/endpoints";

export interface PaymentVoucherExpense {
  id: string;
  voucher_number: string;
  voucher_date: string;
  payee_name: string;
  payee_type: "company" | "individual";
  department_id: string;
  department_name: string;
  department_code: string;
  expense_head: string;
  ledger_folio: string;
  payment_account: string;
  amount: number;
  narration: string;
  status: "posted" | "approved";
  lines: Array<{
    dr_cr: "Dr" | "Cr";
    account_name: string;
    amount: number;
    category: string;
  }>;
}

export interface DepartmentExpenseSummary {
  id: string;
  name: string;
  code: string;
  lead: string;
  total_spent: number;
  budget_allocated: number;
  color: string;
}

const DEFAULT_EXPENSE_VOUCHERS: Record<string, PaymentVoucherExpense[]> = {
  // 1. Deku Financial Technologies (Total OPEX: ₹4,20,000.00)
  "b127e064-5da8-437f-94c4-b8d6a0c12927": [
    {
      id: "pay-1",
      voucher_number: "PAY-2026-0035",
      voucher_date: "2026-10-14",
      payee_name: "Amazon Web Services India Pvt Ltd",
      payee_type: "company",
      department_id: "dept-eng",
      department_name: "Engineering & Product Innovation",
      department_code: "ENG",
      expense_head: "Cloud Server Hosting & Infra",
      ledger_folio: "LF-502",
      payment_account: "HDFC Operating Current A/c",
      amount: 42500,
      narration: "Cloud hosting & Rust ledger cluster computing instances",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Cloud Hosting & Infra Expense", amount: 36017, category: "Expense" },
        { dr_cr: "Dr", account_name: "Input IGST @ 18%", amount: 6483, category: "Asset" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 42500, category: "Asset" },
      ],
    },
    {
      id: "pay-2",
      voucher_number: "PAY-2026-0036",
      voucher_date: "2026-10-10",
      payee_name: "Google Cloud India",
      payee_type: "company",
      department_id: "dept-eng",
      department_name: "Engineering & Product Innovation",
      department_code: "ENG",
      expense_head: "AI API & Database Infrastructure",
      ledger_folio: "LF-502",
      payment_account: "HDFC Operating Current A/c",
      amount: 58000,
      narration: "Gemini 2.5 LLM token compute & document extraction OCR engine",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "AI API Infrastructure Expense", amount: 49152, category: "Expense" },
        { dr_cr: "Dr", account_name: "Input IGST @ 18%", amount: 8848, category: "Asset" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 58000, category: "Asset" },
      ],
    },
    {
      id: "pay-3",
      voucher_number: "PAY-2026-0037",
      voucher_date: "2026-10-05",
      payee_name: "GitHub Inc / Microsoft India",
      payee_type: "company",
      department_id: "dept-eng",
      department_name: "Engineering & Product Innovation",
      department_code: "ENG",
      expense_head: "Software Subscriptions & CI/CD",
      ledger_folio: "LF-502",
      payment_account: "HDFC Operating Current A/c",
      amount: 22000,
      narration: "GitHub Enterprise licenses & Actions build runner capacity",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Developer Tooling Expense", amount: 22000, category: "Expense" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 22000, category: "Asset" },
      ],
    },
    {
      id: "pay-4",
      voucher_number: "PAY-2026-0038",
      voucher_date: "2026-10-01",
      payee_name: "Ramesh Kumar (Property Owner)",
      payee_type: "individual",
      department_id: "dept-ga",
      department_name: "General & Administrative",
      department_code: "G&A",
      expense_head: "Office Premises Lease & Rent",
      ledger_folio: "LF-503",
      payment_account: "HDFC Operating Current A/c",
      amount: 65000,
      narration: "Corporate Headquarters Office Rent for Month of October 2026",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Office Rent & Premises Expense", amount: 65000, category: "Expense" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 65000, category: "Asset" },
      ],
    },
    {
      id: "pay-5",
      voucher_number: "PAY-2026-0039",
      voucher_date: "2026-09-28",
      payee_name: "Airtel Enterprise Telecommunications",
      payee_type: "company",
      department_id: "dept-ga",
      department_name: "General & Administrative",
      department_code: "G&A",
      expense_head: "Office Fiber Internet & Comms",
      ledger_folio: "LF-503",
      payment_account: "HDFC Operating Current A/c",
      amount: 13000,
      narration: "Dedicated 1Gbps Leased Line High Availability Office Internet",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Internet & Telecom Expense", amount: 11017, category: "Expense" },
        { dr_cr: "Dr", account_name: "Input CGST @ 9%", amount: 991.5, category: "Asset" },
        { dr_cr: "Dr", account_name: "Input SGST @ 9%", amount: 991.5, category: "Asset" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 13000, category: "Asset" },
      ],
    },
    {
      id: "pay-6",
      voucher_number: "PAY-2026-0040",
      voucher_date: "2026-09-25",
      payee_name: "Priya Sharma (Advocate & Solicitor)",
      payee_type: "individual",
      department_id: "dept-fin",
      department_name: "Finance, Accounts & Compliance",
      department_code: "FIN",
      expense_head: "Legal & Regulatory Compliance",
      ledger_folio: "LF-505",
      payment_account: "HDFC Operating Current A/c",
      amount: 26500,
      narration: "GST statutory filings, ROC compliances & license drafting retainer",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Legal & Professional Fees", amount: 26500, category: "Expense" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 26500, category: "Asset" },
      ],
    },
    {
      id: "pay-7",
      voucher_number: "PAY-2026-0041",
      voucher_date: "2026-09-20",
      payee_name: "Meta India Advertising / Google Ads",
      payee_type: "company",
      department_id: "dept-sal",
      department_name: "Sales, BD & Partnerships",
      department_code: "SAL",
      expense_head: "B2B Marketing & Lead Acquisition",
      ledger_folio: "LF-508",
      payment_account: "HDFC Operating Current A/c",
      amount: 48000,
      narration: "B2B Financial OS performance marketing & enterprise lead acquisition",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Marketing & Advertising Expense", amount: 40678, category: "Expense" },
        { dr_cr: "Dr", account_name: "Input IGST @ 18%", amount: 7322, category: "Asset" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 48000, category: "Asset" },
      ],
    },
    {
      id: "pay-8",
      voucher_number: "PAY-2026-0042",
      voucher_date: "2026-09-15",
      payee_name: "Suresh Patil (Facilities & Fleet Maintenance)",
      payee_type: "individual",
      department_id: "dept-ops",
      department_name: "Operations & Logistics Infrastructure",
      department_code: "OPS",
      expense_head: "Facilities & Operational Spares",
      ledger_folio: "LF-504",
      payment_account: "Cash-in-Hand Petty Account",
      amount: 85000,
      narration: "Hardware server rack ventilation, UPS battery backups & office repairs",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Operations & Maintenance Expense", amount: 85000, category: "Expense" },
        { dr_cr: "Cr", account_name: "Cash-in-Hand Petty Account", amount: 85000, category: "Asset" },
      ],
    },
    {
      id: "pay-9",
      voucher_number: "PAY-2026-0043",
      voucher_date: "2026-09-10",
      payee_name: "Datadog Cloud Observability",
      payee_type: "company",
      department_id: "dept-eng",
      department_name: "Engineering & Product Innovation",
      department_code: "ENG",
      expense_head: "APM & Telemetry Monitoring",
      ledger_folio: "LF-502",
      payment_account: "HDFC Operating Current A/c",
      amount: 60000,
      narration: "Real-time ledger audit log telemetry & distributed APM tracing",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Monitoring & APM Expense", amount: 60000, category: "Expense" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", amount: 60000, category: "Asset" },
      ],
    },
  ],

  // 2. All Might Logistics
  "b093d7d9-395a-429b-8c9a-af31b8b270f2": [
    {
      id: "pay-all-1",
      voucher_number: "PAY-2026-0088",
      voucher_date: "2026-10-17",
      payee_name: "Indian Oil Fleet Services",
      payee_type: "company",
      department_id: "dept-ops",
      department_name: "Operations & Logistics Infrastructure",
      department_code: "OPS",
      expense_head: "Fleet Fuel & Heavy Diesel",
      ledger_folio: "LF-504",
      payment_account: "SBI Commercial Operating A/c",
      amount: 345000,
      narration: "Commercial fleet heavy vehicle diesel bulk refueling",
      status: "posted",
      lines: [
        { dr_cr: "Dr", account_name: "Fleet Fuel Expense", amount: 345000, category: "Expense" },
        { dr_cr: "Cr", account_name: "SBI Commercial Operating A/c", amount: 345000, category: "Asset" },
      ],
    },
  ],
};

export function OperatingExpensesView() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string>("");
  const [vouchers, setVouchers] = useState<PaymentVoucherExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [payeeTypeFilter, setPayeeTypeFilter] = useState<"all" | "company" | "individual">("all");

  // Detail Modal
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucherExpense | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = DEFAULT_EXPENSE_VOUCHERS[orgId] ?? [];
      setVouchers(list);
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

  // Total OPEX
  const totalOpex = useMemo(() => {
    return vouchers.reduce((sum, v) => sum + v.amount, 0);
  }, [vouchers]);

  // Department-wise rollup
  const departmentSummaries = useMemo<DepartmentExpenseSummary[]>(() => {
    const map = new Map<string, DepartmentExpenseSummary>();
    const deptInfo: Record<string, { name: string; code: string; lead: string; budget: number; color: string }> = {
      "dept-eng": {
        name: "Engineering & Product",
        code: "ENG",
        lead: "Medhansh K. (Chief Architect)",
        budget: 250000,
        color: "bg-blue-600",
      },
      "dept-ga": {
        name: "General & Administrative",
        code: "G&A",
        lead: "R. Sharma (Head of People & Admin)",
        budget: 100000,
        color: "bg-purple-600",
      },
      "dept-ops": {
        name: "Operations & Facilities",
        code: "OPS",
        lead: "S. Patil (Logistics Director)",
        budget: 120000,
        color: "bg-amber-600",
      },
      "dept-sal": {
        name: "Sales, Marketing & BD",
        code: "SAL",
        lead: "A. Verma (VP Growth)",
        budget: 80000,
        color: "bg-emerald-600",
      },
      "dept-fin": {
        name: "Finance & Compliance",
        code: "FIN",
        lead: "Priya Sharma (Legal Counsel)",
        budget: 50000,
        color: "bg-rose-600",
      },
    };

    for (const v of vouchers) {
      const info = deptInfo[v.department_id] || {
        name: v.department_name,
        code: v.department_code,
        lead: "Department Lead",
        budget: 100000,
        color: "bg-slate-600",
      };

      if (map.has(v.department_id)) {
        map.get(v.department_id)!.total_spent += v.amount;
      } else {
        map.set(v.department_id, {
          id: v.department_id,
          name: info.name,
          code: info.code,
          lead: info.lead,
          total_spent: v.amount,
          budget_allocated: info.budget,
          color: info.color,
        });
      }
    }

    return Array.from(map.values());
  }, [vouchers]);

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (selectedDept !== "all" && v.department_id !== selectedDept) return false;
      if (payeeTypeFilter !== "all" && v.payee_type !== payeeTypeFilter) return false;
      return true;
    });
  }, [vouchers, selectedDept, payeeTypeFilter]);

  const columns: ColumnDef<PaymentVoucherExpense>[] = [
    {
      header: "Voucher # & Date",
      sortKey: (v) => v.voucher_number,
      cell: (v) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedVoucher(v);
            setIsDetailOpen(true);
          }}
          className="font-mono text-left group"
        >
          <div className="font-bold text-slate-900 group-hover:text-[#5BB5BB] group-hover:underline flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5 text-[#2D7A7A]" />
            <span>{v.voucher_number}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {formatDateTally(v.voucher_date)}
          </span>
        </button>
      ),
    },
    {
      header: "Issued To (Company / Individual)",
      sortKey: (v) => v.payee_name,
      cell: (v) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900 block text-xs">{v.payee_name}</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                v.payee_type === "company"
                  ? "bg-blue-50 text-blue-800 border border-blue-200"
                  : "bg-purple-50 text-purple-800 border border-purple-200"
              }`}
            >
              {v.payee_type === "company" ? "Company" : "Individual"}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate max-w-xs">
            {v.narration}
          </span>
        </div>
      ),
    },
    {
      header: "Department",
      sortKey: (v) => v.department_name,
      cell: (v) => (
        <div>
          <Badge variant="teal">{v.department_code}</Badge>
          <span className="text-[10px] text-slate-500 block mt-0.5 font-sans">
            {v.department_name}
          </span>
        </div>
      ),
    },
    {
      header: "Expense Ledger Head",
      cell: (v) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs">{v.expense_head}</span>
          <span className="font-mono text-[10px] text-slate-400">{v.ledger_folio}</span>
        </div>
      ),
    },
    {
      header: "Payment Source",
      cell: (v) => (
        <span className="text-slate-600 font-mono text-[11px] block">
          {v.payment_account}
        </span>
      ),
    },
    {
      header: "Amount (INR)",
      align: "right",
      sortKey: (v) => v.amount,
      cell: (v) => (
        <div className="text-right">
          <span className="font-mono text-xs font-black text-slate-950 block">
            {formatINR(v.amount)}
          </span>
          <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 inline-block">
            POSTED (F5)
          </span>
        </div>
      ),
    },
    {
      header: "Actions",
      align: "center",
      cell: (v) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedVoucher(v);
            setIsDetailOpen(true);
          }}
          className="p-1 text-slate-500 hover:text-[#5BB5BB] hover:bg-slate-100 rounded transition-colors"
          title="View Voucher Details & Double-Entry"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

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
            <span className="font-semibold text-slate-900">Operating Expenses &amp; Payment Vouchers</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Operating Expenses &amp; Issued Payment Vouchers (F5)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All payment vouchers issued to corporate entities and individuals, tracking department-wise spend allocations
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
            <span>Create Payment Voucher (F5)</span>
          </Link>
        </div>
      </div>

      {/* Top High-Level OPEX Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Total Operating Expenses
            </span>
            <span className="h-5 w-5 rounded bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <TrendingDown className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {formatINR(totalOpex)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            FY 2026-27 YTD Overhead
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Operating Expense Ratio
            </span>
            <span className="h-5 w-5 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <PieChart className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            33.7%
          </div>
          <span className="text-[10px] text-emerald-700 font-mono font-bold">
            66.3% Operating Margin
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Payment Vouchers Issued
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Receipt className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {vouchers.length} Vouchers
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Balanced Double-Entry Journals
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Active Departments
            </span>
            <span className="h-5 w-5 rounded bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Briefcase className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {departmentSummaries.length} Departments
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Tracked with Budget Limits
          </span>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Department-Wise Expense Tracking Cards & Progress Bars */}
      {/* ============================================================= */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#2D7A7A]" />
              <span>Department-Wise Expense Breakdown &amp; Budget Utilization</span>
            </h2>
            <p className="text-xs text-slate-500">
              Click on any department to isolate all payment vouchers issued under that department
            </p>
          </div>
          {selectedDept !== "all" && (
            <button
              onClick={() => setSelectedDept("all")}
              className="text-xs text-[#2D7A7A] hover:underline font-bold"
            >
              Reset to All Departments
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {departmentSummaries.map((dept) => {
            const isSelected = selectedDept === dept.id;
            const pct = totalOpex > 0 ? Math.round((dept.total_spent / totalOpex) * 100) : 0;
            const budgetPct = Math.min(100, Math.round((dept.total_spent / dept.budget_allocated) * 100));

            return (
              <div
                key={dept.id}
                onClick={() => setSelectedDept(isSelected ? "all" : dept.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "border-[#5BB5BB] bg-[#5BB5BB]/10 shadow-xs ring-1 ring-[#5BB5BB]"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                    {dept.code}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">{pct}% OPEX</span>
                </div>
                <div className="text-xs font-bold text-slate-900 truncate" title={dept.name}>
                  {dept.name}
                </div>
                <div className="text-sm font-black font-mono text-slate-950 mt-1">
                  {formatINR(dept.total_spent)}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#2D7A7A] h-full rounded-full transition-all"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                  <span>Budget: {formatINR(dept.budget_allocated)}</span>
                  <span className="font-bold text-slate-700">{budgetPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters Bar: Payee Type and Department Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-1 text-xs font-semibold overflow-x-auto">
          <span className="text-slate-400 text-[11px] font-mono mr-1">Payee:</span>
          {(["all", "company", "individual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPayeeTypeFilter(t)}
              className={`px-2.5 py-1 rounded capitalize transition-colors cursor-pointer ${
                payeeTypeFilter === t
                  ? "bg-[#1F2324] text-white font-bold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t === "all" ? "All Payees" : t === "company" ? "Companies (Vendors)" : "Individuals"}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-slate-500">
          Showing <strong>{filteredVouchers.length}</strong> of {vouchers.length} payment vouchers
        </div>
      </div>

      {/* Payment Vouchers Table */}
      <DataTable
        columns={columns}
        data={filteredVouchers}
        searchPlaceholder="Search vouchers by payee name, voucher number, narration, or expense head..."
        isLoading={isLoading}
        emptyMessage="No payment vouchers match the selected filter criteria."
        onRowClick={(v) => {
          setSelectedVoucher(v);
          setIsDetailOpen(true);
        }}
        pageSize={15}
      />

      {/* ------------------------------------------------------------- */}
      {/* Voucher Details & Double-Entry Posting Modal */}
      {/* ------------------------------------------------------------- */}
      {selectedVoucher && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Payment Voucher — ${selectedVoucher.voucher_number}`}
          description="Authoritative double-entry disbursement voucher and department expense record"
        >
          <div className="space-y-4 text-xs font-sans">
            {/* Header info */}
            <div className="bg-slate-50 p-3.5 rounded border border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Payment Voucher Number
                </span>
                <div className="text-base font-black font-mono text-slate-900">
                  {selectedVoucher.voucher_number}
                </div>
                <div className="text-xs text-slate-600 font-mono mt-0.5">
                  Issued: {formatDateTally(selectedVoucher.voucher_date)}
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Disbursed Amount
                </span>
                <div className="text-base font-black font-mono text-emerald-700">
                  {formatINR(selectedVoucher.amount)}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Source: {selectedVoucher.payment_account}
                </div>
              </div>
            </div>

            {/* Payee / Beneficiary Info */}
            <div className="p-3 bg-white rounded border border-slate-200">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block mb-1">
                Issued To (Payee / Beneficiary)
              </span>
              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                {selectedVoucher.payee_type === "company" ? (
                  <Building2 className="h-4 w-4 text-blue-600" />
                ) : (
                  <User className="h-4 w-4 text-purple-600" />
                )}
                <span>{selectedVoucher.payee_name}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedVoucher.payee_type}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-1">
                <strong>Department:</strong> {selectedVoucher.department_name} ({selectedVoucher.department_code})
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                <strong>Expense Head:</strong> {selectedVoucher.expense_head} ({selectedVoucher.ledger_folio})
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                <strong>Narration:</strong> {selectedVoucher.narration}
              </div>
            </div>

            {/* Double-Entry Journal Lines */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#1F2324] text-white text-[11px]">
                  <tr>
                    <th className="p-2">Type</th>
                    <th className="p-2">Account Name &amp; Category</th>
                    <th className="p-2 text-right">Debit (INR)</th>
                    <th className="p-2 text-right">Credit (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {selectedVoucher.lines.map((ln, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            ln.dr_cr === "Dr"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {ln.dr_cr}
                        </span>
                      </td>
                      <td className="p-2 font-sans font-medium text-slate-900">
                        {ln.account_name}
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {ln.category}
                        </span>
                      </td>
                      <td className="p-2 text-right font-bold text-slate-800">
                        {ln.dr_cr === "Dr" ? formatINR(ln.amount) : "—"}
                      </td>
                      <td className="p-2 text-right font-bold text-slate-800">
                        {ln.dr_cr === "Cr" ? formatINR(ln.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Payment Voucher</span>
              </button>

              <span className="text-[11px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Posted &amp; Audited</span>
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
