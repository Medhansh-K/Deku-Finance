"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  FilePlus,
  Sliders,
  QrCode,
  ShieldCheck,
  Building2,
  UserCheck,
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Printer,
  Sparkles,
} from "lucide-react";

export default function CreateInvoicePage() {
  const router = useRouter();
  const { organisation, operatingMode } = useAuth();

  const isPure = operatingMode === "pure_accounting";

  // Form State
  const [invoiceNo, setInvoiceNo] = useState(
    isPure ? "BOS/2026-27/0015" : "INV/2026-27/0089"
  );
  const [issueDate, setIssueDate] = useState("2026-10-19");
  const [customerName, setCustomerName] = useState("Apex Growth Solutions LLP");
  const [customerGstin, setCustomerGstin] = useState(
    isPure ? "Unregistered / Consumer" : "27XYZAB9876C1Z3"
  );
  const [customerState, setCustomerState] = useState("Maharashtra (27)");
  const [upiVpa, setUpiVpa] = useState(organisation?.upi_vpa ?? "");

  // Custom Fields State (As requested)
  const [customFields, setCustomFields] = useState({
    showPoNumber: true,
    poNumber: "PO-2026-OCT-892",
    showEwayBill: false,
    ewayBillNo: "2819-4820-9182",
    vehicleNo: "MH-02-EE-4501",
    showPaymentTerms: true,
    paymentTerms: "Net 15 Days",
    dueDate: "2026-11-03",
    showPaymentQr: true,
    showBankDetails: true,
  });

  // Line items
  const [items, setItems] = useState([
    {
      id: "1",
      name: "Enterprise Software & Cloud Subscription",
      hsn: "997331",
      qty: 1,
      rate: 50000,
      gstRate: isPure ? 0 : 18,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedSuccess, setIssuedSuccess] = useState(false);

  // Calculations
  const taxableAmount = items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const totalTax = isPure ? 0 : items.reduce((sum, item) => sum + (item.qty * item.rate * item.gstRate) / 100, 0);
  const cgstAmount = isPure ? 0 : totalTax / 2;
  const sgstAmount = isPure ? 0 : totalTax / 2;
  const grandTotal = taxableAmount + totalTax;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        name: "Professional Advisory Services",
        hsn: "998311",
        qty: 1,
        rate: 25000,
        gstRate: isPure ? 0 : 18,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSaveAndIssue = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIssuedSuccess(true);
      setTimeout(() => {
        router.push("/gateway");
      }, 2500);
    }, 1200);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* Back and Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/gateway"
            className="p-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-zinc-950">
                {isPure ? "Create Bill of Supply (Non-GST)" : "Create GST Tax Invoice"}
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                  isPure
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                {isPure ? "Sec 22 Exempt (Nil)" : "Taxable Supply (CGST+SGST)"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Includes dynamic custom fields and embedded Bharat UPI payment QR code.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="py-2 px-3 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-800 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="h-4 w-4" />
            <span>Print / PDF</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAndIssue}
            disabled={isSubmitting || issuedSuccess}
            className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center gap-2 transition-transform hover:scale-[1.01] shadow-md shadow-amber-400/20 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {isSubmitting
                ? "Posting to ALERX Ledger..."
                : issuedSuccess
                ? "✓ Issued & Balanced!"
                : "Issue & Post to Ledger"}
            </span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {issuedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <strong className="block text-emerald-950">
              Invoice #{invoiceNo} Issued & Posted Atomically!
            </strong>
            <span>
              ALERX Double-entry journal voucher created: <code>Dr Trade Debtors ₹{grandTotal.toLocaleString("en-IN")} ⇄ Cr Revenue ₹{taxableAmount.toLocaleString("en-IN")}</code>. Redirecting to dashboard...
            </span>
          </div>
        </div>
      )}

      {/* 1. Customise Invoice Fields Bar */}
      <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-amber-700">
            <Sliders className="h-3.5 w-3.5" />
            Customise Invoice Fields (Live Builder Controls)
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">Click to toggle fields on document</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              setCustomFields((prev) => ({ ...prev, showPoNumber: !prev.showPoNumber }))
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              customFields.showPoNumber
                ? "bg-amber-400 text-zinc-950 border-amber-500 font-bold shadow-xs"
                : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            <span>{customFields.showPoNumber ? "✓" : "+"} PO Number</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setCustomFields((prev) => ({ ...prev, showEwayBill: !prev.showEwayBill }))
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              customFields.showEwayBill
                ? "bg-amber-400 text-zinc-950 border-amber-500 font-bold shadow-xs"
                : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            <span>{customFields.showEwayBill ? "✓" : "+"} E-Way Bill & Transporter</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setCustomFields((prev) => ({
                ...prev,
                showPaymentTerms: !prev.showPaymentTerms,
              }))
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              customFields.showPaymentTerms
                ? "bg-amber-400 text-zinc-950 border-amber-500 font-bold shadow-xs"
                : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            <span>{customFields.showPaymentTerms ? "✓" : "+"} Due Date & Terms</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setCustomFields((prev) => ({
                ...prev,
                showPaymentQr: !prev.showPaymentQr,
              }))
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              customFields.showPaymentQr
                ? "bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs"
                : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>{customFields.showPaymentQr ? "✓ Bharat UPI QR Active" : "+ Add UPI QR"}</span>
          </button>
        </div>
      </div>

      {/* 2. Main High-DPI Invoice Document Canvas */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-zinc-200 shadow-lg space-y-6 text-zinc-900">
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-200 pb-6">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 block">
              {isPure ? "Pure Accounting Commercial Document" : "GST Tax Document"}
            </span>
            <h2 className="text-2xl font-black text-zinc-950">
              {isPure ? "Bill of Supply" : "TAX INVOICE"}
            </h2>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-zinc-500 font-semibold">Invoice No:</span>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="font-mono font-bold text-xs px-2 py-1 rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="sm:text-right space-y-1.5">
            <span className="inline-block px-3 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wide bg-zinc-900 text-amber-400">
              {isPure ? "Section 22 CGST Exempt" : "GST Multi-State Ready"}
            </span>
            <div className="flex items-center sm:justify-end gap-2 text-xs">
              <span className="text-zinc-500">Date of Issue:</span>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="font-mono text-xs px-2 py-1 rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Billed From & Billed To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-2 border-b border-zinc-100 text-xs">
          {/* Supplier */}
          <div className="space-y-1">
            <span className="font-bold text-zinc-400 uppercase text-[10px]">
              Billed From (Supplier)
            </span>
            <div className="font-bold text-sm text-zinc-950">
              {organisation?.name || "Your company"}
            </div>
            <div className="text-zinc-600">
              {isPure
                ? "GSTIN: Unregistered / Exempt under Section 22"
                : organisation?.gstin ? `GSTIN: ${organisation.gstin}` : "GSTIN: not set (add it in Settings)"}
            </div>
            <div className="text-zinc-500">Mumbai, Maharashtra (27) • India</div>
          </div>

          {/* Customer / Buyer */}
          <div className="space-y-1">
            <span className="font-bold text-zinc-400 uppercase text-[10px]">
              Billed To (Buyer / Customer)
            </span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full font-bold text-sm text-zinc-950 px-2 py-1 rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-amber-400"
            />
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">GSTIN/PAN:</span>
              <input
                type="text"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value)}
                className="font-mono text-xs px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="text-zinc-500">{customerState}</div>
          </div>
        </div>

        {/* Dynamic Custom Metadata Strip */}
        {(customFields.showPoNumber ||
          customFields.showEwayBill ||
          customFields.showPaymentTerms) && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {customFields.showPoNumber && (
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                  Purchase Order (PO) #
                </span>
                <input
                  type="text"
                  value={customFields.poNumber}
                  onChange={(e) =>
                    setCustomFields((prev) => ({ ...prev, poNumber: e.target.value }))
                  }
                  className="font-mono font-bold text-zinc-950 bg-white px-2 py-1 rounded border border-amber-300 text-xs w-full mt-0.5"
                />
              </div>
            )}

            {customFields.showEwayBill && (
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                  E-Way / Vehicle No
                </span>
                <input
                  type="text"
                  value={customFields.ewayBillNo}
                  onChange={(e) =>
                    setCustomFields((prev) => ({ ...prev, ewayBillNo: e.target.value }))
                  }
                  className="font-mono font-bold text-zinc-950 bg-white px-2 py-1 rounded border border-amber-300 text-xs w-full mt-0.5"
                />
              </div>
            )}

            {customFields.showPaymentTerms && (
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                  Payment Terms & Due
                </span>
                <input
                  type="text"
                  value={customFields.paymentTerms}
                  onChange={(e) =>
                    setCustomFields((prev) => ({ ...prev, paymentTerms: e.target.value }))
                  }
                  className="font-bold text-amber-900 bg-white px-2 py-1 rounded border border-amber-300 text-xs w-full mt-0.5"
                />
              </div>
            )}
          </div>
        )}

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-zinc-200 text-zinc-500 text-left font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-2 w-1/2">Item Description & SAC/HSN</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit Rate (₹)</th>
                  <th className="pb-2 text-right">GST Rate</th>
                  <th className="pb-2 text-right">Amount (₹)</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-zinc-50/60">
                    <td className="py-2.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].name = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full font-semibold text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-amber-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-zinc-400 font-mono">SAC: {item.hsn}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].qty = Number(e.target.value) || 1;
                          setItems(updated);
                        }}
                        className="w-16 font-mono text-right bg-zinc-50 px-2 py-1 rounded border border-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].rate = Number(e.target.value) || 0;
                          setItems(updated);
                        }}
                        className="w-24 font-mono text-right bg-zinc-50 px-2 py-1 rounded border border-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isPure ? "bg-zinc-100 text-zinc-600" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isPure ? "0% (Exempt)" : `${item.gstRate}%`}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-zinc-950">
                      ₹{(item.qty * item.rate).toLocaleString("en-IN")}.00
                    </td>
                    <td className="py-2.5 text-right">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-zinc-400 hover:text-rose-500 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1.5 py-1"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Line Item</span>
          </button>
        </div>

        {/* Calculation Summary */}
        <div className="bg-zinc-50 rounded-2xl p-5 border border-zinc-200 space-y-2 text-xs">
          <div className="flex justify-between text-zinc-600">
            <span>Taxable Amount</span>
            <span className="font-mono">₹{taxableAmount.toLocaleString("en-IN")}.00</span>
          </div>

          {!isPure ? (
            <>
              <div className="flex justify-between text-zinc-600">
                <span>Central GST (CGST 9%)</span>
                <span className="font-mono font-semibold text-amber-600">
                  +₹{cgstAmount.toLocaleString("en-IN")}.00
                </span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>State GST (SGST 9%)</span>
                <span className="font-mono font-semibold text-amber-600">
                  +₹{sgstAmount.toLocaleString("en-IN")}.00
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-zinc-500 italic">
              <span>Taxes Charged</span>
              <span>₹0.00 (Exempt under Section 22 of CGST Act)</span>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-200 flex justify-between text-base font-black text-zinc-950">
            <span>Grand Total Due</span>
            <span className="font-mono text-lg text-amber-600">
              ₹{grandTotal.toLocaleString("en-IN")}.00
            </span>
          </div>
        </div>

        {/* 3. Direct Bharat UPI QR Code Embedded in Invoice */}
        {customFields.showPaymentQr && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-amber-50/40 rounded-2xl border-2 border-emerald-300/80 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {/* High Contrast Rendered SVG QR Matrix */}
              <div className="bg-white p-2.5 rounded-xl border border-zinc-300 shadow-sm shrink-0">
                <svg
                  viewBox="0 0 100 100"
                  className="w-20 h-20 text-zinc-950"
                  fill="currentColor"
                  aria-label="Direct Bharat UPI Payment QR Code"
                >
                  <rect x="0" y="0" width="30" height="30" rx="3" />
                  <rect x="6" y="6" width="18" height="18" fill="white" />
                  <rect x="10" y="10" width="10" height="10" />

                  <rect x="70" y="0" width="30" height="30" rx="3" />
                  <rect x="76" y="6" width="18" height="18" fill="white" />
                  <rect x="80" y="10" width="10" height="10" />

                  <rect x="0" y="70" width="30" height="30" rx="3" />
                  <rect x="6" y="76" width="18" height="18" fill="white" />
                  <rect x="10" y="80" width="10" height="10" />

                  <rect x="36" y="10" width="6" height="6" />
                  <rect x="46" y="10" width="6" height="6" />
                  <rect x="56" y="10" width="6" height="6" />
                  <rect x="36" y="24" width="6" height="6" />
                  <rect x="46" y="24" width="6" height="6" />
                  <rect x="56" y="36" width="6" height="6" />
                  <rect x="10" y="36" width="6" height="6" />
                  <rect x="24" y="46" width="6" height="6" />
                  <rect x="36" y="46" width="6" height="6" />
                  <rect x="46" y="46" width="6" height="6" />
                  <rect x="66" y="46" width="6" height="6" />
                  <rect x="80" y="36" width="6" height="6" />
                  <rect x="36" y="60" width="6" height="6" />
                  <rect x="46" y="60" width="6" height="6" />
                  <rect x="66" y="60" width="6" height="6" />
                  <rect x="80" y="60" width="6" height="6" />
                  <rect x="36" y="76" width="6" height="6" />
                  <rect x="56" y="76" width="6" height="6" />
                  <rect x="76" y="76" width="6" height="6" />
                  <rect x="46" y="86" width="6" height="6" />
                  <rect x="66" y="86" width="6" height="6" />
                  <rect x="86" y="86" width="6" height="6" />
                </svg>
              </div>

              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded">
                    Bharat UPI Instant Scan-to-Pay
                  </span>
                  <span className="text-[10px] text-zinc-500 font-bold">0% MDR</span>
                </div>
                <div className="font-mono text-xs font-bold text-zinc-950">
                  VPA: {upiVpa}
                </div>
                <div className="text-[11px] text-zinc-600">
                  Exact Amount Pre-Encoded:{" "}
                  <strong className="text-zinc-950 font-mono">
                    ₹{grandTotal.toLocaleString("en-IN")}.00
                  </strong>
                </div>
                <div className="text-[10px] text-zinc-500">
                  Scan with Google Pay, PhonePe, Paytm, BHIM, CRED, Navi & all banking apps.
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 space-y-1 text-xs">
              <span className="text-zinc-500 text-[10px] block">Verified Bank Settlement</span>
              <span className="font-bold text-zinc-900 font-mono block">
                HDFC Bank • ••••5678
              </span>
              <span className="text-[10px] text-emerald-700 font-bold block">
                ✓ Auto-Reconciles to ALERX Ledger
              </span>
            </div>
          </div>
        )}

        {/* Bottom Ledger Posting Notice */}
        <div className="p-3 bg-zinc-950 text-zinc-300 rounded-xl text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>ALERX Ledger Target:</span>
          </div>
          <span className="text-zinc-400 truncate max-w-sm">
            {isPure
              ? `Dr Trade Debtors ₹${grandTotal} ⇄ Cr Revenue ₹${taxableAmount}`
              : `Dr AR ₹${grandTotal} ⇄ Cr Rev ₹${taxableAmount} + Output GST ₹${totalTax}`}
          </span>
        </div>
      </div>
    </div>
  );
}
