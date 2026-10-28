"use client";

import React, { useState, useEffect } from "react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import {
  FileText,
  Plus,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { invoicesApi, partiesApi, catalogueApi } from "@/api/endpoints";
import {
  CatalogueItem,
  CreateInvoiceRequest,
  Party,
  SalesInvoice,
  SalesInvoiceLine,
  SupplyType,
} from "@/types/accounting";
import { formatINR, parseAmount } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";

export function GstTaxHubView() {
  const [activeTab, setActiveTab] = useState<"invoices" | "create" | "summary">("invoices");

  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invoice Detail / Print Modal
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  const [orgId, setOrgId] = useState<string>("");

  // New Invoice Form State
  const [newInvCustomer, setNewInvCustomer] = useState("");
  const [newInvNumber, setNewInvNumber] = useState("INV-2026-1001");
  const [newInvDate, setNewInvDate] = useState("2026-10-20");
  const [newInvDueDate, setNewInvDueDate] = useState("2026-10-20");
  const [newInvSupplyType, setNewInvSupplyType] = useState<SupplyType>("intra_state");
  const [newInvPlaceOfSupply, setNewInvPlaceOfSupply] = useState("27-Maharashtra");

  useEffect(() => {
    setNewInvNumber(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setNewInvDate(toISODateString());
    setNewInvDueDate(toISODateString());
  }, []);
  const [newInvLines, setNewInvLines] = useState<Omit<SalesInvoiceLine, "id" | "invoice_id">[]>([
    {
      line_number: 1,
      item_name: "Cloud Advisory & ERP Implementation",
      description: "Monthly enterprise financial software services",
      hsn_sac_code: "998315",
      unit_code: "OTH",
      quantity: 1,
      unit_price: 100000,
      discount_amount: 0,
      taxable_amount: 100000,
      gst_rate: 18,
      cgst_rate: 9,
      cgst_amount: 9000,
      sgst_rate: 9,
      sgst_amount: 9000,
      igst_rate: 0,
      igst_amount: 0,
      total_amount: 118000,
    },
  ]);

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
      const [invRes, partRes, catRes] = await Promise.all([
        invoicesApi.list(orgId),
        partiesApi.list(orgId),
        catalogueApi.list(orgId),
      ]);
      setInvoices(invRes.data || []);
      setCustomers((partRes.data || []).filter((p) => p.type === "customer"));
      setCatalogue(catRes.data || []);
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

  // Recalculate line totals on change
  const updateLineCalculations = (
    index: number,
    field: string,
    val: any,
    supplyType: SupplyType = newInvSupplyType
  ) => {
    setNewInvLines((prev) => {
      const lines = [...prev];
      const line = { ...lines[index], [field]: val };

      const qty = Number(line.quantity) || 1;
      const price = Number(line.unit_price) || 0;
      const discount = Number(line.discount_amount) || 0;
      const taxable = Math.max(0, qty * price - discount);
      const gstRate = Number(line.gst_rate) || 0;

      line.taxable_amount = taxable;

      if (supplyType === "intra_state") {
        line.cgst_rate = gstRate / 2;
        line.cgst_amount = Math.round((taxable * (gstRate / 2)) / 100 * 100) / 100;
        line.sgst_rate = gstRate / 2;
        line.sgst_amount = Math.round((taxable * (gstRate / 2)) / 100 * 100) / 100;
        line.igst_rate = 0;
        line.igst_amount = 0;
      } else {
        line.cgst_rate = 0;
        line.cgst_amount = 0;
        line.sgst_rate = 0;
        line.sgst_amount = 0;
        line.igst_rate = gstRate;
        line.igst_amount = Math.round((taxable * gstRate) / 100 * 100) / 100;
      }

      line.total_amount =
        taxable + (line.cgst_amount || 0) + (line.sgst_amount || 0) + (line.igst_amount || 0);

      lines[index] = line;
      return lines;
    });
  };

  const handleAddLine = () => {
    setNewInvLines((prev) => [
      ...prev,
      {
        line_number: prev.length + 1,
        item_name: "",
        hsn_sac_code: "998315",
        unit_code: "OTH",
        quantity: 1,
        unit_price: 0,
        taxable_amount: 0,
        gst_rate: 18,
        cgst_rate: newInvSupplyType === "intra_state" ? 9 : 0,
        cgst_amount: 0,
        sgst_rate: newInvSupplyType === "intra_state" ? 9 : 0,
        sgst_amount: 0,
        igst_rate: newInvSupplyType === "inter_state" ? 18 : 0,
        igst_amount: 0,
        total_amount: 0,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (newInvLines.length <= 1) return;
    setNewInvLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvCustomer) {
      alert("Please select a customer.");
      return;
    }

    const totalTaxable = newInvLines.reduce((s, l) => s + l.taxable_amount, 0);
    const totalGrand = newInvLines.reduce((s, l) => s + l.total_amount, 0);

    const payload: CreateInvoiceRequest = {
      customer_id: newInvCustomer,
      invoice_number: newInvNumber,
      invoice_date: newInvDate,
      due_date: newInvDueDate,
      supply_type: newInvSupplyType,
      place_of_supply: newInvPlaceOfSupply,
      taxable_amount: totalTaxable,
      total_amount: totalGrand,
      lines: newInvLines,
    };

    setIsActionPending(true);
    try {
      await invoicesApi.create(orgId, payload);
      alert(`Invoice ${newInvNumber} drafted successfully.`);
      setActiveTab("invoices");
      setNewInvNumber(
        `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to draft invoice");
    } finally {
      setIsActionPending(false);
    }
  };

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
        <span className="font-mono font-bold text-[#0F172A]">
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
                ? "bg-[#1F2324] text-white font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Sales Invoices Register
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "create"
                ? "bg-[#5BB5BB] text-[#0A0A0A] font-bold"
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
        <form
          onSubmit={handleCreateInvoice}
          className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase text-[#0A0A0A] font-mono">
                New GST Sales Invoice
              </h3>
              <p className="text-[11px] text-slate-500">
                Calculates CGST/SGST (Intra-state) or IGST (Inter-state) and creates double-entry receivable allocations
              </p>
            </div>
            <Badge variant="teal">GST Compliant</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Customer
              </label>
              <select
                value={newInvCustomer}
                onChange={(e) => setNewInvCustomer(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#5BB5BB] focus:outline-none"
                required
              >
                <option value="">— Select Customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name} ({c.gstin || "Unregistered"})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Invoice Number"
              value={newInvNumber}
              onChange={(e) => setNewInvNumber(e.target.value)}
              required
            />

            <Input
              label="Invoice Date"
              type="date"
              value={newInvDate}
              onChange={(e) => setNewInvDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Supply Type
              </label>
              <select
                value={newInvSupplyType}
                onChange={(e) => {
                  const st = e.target.value as SupplyType;
                  setNewInvSupplyType(st);
                  // Recalculate all lines for new tax type
                  newInvLines.forEach((_, idx) =>
                    updateLineCalculations(idx, "item_name", newInvLines[idx].item_name, st)
                  );
                }}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#5BB5BB] focus:outline-none"
              >
                <option value="intra_state">Intra-State (Within Maharashtra: CGST + SGST)</option>
                <option value="inter_state">Inter-State (Outside State: Integrated IGST)</option>
              </select>
            </div>

            <Input
              label="Place of Supply (State Code)"
              value={newInvPlaceOfSupply}
              onChange={(e) => setNewInvPlaceOfSupply(e.target.value)}
              placeholder="e.g. 27-Maharashtra"
              required
            />
          </div>

          {/* Lines Table */}
          <div className="rounded border border-slate-300 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#1F2324] text-white font-mono text-[11px]">
                <tr>
                  <th className="py-2 px-3">Item / Service Title</th>
                  <th className="py-2 px-3 w-28">HSN/SAC</th>
                  <th className="py-2 px-2 text-right w-20">Qty</th>
                  <th className="py-2 px-3 text-right w-28">Rate (₹)</th>
                  <th className="py-2 px-2 text-right w-20">GST %</th>
                  <th className="py-2 px-3 text-right w-28">Taxable (₹)</th>
                  <th className="py-2 px-3 text-right w-28">Total (₹)</th>
                  <th className="py-2 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {newInvLines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={line.item_name}
                        onChange={(e) =>
                          updateLineCalculations(idx, "item_name", e.target.value)
                        }
                        placeholder="Item or service description"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        required
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={line.hsn_sac_code || ""}
                        onChange={(e) =>
                          updateLineCalculations(idx, "hsn_sac_code", e.target.value)
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLineCalculations(idx, "quantity", Number(e.target.value))
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-right"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) =>
                          updateLineCalculations(idx, "unit_price", Number(e.target.value))
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-right"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <select
                        value={line.gst_rate}
                        onChange={(e) =>
                          updateLineCalculations(idx, "gst_rate", Number(e.target.value))
                        }
                        className="w-full border border-slate-300 rounded px-1 py-1 text-xs font-mono text-right"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                      {formatINR(line.taxable_amount)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[#0F172A]">
                      {formatINR(line.total_amount)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Line Item
            </Button>

            {/* Calculations Summary */}
            <div className="text-right font-mono text-xs space-y-1">
              <div>
                <span className="text-slate-500 mr-3">Taxable Value:</span>
                <span className="font-bold">
                  {formatINR(newInvLines.reduce((s, l) => s + l.taxable_amount, 0))}
                </span>
              </div>
              <div>
                <span className="text-slate-500 mr-3">
                  Total GST ({newInvSupplyType === "intra_state" ? "CGST + SGST" : "IGST"}):
                </span>
                <span className="font-bold text-emerald-700">
                  {formatINR(
                    newInvLines.reduce(
                      (s, l) =>
                        s + (l.cgst_amount || 0) + (l.sgst_amount || 0) + (l.igst_amount || 0),
                      0
                    )
                  )}
                </span>
              </div>
              <div className="text-sm font-black border-t border-slate-300 pt-1 text-slate-950">
                <span className="mr-3">Grand Total:</span>
                <span>
                  {formatINR(newInvLines.reduce((s, l) => s + l.total_amount, 0))}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab("invoices")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="tally"
              size="sm"
              isLoading={isActionPending}
            >
              Save Draft Invoice
            </Button>
          </div>
        </form>
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
                  <h3 className="text-base font-black text-[#0A0A0A] font-mono">
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
                  <div className="font-bold text-[#0F172A] mt-0.5">
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
                  <div className="font-mono font-bold text-[#0F172A] mt-0.5">
                    No: {selectedInvoice.invoice_number}
                  </div>
                  <div className="font-mono text-slate-600 text-[11px]">
                    Date: {formatDateTally(selectedInvoice.invoice_date)}
                  </div>
                  <div className="font-mono text-slate-600 text-[11px]">
                    Supply: {selectedInvoice.supply_type}
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
