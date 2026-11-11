import { describe, expect, it } from "vitest";
import { approvalTrail } from "@/modules/day-book/VoucherDrawer";
import { createInitialDemoDataset } from "@/lib/learn/sample-data";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import type { VoucherItem } from "@/lib/reports/vouchers";
import type { JournalEntry } from "@/types/accounting";

const v = (status: VoucherItem["status"]) => ({ status }) as VoucherItem;
const j = (fields: Partial<JournalEntry>) => ({ journal_entry_lines: [], ...fields }) as JournalEntry;

describe("Day Book approval trail", () => {
  it("shows maker, submitter and approver for an approved voucher", () => {
    const steps = approvalTrail(v("posted"), j({ created_by: "a", submitted_by: "a", submitted_at: "x", posted_by: "c", posted_at: "y" }));
    expect(steps.map((s) => [s.label, s.userId])).toEqual([
      ["Created by", "a"],
      ["Submitted for approval by", "a"],
      ["Approved and posted by", "c"],
    ]);
  });

  it("says why a step has nobody instead of inventing one", () => {
    const steps = approvalTrail(v("posted"), j({ posted_at: "y" }));
    expect(steps[0]).toMatchObject({ userId: undefined, missing: "No creator was stamped on this voucher" });
    expect(steps[1].missing).toBe("Posted directly, no approval step");
    expect(steps[2]).toMatchObject({ label: "Posted by", missing: "No approver was stamped on this voucher" });
  });

  it("shows the rejection and its reason on a sent-back draft", () => {
    const steps = approvalTrail(v("draft"), j({ created_by: "a", rejected_by: "c", rejected_at: "z", rejection_reason: "Wrong head" }));
    expect(steps[1].missing).toBe("Sent back, not resubmitted yet");
    expect(steps[2]).toMatchObject({ label: "Rejected by", userId: "c", note: "Wrong head" });
  });

  it("demo vouchers are made and approved only by the dataset's own members, on the voucher's date", () => {
    for (const { slug } of DEMO_COMPANIES) {
      const ds = createInitialDemoDataset(slug);
      const ids = new Set(ds.members.map((m) => m.user_id));
      for (const je of ds.journals.filter((x) => x.status === "posted")) {
        expect(ids.has(je.created_by!)).toBe(true);
        expect(ids.has(je.posted_by!)).toBe(true);
        expect(je.created_by).not.toBe(je.posted_by);
        expect(je.created_at!.slice(0, 10)).toBe(je.entry_date);
      }
    }
  });
});
