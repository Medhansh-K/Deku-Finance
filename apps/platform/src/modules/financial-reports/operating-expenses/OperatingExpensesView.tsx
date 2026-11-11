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
      header: "Voucher and date",
      sortKey: (v) => v.entryNumber,
      cell: (v) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openVoucher(v);
          }}
          className="text-left group"
        >
          <div className="font-mono text-[12.5px] text-ink group-hover:text-brand-strong group-hover:underline flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-ink-subtle" />
            <span>{v.entryNumber}</span>
          </div>
          <span className="text-[12.5px] text-ink-muted block mt-0.5">
            {formatDateTally(v.date)}
          </span>
        </button>
      ),
    },
    {
      header: "Paid to and narration",
      sortKey: (v) => v.partyName ?? "",
      cell: (v) => (
        <div>
          <span className="font-medium text-ink block">{v.partyName ?? "–"}</span>
          <span className="text-[12.5px] text-ink-muted mt-0.5 block truncate max-w-xs">
            {v.narration}
          </span>
        </div>
      ),
    },
    {
      header: "Expense head",
      cell: (v) => (
        <div className="space-y-0.5">
          {v.heads.map((h) => (
            <span key={h} className="text-ink block">{h}</span>
          ))}
        </div>
      ),
    },
    {
      header: "Credited account",
      cell: (v) => (
        <span className="text-ink-soft block">
          {v.sources.join(", ") || "–"}
        </span>
      ),
    },
    {
      header: "Amount (₹)",
      align: "right",
      sortKey: (v) => v.amountPaise,
      cell: (v) => (
        <div className="text-right">
          <span className="font-semibold tabular-nums text-ink block mb-0.5">
            {formatINR(toRupees(v.amountPaise))}
          </span>
          <Badge variant={v.status === "reversed" ? "warning" : "success"}>
            {v.status === "reversed" ? "Reversed" : "Posted"}
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
          className="h-7 w-7 grid place-items-center text-ink-muted hover:text-ink hover:bg-canvas-sunken rounded-ctl transition-colors"
          title="View voucher details and double entry"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-1.5 text-[13.5px] text-ink-muted mb-2">
            <Link href="/gateway" className="hover:text-brand transition-colors">
              Gateway
            </Link>
            <ChevronRight className="h-3 w-3 text-ink-subtle" />
            <span className="font-medium text-ink">Operating expenses</span>
          </div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] text-ink">
            Operating expenses
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Posted entries on expense ledgers (cost of sales excluded), {formatDateTally(from)} to {formatDateTally(asOf)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link
            href="/vouchers/payment"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-ctl bg-ink text-white text-[13.5px] font-medium hover:bg-panel-raised transition-colors"
          >
            <Receipt className="h-4 w-4" />
            <span>Create payment voucher</span>
          </Link>
        </div>
      </div>

      {/* Top High-Level OPEX Summary Cards */}
      <div data-tour="opex-summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Total operating expenses</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <TrendingDown className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {hasData ? formatINR(toRupees(report.totalPaise)) : "–"}
          </div>
          <span className="text-[12.5px] text-ink-muted">
            Financial year to date
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Operating expense ratio</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <PieChart className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {ratio === null || !hasData ? "–" : `${ratio}%`}
          </div>
          <span className="text-[12.5px] text-ink-muted">
            {revenuePaise > 0 ? "Of revenue this year" : "No revenue posted this year"}
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Expense vouchers</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <Receipt className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {report.vouchers.length} vouchers
          </div>
          <span className="text-[12.5px] text-ink-muted">
            Posted entries touching expense heads
          </span>
        </div>

        <div className="rounded-panel border border-line bg-surface px-[18px] py-4">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <span>Expense heads used</span>
            <span className="h-6 w-6 rounded-md bg-canvas-sunken text-ink-soft grid place-items-center">
              <Briefcase className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-ink">
            {report.byHead.length} heads
          </div>
          <span className="text-[12.5px] text-ink-muted">
            Departments and budgets are not linked to entries
          </span>
        </div>
      </div>

      {/* Expense-head breakdown */}
      <div className="rounded-panel border border-line bg-surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              <span>Expense breakdown by ledger head</span>
            </h2>
            <p className="text-[13px] text-ink-muted">
              Click a head to list only the vouchers posted to it
            </p>
          </div>
          {selectedHead !== "all" && (
            <button
              onClick={() => setSelectedHead("all")}
              className="text-[13px] text-brand-strong hover:underline font-medium"
            >
              Show all heads
            </button>
          )}
        </div>

        {report.byHead.length === 0 ? (
          <p className="text-[13.5px] text-ink-muted py-4 text-center">
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
                  className={`p-3.5 rounded-ctl border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-brand bg-brand-wash shadow-[inset_3px_0_0_var(--color-brand)]"
                      : "border-line bg-surface hover:bg-canvas"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[12.5px] text-ink-soft">
                      {head.code}
                    </span>
                    <span className="text-[12.5px] text-ink-muted">{pct}% of opex</span>
                  </div>
                  <div className="text-[13.5px] font-medium text-ink truncate" title={head.name}>
                    {head.name}
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums text-ink mt-1">
                    {formatINR(toRupees(head.amountPaise))}
                  </div>

                  <div className="w-full bg-canvas-sunken h-1.5 rounded-[3px] mt-2.5 overflow-hidden">
                    <div
                      className="bg-brand h-full rounded-[3px]"
                      style={{ width: `${Math.max(0, pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[12.5px] text-ink-muted mt-1.5">
                    <span>{head.entries} {head.entries === 1 ? "voucher" : "vouchers"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 px-1">
        <div className="text-[13px] text-ink-muted">
          Showing <strong className="font-semibold text-ink">{filteredVouchers.length}</strong> of {report.vouchers.length} expense vouchers
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
          <div className="space-y-4 text-[13.5px]">
            <div className="bg-canvas-sunken/50 px-4 py-3.5 rounded-ctl border border-line flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <span className="text-[12.5px] text-ink-muted">
                  Voucher number
                </span>
                <div className="font-mono text-[15px] font-medium text-ink">
                  {selectedVoucher.entryNumber}
                </div>
                <div className="text-[12.5px] text-ink-muted mt-0.5">
                  Dated {formatDateTally(selectedVoucher.date)}
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-[12.5px] text-ink-muted">
                  Operating expense
                </span>
                <div className="text-[18px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
                  {formatINR(toRupees(selectedVoucher.amountPaise))}
                </div>
                <div className="text-[12.5px] text-ink-muted mt-0.5">
                  Credited: {selectedVoucher.sources.join(", ") || "–"}
                </div>
              </div>
            </div>

            <div className="grid gap-1 px-4 py-3 bg-surface rounded-ctl border border-line text-ink-soft">
              <div>
                <span className="text-ink-muted">Party:</span> {selectedVoucher.partyName ?? "–"}
              </div>
              <div>
                <span className="text-ink-muted">Expense head:</span> {selectedVoucher.heads.join(", ")}
              </div>
              {selectedVoucher.reference && (
                <div>
                  <span className="text-ink-muted">Reference:</span> {selectedVoucher.reference}
                </div>
              )}
              <div>
                <span className="text-ink-muted">Narration:</span> {selectedVoucher.narration}
              </div>
            </div>

            <div className="border border-line rounded-ctl overflow-x-auto">
              <table className="w-full text-left text-[13.5px]">
                <thead className="bg-canvas-sunken/50 border-b border-line text-ink-muted text-[12.5px]">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Account and group</th>
                    <th className="px-3 py-2.5 font-medium text-right">Debit (₹)</th>
                    <th className="px-3 py-2.5 font-medium text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {selectedVoucher.lines.map((ln, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2.5 text-[12.5px] font-semibold text-brand-strong">
                        {ln.debitPaise > 0 ? "Dr" : "Cr"}
                      </td>
                      <td className="px-3 py-2.5 text-ink">
                        {ln.accountCode} {ln.accountName}
                        <span className="text-[12px] text-ink-muted block capitalize">
                          {ln.group}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                        {ln.debitPaise > 0 ? formatINR(toRupees(ln.debitPaise)) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">
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
                className="h-9 px-3.5 bg-surface border border-line-strong text-ink hover:bg-canvas text-[13.5px] font-medium rounded-ctl flex items-center gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print voucher</span>
              </button>

              <span className={`inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium ${selectedVoucher.status === "reversed" ? "bg-warn-wash text-warn" : "bg-ok-wash text-ok"}`}>
                {selectedVoucher.status === "reversed" ? "Reversed by a later entry" : "Posted"}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
