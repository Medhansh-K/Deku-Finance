"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  ReceiptText,
  FilePlus,
  QrCode,
  CheckCircle2,
  Filter,
  Download,
  Search,
} from "lucide-react";

export default function InvoicesListPage() {
  const { operatingMode } = useAuth();
  const isPure = operatingMode === "pure_accounting";

  const mockInvoices = [
    {
      id: "inv-1",
      number: isPure ? "BOS/2026-27/0014" : "INV/2026-27/0088",
      party: "Apex Growth Solutions LLP",
      date: "19-Oct-2026",
      amount: isPure ? 50000 : 59000,
      mode: isPure ? "Bill of Supply (Nil)" : "Tax Invoice (18%)",
      status: "unpaid",
      poNumber: "PO-2026-OCT-892",
      paymentQr: "Scannable",
      alerxPosting: "Balanced ⇄ #4101",
    },
    {
      id: "inv-2",
      number: isPure ? "BOS/2026-27/0013" : "INV/2026-27/0087",
      party: "Zenith Digital Media Inc",
      date: "17-Oct-2026",
      amount: isPure ? 125000 : 147500,
      mode: isPure ? "Bill of Supply (Nil)" : "Tax Invoice (18%)",
      status: "paid",
      poNumber: "PO-ZEN-4401",
      paymentQr: "Settled via UPI",
      alerxPosting: "Balanced ⇄ #4101",
    },
    {
      id: "inv-3",
      number: isPure ? "BOS/2026-27/0012" : "INV/2026-27/0086",
      party: "Bharat Logistics & Warehousing",
      date: "14-Oct-2026",
      amount: isPure ? 35000 : 41300,
      mode: isPure ? "Bill of Supply (Nil)" : "Tax Invoice (18%)",
      status: "paid",
      poNumber: "EWB-2819-4820",
      paymentQr: "Settled via UPI",
      alerxPosting: "Balanced ⇄ #4101",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-zinc-950">
            Outward Invoices & Bills of Supply
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track commercial documents, custom metadata, and direct Bharat UPI scan-to-pay status.
          </p>
        </div>

        <Link
          href="/dashboard/invoices/new"
          className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center gap-2 transition-transform hover:scale-[1.01] shadow-md shadow-amber-400/20"
        >
          <FilePlus className="h-4 w-4" />
          <span>+ Create New Invoice / BOS</span>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase text-[10px] border-b border-zinc-200">
                <th className="py-3 px-4">Invoice # & PO</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Payment QR</th>
                <th className="py-3 px-4 text-center">ALERX Ledger</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {mockInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-zinc-900 block">
                      {inv.number}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono block">
                      {inv.poNumber}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-zinc-800">
                    {inv.party}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">{inv.date}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {inv.mode}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-zinc-950 text-sm">
                    ₹{inv.amount.toLocaleString("en-IN")}.00
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <QrCode className="h-3 w-3" />
                      <span>{inv.paymentQr}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>{inv.alerxPosting}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href="/dashboard/invoices/new"
                      className="text-amber-600 hover:text-amber-700 font-bold hover:underline"
                    >
                      View & Print ➔
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
