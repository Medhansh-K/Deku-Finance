/** Credit / debit note lines built from the original invoice's lines (migration 31). */
import type { SalesInvoiceLine } from "@/types/accounting";

export const NOTE_REASONS = [
  { value: "sales_return", label: "Sales return" },
  { value: "post_sale_discount", label: "Post-sale discount" },
  { value: "deficiency_in_service", label: "Deficiency in service" },
  { value: "correction_in_invoice", label: "Correction in invoice" },
  { value: "change_in_pos", label: "Change in place of supply" },
  { value: "finalisation_of_provisional_assessment", label: "Finalisation of provisional assessment" },
  { value: "others", label: "Others" },
] as const;

export type NoteLine = Omit<SalesInvoiceLine, "id" | "invoice_id">;

const paise = (v: number | undefined) => Math.round((Number(v) || 0) * 100);

/**
 * The original line for `qty` of its quantity. Each head is scaled and rounded to the paisa on its
 * own, so the full quantity reproduces the line exactly and equal CGST/SGST stay equal.
 */
export function noteLine(orig: SalesInvoiceLine, qty: number, lineNumber: number): NoteLine {
  const k = Number(orig.quantity) > 0 ? qty / Number(orig.quantity) : 0;
  const part = (v: number | undefined) => Math.round(paise(v) * k);
  const [taxable, cgst, sgst, igst, cess] = [
    orig.taxable_amount,
    orig.cgst_amount,
    orig.sgst_amount,
    orig.igst_amount,
    orig.cess_amount,
  ].map(part);
  return {
    line_number: lineNumber,
    item_id: orig.item_id ?? null,
    item_name: orig.item_name,
    description: orig.description ?? null,
    hsn_sac_code: orig.hsn_sac_code ?? null,
    unit_code: orig.unit_code,
    quantity: qty,
    unit_price: Number(orig.unit_price),
    discount_amount: part(orig.discount_amount) / 100,
    taxable_amount: taxable / 100,
    gst_rate: Number(orig.gst_rate),
    cgst_rate: Number(orig.cgst_rate ?? 0),
    cgst_amount: cgst / 100,
    sgst_rate: Number(orig.sgst_rate ?? 0),
    sgst_amount: sgst / 100,
    igst_rate: Number(orig.igst_rate ?? 0),
    igst_amount: igst / 100,
    cess_rate: Number(orig.cess_rate ?? 0),
    cess_amount: cess / 100,
    total_amount: (taxable + cgst + sgst + igst + cess) / 100,
  };
}

/** Note lines for the quantities chosen per original line; a zero or blank quantity leaves the line out. */
export function noteLines(orig: SalesInvoiceLine[], quantities: number[]): NoteLine[] {
  const out: NoteLine[] = [];
  orig.forEach((l, i) => {
    const q = quantities[i];
    if (q > 0) out.push(noteLine(l, q, out.length + 1));
  });
  return out;
}
