/**
 * Proposes matches between bank statement lines and journal lines already posted to the bank account.
 * Pure function: it never posts or reconciles anything; the user confirms each proposal.
 */
import type { Direction, StatementLine } from "./statement-parser";

export interface CandidateLine {
  id: string; // journal_entry_lines.id
  date: string; // ISO entry date
  amountPaise: number;
  direction: Direction; // debit on the bank account = "in"
  entryNumber?: string;
  reference?: string | null;
  narration?: string | null;
  partyName?: string | null;
}

export interface ScoredCandidate {
  candidate: CandidateLine;
  score: number;
  reasons: string[];
}

export type MatchResult =
  | { line: StatementLine; status: "suggested"; best: ScoredCandidate }
  | { line: StatementLine; status: "ambiguous"; candidates: ScoredCandidate[] }
  | { line: StatementLine; status: "unmatched" };

export const DATE_WINDOW_DAYS = 5;

const PARTY_STOPWORDS = new Set([
  "pvt", "private", "ltd", "limited", "llp", "the", "and", "india", "co", "company",
  "corp", "corporation", "inc", "enterprises", "services", "solutions", "traders",
]);

const tokens = (s: string | null | undefined) => (s || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

/** Cheque numbers, UTRs and UPI refs: 5+ chars with 4+ digits; leading zeros dropped so 000123456 = 123456. */
function refTokens(...texts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts.flatMap(tokens)) {
    if (t.length < 5 || (t.match(/\d/g) || []).length < 4) continue;
    const n = /^\d+$/.test(t) ? t.replace(/^0+/, "") : t;
    if (n.length >= 4) out.add(n);
  }
  return out;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export function scorePair(line: StatementLine, c: CandidateLine): ScoredCandidate | null {
  if (line.amountPaise !== c.amountPaise || line.direction !== c.direction) return null;

  const reasons: string[] = ["amount and direction match"];
  let score = 0;

  const stmtRefs = refTokens(line.reference, line.narration);
  const ref = [...refTokens(c.reference, c.narration)].find((t) => stmtRefs.has(t));
  if (ref) {
    score += 50;
    reasons.push(`reference ${ref} found`);
  }

  const days = Math.abs(dayNumber(line.date) - dayNumber(c.date));
  // A cheque can clear well after it was booked, so a reference match is allowed outside the date window.
  if (days > DATE_WINDOW_DAYS && !ref) return null;
  if (days <= DATE_WINDOW_DAYS) {
    score += 30 - 5 * days;
    reasons.push(days === 0 ? "same date" : `${days} day${days === 1 ? "" : "s"} apart`);
  }

  const narration = new Set(tokens(line.narration));
  const party = tokens(c.partyName).find((t) => t.length >= 3 && !PARTY_STOPWORDS.has(t.toLowerCase()) && narration.has(t));
  if (party) {
    score += 15;
    reasons.push(`party name "${party}" in narration`);
  }

  return { candidate: c, score, reasons };
}

export function matchStatement(lines: StatementLine[], candidates: CandidateLine[]): MatchResult[] {
  const scored = lines.map((l) => candidates.map((c) => scorePair(l, c)).filter((s): s is ScoredCandidate => s !== null));

  // Greedy by score, not an optimal assignment: take the highest-scoring pair first so each journal line
  // goes to at most one statement line. A statement line whose top score is shared by several unused
  // journal lines is left ambiguous for the user and does not consume any of them.
  const pairs = scored
    .flatMap((list, li) => list.map((s) => ({ li, s })))
    .sort((a, b) => b.s.score - a.s.score || a.li - b.li);

  const results: (MatchResult | undefined)[] = new Array(lines.length);
  const used = new Set<string>();

  for (const { li, s } of pairs) {
    if (results[li] || used.has(s.candidate.id)) continue;
    const tied = scored[li].filter((o) => o.score === s.score && !used.has(o.candidate.id));
    if (tied.length === 1) {
      used.add(s.candidate.id);
      results[li] = { line: lines[li], status: "suggested", best: s };
    } else {
      results[li] = { line: lines[li], status: "ambiguous", candidates: tied };
    }
  }

  return lines.map((line, li) => {
    const r = results[li];
    if (r?.status !== "ambiguous") return r ?? { line, status: "unmatched" };
    // A tied journal line may have been claimed by another statement line afterwards.
    const left = r.candidates.filter((c) => !used.has(c.candidate.id));
    return left.length ? { ...r, candidates: left } : { line, status: "unmatched" };
  });
}
