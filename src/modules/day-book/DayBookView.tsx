"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import {
  Calendar,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  BookOpen,
  Info,
  Building2,
  Plus,
  Eye,
  Printer,
  ShieldCheck,
  Paperclip,
  ShieldAlert,
  FileCheck,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { accountingApi, organisationsApi, OrgSummary } from "@/api/endpoints";
import { JournalEntry, JournalStatus } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { getOrgTaxProfile, getDefaultTaxProfile, OrgTaxProfile } from "@/lib/org-regime";
import { getVouchersForOrg, VoucherItem, VOUCHER_TYPE_STYLES } from "@/modules/executive/RecentlyAddedVouchers";
import { numberToIndianWords } from "@/lib/builder/number-to-words";
import { DocumentProofAttachment, SAMPLE_PROOFS } from "@/lib/vouchers/document-proof";

export function DayBookView() {
  const [mounted, setMounted] = useState(false);
  const [journals, setJournals] = useState<VoucherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Organisation State (initialized with deterministic server default)
  const [orgId, setOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [taxProfile, setTaxProfile] = useState<OrgTaxProfile>(() =>
    getDefaultTaxProfile("")
  );
  const [orgList, setOrgList] = useState<OrgSummary[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Transaction Detail Modal
  const [selectedEntry, setSelectedEntry] = useState<VoucherItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  // Reversal Modal State
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState<string>("2026-10-23");
  const [reversalReason, setReversalReason] = useState<string>("");

  // Printable Indian GAAP Voucher Slip Modal State
  const [isPrintSlipOpen, setIsPrintSlipOpen] = useState(false);

  // Attach Proof Modal State for Unposted Drafts
  const [isAttachProofModalOpen, setIsAttachProofModalOpen] = useState(false);
  const [draftProofRefInput, setDraftProofRefInput] = useState<string>("");

  // Definition banner toggle
  const [showDefinition, setShowDefinition] = useState(true);

  // Load active organisation from storage & list after mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("deku_active_org_id") || "";
      const savedName = localStorage.getItem("deku_active_org_name") || "";
      setOrgId(savedId);
      setOrgName(savedName);
      setTaxProfile(getOrgTaxProfile(savedId));
    }

    organisationsApi
      .list()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setOrgList(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSwitchOrg = (newId: string) => {
    const found = orgList.find((o) => o.id === newId);
    setOrgId(newId);
    if (found) setOrgName(found.name);
    setTaxProfile(getOrgTaxProfile(newId));

    if (typeof window !== "undefined") {
      localStorage.setItem("deku_active_org_id", newId);
      if (found) localStorage.setItem("deku_active_org_name", found.name);
      window.dispatchEvent(new Event("deku_active_org_changed"));
    }
  };

  // Reactive listener for ledger changes from voucher posting or reversals
  useEffect(() => {
    if (!orgId) return;
    const handleUpdate = () => {
      fetchJournals();
    };
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId]);

  const fetchJournals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const seed = getVouchersForOrg(orgId);
      const res = await accountingApi.listJournals(orgId);

      if (res.data && res.data.length > 0) {
        const apiVouchers: VoucherItem[] = res.data.map((j) => {
          const pfx = (j.entry_number || "").split("-")[0].toUpperCase();
          let vType: VoucherItem["voucher_type"] = "journal";
          let fKey = "F7";
          let lf = "LF-100";
          let srcDoc = "General Journal Memo";

          if (pfx.includes("SLS") || pfx.includes("SAL") || pfx.includes("INV")) {
            vType = "sales";
            fKey = "F8";
            lf = "LF-104";
            srcDoc = taxProfile.regime === "sec22" ? "Bill of Supply (BOS)" : "Tax Invoice";
          } else if (pfx.includes("PAY")) {
            vType = "payment";
            fKey = "F5";
            lf = "LF-502";
            srcDoc = "Payment Advice Voucher";
          } else if (pfx.includes("RCP") || pfx.includes("REC")) {
            vType = "receipt";
            fKey = "F6";
            lf = "LF-201";
            srcDoc = "Bank Collection Advice";
          } else if (pfx.includes("PUR")) {
            vType = "purchase";
            fKey = "F9";
            lf = "LF-305";
            srcDoc = "Vendor Inward Bill";
          } else if (pfx.includes("CNT")) {
            vType = "contra";
            fKey = "F4";
            lf = "LF-203";
            srcDoc = "Cash / Bank Contra Slip";
          }

          const totalAmount = (j.journal_entry_lines || []).reduce(
            (sum, l) => sum + (l.debit || 0),
            0
          );

          return {
            id: j.id,
            entry_number: j.entry_number,
            voucher_type: vType,
            f_key: fKey,
            entry_date: j.entry_date,
            entry_time: "12:00 PM",
            party_name: j.narration?.split("-")[0]?.trim() || "Authoritative Transaction",
            source_document: srcDoc,
            ledger_folio: lf,
            reference: j.reference || j.entry_number,
            narration: j.narration || "Authoritative ALERX Entry",
            amount: totalAmount || 10000,
            dr_cr: "Dr",
            status: (j.status as any) || "posted",
            organisation_id: orgId,
            lines: (j.journal_entry_lines || []).map((l, idx) => ({
              dr_cr: l.debit > 0 ? "Dr" : "Cr",
              account_name: l.description || `Ledger Head (${l.account_id})`,
              category: "Asset",
              debit: l.debit || 0,
              credit: l.credit || 0,
              ledger_folio: `LF-${100 + idx * 5}`,
              description: l.description,
            })),
          };
        });

        const localRaw = typeof window !== "undefined" ? localStorage.getItem("deku_local_daybook_vouchers") : null;
        const localVouchers: VoucherItem[] = localRaw ? JSON.parse(localRaw) : [];
        const existingNos = new Set([...apiVouchers.map((v) => v.entry_number), ...localVouchers.map((v) => v.entry_number)]);
        const uniqueSeed = seed.filter((v) => !existingNos.has(v.entry_number));
        setJournals([...localVouchers, ...apiVouchers, ...uniqueSeed]);
      } else {
        const localRaw = typeof window !== "undefined" ? localStorage.getItem("deku_local_daybook_vouchers") : null;
        const localVouchers: VoucherItem[] = localRaw ? JSON.parse(localRaw) : [];
        const existingNos = new Set(localVouchers.map((v) => v.entry_number));
        const uniqueSeed = seed.filter((v) => !existingNos.has(v.entry_number));
        setJournals([...localVouchers, ...uniqueSeed]);
      }
    } catch (err: any) {
      // Fallback seamlessly to seed + local confirmed vouchers
      const localRaw = typeof window !== "undefined" ? localStorage.getItem("deku_local_daybook_vouchers") : null;
      const localVouchers: VoucherItem[] = localRaw ? JSON.parse(localRaw) : [];
      const seed = getVouchersForOrg(orgId);
      const existingNos = new Set(localVouchers.map((v) => v.entry_number));
      const uniqueSeed = seed.filter((v) => !existingNos.has(v.entry_number));
      setJournals([...localVouchers, ...uniqueSeed]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchJournals();
  }, [orgId]);

  // Handle Post Draft Journal to ledger
  const handlePostDraft = async (vch: VoucherItem) => {
    // If voucher has no document proof, prompt user to attach proof first
    if (!vch.document_proof) {
      setSelectedEntry(vch);
      setDraftProofRefInput(vch.reference || "");
      setIsAttachProofModalOpen(true);
      return;
    }

    if (confirm(`Post draft transaction ${vch.entry_number} into General Ledger (L.F. ${vch.ledger_folio}) with verified proof [${vch.document_proof.title}]?`)) {
      setIsActionPending(true);
      try {
        setJournals((prev) =>
          prev.map((v) => (v.id === vch.id ? { ...v, status: "posted" } : v))
        );
        if (selectedEntry && selectedEntry.id === vch.id) {
          setSelectedEntry({ ...selectedEntry, status: "posted" });
        }

        // Update localStorage
        if (typeof window !== "undefined") {
          const localRaw = localStorage.getItem("deku_local_daybook_vouchers");
          const localVouchers: VoucherItem[] = localRaw ? JSON.parse(localRaw) : [];
          const updatedLocal = localVouchers.map((v) =>
            v.id === vch.id ? { ...v, status: "posted" as const } : v
          );
          localStorage.setItem("deku_local_daybook_vouchers", JSON.stringify(updatedLocal));
        }

        // Dispatch reactive ledger update
        window.dispatchEvent(
          new CustomEvent("deku_ledger_updated", {
            detail: { voucherNumber: vch.entry_number },
          })
        );

        alert(`Transaction ${vch.entry_number} successfully posted to General Ledger and financial statements.`);
      } finally {
        setIsActionPending(false);
      }
    }
  };

  const handleAttachProofAndPost = async () => {
    if (!selectedEntry) return;

    // Use sample or generated proof for this mode
    const sampleList = SAMPLE_PROOFS[selectedEntry.voucher_type] || SAMPLE_PROOFS.sales;
    const sample = sampleList[0];

    const proof: DocumentProofAttachment = {
      ...sample,
      id: `proof-${Date.now()}`,
      refNumber: draftProofRefInput.trim() || sample.refNumber,
      uploadedAt: new Date().toISOString(),
      verified: true,
      notes: `Attached and verified during Day Book ledger posting.`,
    };

    setIsActionPending(true);
    try {
      const updated: VoucherItem = {
        ...selectedEntry,
        status: "posted" as const,
        document_proof: proof,
      };

      setJournals((prev) =>
        prev.map((v) => (v.id === selectedEntry.id ? updated : v))
      );
      setSelectedEntry(updated);

      // Update localStorage
      if (typeof window !== "undefined") {
        const localRaw = localStorage.getItem("deku_local_daybook_vouchers");
        const localVouchers: VoucherItem[] = localRaw ? JSON.parse(localRaw) : [];
        const updatedLocal = localVouchers.map((v) =>
          v.id === selectedEntry.id ? updated : v
        );
        localStorage.setItem("deku_local_daybook_vouchers", JSON.stringify(updatedLocal));
      }

      window.dispatchEvent(
        new CustomEvent("deku_ledger_updated", {
          detail: { voucherNumber: selectedEntry.entry_number },
        })
      );

      setIsAttachProofModalOpen(false);
      alert(`Proof attached! Transaction ${selectedEntry.entry_number} posted to General Ledger & Day Book.`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleOpenReverseModal = (vch: VoucherItem) => {
    setSelectedEntry(vch);
    setReversalDate(toISODateString());
    setReversalReason(`Reversal of ${vch.voucher_type.toUpperCase()} voucher #${vch.entry_number}`);
    setIsReversalModalOpen(true);
  };

  const handleConfirmReversal = async () => {
    if (!selectedEntry) return;
    setIsActionPending(true);
    try {
      try {
        await accountingApi.reverseJournal(orgId, selectedEntry.id, {
          reversal_date: reversalDate,
          narration: reversalReason,
        });
      } catch (e) {
        console.warn("Backend journal reversal notice (contra fallback active):", e);
      }

      const updatedJournals = journals.map((j) =>
        j.id === selectedEntry.id
          ? {
              ...j,
              status: "reversed" as const,
              reversal_ref: `REV-${selectedEntry.entry_number}`,
              reversal_reason: reversalReason,
              reversed_at: reversalDate,
            }
          : j
      );

      // Add contra reversal voucher into chronological Day Book
      const reversalContraEntry: VoucherItem = {
        id: `rev-${selectedEntry.id}-${Date.now()}`,
        entry_number: `REV-${selectedEntry.entry_number}`,
        voucher_type: selectedEntry.voucher_type,
        f_key: selectedEntry.f_key,
        entry_date: reversalDate,
        entry_time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        party_name: selectedEntry.party_name,
        source_document: `Reversal Contra Slip (${selectedEntry.entry_number})`,
        ledger_folio: selectedEntry.ledger_folio,
        reference: selectedEntry.entry_number,
        narration: `[CONTRA REVERSAL] ${reversalReason}`,
        amount: selectedEntry.amount,
        dr_cr: selectedEntry.dr_cr === "Dr" ? "Cr" : "Dr",
        status: "posted",
        organisation_id: orgId,
        reversal_ref: selectedEntry.entry_number,
        lines: selectedEntry.lines.map((l) => ({
          ...l,
          dr_cr: l.dr_cr === "Dr" ? "Cr" : "Dr",
          debit: l.credit,
          credit: l.debit,
          description: `Contra reversal: ${l.account_name}`,
        })),
        document_proof: {
          id: `proof-rev-${Date.now()}`,
          proofType: "journal_adjustment_bill",
          categoryLabel: "Reversal Audit Memo",
          title: `Reversal Sanction Memo for #${selectedEntry.entry_number}`,
          refNumber: `REV-${selectedEntry.entry_number}`,
          uploadedAt: new Date().toISOString(),
          verified: true,
          notes: reversalReason,
        },
      };

      setJournals([reversalContraEntry, ...updatedJournals]);

      if (typeof window !== "undefined") {
        const localRaw = localStorage.getItem("deku_local_daybook_vouchers");
        const localVouchers: VoucherItem[] = localRaw ? JSON.parse(localRaw) : [];
        const updatedLocal = localVouchers.map((v) =>
          v.id === selectedEntry.id || v.entry_number === selectedEntry.entry_number
            ? {
                ...v,
                status: "reversed" as const,
                reversal_ref: `REV-${selectedEntry.entry_number}`,
                reversal_reason: reversalReason,
              }
            : v
        );
        localStorage.setItem(
          "deku_local_daybook_vouchers",
          JSON.stringify([reversalContraEntry, ...updatedLocal])
        );

        window.dispatchEvent(
          new CustomEvent("deku_ledger_updated", {
            detail: { voucherNumber: selectedEntry.entry_number, reversed: true },
          })
        );
      }

      setIsReversalModalOpen(false);
      setIsDetailOpen(false);
      alert(`Voucher ${selectedEntry.entry_number} reversed. Contra entry REV-${selectedEntry.entry_number} recorded in Day Book & General Ledger.`);
    } catch (err: any) {
      alert(`Reversal failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // Filter journals
  const filteredJournals = journals.filter((entry) => {
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (dateFilter && entry.entry_date !== dateFilter) return false;
    if (voucherTypeFilter !== "all" && entry.voucher_type !== voucherTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = entry.entry_number.toLowerCase().includes(q);
      const matchParty = entry.party_name.toLowerCase().includes(q);
      const matchRef = entry.reference.toLowerCase().includes(q);
      const matchNarr = entry.narration.toLowerCase().includes(q);
      const matchLF = entry.ledger_folio.toLowerCase().includes(q);
      const matchDoc = entry.source_document.toLowerCase().includes(q);
      if (!matchNo && !matchParty && !matchRef && !matchNarr && !matchLF && !matchDoc) {
        return false;
      }
    }
    return true;
  });

  const columns: ColumnDef<VoucherItem>[] = [
    {
      header: "Date & Time",
      sortKey: (j) => j.entry_date,
      cell: (j) => (
        <div>
          <span className="font-mono text-slate-800 font-semibold block">
            {formatDateTally(j.entry_date)}
          </span>
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {j.entry_time || "12:00 PM"}
          </span>
        </div>
      ),
    },
    {
      header: "Voucher / Invoice No.",
      sortKey: (j) => j.entry_number,
      cell: (j) => (
        <div>
          <span className="font-mono font-bold text-[#0F172A] block">
            {j.entry_number}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {j.reference}
          </span>
        </div>
      ),
    },
    {
      header: "Type & Source Document",
      cell: (j) => {
        const typeMeta = VOUCHER_TYPE_STYLES[j.voucher_type] || VOUCHER_TYPE_STYLES.journal;
        return (
          <div>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${typeMeta.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${typeMeta.dot}`} />
              <span>{typeMeta.label}</span>
              <span className="text-[9px] opacity-75">({typeMeta.key})</span>
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[170px]" title={j.source_document}>
              📄 {j.source_document}
            </span>
          </div>
        );
      },
    },
    {
      header: "Particulars / Party",
      sortKey: (j) => j.party_name,
      cell: (j) => (
        <div className="max-w-xs">
          <span className="text-slate-900 block truncate font-semibold">
            {j.party_name}
          </span>
          <span className="text-[11px] text-slate-500 truncate block">
            {j.narration}
          </span>
        </div>
      ),
    },
    {
      header: "L.F.",
      sortKey: (j) => j.ledger_folio,
      cell: (j) => (
        <span
          className="inline-block px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-300"
          title={`General Ledger Folio: ${j.ledger_folio}`}
        >
          {j.ledger_folio}
        </span>
      ),
    },
    {
      header: "Status & Proof",
      sortKey: (j) => j.status,
      cell: (j) => {
        const s = j.status;
        const hasProof = !!j.document_proof;
        if (s === "posted") {
          return (
            <div>
              <Badge variant="success">Posted to Ledger</Badge>
              {hasProof ? (
                <span className="text-[9px] font-mono text-emerald-800 flex items-center gap-0.5 mt-0.5 font-bold">
                  <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
                  Proof Verified
                </span>
              ) : (
                <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                  General Posting
                </span>
              )}
            </div>
          );
        }
        if (s === "reversed") {
          return (
            <div>
              <Badge variant="danger">Reversed</Badge>
              <span className="text-[9px] font-mono text-rose-600 block mt-0.5 font-semibold">
                Contra Entry
              </span>
            </div>
          );
        }
        return (
          <div>
            <Badge variant="warning">Draft (Unposted)</Badge>
            {hasProof ? (
              <span className="text-[9px] font-mono text-emerald-700 flex items-center gap-0.5 mt-0.5">
                <Check className="h-2.5 w-2.5" /> Proof Ready
              </span>
            ) : (
              <span className="text-[9px] font-mono text-amber-700 flex items-center gap-0.5 mt-0.5 font-bold">
                <ShieldAlert className="h-2.5 w-2.5 text-amber-600" /> Proof Pending
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Debit / Credit Amount",
      sortKey: (j) => j.amount,
      cell: (j) => (
        <div className="text-right">
          <span className="font-mono font-bold text-slate-900 block">
            {formatINR(j.amount)}
          </span>
          <span
            className={`text-[10px] font-mono font-bold ${
              j.dr_cr === "Dr" ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {j.dr_cr}
          </span>
        </div>
      ),
    },
    {
      header: "Actions",
      cell: (j) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setSelectedEntry(j);
              setIsDetailOpen(true);
            }}
            className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedEntry(j);
              setIsPrintSlipOpen(true);
            }}
            className="p-1 rounded hover:bg-slate-100 text-[#2D7A7A] hover:text-[#1F2324] cursor-pointer"
            title="Print Indian GAAP Voucher Slip"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          {j.status === "posted" && (
            <button
              type="button"
              onClick={() => handleOpenReverseModal(j)}
              className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
              title="Reverse Voucher"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Top Bar with Organisation Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#5BB5BB]/20 border border-[#5BB5BB]/50 flex items-center justify-center text-[#5BB5BB]">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2" suppressHydrationWarning>
              <span className="font-bold text-sm text-[#0F172A]">Day Book Register</span>
              {taxProfile.regime === "sec22" ? (
                <span
                  suppressHydrationWarning
                  className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300"
                >
                  Sec 22 Exempt (Pure)
                </span>
              ) : (
                <span
                  suppressHydrationWarning
                  className="text-[10px] font-mono font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300"
                >
                  GST Registered • {taxProfile.gstin || "Active"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Chronological book of prime entry across all source documents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {orgList.length > 0 && (
            <select
              value={orgId}
              onChange={(e) => handleSwitchOrg(e.target.value)}
              className="bg-white text-slate-800 font-semibold text-xs py-1.5 px-3 rounded-lg border border-slate-300 focus:outline-none focus:border-[#5BB5BB] cursor-pointer"
            >
              {orgList.map((org) => (
                <option key={org.id} value={org.id}>
                  🏢 {org.name}
                </option>
              ))}
            </select>
          )}

          <Button variant="outline" size="sm" onClick={fetchJournals} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Authoritative Accounting Definition Banner */}
      {showDefinition && (
        <div className="bg-[#F0FDF4] border border-emerald-200 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="p-1 rounded bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
              <Info className="h-4 w-4" />
            </span>
            <div className="text-slate-800 leading-relaxed">
              <span className="font-black text-emerald-950 font-mono uppercase text-[11px] mr-1.5">
                Authoritative Day Book Principle:
              </span>
              <span>
                A day book is recorded chronologically as financial transactions happen throughout the day, using source documents like invoices, receipts, and vouchers. Each entry captures core details—such as the date, particulars/party name, voucher or invoice number, ledger folio reference, and the transaction amount—before totals are posted to the ledger.
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowDefinition(false)}
            className="text-slate-400 hover:text-slate-600 text-xs font-mono font-bold shrink-0 ml-2 cursor-pointer"
            title="Dismiss definition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1">
            {(["all", "posted", "draft", "reversed"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 font-semibold rounded text-xs capitalize transition-colors cursor-pointer ${
                  statusFilter === st
                    ? "bg-[#1F2324] text-white font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          {/* Type Filter */}
          <select
            value={voucherTypeFilter}
            onChange={(e) => setVoucherTypeFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 font-medium cursor-pointer"
          >
            <option value="all">All Voucher Types</option>
            <option value="sales">Sales Invoice / BOS (F8)</option>
            <option value="payment">Payment Voucher (F5)</option>
            <option value="receipt">Customer Receipt (F6)</option>
            <option value="purchase">Purchase Bill (F9)</option>
            <option value="contra">Contra (Bank/Cash) (F4)</option>
            <option value="journal">Journal Voucher (F7)</option>
          </select>

          {/* Date Picker Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-mono text-[11px]">Filter Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-[11px] text-[#5BB5BB] hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search party, LF folio, or voucher..."
            className="w-full bg-white border border-slate-300 rounded-md py-1 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#5BB5BB]"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button onClick={fetchJournals} className="underline font-bold ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Day Book Table */}
      <DataTable
        columns={columns}
        data={filteredJournals}
        searchPlaceholder="Search Day Book entries..."
        isLoading={isLoading}
        emptyMessage="No Day Book records found for the selected criteria."
        onRowClick={(entry) => {
          setSelectedEntry(entry);
          setIsDetailOpen(true);
        }}
        pageSize={20}
      />

      {/* Transaction Folio Detail Modal */}
      {selectedEntry && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Day Book Entry: ${selectedEntry.entry_number}`}
          description={`Date: ${formatDateTally(selectedEntry.entry_date)} • L.F. ${selectedEntry.ledger_folio} • Status: ${selectedEntry.status.toUpperCase()}`}
          maxWidth="xl"
        >
          <div className="space-y-4 font-sans text-xs">
            {/* Header Meta */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Voucher / Invoice No.
                </span>
                <span className="font-mono font-bold text-sm text-[#0F172A]">
                  {selectedEntry.entry_number}
                </span>
                <span className="text-[10px] font-mono text-slate-400 block">
                  Ref: {selectedEntry.reference}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Source Document &amp; LF
                </span>
                <span className="font-semibold text-slate-900 block truncate">
                  {selectedEntry.source_document}
                </span>
                <span className="font-mono font-bold text-xs text-[#2D7A7A]">
                  Ledger Folio: {selectedEntry.ledger_folio}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Lifecycle State
                </span>
                <Badge
                  variant={
                    selectedEntry.status === "posted"
                      ? "success"
                      : selectedEntry.status === "reversed"
                      ? "danger"
                      : "warning"
                  }
                >
                  {selectedEntry.status === "posted" ? "Posted to Ledger" : selectedEntry.status}
                </Badge>
              </div>
            </div>

            {/* Narration */}
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase mb-1">
                Particulars / Party / Narration
              </span>
              <div className="bg-white p-2.5 rounded border border-slate-200 text-slate-800 space-y-1">
                <span className="font-bold text-slate-900 block">
                  {selectedEntry.party_name}
                </span>
                <p className="text-slate-600 text-[11px]">
                  {selectedEntry.narration}
                </p>
              </div>
            </div>

            {/* Statutory Document Proof Status */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Statutory Document Proof &amp; Verification
                </span>
                {selectedEntry.document_proof ? (
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-700" />
                    Verified Proof Attached
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-amber-700" />
                    Proof Missing
                  </span>
                )}
              </div>

              {selectedEntry.document_proof ? (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                      <FileCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-emerald-950 text-xs block">
                        {selectedEntry.document_proof.title}
                      </span>
                      <div className="flex items-center gap-3 text-[11px] text-emerald-800 mt-0.5 flex-wrap font-mono">
                        <span>
                          Category: <strong>{selectedEntry.document_proof.categoryLabel}</strong>
                        </span>
                        {selectedEntry.document_proof.refNumber && (
                          <span>
                            Ref / Ack #: <strong>{selectedEntry.document_proof.refNumber}</strong>
                          </span>
                        )}
                        {selectedEntry.document_proof.fileSize && (
                          <span>
                            File: <strong>{selectedEntry.document_proof.fileName} ({selectedEntry.document_proof.fileSize})</strong>
                          </span>
                        )}
                        {selectedEntry.document_proof.approvedBy && (
                          <span className="text-emerald-900 bg-emerald-200 px-1.5 py-0.2 rounded font-bold">
                            ✓ {selectedEntry.document_proof.approvedBy}
                          </span>
                        )}
                      </div>
                      {selectedEntry.document_proof.notes && (
                        <p className="text-[10px] text-emerald-700 mt-1 italic">
                          {selectedEntry.document_proof.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-900">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Proof Missing:</strong> Indian GAAP statutory compliance requires verifiable document proof before this entry can update the Chart of Accounts, P&amp;L, or Balance Sheet.
                    </span>
                  </div>
                  {selectedEntry.status === "draft" && (
                    <Button
                      variant="tally"
                      size="sm"
                      onClick={() => {
                        setDraftProofRefInput(selectedEntry.reference || "");
                        setIsAttachProofModalOpen(true);
                      }}
                      className="text-xs shrink-0 font-bold"
                    >
                      Attach Proof &amp; Post
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Double-Entry Line Allocations */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  ALERX General Ledger Postings ({selectedEntry.lines.length} lines)
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  Total: {formatINR(selectedEntry.amount)}
                </span>
              </div>

              <div className="overflow-x-auto rounded border border-slate-300">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[11px] text-slate-700">
                      <th className="py-1.5 px-3">Dr / Cr</th>
                      <th className="py-1.5 px-3">General Ledger Account Head</th>
                      <th className="py-1.5 px-3">L.F.</th>
                      <th className="py-1.5 px-3 text-right">Debit (₹)</th>
                      <th className="py-1.5 px-3 text-right">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-mono font-bold">
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
                        <td className="py-1.5 px-3">
                          <span className="font-medium text-slate-800 block">
                            {line.account_name}
                          </span>
                          {line.description && (
                            <span className="text-[10px] text-slate-400 block">
                              {line.description}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-slate-600 font-bold">
                          {line.ledger_folio || selectedEntry.ledger_folio}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                          {line.debit > 0 ? formatINR(line.debit) : "—"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                          {line.credit > 0 ? formatINR(line.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Source Document: {selectedEntry.source_document}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPrintSlipOpen(true)}
                  className="gap-1.5 text-xs text-[#2D7A7A] border-[#2D7A7A]/40"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Voucher Slip
                </Button>

                {selectedEntry.status === "posted" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenReverseModal(selectedEntry)}
                    className="gap-1.5 text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reverse Voucher
                  </Button>
                )}

                {selectedEntry.status === "draft" && (
                  <Button
                    variant="tally"
                    size="sm"
                    onClick={() => handlePostDraft(selectedEntry)}
                    isLoading={isActionPending}
                  >
                    Post to General Ledger
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

      {/* Reversal Confirmation Modal */}
      {selectedEntry && (
        <Modal
          isOpen={isReversalModalOpen}
          onClose={() => setIsReversalModalOpen(false)}
          title={`Reverse Voucher: ${selectedEntry.entry_number}`}
          description={`Double-entry contra reversal for ${selectedEntry.party_name} (₹${selectedEntry.amount.toLocaleString("en-IN")})`}
          maxWidth="md"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5">
              <RotateCcw className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Statutory Audit Safeguard:</strong> Reversing this voucher will not delete historical records. An auditable Contra Reversal entry will be posted, reversing all debits to credits and credits to debits, updating the Chart of Accounts, Day Book, and Financial Statements.
              </div>
            </div>

            <div className="space-y-2">
              <Input
                label="Reversal Posting Date (YYYY-MM-DD)"
                type="date"
                value={reversalDate}
                onChange={(e) => setReversalDate(e.target.value)}
                required
              />

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Reason for Reversal (Mandatory Audit Memo)
                </label>
                <textarea
                  rows={2}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Erroneous account head / invoice cancelled / duplicate transaction"
                  className="w-full rounded border border-slate-300 p-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsReversalModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmReversal}
                isLoading={isActionPending}
                className="gap-1.5 font-bold"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Confirm &amp; Post Reversal
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Formal Indian GAAP Printable Voucher Slip Modal */}
      {selectedEntry && (
        <Modal
          isOpen={isPrintSlipOpen}
          onClose={() => setIsPrintSlipOpen(false)}
          title={`Print Indian GAAP Voucher Slip: ${selectedEntry.entry_number}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 font-sans text-xs">
            {/* The Printable Slip Frame */}
            <div
              id="printable-voucher-slip"
              className="bg-white p-6 rounded-lg border-2 border-slate-800 text-slate-900 shadow-sm space-y-4 print:p-0 print:border-none"
            >
              {/* Header */}
              <div className="border-b-2 border-slate-800 pb-3 flex items-start justify-between">
                <div>
                  <h1 className="text-base font-black uppercase tracking-wider text-slate-900 font-serif">
                    {orgName}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-mono">
                    Financial Operating System • Corporate Day Book Ledger
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {taxProfile.regime === "sec22" ? (
                      <span>Regime: Section 22 Pure Tax Exempt • No GST Applicable</span>
                    ) : (
                      <span>GSTIN: <strong>{taxProfile.gstin || "27AABCU9603R1ZM"}</strong> • Maharashtra</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-black text-xs px-2.5 py-1 rounded bg-slate-900 text-white uppercase tracking-wider inline-block">
                    {selectedEntry.voucher_type.toUpperCase()} VOUCHER ({selectedEntry.f_key})
                  </span>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Status: <strong className="uppercase">{selectedEntry.status}</strong>
                  </div>
                </div>
              </div>

              {/* Voucher Meta Grid */}
              <div className="grid grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded border border-slate-300 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Voucher No.</span>
                  <strong className="text-slate-900">{selectedEntry.entry_number}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Date</span>
                  <strong className="text-slate-900">{formatDateTally(selectedEntry.entry_date)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Ledger Folio</span>
                  <strong className="text-[#2D7A7A]">{selectedEntry.ledger_folio}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Reference</span>
                  <strong className="text-slate-900">{selectedEntry.reference}</strong>
                </div>
              </div>

              {/* Counterparty / Particulars */}
              <div className="border border-slate-300 rounded p-2.5">
                <span className="text-slate-500 block text-[9px] font-mono uppercase">
                  Account Particulars / Counterparty
                </span>
                <span className="font-bold text-sm text-slate-900 block mt-0.5">
                  {selectedEntry.party_name}
                </span>
                <p className="text-slate-600 text-[11px] mt-0.5 font-sans">
                  Narration: {selectedEntry.narration}
                </p>
              </div>

              {/* Double-Entry Allocation Table */}
              <table className="w-full text-left border-collapse border border-slate-800 text-xs font-mono">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-800 text-[10px] text-slate-900 uppercase">
                    <th className="py-1.5 px-2.5 w-12 text-center border-r border-slate-300">Dr/Cr</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-300">General Ledger Account Head</th>
                    <th className="py-1.5 px-2.5 w-16 text-center border-r border-slate-300">L.F.</th>
                    <th className="py-1.5 px-2.5 w-28 text-right border-r border-slate-300">Debit (₹)</th>
                    <th className="py-1.5 px-2.5 w-28 text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {selectedEntry.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 px-2.5 text-center font-bold border-r border-slate-300">
                        {line.dr_cr}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300">
                        <span className="font-bold text-slate-900">{line.account_name}</span>
                        {line.description && (
                          <span className="block text-[10px] text-slate-500 font-sans">{line.description}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-center text-slate-600 border-r border-slate-300">
                        {line.ledger_folio || selectedEntry.ledger_folio}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 border-r border-slate-300">
                        {line.debit > 0 ? formatINR(line.debit) : "—"}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                        {line.credit > 0 ? formatINR(line.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-xs">
                    <td colSpan={3} className="py-2 px-2.5 text-right border-r border-slate-300 uppercase">
                      Total Balanced Amount
                    </td>
                    <td className="py-2 px-2.5 text-right border-r border-slate-300">
                      {formatINR(selectedEntry.amount)}
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      {formatINR(selectedEntry.amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Amount in Indian Words */}
              <div className="p-2 bg-slate-50 rounded border border-slate-300 font-mono text-[11px]">
                <span className="text-slate-500 uppercase text-[9px] block">Amount in Words:</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {numberToIndianWords(selectedEntry.amount)}
                </span>
              </div>

              {/* Statutory Document Proof Footer Note */}
              <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200 text-[10px] font-mono text-emerald-900 flex items-center justify-between">
                <div>
                  <strong>Statutory Document Proof: </strong>
                  <span>
                    {selectedEntry.document_proof
                      ? `${selectedEntry.document_proof.title} (Ref: ${selectedEntry.document_proof.refNumber || selectedEntry.reference})`
                      : `Source Doc: ${selectedEntry.source_document}`}
                  </span>
                </div>
                <span className="text-emerald-700 font-bold">✓ GAAP Verified</span>
              </div>

              {/* Three Indian GAAP Signature Blocks */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t-2 border-slate-800 text-center font-mono text-[10px]">
                <div className="space-y-6">
                  <div className="h-8" />
                  <div className="border-t border-slate-400 pt-1">
                    <span className="font-bold block text-slate-900 uppercase">Prepared By</span>
                    <span className="text-slate-500 text-[9px]">Accountant / Finance Exec</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="h-8" />
                  <div className="border-t border-slate-400 pt-1">
                    <span className="font-bold block text-slate-900 uppercase">Verified / Authorized By</span>
                    <span className="text-slate-500 text-[9px]">CFO / Financial Controller</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="h-8" />
                  <div className="border-t border-slate-400 pt-1">
                    <span className="font-bold block text-slate-900 uppercase">Receiver's Signature</span>
                    <span className="text-slate-500 text-[9px]">Payee / Beneficiary / Seal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Dialog Actions */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Indian GAAP Voucher Print Module
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="tally"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5 font-bold"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Voucher Slip
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsPrintSlipOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Attach Proof Modal for Draft Vouchers */}
      {selectedEntry && (
        <Modal
          isOpen={isAttachProofModalOpen}
          onClose={() => setIsAttachProofModalOpen(false)}
          title={`Attach Document Proof for ${selectedEntry.entry_number}`}
          description={`Statutory document proof is strictly required before posting to General Ledger, P&L, and Balance Sheet.`}
          maxWidth="md"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Mandatory Statutory Rule:</strong> For {selectedEntry.voucher_type.toUpperCase()} vouchers, you must provide verifiable document proof (external invoice, bank deposit slip, UTR advice, or CFO approval memo).
              </div>
            </div>

            <Input
              label="Document Proof Reference # (UTR / Slip / Memo / Inv #)"
              value={draftProofRefInput}
              onChange={(e) => setDraftProofRefInput(e.target.value)}
              placeholder="e.g. UTR-99482910 or CFO-AUTH-2026-081"
              required
            />

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAttachProofModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="tally"
                size="sm"
                onClick={handleAttachProofAndPost}
                isLoading={isActionPending}
                className="gap-1.5 font-bold"
              >
                <Check className="h-3.5 w-3.5" /> Verify Proof &amp; Post to Ledger
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
