import { describe, it, expect } from "vitest";
import { summariseStatement } from "@/lib/bank/reconciliation";

// The worked figures from supabase/tests/reconciliation_statements_test.sql at 31 Oct.
const position = { book_balance: 7499.5, matched_amount: 10700, uncleared_amount: -2500.5 };
const line = (date: string, amountPaise: number, direction: "in" | "out") => ({ date, amountPaise, direction });

describe("summariseStatement", () => {
  it("has nothing unexplained when the bank shows exactly what's matched", () => {
    const s = summariseStatement(position, 1_070_000, [], "2026-10-31");
    expect(s).toEqual({
      bookPaise: 749_950,
      matchedPaise: 1_070_000,
      unclearedPaise: -250_050,
      statementOnlyPaise: 0,
      differencePaise: 320_050,
      unexplainedPaise: 0,
    });
  });

  it("explains a difference with statement lines not yet in the books, by direction", () => {
    const open = [line("2026-10-30", 50_000, "out"), line("2026-10-31", 20_000, "in")];
    const s = summariseStatement(position, 1_040_000, open, "2026-10-31");
    expect(s.statementOnlyPaise).toBe(-30_000);
    expect(s.unexplainedPaise).toBe(0);
  });

  it("leaves out statement lines after the statement date", () => {
    const s = summariseStatement(position, 1_070_000, [line("2026-11-01", 99_999, "in")], "2026-10-31");
    expect(s.statementOnlyPaise).toBe(0);
    expect(s.unexplainedPaise).toBe(0);
  });

  it("reports a one-paisa gap without floating point noise", () => {
    const s = summariseStatement({ book_balance: 0.3, matched_amount: 0.1 + 0.2, uncleared_amount: 0 }, 31, [], "2026-10-31");
    expect(s.matchedPaise).toBe(30);
    expect(s.unexplainedPaise).toBe(1);
    expect(s.differencePaise).toBe(1);
  });

  it("handles an overdrawn account", () => {
    const s = summariseStatement({ book_balance: -500, matched_amount: -500, uncleared_amount: 0 }, -50_000, [], "2026-10-31");
    expect(s.differencePaise).toBe(0);
    expect(s.unexplainedPaise).toBe(0);
  });
});
