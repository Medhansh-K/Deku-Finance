import type { Account, JournalEntry, Party } from "@/types/accounting";
import type { DocumentProofAttachment } from "@/lib/vouchers/document-proof";
import { toPaise, toRupees } from "./ledger";

export interface VoucherLineDetail {
  dr_cr: "Dr" | "Cr";
  account_name: string;
  category: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense" | "";
  debit: number;
  credit: number;
  ledger_folio?: string;
  description?: string | null;
}

export interface VoucherItem {
  id: string;
  entry_number: string;
  voucher_type: "sales" | "payment" | "receipt" | "purchase" | "contra" | "journal";
  f_key: string;
  entry_date: string;
  entry_time: string;
  party_name: string;
  source_document: string;
  /** Ledger folio: the account code of the entry's first line. */
  ledger_folio: string;
  reference: string;
  narration: string;
  amount: number;
  dr_cr: "Dr" | "Cr";
  status: "posted" | "draft" | "reversed";
  organisation_id: string;
  lines: VoucherLineDetail[];
  document_proof?: DocumentProofAttachment;
  reversal_ref?: string;
  reversal_reason?: string;
  reversed_at?: string;
}

const TYPES: [RegExp, VoucherItem["voucher_type"], string, string][] = [
  [/SLS|SAL|INV/, "sales", "F8", ""],
  [/PAY/, "payment", "F5", "Payment Voucher"],
  [/RCP|REC/, "receipt", "F6", "Bank / Cash Receipt"],
  [/PUR/, "purchase", "F9", "Purchase Bill"],
  [/CNT/, "contra", "F4", "Contra Slip"],
];

const CATEGORY: Record<string, VoucherLineDetail["category"]> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  income: "Revenue",
  expense: "Expense",
};

/** Day Book row for a journal entry, using only what the entry, its accounts and parties record. */
export function journalToVoucher(
  j: JournalEntry,
  accounts: Map<string, Account>,
  parties: Map<string, Party>,
  regime?: "gst" | "sec22"
): VoucherItem {
  const pfx = (j.entry_number || "").split("-")[0].toUpperCase();
  const [, type, fKey, doc] = TYPES.find(([re]) => re.test(pfx)) ?? [null, "journal", "F7", "Journal Voucher"];
  const lines = j.journal_entry_lines ?? [];
  const party = lines.map((l) => (l.party_id ? parties.get(l.party_id) : undefined)).find(Boolean);
  const time = j.created_at ? new Date(j.created_at) : null;

  return {
    id: j.id,
    entry_number: j.entry_number,
    voucher_type: type,
    f_key: fKey,
    entry_date: j.entry_date,
    entry_time: time && !isNaN(time.getTime())
      ? time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "",
    party_name: party ? party.display_name || party.legal_name : "–",
    source_document:
      type !== "sales" ? doc : regime === "gst" ? "Tax Invoice" : regime === "sec22" ? "Bill of Supply" : "Sales Voucher",
    ledger_folio: accounts.get(lines[0]?.account_id ?? "")?.code ?? "–",
    reference: j.reference || j.entry_number,
    narration: j.narration || "",
    amount: toRupees(lines.reduce((s, l) => s + toPaise(l.debit), 0)),
    dr_cr: "Dr",
    status: j.status === "posted" || j.status === "reversed" ? j.status : "draft",
    organisation_id: j.organisation_id,
    lines: lines.map((l) => {
      const a = accounts.get(l.account_id);
      return {
        dr_cr: toPaise(l.debit) > 0 ? "Dr" : "Cr",
        account_name: a?.name ?? "Unknown account",
        category: CATEGORY[a?.account_group ?? a?.type ?? ""] ?? "",
        debit: l.debit || 0,
        credit: l.credit || 0,
        ledger_folio: a?.code,
        description: l.description,
      };
    }),
  };
}
