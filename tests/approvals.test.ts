import { describe, it, expect } from "vitest";
import { approvalQueues, canApprove, entryTotal } from "@/lib/vouchers/approvals";
import { JournalEntry } from "@/types/accounting";

const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  id: over.id ?? "e",
  organisation_id: "o",
  fiscal_period_id: "f",
  entry_number: over.id ?? "e",
  entry_date: "2026-10-01",
  status: "draft",
  narration: "",
  journal_entry_lines: [
    { line_number: 1, account_id: "a", debit: 500, credit: 0 },
    { line_number: 2, account_id: "b", debit: 0, credit: 500 },
  ],
  ...over,
});

describe("approvalQueues", () => {
  it("puts submitted drafts in the queue oldest first and returned ones apart", () => {
    const q = approvalQueues([
      entry({ id: "posted", status: "posted", submitted_at: "2026-10-01" }),
      entry({ id: "plain-draft" }),
      entry({ id: "late", submitted_at: "2026-10-05" }),
      entry({ id: "early", submitted_at: "2026-10-02" }),
      entry({ id: "rejected", rejected_at: "2026-10-03", rejection_reason: "wrong GST" }),
    ]);
    expect(q.awaiting.map((e) => e.id)).toEqual(["early", "late"]);
    expect(q.returned.map((e) => e.id)).toEqual(["rejected"]);
  });
});

describe("canApprove", () => {
  it("blocks the maker and the submitter from approving their own voucher", () => {
    const e = entry({ created_by: "maker", submitted_by: "submitter" });
    expect(canApprove(e, "maker")).toBe(false);
    expect(canApprove(e, "submitter")).toBe(false);
    expect(canApprove(e, "checker")).toBe(true);
    expect(canApprove(e, undefined)).toBe(false);
  });
});

it("entryTotal sums the debit side", () => {
  expect(entryTotal(entry({}))).toBe(500);
});
