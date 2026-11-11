"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  RefreshCw,
  Search,
  Filter,
  RotateCcw,
  AlertCircle,
  Info,
  Paperclip,
  Printer,
  X,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  accountingApi,
  filesApi,
  invoicesApi,
  MAX_DOCUMENT_BYTES,
  organisationsApi,
  partiesApi,
  OrgSummary,
} from "@/api/endpoints";
import { Account, JournalEntry, SalesInvoice } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { loadOrgTaxProfile, OrgTaxProfile } from "@/lib/org-regime";
import { journalToVoucher, VoucherItem } from "@/lib/reports/vouchers";
import { numberToIndianWords } from "@/lib/builder/number-to-words";
import { setActiveOrg } from "@/lib/organisation/active-org";
import type { OrgMember } from "@/modules/departments-members/team";
import { EditDraftModal } from "./EditDraftModal";
import { VoucherDrawer, formatDay, money, particulars, statusChip } from "./VoucherDrawer";

const PAGE_SIZE = 20;

type SortCol = { header: string; key?: (j: VoucherItem) => string | number; right?: boolean; width?: string };
const COLUMNS: SortCol[] = [
  { header: "Date", key: (j) => j.entry_date, width: "96px" },
  { header: "Voucher", key: (j) => j.entry_number, width: "160px" },
  { header: "Particulars", key: (j) => particulars(j)[0] },
  { header: "L.F.", key: (j) => j.ledger_folio, width: "72px" },
  { header: "Status", key: (j) => j.status, width: "150px" },
  { header: "Amount", key: (j) => j.amount, right: true, width: "130px" },
];

const STATUSES = [
  ["all", "All"],
  ["posted", "Posted"],
  ["draft", "Draft"],
  ["reversed", "Reversed"],
] as const;

const PILL =
  "h-9 rounded-ctl border border-line bg-surface text-[13.5px] text-ink-soft hover:border-line-strong focus-within:border-brand focus-within:ring-1 focus-within:ring-brand";

export function DayBookView() {
  const [journals, setJournals] = useState<VoucherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Raw entries keep the approval columns the Day Book row doesn't carry.
  const [rawById, setRawById] = useState<Map<string, JournalEntry>>(new Map());
  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [invoiceByJournal, setInvoiceByJournal] = useState<Map<string, SalesInvoice>>(new Map());
  const [partyNames, setPartyNames] = useState<Map<string, string>>(new Map());

  // Active Organisation State (initialized with deterministic server default)
  const [orgId, setOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [taxProfile, setTaxProfile] = useState<OrgTaxProfile | null>(null);
  const [orgList, setOrgList] = useState<OrgSummary[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  // Reports link here with ?account_code= to show one ledger's vouchers; ?voucher=<id> opens one.
  const [accountCode, setAccountCode] = useState<string | null>(null);
  const [linkedVoucherId, setLinkedVoucherId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAccountCode(params.get("account_code"));
    setLinkedVoucherId(params.get("voucher"));
  }, []);

  // Register table
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Voucher side drawer
  const [selectedEntry, setSelectedEntry] = useState<VoucherItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Reversal Modal State
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState<string>("2026-10-23");
  const [reversalReason, setReversalReason] = useState<string>("");

  // Printable Voucher Slip Modal State
  const [isPrintSlipOpen, setIsPrintSlipOpen] = useState(false);

  // Definition line toggle
  const [showDefinition, setShowDefinition] = useState(true);

  // Load active organisation from storage & list after mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("deku_active_org_id") || "";
      const savedName = localStorage.getItem("deku_active_org_name") || "";
      setOrgId(savedId);
      setOrgName(savedName);
      loadOrgTaxProfile(savedId).then(setTaxProfile);
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
    loadOrgTaxProfile(newId).then(setTaxProfile);
    if (found) setActiveOrg(found);
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
      const [res, accounts, parties, files, team, invoices] = await Promise.all([
        accountingApi.listJournals(orgId),
        accountingApi.listAccounts(orgId),
        partiesApi.list(orgId),
        // The day book is still useful if its attachments, team or invoices can't be listed.
        filesApi.list(orgId).catch(() => ({ data: [] })),
        organisationsApi.listMembers(orgId).catch(() => null),
        invoicesApi.list(orgId).catch(() => ({ data: [] as SalesInvoice[] })),
      ]);
      const fileByJournal = new Map((files.data ?? []).filter((f) => f.journal_entry_id).map((f) => [f.journal_entry_id, f]));
      setAccounts(accounts.data ?? []);
      setMembers(team?.data ?? null);
      setInvoiceByJournal(new Map((invoices.data ?? []).filter((i) => i.journal_entry_id).map((i) => [i.journal_entry_id!, i])));
      setRawById(new Map((res.data ?? []).map((j) => [j.id, j])));
      const accountMap = new Map((accounts.data ?? []).map((a) => [a.id, a]));
      const partyMap = new Map((parties.data ?? []).map((p) => [p.id, p]));
      setPartyNames(new Map((parties.data ?? []).map((p) => [p.id, p.display_name || p.legal_name])));
      const apiVouchers = (res.data ?? []).map((j) => {
        const voucher = journalToVoucher(j, accountMap, partyMap, taxProfile?.regime);
        const file = fileByJournal.get(j.id);
        return file
          ? {
              ...voucher,
              document_proof: {
                id: file.id,
                fileId: file.id,
                proofType: "receipt_vendor_invoice" as const,
                categoryLabel: file.category ?? "Attached document",
                title: file.filename,
                fileName: file.filename,
                fileSize: `${(file.byte_size / 1024).toFixed(1)} KB`,
                refNumber: file.reference ?? undefined,
                uploadedAt: file.created_at,
                verified: false,
              },
            }
          : voucher;
      });
      setJournals(apiVouchers);
      // Keep an open drawer showing the refreshed voucher.
      setSelectedEntry((prev) => (prev ? apiVouchers.find((v) => v.id === prev.id) ?? prev : prev));
    } catch (err: any) {
      setError(err?.message || "Could not load the day book");
      setJournals([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchJournals();
  }, [orgId, taxProfile?.regime]);

  // ?voucher=<id> opens that voucher's drawer once it has loaded.
  useEffect(() => {
    const found = linkedVoucherId && journals.find((j) => j.id === linkedVoucherId);
    if (!found) return;
    setSelectedEntry(found);
    setIsDetailOpen(true);
    setLinkedVoucherId(null);
  }, [linkedVoucherId, journals]);

  // Esc closes the drawer first. Capture phase runs before AppShell's Esc→Gateway, so stopping it
  // here keeps the page; open modals handle their own Esc.
  useEffect(() => {
    if (!isDetailOpen || isPrintSlipOpen || isReversalModalOpen || isEditOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setIsDetailOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isDetailOpen, isPrintSlipOpen, isReversalModalOpen, isEditOpen]);

  const toggleEntry = (entry: VoucherItem) => {
    if (isDetailOpen && selectedEntry?.id === entry.id) {
      setIsDetailOpen(false);
      return;
    }
    setSelectedEntry(entry);
    setIsDetailOpen(true);
  };

  // Handle Post Draft Journal to ledger
  // Posting and reversal run on the server, which enforces balance, period, approval and immutability rules.
  const handlePostDraft = async (vch: VoucherItem) => {
    if (!confirm(`Post draft ${vch.entry_number} to the ledger?`)) return;
    setIsActionPending(true);
    try {
      await accountingApi.postJournal(orgId, vch.id);
      setIsDetailOpen(false);
      window.dispatchEvent(new CustomEvent("deku_ledger_updated", { detail: { voucherNumber: vch.entry_number } }));
    } catch (err: any) {
      // With approvals on, a draft goes to a checker instead; there's no other way to send one.
      if (/approval required/i.test(err?.message ?? "")) {
        if (confirm(`This company requires approval. Submit ${vch.entry_number} for approval?`)) {
          try {
            await accountingApi.submitJournal(orgId, vch.id);
            setIsDetailOpen(false);
            window.dispatchEvent(new CustomEvent("deku_ledger_updated", { detail: { voucherNumber: vch.entry_number } }));
          } catch (submitErr: any) {
            alert(`Couldn't submit: ${submitErr?.message || "Unknown error"}`);
          }
        }
      } else {
        alert(`Posting failed: ${err?.message || "Unknown error"}`);
      }
    } finally {
      setIsActionPending(false);
    }
  };

  const handleAttachDocument = async (vch: VoucherItem, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      alert("That file is over the 10 MB limit.");
      return;
    }
    setIsActionPending(true);
    try {
      await filesApi.upload(orgId, file, { journal_entry_id: vch.id });
      setIsDetailOpen(false);
      await fetchJournals();
    } catch (err: any) {
      alert(`Couldn't attach the document: ${err?.message || "Unknown error"}`);
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
      await accountingApi.reverseJournal(orgId, selectedEntry.id, {
        reversal_date: reversalDate,
        narration: reversalReason,
      });
      setIsReversalModalOpen(false);
      setIsDetailOpen(false);
      window.dispatchEvent(
        new CustomEvent("deku_ledger_updated", { detail: { voucherNumber: selectedEntry.entry_number, reversed: true } })
      );
    } catch (err: any) {
      alert(`Reversal failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // Every filter except status, so the status tabs can show counts.
  const baseFiltered = journals.filter((entry) => {
    if (accountCode && !entry.lines.some((l) => l.ledger_folio === accountCode)) return false;
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
  const counts = {
    all: baseFiltered.length,
    posted: baseFiltered.filter((e) => e.status === "posted").length,
    draft: baseFiltered.filter((e) => e.status === "draft").length,
    reversed: baseFiltered.filter((e) => e.status === "reversed").length,
  };
  const filteredJournals = statusFilter === "all" ? baseFiltered : baseFiltered.filter((e) => e.status === statusFilter);
  const postedTotal = filteredJournals.filter((e) => e.status === "posted").reduce((s, e) => s + e.amount, 0);

  const sorted = useMemo(() => {
    const key = sort && COLUMNS[sort.col].key;
    if (!sort || !key) return filteredJournals;
    return [...filteredJournals].sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      const c = x === y ? 0 : x < y ? -1 : 1;
      return sort.dir === "asc" ? c : -c;
    });
  }, [filteredJournals, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // asc → desc → original order, as the shared data table does.
  const handleSort = (col: number) => {
    setSort((s) => (s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null));
    setPage(0);
  };

  const handleTableKey = (e: React.KeyboardEvent) => {
    if (pageRows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((p) => (p === null || p >= pageRows.length - 1 ? 0 : p + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((p) => (p === null || p <= 0 ? pageRows.length - 1 : p - 1));
    } else if (e.key === "Enter" && focusedIndex !== null && pageRows[focusedIndex]) {
      e.preventDefault();
      toggleEntry(pageRows[focusedIndex]);
    }
  };

  const drawerOpen = isDetailOpen && !!selectedEntry;

  return (
    <div className="space-y-4 font-sans text-[13.5px] text-ink">
      {/* Context line: what a day book is, the company's tax regime, company switcher */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {showDefinition && (
          <p className="flex min-w-0 flex-1 items-start gap-2 text-[13px] text-ink-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
            <span>
              The day book records every transaction in date order from its source document (invoice, receipt or
              voucher) before totals are posted to the ledger.
            </span>
            <button
              type="button"
              onClick={() => setShowDefinition(false)}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-chip text-ink-subtle hover:bg-canvas-sunken hover:text-ink cursor-pointer"
              title="Dismiss definition"
              aria-label="Dismiss definition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        )}
        <div className="ml-auto flex items-center gap-2" suppressHydrationWarning>
          {!taxProfile ? null : taxProfile.regime === "sec22" ? (
            <span suppressHydrationWarning className="inline-flex h-[22px] items-center rounded-chip bg-canvas-sunken px-2 text-xs font-medium text-ink-soft">
              Section 22 exempt
            </span>
          ) : (
            <span suppressHydrationWarning className="inline-flex h-[22px] items-center gap-1.5 rounded-chip bg-canvas-sunken px-2 text-xs font-medium text-ink-soft">
              GST registered <span className="font-mono">{taxProfile.gstin}</span>
            </span>
          )}
          {orgList.length > 0 && (
            <select
              value={orgId}
              onChange={(e) => handleSwitchOrg(e.target.value)}
              aria-label="Company"
              className={`${PILL} px-3 font-medium text-ink cursor-pointer focus:outline-none`}
            >
              {orgList.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="secondary" size="sm" onClick={fetchJournals} isLoading={isLoading} className="h-9">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div data-tour="day-book-filters" className="flex flex-wrap items-center gap-2.5">
        <div role="tablist" aria-label="Status" className="flex gap-0.5 rounded-[10px] bg-canvas-sunken p-[3px]">
          {STATUSES.map(([st, label]) => {
            const on = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(0);
                }}
                className={`rounded-[7px] px-3 py-1.5 text-[13.5px] cursor-pointer transition-colors ${
                  on ? "bg-surface font-[550] text-ink shadow-[0_1px_2px_rgb(14_27_25/0.08)]" : "text-ink-soft hover:text-ink"
                }`}
              >
                {label}
                <span className={`ml-1.5 tabular-nums ${on ? "text-brand-strong" : "text-ink-subtle"}`}>{counts[st]}</span>
              </button>
            );
          })}
        </div>

        <label className={`${PILL} relative flex items-center gap-2 pl-3 pr-2`}>
          <Filter className="h-4 w-4 text-ink-muted" />
          <span className="sr-only">Voucher type</span>
          <select
            value={voucherTypeFilter}
            onChange={(e) => {
              setVoucherTypeFilter(e.target.value);
              setPage(0);
            }}
            className="h-full bg-transparent pr-1 text-ink focus:outline-none cursor-pointer"
          >
            <option value="all">All voucher types</option>
            <option value="sales">Sales invoice / bill of supply (F8)</option>
            <option value="payment">Payment voucher (F5)</option>
            <option value="receipt">Customer receipt (F6)</option>
            <option value="purchase">Purchase bill (F9)</option>
            <option value="contra">Contra, bank and cash (F4)</option>
            <option value="journal">Journal voucher (F7)</option>
          </select>
        </label>

        <div data-tour="day-book-date" className={`${PILL} flex items-center gap-2 pl-3 pr-2`}>
          <Calendar className="h-4 w-4 text-ink-muted" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Filter by date"
            className="h-full bg-transparent text-ink focus:outline-none"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="rounded-chip px-1.5 text-[13px] font-medium text-brand-strong hover:bg-brand-wash cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div data-tour="day-book-search" className={`${PILL} flex min-w-[220px] flex-1 items-center gap-2 px-3`}>
          <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search party, L.F. or voucher number"
            aria-label="Search the day book"
            className="h-full w-full bg-transparent text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-ctl bg-bad-wash px-3.5 py-2.5 text-[13px] text-bad">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button onClick={fetchJournals} className="ml-2 font-medium underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      <div className={`grid items-start gap-[18px] ${drawerOpen ? "lg:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
        {/* Day Book register */}
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <div className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-brand" tabIndex={0} onKeyDown={handleTableKey} aria-label="Day Book register">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px] tabular-nums">
              <thead>
                <tr className="bg-[#fafbfa] dark:bg-canvas-sunken">
                  {COLUMNS.map((col, idx) => {
                    const dir = sort?.col === idx ? sort.dir : null;
                    return (
                      <th
                        key={col.header}
                        style={{ width: col.width }}
                        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                        className={`border-b border-line px-3.5 py-[11px] text-[12.5px] font-medium text-ink-muted ${col.right ? "text-right" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(idx)}
                          className={`inline-flex items-center gap-1 hover:text-ink cursor-pointer ${dir ? "text-ink" : ""}`}
                        >
                          {col.header}
                          {dir === "asc" && <ArrowUp className="h-3 w-3 text-brand-strong" />}
                          {dir === "desc" && <ArrowDown className="h-3 w-3 text-brand-strong" />}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading && journals.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-12 text-center text-ink-muted">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-brand" /> Loading the day book
                      </span>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-10 text-center text-ink-muted">
                      No vouchers match these filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((j, index) => {
                    const selected = drawerOpen && selectedEntry?.id === j.id;
                    const [title, sub] = particulars(j);
                    return (
                      <tr
                        key={j.id}
                        onClick={() => {
                          setFocusedIndex(index);
                          toggleEntry(j);
                        }}
                        aria-selected={selected}
                        className={`cursor-pointer border-b border-line last:border-b-0 ${
                          selected ? "bg-brand-wash" : "hover:bg-canvas"
                        } ${focusedIndex === index ? "outline outline-1 -outline-offset-1 outline-brand/40" : ""}`}
                      >
                        <td className={`px-3.5 py-2.5 whitespace-nowrap ${selected ? "shadow-[inset_3px_0_0_var(--color-brand)]" : ""}`}>
                          {formatDay(j.entry_date)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">{j.entry_number}</td>
                        <td className="max-w-0 px-3.5 py-2.5">
                          <span className="block truncate font-[550]">{title}</span>
                          {sub && sub !== title && <span className="block truncate text-[12.5px] text-ink-muted">{sub}</span>}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-ink-muted">{j.ledger_folio}</td>
                        <td className="px-3.5 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            {statusChip(j)}
                            {j.document_proof && (
                              <span title="Document attached" aria-label="Document attached">
                                <Paperclip className="h-3.5 w-3.5 text-ink-muted" />
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">{money(j.amount)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-3.5 py-3 text-[13px] text-ink-muted">
            <span>
              {filteredJournals.length} {filteredJournals.length === 1 ? "voucher" : "vouchers"}
              {statusFilter === "all" && filteredJournals.length > 0 && (
                <>
                  {" · "}
                  {[
                    `${counts.posted} posted`,
                    `${counts.draft} draft`,
                    counts.reversed ? `${counts.reversed} reversed` : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </>
              )}
            </span>
            {totalPages > 1 && (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="rounded-chip px-2 py-0.5 hover:bg-canvas-sunken hover:text-ink disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="tabular-nums">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="rounded-chip px-2 py-0.5 hover:bg-canvas-sunken hover:text-ink disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </span>
            )}
            <span className="ml-auto">
              Total of posted vouchers{" "}
              <b className="ledger-total ml-1.5 font-semibold text-ink tabular-nums">{money(postedTotal)}</b>
            </span>
          </div>
        </div>

        {drawerOpen && selectedEntry && (
          <VoucherDrawer
            entry={selectedEntry}
            journal={rawById.get(selectedEntry.id)}
            invoice={invoiceByJournal.get(selectedEntry.id)}
            members={members}
            partyNames={partyNames}
            orgId={orgId}
            isActionPending={isActionPending}
            onClose={() => setIsDetailOpen(false)}
            onPrint={() => setIsPrintSlipOpen(true)}
            onReverse={() => handleOpenReverseModal(selectedEntry)}
            onEdit={() => {
              setIsDetailOpen(false);
              setIsEditOpen(true);
            }}
            onPost={() => handlePostDraft(selectedEntry)}
            onAttach={(file) => handleAttachDocument(selectedEntry, file)}
          />
        )}
      </div>

      {selectedEntry && isEditOpen && (
        <EditDraftModal
          orgId={orgId}
          voucher={selectedEntry}
          accounts={accounts}
          onClose={() => setIsEditOpen(false)}
          onSaved={() => {
            setIsEditOpen(false);
            fetchJournals();
          }}
        />
      )}

      {/* Reversal Confirmation Modal */}
      {selectedEntry && (
        <Modal
          isOpen={isReversalModalOpen}
          onClose={() => setIsReversalModalOpen(false)}
          title={`Reverse voucher ${selectedEntry.entry_number}`}
          description={`Contra reversal for ${particulars(selectedEntry)[0]} (${money(selectedEntry.amount)})`}
          maxWidth="md"
        >
          <div className="space-y-4 text-[13.5px]">
            <p className="flex items-start gap-2.5 rounded-ctl bg-bad-wash px-3 py-2.5 text-[13px] text-bad">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Reversing does not delete this voucher. A reversal entry is posted that swaps every debit and credit,
                and the chart of accounts, day book and statements update.
              </span>
            </p>

            <Input
              label="Reversal date"
              type="date"
              value={reversalDate}
              onChange={(e) => setReversalDate(e.target.value)}
              required
            />

            <div>
              <label htmlFor="day-book-reversal-reason" className="mb-1 block text-[13px] text-ink-muted">
                Reason for reversal (kept for audit)
              </label>
              <textarea
                id="day-book-reversal-reason"
                rows={2}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Wrong account head, invoice cancelled, duplicate transaction"
                className="w-full rounded-ctl border border-line-strong bg-surface p-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button variant="secondary" size="sm" onClick={() => setIsReversalModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmReversal} isLoading={isActionPending}>
                <RotateCcw className="h-3.5 w-3.5" /> Confirm and post reversal
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Voucher Slip Modal */}
      {selectedEntry && (
        <Modal
          isOpen={isPrintSlipOpen}
          onClose={() => setIsPrintSlipOpen(false)}
          title={`Print voucher ${selectedEntry.entry_number}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-[13px]">
            <div
              id="printable-voucher-slip"
              className="space-y-4 rounded-ctl border border-ink bg-surface p-6 text-ink print:border-none print:p-0"
            >
              <div className="flex items-start justify-between border-b border-ink pb-3">
                <div>
                  <h1 className="text-base font-semibold tracking-tight">{orgName}</h1>
                  <p className="text-[12.5px] text-ink-muted">Day Book voucher</p>
                  <p className="text-[12.5px] text-ink-muted">
                    {!taxProfile ? null : taxProfile.regime === "sec22" ? (
                      "No GSTIN on the company record"
                    ) : (
                      <>
                        GSTIN <span className="font-mono text-ink">{taxProfile.gstin}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-chip bg-ink px-2.5 py-1 text-xs font-medium text-surface">
                    {selectedEntry.source_document} ({selectedEntry.f_key})
                  </span>
                  <p className="mt-1 text-[12.5px] capitalize text-ink-muted">{selectedEntry.status}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-ctl border border-line-strong p-3 sm:grid-cols-4">
                {[
                  ["Voucher no.", <span className="font-mono">{selectedEntry.entry_number}</span>],
                  ["Date", formatDateTally(selectedEntry.entry_date)],
                  ["Ledger folio", <span className="font-mono">{selectedEntry.ledger_folio}</span>],
                  ["Reference", selectedEntry.reference],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <span className="block text-xs text-ink-muted">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-ctl border border-line-strong p-3">
                <span className="block text-xs text-ink-muted">Particulars</span>
                <span className="mt-0.5 block text-sm font-semibold">{selectedEntry.party_name}</span>
                <p className="mt-0.5 text-ink-soft">Narration: {selectedEntry.narration}</p>
              </div>

              <table className="w-full border-collapse border border-ink text-left text-[13px] tabular-nums">
                <thead>
                  <tr className="border-b border-ink bg-canvas-sunken text-xs">
                    <th className="w-12 border-r border-line-strong px-2.5 py-1.5 text-center font-medium">Dr/Cr</th>
                    <th className="border-r border-line-strong px-2.5 py-1.5 font-medium">Account</th>
                    <th className="w-16 border-r border-line-strong px-2.5 py-1.5 text-center font-medium">L.F.</th>
                    <th className="w-28 border-r border-line-strong px-2.5 py-1.5 text-right font-medium">Debit</th>
                    <th className="w-28 px-2.5 py-1.5 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-strong">
                  {selectedEntry.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="border-r border-line-strong px-2.5 py-1.5 text-center font-medium">{line.dr_cr}</td>
                      <td className="border-r border-line-strong px-2.5 py-1.5">
                        <span className="font-medium">{line.account_name}</span>
                        {line.description && <span className="block text-xs text-ink-muted">{line.description}</span>}
                      </td>
                      <td className="border-r border-line-strong px-2.5 py-1.5 text-center font-mono text-ink-soft">
                        {line.ledger_folio || selectedEntry.ledger_folio}
                      </td>
                      <td className="border-r border-line-strong px-2.5 py-1.5 text-right">
                        {line.debit > 0 ? formatINR(line.debit) : "–"}
                      </td>
                      <td className="px-2.5 py-1.5 text-right">{line.credit > 0 ? formatINR(line.credit) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink font-semibold">
                    <td colSpan={3} className="border-r border-line-strong px-2.5 py-2 text-right">
                      Total
                    </td>
                    <td className="border-r border-line-strong px-2.5 py-2 text-right">{formatINR(selectedEntry.amount)}</td>
                    <td className="px-2.5 py-2 text-right">{formatINR(selectedEntry.amount)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="rounded-ctl border border-line-strong p-2.5">
                <span className="block text-xs text-ink-muted">Amount in words</span>
                <span className="mt-0.5 block font-medium">{numberToIndianWords(selectedEntry.amount)}</span>
              </div>

              <p className="text-[12.5px] text-ink-soft">
                <span className="font-medium">Supporting document: </span>
                {selectedEntry.document_proof
                  ? `${selectedEntry.document_proof.title} (Ref: ${selectedEntry.document_proof.refNumber || selectedEntry.reference})`
                  : `Source document: ${selectedEntry.source_document}`}
              </p>

              <div className="grid grid-cols-3 gap-4 border-t border-ink pt-10 text-center text-[12.5px]">
                {[
                  ["Prepared by", "Accountant / finance executive"],
                  ["Verified and authorised by", "CFO / financial controller"],
                  ["Receiver's signature", "Payee / beneficiary / seal"],
                ].map(([role, who]) => (
                  <div key={role} className="border-t border-line-strong pt-1">
                    <span className="block font-medium">{role}</span>
                    <span className="text-ink-muted">{who}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="tally" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Print voucher
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsPrintSlipOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
