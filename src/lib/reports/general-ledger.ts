import { toPaise, toRupees } from "@/lib/reports/ledger";
import type { GeneralLedgerRow } from "@/types/accounting";

export interface LedgerLine extends GeneralLedgerRow {
  /** The line's own description, else the voucher's narration. */
  text: string;
  /** Debit minus credit so far: positive is Dr, negative is Cr. */
  balance: number;
}

export interface Ledger {
  /** Balance before `from`; null when no from date was given. */
  opening: number | null;
  lines: LedgerLine[];
}

/** One account's rows, oldest first, with a running balance kept in paise so it can't drift. */
export function buildLedger(rows: GeneralLedgerRow[], from = "", to = ""): Ledger {
  const sorted = [...rows].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number) || a.line_number - b.line_number
  );
  const net = (r: GeneralLedgerRow) => toPaise(r.debit) - toPaise(r.credit);
  const before = from ? sorted.filter((r) => r.entry_date < from) : [];
  let balance = before.reduce((sum, r) => sum + net(r), 0);
  const opening = from ? toRupees(balance) : null;
  const lines = sorted
    .filter((r) => (!from || r.entry_date >= from) && (!to || r.entry_date <= to))
    .map((r) => {
      balance += net(r);
      return { ...r, text: r.description || r.narration || "", balance: toRupees(balance) };
    });
  return { opening, lines };
}
