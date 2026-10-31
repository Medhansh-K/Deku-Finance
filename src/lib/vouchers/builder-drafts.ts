"use client";

export interface BuilderLineItem {
  id: string;
  description: string;
  hsn?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPct?: number;
  gstRate?: number;
}

export interface BuilderCalculations {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  couponDiscount?: number;
  roundOff?: number;
  roundedTotal: number;
  words?: string;
}

export interface BuilderLedgerDraft {
  id: string;
  source: "builder";
  documentType:
    | "invoice"
    | "quote"
    | "discount_coupon"
    | "proforma"
    | "delivery_challan"
    | "credit_note"
    | "debit_note"
    | "purchase_order";
  docNumber: string;
  docDate: string;
  dueDate: string;
  partyName: string;
  partyGSTIN: string;
  partyAddress: string;
  partyPhone?: string;
  partyEmail?: string;
  placeOfSupply: string;
  isInterstate: boolean;
  items: BuilderLineItem[];
  calculations: BuilderCalculations;
  notes?: string;
  settlementBank?: {
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
  };
  authorizedSignatory?: {
    name?: string;
    title?: string;
  };
  status: "draft" | "posted" | "reversed";
  createdAt: string;
  finalizedAt?: string;
  journalEntryId?: string;
}

const STORAGE_KEY = "deku_builder_ledger_drafts";

// Ids of the sample drafts older builds seeded into this browser; dropped on read.
const LEGACY_SAMPLE_IDS = new Set(["draft-bld-inv-089", "draft-bld-po-042"]);

// shortcut: builder drafts stay in this browser until the Document Builder (module 35) gets a table; move them then.
export function getBuilderDrafts(): BuilderLedgerDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((d: BuilderLedgerDraft) => !LEGACY_SAMPLE_IDS.has(d.id)) : [];
  } catch {
    return [];
  }
}

/**
 * Save or update a draft sent from the Document Builder.
 */
export function saveBuilderDraft(draft: BuilderLedgerDraft): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = getBuilderDrafts();
    const existingIndex = drafts.findIndex(
      (d) => d.id === draft.id || d.docNumber === draft.docNumber
    );

    let updated: BuilderLedgerDraft[];
    if (existingIndex >= 0) {
      updated = [...drafts];
      updated[existingIndex] = { ...drafts[existingIndex], ...draft, status: "draft" };
    } else {
      updated = [draft, ...drafts];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("deku_builder_drafts_updated"));
  } catch (err) {
    console.error("Failed to save builder draft:", err);
  }
}

/**
 * Mark a draft as finalized and posted to the ledger with the created journal entry ID.
 */
export function markDraftFinalized(draftIdOrDocNumber: string, journalEntryId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = getBuilderDrafts();
    const updated = drafts.map((d) => {
      if (d.id === draftIdOrDocNumber || d.docNumber === draftIdOrDocNumber) {
        return {
          ...d,
          status: "posted" as const,
          finalizedAt: new Date().toISOString(),
          journalEntryId: journalEntryId || d.journalEntryId,
        };
      }
      return d;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("deku_builder_drafts_updated"));
  } catch (err) {
    console.error("Failed to finalize builder draft:", err);
  }
}

/**
 * Delete a draft from the queue.
 */
export function deleteBuilderDraft(draftId: string): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = getBuilderDrafts();
    const filtered = drafts.filter((d) => d.id !== draftId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent("deku_builder_drafts_updated"));
  } catch (err) {
    console.error("Failed to delete builder draft:", err);
  }
}
