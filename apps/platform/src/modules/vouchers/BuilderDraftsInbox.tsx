"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Clock, ArrowRight, Trash2 } from "lucide-react";
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
      className={`flex-1 py-1 rounded transition-colors ${
        filter === value ? "bg-surface text-ink font-bold shadow-2xs" : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-surface border border-line-strong rounded-lg p-3 shadow-xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileSpreadsheet className="h-4 w-4 text-brand shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-ink leading-tight">Purchase orders</h3>
            <p className="text-[10px] text-ink-muted font-mono">From the Document Builder</p>
          </div>
        </div>
        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-canvas-sunken text-ink-soft border border-line shrink-0">
          {draftCount} draft
        </span>
      </div>

      <p className="text-[11px] text-ink-soft leading-tight">
        When the supplier&apos;s bill arrives, pick its PO to pre-fill the purchase voucher, then attach the bill. Quotations and
        proformas convert to sales invoices from the builder&apos;s Documents list.
      </p>

      <div className="flex items-center bg-canvas-sunken p-0.5 rounded border border-line text-[10px] font-semibold">
        {tab("all", `All (${docs.length})`)}
        {tab("draft", `Drafts (${draftCount})`)}
        {tab("sent", `Sent (${sentCount})`)}
      </div>

      {error && <div className="p-2 rounded border border-rose-200 bg-rose-50 text-[11px] text-rose-700">{error}</div>}

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
        {shown.length === 0 ? (
          <div className="p-4 text-center border border-dashed border-line rounded-lg space-y-2">
            <Clock className="h-6 w-6 text-ink-subtle mx-auto" />
            <p className="text-xs text-ink-muted">No purchase orders here yet</p>
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
                className={`p-2.5 rounded-lg border transition-all cursor-pointer relative group text-left ${
                  isSelected ? "bg-panel text-white border-brand shadow-sm ring-1 ring-brand" : "bg-canvas/80 hover:bg-canvas-sunken border-line text-ink"
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-mono font-bold text-xs ${isSelected ? "text-white" : "text-ink"}`}>{doc.doc_number}</span>
                  <span className="text-[9px] font-mono px-1 rounded border border-line font-semibold">{doc.status.toUpperCase()}</span>
                </div>
                <p className={`text-[11px] font-semibold mt-1 truncate ${isSelected ? "text-white" : "text-ink"}`}>
                  {doc.parties?.legal_name ?? doc.party_snapshot?.name ?? "–"}
                </p>
                <div className={`text-[10px] mt-0.5 flex items-center justify-between ${isSelected ? "text-ink-subtle" : "text-ink-muted"}`}>
                  <span>Date: {doc.doc_date}</span>
                  <span className={`font-mono font-bold text-xs ${isSelected ? "text-brand" : "text-ink"}`}>
                    {formatINR(Number(doc.total_amount))}
                  </span>
                </div>
                <div className="mt-2 pt-1.5 border-t border-line/60 flex items-center justify-end gap-1 text-[10px]">
                  {doc.status === "draft" && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, doc)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-ink-subtle hover:text-rose-700 transition-opacity"
                      title="Delete draft"
                      aria-label={`Delete ${doc.doc_number}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <span className={`font-bold flex items-center gap-0.5 ${isSelected ? "text-brand" : "text-ink-soft group-hover:underline"}`}>
                    {isSelected ? "Active in desk" : "Pre-fill voucher"} <ArrowRight className="h-2.5 w-2.5" />
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
