/**
 * Bank reconciliation: per-line matches (bank_reconciliations + guard, migration 19/52), the
 * position (bank_reconciliation_position) and completed reconciliations (reconciliation_statements
 * + guard_reconciliation_statement, migration 56). The statement itself is parsed in the browser,
 * as in the real app; the demo supplies one (sample-data demoStatementCsv).
 */
import type { BankReconciliation, ReconciliationStatement } from "@/api/endpoints";
import type { DemoDataset } from "../sample-data";
import { fail, newId, r2 } from "./books";
import { actor, save, type Handler, type Req } from "./context";
import { assertRole } from "./rbac";

export function bankPosition(ds: DemoDataset, bankId: string, asOf: string) {
  const acc = ds.accounts.find((a) => a.id === bankId);
  if (!acc || acc.type !== "asset" || acc.is_postable === false) fail("The bank account is not a postable asset account of this company");
  let book = 0;
  let uncleared = 0;
  for (const j of ds.journals) {
    if ((j.status !== "posted" && j.status !== "reversed") || j.entry_date > asOf) continue;
    for (const l of j.journal_entry_lines) {
      if (l.account_id !== bankId) continue;
      const amt = l.debit - l.credit;
      book += amt;
      if (!ds.bankMatches.some((m) => m.journal_entry_line_id === l.id && m.statement_date <= asOf)) uncleared += amt;
    }
  }
  const matched = ds.bankMatches.filter((m) => m.bank_account_id === bankId && m.statement_date <= asOf).reduce((s, m) => s + m.statement_amount, 0);
  return { book_balance: r2(book), matched_amount: r2(matched), uncleared_amount: r2(uncleared) };
}

/** The supplied statement line a saved match refers to (same date, amount and reference). */
function suppliedLine(ds: DemoDataset, m: Pick<BankReconciliation, "statement_date" | "statement_amount" | "statement_reference">) {
  for (const st of ds.bankStatements) {
    const line = st.lines.find((l) => l.date === m.statement_date && Math.round(l.amount * 100) === Math.round(m.statement_amount * 100) && (l.reference ?? "") === (m.statement_reference ?? ""));
    if (line) return { st, line };
  }
  return null;
}

export const bankingHandler: Handler = (req: Req) => {
  const { sub, method, body, ctx, role, query } = req;
  let ds = req.ds;

  if (sub === "/banking/reconciliations") {
    if (method === "GET") {
      const bank = query.get("bank_account_id");
      return { success: true, data: ds.bankMatches.filter((m) => !bank || m.bank_account_id === bank) };
    }
    if (method === "POST") {
      assertRole(ctx, "reconcileBank", "Matching bank statement lines");
      const amount = r2(Number(body.statement_amount));
      if (!amount) fail("A statement line needs a non-zero amount");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.statement_date ?? "")) fail("A statement line needs a date");
      const line = ds.journals.flatMap((j) => j.journal_entry_lines.map((l) => ({ j, l }))).find((x) => x.l.id === body.journal_entry_line_id);
      if (!line || line.l.account_id !== body.bank_account_id || line.j.status !== "posted" || Math.round((line.l.debit - line.l.credit) * 100) !== Math.round(amount * 100))
        fail(`Reconciliation Violation: journal line is not a posted entry on this bank account for ${amount}`);
      if (ds.bankMatches.some((m) => m.journal_entry_line_id === line.l.id)) fail(`${line.j.entry_number} is already matched to a statement line`);
      const row: BankReconciliation = {
        id: newId(ds, "brec"),
        organisation_id: ds.org.id,
        bank_account_id: body.bank_account_id,
        statement_date: body.statement_date,
        statement_amount: amount,
        statement_reference: body.statement_reference ?? null,
        statement_narration: body.statement_narration ?? null,
        journal_entry_line_id: line.l.id!,
        reconciled_by: actor(ds, role).id ?? "",
        reconciled_at: new Date().toISOString(),
      };
      ds = { ...ds, bankMatches: [...ds.bankMatches, row] };
      const supplied = suppliedLine(ds, row);
      // The statement is parsed in the browser, so the first match against the supplied file is when the demo knows it was loaded.
      if (supplied && !supplied.st.imported_at) {
        ds = { ...ds, bankStatements: ds.bankStatements.map((s) => (s.id === supplied.st.id ? { ...s, imported_at: new Date().toISOString() } : s)) };
        save(req, ds);
        ctx.record("bank.statement_imported", `Loaded ${supplied.st.file_name}`, { statementId: supplied.st.id, lines: supplied.st.lines.length });
      } else save(req, ds);
      ctx.record("bank.matched", `Matched ${amount} on ${row.statement_date} to ${line.j.entry_number}`, {
        statementId: supplied?.st.id ?? "uploaded",
        lineId: supplied?.line.id ?? row.id,
        journalId: line.j.id,
      });
      return { success: true, data: [row] };
    }
  }

  const undo = sub.match(/^\/banking\/reconciliations\/([^/]+)$/);
  if (undo && method === "DELETE") {
    assertRole(ctx, "reconcileBank", "Undoing a bank match");
    const m = ds.bankMatches.find((x) => x.id === undo[1]) ?? fail("Match not found", 404);
    save(req, { ...ds, bankMatches: ds.bankMatches.filter((x) => x.id !== m.id) });
    const supplied = suppliedLine(ds, m);
    ctx.record("bank.unmatched", `Undid the match for ${m.statement_amount} on ${m.statement_date}`, { statementId: supplied?.st.id ?? "uploaded", lineId: supplied?.line.id ?? m.id });
    return { success: true, data: [m] };
  }

  if (sub === "/banking/statements/position" && method === "GET") {
    const bank = query.get("bank_account_id") ?? ds.accounts.find((a) => a.code === "1020")?.id ?? "";
    return { success: true, data: bankPosition(ds, bank, query.get("as_of") || "9999-12-31") };
  }

  if (sub === "/banking/statements") {
    if (method === "GET") return { success: true, data: [...ds.reconciliationStatements].sort((a, b) => b.statement_date.localeCompare(a.statement_date)) };
    if (method === "POST") {
      assertRole(ctx, "reconcileBank", "Completing a bank reconciliation");
      const bank = String(body.bank_account_id ?? "");
      const date = String(body.statement_date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Enter the statement date");
      if (ds.reconciliationStatements.some((s) => s.bank_account_id === bank && s.statement_date === date)) fail(`A reconciliation for ${date} is already recorded`);
      const pos = bankPosition(ds, bank, date);
      const closing = r2(Number(body.closing_balance));
      const statementOnly = r2(Number(body.statement_only_amount ?? 0));
      const unexplained = r2(closing - pos.matched_amount - statementOnly);
      let accepted: number | null = null;
      if (unexplained !== 0) {
        if (body.accepted_difference == null || r2(Number(body.accepted_difference)) !== unexplained) fail(`difference_not_accepted: ${unexplained} is unexplained`);
        accepted = unexplained;
      }
      const who = actor(ds, role);
      const row: ReconciliationStatement = {
        id: newId(ds, "rst"),
        organisation_id: ds.org.id,
        bank_account_id: bank,
        statement_date: date,
        closing_balance: closing,
        ...pos,
        statement_only_amount: statementOnly,
        difference: r2(closing - pos.book_balance),
        unexplained_difference: unexplained,
        accepted_difference: accepted,
        recorded_by: who.id ?? "",
        recorded_by_name: who.name,
        recorded_at: new Date().toISOString(),
      };
      save(req, { ...ds, reconciliationStatements: [row, ...ds.reconciliationStatements] });
      ctx.record("bank.reconciled", `Completed the reconciliation to ${date}`, { reconciliationId: row.id, difference: row.difference });
      return { success: true, data: [row] };
    }
  }
  return undefined;
};
