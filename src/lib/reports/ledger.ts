/**
 * Pure ledger aggregations over journal entries. Amounts are summed in paise (integers).
 */
import type { Account, JournalEntry } from "@/types/accounting";

export const toPaise = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);
export const toRupees = (paise: number) => paise / 100;

const DAY_MS = 86_400_000;
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);

/** Entries that are part of the books: posted, and reversed originals (their reversal is its own posted entry). */
export const bookEntries = (journals: JournalEntry[]) =>
  journals.filter((j) => j.status === "posted" || j.status === "reversed");

/** Book entries minus reversed originals paired with their reversal: the pair nets to zero. */
export function liveEntries(journals: JournalEntry[]) {
  const booked = bookEntries(journals);
  const ids = new Set(booked.map((j) => j.id));
  const voided = new Set<string>();
  for (const j of booked)
    if (j.reversal_of_id && ids.has(j.reversal_of_id)) voided.add(j.id).add(j.reversal_of_id);
  return booked.filter((j) => !voided.has(j.id));
}

export const inRange = (date: string, from: string, to: string) => date >= from && date <= to;

/** First day of the financial year containing `asOf` (startMonth 1-12, India: 4). */
export function fyStart(asOf: string, startMonth = 4) {
  const y = Number(asOf.slice(0, 4));
  const m = Number(asOf.slice(5, 7));
  const year = m >= startMonth ? y : y - 1;
  return `${year}-${String(startMonth).padStart(2, "0")}-01`;
}

const text = (a: Account) => `${a.name} ${a.ledger ?? ""} ${a.sub_ledger ?? ""}`;
const group = (a: Account): string => a.account_group ?? (a.type === "income" ? "revenue" : a.type);

export type ControlKind = "receivable" | "payable";

/** Trade debtors / creditors control account: seeded codes 1030 / 2010, else by name. */
export function findControlAccount(accounts: Account[], kind: ControlKind) {
  const [code, re, g] =
    kind === "receivable"
      ? ["1030", /trade debtors|accounts receivable|sundry debtors/i, "asset"]
      : ["2010", /trade creditors|accounts payable|sundry creditors/i, "liability"];
  return (
    accounts.find((a) => a.code === code && group(a) === g) ??
    accounts.find((a) => group(a) === g && a.is_postable !== false && re.test(text(a)))
  );
}

export const isCashOrBank = (a: Account) => group(a) === "asset" && /\b(cash|bank)\b/i.test(text(a));
export const isOutputGst = (a: Account) => group(a) === "liability" && /output.*gst/i.test(text(a));
export const isInputGst = (a: Account) => group(a) === "asset" && /input.*gst/i.test(text(a));
export const isCostOfSales = (a: Account) =>
  group(a) === "expense" && /cost of (goods|sales)|\bcogs\b/i.test(text(a));
export const isOperatingExpense = (a: Account) => group(a) === "expense" && !isCostOfSales(a);

/** Natural-side balance per account in paise (debit-normal for assets/expenses). */
export function accountBalances(accounts: Account[], journals: JournalEntry[], from = "", to = "9999-12-31") {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out = new Map<string, number>();
  for (const j of bookEntries(journals)) {
    if (!inRange(j.entry_date, from, to)) continue;
    for (const l of j.journal_entry_lines ?? []) {
      const a = byId.get(l.account_id);
      if (!a) continue;
      const dr = toPaise(l.debit) - toPaise(l.credit);
      const debitNormal = group(a) === "asset" || group(a) === "expense";
      out.set(a.id, (out.get(a.id) ?? 0) + (debitNormal ? dr : -dr));
    }
  }
  return out;
}

/** Sum of natural balances over the accounts matching `pick`. */
export function sumWhere(accounts: Account[], balances: Map<string, number>, pick: (a: Account) => boolean) {
  return accounts.reduce((s, a) => s + (pick(a) ? balances.get(a.id) ?? 0 : 0), 0);
}

export const byGroup = (g: string) => (a: Account) => group(a) === g;

export interface OpenItem {
  entryId: string;
  entryNumber: string;
  reference: string | null;
  date: string;
  amountPaise: number;
  openPaise: number;
  ageDays: number;
}

export interface PartyBalance {
  partyId: string | null;
  balancePaise: number;
  /** Payments not yet matched to a bill/invoice (balance in the other direction). */
  advancePaise: number;
  openItems: OpenItem[];
  oldestAgeDays: number | null;
}

/**
 * Per-party balances on a control account, aged first-in-first-out: each payment settles the
 * party's oldest open bill/invoice. Reversal pairs are dropped since they cancel out.
 */
export function partyBalances(
  journals: JournalEntry[],
  accountId: string,
  kind: ControlKind,
  asOf: string
): PartyBalance[] {
  const sign = kind === "receivable" ? 1 : -1;
  const entries = [...liveEntries(journals)].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number)
  );
  const parties = new Map<string | null, { items: OpenItem[]; advance: number }>();

  for (const j of entries) {
    const net = new Map<string | null, number>();
    for (const l of j.journal_entry_lines ?? []) {
      if (l.account_id !== accountId) continue;
      const p = l.party_id || null;
      net.set(p, (net.get(p) ?? 0) + sign * (toPaise(l.debit) - toPaise(l.credit)));
    }
    for (const [p, amt] of net) {
      if (amt === 0) continue;
      const st = parties.get(p) ?? { items: [], advance: 0 };
      parties.set(p, st);
      if (amt > 0) {
        const used = Math.min(st.advance, amt);
        st.advance -= used;
        st.items.push({
          entryId: j.id,
          entryNumber: j.entry_number,
          reference: j.reference ?? null,
          date: j.entry_date,
          amountPaise: amt,
          openPaise: amt - used,
          ageDays: Math.max(0, daysBetween(j.entry_date, asOf)),
        });
      } else {
        let left = -amt;
        for (const it of st.items) {
          const take = Math.min(it.openPaise, left);
          it.openPaise -= take;
          left -= take;
          if (!left) break;
        }
        st.advance += left;
      }
    }
  }

  return [...parties]
    .map(([partyId, st]) => {
      const openItems = st.items.filter((i) => i.openPaise > 0);
      const balancePaise = openItems.reduce((s, i) => s + i.openPaise, 0) - st.advance;
      return {
        partyId,
        balancePaise,
        advancePaise: st.advance,
        openItems,
        oldestAgeDays: openItems.length ? Math.max(...openItems.map((i) => i.ageDays)) : null,
      };
    })
    .filter((p) => p.balancePaise !== 0 || p.openItems.length > 0)
    .sort((a, b) => b.balancePaise - a.balancePaise);
}

export interface AgeBuckets {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export function ageBuckets(parties: PartyBalance[]): AgeBuckets {
  const b: AgeBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const p of parties)
    for (const i of p.openItems) {
      const k = i.ageDays <= 30 ? "d0_30" : i.ageDays <= 60 ? "d31_60" : i.ageDays <= 90 ? "d61_90" : "d90_plus";
      b[k] += i.openPaise;
    }
  return b;
}

export const bucketOf = (ageDays: number | null) =>
  ageDays === null ? null : ageDays <= 30 ? "d0_30" : ageDays <= 60 ? "d31_60" : ageDays <= 90 ? "d61_90" : "d90_plus";

/**
 * DSO / DPO: closing balance ÷ credit sales (or purchases) booked to the control account over the
 * last 365 days, × days in that window. The window is shortened to the age of the books so a
 * young company isn't measured against a year it didn't trade. Null when there was no such flow.
 */
export function daysOutstanding(
  journals: JournalEntry[],
  accountId: string,
  kind: ControlKind,
  balancePaise: number,
  asOf: string
): number | null {
  const entries = liveEntries(journals).filter((j) => j.entry_date <= asOf);
  if (!entries.length) return null;
  const first = entries.reduce((m, j) => (j.entry_date < m ? j.entry_date : m), asOf);
  const window = Math.min(365, daysBetween(first, asOf) + 1);
  const since = new Date(Date.parse(asOf) - (window - 1) * DAY_MS).toISOString().slice(0, 10);
  let flow = 0;
  for (const j of entries) {
    if (j.entry_date < since) continue;
    for (const l of j.journal_entry_lines ?? [])
      if (l.account_id === accountId) flow += toPaise(kind === "receivable" ? l.debit : l.credit);
  }
  return flow > 0 ? Math.round((balancePaise / flow) * window) : null;
}
