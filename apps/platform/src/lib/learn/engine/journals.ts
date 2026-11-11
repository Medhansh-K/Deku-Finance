/**
 * Vouchers: create draft, edit draft, submit, approve and post, reject, reverse. Mirrors
 * create_journal (Rust) + RLS, edit_draft_journal (migration 55), submit/reject/post (migration 20)
 * and reverse_journal_entry (migration 6/27). Helpers here are also used by invoices, notes, stock
 * adjustments and payroll, which post their own journals the same way.
 */
import type { OrgRole } from "@/modules/departments-members/team";
import type { JournalEntry, JournalEntryLine } from "@/types/accounting";
import type { DemoDataset } from "../sample-data";
import {
  checkLines,
  checkPostable,
  fail,
  nextVoucherNumber,
  newId,
  numberLines,
  openPeriodFor,
  reversedLines,
  totals,
  uniqueEntryNumber,
} from "./books";
import { actor, ledgerUpdated, save, voucherTypeOf, withAudit, type Handler, type Req } from "./context";
import { assertRole } from "./rbac";

type NewLine = Omit<JournalEntryLine, "line_number">;

/** Inserts a draft (journal_entries + lines). The caller has checked the role. */
export function insertDraft(
  ds: DemoDataset,
  role: OrgRole,
  h: { entry_number: string; entry_date: string; narration: string; reference?: string | null; fiscal_period_id?: string; reversal_of_id?: string | null },
  lines: NewLine[]
): { ds: DemoDataset; entry: JournalEntry } {
  if (!h.entry_number?.trim()) fail("A voucher needs a number");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.entry_date ?? "")) fail("A voucher needs a date");
  uniqueEntryNumber(ds, h.entry_number.trim());
  const fpId = h.fiscal_period_id ?? openPeriodFor(ds, h.entry_date)?.id ?? fail(`No open fiscal period covers ${h.entry_date}`);
  if (!ds.fiscalPeriods.some((p) => p.id === fpId)) fail("That fiscal period doesn't exist in this company");
  const id = newId(ds, "je");
  const numbered = numberLines(id, lines);
  checkLines(ds, numbered);
  const who = actor(ds, role);
  const entry: JournalEntry = {
    id,
    organisation_id: ds.org.id,
    fiscal_period_id: fpId,
    entry_number: h.entry_number.trim(),
    entry_date: h.entry_date,
    status: "draft",
    narration: h.narration ?? "",
    reference: h.reference ?? null,
    reversal_of_id: h.reversal_of_id ?? null,
    created_at: new Date().toISOString(),
    created_by: who.id,
    submitted_at: null,
    submitted_by: null,
    journal_entry_lines: numbered,
  };
  return { ds: { ...ds, journals: [entry, ...ds.journals] }, entry };
}

const replaceJournal = (ds: DemoDataset, j: JournalEntry): DemoDataset => ({ ...ds, journals: ds.journals.map((x) => (x.id === j.id ? j : x)) });

export const findJournal = (ds: DemoDataset, id: string) => ds.journals.find((j) => j.id === id) ?? fail("Journal entry not found", 404);

/** submit_journal_for_approval without the role check (callers check). */
export function submitDraft(ds: DemoDataset, role: OrgRole, id: string): { ds: DemoDataset; entry: JournalEntry } {
  const j = findJournal(ds, id);
  if (j.status !== "draft") fail(`Only draft vouchers can be submitted (status: ${j.status})`);
  const t = totals(j.journal_entry_lines);
  if (j.journal_entry_lines.length < 2 || t.debit <= 0 || Math.round(t.debit * 100) !== Math.round(t.credit * 100))
    fail("Voucher must have at least 2 lines and balance before it can be submitted");
  const entry: JournalEntry = {
    ...j,
    submitted_at: new Date().toISOString(),
    submitted_by: actor(ds, role).id,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
  };
  return { ds: replaceJournal(ds, entry), entry };
}

/**
 * post_journal_entry. `sameTransaction` is true when the database would post inside the function
 * that created the draft (invoice issue, reversal, approver's own stock adjustment): there the
 * maker-checker clause doesn't apply because created_at = now().
 */
export function postDraft(ds: DemoDataset, role: OrgRole, id: string, sameTransaction = false): { ds: DemoDataset; entry: JournalEntry } {
  const j = findJournal(ds, id);
  if (j.status !== "draft") fail(`Only draft entries can be posted (Current status: ${j.status})`);
  const me = actor(ds, role).id;
  if (ds.org.require_journal_approval && !sameTransaction) {
    if (!j.submitted_at) fail("Approval required: submit this voucher for approval before posting");
    if (me && (me === j.created_by || me === j.submitted_by)) fail("Maker-checker: you cannot approve a voucher you created or submitted");
  }
  checkPostable(ds, j);
  const entry: JournalEntry = { ...j, status: "posted", posted_at: new Date().toISOString(), posted_by: me };
  const next = withAudit(replaceJournal(ds, entry), role, "VOUCHER", "Voucher Posted to Universal Ledger", `Posted voucher ${entry.entry_number} to the general ledger`, "journal_entry", entry.id, {
    entry_number: entry.entry_number,
    entry_date: entry.entry_date,
  });
  return { ds: next, entry };
}

/** reverse_journal_entry: a posted contra entry with swapped lines, original marked reversed. */
export function reversePosted(ds: DemoDataset, role: OrgRole, id: string, date: string, narration?: string | null) {
  const orig = findJournal(ds, id);
  if (orig.status !== "posted") fail(`Only posted journal entries can be reversed (Status: ${orig.status})`);
  const period = openPeriodFor(ds, date) ?? fail(`No open fiscal period found for reversal date ${date}`);
  const draft = insertDraft(
    ds,
    role,
    {
      entry_number: `REV-${orig.entry_number}`,
      entry_date: date,
      narration: narration?.trim() || `Reversal of ${orig.entry_number}: ${orig.narration}`,
      reference: `REV-${orig.reference ?? orig.entry_number}`,
      fiscal_period_id: period.id,
      reversal_of_id: orig.id,
    },
    reversedLines(orig)
  );
  const posted = postDraft(draft.ds, role, draft.entry.id, true);
  const next = { ...posted.ds, journals: posted.ds.journals.map((j) => (j.id === orig.id ? { ...j, status: "reversed" as const } : j)) };
  return { ds: next, reversal: posted.entry, original: orig };
}

const lineInput = (l: Record<string, unknown>): NewLine => ({
  account_id: String(l.account_id ?? ""),
  party_id: (l.party_id as string) || null,
  description: (l.description as string) ?? null,
  debit: Number(l.debit || 0),
  credit: Number(l.credit || 0),
});

/** Entries that come from documents can't be edited as vouchers (edit_draft_journal). */
function fromDocument(ds: DemoDataset, j: JournalEntry) {
  return (
    j.entry_number.startsWith("STK-") ||
    ds.invoices.some((i) => i.journal_entry_id === j.id) ||
    ds.notes.some((n) => n.journal_entry_id === j.id) ||
    ds.purchases.some((p) => p.journal_entry_id === j.id) ||
    ds.marketplaceSettlements.some((m) => m.journal_entry_id === j.id) ||
    ds.payrollRuns.some((p) => p.journal_entry_id === j.id)
  );
}

export const journalHandler: Handler = (req: Req) => {
  const { sub, method, body, ctx, role } = req;
  let ds = req.ds;

  if (sub === "/journals/next-number" && method === "GET") {
    return { success: true, data: nextVoucherNumber(ds, req.query.get("prefix") || "JRN") };
  }

  if (sub === "/journals") {
    if (method === "GET") return { success: true, data: [...ds.journals].sort((a, b) => b.entry_date.localeCompare(a.entry_date)) };
    if (method === "POST") {
      assertRole(ctx, "createDraft", "Creating a voucher");
      const r = insertDraft(ds, role, body as never, (body.lines ?? []).map(lineInput));
      save(req, r.ds);
      const t = totals(r.entry.journal_entry_lines);
      ctx.record("journal.created", `Saved draft ${r.entry.entry_number}`, {
        journalId: r.entry.id,
        number: r.entry.entry_number,
        voucherType: voucherTypeOf(r.entry.entry_number),
        total: t.debit,
        status: "draft",
      });
      ledgerUpdated({ journalId: r.entry.id, act: "create" });
      return { success: true, entry: [r.entry], lines: r.entry.journal_entry_lines };
    }
  }

  const edit = sub.match(/^\/journals\/([^/]+)$/);
  if (edit && method === "PUT") {
    assertRole(ctx, "createDraft", "Editing a draft voucher");
    const j = findJournal(ds, edit[1]);
    if (j.status !== "draft") fail(`Only draft vouchers can be edited (status: ${j.status})`);
    if (j.submitted_at) fail("This voucher is awaiting approval and cannot be edited. The approver can send it back first.");
    if (ds.org.require_journal_approval && actor(ds, role).id !== j.created_by) fail("Maker-checker: only the person who made this voucher can edit it");
    if (fromDocument(ds, j)) fail("This voucher comes from an invoice, note, bill, settlement, payment or stock movement, so it cannot be edited here.");
    if (!String(body.narration ?? "").trim()) fail("A voucher needs a narration");
    if (!Array.isArray(body.lines) || body.lines.length < 2) fail("A voucher needs at least 2 lines");
    const period = openPeriodFor(ds, body.entry_date) ?? fail(`No open fiscal period covers ${body.entry_date}. Add or reopen one in Settings.`);
    const lines = numberLines(j.id, body.lines.map(lineInput));
    checkLines(ds, lines);
    const entry: JournalEntry = {
      ...j,
      entry_date: body.entry_date,
      fiscal_period_id: period.id,
      narration: String(body.narration).trim(),
      reference: String(body.reference ?? "").trim() || null,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
      journal_entry_lines: lines,
    };
    ds = withAudit(replaceJournal(ds, entry), role, "VOUCHER", "Draft Voucher Edited", `Edited draft voucher ${entry.entry_number}`, "journal_entry", entry.id, {
      entry_number: entry.entry_number,
      previous_total: totals(j.journal_entry_lines).debit,
    });
    save(req, ds);
    ctx.record("journal.updated", `Edited draft ${entry.entry_number}`, { journalId: entry.id, number: entry.entry_number });
    ledgerUpdated({ journalId: entry.id, act: "edit" });
    return { success: true, message: "Draft voucher updated", entry };
  }

  const act = sub.match(/^\/journals\/([^/]+)\/(post|submit|reject|reverse)$/);
  if (act && method === "POST") {
    const [, id, action] = act;
    if (action === "submit") {
      assertRole(ctx, "submitVoucher", "Submitting a voucher for approval");
      const r = submitDraft(ds, role, id);
      save(req, r.ds);
      ctx.record("journal.submitted", `Submitted ${r.entry.entry_number} for approval`, { journalId: id, number: r.entry.entry_number });
      ledgerUpdated({ journalId: id, act: action });
      return { success: true, message: "Voucher submitted for approval", entry: r.entry };
    }
    if (action === "post") {
      assertRole(ctx, "approveVoucher", "Approving and posting a voucher");
      const r = postDraft(ds, role, id);
      save(req, r.ds);
      ctx.record("journal.posted", `Posted ${r.entry.entry_number} to the ledger`, {
        journalId: id,
        number: r.entry.entry_number,
        total: totals(r.entry.journal_entry_lines).debit,
      });
      ledgerUpdated({ journalId: id, act: action });
      return { success: true, message: "Journal entry posted successfully", entry: r.entry };
    }
    if (action === "reject") {
      assertRole(ctx, "approveVoucher", "Rejecting a voucher");
      const reason = String(body.reason ?? "").trim();
      if (!reason) fail("A reason is required to reject a voucher");
      const j = findJournal(ds, id);
      if (j.status !== "draft" || !j.submitted_at) fail("Only vouchers awaiting approval can be rejected");
      const entry: JournalEntry = { ...j, rejected_at: new Date().toISOString(), rejected_by: actor(ds, role).id, rejection_reason: reason, submitted_at: null, submitted_by: null };
      save(req, replaceJournal(ds, entry));
      ctx.record("journal.rejected", `Sent ${entry.entry_number} back: ${reason}`, { journalId: id, number: entry.entry_number, reason });
      ledgerUpdated({ journalId: id, act: action });
      return { success: true, message: "Voucher sent back to its maker", entry };
    }
    assertRole(ctx, "reverseVoucher", "Reversing a posted voucher");
    const date = String(body.reversal_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Choose a reversal date");
    const r = reversePosted(ds, role, id, date, body.narration);
    save(req, r.ds);
    ctx.record("journal.reversed", `Reversed ${r.original.entry_number} with ${r.reversal.entry_number}`, {
      journalId: id,
      number: r.original.entry_number,
      reversalJournalId: r.reversal.id,
    });
    ledgerUpdated({ journalId: id, act: action });
    return { success: true, message: "Journal entry reversed successfully", reversal_entry_id: r.reversal.id };
  }
  return undefined;
};
