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

export const SAMPLE_BUILDER_DRAFTS: BuilderLedgerDraft[] = [
  {
    id: "draft-bld-inv-089",
    source: "builder",
    documentType: "invoice",
    docNumber: "INV-2026-089",
    docDate: "2026-10-21",
    dueDate: "2026-11-20",
    partyName: "Endeavor Energy & Tech Solutions",
    partyGSTIN: "27AABCE4567F1Z8",
    partyAddress: "Plot 42, MIDC Cyber Gateway, Andheri East, Mumbai, Maharashtra 400069",
    partyPhone: "+91 98200 12345",
    partyEmail: "procurement@endeavorenergy.com",
    placeOfSupply: "27-Maharashtra",
    isInterstate: false,
    items: [
      {
        id: "line-1",
        description: "Deku Financial OS — Annual Cloud Enterprise License",
        hsn: "998313",
        qty: 1,
        unit: "Year",
        rate: 150000,
        discountPct: 10,
        gstRate: 18,
      },
      {
        id: "line-2",
        description: "ALERX Multi-Tenant Ledger Architecture Consulting & Integration",
        hsn: "998314",
        qty: 40,
        unit: "Hours",
        rate: 3500,
        discountPct: 0,
        gstRate: 18,
      },
    ],
    calculations: {
      subtotal: 290000,
      totalDiscount: 15000,
      taxableAmount: 275000,
      totalCgst: 24750,
      totalSgst: 24750,
      totalIgst: 0,
      totalTax: 49500,
      roundedTotal: 324500,
      words: "Rupees Three Lakh Twenty-Four Thousand Five Hundred Only",
    },
    notes: "1. Payment due strictly within 30 days of invoice date.\n2. In case of delayed payment, interest @ 18% p.a. will be levied.",
    status: "draft",
    createdAt: "2026-10-21T10:15:00.000Z",
  },
  {
    id: "draft-bld-po-042",
    source: "builder",
    documentType: "purchase_order",
    docNumber: "PO-2026-042",
    docDate: "2026-10-20",
    dueDate: "2026-11-05",
    partyName: "All Might Express Logistics Ltd",
    partyGSTIN: "27AABCA9988D1Z2",
    partyAddress: "Cargo Terminal 3, Vashi Warehousing Complex, Navi Mumbai 400703",
    partyPhone: "+91 98111 22334",
    partyEmail: "dispatch@allmightlogistics.in",
    placeOfSupply: "27-Maharashtra",
    isInterstate: false,
    items: [
      {
        id: "po-line-1",
        description: "Dedicated Dedicated Cold-Storage Transport Haulage",
        hsn: "996511",
        qty: 4,
        unit: "Trips",
        rate: 25000,
        discountPct: 0,
        gstRate: 18,
      },
    ],
    calculations: {
      subtotal: 100000,
      totalDiscount: 0,
      taxableAmount: 100000,
      totalCgst: 9000,
      totalSgst: 9000,
      totalIgst: 0,
      totalTax: 18000,
      roundedTotal: 118000,
      words: "Rupees One Lakh Eighteen Thousand Only",
    },
    notes: "Please deliver goods with verified transit pass under Rule 55.",
    status: "draft",
    createdAt: "2026-10-20T14:30:00.000Z",
  },
];

/**
 * Get all builder drafts from localStorage, seeding default samples if empty.
 */
export function getBuilderDrafts(): BuilderLedgerDraft[] {
  if (typeof window === "undefined") return SAMPLE_BUILDER_DRAFTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_BUILDER_DRAFTS));
      return SAMPLE_BUILDER_DRAFTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return SAMPLE_BUILDER_DRAFTS;
  } catch {
    return SAMPLE_BUILDER_DRAFTS;
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
    localStorage.setItem("deku_pending_builder_voucher", JSON.stringify(draft));
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
