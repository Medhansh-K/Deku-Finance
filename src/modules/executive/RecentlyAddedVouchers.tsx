"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Eye,
  Plus,
  Building2,
  FileText,
  DollarSign,
  ShieldCheck,
  ChevronDown,
  Info,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import { accountingApi, partiesApi } from "@/api/endpoints";
import { TaxRegime } from "@/lib/org-regime";
import { journalToVoucher, VoucherItem } from "@/lib/reports/vouchers";
import { toPaise } from "@/lib/reports/ledger";

export type VoucherType = "all" | VoucherItem["voucher_type"];

export const VOUCHER_TYPE_STYLES = {
  sales: {
    label: "Sales",
    docSec22: "Bill of Supply (BOS)",
    docGst: "Tax Invoice (GST)",
    key: "F8",
    href: "/vouchers/sales",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold",
    dot: "bg-emerald-500",
  },
  payment: {
    label: "Payment",
    docSec22: "Payment Voucher",
    docGst: "Payment Voucher",
    key: "F5",
    href: "/vouchers/payment",
    badge: "bg-rose-50 text-rose-800 border-rose-300 font-bold",
    dot: "bg-rose-500",
  },
  receipt: {
    label: "Receipt",
    docSec22: "Bank / Cash Receipt",
    docGst: "Bank / Cash Receipt",
    key: "F6",
    href: "/vouchers/receipt",
    badge: "bg-blue-50 text-blue-800 border-blue-300 font-bold",
    dot: "bg-blue-500",
  },
  purchase: {
    label: "Purchase",
    docSec22: "Inward Bill / Purchase",
    docGst: "Vendor Tax Invoice",
    key: "F9",
    href: "/vouchers/purchase",
    badge: "bg-amber-50 text-amber-800 border-amber-300 font-bold",
    dot: "bg-amber-500",
  },
  contra: {
    label: "Contra",
    docSec22: "Cash/Bank Transfer Slip",
    docGst: "Cash/Bank Transfer Slip",
    key: "F4",
    href: "/vouchers/contra",
    badge: "bg-cyan-50 text-cyan-800 border-cyan-300 font-bold",
    dot: "bg-cyan-500",
  },
  journal: {
    label: "Journal",
    docSec22: "Adjustment Journal Memo",
    docGst: "Adjustment Journal Memo",
    key: "F7",
    href: "/vouchers/journal",
    badge: "bg-purple-50 text-purple-800 border-purple-300 font-bold",
    dot: "bg-purple-500",
  },
};

interface DayBookProps {
  activeOrgId: string;
  activeOrgName: string;
  activeRegime?: TaxRegime;
}

export function RecentlyAddedVouchers({
  activeOrgId,
  activeOrgName,
  activeRegime,
}: DayBookProps) {
  const router = useRouter();

  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<VoucherType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewVoucherMenuOpen, setIsNewVoucherMenuOpen] = useState(false);
  const [isPostingPending, setIsPostingPending] = useState(false);
  const [showDefinitionHelp, setShowDefinitionHelp] = useState(true);

  const loadVouchers = async () => {
    if (!activeOrgId) return;
    setLoadError(null);
    try {
      const [journals, accounts, parties] = await Promise.all([
        accountingApi.listJournals(activeOrgId),
        accountingApi.listAccounts(activeOrgId),
        partiesApi.list(activeOrgId),
      ]);
      const accountMap = new Map((accounts.data ?? []).map((a) => [a.id, a]));
      const partyMap = new Map((parties.data ?? []).map((p) => [p.id, p]));
      setVouchers(
        (journals.data ?? []).map((j) => journalToVoucher(j, accountMap, partyMap, activeRegime))
      );
    } catch (e: any) {
      setVouchers([]);
      setLoadError(e?.message || "Could not load the day book");
    }
  };

  useEffect(() => {
    loadVouchers();
  }, [activeOrgId, activeRegime]);

  // Filter vouchers by type and search query
  const filteredVouchers = vouchers.filter((item) => {
    if (selectedType !== "all" && item.voucher_type !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = item.entry_number.toLowerCase().includes(q);
      const matchParty = item.party_name.toLowerCase().includes(q);
      const matchRef = item.reference.toLowerCase().includes(q);
      const matchNarr = item.narration.toLowerCase().includes(q);
      const matchLF = item.ledger_folio.toLowerCase().includes(q);
      const matchDoc = item.source_document.toLowerCase().includes(q);
      if (!matchNo && !matchParty && !matchRef && !matchNarr && !matchLF && !matchDoc) {
        return false;
      }
    }
    return true;
  });

  const handleRowClick = (item: VoucherItem) => {
    setSelectedVoucher(item);
    setIsDetailModalOpen(true);
  };

  const handlePostDraftToLedger = async (vch: VoucherItem) => {
    setIsPostingPending(true);
    try {
      await accountingApi.postJournal(activeOrgId, vch.id);
      setIsDetailModalOpen(false);
      await loadVouchers();
    } catch (e: any) {
      alert(e?.message || `Could not post ${vch.entry_number}`);
    } finally {
      setIsPostingPending(false);
    }
  };

  const booked = vouchers.filter((v) => v.status !== "draft");
  const bookedDr = booked.reduce((s, v) => s + v.lines.reduce((t, l) => t + toPaise(l.debit), 0), 0);
  const bookedCr = booked.reduce((s, v) => s + v.lines.reduce((t, l) => t + toPaise(l.credit), 0), 0);

  const shortOrgName = activeOrgName.split(" ")[0];

  return (
    <div className="bg-white border border-line-strong rounded-xl shadow-xs overflow-hidden">
      {/* Table Header Strip */}
      <div className="bg-panel px-4 py-3.5 border-b border-edge flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-brand/20 border border-brand/50 flex items-center justify-center text-brand shrink-0 mt-0.5 sm:mt-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black tracking-tight font-sans uppercase">
                Day Book
              </h2>
              <span className="text-[10px] font-mono font-bold text-slate-300">
                (Chronological Financial Transactions Register)
              </span>
              <span className="text-[10px] font-mono text-brand-soft bg-white/10 px-2 py-0.5 rounded border border-brand/30 font-bold">
                🏢 {shortOrgName} Day Book
              </span>
              {!activeRegime ? null : activeRegime === "sec22" ? (
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                  Sec 22 Bill of Supply
                </span>
              ) : (
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                  GST Tax Engine Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Book of Prime Entry • Chronological daily log before totals are posted to the ledger
            </p>
          </div>
        </div>

        {/* Quick Voucher Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* New Voucher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNewVoucherMenuOpen(!isNewVoucherMenuOpen)}
              className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-soft text-ink font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Record transaction voucher (F4-F9)"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Voucher</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {isNewVoucherMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-52 bg-panel border border-edge rounded-lg shadow-xl py-1 z-30 divide-y divide-white/10"
                onMouseLeave={() => setIsNewVoucherMenuOpen(false)}
              >
                <Link
                  href="/vouchers/sales"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-brand/20 hover:text-brand-soft transition-colors"
                >
                  <div className="flex flex-col">
                    <span>{activeRegime === "sec22" ? "Bill of Supply" : "Sales Invoice"}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeRegime === "sec22" ? "Sec 22 Exempt" : "GST Tax Invoice"}
                    </span>
                  </div>
                  <kbd className="font-mono text-[10px] text-emerald-400 font-bold">F8</kbd>
                </Link>
                <Link
                  href="/vouchers/payment"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-brand/20 hover:text-brand-soft transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Payment (Vendor)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Cash / Bank payout</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-rose-400 font-bold">F5</kbd>
                </Link>
                <Link
                  href="/vouchers/receipt"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-brand/20 hover:text-brand-soft transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Receipt (Customer)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Bank NEFT / Cash</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-blue-400 font-bold">F6</kbd>
                </Link>
                <Link
                  href="/vouchers/purchase"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-brand/20 hover:text-brand-soft transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Purchase Bill</span>
                    <span className="text-[10px] text-slate-400 font-mono">Inward vendor bill</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-amber-400 font-bold">F9</kbd>
                </Link>
                <Link
                  href="/vouchers/contra"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-brand/20 hover:text-brand-soft transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Contra (Bank/Cash)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Internal transfers</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-cyan-400 font-bold">F4</kbd>
                </Link>
                <Link
                  href="/vouchers/journal"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-brand/20 hover:text-brand-soft transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Journal Entry</span>
                    <span className="text-[10px] text-slate-400 font-mono">Adjustments / Folio</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-purple-400 font-bold">F7</kbd>
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/day-book"
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 border border-white/20 transition-colors"
            title="Open complete chronological Day Book workspace (D)"
          >
            <span>Full Day Book View</span>
            <ExternalLink className="h-3.5 w-3.5 text-brand" />
          </Link>
        </div>
      </div>

      {/* Authoritative Accounting Definition Banner */}
      {showDefinitionHelp && (
        <div className="bg-[#F0FDF4] border-b border-emerald-200 px-4 py-2.5 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="p-1 rounded bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
              <Info className="h-3.5 w-3.5" />
            </span>
            <div className="text-slate-800 leading-relaxed font-sans">
              <span className="font-bold text-emerald-950 font-mono uppercase text-[11px] mr-1.5">
                Accounting Definition:
              </span>
              <span>
                A day book is recorded chronologically as financial transactions happen throughout the day, using source documents like invoices, receipts, and vouchers. Each entry captures core details—such as the date, particulars/party name, voucher or invoice number, ledger folio reference, and the transaction amount—before totals are posted to the ledger.
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowDefinitionHelp(false)}
            className="text-slate-400 hover:text-slate-600 text-xs font-mono font-bold shrink-0 ml-2 cursor-pointer"
            title="Dismiss definition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="p-3 bg-canvas border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: "all", label: "All Transactions", count: vouchers.length },
              { id: "sales", label: activeRegime === "sec22" ? "Sales / BOS (F8)" : "Sales Inv (F8)", count: vouchers.filter((v) => v.voucher_type === "sales").length },
              { id: "payment", label: "Payment (F5)", count: vouchers.filter((v) => v.voucher_type === "payment").length },
              { id: "receipt", label: "Receipt (F6)", count: vouchers.filter((v) => v.voucher_type === "receipt").length },
              { id: "purchase", label: "Purchase (F9)", count: vouchers.filter((v) => v.voucher_type === "purchase").length },
              { id: "contra", label: "Contra (F4)", count: vouchers.filter((v) => v.voucher_type === "contra").length },
              { id: "journal", label: "Journal (F7)", count: vouchers.filter((v) => v.voucher_type === "journal").length },
            ] as const
          ).map((tab) => {
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id as VoucherType)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-panel text-brand-soft border-edge shadow-xs"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search voucher, party, LF folio, or doc..."
            className="w-full bg-white border border-slate-300 rounded-md py-1 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Day Book Data Table (Captures all core details) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono uppercase tracking-wider text-slate-600">
              <th className="py-2.5 px-3 font-bold">Date &amp; Time</th>
              <th className="py-2.5 px-3 font-bold">Voucher / Invoice No.</th>
              <th className="py-2.5 px-3 font-bold">Type &amp; Source Document</th>
              <th className="py-2.5 px-3 font-bold">Particulars / Party Name</th>
              <th className="py-2.5 px-3 font-bold text-center" title="Ledger Folio: General ledger posting account reference">
                L.F.
              </th>
              <th className="py-2.5 px-3 font-bold">Narration &amp; Source Ref</th>
              <th className="py-2.5 px-3 font-bold text-right">Debit / Credit Amount</th>
              <th className="py-2.5 px-3 font-bold text-center">Ledger Status</th>
              <th className="py-2.5 px-3 font-bold text-right">Folio Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500 text-xs">
                  {loadError ?? (vouchers.length === 0 ? "No vouchers recorded yet." : "No Day Book entries found matching the selected filter.")}
                </td>
              </tr>
            ) : (
              filteredVouchers.map((item) => {
                const typeMeta = VOUCHER_TYPE_STYLES[item.voucher_type] || VOUCHER_TYPE_STYLES.journal;
                const docLabel =
                  item.voucher_type === "sales"
                    ? activeRegime === "sec22"
                      ? "Bill of Supply (BOS)"
                      : "Tax Invoice"
                    : typeMeta.docGst;

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className="hover:bg-brand/5 transition-colors cursor-pointer group"
                  >
                    {/* Date & Time (Chronological order) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono text-slate-800 font-semibold block">
                        {formatDateTally(item.entry_date)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {item.entry_time}
                      </span>
                    </td>

                    {/* Voucher / Invoice Number */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-ink group-hover:text-brand-strong transition-colors block">
                        {item.entry_number}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.reference}
                      </span>
                    </td>

                    {/* Type & Source Document */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${typeMeta.badge}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${typeMeta.dot}`} />
                          <span>{typeMeta.label}</span>
                          <span className="text-[9px] opacity-75">({typeMeta.key})</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[160px]" title={item.source_document || docLabel}>
                        📄 {item.source_document || docLabel}
                      </span>
                    </td>

                    {/* Particulars / Party Name */}
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <span className="font-semibold text-slate-900 block truncate group-hover:text-ink">
                        {item.party_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.lines.length} double-entry line{item.lines.length !== 1 ? "s" : ""}
                      </span>
                    </td>

                    {/* Ledger Folio (L.F.) Reference */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className="inline-block px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-300 group-hover:bg-brand/20 group-hover:border-brand group-hover:text-ink transition-colors"
                        title={`General Ledger Folio Reference: ${item.ledger_folio}`}
                      >
                        {item.ledger_folio}
                      </span>
                    </td>

                    {/* Narration & Source Ref */}
                    <td className="py-2.5 px-3 max-w-[240px]">
                      <span className="text-slate-700 block truncate text-[11px]">
                        {item.narration}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Source Ref: {item.reference}
                      </span>
                    </td>

                    {/* Debit / Credit Amount */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="font-mono font-black text-slate-900 text-xs group-hover:text-brand-strong transition-colors">
                        {formatINR(item.amount)}
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          item.dr_cr === "Dr" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {item.dr_cr} Balance
                      </span>
                    </td>

                    {/* Ledger Status (before / after posting) */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {item.status === "posted" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Posted to Ledger
                        </span>
                      ) : item.status === "reversed" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          Reversed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                          <Clock className="h-3 w-3 text-amber-600" />
                          Draft (Unposted)
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(item);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-brand hover:text-ink text-slate-700 text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="View complete double-entry ledger folio breakdown"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Folio</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info Strip */}
      <div className="p-3 bg-canvas border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-mono">
        <div>
          <span>Showing {filteredVouchers.length} of {vouchers.length} Day Book records • </span>
          <span className="text-slate-800 font-bold">
            Posted Debit Volume: {formatINR(filteredVouchers.filter((v) => v.status !== "draft").reduce((s, v) => s + v.amount, 0))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Posted Debits = Credits:</span>
          {booked.length === 0 ? (
            <span className="font-bold">–</span>
          ) : bookedDr === bookedCr ? (
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
            </span>
          ) : (
            <span className="text-rose-700 font-bold">Out by {formatINR((bookedDr - bookedCr) / 100)}</span>
          )}
        </div>
      </div>

      {/* Double-Entry Transaction & Folio Detail Modal */}
      {selectedVoucher && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Day Book Entry: ${selectedVoucher.entry_number}`}
          description={`Dated ${formatDateTally(selectedVoucher.entry_date)} • L.F. ${selectedVoucher.ledger_folio}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 font-sans text-xs">
            {/* Header Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Voucher No.
                </span>
                <span className="font-mono font-black text-sm text-ink">
                  {selectedVoucher.entry_number}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block">
                  Ref: {selectedVoucher.reference}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Source Document
                </span>
                <span className="font-medium text-slate-900 block truncate" title={selectedVoucher.source_document}>
                  {selectedVoucher.source_document}
                </span>
                <span className="text-[10px] font-mono text-brand-strong font-bold">
                  {selectedVoucher.f_key} Voucher
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Ledger Folio (L.F.)
                </span>
                <span className="font-mono font-black text-sm text-ink bg-white px-2 py-0.5 rounded border border-slate-300 inline-block mt-0.5">
                  {selectedVoucher.ledger_folio}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Posting Lifecycle
                </span>
                <div className="mt-0.5">
                  {selectedVoucher.status === "posted" ? (
                    <Badge variant="success">Posted to Ledger</Badge>
                  ) : selectedVoucher.status === "reversed" ? (
                    <Badge variant="danger">Reversed</Badge>
                  ) : (
                    <Badge variant="warning">Draft (Unposted)</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Narration */}
            <div>
              <span className="text-slate-500 block text-[10px] font-mono uppercase mb-1 font-bold">
                Particulars / Narration
              </span>
              <div className="p-3 bg-canvas rounded-lg border border-slate-200 text-slate-800">
                <div className="font-bold text-slate-900 mb-0.5">
                  Counterparty: {selectedVoucher.party_name}
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {selectedVoucher.narration}
                </p>
              </div>
            </div>

            {/* ALERX Double-Entry Ledger Lines */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-500 block text-[10px] font-mono uppercase font-bold">
                  authoritative double-entry general ledger postings
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  Total Balanced: {formatINR(selectedVoucher.amount)}
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono uppercase text-slate-600">
                      <th className="py-2 px-3">Dr / Cr</th>
                      <th className="py-2 px-3">General Ledger Account Head</th>
                      <th className="py-2 px-3">L.F. Folio</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Debit (₹)</th>
                      <th className="py-2 px-3 text-right">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedVoucher.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              line.dr_cr === "Dr"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {line.dr_cr}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-900 block">
                            {line.account_name}
                          </span>
                          {line.description && (
                            <span className="text-[10px] text-slate-500 block">
                              {line.description}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-600">
                          {line.ledger_folio || selectedVoucher.ledger_folio}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-mono text-[10px] text-slate-500 uppercase">
                            {line.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {line.debit > 0 ? formatINR(line.debit) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {line.credit > 0 ? formatINR(line.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-300 font-mono font-black text-xs text-slate-900">
                      <td colSpan={4} className="py-2 px-3 text-right">
                        Ledger Balance Check:
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {formatINR(selectedVoucher.lines.reduce((s, l) => s + l.debit, 0))}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {formatINR(selectedVoucher.lines.reduce((s, l) => s + l.credit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Source Document: {selectedVoucher.source_document}
              </span>
              <div className="flex items-center gap-2">
                {selectedVoucher.status === "draft" && (
                  <button
                    onClick={() => handlePostDraftToLedger(selectedVoucher)}
                    disabled={isPostingPending}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {isPostingPending ? "Posting..." : "Post to General Ledger"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Close Folio
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Backwards-compatibility alias
export const DayBookRegister = RecentlyAddedVouchers;
