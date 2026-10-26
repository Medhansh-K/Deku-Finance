"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  Trash2,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Plus,
} from "lucide-react";
import {
  BuilderLedgerDraft,
  getBuilderDrafts,
  deleteBuilderDraft,
  SAMPLE_BUILDER_DRAFTS,
} from "@/lib/vouchers/builder-drafts";
import { formatINR } from "@/lib/formatters/currency";

export interface BuilderDraftsInboxProps {
  onSelectDraft: (draft: BuilderLedgerDraft) => void;
  selectedDraftId?: string | null;
}

export function BuilderDraftsInbox({
  onSelectDraft,
  selectedDraftId,
}: BuilderDraftsInboxProps) {
  const [drafts, setDrafts] = useState<BuilderLedgerDraft[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "posted">("all");

  const loadDrafts = () => {
    setDrafts(getBuilderDrafts());
  };

  useEffect(() => {
    loadDrafts();

    const handleUpdate = () => loadDrafts();
    window.addEventListener("deku_builder_drafts_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_builder_drafts_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const pendingCount = drafts.filter((d) => d.status === "draft").length;
  const postedCount = drafts.filter((d) => d.status === "posted").length;

  const filteredDrafts = drafts.filter((d) => {
    if (filter === "draft") return d.status === "draft";
    if (filter === "posted") return d.status === "posted";
    return true;
  });

  const handleDelete = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    deleteBuilderDraft(draftId);
    loadDrafts();
  };

  const handleResetSample = () => {
    localStorage.setItem(
      "deku_builder_ledger_drafts",
      JSON.stringify(SAMPLE_BUILDER_DRAFTS)
    );
    loadDrafts();
  };

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileSpreadsheet className="h-4 w-4 text-[#5BB5BB] shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-tight">
              Builder Ledger Requests
            </h3>
            <p className="text-[10px] text-slate-500 font-mono">
              Drafts Sent from Invoicing Suite
            </p>
          </div>
        </div>

        {pendingCount > 0 ? (
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 animate-pulse shrink-0">
            {pendingCount} Pending
          </span>
        ) : (
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
            0 Pending
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-600 leading-tight">
        Incoming draft transactions created in <strong>Document Builder</strong>. Click any draft to auto-populate the ledger allocation desk.
      </p>

      {/* Filter Tabs */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-[10px] font-semibold">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`flex-1 py-1 rounded transition-colors ${
            filter === "all"
              ? "bg-white text-slate-900 font-bold shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All ({drafts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("draft")}
          className={`flex-1 py-1 rounded transition-colors ${
            filter === "draft"
              ? "bg-white text-amber-900 font-bold shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Drafts ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("posted")}
          className={`flex-1 py-1 rounded transition-colors ${
            filter === "posted"
              ? "bg-white text-emerald-900 font-bold shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Posted ({postedCount})
        </button>
      </div>

      {/* List of Drafts */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
        {filteredDrafts.length === 0 ? (
          <div className="p-4 text-center border border-dashed border-slate-200 rounded-lg space-y-2">
            <Clock className="h-6 w-6 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">No {filter !== "all" ? filter : ""} requests found</p>
            <button
              type="button"
              onClick={handleResetSample}
              className="text-[10px] text-[#5BB5BB] hover:underline font-bold"
            >
              Reload Sample Builder Requests
            </button>
          </div>
        ) : (
          filteredDrafts.map((draft) => {
            const isSelected = selectedDraftId === draft.id || selectedDraftId === draft.docNumber;
            const isPosted = draft.status === "posted";

            let typeBadgeClass = "bg-blue-50 text-blue-800 border-blue-200";
            if (draft.documentType === "invoice") typeBadgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
            else if (draft.documentType === "purchase_order") typeBadgeClass = "bg-cyan-50 text-cyan-800 border-cyan-200";
            else if (draft.documentType.includes("note")) typeBadgeClass = "bg-purple-50 text-purple-800 border-purple-200";

            return (
              <div
                key={draft.id}
                onClick={() => onSelectDraft(draft)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer relative group text-left ${
                  isSelected
                    ? "bg-[#1F2324] text-white border-[#5BB5BB] shadow-sm ring-1 ring-[#5BB5BB]"
                    : "bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-mono font-bold text-xs ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {draft.docNumber}
                      </span>
                      <span className={`text-[9px] font-mono px-1 py-0.2 rounded border font-semibold ${typeBadgeClass}`}>
                        {draft.documentType.replace("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <p className={`text-[11px] font-semibold mt-1 truncate ${isSelected ? "text-slate-200" : "text-slate-800"}`}>
                      {draft.partyName}
                    </p>

                    <div className={`text-[10px] mt-0.5 flex items-center justify-between ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                      <span>Date: {draft.docDate}</span>
                      <span className={`font-mono font-bold text-xs ${isSelected ? "text-[#5BB5BB]" : "text-slate-900"}`}>
                        {formatINR(draft.calculations.roundedTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Bar & Action */}
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  {isPosted ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-bold">
                      <CheckCircle2 className="h-3 w-3" /> Posted to Ledger
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700 font-semibold">
                      <Clock className="h-3 w-3" /> Draft • Pending Confirm
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, draft.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
                      title="Delete draft request"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <span
                      className={`font-bold flex items-center gap-0.5 ${
                        isSelected ? "text-[#5BB5BB]" : "text-blue-600 group-hover:underline"
                      }`}
                    >
                      {isSelected ? "Active in Desk" : "Populate Desk"} <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer helper */}
      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
        <span>Source: Document Builder</span>
        <button
          type="button"
          onClick={handleResetSample}
          className="hover:text-slate-900 hover:underline flex items-center gap-1"
        >
          <RotateCcw className="h-2.5 w-2.5" /> Reset Samples
        </button>
      </div>
    </div>
  );
}
