import { toPaise } from "@/lib/reports/ledger";
import type { VoucherLineDetail } from "@/lib/reports/vouchers";
import type { UpdateJournalRequest } from "@/types/accounting";

export interface DraftLine {
  account_id: string;
  party_id?: string | null;
  description?: string | null;
  dr_cr: "Dr" | "Cr";
  amount: string;
}

export const toDraftLine = (l: VoucherLineDetail): DraftLine => ({
  account_id: l.account_id,
  party_id: l.party_id,
  description: l.description,
  dr_cr: l.dr_cr,
  amount: String(l.dr_cr === "Dr" ? l.debit : l.credit),
});

export const blankDraftLine = (dr_cr: DraftLine["dr_cr"]): DraftLine => ({ account_id: "", dr_cr, amount: "" });

export function draftBalance(lines: DraftLine[]) {
  const total = (side: DraftLine["dr_cr"]) =>
    lines.filter((l) => l.dr_cr === side).reduce((sum, l) => sum + toPaise(l.amount), 0);
  const debitPaise = total("Dr");
  const creditPaise = total("Cr");
  return {
    debitPaise,
    creditPaise,
    differencePaise: Math.abs(debitPaise - creditPaise),
    balanced: debitPaise > 0 && debitPaise === creditPaise,
  };
}

/** What stops a save. Being out of balance doesn't: a draft may be saved so, and posting refuses it. */
export function draftErrors(entryDate: string, narration: string, lines: DraftLine[]): string[] {
  const errors: string[] = [];
  if (!entryDate) errors.push("Enter the voucher date.");
  if (!narration.trim()) errors.push("Enter a narration.");
  if (lines.length < 2) errors.push("A voucher needs at least 2 lines.");
  lines.forEach((l, i) => {
    if (!l.account_id) errors.push(`Line ${i + 1}: choose an account.`);
    if (!(toPaise(l.amount) > 0)) errors.push(`Line ${i + 1}: enter an amount above zero.`);
  });
  return errors;
}

export function draftPayload(entryDate: string, narration: string, reference: string, lines: DraftLine[]): UpdateJournalRequest {
  return {
    entry_date: entryDate,
    narration: narration.trim(),
    reference: reference.trim() || undefined,
    lines: lines.map((l, i) => ({
      line_number: i + 1,
      account_id: l.account_id,
      party_id: l.party_id,
      description: l.description,
      debit: l.dr_cr === "Dr" ? toPaise(l.amount) / 100 : 0,
      credit: l.dr_cr === "Cr" ? toPaise(l.amount) / 100 : 0,
    })),
  };
}
