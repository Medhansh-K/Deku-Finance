/**
 * Document Builder <-> business_documents (migration 44). Line maths is the invoice editor's
 * (computeTaxSummary, paise), so a converted quotation issues with the same figures.
 */
import { computeTaxSummary, type TaxSummary } from "@/lib/invoices/tax-summary";
import type { Address, Party } from "@/types/accounting";

export type BusinessDocType = "quotation" | "proforma" | "purchase_order" | "delivery_challan";
export type BusinessDocStatus = "draft" | "sent" | "accepted" | "rejected" | "converted" | "cancelled";

export const BUSINESS_DOC_TYPES: ReadonlyArray<{ value: BusinessDocType; label: string }> = [
  { value: "quotation", label: "Quotation" },
  { value: "proforma", label: "Proforma invoice" },
  { value: "purchase_order", label: "Purchase order" },
  { value: "delivery_challan", label: "Delivery challan" },
];
export const BUSINESS_DOC_STATUSES: ReadonlyArray<BusinessDocStatus> = [
  "draft", "sent", "accepted", "rejected", "converted", "cancelled",
];

/** Status moves the guard trigger allows by hand ('converted' only comes from the convert action). */
export const NEXT_STATUSES: Record<BusinessDocStatus, BusinessDocStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "rejected", "cancelled"],
  accepted: ["cancelled"],
  rejected: ["cancelled"],
  converted: [],
  cancelled: [],
};

export const canConvert = (d: Pick<BusinessDocument, "doc_type" | "status">) =>
  (d.doc_type === "quotation" || d.doc_type === "proforma") && ["draft", "sent", "accepted"].includes(d.status);

export interface PartySnapshot {
  name?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface BusinessDocumentLine {
  line_number: number;
  item_name: string;
  description?: string | null;
  hsn_sac_code: string | null;
  unit_code: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  cess_rate: number;
  cess_amount: number;
  total_amount: number;
}

export interface BusinessDocument {
  id: string;
  organisation_id: string;
  doc_type: BusinessDocType;
  doc_number: string;
  doc_date: string;
  valid_until: string | null;
  due_date: string | null;
  party_id: string | null;
  party_snapshot: PartySnapshot;
  place_of_supply: string | null;
  supply_type: "intra_state" | "inter_state";
  status: BusinessDocStatus;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
  round_off: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  details: Record<string, string>;
  converted_to_type: "sales_invoice" | "purchase_bill" | null;
  converted_to_id: string | null;
  linked_invoice_id: string | null;
  created_at?: string;
  parties?: { legal_name: string; gstin: string | null } | null;
  business_document_lines?: BusinessDocumentLine[];
}

/** One line as the builder form holds it (rupees, discount in percent). */
export interface BuilderLine {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  discountPct: number;
  gstRate: number;
}

export interface BuilderForm {
  docType: BusinessDocType;
  docNumber: string;
  docDate: string;
  /** Valid-until for a quotation, due / delivery date for the others. */
  dueDate: string;
  partyId: string;
  party: PartySnapshot;
  placeOfSupply: string;
  interState: boolean;
  notes: string;
  details: Record<string, string>;
  items: BuilderLine[];
}

export interface SavePayload {
  doc: Record<string, unknown>;
  lines: BusinessDocumentLine[];
}

export const blankLine = (id: string): BuilderLine => ({
  id, description: "", hsn: "", qty: 1, unit: "", rate: 0, discountPct: 0, gstRate: 18,
});

/** Paise totals for the form, rounded to the rupee like the invoice editor. */
export function summarise(items: BuilderLine[], interState: boolean): TaxSummary {
  return computeTaxSummary(
    items.map((i) => ({
      quantity: i.qty,
      unitPrice: i.rate,
      discount: ((i.qty || 0) * (i.rate || 0) * (i.discountPct || 0)) / 100,
      gstRate: i.gstRate,
    })),
    { interState, roundToRupee: true }
  );
}

const rupees = (paise: number) => paise / 100;

export function toSavePayload(form: BuilderForm): SavePayload {
  const s = summarise(form.items, form.interState);
  const lines = form.items.map((i, idx): BusinessDocumentLine => {
    const t = s.lines[idx];
    const half = form.interState ? 0 : i.gstRate / 2;
    return {
      line_number: idx + 1,
      item_name: i.description.trim(),
      hsn_sac_code: i.hsn.trim() || null,
      unit_code: i.unit.trim() || "OTH",
      quantity: i.qty,
      unit_price: i.rate,
      discount_amount: rupees(Math.round((i.qty || 0) * Math.round((i.rate || 0) * 100)) - t.taxable),
      taxable_amount: rupees(t.taxable),
      gst_rate: i.gstRate,
      cgst_rate: half,
      cgst_amount: rupees(t.cgst),
      sgst_rate: half,
      sgst_amount: rupees(t.sgst),
      igst_rate: form.interState ? i.gstRate : 0,
      igst_amount: rupees(t.igst),
      cess_rate: 0,
      cess_amount: rupees(t.cess),
      total_amount: rupees(t.total),
    };
  });
  const date = form.dueDate || null;
  return {
    doc: {
      doc_type: form.docType,
      doc_number: form.docNumber.trim(),
      doc_date: form.docDate,
      valid_until: form.docType === "quotation" ? date : null,
      due_date: form.docType === "quotation" ? null : date,
      party_id: form.partyId || null,
      party_snapshot: form.party,
      place_of_supply: form.placeOfSupply || null,
      supply_type: form.interState ? "inter_state" : "intra_state",
      notes: form.notes || null,
      details: form.details,
      round_off: rupees(s.roundOff),
    },
    lines,
  };
}

export function fromDocument(doc: BusinessDocument): BuilderForm {
  return {
    docType: doc.doc_type,
    docNumber: doc.doc_number,
    docDate: doc.doc_date,
    dueDate: (doc.doc_type === "quotation" ? doc.valid_until : doc.due_date) ?? "",
    partyId: doc.party_id ?? "",
    party: doc.party_snapshot ?? {},
    placeOfSupply: doc.place_of_supply ?? "",
    interState: doc.supply_type === "inter_state",
    notes: doc.notes ?? "",
    details: doc.details ?? {},
    items: (doc.business_document_lines ?? []).map((l) => {
      const gross = Number(l.quantity) * Number(l.unit_price);
      return {
        id: `line-${l.line_number}`,
        description: l.item_name,
        hsn: l.hsn_sac_code ?? "",
        qty: Number(l.quantity),
        unit: l.unit_code === "OTH" ? "" : l.unit_code,
        rate: Number(l.unit_price),
        discountPct: gross > 0 ? Math.round((Number(l.discount_amount) / gross) * 10000) / 100 : 0,
        gstRate: Number(l.gst_rate),
      };
    }),
  };
}

export const formatAddress = (a?: Address | { line1?: string; line2?: string; city?: string; pincode?: string } | null) =>
  [a?.line1, a?.line2, a?.city, a?.pincode].filter((p) => p && p.trim()).join(", ");

export const snapshotFromParty = (p: Party): PartySnapshot => ({
  name: p.legal_name,
  gstin: p.gstin ?? "",
  address: formatAddress(p.billing_address),
  phone: p.phone ?? "",
  email: p.email ?? "",
});

/** Problems that stop a save, worded for the user. The database re-checks everything. */
export function formErrors(form: BuilderForm): string[] {
  const msgs: string[] = [];
  if (!form.docNumber.trim()) msgs.push("Enter a document number.");
  if (!form.docDate) msgs.push("Enter the issue date.");
  if (form.docType === "quotation" && form.dueDate && form.dueDate < form.docDate)
    msgs.push("Valid-until can't be before the issue date.");
  form.items.forEach((i, idx) => {
    if (!i.description.trim()) msgs.push(`Line ${idx + 1}: enter the item or service.`);
    if (!(i.qty > 0)) msgs.push(`Line ${idx + 1}: quantity must be more than zero.`);
    if (!(i.rate >= 0)) msgs.push(`Line ${idx + 1}: rate can't be negative.`);
  });
  return msgs;
}
