/**
 * Ledger primitives the demo engine shares: money rounding, the "live" journal set reports read,
 * account lookups by the real chart codes, journal validation as post_journal_entry does it,
 * and the books' own "today". Pure functions over a DemoDataset; nothing here touches storage.
 */
import { ApiError } from "@/api/client";
import type { Account, JournalEntry, JournalEntryLine } from "@/types/accounting";
import type { DemoDataset } from "../sample-data";

/** The date the seeded books run up to. Ageing and other "as of today" figures use the books' date, never the visitor's clock. */
export const DEMO_BOOKS_DATE = "2026-11-10";

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const paise = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100);

/** A rejected request: the screen shows `message`, exactly as it shows a backend error. */
export function fail(message: string, status = 400, code = "demo_rule"): never {
  throw new ApiError(message, status, { code, message });
}

/** Thrown for every write the demo does not model, so the screen says so instead of pretending. */
export function notInDemo(action: string, why?: string): never {
  throw new ApiError(`${action} isn't available in the demo${why ? `: ${why}` : "."}`, 501, {
    code: "not_available_in_demo",
    action,
  });
}

/** Entries every report reads: posted and reversed (migration 21 keeps reversed entries in reports). */
export const isBooked = (j: JournalEntry) => j.status === "posted" || j.status === "reversed";

export function bookedJournals(ds: DemoDataset, range: { from?: string | null; to?: string | null } = {}) {
  return ds.journals.filter(
    (j) => isBooked(j) && (!range.from || j.entry_date >= range.from) && (!range.to || j.entry_date <= range.to)
  );
}

/** Latest of the seed date and the newest entry: the books' "today". */
export function booksToday(ds: DemoDataset): string {
  return ds.journals.reduce((max, j) => (j.entry_date > max ? j.entry_date : max), DEMO_BOOKS_DATE);
}

export function accountByCode(ds: DemoDataset, code: string): Account | undefined {
  return ds.accounts.find((a) => a.code === code);
}

export function requireAccount(ds: DemoDataset, code: string): Account {
  return accountByCode(ds, code) ?? fail(`The chart of accounts is missing account ${code}`);
}

/** Open fiscal period covering a date, as every SQL posting function looks it up. */
export function openPeriodFor(ds: DemoDataset, date: string) {
  return ds.fiscalPeriods.find((p) => p.status === "open" && p.start_date <= date && date <= p.end_date);
}

export const lineId = (journalId: string, lineNumber: number) => `${journalId}-l${lineNumber}`;

/** Normalises lines: ids, line numbers, 2-decimal amounts. */
export function numberLines(journalId: string, lines: Omit<JournalEntryLine, "line_number">[]): JournalEntryLine[] {
  return lines.map((l, i) => ({
    ...l,
    id: lineId(journalId, i + 1),
    journal_entry_id: journalId,
    line_number: i + 1,
    debit: r2(l.debit),
    credit: r2(l.credit),
  }));
}

/** Line-level checks the database enforces on insert (chk_journal_entry_lines_one_side, postable guard, FKs). */
export function checkLines(ds: DemoDataset, lines: JournalEntryLine[]) {
  for (const l of lines) {
    const acc = ds.accounts.find((a) => a.id === l.account_id);
    if (!acc) fail(`Line ${l.line_number}: choose an account`);
    if (acc.is_postable === false)
      fail(`Accounting Violation: Transactions can only be posted to Labels (leaf accounts), not parent ledgers or groups (Account ${acc.label} is not postable)`);
    if (l.debit < 0 || l.credit < 0 || (l.debit > 0) === (l.credit > 0))
      fail(`Line ${l.line_number}: enter either a debit or a credit, not both and not zero`);
    if (l.party_id && !ds.parties.some((p) => p.id === l.party_id)) fail(`Line ${l.line_number}: that party isn't in this company`);
  }
}

export const totals = (lines: JournalEntryLine[]) => ({
  debit: lines.reduce((s, l) => s + paise(l.debit), 0) / 100,
  credit: lines.reduce((s, l) => s + paise(l.credit), 0) / 100,
});

/** post_journal_entry's period and double-entry checks (migration 20). */
export function checkPostable(ds: DemoDataset, j: JournalEntry) {
  const period = ds.fiscalPeriods.find((p) => p.id === j.fiscal_period_id);
  if (!period) fail("Assigned fiscal period not found");
  if (period.status !== "open") fail(`Cannot post into a closed fiscal period (${period.name})`);
  if (j.entry_date < period.start_date || j.entry_date > period.end_date)
    fail(`Entry date (${j.entry_date}) falls outside fiscal period bounds (${period.start_date} to ${period.end_date})`);
  const lines = j.journal_entry_lines;
  if (lines.length < 2) fail(`Double-entry failure: A posted journal entry must have at least 2 lines (Found ${lines.length})`);
  const t = totals(lines);
  if (t.debit <= 0) fail("Double-entry failure: Total entry value must be strictly positive");
  if (paise(t.debit) !== paise(t.credit)) fail(`Out of balance: Total debits (${t.debit}) do not equal total credits (${t.credit})`);
}

export function uniqueEntryNumber(ds: DemoDataset, number: string) {
  if (ds.journals.some((j) => j.entry_number === number)) fail(`Voucher number ${number} is already used in this company`);
}

/** next_voucher_number: prefix-NNNN, one past the highest numeric suffix already used. */
export function nextVoucherNumber(ds: DemoDataset, prefix: string): string {
  let max = 0;
  for (const j of ds.journals) {
    if (!j.entry_number.startsWith(`${prefix}-`)) continue;
    const rest = j.entry_number.slice(prefix.length + 1);
    if (/^\d{1,12}$/.test(rest)) max = Math.max(max, Number(rest));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** Unique ids for new rows (time + random, so ids never clash with seeded or reloaded rows). */
export function newId(ds: DemoDataset, kind: string): string {
  return `${ds.org.id}-${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Natural balance per account over booked entries (asset/expense debit-positive, others credit-positive). */
export function accountTotals(ds: DemoDataset, range: { from?: string | null; to?: string | null } = {}) {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const a of ds.accounts) map.set(a.id, { debit: 0, credit: 0 });
  for (const j of bookedJournals(ds, range)) {
    for (const l of j.journal_entry_lines) {
      const cur = map.get(l.account_id) ?? { debit: 0, credit: 0 };
      cur.debit = r2(cur.debit + Number(l.debit || 0));
      cur.credit = r2(cur.credit + Number(l.credit || 0));
      map.set(l.account_id, cur);
    }
  }
  return map;
}

export const debitNatured = (a: Pick<Account, "type">) => a.type === "asset" || a.type === "expense";

export function balanceOf(ds: DemoDataset, code: string, range: { from?: string | null; to?: string | null } = {}) {
  const acc = accountByCode(ds, code);
  if (!acc) return 0;
  const t = accountTotals(ds, range).get(acc.id) ?? { debit: 0, credit: 0 };
  return r2(debitNatured(acc) ? t.debit - t.credit : t.credit - t.debit);
}

/** Swapped lines for a reversal, as reverse_journal_entry copies them. */
export function reversedLines(j: JournalEntry): Omit<JournalEntryLine, "line_number">[] {
  return j.journal_entry_lines.map((l) => ({
    account_id: l.account_id,
    party_id: l.party_id ?? null,
    description: `Reversal: ${l.description ?? ""}`,
    debit: Number(l.credit || 0),
    credit: Number(l.debit || 0),
  }));
}
