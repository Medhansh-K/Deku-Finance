import type { BankPosition } from "@/api/endpoints";
import type { StatementLine } from "@/lib/bank/statement-parser";

const toPaise = (v: number | string) => Math.round(Number(v) * 100);

/**
 * The figures for finishing a reconciliation, in paise. The database recomputes them on save; this is
 * what the user sees first. `openLines` are the loaded statement's lines with no saved match.
 */
export function summariseStatement(
  position: BankPosition,
  closingPaise: number,
  openLines: Pick<StatementLine, "date" | "amountPaise" | "direction">[],
  statementDate: string
) {
  const statementOnlyPaise = openLines
    .filter((l) => l.date <= statementDate)
    .reduce((sum, l) => sum + (l.direction === "in" ? l.amountPaise : -l.amountPaise), 0);
  const bookPaise = toPaise(position.book_balance);
  const matchedPaise = toPaise(position.matched_amount);
  return {
    bookPaise,
    matchedPaise,
    unclearedPaise: toPaise(position.uncleared_amount),
    statementOnlyPaise,
    differencePaise: closingPaise - bookPaise,
    // What the bank must show is what's matched plus its lines not yet in the books.
    unexplainedPaise: closingPaise - matchedPaise - statementOnlyPaise,
  };
}
