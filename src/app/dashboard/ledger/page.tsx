"use client";

import React, { useState } from "react";
import {
  BookOpen,
  FolderTree,
  ShieldCheck,
  CheckCircle2,
  Search,
  Filter,
  Layers,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export default function LedgerPage() {
  const [activeClass, setActiveClass] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const accounts = [
    {
      code: "1101",
      name: "Cash on Hand",
      class: "Asset",
      tier: "Leaf Label",
      postable: true,
      units: 14,
      balance: 45000,
      debit: 45000,
      credit: 0,
    },
    {
      code: "1102",
      name: "HDFC Current Account (UPI Settled)",
      class: "Asset",
      tier: "Leaf Label",
      postable: true,
      units: 48,
      balance: 595000,
      debit: 595000,
      credit: 0,
    },
    {
      code: "1103",
      name: "Trade Debtors / Accounts Receivable",
      class: "Asset",
      tier: "Leaf Label",
      postable: true,
      units: 24,
      balance: 185000,
      debit: 185000,
      credit: 0,
    },
    {
      code: "2101",
      name: "Trade Creditors / Accounts Payable",
      class: "Liability",
      tier: "Leaf Label",
      postable: true,
      units: 18,
      balance: 127400,
      debit: 0,
      credit: 127400,
    },
    {
      code: "2201",
      name: "Central GST (CGST) Output Payable",
      class: "Liability",
      tier: "Leaf Label",
      postable: true,
      units: 12,
      balance: 28800,
      debit: 0,
      credit: 28800,
    },
    {
      code: "2202",
      name: "State GST (SGST) Output Payable",
      class: "Liability",
      tier: "Leaf Label",
      postable: true,
      units: 12,
      balance: 28800,
      debit: 0,
      credit: 28800,
    },
    {
      code: "3101",
      name: "Founder Capital / Partner Equity",
      class: "Equity",
      tier: "Leaf Label",
      postable: true,
      units: 1,
      balance: 210000,
      debit: 0,
      credit: 210000,
    },
    {
      code: "4101",
      name: "Domestic Sales Revenue (Commercial)",
      class: "Revenue",
      tier: "Leaf Label",
      postable: true,
      units: 32,
      balance: 640000,
      debit: 0,
      credit: 640000,
    },
    {
      code: "5101",
      name: "Cloud Server & Infrastructure Cost",
      class: "Expense",
      tier: "Leaf Label",
      postable: true,
      units: 6,
      balance: 85000,
      debit: 85000,
      credit: 0,
    },
    {
      code: "5102",
      name: "Professional & Legal Fees",
      class: "Expense",
      tier: "Leaf Label",
      postable: true,
      units: 4,
      balance: 125000,
      debit: 125000,
      credit: 0,
    },
  ];

  const filtered = accounts.filter((acc) => {
    const matchesClass =
      activeClass === "all" || acc.class.toLowerCase() === activeClass.toLowerCase();
    const matchesSearch =
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.code.includes(searchQuery);
    return matchesClass && matchesSearch;
  });

  const totalDebits = accounts.reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredits = accounts.reduce((sum, acc) => sum + acc.credit, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-zinc-950">
              ALERX Double-Entry General Ledger
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              Trigger Guarded
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            4-Tier Chart of Accounts. Transactions post exclusively to postable Leaf Labels with dual Unit and INR tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold bg-zinc-950 text-white px-3.5 py-2 rounded-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Balanced: Debits (₹{totalDebits.toLocaleString("en-IN")}) = Credits (₹{totalCredits.toLocaleString("en-IN")})</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["all", "asset", "liability", "equity", "revenue", "expense"].map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setActiveClass(cls)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeClass === cls
                  ? "bg-amber-400 text-zinc-950 shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code or account..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase text-[10px] border-b border-zinc-200">
                <th className="py-3 px-4">Account Code</th>
                <th className="py-3 px-4">Account Title & Leaf Label</th>
                <th className="py-3 px-4">GAAP Class</th>
                <th className="py-3 px-4 text-center">Trigger Guard</th>
                <th className="py-3 px-4 text-center">Unit Events</th>
                <th className="py-3 px-4 text-right">Debit (₹)</th>
                <th className="py-3 px-4 text-right">Credit (₹)</th>
                <th className="py-3 px-4 text-right">Net Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((acc) => (
                <tr key={acc.code} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-amber-600">
                    #{acc.code}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-zinc-900 block">{acc.name}</span>
                    <span className="text-[10px] text-zinc-400 block font-mono">
                      Hierarchy Tier: {acc.tier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        acc.class === "Asset"
                          ? "bg-emerald-100 text-emerald-800"
                          : acc.class === "Liability"
                          ? "bg-amber-100 text-amber-800"
                          : acc.class === "Equity"
                          ? "bg-indigo-100 text-indigo-800"
                          : acc.class === "Revenue"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {acc.class}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Postable</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-600">
                    {acc.units} events
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900">
                    {acc.debit > 0 ? `₹${acc.debit.toLocaleString("en-IN")}.00` : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900">
                    {acc.credit > 0 ? `₹${acc.credit.toLocaleString("en-IN")}.00` : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-zinc-950">
                    ₹{acc.balance.toLocaleString("en-IN")}.00
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
