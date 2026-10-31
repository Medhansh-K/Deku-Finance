"use client";

import React, { useState, useEffect } from "react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Plus, RefreshCw, Printer, AlertTriangle, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { invoicesApi, partiesApi } from "@/api/endpoints";
import { Party, SalesInvoice } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import { numberToIndianWords } from "@/lib/builder/number-to-words";
import { toPaise } from "@/lib/invoices/tax-summary";
import { SALES_CHANNELS, settlementFromOrg } from "@/lib/invoices/settlement";
import { useAuth } from "@/context/AuthContext";
import { SalesInvoiceEditor } from "./SalesInvoiceEditor";
import { InvoiceSettlementBlock } from "./InvoiceSettlementBlock";

export function GstTaxHubView() {
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState<"invoices" | "create" | "summary">("invoices");

  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invoice Detail / Print Modal
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  const [orgId, setOrgId] = useState<string>("");
  const savedSettlement = settlementFromOrg(organisation);

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
      const [invRes, partRes] = await Promise.all([invoicesApi.list(orgId), partiesApi.list(orgId)]);
      setInvoices(invRes.data || []);
      setCustomers((partRes.data || []).filter((p) => p.type === "customer"));
    } catch (err: any) {
      setError(err.message || "Failed to load GST & Invoice data from backend");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  // Issue invoice with atomic double-entry journal creation
  const handleIssueInvoice = async (invId: string) => {
    if (
      confirm(
        "Issue this invoice? This will lock the invoice and automatically post balanced double-entry accounting journals into your General Ledger!"
      )
    ) {
      setIsActionPending(true);
      try {
        await invoicesApi.issue(orgId, invId, true);
        setIsDetailOpen(false);
        await loadData();
        alert("Invoice issued and balanced double-entry journal created!");
      } catch (err: any) {
        alert(err.message || "Failed to issue invoice");
      } finally {
        setIsActionPending(false);
      }
    }
  };

  // Cancel invoice
  const handleCancelInvoice = async (invId: string) => {
    const reason = prompt("Enter audit cancellation reason:");
    if (!reason) return;

    setIsActionPending(true);
    try {
      await invoicesApi.cancel(orgId, invId, reason);
      setIsDetailOpen(false);
      await loadData();
      alert("Invoice cancelled and accounting journal reversed atomically.");
    } catch (err: any) {
      alert(err.message || "Failed to cancel invoice");
    } finally {
      setIsActionPending(false);
    }
  };

  const columns: ColumnDef<SalesInvoice>[] = [
    {
      header: "Invoice No.",
      sortKey: (inv) => inv.invoice_number,
      cell: (inv) => (
        <span className="font-mono font-bold text-ink">
          {inv.invoice_number}
        </span>
      ),
    },
    {
      header: "Date",
      sortKey: (inv) => inv.invoice_date,
      cell: (inv) => (
        <span className="font-mono text-slate-800">
          {formatDateTally(inv.invoice_date)}
        </span>
      ),
    },
    {
      header: "Customer Name & GSTIN",
      sortKey: (inv) => inv.parties?.legal_name || "",
      cell: (inv) => (
        <div>
          <span className="font-bold text-slate-900 block">
            {inv.parties?.legal_name || "Enterprise Customer"}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            GSTIN: {inv.parties?.gstin || "Unregistered"}
          </span>
        </div>
      ),
    },
    {
      header: "Supply Type",
      cell: (inv) => (
        <Badge
          variant={
            inv.supply_type === "intra_state" ? "teal" : "default"
          }
        >
          {inv.supply_type === "intra_state" ? "Intra-State (CGST+SGST)" : "Inter-State (IGST)"}
        </Badge>
      ),
    },
    {
      header: "Taxable Value",
      sortKey: (inv) => inv.taxable_amount,
      cell: (inv) => (
        <span className="font-mono font-semibold text-slate-700">
          {formatINR(inv.taxable_amount)}
        </span>
      ),
    },
    {
      header: "Invoice Total",
      sortKey: (inv) => inv.total_amount,
      cell: (inv) => (
        <span className="font-mono font-bold text-slate-950">
          {formatINR(inv.total_amount)}
        </span>
      ),
    },
    {
      header: "Status",
      sortKey: (inv) => inv.status,
      cell: (inv) => {
        const s = inv.status;
        if (s === "issued") return <Badge variant="success">Issued / Posted</Badge>;
        if (s === "cancelled") return <Badge variant="danger">Cancelled</Badge>;
        return <Badge variant="warning">Draft</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Navigation Tabs */}
      <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-200">
        <div className="flex items-center gap-1 font-semibold">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === "invoices"
                ? "bg-panel text-white font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Sales Invoices Register
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "create"
                ? "bg-brand text-ink font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> Create GST Invoice
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="underline font-bold ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Tab 1: Invoices Register */}
      {activeTab === "invoices" && (
        <DataTable
          columns={columns}
          data={invoices}
          searchPlaceholder="Search invoices by number, customer or value..."
          isLoading={isLoading}
          emptyMessage="No sales invoices drafted yet."
          onRowClick={(inv) => {
            setSelectedInvoice(inv);
            setIsDetailOpen(true);
          }}
        />
      )}

      {/* Tab 2: Create GST Invoice Form */}
      {activeTab === "create" && (
        <SalesInvoiceEditor
          key={orgId}
          orgId={orgId}
          customers={customers}
          onCancel={() => setActiveTab("invoices")}
          onCreated={async () => {
            setActiveTab("invoices");
            await loadData();
          }}
        />
      )}

      {/* Invoice Detail / Printable View Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Tax Invoice: ${selectedInvoice.invoice_number}`}
          description={`Customer: ${selectedInvoice.parties?.legal_name || "Enterprise Client"}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 font-sans text-xs">
            {/* Printable Invoice Header */}
            <div className="border border-slate-300 rounded p-4 bg-slate-50 space-y-3">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-black text-ink font-mono">
                    TAX INVOICE
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Issued under Rule 46 of Central Goods & Services Tax Rules
                  </p>
                </div>
                <Badge
                  variant={
                    selectedInvoice.status === "issued"
                      ? "success"
                      : selectedInvoice.status === "cancelled"
                      ? "danger"
                      : "warning"
                  }
                >
                  {selectedInvoice.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-mono text-[10px] uppercase block">
                    Billed To:
                  </span>
                  <div className="font-bold text-ink mt-0.5">
                    {selectedInvoice.parties?.legal_name || "Client"}
                  </div>
                  <div className="font-mono text-slate-600 text-[11px]">
                    GSTIN: {selectedInvoice.parties?.gstin || "Unregistered"}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Place of Supply: {selectedInvoice.place_of_supply}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-slate-400 font-mono text-[10px] uppercase block">
                    Invoice Details:
                  </span>
                  <div className="font-mono font-bold text-ink mt-0.5">
                    No: {selectedInvoice.invoice_number}
                  </div>
                  <div className="font-mono text-slate-600 text-[11px]">
                    Date: {formatDateTally(selectedInvoice.invoice_date)}
                  </div>
                  <div className="font-mono text-slate-600 text-[11px]">
                    Supply: {selectedInvoice.supply_type}
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Channel: {SALES_CHANNELS.find((c) => c.value === (selectedInvoice.sales_channel ?? "direct"))?.label}
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Line Breakdown */}
            <div className="rounded border border-slate-300 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[10px] text-slate-600">
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Taxable</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedInvoice.sales_invoice_lines || []).map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900 block">
                          {l.item_name}
                        </span>
                        {l.description && (
                          <span className="text-[11px] text-slate-500">
                            {l.description}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{l.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatINR(l.unit_price)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatINR(l.taxable_amount)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">
                        {formatINR(l.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xs text-ink-soft">{numberToIndianWords(selectedInvoice.total_amount)}</p>
              <p className="font-mono text-sm font-semibold text-ink">{formatINR(selectedInvoice.total_amount)}</p>
            </div>

            <InvoiceSettlementBlock
              settlement={savedSettlement}
              payee={savedSettlement.beneficiaryName || organisation?.legal_name || organisation?.name || ""}
              amountPaise={toPaise(selectedInvoice.total_amount)}
              invoiceNumber={selectedInvoice.invoice_number}
            />

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print Invoice
              </Button>

              <div className="flex items-center gap-2">
                {selectedInvoice.status === "draft" && (
                  <Button
                    variant="tally"
                    size="sm"
                    onClick={() => handleIssueInvoice(selectedInvoice.id)}
                    isLoading={isActionPending}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" /> Issue & Post Double Entry
                  </Button>
                )}

                {selectedInvoice.status === "issued" && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleCancelInvoice(selectedInvoice.id)}
                    isLoading={isActionPending}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Cancel Invoice
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
