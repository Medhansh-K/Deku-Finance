import { JournalEntry } from "@/types/accounting";

export interface ApprovalQueues {
  /** Submitted and waiting for a checker. */
  awaiting: JournalEntry[];
  /** Sent back with a reason; the maker fixes and resubmits. */
  returned: JournalEntry[];
}

/** Splits drafts into the approval queues. The database enforces the rules; this only sorts. */
export function approvalQueues(journals: JournalEntry[]): ApprovalQueues {
  const drafts = journals.filter((j) => j.status === "draft");
  const oldestFirst = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").localeCompare(b ?? "");
  return {
    awaiting: drafts.filter((j) => j.submitted_at).sort((a, b) => oldestFirst(a.submitted_at, b.submitted_at)),
    returned: drafts.filter((j) => !j.submitted_at && j.rejected_at).sort((a, b) => oldestFirst(b.rejected_at, a.rejected_at)),
  };
}

/** A checker may not approve their own voucher (mirrors post_journal_entry in migration 20). */
export function canApprove(entry: JournalEntry, userId: string | undefined): boolean {
  return !!userId && entry.created_by !== userId && entry.submitted_by !== userId;
}

export function entryTotal(entry: JournalEntry): number {
  return entry.journal_entry_lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
}
