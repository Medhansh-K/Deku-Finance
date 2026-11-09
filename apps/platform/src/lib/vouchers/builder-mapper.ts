import { Account } from "@/types/accounting";
import type { BusinessDocument } from "@/lib/builder/business-documents";
import { VoucherLineState, VoucherMode } from "@/modules/vouchers/VoucherWorkspace";

export interface MappedVoucherData {
  mode: VoucherMode;
  reference: string;
  date: string;
  narration: string;
  partyId?: string;
  lines: VoucherLineState[];
  totalDebit: number;
  totalCredit: number;
}

// Default chart codes (seed_default_chart_of_accounts). A missing account stays blank for the
// accountant to choose; it is never guessed.
const accountId = (accounts: Account[], code: string) =>
  accounts.find((a) => a.code === code && a.is_postable !== false)?.id ?? "";

/**
 * Pre-fills a purchase voucher from a purchase order saved in the Document Builder, for when the
 * supplier's bill arrives: Dr purchases + input GST, Cr the supplier. Quotations and proformas
 * aren't vouchers; they convert to sales invoices instead.
 */
export function mapPurchaseOrderToVoucher(doc: BusinessDocument, accounts: Account[]): MappedVoucherData {
  const taxable = Number(doc.taxable_amount) || 0;
  const cgst = Number(doc.cgst_amount) || 0;
  const sgst = Number(doc.sgst_amount) || 0;
  const igst = Number(doc.igst_amount) || 0;
  // The PO's rupee round-off is left out so the voucher balances; the supplier's bill decides the final figure.
  const total = taxable + cgst + sgst + igst + (Number(doc.cess_amount) || 0);
  const partyId = doc.party_id ?? "self";
  const name = doc.parties?.legal_name ?? doc.party_snapshot?.name ?? "supplier";

  const draft: Array<Omit<VoucherLineState, "id" | "line_number">> = [
    { dr_cr: "Dr", account_id: accountId(accounts, "5010"), party_id: "self", description: `Purchases per ${doc.doc_number}`, amount: taxable.toFixed(2) },
    { dr_cr: "Dr", account_id: accountId(accounts, "1081"), party_id: "self", description: "Input CGST", amount: cgst.toFixed(2) },
    { dr_cr: "Dr", account_id: accountId(accounts, "1082"), party_id: "self", description: "Input SGST", amount: sgst.toFixed(2) },
    { dr_cr: "Dr", account_id: accountId(accounts, "1083"), party_id: "self", description: "Input IGST", amount: igst.toFixed(2) },
    { dr_cr: "Cr", account_id: accountId(accounts, "2010"), party_id: partyId, description: `Payable to ${name} (${doc.doc_number})`, amount: total.toFixed(2) },
  ];
  const lines = draft
    .filter((l) => Number(l.amount) > 0)
    .map((l, i) => ({ ...l, id: `po-${doc.id}-${i + 1}`, line_number: i + 1 }));

  const sum = (side: "Dr" | "Cr") => lines.filter((l) => l.dr_cr === side).reduce((s, l) => s + Number(l.amount), 0);

  return {
    mode: "purchase",
    reference: doc.doc_number,
    date: doc.doc_date,
    narration: `Purchase against PO ${doc.doc_number} from ${name}`,
    partyId: doc.party_id ?? undefined,
    lines,
    totalDebit: sum("Dr"),
    totalCredit: sum("Cr"),
  };
}
