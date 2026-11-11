import { describe, it, expect } from "vitest";
import { matchStatement, scorePair, type CandidateLine } from "@/lib/bank/matcher";
import type { StatementLine } from "@/lib/bank/statement-parser";

const stmt = (row: number, date: string, amountPaise: number, direction: "in" | "out", narration: string, reference = ""): StatementLine => ({
  row, date, amountPaise, direction, narration, reference, balancePaise: null, balanceMismatch: false,
});

const cand = (id: string, date: string, amountPaise: number, direction: "in" | "out", extra: Partial<CandidateLine> = {}): CandidateLine => ({
  id, date, amountPaise, direction, ...extra,
});

describe("scorePair", () => {
  it("requires exact amount and same direction", () => {
    const l = stmt(1, "2026-10-03", 11_800_000, "in", "NEFT ACME");
    expect(scorePair(l, cand("a", "2026-10-03", 11_800_001, "in"))).toBeNull();
    expect(scorePair(l, cand("a", "2026-10-03", 11_800_000, "out"))).toBeNull();
    expect(scorePair(l, cand("a", "2026-10-03", 11_800_000, "in"))?.score).toBe(30);
  });

  it("drops candidates outside the date window unless the reference matches", () => {
    const l = stmt(1, "2026-10-20", 2_360_000, "out", "CHQ PAID-000123456-CLOUDNINE", "000123456");
    expect(scorePair(l, cand("a", "2026-10-05", 2_360_000, "out"))).toBeNull();
    const late = scorePair(l, cand("b", "2026-10-05", 2_360_000, "out", { reference: "CHQ 123456" }));
    expect(late?.score).toBe(50);
    expect(late?.reasons).toContain("reference 123456 found");
  });
});

describe("matchStatement", () => {
  it("prefers a reference match over a closer date", () => {
    const lines = [stmt(1, "2026-10-07", 500_000, "in", "NEFT-UTR N276260009999-GLOBEX INDIA PVT LTD")];
    const [r] = matchStatement(lines, [
      cand("same-day", "2026-10-07", 500_000, "in", { narration: "Receipt from customer" }),
      cand("by-ref", "2026-10-04", 500_000, "in", { reference: "N276260009999" }),
    ]);
    expect(r.status).toBe("suggested");
    if (r.status !== "suggested") return;
    expect(r.best.candidate.id).toBe("by-ref");
    expect(r.best.score).toBe(50 + 15);
  });

  it("uses party name tokens as a tie breaker", () => {
    const lines = [stmt(1, "2026-10-03", 100_000, "out", "UPI/CLOUDNINE HOSTING/629812345678")];
    const [r] = matchStatement(lines, [
      cand("other", "2026-10-03", 100_000, "out", { partyName: "Swiggy Ltd" }),
      cand("cloud", "2026-10-03", 100_000, "out", { partyName: "Cloudnine Hosting Pvt Ltd" }),
    ]);
    expect(r.status === "suggested" && r.best.candidate.id).toBe("cloud");
  });

  it("reports a tie as ambiguous without consuming either journal line", () => {
    const lines = [
      stmt(1, "2026-10-10", 250_000, "out", "ATM WDL"),
      stmt(2, "2026-10-12", 999_900, "in", "NEFT UNKNOWN"),
    ];
    const results = matchStatement(lines, [
      cand("x", "2026-10-09", 250_000, "out"),
      cand("y", "2026-10-11", 250_000, "out"),
    ]);
    expect(results[0].status).toBe("ambiguous");
    if (results[0].status === "ambiguous") {
      expect(results[0].candidates.map((c) => c.candidate.id).sort()).toEqual(["x", "y"]);
    }
    expect(results[1].status).toBe("unmatched");
  });

  it("assigns each journal line to at most one statement line, best score first", () => {
    const lines = [
      stmt(1, "2026-10-01", 300_000, "in", "CASH DEP"),
      stmt(2, "2026-10-05", 300_000, "in", "CASH DEP"),
    ];
    const results = matchStatement(lines, [cand("only", "2026-10-05", 300_000, "in")]);
    expect(results[1].status === "suggested" && results[1].best.candidate.id).toBe("only");
    expect(results[0].status).toBe("unmatched");
  });
});
