/**
 * Receivables per issued sales invoice, settled by the ledger (partyBalances, oldest first).
 * Pure functions; amounts in paise.
 */
import type { Account, JournalEntry, Party, SalesInvoice } from "@/types/accounting";
import { daysBetween, findControlAccount, liveEntries, partyBalances, toPaise } from "@/lib/reports/ledger";

/** The list call returns the stored tax columns too (migration 007). */
export type CollectInvoice = SalesInvoice & {
  cgst_amount?: number | string | null;
  sgst_amount?: number | string | null;
  igst_amount?: number | string | null;
  cess_amount?: number | string | null;
};

export interface CollectRow {
  invoice: CollectInvoice;
  partyName: string;
  phone: string | null;
  amountPaise: number;
  /** Still owed per the ledger; null when the invoice has no live journal entry to settle against. */
  openPaise: number | null;
  /** Output GST on the invoice; null when the tax columns are missing. */
  taxPaise: number | null;
  /** Positive = days past due, negative = days until due; null without a due date. */
  daysPastDue: number | null;
  invoiceAgeDays: number;
}

export type CollectTab = "uncollected" | "overdue" | "due7" | "partial" | "paid";

export const MSME_DAYS = 45;
export const OVERDUE_ALERT_DAYS = 15;

const TAX_COLS = ["cgst_amount", "sgst_amount", "igst_amount", "cess_amount"] as const;
const known = (v: unknown) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));

export function invoiceTaxPaise(inv: CollectInvoice): number | null {
  if (!TAX_COLS.every((c) => known(inv[c]))) return null;
  return TAX_COLS.reduce((s, c) => s + toPaise(inv[c]), 0);
}

export function collectRows(
  invoices: CollectInvoice[],
  accounts: Account[],
  journals: JournalEntry[],
  parties: Party[],
  asOf: string
): { rows: CollectRow[]; hasControlAccount: boolean } {
  const control = findControlAccount(accounts, "receivable");
  const open = new Map<string, number>();
  if (control)
    for (const p of partyBalances(journals, control.id, "receivable", asOf))
      for (const i of p.openItems) open.set(i.entryId, (open.get(i.entryId) ?? 0) + i.openPaise);
  const live = new Set(liveEntries(journals).map((j) => j.id));
  const partyById = new Map(parties.map((p) => [p.id, p]));

  const rows = invoices
    .filter((i) => i.status !== "draft" && i.status !== "cancelled")
    .map((inv): CollectRow => {
      const jid = inv.journal_entry_id;
      const party = partyById.get(inv.customer_id);
      return {
        invoice: inv,
        partyName: inv.parties?.legal_name ?? party?.legal_name ?? "Unknown customer",
        phone: party?.phone ?? null,
        amountPaise: toPaise(inv.total_amount),
        // A posted invoice entry with no open item left has been fully settled.
        openPaise: control && jid && live.has(jid) ? open.get(jid) ?? 0 : null,
        taxPaise: invoiceTaxPaise(inv),
        daysPastDue: inv.due_date ? daysBetween(inv.due_date, asOf) : null,
        invoiceAgeDays: Math.max(0, daysBetween(inv.invoice_date, asOf)),
      };
    });
  return { rows, hasControlAccount: !!control };
}

export function inTab(r: CollectRow, tab: CollectTab): boolean {
  if (r.openPaise === null) return tab === "uncollected";
  const owed = r.openPaise > 0;
  switch (tab) {
    case "uncollected":
      return owed;
    case "overdue":
      return owed && r.daysPastDue !== null && r.daysPastDue > 0;
    case "due7":
      return owed && r.daysPastDue !== null && r.daysPastDue <= 0 && r.daysPastDue >= -7;
    case "partial":
      return owed && r.openPaise < r.amountPaise;
    case "paid":
      return !owed;
  }
}

/** MSMED Act: unpaid more than 45 days after the invoice. */
export const msmeFlag = (r: CollectRow) => !!r.openPaise && r.invoiceAgeDays > MSME_DAYS;

export interface CollectStats {
  uncollectedPaise: number;
  overdue15Paise: number;
  due7Paise: number;
  /** null when any counted invoice lacks its tax columns. */
  gstAtRiskPaise: number | null;
  unposted: number;
}

/** `periodEnd` (yyyy-mm-dd): GST at risk counts invoices dated up to the end of the return period. */
export function collectStats(rows: CollectRow[], periodEnd: string): CollectStats {
  const s: CollectStats = { uncollectedPaise: 0, overdue15Paise: 0, due7Paise: 0, gstAtRiskPaise: 0, unposted: 0 };
  for (const r of rows) {
    if (r.openPaise === null) {
      s.unposted++;
      continue;
    }
    if (r.openPaise <= 0) continue;
    s.uncollectedPaise += r.openPaise;
    if (r.daysPastDue !== null && r.daysPastDue > OVERDUE_ALERT_DAYS) s.overdue15Paise += r.openPaise;
    if (inTab(r, "due7")) s.due7Paise += r.openPaise;
    if (r.invoice.invoice_date <= periodEnd)
      s.gstAtRiskPaise = r.taxPaise === null || s.gstAtRiskPaise === null ? null : s.gstAtRiskPaise + r.taxPaise;
  }
  return s;
}
