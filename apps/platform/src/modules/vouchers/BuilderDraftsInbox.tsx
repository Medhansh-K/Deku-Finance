"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Clock, ArrowRight, Trash2 } from "lucide-react";
import { businessDocumentsApi } from "@/api/endpoints";
import type { BusinessDocument } from "@/lib/builder/business-documents";
import { formatINR } from "@/lib/formatters/currency";

export interface BuilderDraftsInboxProps {
  orgId: string;
  onSelectDraft: (doc: BusinessDocument) => void;
  selectedDraftId?: string | null;
  onCountChange?: (openCount: number) => void;
}

/** Purchase orders saved in the Document Builder, ready to pre-fill a purchase voucher. */
export function BuilderDraftsInbox({ orgId, onSelectDraft, selectedDraftId, onCountChange }: BuilderDraftsInboxProps) {
  const [docs, setDocs] = useState<BusinessDocument[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "sent">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await businessDocumentsApi.list(orgId, { doc_type: "purchase_order" });
      const open = (res.data || []).filter((d) => d.status !== "cancelled");
      setDocs(open);
      onCountChange?.(open.filter((d) => d.status === "draft").length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load purchase orders");
    }
  }, [orgId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const draftCount = docs.filter((d) => d.status === "draft").length;
  const sentCount = docs.length - draftCount;
  const shown = docs.filter((d) => (filter === "all" ? true : filter === "draft" ? d.status === "draft" : d.status !== "draft"));

  const handleDelete = async (e: React.MouseEvent, doc: BusinessDocument) => {
    e.stopPropagation();
    if (!confirm(`Delete draft ${doc.doc_number}?`)) return;
    try {
      await businessDocumentsApi.remove(orgId, doc.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the draft");
    }
  };

  const tab = (value: typeof filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`flex-1 h-7 rounded-[7px] transition-colors ${
        filter === value ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-panel border border-line bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">Purchase orders</h3>
          <p className="text-[13px] text-ink-muted">From the Document Builder</p>
        </div>
        <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-canvas-sunken text-ink-soft shrink-0 tabular-nums">
          {draftCount} draft
        </span>
      </div>

      <p className="text-[12.5px] text-ink-muted leading-snug">
        When the supplier&apos;s bill arrives, pick its PO to pre-fill the purchase voucher, then attach the bill. Quotations and
        proformas convert to sales invoices from the builder&apos;s Documents list.
      </p>

      <div className="flex items-center gap-0.5 bg-canvas-sunken p-0.5 rounded-ctl text-[13px] font-medium">
        {tab("all", `All (${docs.length})`)}
        {tab("draft", `Drafts (${draftCount})`)}
        {tab("sent", `Sent (${sentCount})`)}
      </div>

      {error && <div className="px-3 py-2 rounded-ctl bg-bad-wash text-[13px] text-bad">{error}</div>}

      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
        {shown.length === 0 ? (
          <div className="px-4 py-6 text-center border border-dashed border-line-strong rounded-ctl space-y-2">
            <Clock className="h-5 w-5 text-ink-subtle mx-auto" />
            <p className="text-[13px] text-ink-muted">No purchase orders here yet</p>
          </div>
        ) : (
          shown.map((doc) => {
            const isSelected = selectedDraftId === doc.id;
            return (
              <div
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDraft(doc)}
                onKeyDown={(e) => e.key === "Enter" && onSelectDraft(doc)}
                className={`px-3 py-2.5 rounded-ctl border transition-colors cursor-pointer relative group text-left ${
                  isSelected
                    ? "bg-brand-wash border-brand-wash-strong shadow-[inset_3px_0_0_var(--color-brand)]"
                    : "bg-surface hover:bg-canvas border-line"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12.5px] font-medium text-ink">{doc.doc_number}</span>
                  <span
                    className={`inline-flex items-center h-5 px-1.5 rounded-chip text-xs font-medium capitalize ${
                      doc.status === "draft" ? "bg-warn-wash text-warn" : "bg-canvas-sunken text-ink-soft"
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
                <p className="text-[14px] font-[550] text-ink mt-1 truncate">
                  {doc.parties?.legal_name ?? doc.party_snapshot?.name ?? "–"}
                </p>
                <div className="text-[12.5px] mt-0.5 flex items-center justify-between text-ink-muted">
                  <span>{doc.doc_date}</span>
                  <span className="font-medium text-[13.5px] text-ink tabular-nums">{formatINR(Number(doc.total_amount))}</span>
                </div>
                <div className="mt-2 pt-1.5 border-t border-line flex items-center justify-end gap-1 text-[12.5px]">
                  {doc.status === "draft" && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, doc)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-chip text-ink-subtle hover:text-bad hover:bg-bad-wash transition-opacity"
                      title="Delete draft"
                      aria-label={`Delete ${doc.doc_number}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className={`font-medium flex items-center gap-1 ${isSelected ? "text-brand-strong" : "text-ink-soft group-hover:text-ink"}`}>
                    {isSelected ? "Active in desk" : "Pre-fill voucher"} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
