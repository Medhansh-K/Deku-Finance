"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  TrendingDown,
  Receipt,
  ChevronRight,
  RefreshCw,
  Briefcase,
  PieChart,
  Eye,
  Printer,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { organisationsApi, reportsApi } from "@/api/endpoints";
import { ExpenseVoucher, toExpenseReport } from "@/lib/reports/expenses";
import { fyStart, toRupees } from "@/lib/reports/ledger";

type Books = ReturnType<typeof toExpenseReport> & { from: string; asOf: string };

const NO_REPORT: Books = { totalPaise: 0, revenuePaise: 0, byHead: [], vouchers: [], from: "", asOf: "" };

export function OperatingExpensesView() {
  const [orgId, setOrgId] = useState<string>("");
  const [books, setBooks] = useState<Books | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedHead, setSelectedHead] = useState<string>("all");

  const [selectedVoucher, setSelectedVoucher] = useState<ExpenseVoucher | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
      const asOf = toISODateString();
      const org = await organisationsApi.get(orgId);
      const from = fyStart(asOf, org.data?.[0]?.financial_year_start_month || 4);
      const res = await reportsApi.getExpenses(orgId, from, asOf);
      setBooks({ ...toExpenseReport(res.data), from, asOf });
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

  const report = books ?? NO_REPORT;
  const { revenuePaise, from, asOf } = report;
  const ratio = revenuePaise > 0 ? Math.round((report.totalPaise / revenuePaise) * 1000) / 10 : null;
  const hasData = !!books && report.vouchers.length > 0;

  const filteredVouchers = useMemo(() => {
    if (selectedHead === "all") return report.vouchers;
    return report.vouchers.filter((v) => v.headIds.includes(selectedHead));
  }, [report, selectedHead]);

  const openVoucher = (v: ExpenseVoucher) => {
    setSelectedVoucher(v);
    setIsDetailOpen(true);
  };

  const columns: ColumnDef<ExpenseVoucher>[] = [
    {
      header: "Voucher # & Date",
      sortKey: (v) => v.entryNumber,
      cell: (v) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openVoucher(v);
          }}
          className="font-mono text-left group"
        >
          <div className="font-bold text-ink group-hover:text-brand group-hover:underline flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5 text-brand-strong" />
            <span>{v.entryNumber}</span>
          </div>
          <span className="text-[10px] text-ink-subtle block mt-0.5">
            {formatDateTally(v.date)}
          </span>
        </button>
      ),
    },
    {
      header: "Paid To / Narration",
      sortKey: (v) => v.partyName ?? "",
      cell: (v) => (
        <div>
          <span className="font-bold text-ink block text-xs">{v.partyName ?? "–"}</span>
          <span className="text-[10px] text-ink-muted font-mono mt-0.5 block truncate max-w-xs">
            {v.narration}
          </span>
        </div>
      ),
    },
    {
      header: "Expense Ledger Head",
      cell: (v) => (
        <div className="space-y-0.5">
          {v.heads.map((h) => (
            <span key={h} className="font-semibold text-ink block text-xs">{h}</span>
          ))}
        </div>
      ),
    },
    {
      header: "Credited Account",
      cell: (v) => (
        <span className="text-ink-soft font-mono text-[11px] block">
          {v.sources.join(", ") || "–"}
        </span>
      ),
    },
    {
      header: "Amount (INR)",
      align: "right",
      sortKey: (v) => v.amountPaise,
      cell: (v) => (
        <div className="text-right">
          <span className="font-mono text-xs font-black text-ink block">
            {formatINR(toRupees(v.amountPaise))}
          </span>
          <Badge variant={v.status === "reversed" ? "warning" : "success"}>
            {v.status === "reversed" ? "REVERSED" : "POSTED"}
          </Badge>
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
            openVoucher(v);
          }}
          className="p-1 text-ink-muted hover:text-brand hover:bg-canvas-sunken rounded transition-colors"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted font-mono mb-1">
            <Link href="/gateway" className="hover:text-brand transition-colors">
              Gateway
            </Link>
            <ChevronRight className="h-3 w-3 text-ink-subtle" />
            <span className="font-semibold text-ink">Operating Expenses</span>
          </div>
          <h1 className="text-xl font-black text-ink tracking-tight">
            Operating Expenses
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Posted entries on expense ledgers (cost of sales excluded), {formatDateTally(from)} to {formatDateTally(asOf)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Link
            href="/vouchers/payment"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-brand hover:bg-brand-soft text-panel-deep shadow-2xs transition-colors"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Create Payment Voucher (F5)</span>
          </Link>
        </div>
      </div>

      {/* Top High-Level OPEX Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Total Operating Expenses
            </span>
            <span className="h-5 w-5 rounded bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <TrendingDown className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-ink">
            {hasData ? formatINR(toRupees(report.totalPaise)) : "–"}
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            Financial year to date
          </span>
        </div>

        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Operating Expense Ratio
            </span>
            <span className="h-5 w-5 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <PieChart className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-ink">
            {ratio === null || !hasData ? "–" : `${ratio}%`}
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            {revenuePaise > 0 ? "Of revenue this year" : "No revenue posted this year"}
          </span>
        </div>

        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Expense Vouchers
            </span>
            <span className="h-5 w-5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Receipt className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-ink">
            {report.vouchers.length} Vouchers
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            Posted entries touching expense heads
          </span>
        </div>

        <div className="bg-surface p-3.5 rounded-lg border border-line shadow-2xs">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px]">
              Expense Heads Used
            </span>
            <span className="h-5 w-5 rounded bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Briefcase className="h-3 w-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-ink">
            {report.byHead.length} Heads
          </div>
          <span className="text-[10px] text-ink-muted font-mono">
            Departments and budgets are not linked to entries
          </span>
        </div>
      </div>

      {/* Expense-head breakdown */}
      <div className="bg-surface p-4 rounded-lg border border-line shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-2">
          <div>
            <h2 className="text-sm font-black text-ink flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-brand-strong" />
              <span>Expense Breakdown by Ledger Head</span>
            </h2>
            <p className="text-xs text-ink-muted">
              Click a head to list only the vouchers posted to it
            </p>
          </div>
          {selectedHead !== "all" && (
            <button
              onClick={() => setSelectedHead("all")}
              className="text-xs text-brand-strong hover:underline font-bold"
            >
              Show All Heads
            </button>
          )}
        </div>

        {report.byHead.length === 0 ? (
          <p className="text-xs text-ink-muted py-4 text-center">
            {error ?? (isLoading ? "Loading…" : "No operating expenses posted this financial year.")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {report.byHead.map((head) => {
              const isSelected = selectedHead === head.accountId;
              const pct = report.totalPaise > 0 ? Math.round((head.amountPaise / report.totalPaise) * 100) : 0;

              return (
                <div
                  key={head.accountId}
                  onClick={() => setSelectedHead(isSelected ? "all" : head.accountId)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-brand bg-brand/10 shadow-xs ring-1 ring-brand"
                      : "border-line bg-canvas/50 hover:bg-canvas-sunken/70"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft">
                      {head.code}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-ink-muted">{pct}% OPEX</span>
                  </div>
                  <div className="text-xs font-bold text-ink truncate" title={head.name}>
                    {head.name}
                  </div>
                  <div className="text-sm font-black font-mono text-ink mt-1">
                    {formatINR(toRupees(head.amountPaise))}
                  </div>

                  <div className="w-full bg-line h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-brand-strong h-full rounded-full transition-all"
                      style={{ width: `${Math.max(0, pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-ink-muted font-mono mt-1">
                    <span>{head.entries} {head.entries === 1 ? "voucher" : "vouchers"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 bg-surface p-3 rounded-lg border border-line">
        <div className="text-xs font-mono text-ink-muted">
          Showing <strong>{filteredVouchers.length}</strong> of {report.vouchers.length} expense vouchers
        </div>
      </div>

      {/* Expense Vouchers Table */}
      <DataTable
        columns={columns}
        data={filteredVouchers}
        searchPlaceholder="Search vouchers by party, voucher number, narration, or expense head..."
        isLoading={isLoading}
        emptyMessage={error ?? "No expense vouchers posted this financial year."}
        onRowClick={openVoucher}
        pageSize={15}
      />

      {/* Voucher Details & Double-Entry Modal */}
      {selectedVoucher && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Voucher — ${selectedVoucher.entryNumber}`}
          description="Double-entry lines as posted to the ledger"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="bg-canvas p-3.5 rounded border border-line flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono text-ink-subtle uppercase font-semibold">
                  Voucher Number
                </span>
                <div className="text-base font-black font-mono text-ink">
                  {selectedVoucher.entryNumber}
                </div>
                <div className="text-xs text-ink-soft font-mono mt-0.5">
                  Dated: {formatDateTally(selectedVoucher.date)}
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] font-mono text-ink-subtle uppercase font-semibold">
                  Operating Expense
                </span>
                <div className="text-base font-black font-mono text-emerald-700">
                  {formatINR(toRupees(selectedVoucher.amountPaise))}
                </div>
                <div className="text-[11px] font-mono text-ink-muted mt-0.5">
                  Credited: {selectedVoucher.sources.join(", ") || "–"}
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface rounded border border-line">
              <div className="text-xs text-ink-soft">
                <strong>Party:</strong> {selectedVoucher.partyName ?? "–"}
              </div>
              <div className="text-xs text-ink-soft mt-0.5">
                <strong>Expense Head:</strong> {selectedVoucher.heads.join(", ")}
              </div>
              {selectedVoucher.reference && (
                <div className="text-xs text-ink-soft mt-0.5">
                  <strong>Reference:</strong> {selectedVoucher.reference}
                </div>
              )}
              <div className="text-xs text-ink-soft mt-0.5">
                <strong>Narration:</strong> {selectedVoucher.narration}
              </div>
            </div>

            <div className="border border-line rounded overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-panel text-white text-[11px]">
                  <tr>
                    <th className="p-2">Type</th>
                    <th className="p-2">Account Name &amp; Group</th>
                    <th className="p-2 text-right">Debit (INR)</th>
                    <th className="p-2 text-right">Credit (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {selectedVoucher.lines.map((ln, idx) => (
                    <tr key={idx} className="hover:bg-canvas">
                      <td className="p-2">
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            ln.debitPaise > 0
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {ln.debitPaise > 0 ? "Dr" : "Cr"}
                        </span>
                      </td>
                      <td className="p-2 font-sans font-medium text-ink">
                        {ln.accountCode} {ln.accountName}
                        <span className="text-[10px] text-ink-subtle block font-mono capitalize">
                          {ln.group}
                        </span>
                      </td>
                      <td className="p-2 text-right font-bold text-ink">
                        {ln.debitPaise > 0 ? formatINR(toRupees(ln.debitPaise)) : "—"}
                      </td>
                      <td className="p-2 text-right font-bold text-ink">
                        {ln.creditPaise > 0 ? formatINR(toRupees(ln.creditPaise)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-surface border border-line-strong text-ink-soft hover:bg-canvas font-bold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Voucher</span>
              </button>

              <span className="text-[11px] font-mono text-ink-muted font-bold">
                {selectedVoucher.status === "reversed" ? "Reversed by a later entry" : "Posted"}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
