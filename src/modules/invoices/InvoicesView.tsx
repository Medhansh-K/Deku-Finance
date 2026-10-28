"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Printer,
  ArrowUpRight,
  Receipt,
  Download,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { invoicesApi, partiesApi } from "@/api/endpoints";
import { SalesInvoice, Party, SupplyType } from "@/types/accounting";
import { logUserActivity } from "@/lib/logging/activity-logger";

export interface TrackedInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_id?: string;
  customer_name: string;
  customer_gstin?: string;
  supply_type: SupplyType;
  place_of_supply: string;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: "draft" | "issued" | "converted" | "overdue" | "cancelled";
  converted_at?: string;
  receipt_voucher_number?: string;
  conversion_note?: string;
  organisation_id: string;
  items?: Array<{
    item_name: string;
    hsn_sac_code: string;
    quantity: number;
    unit_price: number;
    taxable_amount: number;
    gst_rate: number;
    total_amount: number;
  }>;
}


export function InvoicesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams?.get("status") || "all";

  const [orgId, setOrgId] = useState<string>("");
  const [invoices, setInvoices] = useState<TrackedInvoice[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"all" | "converted" | "issued" | "overdue" | "draft">(
    () => {
      if (["converted", "issued", "overdue", "draft"].includes(initialFilter)) {
        return initialFilter as any;
      }
      return "all";
    }
  );

  // Selected Invoice Modal
  const [selectedInvoice, setSelectedInvoice] = useState<TrackedInvoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Mark as Converted Modal
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [invoiceToConvert, setInvoiceToConvert] = useState<TrackedInvoice | null>(null);
  const [convertReceiptVoucher, setConvertReceiptVoucher] = useState("");
  const [convertPaymentMode, setConvertPaymentMode] = useState("HDFC Operating Current A/c");
  const [convertNote, setConvertNote] = useState("");

  // Create Invoice Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newInvNumber, setNewInvNumber] = useState("");
  const [newDate, setNewDate] = useState(toISODateString());
  const [newDueDate, setNewDueDate] = useState(toISODateString());
  const [newSupplyType, setNewSupplyType] = useState<SupplyType>("intra_state");
  const [newItemName, setNewItemName] = useState("Software Consulting & Financial OS");
  const [newHsn, setNewHsn] = useState("998315");
  const [newPrice, setNewPrice] = useState(100000);
  const [newGstRate, setNewGstRate] = useState(18);

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
      // 1. Fetch parties from backend
      const partRes = await partiesApi.list(orgId).catch(() => ({ data: [] as Party[] }));
      setCustomers((partRes.data || []).filter((p) => p.type === "customer"));

      // 2. Fetch backend invoices
      const invRes = await invoicesApi.list(orgId).catch(() => ({ data: [] as SalesInvoice[] }));

      // 3. Check local storage for persistent converted invoices
      const storageKey = `deku_invoices_${orgId}`;
      let cached: TrackedInvoice[] = [];
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          try {
            cached = JSON.parse(raw);
          } catch (e) {
            console.error("Failed to parse cached invoices", e);
          }
        }
      }

      if (cached.length === 0) {
        

        // Also merge any live backend invoices
        if (invRes.data && invRes.data.length > 0) {
          for (const bi of invRes.data) {
            const exists = cached.some((c) => c.invoice_number === bi.invoice_number);
            if (!exists) {
              cached.unshift({
                id: bi.id,
                invoice_number: bi.invoice_number,
                invoice_date: bi.invoice_date,
                due_date: bi.due_date,
                customer_name: (bi as any).customer_snapshot?.legal_name || bi.parties?.legal_name || "Customer Account",
                customer_gstin: (bi as any).customer_snapshot?.gstin || bi.parties?.gstin || undefined,
                supply_type: bi.supply_type,
                place_of_supply: bi.place_of_supply,
                taxable_amount: Number(bi.taxable_amount) || 0,
                cgst_amount: Number((bi as any).cgst_amount) || 0,
                sgst_amount: Number((bi as any).sgst_amount) || 0,
                igst_amount: Number((bi as any).igst_amount) || 0,
                total_tax: Number((bi as any).total_tax) || Math.max(0, Number(bi.total_amount) - Number(bi.taxable_amount)),
                total_amount: Number(bi.total_amount) || 0,
                amount_paid: bi.status === "issued" ? 0 : Number(bi.total_amount),
                balance_due: bi.status === "issued" ? Number(bi.total_amount) : 0,
                status: bi.status === "issued" ? "issued" : "draft",
                organisation_id: orgId,
              });
            }
          }
        }
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(cached));
        }
      }

      setInvoices(cached);
    } catch (err: any) {
      setError(err.message || "Failed to load sales invoices");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId]);

  // Aggregate metrics
  const totalBilledTurnover = useMemo(() => {
    return invoices
      .filter((inv) => inv.status !== "cancelled" && inv.status !== "draft")
      .reduce((sum, inv) => sum + inv.total_amount, 0);
  }, [invoices]);

  const totalConverted = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "converted")
      .reduce((sum, inv) => sum + inv.amount_paid, 0);
  }, [invoices]);

  const totalPending = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "issued" || inv.status === "overdue")
      .reduce((sum, inv) => sum + inv.balance_due, 0);
  }, [invoices]);

  const conversionRate = useMemo(() => {
    if (totalBilledTurnover === 0) return 0;
    return Math.round((totalConverted / totalBilledTurnover) * 100);
  }, [totalBilledTurnover, totalConverted]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeTab === "all") return true;
      return inv.status === activeTab;
    });
  }, [invoices, activeTab]);

  // Mark invoice as converted (paid / collected)
  const handleConfirmConvert = () => {
    if (!invoiceToConvert) return;
    const vchNo = convertReceiptVoucher.trim() || `RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const updated = invoices.map((inv) => {
      if (inv.id === invoiceToConvert.id) {
        return {
          ...inv,
          status: "converted" as const,
          amount_paid: inv.total_amount,
          balance_due: 0,
          converted_at: toISODateString(),
          receipt_voucher_number: vchNo,
          conversion_note: convertNote || `Settled via ${convertPaymentMode} (Receipt ${vchNo})`,
        };
      }
      return inv;
    });

    setInvoices(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`deku_invoices_${orgId}`, JSON.stringify(updated));
    }

    logUserActivity({
      category: "VOUCHER",
      crud_type: "CREATE",
      action: "Invoice Converted & Paid",
      description: `Converted sales invoice #${invoiceToConvert.invoice_number} against receipt voucher #${vchNo} for ${formatINR(invoiceToConvert.total_amount)}`,
      entity_type: "invoice",
      entity_id: invoiceToConvert.invoice_number,
      organisation_id: orgId,
      status: "success",
      metadata: {
        invoice_number: invoiceToConvert.invoice_number,
        amount: invoiceToConvert.total_amount,
        receipt_voucher: vchNo,
        payment_mode: convertPaymentMode,
      },
    });

    setIsConvertModalOpen(false);
    setInvoiceToConvert(null);
    if (selectedInvoice && selectedInvoice.id === invoiceToConvert.id) {
      setSelectedInvoice({
        ...selectedInvoice,
        status: "converted",
        amount_paid: selectedInvoice.total_amount,
        balance_due: 0,
        converted_at: toISODateString(),
        receipt_voucher_number: vchNo,
        conversion_note: convertNote || `Settled via ${convertPaymentMode} (Receipt ${vchNo})`,
      });
    }
  };

  // Open Create Invoice Modal
  const openCreateModal = () => {
    setNewInvNumber(`INV-2026-${Math.floor(5400 + Math.random() * 4000)}`);
    setNewDate(toISODateString());
    setNewDueDate(toISODateString());
    setNewCustomer(customers[0]?.legal_name || "Acme Software Labs India");
    setNewPrice(100000);
    setNewGstRate(18);
    setIsCreateOpen(true);
  };

  // Handle Save New Invoice
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const taxable = newPrice;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (newSupplyType === "intra_state") {
      cgst = Math.round((taxable * (newGstRate / 2)) / 100);
      sgst = Math.round((taxable * (newGstRate / 2)) / 100);
    } else {
      igst = Math.round((taxable * newGstRate) / 100);
    }
    const totalTax = cgst + sgst + igst;
    const totalAmount = taxable + totalTax;

    const newInv: TrackedInvoice = {
      id: `inv-${Date.now()}`,
      invoice_number: newInvNumber,
      invoice_date: newDate,
      due_date: newDueDate,
      customer_name: newCustomer,
      supply_type: newSupplyType,
      place_of_supply: newSupplyType === "intra_state" ? "27-Maharashtra" : "07-Delhi",
      taxable_amount: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total_tax: totalTax,
      total_amount: totalAmount,
      amount_paid: 0,
      balance_due: totalAmount,
      status: "issued",
      organisation_id: orgId,
      items: [
        {
          item_name: newItemName,
          hsn_sac_code: newHsn,
          quantity: 1,
          unit_price: taxable,
          taxable_amount: taxable,
          gst_rate: newGstRate,
          total_amount: totalAmount,
        },
      ],
    };

    const updated = [newInv, ...invoices];
    setInvoices(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`deku_invoices_${orgId}`, JSON.stringify(updated));
    }

    logUserActivity({
      category: "VOUCHER",
      crud_type: "CREATE",
      action: "Sales Invoice Issued",
      description: `Issued sales invoice #${newInvNumber} for ${formatINR(totalAmount)} to ${newCustomer}`,
      entity_type: "invoice",
      entity_id: newInvNumber,
      organisation_id: orgId,
      status: "success",
      metadata: {
        invoice_number: newInvNumber,
        customer_name: newCustomer,
        amount: totalAmount,
      },
    });

    setIsCreateOpen(false);
  };

  const columns: ColumnDef<TrackedInvoice>[] = [
    {
      header: "Invoice No.",
      sortKey: (inv) => inv.invoice_number,
      cell: (inv) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedInvoice(inv);
            setIsDetailOpen(true);
          }}
          className="font-mono font-bold text-slate-900 hover:text-brand hover:underline flex items-center gap-1 text-left"
          title="Click to view complete invoice & double-entry trace"
        >
          <FileText className="h-3.5 w-3.5 text-brand-strong" />
          <span>{inv.invoice_number}</span>
        </button>
      ),
    },
    {
      header: "Dates",
      sortKey: (inv) => inv.invoice_date,
      cell: (inv) => (
        <div className="font-mono text-xs">
          <span className="text-slate-900 block">{formatDateTally(inv.invoice_date)}</span>
          <span className="text-[10px] text-slate-400">Due: {formatDateTally(inv.due_date)}</span>
        </div>
      ),
    },
    {
      header: "Customer Name & GSTIN",
      sortKey: (inv) => inv.customer_name,
      cell: (inv) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{inv.customer_name}</span>
          <span className="font-mono text-[10px] text-slate-500">
            {inv.customer_gstin ? `GSTIN: ${inv.customer_gstin}` : "Unregistered Counterparty"}
          </span>
        </div>
      ),
    },
    {
      header: "Supply Type",
      cell: (inv) => (
        <Badge variant={inv.supply_type === "intra_state" ? "teal" : "warning"}>
          {inv.supply_type === "intra_state" ? "Intra-State (CGST+SGST)" : "Inter-State (IGST)"}
        </Badge>
      ),
    },
    {
      header: "Taxable Value",
      align: "right",
      sortKey: (inv) => inv.taxable_amount,
      cell: (inv) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {formatINR(inv.taxable_amount)}
        </span>
      ),
    },
    {
      header: "Invoice Total",
      align: "right",
      sortKey: (inv) => inv.total_amount,
      cell: (inv) => (
        <div className="text-right">
          <span className="font-mono text-xs font-black text-slate-950 block">
            {formatINR(inv.total_amount)}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Tax: {formatINR(inv.total_tax)}
          </span>
        </div>
      ),
    },
    {
      header: "Conversion / Tracking",
      cell: (inv) => {
        if (inv.status === "converted") {
          return (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                CONVERTED / PAID
              </span>
              {inv.receipt_voucher_number && (
                <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                  Ref: {inv.receipt_voucher_number}
                </span>
              )}
            </div>
          );
        }
        if (inv.status === "overdue") {
          return (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300">
                <AlertCircle className="h-3 w-3 text-rose-600" />
                OVERDUE
              </span>
              <span className="block text-[10px] text-rose-600 font-mono mt-0.5">
                Due: {formatINR(inv.balance_due)}
              </span>
            </div>
          );
        }
        if (inv.status === "issued") {
          return (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                <Clock className="h-3 w-3 text-blue-600" />
                ISSUED / OPEN
              </span>
              <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                Bal: {formatINR(inv.balance_due)}
              </span>
            </div>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
            DRAFT
          </span>
        );
      },
    },
    {
      header: "Actions",
      align: "center",
      cell: (inv) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setSelectedInvoice(inv);
              setIsDetailOpen(true);
            }}
            className="p-1 text-slate-500 hover:text-brand hover:bg-slate-100 rounded transition-colors"
            title="Preview Invoice & Trace"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {inv.status !== "converted" && (
            <button
              onClick={() => {
                setInvoiceToConvert(inv);
                setConvertReceiptVoucher(`RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`);
                setConvertNote(`Full payment received against ${inv.invoice_number}`);
                setIsConvertModalOpen(true);
              }}
              className="px-2 py-0.5 text-[10px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-600 hover:text-white rounded transition-colors"
              title="Record customer receipt and mark invoice as converted"
            >
              Convert / Pay
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mb-1">
            <Link href="/gateway" className="hover:text-brand transition-colors">
              Gateway
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="font-semibold text-slate-900">Sales Invoices &amp; Billed Turnover</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Sales Invoices Register &amp; Turnover Tracker
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issued billing documentation, conversion tracking against customer receipts, and double-entry revenue recognition
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            title="Refresh invoices"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="tally"
            size="sm"
            onClick={openCreateModal}
            className="gap-1.5"
            title="Issue new sales invoice"
          >
            <Plus className="h-3.5 w-3.5" /> Create Sales Invoice
          </Button>
        </div>
      </div>

      {/* Primary KPI Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Gross Billed Turnover
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <TrendingUp className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {formatINR(totalBilledTurnover)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Total Invoiced (Excl. Drafts)
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Collected / Converted
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-emerald-700">
            {formatINR(totalConverted)}
          </div>
          <span className="text-[10px] text-emerald-700 font-mono font-bold">
            {conversionRate}% Turnover Realized
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Pending Collection (AR)
            </span>
            <span className="h-5 w-5 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-amber-800">
            {formatINR(totalPending)}
          </div>
          <span className="text-[10px] text-amber-700 font-mono">
            {invoices.filter((i) => i.status === "issued").length} Invoices Open
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Total Invoices Issued
            </span>
            <span className="h-5 w-5 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900">
            {invoices.length} Documents
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Authoritative Books Register
          </span>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold">
          {[
            { id: "all", label: `All Invoices (${invoices.length})` },
            {
              id: "converted",
              label: `Converted / Paid (${invoices.filter((i) => i.status === "converted").length})`,
            },
            {
              id: "issued",
              label: `Issued / Active (${invoices.filter((i) => i.status === "issued").length})`,
            },
            {
              id: "overdue",
              label: `Overdue (${invoices.filter((i) => i.status === "overdue").length})`,
            },
            {
              id: "draft",
              label: `Drafts (${invoices.filter((i) => i.status === "draft").length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "bg-panel text-white font-bold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="font-bold underline ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Invoices Table */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        searchPlaceholder="Search by invoice number, customer name, GSTIN..."
        isLoading={isLoading}
        emptyMessage="No sales invoices match this filter criteria."
        onRowClick={(inv) => {
          setSelectedInvoice(inv);
          setIsDetailOpen(true);
        }}
        pageSize={15}
      />

      {/* ------------------------------------------------------------- */}
      {/* 1. Full Invoice Preview & Double-Entry Modal */}
      {/* ------------------------------------------------------------- */}
      {selectedInvoice && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Sales Invoice — ${selectedInvoice.invoice_number}`}
          description="Authoritative B2B sales invoice statement & double-entry posting ledger"
        >
          <div className="space-y-4 text-xs font-sans">
            {/* Header / Meta */}
            <div className="bg-slate-50 p-3.5 rounded border border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Invoice Number &amp; Date
                </span>
                <div className="text-base font-black font-mono text-slate-900">
                  {selectedInvoice.invoice_number}
                </div>
                <div className="text-xs text-slate-600 font-mono mt-0.5">
                  Dated: {formatDateTally(selectedInvoice.invoice_date)} • Due:{" "}
                  {formatDateTally(selectedInvoice.due_date)}
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Tracking Status
                </span>
                <div>
                  {selectedInvoice.status === "converted" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      CONVERTED / PAID IN FULL
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold bg-blue-100 text-blue-900 border border-blue-300">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      ISSUED &amp; OPEN RECEIVABLE
                    </span>
                  )}
                </div>
                {selectedInvoice.receipt_voucher_number && (
                  <div className="text-[11px] font-mono text-emerald-700 mt-1 font-bold">
                    Receipt Voucher: {selectedInvoice.receipt_voucher_number}
                  </div>
                )}
              </div>
            </div>

            {/* Buyer Details */}
            <div className="p-3 bg-white rounded border border-slate-200">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block mb-1">
                Bill To / Customer Entity
              </span>
              <div className="font-bold text-sm text-slate-900">
                {selectedInvoice.customer_name}
              </div>
              <div className="text-slate-600 font-mono text-[11px] mt-0.5">
                GSTIN: {selectedInvoice.customer_gstin || "Unregistered / Consumer"}
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                Place of Supply: {selectedInvoice.place_of_supply} •{" "}
                {selectedInvoice.supply_type === "intra_state" ? "Intra-State" : "Inter-State"}
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-panel text-white text-[11px]">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">HSN/SAC</th>
                    <th className="p-2 text-right">Taxable</th>
                    <th className="p-2 text-center">Rate</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(selectedInvoice.items && selectedInvoice.items.length > 0
                    ? selectedInvoice.items
                    : [
                        {
                          item_name: "Software & Technology Consulting Services",
                          hsn_sac_code: "998315",
                          taxable_amount: selectedInvoice.taxable_amount,
                          gst_rate: 18,
                          total_amount: selectedInvoice.total_amount,
                        },
                      ]
                  ).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-sans font-medium text-slate-900">
                        {it.item_name}
                      </td>
                      <td className="p-2 text-center text-slate-500">{it.hsn_sac_code}</td>
                      <td className="p-2 text-right text-slate-800">
                        {formatINR(it.taxable_amount)}
                      </td>
                      <td className="p-2 text-center text-slate-600">{it.gst_rate}%</td>
                      <td className="p-2 text-right font-bold text-slate-900">
                        {formatINR(it.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Breakdown */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span>{formatINR(selectedInvoice.taxable_amount)}</span>
              </div>
              {selectedInvoice.supply_type === "intra_state" ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Central GST (CGST 9%):</span>
                    <span>{formatINR(selectedInvoice.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>State GST (SGST 9%):</span>
                    <span>{formatINR(selectedInvoice.sgst_amount)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>Integrated GST (IGST 18%):</span>
                  <span>{formatINR(selectedInvoice.igst_amount)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
                <span>Invoice Total:</span>
                <span className="text-emerald-700">{formatINR(selectedInvoice.total_amount)}</span>
              </div>
            </div>

            {/* Double-Entry Posting Trace */}
            <div className="p-3 bg-emerald-50/50 rounded border border-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[11px]">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>ALERX 4-Tier Balanced Double-Entry Trace</span>
              </div>
              <p className="text-[11px] text-slate-600">
                • <strong>Dr.</strong> Trade Debtors (Asset) — {formatINR(selectedInvoice.total_amount)}<br />
                • <strong>Cr.</strong> Operating Sales Revenue (Revenue) — {formatINR(selectedInvoice.taxable_amount)}<br />
                • <strong>Cr.</strong> Output GST Liability (Liability) — {formatINR(selectedInvoice.total_tax)}
              </p>
            </div>

            {/* Conversion Details / Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Document</span>
              </button>

              {selectedInvoice.status !== "converted" ? (
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceToConvert(selectedInvoice);
                    setConvertReceiptVoucher(`RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`);
                    setConvertNote(`Full settlement for ${selectedInvoice.invoice_number}`);
                    setIsConvertModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Converted / Record Payment</span>
                </button>
              ) : (
                <span className="text-[11px] font-mono text-emerald-700 font-bold">
                  ✓ Realized in Full
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. Mark Converted / Payment Receipt Modal */}
      {/* ------------------------------------------------------------- */}
      {invoiceToConvert && (
        <Modal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          title={`Record Customer Receipt & Convert Invoice`}
          description={`Record inward funds for invoice #${invoiceToConvert.invoice_number}`}
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono font-bold text-slate-900">{invoiceToConvert.invoice_number}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">{invoiceToConvert.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-slate-200 pt-1 mt-1">
                <span>Amount to Convert:</span>
                <span className="text-emerald-700 font-mono">{formatINR(invoiceToConvert.total_amount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Receipt Voucher Number (F6)
              </label>
              <Input
                value={convertReceiptVoucher}
                onChange={(e) => setConvertReceiptVoucher(e.target.value)}
                placeholder="e.g. RCP-2026-0049"
                className="font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Settlement Bank Account
              </label>
              <select
                value={convertPaymentMode}
                onChange={(e) => setConvertPaymentMode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs font-medium focus:border-brand focus:outline-none"
              >
                <option value="HDFC Operating Current A/c">HDFC Operating Current A/c (LF-201)</option>
                <option value="ICICI Bank Liquid Account">ICICI Bank Liquid Account (LF-202)</option>
                <option value="Cash-in-Hand Vault">Cash-in-Hand Vault (LF-203)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Conversion Narration
              </label>
              <Input
                value={convertNote}
                onChange={(e) => setConvertNote(e.target.value)}
                placeholder="e.g. Full bank settlement via NEFT transfer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConvertModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="tally"
                size="sm"
                onClick={handleConfirmConvert}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm Conversion &amp; Post Receipt
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. Create Sales Invoice Modal */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Issue New Sales Invoice"
        description="Draft and issue an authoritative B2B sales invoice with automated double-entry postings"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Invoice Number
              </label>
              <Input
                value={newInvNumber}
                onChange={(e) => setNewInvNumber(e.target.value)}
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Customer Name
              </label>
              <Input
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="e.g. Acme Software Labs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Invoice Date
              </label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Supply Type
              </label>
              <select
                value={newSupplyType}
                onChange={(e) => setNewSupplyType(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs font-medium focus:border-brand focus:outline-none"
              >
                <option value="intra_state">Intra-State (CGST 9% + SGST 9%)</option>
                <option value="inter_state">Inter-State (IGST 18%)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                HSN / SAC Code
              </label>
              <Input
                value={newHsn}
                onChange={(e) => setNewHsn(e.target.value)}
                className="font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Item / Service Description
            </label>
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Description on invoice line item"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Taxable Amount (₹)
              </label>
              <Input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                GST Rate (%)
              </label>
              <Input
                type="number"
                value={newGstRate}
                onChange={(e) => setNewGstRate(Number(e.target.value) || 0)}
                className="font-mono"
                required
              />
            </div>
          </div>

          {/* Computed Preview */}
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs font-mono space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Value:</span>
              <span>{formatINR(newPrice)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST Tax ({newGstRate}%):</span>
              <span>{formatINR(Math.round((newPrice * newGstRate) / 100))}</span>
            </div>
            <div className="border-t border-slate-300 pt-1 flex justify-between font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="text-emerald-700">
                {formatINR(newPrice + Math.round((newPrice * newGstRate) / 100))}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="tally" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
